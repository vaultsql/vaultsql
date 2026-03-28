package types

// QueryRequest is the request body for /api/account/{account_id}/run
type QueryRequest struct {
	Query       string                 `json:"query"`
	DatabaseKey map[string]interface{} `json:"database_key,omitempty"`
	AccountKey  map[string]interface{} `json:"account_key,omitempty"`
	Timeout     *int                   `json:"timeout,omitempty"`
	MaxRows     *int                   `json:"max_rows,omitempty"`
}

type ExportFormat string

const (
	ExportFormatCSV  ExportFormat = "csv"
	ExportFormatJSON ExportFormat = "json"
	ExportFormatSQL  ExportFormat = "sql"
)

// ExportRequest extends QueryRequest with export options for /run.
type ExportRequest struct {
	QueryRequest
	Format       *string  `json:"format,omitempty"`
	Columns      []string `json:"columns,omitempty"`
	CsvDelimiter *string  `json:"csv_delimiter,omitempty"`
	SQLTable     *string  `json:"sql_table,omitempty"`
}

// CheckResponse is the response from the Python API /check endpoint
type CheckResponse struct {
	DatabaseCredentials map[string]interface{} `json:"database_credentials"`
	AccountCredentials  map[string]interface{} `json:"account_credentials"`
	DatabaseType        string                 `json:"database_type"`
}

// QueryColumn describes a column in the query result
type QueryColumn struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// QueryResponse is the response body for /api/account/{account_id}/run
type QueryResponse struct {
	Success bool                     `json:"success"`
	Error   *string                  `json:"error,omitempty"`
	Columns []QueryColumn            `json:"columns,omitempty"`
	Result  []map[string]interface{} `json:"result,omitempty"`
}

// StreamEvent represents a single NDJSON event in a streaming query response.
type StreamEvent struct {
	Type      string                 `json:"type"`
	Columns   []QueryColumn          `json:"columns,omitempty"`
	Row       map[string]interface{} `json:"row,omitempty"`
	Error     string                 `json:"error,omitempty"`
	RowCount  *int                   `json:"row_count,omitempty"`
	Truncated *bool                  `json:"truncated,omitempty"`
}

// ErrorResponse is a generic error response
type ErrorResponse struct {
	Detail string `json:"detail"`
}

// AuditLogRequest is the request body for /api/account/{account_id}/log
type AuditLogRequest struct {
	Query             string  `json:"query"`
	QueryActorType    string  `json:"query_actor_type"` // "application", "user", "custom"
	Database          *string `json:"database,omitempty"`
	ConnectivityError *bool   `json:"connectivity_error,omitempty"` // True if connection failed, False if succeeded
	ErrorMessage      *string `json:"error_message,omitempty"`      // Error message if connectivity_error=true
}

// AuditLogResponse is the response from the /log endpoint
type AuditLogResponse struct {
	Success bool `json:"success"`
}

// TestConnectionRequest is the request body for /api/test-connection
type TestConnectionRequest struct {
	DatabaseType        string                 `json:"database_type"`
	DatabaseCredentials map[string]interface{} `json:"database_credentials"`
	AccountCredentials  map[string]interface{} `json:"account_credentials"`
}

// TestConnectionResponse is the response from /api/test-connection
type TestConnectionResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}
