package drivers

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"
	_ "github.com/lib/pq"
	"gitlab.com/vaultsql/query_service/config"
	"gitlab.com/vaultsql/query_service/types"
)

// escapeLibpqValue escapes a value for use in a libpq connection string.
// Values containing special characters (spaces, quotes, backslashes) are
// single-quoted, with internal single quotes escaped by doubling them.
func escapeLibpqValue(value string) string {
	// If value contains spaces, single quotes, backslashes, or equals signs,
	// it needs to be quoted
	if strings.ContainsAny(value, " '\\=") {
		// Escape single quotes by doubling them
		escaped := strings.ReplaceAll(value, "'", "''")
		return "'" + escaped + "'"
	}
	return value
}

func init() {
	Register(&PostgresDriver{})
}

type PostgresDriver struct{}

func (d *PostgresDriver) Name() string {
	return "postgres"
}

func (d *PostgresDriver) Execute(ctx context.Context, databaseCreds, accountCreds map[string]interface{}, query string, maxRows *int) (*types.QueryResponse, error) {
	hostname := GetStringFromMap(databaseCreds, "hostname", "localhost")
	port := GetIntFromMap(databaseCreds, "port", 5432)
	database := GetStringFromMap(databaseCreds, "database", "postgres")
	sslMode := normalizeSSLMode(GetStringFromMap(databaseCreds, "ssl_mode", "disable"))

	username := GetStringFromMap(accountCreds, "username", "")
	password := GetStringFromMap(accountCreds, "password", "")

	// Check for SSH tunnel config
	sshConfig := getSSHConfig(databaseCreds)
	connHost := hostname
	connPort := port
	var tunnelRelease func()

	if sshConfig != nil && sshConfig.Host != "" {
		pool := GetTunnelPool()
		if pool == nil {
			errMsg := "SSH tunnel pool not initialized"
			config.Logger.Error(errMsg)
			return &types.QueryResponse{Success: false, Error: &errMsg}, nil
		}

		localPort, release, err := pool.GetOrCreate(
			sshConfig.Host, sshConfig.Port, sshConfig.User,
			hostname, port,
		)
		if err != nil {
			errMsg := fmt.Sprintf("SSH tunnel failed: %v", err)
			config.Logger.Error("SSH tunnel creation failed",
				"error", err,
				"ssh_host", sshConfig.Host,
				"ssh_user", sshConfig.User,
				"db_host", hostname,
				"db_port", port)
			sentry.CaptureException(err)
			return &types.QueryResponse{Success: false, Error: &errMsg}, nil
		}
		tunnelRelease = release
		connHost = "127.0.0.1"
		connPort = localPort

		config.Logger.Info("Using SSH tunnel",
			"ssh_host", sshConfig.Host,
			"ssh_user", sshConfig.User,
			"local_port", localPort)
	}

	// Release tunnel after query completes
	if tunnelRelease != nil {
		defer tunnelRelease()
	}

	config.Logger.Info("Executing query",
		"database", database,
		"hostname", hostname,
		"port", port,
		"conn_host", connHost,
		"conn_port", connPort,
		"username", username)

	connStr := fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s sslmode=%s connect_timeout=10",
		connHost, connPort, database, escapeLibpqValue(username), escapeLibpqValue(password), sslMode,
	)

	db, err := GetPool().Get("postgres", connStr)
	if err != nil {
		errMsg := fmt.Sprintf("Failed to open database connection: %v", err)
		config.Logger.Error("Failed to open database connection",
			"error", err,
			"hostname", hostname,
			"database", database)
		sentry.CaptureException(err)
		return &types.QueryResponse{Success: false, Error: &errMsg}, nil
	}
	// Note: don't close db - it's managed by the pool

	if maxRows != nil && *maxRows > 0 {
		query = strings.TrimSuffix(strings.TrimSpace(query), ";")
		query = fmt.Sprintf("%s LIMIT %d", query, *maxRows)
	}

	startTime := time.Now()
	rows, err := db.QueryContext(ctx, query)
	queryDuration := time.Since(startTime)

	if err != nil {
		errMsg := fmt.Sprintf("Query execution failed: %v", err)
		config.Logger.Error("Query execution failed",
			"error", err,
			"duration_ms", queryDuration.Milliseconds(),
			"database", database)
		sentry.CaptureException(err)
		return &types.QueryResponse{Success: false, Error: &errMsg}, nil
	}
	defer rows.Close()

	columns, err := rows.ColumnTypes()
	if err != nil {
		errMsg := fmt.Sprintf("Failed to get column types: %v", err)
		config.Logger.Error("Failed to get column types", "error", err)
		sentry.CaptureException(err)
		return &types.QueryResponse{Success: false, Error: &errMsg}, nil
	}

	queryColumns := make([]types.QueryColumn, len(columns))
	for i, col := range columns {
		queryColumns[i] = types.QueryColumn{
			Name: col.Name(),
			Type: col.DatabaseTypeName(),
		}
	}

	var results []map[string]interface{}
	scanArgs := make([]interface{}, len(columns))
	scanValues := make([]interface{}, len(columns))
	for i := range scanValues {
		scanArgs[i] = &scanValues[i]
	}

	for rows.Next() {
		if err := rows.Scan(scanArgs...); err != nil {
			errMsg := fmt.Sprintf("Failed to scan row: %v", err)
			config.Logger.Error("Failed to scan row", "error", err)
			sentry.CaptureException(err)
			return &types.QueryResponse{Success: false, Error: &errMsg}, nil
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := scanValues[i]
			if b, ok := val.([]byte); ok {
				row[col.Name()] = string(b)
			} else {
				row[col.Name()] = val
			}
		}
		results = append(results, row)
	}

	if err := rows.Err(); err != nil {
		errMsg := fmt.Sprintf("Error iterating rows: %v", err)
		config.Logger.Error("Error iterating rows", "error", err)
		sentry.CaptureException(err)
		return &types.QueryResponse{Success: false, Error: &errMsg}, nil
	}

	config.Logger.Info("Query executed successfully",
		"database", database,
		"duration_ms", queryDuration.Milliseconds(),
		"row_count", len(results),
		"column_count", len(columns))

	return &types.QueryResponse{
		Success: true,
		Columns: queryColumns,
		Result:  results,
	}, nil
}

func (d *PostgresDriver) Stream(
	ctx context.Context,
	databaseCreds,
	accountCreds map[string]interface{},
	query string,
	maxRows *int,
	onColumns func([]types.QueryColumn) error,
	onRow func(map[string]interface{}) error,
) error {
	hostname := GetStringFromMap(databaseCreds, "hostname", "localhost")
	port := GetIntFromMap(databaseCreds, "port", 5432)
	database := GetStringFromMap(databaseCreds, "database", "postgres")
	sslMode := normalizeSSLMode(GetStringFromMap(databaseCreds, "ssl_mode", "disable"))

	username := GetStringFromMap(accountCreds, "username", "")
	password := GetStringFromMap(accountCreds, "password", "")

	// Check for SSH tunnel config
	sshConfig := getSSHConfig(databaseCreds)
	connHost := hostname
	connPort := port
	var tunnelRelease func()

	if sshConfig != nil && sshConfig.Host != "" {
		pool := GetTunnelPool()
		if pool == nil {
			errMsg := "SSH tunnel pool not initialized"
			config.Logger.Error(errMsg)
			return fmt.Errorf("%s", errMsg)
		}

		localPort, release, err := pool.GetOrCreate(
			sshConfig.Host, sshConfig.Port, sshConfig.User,
			hostname, port,
		)
		if err != nil {
			errMsg := fmt.Sprintf("SSH tunnel failed: %v", err)
			config.Logger.Error("SSH tunnel creation failed",
				"error", err,
				"ssh_host", sshConfig.Host,
				"ssh_user", sshConfig.User,
				"db_host", hostname,
				"db_port", port)
			sentry.CaptureException(err)
			return fmt.Errorf("%s", errMsg)
		}
		tunnelRelease = release
		connHost = "127.0.0.1"
		connPort = localPort

		config.Logger.Info("Using SSH tunnel",
			"ssh_host", sshConfig.Host,
			"ssh_user", sshConfig.User,
			"local_port", localPort)
	}

	// Release tunnel after query completes
	if tunnelRelease != nil {
		defer tunnelRelease()
	}

	config.Logger.Info("Streaming query",
		"database", database,
		"hostname", hostname,
		"port", port,
		"conn_host", connHost,
		"conn_port", connPort,
		"username", username)

	connStr := fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s sslmode=%s connect_timeout=10",
		connHost, connPort, database, escapeLibpqValue(username), escapeLibpqValue(password), sslMode,
	)

	db, err := GetPool().Get("postgres", connStr)
	if err != nil {
		config.Logger.Error("Failed to open database connection",
			"error", err,
			"hostname", hostname,
			"database", database)
		sentry.CaptureException(err)
		return fmt.Errorf("failed to open database connection: %w", err)
	}
	// Note: don't close db - it's managed by the pool

	startTime := time.Now()
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		config.Logger.Error("Query execution failed",
			"error", err,
			"database", database)
		sentry.CaptureException(err)
		return fmt.Errorf("query execution failed: %w", err)
	}
	defer rows.Close()

	columns, err := rows.ColumnTypes()
	if err != nil {
		config.Logger.Error("Failed to get column types", "error", err)
		sentry.CaptureException(err)
		return fmt.Errorf("failed to get column types: %w", err)
	}

	queryColumns := make([]types.QueryColumn, len(columns))
	for i, col := range columns {
		queryColumns[i] = types.QueryColumn{
			Name: col.Name(),
			Type: col.DatabaseTypeName(),
		}
	}

	if err := onColumns(queryColumns); err != nil {
		return err
	}

	scanArgs := make([]interface{}, len(columns))
	scanValues := make([]interface{}, len(columns))
	for i := range scanValues {
		scanArgs[i] = &scanValues[i]
	}

	rowCount := 0
	maxRowCount := 0
	if maxRows != nil {
		maxRowCount = *maxRows
	}

	for rows.Next() {
		if maxRowCount > 0 && rowCount >= maxRowCount {
			break
		}
		if err := rows.Scan(scanArgs...); err != nil {
			config.Logger.Error("Failed to scan row", "error", err)
			sentry.CaptureException(err)
			return fmt.Errorf("failed to scan row: %w", err)
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := scanValues[i]
			if b, ok := val.([]byte); ok {
				row[col.Name()] = string(b)
			} else {
				row[col.Name()] = val
			}
		}
		if err := onRow(row); err != nil {
			return err
		}
		rowCount++
	}

	if err := rows.Err(); err != nil {
		config.Logger.Error("Error iterating rows", "error", err)
		sentry.CaptureException(err)
		return fmt.Errorf("error iterating rows: %w", err)
	}

	queryDuration := time.Since(startTime)
	config.Logger.Info("Query streamed successfully",
		"database", database,
		"duration_ms", queryDuration.Milliseconds(),
		"row_count", rowCount,
		"column_count", len(columns))

	return nil
}

// SSHConfig holds SSH tunnel configuration from server credentials
type SSHConfig struct {
	Host string
	Port int
	User string
}

// getSSHConfig extracts SSH config from database credentials
func getSSHConfig(databaseCreds map[string]interface{}) *SSHConfig {
	sshRaw, ok := databaseCreds["ssh"]
	if !ok || sshRaw == nil {
		return nil
	}

	sshMap, ok := sshRaw.(map[string]interface{})
	if !ok {
		return nil
	}

	host := GetStringFromMap(sshMap, "host", "")
	if host == "" {
		return nil
	}

	return &SSHConfig{
		Host: host,
		Port: GetIntFromMap(sshMap, "port", 22),
		User: GetStringFromMap(sshMap, "user", ""),
	}
}

// normalizeSSLMode converts ssl_mode values to lib/pq supported values.
// lib/pq only supports: require, verify-full, verify-ca, disable
func normalizeSSLMode(sslMode string) string {
	switch sslMode {
	case "require", "verify-full", "verify-ca", "disable":
		return sslMode
	case "prefer", "allow":
		return "disable"
	default:
		return "disable"
	}
}
