package connectors

import (
	"fmt"
	"sync"
	"time"
)

type Connector struct {
	ID              string    `json:"id"`
	TenantID        string    `json:"tenant_id"`
	ProjectID       string    `json:"project_id"`
	Name            string    `json:"name"`
	DBType          string    `json:"db_type"` // postgresql, mysql, mssql, mongodb
	CaptureMode     string    `json:"capture_mode"` // log_based | polling
	Host            string    `json:"host"`
	Port            int       `json:"port"`
	DatabaseName    string    `json:"database_name"`
	Status          string    `json:"status"` // active, testing, paused, error
	VaultSecretPath string    `json:"vault_secret_path"`
	CreatedAt       time.Time `json:"created_at"`
}

type Manager struct {
	mu         sync.RWMutex
	connectors map[string]*Connector
}

func NewManager() *Manager {
	return &Manager{
		connectors: make(map[string]*Connector),
	}
}

func (m *Manager) ListConnectors() []*Connector {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*Connector, 0, len(m.connectors))
	for _, c := range m.connectors {
		result = append(result, c)
	}
	return result
}

func (m *Manager) AddConnector(c *Connector) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if c.ID == "" {
		c.ID = fmt.Sprintf("conn_%d", time.Now().UnixNano())
	}
	c.CreatedAt = time.Now()
	c.Status = "active"
	c.VaultSecretPath = fmt.Sprintf("secret/data/audit/connectors/%s", c.ID)

	m.connectors[c.ID] = c
	return nil
}

func (m *Manager) DeleteConnector(id string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.connectors[id]; exists {
		delete(m.connectors, id)
		return true
	}
	return false
}

func (m *Manager) TestConnection(host string, port int, dbType string) error {
	// Connection testing logic simulation
	if host == "" || port <= 0 {
		return fmt.Errorf("invalid host or port configuration")
	}
	return nil
}
