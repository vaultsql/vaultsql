package drivers

import (
	"context"
	"fmt"
	"sync"

	"gitlab.com/vaultsql/query_service/types"
)

// Driver is the interface that all database drivers must implement
type Driver interface {
	// Execute runs a query and returns the results
	Execute(ctx context.Context, databaseCreds, accountCreds map[string]interface{}, query string, maxRows *int) (*types.QueryResponse, error)

	// Stream runs a query and streams rows via callbacks.
	Stream(
		ctx context.Context,
		databaseCreds,
		accountCreds map[string]interface{},
		query string,
		maxRows *int,
		onColumns func([]types.QueryColumn) error,
		onRow func(map[string]interface{}) error,
	) error

	// Name returns the driver identifier (e.g., "postgres", "mysql")
	Name() string
}

var (
	registry = make(map[string]Driver)
	mu       sync.RWMutex
)

// Register adds a driver to the registry
func Register(d Driver) {
	mu.Lock()
	defer mu.Unlock()
	registry[d.Name()] = d
}

// Get retrieves a driver by name
func Get(name string) (Driver, error) {
	mu.RLock()
	defer mu.RUnlock()
	d, ok := registry[name]
	if !ok {
		return nil, fmt.Errorf("unsupported server type: %s", name)
	}
	return d, nil
}

// GetStringFromMap extracts a string value from a map with a default
func GetStringFromMap(m map[string]interface{}, key string, defaultVal string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return defaultVal
}

// GetIntFromMap extracts an int value from a map with a default
func GetIntFromMap(m map[string]interface{}, key string, defaultVal int) int {
	if v, ok := m[key]; ok {
		switch n := v.(type) {
		case float64:
			return int(n)
		case int:
			return n
		case int64:
			return int(n)
		}
	}
	return defaultVal
}
