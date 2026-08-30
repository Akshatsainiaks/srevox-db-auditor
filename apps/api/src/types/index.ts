export const DEFAULT_ORG = "orgjncj44t4hb4";

export type Severity = "info" | "warning" | "critical";
export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type ClusterStatus = "pending" | "connected" | "error" | "disconnected";
export type ChannelType = "email" | "teams" | "whatsapp" | "webhook" | "slack";

export const CRASH_REASONS = [
  "CrashLoopBackOff",
  "OOMKilled",
  "Error",
  "BackOff",
  "ImagePullBackOff",
  "ErrImagePull",
  "CreateContainerError",
  "RunContainerError",
];
