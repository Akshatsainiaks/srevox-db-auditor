export interface CrashEvent {
  cluster_id:     string;
  pod_name:       string;
  namespace:      string;
  container_name: string;
  crash_reason:   string;
  restart_count:  number;
  exit_code?:     number;
  pod_labels:     Record<string, string>;
  raw_event:      unknown;
  detected_at:    string;
}

export interface ChannelConfig {
  id:     string;
  type:   "email" | "teams" | "whatsapp" | "webhook" | "slack";
  config: Record<string, string>;
  enabled?: boolean;
  channel_type?: string;
  is_global_default?: boolean;
}

export interface AlertPayload {
  event:        CrashEvent;
  incidentId:   string;
  severity:     string;
  dashboardUrl: string;
}
