package drivers

import (
	"context"
	"database/sql"
	"sync"
	"sync/atomic"
	"time"

	"gitlab.com/vaultsql/query_service/config"
)

// PoolConfig holds connection pool settings
type PoolConfig struct {
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// DefaultPoolConfig returns sensible defaults for connection pooling
func DefaultPoolConfig() PoolConfig {
	return PoolConfig{
		MaxOpenConns:    25,
		MaxIdleConns:    5,
		ConnMaxLifetime: 5 * time.Minute,
	}
}

// poolEntry holds a cached connection pool
type poolEntry struct {
	db        *sql.DB
	lastUsed  atomic.Int64 // Unix timestamp in seconds
}

// ConnectionPool manages cached database connections
type ConnectionPool struct {
	mu      sync.RWMutex
	pools   map[string]*poolEntry
	config  PoolConfig
	cleanup *time.Ticker
	done    chan struct{}
}

var (
	globalPool *ConnectionPool
	poolOnce   sync.Once
)

// GetPool returns the global connection pool manager
func GetPool() *ConnectionPool {
	poolOnce.Do(func() {
		globalPool = NewConnectionPool(DefaultPoolConfig())
		globalPool.StartCleanup(time.Minute)
	})
	return globalPool
}

// NewConnectionPool creates a new connection pool manager
func NewConnectionPool(cfg PoolConfig) *ConnectionPool {
	return &ConnectionPool{
		pools:  make(map[string]*poolEntry),
		config: cfg,
		done:   make(chan struct{}),
	}
}

// Get retrieves or creates a connection pool for the given connection string
func (p *ConnectionPool) Get(driverName, connStr string) (*sql.DB, error) {
	key := driverName + ":" + connStr

	// Fast path: check if pool exists
	p.mu.RLock()
	entry, ok := p.pools[key]
	if ok {
		entry.lastUsed.Store(time.Now().Unix())
		p.mu.RUnlock()

		// Health check: verify connection is still alive
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := entry.db.PingContext(ctx); err != nil {
			// Connection is dead, remove from pool and retry
			config.Logger.Warn("Stale connection detected, removing from pool",
				"key", key, "error", err)
			p.mu.Lock()
			delete(p.pools, key)
			entry.db.Close()
			p.mu.Unlock()
			return p.Get(driverName, connStr) // Retry to create new connection
		}

		return entry.db, nil
	}
	p.mu.RUnlock()

	// Slow path: create new pool
	p.mu.Lock()
	defer p.mu.Unlock()

	// Double-check after acquiring write lock
	if entry, ok := p.pools[key]; ok {
		entry.lastUsed.Store(time.Now().Unix())
		return entry.db, nil
	}

	db, err := sql.Open(driverName, connStr)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(p.config.MaxOpenConns)
	db.SetMaxIdleConns(p.config.MaxIdleConns)
	db.SetConnMaxLifetime(p.config.ConnMaxLifetime)

	newEntry := &poolEntry{
		db: db,
	}
	newEntry.lastUsed.Store(time.Now().Unix())
	p.pools[key] = newEntry

	return db, nil
}

// StartCleanup starts a background goroutine that removes stale pools
func (p *ConnectionPool) StartCleanup(interval time.Duration) {
	p.cleanup = time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-p.cleanup.C:
				p.cleanupStale()
			case <-p.done:
				return
			}
		}
	}()
}

// cleanupStale removes pools that haven't been used in 10 minutes
func (p *ConnectionPool) cleanupStale() {
	p.mu.Lock()
	defer p.mu.Unlock()

	staleThreshold := time.Now().Add(-10 * time.Minute).Unix()
	for key, entry := range p.pools {
		if entry.lastUsed.Load() < staleThreshold {
			entry.db.Close()
			delete(p.pools, key)
		}
	}
}

// Close closes all pools and stops cleanup
func (p *ConnectionPool) Close() {
	close(p.done)
	if p.cleanup != nil {
		p.cleanup.Stop()
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	for _, entry := range p.pools {
		entry.db.Close()
	}
	p.pools = make(map[string]*poolEntry)
}
