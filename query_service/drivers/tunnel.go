package drivers

import (
	"fmt"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/getsentry/sentry-go"
	"gitlab.com/vaultsql/query_service/config"
	"golang.org/x/crypto/ssh"
)

// tunnelEntry holds an active SSH tunnel
type tunnelEntry struct {
	client    *ssh.Client
	listener  net.Listener
	localPort int
	createdAt time.Time
	refs      int32 // atomic reference count
	done      chan struct{}
}

// TunnelPool manages reusable SSH tunnels keyed by their connection parameters
type TunnelPool struct {
	mu      sync.RWMutex
	tunnels map[string]*tunnelEntry
	sshKey  ssh.Signer
	ttl     time.Duration
	cleanup *time.Ticker
	done    chan struct{}
}

var (
	globalTunnelPool *TunnelPool
	tunnelPoolOnce   sync.Once
)

// InitTunnelPool initializes the global tunnel pool with the given SSH private key
func InitTunnelPool(privateKey string) error {
	var initErr error
	tunnelPoolOnce.Do(func() {
		if privateKey == "" {
			globalTunnelPool = &TunnelPool{
				tunnels: make(map[string]*tunnelEntry),
				ttl:     time.Hour,
				done:    make(chan struct{}),
			}
			return
		}

		// Normalize the key (handle escaped newlines from env vars)
		privateKey = strings.ReplaceAll(privateKey, "\\n", "\n")

		signer, err := ssh.ParsePrivateKey([]byte(privateKey))
		if err != nil {
			initErr = fmt.Errorf("failed to parse SSH private key: %w", err)
			return
		}

		globalTunnelPool = &TunnelPool{
			tunnels: make(map[string]*tunnelEntry),
			sshKey:  signer,
			ttl:     time.Hour,
			done:    make(chan struct{}),
		}
		globalTunnelPool.startCleanup(time.Minute)
	})
	return initErr
}

// GetTunnelPool returns the global tunnel pool
func GetTunnelPool() *TunnelPool {
	return globalTunnelPool
}

// IsHealthy checks if the tunnel pool is healthy (not closed)
func (p *TunnelPool) IsHealthy() bool {
	if p == nil {
		return true // Not configured is fine
	}
	select {
	case <-p.done:
		return false // Pool is closed
	default:
		return true // Pool is healthy
	}
}

// tunnelKey generates a unique key for a tunnel
func tunnelKey(sshHost string, sshPort int, sshUser string, dbHost string, dbPort int) string {
	return fmt.Sprintf("%s:%d:%s->%s:%d", sshHost, sshPort, sshUser, dbHost, dbPort)
}

// GetOrCreate returns an existing tunnel or creates a new one.
// The returned release function must be called when done using the tunnel.
func (p *TunnelPool) GetOrCreate(sshHost string, sshPort int, sshUser string, dbHost string, dbPort int) (localPort int, release func(), err error) {
	if p.sshKey == nil {
		return 0, nil, fmt.Errorf("SSH private key not configured")
	}

	key := tunnelKey(sshHost, sshPort, sshUser, dbHost, dbPort)

	// Fast path: check for existing tunnel
	p.mu.RLock()
	entry, ok := p.tunnels[key]
	if ok && time.Since(entry.createdAt) < p.ttl {
		atomic.AddInt32(&entry.refs, 1)
		p.mu.RUnlock()
		return entry.localPort, func() { atomic.AddInt32(&entry.refs, -1) }, nil
	}
	p.mu.RUnlock()

	// Slow path: create new tunnel
	p.mu.Lock()
	defer p.mu.Unlock()

	// Double-check after acquiring write lock
	entry, ok = p.tunnels[key]
	if ok && time.Since(entry.createdAt) < p.ttl {
		atomic.AddInt32(&entry.refs, 1)
		return entry.localPort, func() { atomic.AddInt32(&entry.refs, -1) }, nil
	}

	// Close old tunnel if it exists but is expired
	if ok {
		p.closeTunnelLocked(key, entry)
	}

	// Create new tunnel
	entry, err = p.createTunnel(sshHost, sshPort, sshUser, dbHost, dbPort)
	if err != nil {
		return 0, nil, err
	}

	atomic.AddInt32(&entry.refs, 1)
	p.tunnels[key] = entry

	return entry.localPort, func() { atomic.AddInt32(&entry.refs, -1) }, nil
}

// createTunnel establishes a new SSH tunnel
func (p *TunnelPool) createTunnel(sshHost string, sshPort int, sshUser string, dbHost string, dbPort int) (*tunnelEntry, error) {
	sshConfig := &ssh.ClientConfig{
		User: sshUser,
		Auth: []ssh.AuthMethod{
			ssh.PublicKeys(p.sshKey),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // For simplicity; could be made configurable
		Timeout:         10 * time.Second,
	}

	sshAddr := fmt.Sprintf("%s:%d", sshHost, sshPort)
	client, err := ssh.Dial("tcp", sshAddr, sshConfig)
	if err != nil {
		return nil, fmt.Errorf("SSH connection failed to %s: %w", sshAddr, err)
	}

	// Create local listener on random port
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		client.Close()
		return nil, fmt.Errorf("failed to create local listener: %w", err)
	}

	localPort := listener.Addr().(*net.TCPAddr).Port
	remoteAddr := fmt.Sprintf("%s:%d", dbHost, dbPort)

	entry := &tunnelEntry{
		client:    client,
		listener:  listener,
		localPort: localPort,
		createdAt: time.Now(),
		done:      make(chan struct{}),
	}

	// Start forwarding goroutine
	go p.forwardConnections(entry, remoteAddr)

	return entry, nil
}

// forwardConnections accepts connections on the local listener and forwards them through the SSH tunnel
func (p *TunnelPool) forwardConnections(entry *tunnelEntry, remoteAddr string) {
	for {
		localConn, err := entry.listener.Accept()
		if err != nil {
			select {
			case <-entry.done:
				config.Logger.Info("SSH tunnel shutting down gracefully")
				return // Tunnel closed
			default:
				config.Logger.Error("SSH tunnel accept failed",
					"error", err,
					"remote_addr", remoteAddr)
				continue
			}
		}

		go func(local net.Conn) {
			defer local.Close()

			remote, err := entry.client.Dial("tcp", remoteAddr)
			if err != nil {
				config.Logger.Error("SSH tunnel forward failed",
					"remote_addr", remoteAddr,
					"local_addr", local.RemoteAddr().String(),
					"error", err)
				sentry.CaptureException(err)
				return
			}
			defer remote.Close()

			// Bidirectional copy
			done := make(chan struct{}, 2)
			go func() {
				copyData(local, remote)
				done <- struct{}{}
			}()
			go func() {
				copyData(remote, local)
				done <- struct{}{}
			}()

			// Wait for one direction to finish
			<-done
		}(localConn)
	}
}

// copyData copies data between connections
func copyData(dst, src net.Conn) {
	buf := make([]byte, 32*1024)
	for {
		n, err := src.Read(buf)
		if n > 0 {
			if _, writeErr := dst.Write(buf[:n]); writeErr != nil {
				return
			}
		}
		if err != nil {
			return
		}
	}
}

// startCleanup starts the background cleanup goroutine
func (p *TunnelPool) startCleanup(interval time.Duration) {
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

// cleanupStale removes tunnels that have expired and have no active references
func (p *TunnelPool) cleanupStale() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for key, entry := range p.tunnels {
		if time.Since(entry.createdAt) >= p.ttl && atomic.LoadInt32(&entry.refs) == 0 {
			p.closeTunnelLocked(key, entry)
		}
	}
}

// closeTunnelLocked closes a tunnel (must hold write lock)
func (p *TunnelPool) closeTunnelLocked(key string, entry *tunnelEntry) {
	close(entry.done)
	entry.listener.Close()
	entry.client.Close()
	delete(p.tunnels, key)
}

// Close shuts down all tunnels and stops cleanup
func (p *TunnelPool) Close() {
	close(p.done)
	if p.cleanup != nil {
		p.cleanup.Stop()
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	for key, entry := range p.tunnels {
		p.closeTunnelLocked(key, entry)
	}
}
