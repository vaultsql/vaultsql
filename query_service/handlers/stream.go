package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"gitlab.com/vaultsql/query_service/client"
	"gitlab.com/vaultsql/query_service/config"
	"gitlab.com/vaultsql/query_service/drivers"
	"gitlab.com/vaultsql/query_service/types"
)

const defaultStreamMaxRows = 1000

func (h *Handler) StreamQuery(w http.ResponseWriter, r *http.Request) {
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

	var reqBody types.QueryRequest
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

	config.Logger.Info("Streaming query request received",
		"account_id", accountID,
		"query_length", len(reqBody.Query))

	checkResp, statusCode, err := client.CheckEndpoint(h.cfg, accountID, authHeader, reqBody)
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
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: err.Error()})
		return
	}

	timeout := defaultQueryTimeout
	if reqBody.Timeout != nil && *reqBody.Timeout > 0 {
		timeout = *reqBody.Timeout
	}
	ctx, cancel := context.WithTimeout(r.Context(), time.Duration(timeout)*time.Second)
	defer cancel()

	maxRows := defaultStreamMaxRows
	if reqBody.MaxRows != nil && *reqBody.MaxRows > 0 && *reqBody.MaxRows < maxRows {
		maxRows = *reqBody.MaxRows
	}
	reqBody.MaxRows = &maxRows

	flusher, ok := w.(http.Flusher)
	if !ok {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(types.ErrorResponse{Detail: "Streaming not supported"})
		return
	}

	w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")

	encoder := json.NewEncoder(w)
	writeEvent := func(event types.StreamEvent) error {
		if err := encoder.Encode(event); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	rowCount := 0
	onColumns := func(columns []types.QueryColumn) error {
		return writeEvent(types.StreamEvent{
			Type:    "meta",
			Columns: columns,
		})
	}

	onRow := func(row map[string]interface{}) error {
		if err := writeEvent(types.StreamEvent{
			Type: "row",
			Row:  row,
		}); err != nil {
			return err
		}
		rowCount++
		return nil
	}

	streamErr := driver.Stream(ctx, checkResp.DatabaseCredentials, checkResp.AccountCredentials, reqBody.Query, reqBody.MaxRows, onColumns, onRow)
	if streamErr != nil {
		config.Logger.Error("Driver streaming error", "error", streamErr, "account_id", accountID)
		_ = writeEvent(types.StreamEvent{
			Type:  "error",
			Error: streamErr.Error(),
		})
	}

	// Log query execution to audit log with connectivity status
	go func() {
		auditCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// Check if error indicates a connectivity failure
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

	truncated := reqBody.MaxRows != nil && *reqBody.MaxRows > 0 && rowCount >= *reqBody.MaxRows
	_ = writeEvent(types.StreamEvent{
		Type:      "complete",
		RowCount:  &rowCount,
		Truncated: &truncated,
	})
}
