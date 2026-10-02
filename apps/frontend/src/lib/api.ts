import axios from "axios";
import {
  handleMockRequest,
  initializeMockData
} from "./mockData";

const BASE = "";

if (typeof window !== "undefined") {
  localStorage.removeItem("sv_backend_offline");
}

export const api = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (cfg) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("sv_token");
    if (token) cfg.headers.Authorization = `Bearer ${token}`;

    const isAutopilot = localStorage.getItem("sv_autopilot_tour_active") === "true";
    const isAutoTour = localStorage.getItem("sv_auto_tour_active") === "true";
    
    if (isAutopilot || isAutoTour) {
      // Make sure mock data is initialized in localStorage
      initializeMockData();

      const response = await handleMockRequest(cfg);
      if (response) {
        throw {
          __isMockResponse: true,
          mockResponse: response
        };
      }
    }
  }
  return cfg;
});

api.interceptors.response.use(
  (r) => {
    return r;
  },
  async (err) => {
    if (err && err.__isMockResponse) {
      return Promise.resolve(err.mockResponse);
    }

    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("sv_token");
      localStorage.removeItem("lz_user");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const apiLogin  = (email: string, password: string) => {
  const params: Record<string, string> = { username: email, password };
  return api.post("/api/auth/login",
    new URLSearchParams(params),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  ).then(r => r.data);
};
export const apiLogout  = () => api.post("/api/auth/logout").then(r => r.data);
export const apiGetMe   = () => api.get("/api/auth/account").then(r => r.data);
export const apiUpdateMe = (data: object) => api.patch("/api/auth/account", data).then(r => r.data);
export const apiGetOrganizations = () => api.get("/api/auth/organizations").then(r => r.data);
export const apiSwitchOrganization = (orgId: string) => api.post("/api/auth/switch-organization", { org_id: orgId }).then(r => r.data);
export const apiCreateOrganization = (name: string) => api.post("/api/auth/create-organization", { name }).then(r => r.data);

// ── Incidents ─────────────────────────────────────────────────────────────────
export const fetchIncidents      = (params?: Record<string, string>) =>
  api.get("/api/incidents", { params }).then(r => r.data);
export const fetchIncident       = (id: string) =>
  api.get(`/api/incidents/${id}`).then(r => r.data);
export const fetchIncidentLogs   = (id: string) =>
  api.get(`/api/incidents/${id}/logs`).then(r => r.data);
export const fetchIncidentStats  = (params?: Record<string, string>) =>
  api.get("/api/incidents/stats/summary", { params }).then(r => r.data);
export const fetchTrends         = () =>
  api.get("/api/incidents/trends/daily").then(r => r.data);
export const acknowledgeIncident = (id: string) =>
  api.patch(`/api/incidents/${id}/acknowledge`).then(r => r.data);
export const resolveIncident     = (id: string) =>
  api.patch(`/api/incidents/${id}/resolve`).then(r => r.data);
export const diagnoseIncident    = (id: string) =>
  api.post(`/api/incidents/${id}/diagnose`).then(r => r.data);
export const deleteIncident      = (id: string) =>
  api.delete(`/api/incidents/${id}`).then(r => r.data);
export const bulkAcknowledgeIncidents = (ids: string[]) =>
  api.post("/api/incidents/bulk-acknowledge", { ids }).then(r => r.data);
export const bulkResolveIncidents = (ids: string[]) =>
  api.post("/api/incidents/bulk-resolve", { ids }).then(r => r.data);
export const bulkDeleteIncidents = (ids: string[]) =>
  api.post("/api/incidents/bulk-delete", { ids }).then(r => r.data);

// ── Clusters ──────────────────────────────────────────────────────────────────
export const fetchClusters  = () => api.get("/api/clusters").then(r => r.data);
export const fetchCluster   = (id: string) => api.get(`/api/clusters/${id}`).then(r => r.data);
export const createCluster  = (data: object) => api.post("/api/clusters", data).then(r => r.data);
export const updateCluster  = (id: string, data: object) => api.patch(`/api/clusters/${id}`, data).then(r => r.data);
export const deleteCluster  = (id: string) => api.delete(`/api/clusters/${id}`).then(r => r.data);
export const regenerateAgentToken = (id: string) => api.post(`/api/clusters/${id}/regenerate-agent-token`).then(r => r.data);
export const regenerateClusterId  = (id: string) => api.post(`/api/clusters/${id}/regenerate-cluster-id`).then(r => r.data);

// ── Channels ──────────────────────────────────────────────────────────────────
export const fetchChannels  = () => api.get("/api/channels").then(r => r.data);
export const fetchChannel   = (id: string) => api.get(`/api/channels/${id}`).then(r => r.data);
export const createChannel  = (data: object) => api.post("/api/channels", data).then(r => r.data);
export const toggleChannel  = (id: string) => api.patch(`/api/channels/${id}/toggle`).then(r => r.data);
export const testChannel    = (id: string, body?: any) => api.post(`/api/channels/${id}/test`, body).then(r => r.data);
export const updateChannel  = (id: string, data: object) => api.patch(`/api/channels/${id}`, data).then(r => r.data);
export const deleteChannel  = (id: string) => api.delete(`/api/channels/${id}`).then(r => r.data);

// ── Alert Rules ───────────────────────────────────────────────────────────────
export const fetchRules  = () => api.get("/api/alert-rules").then(r => r.data);
export const fetchRule   = (id: string) => api.get(`/api/alert-rules/${id}`).then(r => r.data);
export const createRule  = (data: object) => api.post("/api/alert-rules", data).then(r => r.data);
export const updateRule  = (id: string, data: object) => api.patch(`/api/alert-rules/${id}`, data).then(r => r.data);
export const toggleRule  = (id: string) => api.patch(`/api/alert-rules/${id}/toggle`).then(r => r.data);
export const deleteRule  = (id: string) => api.delete(`/api/alert-rules/${id}`).then(r => r.data);
export const muteRule    = (id: string, minutes: number) => api.post(`/api/alert-rules/${id}/mute`, { minutes }).then(r => r.data);
export const unmuteRule  = (id: string) => api.post(`/api/alert-rules/${id}/unmute`).then(r => r.data);

// ── Users / Team ──────────────────────────────────────────────────────────────
export const fetchUsers        = () => api.get("/api/users").then(r => r.data);
export const fetchUser         = (id: string) => api.get("/api/users").then(r => {
  const found = (r.data.users || []).find((u: any) => u.user_id === id);
  if (!found) throw new Error("User not found");
  return found;
});
export const inviteUser        = (data: { email: string; role: string }) =>
  api.post("/api/users/invite", data).then(r => r.data);
export const changeUserRole    = (id: string, role: string) =>
  api.patch(`/api/users/${id}/role`, { role }).then(r => r.data);
export const removeUser        = (id: string) =>
  api.delete(`/api/users/${id}`).then(r => r.data);
export const fetchInvitations  = () =>
  api.get("/api/users/invitations").then(r => r.data);
export const cancelInvitation  = (id: string) =>
  api.delete(`/api/users/invitations/${id}`).then(r => r.data);
export const acceptInvite      = (data: { token: string; password: string; full_name?: string }) =>
  api.post("/api/users/accept-invite", data).then(r => r.data);

// ── Service Owners ────────────────────────────────────────────────────────────
export const fetchServiceOwners  = () => api.get("/api/service-owners").then(r => r.data);
export const fetchServiceOwner   = (id: string) => api.get(`/api/service-owners/${id}`).then(r => r.data);
export const createServiceOwner  = (data: object) => api.post("/api/service-owners", data).then(r => r.data);
export const updateServiceOwner  = (id: string, data: object) => api.patch(`/api/service-owners/${id}`, data).then(r => r.data);
export const deleteServiceOwner  = (id: string) => api.delete(`/api/service-owners/${id}`).then(r => r.data);
export const resolveServiceOwner = (params: { cluster_id: string; namespace: string; pod_name: string }) =>
  api.get("/api/service-owners/resolve", { params }).then(r => r.data);

export const updateMetricsConnection = (id: string, data: object) => api.post(`/api/clusters/${id}/metrics-connection`, data).then(r => r.data);

// ── Machines Monitoring ────────────────────────────────────────────────────────
export const fetchMachines = () => api.get("/api/machines").then(r => r.data);
export const fetchMachine = (id: string) => api.get(`/api/machines/${id}`).then(r => r.data);
export const createMachine = (data: object) => api.post("/api/machines", data).then(r => r.data);
export const updateMachine = (id: string, data: object) => api.put(`/api/machines/${id}`, data).then(r => r.data);
export const regenerateMachineToken = (id: string) => api.post(`/api/machines/${id}/regenerate-token`).then(r => r.data);
export const deleteMachine = (id: string) => api.delete(`/api/machines/${id}`).then(r => r.data);
export const fetchMachineTelemetry = (id: string, range = "1h") => api.get(`/api/machines/${id}/telemetry?range=${range}`).then(r => r.data);
export const fetchMachineAlertRules = () => api.get("/api/machines/alerts/rules").then(r => r.data);
export const createMachineAlertRule = (data: object) => api.post("/api/machines/alerts/rules", data).then(r => r.data);
export const toggleMachineAlertRule = (id: string, enabled: boolean) => api.patch(`/api/machines/alerts/rules/${id}`, { enabled }).then(r => r.data);
export const deleteMachineAlertRule = (id: string) => api.delete(`/api/machines/alerts/rules/${id}`).then(r => r.data);
export const testMachineAlert = (data: object) => api.post("/api/machines/alerts/test", data).then(r => r.data);

export const refreshMetrics = (id: string) => api.post(`/api/clusters/${id}/refresh-metrics`).then(r => r.data);
export const fetchLatestVersion = () => api.get("/api/latest-version").then(r => r.data);
export const verifySudoPassword = (password: string) => api.post("/api/auth/verify-sudo-password", { password }).then(r => r.data);
export const updateSudoPassword = (data: { current_password: string; new_password: string }) => api.post("/api/auth/update-sudo-password", data).then(r => r.data);
export const resetSudoPassword = () => api.post("/api/auth/reset-sudo-password").then(r => r.data);

// ── Retention Policy ─────────────────────────────────────────────────────────
export const fetchRetentionPolicy = () => api.get("/api/preferences/retention").then(r => r.data);
export const saveRetentionPolicy = (data: { activity_days: number; incident_days: number; purge_interval_hours: number }) =>
  api.put("/api/preferences/retention", data).then(r => r.data);
export const clearRetentionHistory = (type?: string) => api.delete("/api/retention/runs", { params: { type } }).then(r => r.data);

export const fetchLogsRetentionPolicy = () => api.get("/api/retention/audit-logs").then(r => r.data);
export const saveLogsRetentionPolicy = (data: { activity_days: number; purge_interval_hours: number }) =>
  api.put("/api/retention/audit-logs", data).then(r => r.data);
export const fetchIncidentsRetentionPolicy = () => api.get("/api/retention/incidents").then(r => r.data);
export const saveIncidentsRetentionPolicy = (data: { incident_days: number; purge_interval_hours: number }) =>
  api.put("/api/retention/incidents", data).then(r => r.data);

export const fetchDbAuditRetention = () => api.get("/api/retention/db-audit").then(r => r.data);
export const saveDbAuditRetention = (data: { db_audit_days: number; purge_interval_hours: number }) =>
  api.put("/api/retention/db-audit", data).then(r => r.data);
export const purgeDbAuditNow = () => api.post("/api/retention/db-audit/purge-now").then(r => r.data);

// ── DB Audit Platform ────────────────────────────────────────────────────────
export const fetchDbAuditConnectors = () => api.get("/api/db-audit/connectors").then(r => r.data);
export const fetchDbAuditConnector  = (id: string) => api.get(`/api/db-audit/connectors/${id}`).then(r => r.data);
export const updateDbAuditConnector = (id: string, data: object) => api.patch(`/api/db-audit/connectors/${id}`, data).then(r => r.data);
export const fetchDbAuditEvents     = (params?: any) => api.get("/api/db-audit/events", { params }).then(r => r.data);
export const fetchMutationVelocity   = () => api.get("/api/db-audit/analytics/velocity").then(r => r.data);
export const fetchDbAuditSchema     = () => api.get("/api/db-audit/schema").then(r => r.data);
export const createDbAuditConnector = (data: object) => api.post("/api/db-audit/connectors", data).then(r => r.data);
export const testDbAuditConnector   = (data: object) => api.post("/api/db-audit/connectors/test", data).then(r => r.data);
export const deleteDbAuditConnector = (id: string) => api.delete(`/api/db-audit/connectors/${id}`).then(r => r.data);
export const publishDbAuditEvent   = (data: object) => api.post("/api/db-audit/events", data).then(r => r.data);
export const deleteDbAuditEvent = (id: string) => api.delete("/api/db-audit/events/" + id).then(r => r.data);
export const bulkDeleteDbAuditEvents = (ids: string[]) => api.post("/api/db-audit/events/bulk-delete", { ids }).then(r => r.data);
export const clearDbAuditEvents = (database?: string, connector_id?: string) => api.delete("/api/db-audit/events", { params: { database, connector_id } }).then(r => r.data);
