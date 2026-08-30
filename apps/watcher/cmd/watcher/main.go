// Srevox K8s Watcher — Go
// Uses K8s Watch API (single persistent connection per cluster).
package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/srevox/watcher/internal/k8s"
	"github.com/srevox/watcher/internal/publisher"
)

func getInClusterConfig() (string, string, string) {
	host := os.Getenv("KUBERNETES_SERVICE_HOST")
	port := os.Getenv("KUBERNETES_SERVICE_PORT")
	var apiServerURL string
	if host != "" && port != "" {
		apiServerURL = "https://" + host + ":" + port
	}

	var token string
	if data, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/token"); err == nil {
		token = string(bytes.TrimSpace(data))
	}

	var caCert string
	if data, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"); err == nil {
		caCert = base64.StdEncoding.EncodeToString(data)
	}

	return apiServerURL, token, caCert
}

func sendHeartbeat(apiURL, clusterID string) {
	if apiURL == "" {
		return
	}
	agentToken := getEnv("AGENT_TOKEN", "")
	apiServerURL, token, caCert := getInClusterConfig()

	payload := map[string]string{
		"status":      "connected",
		"agent_token": agentToken,
	}
	if apiServerURL != "" {
		payload["api_server_url"] = apiServerURL
	}
	if token != "" {
		payload["token"] = token
	}
	if caCert != "" {
		payload["ca_cert"] = caCert
	}

	body, _ := json.Marshal(payload)
	url := apiURL + "/api/clusters/" + clusterID + "/heartbeat"
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		log.Printf("Heartbeat failed: %v", err)
		return
	}
	defer resp.Body.Close()
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("🔭 Srevox Watcher starting...")

	redisURL   := getEnv("REDIS_URL",    "redis://localhost:6379")
	clusterID  := getEnv("CLUSTER_ID",  "bf151459-9dd0-4298-a70c-bad244c7efcb")
	clusterName:= getEnv("CLUSTER_NAME","TEST")
	kubeconfig := getEnv("KUBECONFIG",  defaultKubeconfig())

	log.Printf("Redis: %s", redisURL)
	log.Printf("Cluster ID: %s", clusterID)
	log.Printf("Kubeconfig: %s", kubeconfig)

	pub, err := publisher.NewRedisPublisher(redisURL)
	if err != nil {
		log.Fatalf("Redis connection failed: %v", err)
	}
	defer pub.Close()
	log.Println("✅ Redis connected")

	watcher, err := k8s.NewWatcher(k8s.Config{
		KubeconfigPath:  kubeconfig,
		ClusterID:       clusterID,
		ClusterName:     clusterName,
		WatchNamespaces: getEnv("WATCH_NAMESPACES", ""),
		Publisher:       pub,
		RedisChannel:    "srevox:crashes",
	})
	if err != nil {
		log.Fatalf("K8s watcher init failed: %v", err)
	}
	log.Println("✅ K8s connected")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sig
		log.Println("Shutdown signal received")
		cancel()
	}()

	apiURL := getEnv("API_URL", "http://srevox-api:4000")
	go func() {
		for {
			sendHeartbeat(apiURL, clusterID)
			time.Sleep(30 * time.Second)
		}
	}()
	log.Printf("👀 Watching cluster: %s (%s)", clusterName, clusterID)
	if err := watcher.Run(ctx); err != nil && err != context.Canceled {
		log.Fatalf("Watcher error: %v", err)
	}
	log.Println("Watcher stopped cleanly")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func defaultKubeconfig() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	path := home + "/.kube/config"
	if _, err := os.Stat(path); err == nil {
		return path
	}
	return ""
}