import { clsx, type ClassValue } from "clsx";
import { formatDistanceToNow, parseISO } from "date-fns";

export type Severity       = "info" | "warning" | "critical";
export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type ClusterStatus  = "pending" | "connected" | "error" | "disconnected";
export type ChannelType    = "email" | "teams" | "whatsapp" | "webhook" | "slack";

export interface Incident {
  incident_id: string; cluster_id: string; cluster_name?: string;
  pod_name: string; namespace: string; container_name?: string;
  crash_reason: string; restart_count: number; exit_code?: number;
  severity: Severity; status: IncidentStatus;
  pod_labels?: Record<string, string>;
  ai_diagnosis?: AIDiagnosis; ai_diagnosed_at?: string;
  first_seen_at: string; last_seen_at: string; resolved_at?: string;
  acknowledged_by_name?: string; resolved_by_name?: string;
}

export interface AIDiagnosis {
  root_cause: string; severity_assessment: string;
  fix_steps: string[]; kubectl_commands: string[];
  prevention: string; estimated_fix_time: string; related_docs?: string;
}

export interface Cluster {
  cluster_id: string; name: string; connection_type: string;
  cloud_provider?: string; k8s_version?: string;
  open_incidents_count?: number;
  status: ClusterStatus; last_seen_at?: string;
  error_message?: string; created_at: string;
  agent_token?: string; install_command?: string;
  node_cpu_threshold?: number;
  node_memory_threshold?: number;
  master_alerts_enabled?: boolean;
  worker_alerts_enabled?: boolean;
  master_nodes_ready?: number;
  master_nodes_total?: number;
  worker_nodes_ready?: number;
  worker_nodes_total?: number;
  metrics_configured?: boolean;
  metrics_status?: string;
  metrics_error?: string;
  skip_tls_verify?: boolean;
  kubeconfig_encrypted?: string;
  api_server_url?: string;
}

export interface Channel {
  channel_id: string; name: string; type: ChannelType;
  enabled: boolean; last_success_at?: string;
  last_error?: string; created_at: string;
  config?: any;
}

export interface AlertRule {
  rule_id: string; cluster_id: string; cluster_name?: string; name: string;
  description?: string; namespaces: string[]; crash_reasons: string[];
  min_restarts: number; cooldown_minutes: number;
  severity: Severity; channel_ids: string[];
  enabled: boolean; created_at: string;
  muted_ttl?: number | null;
  only_increase_restarts?: boolean;
}

export interface IncidentStats {
  open_count: number; acknowledged_count: number; resolved_count: number;
  critical_open: number; last_24h: number; last_7d: number;
  oom_count: number; crash_loop_count: number;
}

export function cn(...inputs: ClassValue[]) { return clsx(inputs); }

export function timeAgo(dateStr: string): string {
  try { return formatDistanceToNow(parseISO(dateStr), { addSuffix: true }); }
  catch { return dateStr; }
}

export function severityBadge(s: Severity) {
  return { critical: "badge-critical", warning: "badge-warning", info: "badge-info" }[s] || "badge bg-gray-100 text-gray-600 border-gray-200";
}

export function statusBadge(s: IncidentStatus) {
  return { open: "badge-open", acknowledged: "badge-ack", resolved: "badge-resolved" }[s] || "badge bg-gray-100 text-gray-600";
}

export function severityDot(s: Severity) {
  return { critical: "bg-red-500", warning: "bg-amber-500", info: "bg-blue-500" }[s] || "bg-gray-400";
}

export function clusterStatusColor(s: string) {
  return { connected: "text-green-600", pending: "text-amber-500", error: "text-red-600", disconnected: "text-gray-400" }[s] || "text-gray-500";
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, trying fallback", err);
    }
  }

  // Fallback
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Fallback copy to clipboard failed", err);
    return false;
  }
}


export interface DbConnector {
  connector_id: string;
  id?: string;
  name: string;
  db_type: string;
  capture_mode: string;
  host: string;
  port: number;
  database_name: string;
  username?: string;
  status: string;
  audit_scope?: string;
  target_tables?: string | null;
  enable_pii_masking?: boolean;
  last_sync_at?: string;
  created_at: string;
}
