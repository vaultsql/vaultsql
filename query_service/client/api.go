package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"
	"gitlab.com/vaultsql/query_service/config"
	"gitlab.com/vaultsql/query_service/types"
)

// CheckEndpoint calls the Python API /check endpoint to validate authorization
// and retrieve database credentials
func CheckEndpoint(cfg *config.Config, accountID string, authHeader string, reqBody types.QueryRequest) (*types.CheckResponse, int, error) {
	apiBase := strings.TrimSuffix(cfg.VaultSQLAPI, "/")

	if cfg.QueryServiceSecret == "" {
		err := fmt.Errorf("QUERY_SERVICE_SECRET not configured")
		config.Logger.Error("QUERY_SERVICE_SECRET not configured")
		sentry.CaptureException(err)
		return nil, http.StatusInternalServerError, err
	}

	checkURL := fmt.Sprintf("%s/api/account/%s/check", apiBase, accountID)

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		config.Logger.Error("Failed to marshal request", "error", err, "account_id", accountID)
		sentry.CaptureException(err)
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", checkURL, bytes.NewReader(bodyBytes))
	if err != nil {
		config.Logger.Error("Failed to create request", "error", err, "url", checkURL)
		sentry.CaptureException(err)
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("X-Query-Secret", cfg.QueryServiceSecret)

	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		config.Logger.Error("Failed to call check endpoint", "error", err, "url", checkURL)
		sentry.CaptureException(err)
		return nil, http.StatusBadGateway, fmt.Errorf("failed to call check endpoint: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		config.Logger.Error("Failed to read response", "error", err, "account_id", accountID)
		sentry.CaptureException(err)
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp types.ErrorResponse
		if json.Unmarshal(respBody, &errResp) == nil && errResp.Detail != "" {
			config.Logger.Warn("Check endpoint returned error",
				"status", resp.StatusCode,
				"detail", errResp.Detail,
				"account_id", accountID)
			return nil, resp.StatusCode, fmt.Errorf("%s", errResp.Detail)
		}
		config.Logger.Warn("Check endpoint returned non-OK status",
			"status", resp.StatusCode,
			"account_id", accountID)
		return nil, resp.StatusCode, fmt.Errorf("check endpoint returned status %d", resp.StatusCode)
	}

	var checkResp types.CheckResponse
	if err := json.Unmarshal(respBody, &checkResp); err != nil {
		config.Logger.Error("Failed to parse check response", "error", err, "account_id", accountID)
		sentry.CaptureException(err)
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to parse check response: %w", err)
	}

	config.Logger.Info("Check endpoint success",
		"account_id", accountID,
		"database_type", checkResp.DatabaseType)

	return &checkResp, http.StatusOK, nil
}

// LogEndpoint calls the Python API /log endpoint to record query execution in audit log
func LogEndpoint(cfg *config.Config, accountID string, authHeader string, reqBody types.AuditLogRequest) error {
	apiBase := strings.TrimSuffix(cfg.VaultSQLAPI, "/")

	if cfg.QueryServiceSecret == "" {
		config.Logger.Warn("QUERY_SERVICE_SECRET not configured, skipping audit log")
		return nil
	}

	logURL := fmt.Sprintf("%s/api/account/%s/log", apiBase, accountID)

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		config.Logger.Error("Failed to marshal audit log request", "error", err, "account_id", accountID)
		return err
	}

	req, err := http.NewRequest("POST", logURL, bytes.NewReader(bodyBytes))
	if err != nil {
		config.Logger.Error("Failed to create audit log request", "error", err, "url", logURL)
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("X-Query-Secret", cfg.QueryServiceSecret)

	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		config.Logger.Error("Failed to call log endpoint", "error", err, "url", logURL)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		config.Logger.Warn("Log endpoint returned non-OK status",
			"status", resp.StatusCode,
			"account_id", accountID)
		// Don't fail the query if audit logging fails
		return nil
	}

	config.Logger.Debug("Audit log recorded", "account_id", accountID)
	return nil
}

// LogEndpointWithContext calls the Python API /log endpoint with context support
func LogEndpointWithContext(ctx context.Context, cfg *config.Config, accountID string, authHeader string, reqBody types.AuditLogRequest) error {
	apiBase := strings.TrimSuffix(cfg.VaultSQLAPI, "/")

	if cfg.QueryServiceSecret == "" {
		config.Logger.Warn("QUERY_SERVICE_SECRET not configured, skipping audit log")
		return nil
	}

	logURL := fmt.Sprintf("%s/api/account/%s/log", apiBase, accountID)

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		config.Logger.Error("Failed to marshal audit log request", "error", err, "account_id", accountID)
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", logURL, bytes.NewReader(bodyBytes))
	if err != nil {
		config.Logger.Error("Failed to create audit log request", "error", err, "url", logURL)
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("X-Query-Secret", cfg.QueryServiceSecret)

	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		config.Logger.Error("Failed to call log endpoint", "error", err, "url", logURL)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		config.Logger.Warn("Log endpoint returned non-OK status",
			"status", resp.StatusCode,
			"account_id", accountID)
		// Don't fail the query if audit logging fails
		return nil
	}

	config.Logger.Debug("Audit log recorded", "account_id", accountID)
	return nil
}
