package drivers

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"
	mysqlDriver "github.com/go-sql-driver/mysql"
	"gitlab.com/vaultsql/query_service/config"
	"gitlab.com/vaultsql/query_service/types"
)

func init() {
	Register(&MySQLDriver{})
}

type MySQLDriver struct{}

func (d *MySQLDriver) Name() string {
	return "mysql"
}

func (d *MySQLDriver) Execute(ctx context.Context, databaseCreds, accountCreds map[string]interface{}, query string, maxRows *int) (*types.QueryResponse, error) {
	hostname := GetStringFromMap(databaseCreds, "hostname", "localhost")
	port := GetIntFromMap(databaseCreds, "port", 3306)
	database := GetStringFromMap(databaseCreds, "database", "")
	sslMode := GetStringFromMap(databaseCreds, "ssl_mode", "")

	username := GetStringFromMap(accountCreds, "username", "")
	password := GetStringFromMap(accountCreds, "password", "")

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

	connStr := buildMySQLDSN(connHost, connPort, database, username, password, sslMode)

	db, err := GetPool().Get("mysql", connStr)
	if err != nil {
		errMsg := fmt.Sprintf("Failed to open database connection: %v", err)
		config.Logger.Error("Failed to open database connection",
			"error", err,
			"hostname", hostname,
			"database", database)
		sentry.CaptureException(err)
		return &types.QueryResponse{Success: false, Error: &errMsg}, nil
	}

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

func (d *MySQLDriver) Stream(
	ctx context.Context,
	databaseCreds,
	accountCreds map[string]interface{},
	query string,
	maxRows *int,
	onColumns func([]types.QueryColumn) error,
	onRow func(map[string]interface{}) error,
) error {
	hostname := GetStringFromMap(databaseCreds, "hostname", "localhost")
	port := GetIntFromMap(databaseCreds, "port", 3306)
	database := GetStringFromMap(databaseCreds, "database", "")
	sslMode := GetStringFromMap(databaseCreds, "ssl_mode", "")

	username := GetStringFromMap(accountCreds, "username", "")
	password := GetStringFromMap(accountCreds, "password", "")

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

	connStr := buildMySQLDSN(connHost, connPort, database, username, password, sslMode)

	db, err := GetPool().Get("mysql", connStr)
	if err != nil {
		config.Logger.Error("Failed to open database connection",
			"error", err,
			"hostname", hostname,
			"database", database)
		sentry.CaptureException(err)
		return fmt.Errorf("failed to open database connection: %w", err)
	}

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

func buildMySQLDSN(host string, port int, database, username, password, sslMode string) string {
	cfg := mysqlDriver.NewConfig()
	cfg.User = username
	cfg.Passwd = password
	cfg.Net = "tcp"
	cfg.Addr = fmt.Sprintf("%s:%d", host, port)
	cfg.DBName = database
	cfg.Timeout = 10 * time.Second
	cfg.ParseTime = true

	if tlsName := normalizeMySQLTLS(sslMode); tlsName != "" {
		cfg.TLSConfig = tlsName
	}

	return cfg.FormatDSN()
}

// normalizeMySQLTLS maps ssl_mode values to go-sql-driver/mysql tls settings.
func normalizeMySQLTLS(sslMode string) string {
	switch sslMode {
	case "require":
		return "true"
	case "prefer":
		return "preferred"
	case "verify-ca", "verify-full":
		return "true"
	case "disable":
		return ""
	default:
		return ""
	}
}
