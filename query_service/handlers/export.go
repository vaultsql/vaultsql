package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"gitlab.com/vaultsql/query_service/types"
)

type exportError struct {
	status  int
	message string
}

func (e *exportError) Error() string {
	return e.message
}

func parseExportFormat(raw string) (types.ExportFormat, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case string(types.ExportFormatCSV):
		return types.ExportFormatCSV, nil
	case string(types.ExportFormatJSON):
		return types.ExportFormatJSON, nil
	case string(types.ExportFormatSQL):
		return types.ExportFormatSQL, nil
	default:
		return "", &exportError{
			status:  http.StatusBadRequest,
			message: "format must be 'csv', 'json', or 'sql'",
		}
	}
}

type exportWriter struct {
	w              http.ResponseWriter
	format         types.ExportFormat
	requestedNames []string
	selectedNames  []string
	csvDelimiter   rune
	sqlTable       string
	csvWriter      *csv.Writer
	jsonEncoder    *json.Encoder
	flusher        http.Flusher
	wroteBody      bool
}

func newExportWriter(w http.ResponseWriter, format types.ExportFormat, requested []string, csvDelimiter rune, sqlTable string) *exportWriter {
	flusher, _ := w.(http.Flusher)
	return &exportWriter{
		w:              w,
		format:         format,
		requestedNames: requested,
		csvDelimiter:   csvDelimiter,
		sqlTable:       sqlTable,
		flusher:        flusher,
	}
}

func (e *exportWriter) OnColumns(columns []types.QueryColumn) error {
	selected, err := e.resolveColumns(columns)
	if err != nil {
		return err
	}
	e.selectedNames = selected

	switch e.format {
	case types.ExportFormatCSV:
		e.setHeaders("query.csv", "text/csv; charset=utf-8")
		e.csvWriter = csv.NewWriter(e.w)
		if e.csvDelimiter != 0 {
			e.csvWriter.Comma = e.csvDelimiter
		}
		if err := e.csvWriter.Write(e.selectedNames); err != nil {
			return fmt.Errorf("failed to write csv header: %w", err)
		}
		e.csvWriter.Flush()
		if err := e.csvWriter.Error(); err != nil {
			return fmt.Errorf("failed to flush csv header: %w", err)
		}
		e.wroteBody = true
	case types.ExportFormatJSON:
		e.setHeaders("query.ndjson", "application/x-ndjson; charset=utf-8")
		e.jsonEncoder = json.NewEncoder(e.w)
	case types.ExportFormatSQL:
		if e.sqlTable == "" {
			return &exportError{
				status:  http.StatusBadRequest,
				message: "sql_table is required for sql export",
			}
		}
		e.setHeaders("query.sql", "application/sql; charset=utf-8")
	default:
		return &exportError{
			status:  http.StatusBadRequest,
			message: "format must be 'csv', 'json', or 'sql'",
		}
	}
	return nil
}

func (e *exportWriter) OnRow(row map[string]interface{}) error {
	if len(e.selectedNames) == 0 {
		return &exportError{
			status:  http.StatusInternalServerError,
			message: "export columns not initialized",
		}
	}

	filtered := e.selectRow(row)

	switch e.format {
	case types.ExportFormatCSV:
		record := make([]string, len(e.selectedNames))
		for i, name := range e.selectedNames {
			record[i] = formatCSVValue(filtered[name])
		}
		if err := e.csvWriter.Write(record); err != nil {
			return fmt.Errorf("failed to write csv row: %w", err)
		}
		e.csvWriter.Flush()
		if err := e.csvWriter.Error(); err != nil {
			return fmt.Errorf("failed to flush csv row: %w", err)
		}
		e.wroteBody = true
	case types.ExportFormatJSON:
		if err := e.jsonEncoder.Encode(filtered); err != nil {
			return fmt.Errorf("failed to write json row: %w", err)
		}
		e.wroteBody = true
	case types.ExportFormatSQL:
		statement := e.buildInsertStatement(filtered)
		if _, err := fmt.Fprintln(e.w, statement); err != nil {
			return fmt.Errorf("failed to write sql row: %w", err)
		}
		e.wroteBody = true
	default:
		return &exportError{
			status:  http.StatusBadRequest,
			message: "format must be 'csv', 'json', or 'sql'",
		}
	}

	if e.flusher != nil {
		e.flusher.Flush()
	}
	return nil
}

func (e *exportWriter) hasWrittenBody() bool {
	return e.wroteBody
}

func (e *exportWriter) setHeaders(filename string, contentType string) {
	e.w.Header().Set("Content-Type", contentType)
	e.w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	e.w.Header().Set("Cache-Control", "no-cache")
	e.w.Header().Set("X-Accel-Buffering", "no")
}

func (e *exportWriter) resolveColumns(columns []types.QueryColumn) ([]string, error) {
	available := make(map[string]struct{}, len(columns))
	for _, col := range columns {
		available[col.Name] = struct{}{}
	}

	if len(e.requestedNames) == 0 {
		all := make([]string, 0, len(columns))
		for _, col := range columns {
			all = append(all, col.Name)
		}
		return all, nil
	}

	seen := make(map[string]struct{}, len(e.requestedNames))
	selected := make([]string, 0, len(e.requestedNames))
	for _, name := range e.requestedNames {
		if _, exists := available[name]; !exists {
			return nil, &exportError{
				status:  http.StatusBadRequest,
				message: fmt.Sprintf("unknown column requested: %s", name),
			}
		}
		if _, dup := seen[name]; dup {
			return nil, &exportError{
				status:  http.StatusBadRequest,
				message: fmt.Sprintf("duplicate column requested: %s", name),
			}
		}
		seen[name] = struct{}{}
		selected = append(selected, name)
	}

	return selected, nil
}

func (e *exportWriter) selectRow(row map[string]interface{}) map[string]interface{} {
	selected := make(map[string]interface{}, len(e.selectedNames))
	for _, name := range e.selectedNames {
		if value, ok := row[name]; ok {
			selected[name] = value
		} else {
			selected[name] = nil
		}
	}
	return selected
}

func formatCSVValue(value interface{}) string {
	switch v := value.(type) {
	case nil:
		return ""
	case time.Time:
		return v.Format(time.RFC3339Nano)
	case []byte:
		return string(v)
	default:
		return fmt.Sprint(v)
	}
}

func (e *exportWriter) buildInsertStatement(row map[string]interface{}) string {
	columns := make([]string, len(e.selectedNames))
	values := make([]string, len(e.selectedNames))
	for i, name := range e.selectedNames {
		columns[i] = quoteSQLIdentifier(name)
		values[i] = formatSQLValue(row[name])
	}

	return fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES (%s);",
		quoteSQLTable(e.sqlTable),
		strings.Join(columns, ", "),
		strings.Join(values, ", "),
	)
}

func quoteSQLTable(table string) string {
	parts := strings.Split(table, ".")
	for i, part := range parts {
		parts[i] = quoteSQLIdentifier(part)
	}
	return strings.Join(parts, ".")
}

func quoteSQLIdentifier(name string) string {
	escaped := strings.ReplaceAll(name, `"`, `""`)
	return `"` + escaped + `"`
}

func formatSQLValue(value interface{}) string {
	switch v := value.(type) {
	case nil:
		return "NULL"
	case bool:
		if v {
			return "TRUE"
		}
		return "FALSE"
	case int:
		return fmt.Sprint(v)
	case int8:
		return fmt.Sprint(v)
	case int16:
		return fmt.Sprint(v)
	case int32:
		return fmt.Sprint(v)
	case int64:
		return fmt.Sprint(v)
	case uint:
		return fmt.Sprint(v)
	case uint8:
		return fmt.Sprint(v)
	case uint16:
		return fmt.Sprint(v)
	case uint32:
		return fmt.Sprint(v)
	case uint64:
		return fmt.Sprint(v)
	case float32:
		return fmt.Sprint(v)
	case float64:
		return fmt.Sprint(v)
	case time.Time:
		return quoteSQLString(v.Format(time.RFC3339Nano))
	case []byte:
		return quoteSQLString(string(v))
	case map[string]interface{}, []interface{}:
		raw, err := json.Marshal(v)
		if err != nil {
			return quoteSQLString(fmt.Sprint(v))
		}
		return quoteSQLString(string(raw))
	default:
		return quoteSQLString(fmt.Sprint(v))
	}
}

func quoteSQLString(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}
