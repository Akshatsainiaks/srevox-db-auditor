// internal/k8s/watcher.go — K8s Watch API stream
package k8s

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/srevox/watcher/internal/publisher"
)

// CrashEvent is published to Redis
type CrashEvent struct {
	ClusterID     string            `json:"cluster_id"`
	ClusterName   string            `json:"cluster_name"`
	PodName       string            `json:"pod_name"`
	Namespace     string            `json:"namespace"`
	ContainerName string            `json:"container_name"`
	CrashReason   string            `json:"crash_reason"`
	RestartCount  int32             `json:"restart_count"`
	ExitCode      int32             `json:"exit_code"`
	PodLabels     map[string]string `json:"pod_labels"`
	RawEvent      interface{}       `json:"raw_event"`
	DetectedAt    time.Time         `json:"detected_at"`
}

// Config for the watcher
type Config struct {
	KubeconfigPath  string
	ClusterID       string
	ClusterName     string
	WatchNamespaces string
	Publisher       publisher.Publisher
	RedisChannel    string
}

// Watcher holds the K8s client and config
type Watcher struct {
	client *kubernetes.Clientset
	config Config
}

// NewWatcher creates a K8s client from kubeconfig or in-cluster config
func NewWatcher(cfg Config) (*Watcher, error) {
	var restCfg *rest.Config
	var err error

	if cfg.KubeconfigPath != "" {
		restCfg, err = clientcmd.BuildConfigFromFlags("", cfg.KubeconfigPath)
	} else {
		restCfg, err = rest.InClusterConfig()
	}
	if err != nil {
		return nil, err
	}

	restCfg.QPS   = 5
	restCfg.Burst = 10

	client, err := kubernetes.NewForConfig(restCfg)
	if err != nil {
		return nil, err
	}

	return &Watcher{client: client, config: cfg}, nil
}

// Run starts the watch loop for all configured namespaces
func (w *Watcher) Run(ctx context.Context) error {
	namespaces := []string{""}
	if w.config.WatchNamespaces != "" {
		namespaces = strings.Split(w.config.WatchNamespaces, ",")
	}

	errCh := make(chan error, len(namespaces))
	for _, ns := range namespaces {
		go func(namespace string) {
			errCh <- w.watchNamespace(ctx, strings.TrimSpace(namespace))
		}(ns)
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errCh:
		return err
	}
}

// watchNamespace watches one namespace with exponential backoff reconnect
func (w *Watcher) watchNamespace(ctx context.Context, namespace string) error {
	backoff := time.Second
	for {
		if err := w.streamPodEvents(ctx, namespace); err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			log.Printf("[watcher] stream error (ns=%q): %v — reconnecting in %v", namespace, err, backoff)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
				if backoff < 60*time.Second {
					backoff *= 2
				}
			}
		} else {
			backoff = time.Second
		}
	}
}

// streamPodEvents opens one Watch API connection and processes events
func (w *Watcher) streamPodEvents(ctx context.Context, namespace string) error {
	watcher, err := w.client.CoreV1().Pods(namespace).Watch(ctx, metav1.ListOptions{
		TimeoutSeconds: int64Ptr(300),
	})
	if err != nil {
		return err
	}
	defer watcher.Stop()

	nsLabel := namespace
	if nsLabel == "" {
		nsLabel = "all"
	}
	log.Printf("[watcher] 👀 watching pods namespace=%s cluster=%s", nsLabel, w.config.ClusterID)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event, ok := <-watcher.ResultChan():
			if !ok {
				return nil
			}
			if event.Type == watch.Modified || event.Type == watch.Added {
				w.handlePodEvent(event)
			}
		}
	}
}

// handlePodEvent inspects a pod event and publishes crash events
func (w *Watcher) handlePodEvent(event watch.Event) {
	pod, ok := event.Object.(*corev1.Pod)
	if !ok {
		return
	}

	for _, cs := range pod.Status.ContainerStatuses {
		reason, exitCode := extractCrashInfo(cs)
		if reason == "" || !watchedReasons[reason] {
			continue
		}

		crashEvent := CrashEvent{
			ClusterID:     w.config.ClusterID,
			ClusterName:   w.config.ClusterName,
			PodName:       pod.Name,
			Namespace:     pod.Namespace,
			ContainerName: cs.Name,
			CrashReason:   reason,
			RestartCount:  cs.RestartCount,
			ExitCode:      exitCode,
			PodLabels:     pod.Labels,
			DetectedAt:    time.Now().UTC(),
		}

		payload, err := json.Marshal(crashEvent)
		if err != nil {
			log.Printf("[watcher] marshal error: %v", err)
			continue
		}

		ch := w.config.RedisChannel
		if ch == "" {
			ch = "srevox:crashes"
		}

		if err := w.config.Publisher.Publish(context.Background(), ch, string(payload)); err != nil {
			log.Printf("[watcher] publish error: %v", err)
		} else {
			log.Printf("[watcher] 🔴 crash: pod=%s ns=%s reason=%s restarts=%d",
				pod.Name, pod.Namespace, reason, cs.RestartCount)
		}
	}
}

func extractCrashInfo(cs corev1.ContainerStatus) (string, int32) {
	if cs.State.Waiting != nil {
		return cs.State.Waiting.Reason, 0
	}
	if cs.State.Terminated != nil && cs.State.Terminated.Reason != "" {
		return cs.State.Terminated.Reason, cs.State.Terminated.ExitCode
	}
	if cs.LastTerminationState.Terminated != nil {
		return cs.LastTerminationState.Terminated.Reason, cs.LastTerminationState.Terminated.ExitCode
	}
	return "", 0
}

func int64Ptr(i int64) *int64 { return &i }




