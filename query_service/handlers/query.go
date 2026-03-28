package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"gitlab.com/vaultsql/query_service/client"
	"gitlab.com/vaultsql/query_service/config"
	"gitlab.com/vaultsql/query_service/drivers"
	"gitlab.com/vaultsql/query_service/types"
)

// isConnectivityError checks if an error message indicates a connection failure
// (as opposed to a query syntax error). Connectivity errors should be logged
// for account health monitoring.
func isConnectivityError(errMsg string) bool {
	return strings.HasPrefix(errMsg, "Failed to open database connection")
}

const defaultQueryTimeout = 60 // seconds

type Handler struct {
	cfg *config.Config
}

func New(cfg *config.Config) *Handler {
	return &Handler{cfg: cfg}
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	
	// Check SSH tunnel pool status
	pool := drivers.GetTunnelPool()
	tunnelPoolStatus := "ok"
	if pool == nil {
		tunnelPoolStatus = "not_configured"
	} else if !pool.IsHealthy() {
		tunnelPoolStatus = "unhealthy"
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":      "unhealthy",
			"tunnel_pool": tunnelPoolStatus,
		})
		return
	}
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "ok",
		"tunnel_pool": tunnelPoolStatus,
	})
}

func (h *Handler) RunQuery(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	accountID := chi.URLParam(r, "account_id")
	if accountID == "" {
		config.Logger.Warn("Missing account_id parameter")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: "account_id is required"})
		return
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		config.Logger.Warn("Missing Authorization header", "account_id", accountID)
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: "Authorization header is required"})
		return
	}

	var reqBody types.ExportRequest
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		config.Logger.Warn("Invalid request body", "error", err, "account_id", accountID)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: "Invalid request body"})
		return
	}

	if reqBody.Query == "" {
		config.Logger.Warn("Missing query parameter", "account_id", accountID)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: "query is required"})
		return
	}

	config.Logger.Info("Query request received",
		"account_id", accountID,
		"query_length", len(reqBody.Query))

	checkResp, statusCode, err := client.CheckEndpoint(h.cfg, accountID, authHeader, reqBody.QueryRequest)
	if err != nil {
		w.WriteHeader(statusCode)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: err.Error()})
		return
	}

	driver, err := drivers.Get(checkResp.DatabaseType)
	if err != nil {
		config.Logger.Warn("Unsupported database type",
			"database_type", checkResp.DatabaseType,
			"account_id", accountID)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: fmt.Sprintf("Database type '%s' is not supported by the query service", checkResp.DatabaseType)})
		return
	}

	// Create context with timeout
	timeout := defaultQueryTimeout
	if reqBody.Timeout != nil && *reqBody.Timeout > 0 {
		timeout = *reqBody.Timeout
	}
	ctx, cancel := context.WithTimeout(r.Context(), time.Duration(timeout)*time.Second)
	defer cancel()

	if reqBody.Format != nil && *reqBody.Format != "" {
		exportFormat, err := parseExportFormat(*reqBody.Format)
		if err != nil {
			writeExportError(w, err, nil)
			return
		}

		csvDelimiter, err := parseCSVDelimiter(reqBody.CsvDelimiter)
		if err != nil {
			writeExportError(w, err, nil)
			return
		}

		sqlTable := ""
		if reqBody.SQLTable != nil {
			sqlTable = *reqBody.SQLTable
		}

		exporter := newExportWriter(w, exportFormat, reqBody.Columns, csvDelimiter, sqlTable)
		streamErr := driver.Stream(ctx, checkResp.DatabaseCredentials, checkResp.AccountCredentials, reqBody.Query, reqBody.MaxRows, exporter.OnColumns, exporter.OnRow)
		if streamErr != nil {
			if _, ok := streamErr.(*exportError); ok {
				config.Logger.Warn("Export streaming error", "error", streamErr, "account_id", accountID)
			} else {
				config.Logger.Error("Export streaming error", "error", streamErr, "account_id", accountID)
			}
			writeExportError(w, streamErr, exporter)
		}

		// Log query execution with connectivity status
		go func() {
			auditCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			connectivityError := false
			var errorMessage *string
			if streamErr != nil {
				errMsg := streamErr.Error()
				if isConnectivityError(errMsg) {
					connectivityError = true
					errorMessage = &errMsg
				}
			}

			logReq := types.AuditLogRequest{
				Query:             reqBody.Query,
				QueryActorType:    "custom",
				ConnectivityError: &connectivityError,
				ErrorMessage:      errorMessage,
			}
			if err := client.LogEndpointWithContext(auditCtx, h.cfg, accountID, authHeader, logReq); err != nil {
				config.Logger.Error("Failed to log query", "error", err, "account_id", accountID)
			}
		}()

		if streamErr != nil {
			return
		}
		return
	}

	result, err := driver.Execute(ctx, checkResp.DatabaseCredentials, checkResp.AccountCredentials, reqBody.Query, reqBody.MaxRows)
	if err != nil {
		config.Logger.Error("Driver execution error", "error", err, "account_id", accountID)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: err.Error()})
		return
	}

	// Log query execution to audit log with connectivity status
	go func() {
		auditCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// Check if result indicates a connectivity error
		connectivityError := false
		var errorMessage *string
		if !result.Success && result.Error != nil {
			if isConnectivityError(*result.Error) {
				connectivityError = true
				errorMessage = result.Error
			}
		}

		logReq := types.AuditLogRequest{
			Query:             reqBody.Query,
			QueryActorType:    "custom",
			ConnectivityError: &connectivityError,
			ErrorMessage:      errorMessage,
		}
		if err := client.LogEndpointWithContext(auditCtx, h.cfg, accountID, authHeader, logReq); err != nil {
			config.Logger.Error("Failed to log query", "error", err, "account_id", accountID)
		}
	}()

	if !result.Success {
		w.WriteHeader(http.StatusInternalServerError)
	}
	json.NewEncoder(w).Encode(result)
}

func writeExportError(w http.ResponseWriter, err error, exporter *exportWriter) {
	if exporter != nil && exporter.hasWrittenBody() {
		return
	}

	if exporter != nil {
		w.Header().Del("Content-Disposition")
		w.Header().Del("Cache-Control")
		w.Header().Del("X-Accel-Buffering")
	}

	status := http.StatusInternalServerError
	detail := err.Error()

	if exportErr, ok := err.(*exportError); ok {
		status = exportErr.status
		detail = exportErr.message
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(types.ErrorResponse{Detail: detail})
}

func parseCSVDelimiter(raw *string) (rune, error) {
	if raw == nil {
		return 0, nil
	}

	value := *raw
	if value == "" {
		return 0, &exportError{
			status:  http.StatusBadRequest,
			message: "csv_delimiter must be a single character",
		}
	}

	runes := []rune(value)
	if len(runes) != 1 {
		return 0, &exportError{
			status:  http.StatusBadRequest,
			message: "csv_delimiter must be a single character",
		}
	}

	return runes[0], nil
}

const testConnectionTimeout = 10 // seconds

func (h *Handler) TestConnection(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Verify query service secret for internal calls
	querySecret := r.Header.Get("X-Query-Secret")
	if querySecret == "" || querySecret != h.cfg.QueryServiceSecret {
		config.Logger.Warn("Invalid or missing X-Query-Secret header")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: "Invalid query service secret"})
		return
	}

	var reqBody types.TestConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		config.Logger.Warn("Invalid request body", "error", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: "Invalid request body"})
		return
	}

	if reqBody.DatabaseType == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: "database_type is required"})
		return
	}

	if reqBody.DatabaseCredentials == nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: "database_credentials is required"})
		return
	}

	if reqBody.AccountCredentials == nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: "account_credentials is required"})
		return
	}

	config.Logger.Info("Test connection request received",
		"database_type", reqBody.DatabaseType)

	driver, err := drivers.Get(reqBody.DatabaseType)
	if err != nil {
		config.Logger.Warn("Unsupported database type", "database_type", reqBody.DatabaseType)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(types.TestConnectionResponse{
			Success: false,
			Message: fmt.Sprintf("Database type '%s' is not supported", reqBody.DatabaseType),
		})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), testConnectionTimeout*time.Second)
	defer cancel()

	// Execute a simple health check query
	healthQuery := "SELECT version()"
	result, err := driver.Execute(ctx, reqBody.DatabaseCredentials, reqBody.AccountCredentials, healthQuery, nil)
	if err != nil {
		config.Logger.Error("Connection test failed", "error", err, "database_type", reqBody.DatabaseType)
		w.WriteHeader(http.StatusOK) // Return 200 but with success=false
		json.NewEncoder(w).Encode(types.TestConnectionResponse{
			Success: false,
			Message: fmt.Sprintf("Connection failed: %v", err),
		})
		return
	}

	if !result.Success {
		errMsg := "Unknown error"
		if result.Error != nil {
			errMsg = *result.Error
		}
		config.Logger.Warn("Connection test query failed", "error", errMsg, "database_type", reqBody.DatabaseType)
		w.WriteHeader(http.StatusOK) // Return 200 but with success=false
		json.NewEncoder(w).Encode(types.TestConnectionResponse{
			Success: false,
			Message: fmt.Sprintf("Connection failed: %s", errMsg),
		})
		return
	}

	// Extract version from result
	version := "unknown"
	if len(result.Result) > 0 {
		if v, ok := result.Result[0]["version"]; ok {
			if vs, ok := v.(string); ok {
				version = vs
			}
		}
	}

	config.Logger.Info("Connection test successful",
		"database_type", reqBody.DatabaseType,
		"version", version)

	json.NewEncoder(w).Encode(types.TestConnectionResponse{
		Success: true,
		Message: "Connection successful",
		Details: map[string]string{"version": version},
	})
}
