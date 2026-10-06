package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/srevox/srevox/apps/db-audit-control/pkg/connectors"
)

var connectorMgr = connectors.NewManager()

type AuditEventResponse struct {
	ID              string   `json:"id"`
	TenantID        string   `json:"tenant_id"`
	Database        string   `json:"database"`
	Schema          string   `json:"schema"`
	Table           string   `json:"table"`
	Operation       string   `json:"operation"`
	PrimaryKey      string   `json:"primary_key"`
	Before          string   `json:"before"`
	After           string   `json:"after"`
	ChangedFields   []string `json:"changed_fields"`
	MaskedFields    []string `json:"masked_fields"`
	CommitTimestamp string   `json:"commit_timestamp"`
	RecordHash      string   `json:"record_hash"`
	CaptureMode     string   `json:"capture_mode"`
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}

	mux := http.NewServeMux()

	// Health Check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "srevox-db-audit-control",
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	// Audit Log List Endpoint
	mux.HandleFunc("/api/v1/audit/events", handleAuditEvents)

	// Connectors Management Endpoints
	mux.HandleFunc("/api/v1/connectors", handleConnectors)
	mux.HandleFunc("/api/v1/connectors/", handleConnectors)
	mux.HandleFunc("/api/v1/connectors/test", handleTestConnector)
	mux.HandleFunc("/api/v1/connectors/test/", handleTestConnector)

	log.Printf("🚀 Srevox Go Control Plane Service running on port %s...", port)
	if err := http.ListenAndServe(":"+port, enableCORS(mux)); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func handleConnectors(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/api/v1/connectors/test" || r.URL.Path == "/api/v1/connectors/test/" {
		handleTestConnector(w, r)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		list := connectorMgr.ListConnectors()
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":    true,
			"connectors": list,
			"count":      len(list),
		})
		return
	}

	if r.Method == http.MethodPost {
		var conn connectors.Connector
		if err := json.NewDecoder(r.Body).Decode(&conn); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := connectorMgr.AddConnector(&conn); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":   true,
			"connector": conn,
		})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func handleTestConnector(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Host   string `json:"host"`
		Port   int    `json:"port"`
		DBType string `json:"db_type"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	err := connectorMgr.TestConnection(req.Host, req.Port, req.DBType)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Target database reachable and credentials verified via Vault",
	})
}

var (
	eventsMutex sync.Mutex
	liveEvents  = []AuditEventResponse{}
)

func handleAuditEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		eventsMutex.Lock()
		defer eventsMutex.Unlock()

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"events":  liveEvents,
			"count":   len(liveEvents),
		})
		return
	}

	if r.Method == http.MethodPost {
		var newEvt AuditEventResponse
		if err := json.NewDecoder(r.Body).Decode(&newEvt); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if newEvt.ID == "" {
			newEvt.ID = fmt.Sprintf("evt_%d", time.Now().UnixNano())
		}
		if newEvt.CommitTimestamp == "" {
			newEvt.CommitTimestamp = time.Now().Format(time.RFC3339)
		}
		if newEvt.CaptureMode == "" {
			newEvt.CaptureMode = "log_based"
		}
		if newEvt.RecordHash == "" {
			newEvt.RecordHash = fmt.Sprintf("%x", sha256.Sum256([]byte(newEvt.After+newEvt.CommitTimestamp)))
		}

		eventsMutex.Lock()
		liveEvents = append([]AuditEventResponse{newEvt}, liveEvents...)
		eventsMutex.Unlock()

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"event":   newEvt,
		})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
