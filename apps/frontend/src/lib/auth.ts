export const getToken    = () => typeof window !== "undefined" ? localStorage.getItem("sv_token") : null;
export const setToken    = (t: string) => localStorage.setItem("sv_token", t);
export const removeToken = () => {
  localStorage.removeItem("sv_token");
  localStorage.removeItem("lz_user");
  if (typeof window !== "undefined") {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.backgroundColor = "#f8fafc";
  }
};
export const isAuthenticated = () => !!getToken();

export interface AuthUser {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  permissions?: any;
  direct_permissions?: any;
  groups?: { group_id: string; name: string }[];
  org_id?: string;
  org?: {
    org_id: string;
    name: string;
    slug: string;
  };
}

export const getUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const u = localStorage.getItem("lz_user");
    return u ? JSON.parse(u) : null;
  } catch { return null; }
};

export const setUser = (u: AuthUser) => {
  if (typeof window === "undefined") return;
  const prevRaw = localStorage.getItem("lz_user");
  localStorage.setItem("lz_user", JSON.stringify(u));
  if (!prevRaw) {
    window.dispatchEvent(new CustomEvent("sv_user_updated", { detail: u }));
  } else {
    try {
      const prev = JSON.parse(prevRaw);
      const prevPerm = JSON.stringify(prev.effective_permissions || prev.permissions || {});
      const nextPerm = JSON.stringify((u as any).effective_permissions || u.permissions || {});
      if (
        prev.role !== u.role ||
        prev.user_id !== u.user_id ||
        prevPerm !== nextPerm
      ) {
        window.dispatchEvent(new CustomEvent("sv_user_updated", { detail: u }));
      }
    } catch {
      window.dispatchEvent(new CustomEvent("sv_user_updated", { detail: u }));
    }
  }
};

const BASE = "";

export const refreshUser = async (): Promise<AuthUser | null> => {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${BASE}/api/auth/account`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) removeToken();
      return null;
    }
    const data = await res.json();
    const user: AuthUser = {
      user_id:   data.user_id,
      email:     data.email,
      full_name: data.full_name,
      role:      (data.role || "member").toLowerCase(),
      permissions: data.effective_permissions || data.permissions,
      direct_permissions: data.permissions,
      groups:    data.groups || [],
      org_id:    data.org_id,
      org:       data.org,
    };
    setUser(user);
    lastRefreshTime = Date.now();
    return user;
  } catch (err) {
    return null;
  }
};

let lastRefreshTime = 0;

export const startRoleSync = (intervalMs = 60_000): (() => void) => {
  if (typeof window === "undefined") return () => {};
  
  lastRefreshTime = Date.now();
  const existing = getUser();
  if (!existing) {
    refreshUser();
  }

  const onVisibility = () => {
    if (!getToken()) return;
    if (document.visibilityState === "visible" && Date.now() - lastRefreshTime > 60_000) {
      lastRefreshTime = Date.now();
      refreshUser();
    }
  };

  window.addEventListener("visibilitychange", onVisibility);

  const id = window.setInterval(() => {
    if (!getToken()) return;
    if (typeof document !== "undefined" && document.hidden) return;
    lastRefreshTime = Date.now();
    refreshUser();
  }, intervalMs);

  return () => {
    window.clearInterval(id);
    window.removeEventListener("visibilitychange", onVisibility);
  };
};

// Permission matrix aligning with DB Auditor capabilities
export const CAN = {
  // Database Connectors & CDC Streams
  viewConnectors:      ["viewer", "member", "auditor", "admin"],
  addConnector:        ["admin"],
  deleteConnector:     ["admin"],
  testConnector:       ["member", "auditor", "admin"],
  viewStream:          ["viewer", "member", "auditor", "admin"],

  // Audit Ledgers & Row Diffs
  viewRowDiff:         ["member", "auditor", "admin"],
  viewPii:             ["auditor", "admin"],
  exportAudit:         ["auditor", "admin"],
  purgeAudit:          ["admin"],

  // Data Retention & Storage
  changeRetention:     ["admin"],
  clearRetentionHistory:["admin"],

  // Masking & Compliance Rules
  viewMaskingRules:    ["viewer", "member", "auditor", "admin"],
  manageMaskingRules:  ["admin"],

  // Notification Channels & Alert Preferences
  viewChannels:        ["viewer", "member", "auditor", "admin"],
  addChannel:          ["admin"],
  deleteChannel:       ["admin"],
  testChannel:         ["member", "auditor", "admin"],

  // Team / Access Control
  viewTeam:            ["member", "auditor", "admin"],
  inviteUser:          ["admin"],
  removeUser:          ["admin"],
  changeRole:          ["admin"],
  changeSudoLock:      ["admin"],
  viewApiDocs:         ["viewer", "member", "auditor", "admin"],

  // Analytics & Activity Logs
  viewAnalytics:       ["auditor", "admin"],
  viewActivityLog:     ["auditor", "admin"],

  // Backward-compatible aliases
  viewIncidents:       ["viewer", "member", "auditor", "admin"],
  acknowledgeIncident: ["member", "auditor", "admin"],
  resolveIncident:     ["member", "auditor", "admin"],
  runDiagnosis:        ["member", "auditor", "admin"],
  deleteIncident:      ["admin"],
  viewClusters:        ["viewer", "member", "auditor", "admin"],
  addCluster:          ["admin"],
  deleteCluster:       ["admin"],
  viewRules:           ["viewer", "member", "auditor", "admin"],
  addRule:             ["admin"],
  deleteRule:          ["admin"],
  toggleRule:          ["member", "auditor", "admin"],
  viewServiceOwners:   ["viewer", "member", "auditor", "admin"],
  addServiceOwner:     ["admin"],
  deleteServiceOwner:  ["admin"],
  viewMachines:        ["viewer", "member", "auditor", "admin"],
  addMachine:          ["admin"],
  deleteMachine:       ["admin"],
};

export const PERMISSION_IDS: Record<string, { categoryId: string; id: string }> = {
  // Database Connectors (Category: "cat_connectors")
  viewConnectors:       { categoryId: "cat_connectors", id: "dbc_view" },
  addConnector:         { categoryId: "cat_connectors", id: "dbc_add" },
  deleteConnector:      { categoryId: "cat_connectors", id: "dbc_del" },
  testConnector:        { categoryId: "cat_connectors", id: "dbc_test" },
  viewStream:           { categoryId: "cat_connectors", id: "dbc_stream" },

  // Audit Ledgers & Row Diffs (Category: "cat_audit")
  viewRowDiff:          { categoryId: "cat_audit", id: "aud_diff" },
  viewPii:              { categoryId: "cat_audit", id: "aud_pii" },
  exportAudit:          { categoryId: "cat_audit", id: "aud_export" },
  purgeAudit:           { categoryId: "cat_audit", id: "aud_purge" },

  // Data Retention & Storage (Category: "cat_retention")
  changeRetention:      { categoryId: "cat_retention", id: "ret_change" },
  clearRetentionHistory:{ categoryId: "cat_retention", id: "ret_clear" },

  // Masking & Compliance Rules (Category: "cat_masking")
  viewMaskingRules:     { categoryId: "cat_masking", id: "msk_view" },
  manageMaskingRules:   { categoryId: "cat_masking", id: "msk_edit" },

  // Channels (Category: "cat_channels")
  viewChannels:         { categoryId: "cat_channels", id: "cha_view" },
  addChannel:           { categoryId: "cat_channels", id: "cha_add" },
  deleteChannel:        { categoryId: "cat_channels", id: "cha_del" },
  testChannel:          { categoryId: "cat_channels", id: "cha_test" },

  // Team / Access Control (Category: "cat_team")
  viewTeam:             { categoryId: "cat_team", id: "tea_view" },
  inviteUser:           { categoryId: "cat_team", id: "tea_invite" },
  removeUser:           { categoryId: "cat_team", id: "tea_remove" },
  changeRole:           { categoryId: "cat_team", id: "tea_role" },
  changeSudoLock:       { categoryId: "cat_team", id: "tea_sudo" },
  viewApiDocs:          { categoryId: "cat_team", id: "tea_api" },

  // Analytics & Activity (Category: "cat_analytics")
  viewAnalytics:        { categoryId: "cat_analytics", id: "ana_view" },
  viewActivityLog:      { categoryId: "cat_analytics", id: "ana_logs" },
};

export const hasPermission = (user: AuthUser | null, action: keyof typeof CAN, resourceId?: string): boolean => {
  if (!user) return false;
  
  // Universal Admin Bypass: Admins have full uninhibited access
  if (user.role?.toLowerCase() === "admin") return true;

  const customPerms = (user as any).effective_permissions || user.permissions;
  const hasCustom = customPerms && typeof customPerms === "object" && !Array.isArray(customPerms) && Object.keys(customPerms).length > 0;
  
  if (hasCustom && customPerms) {
    const map = PERMISSION_IDS[action];
    if (!map) return CAN[action]?.includes(user.role) ?? false;

    const categoryArray = customPerms[map.categoryId];
    if (!Array.isArray(categoryArray)) {
      return CAN[action]?.includes(user.role?.toLowerCase()) ?? false;
    }

    const permObj = categoryArray.find((p: any) => p && typeof p === "object" && p.id === map.id);
    if (!permObj) {
      return CAN[action]?.includes(user.role) ?? false;
    }

    if (resourceId) {
      if (permObj.resources && Array.isArray(permObj.resources)) {
        const specificResource = permObj.resources.find((r: any) => r && r.id === resourceId);
        if (specificResource !== undefined) {
          return specificResource.value === true;
        }
        const wildcardResource = permObj.resources.find((r: any) => r && r.id === "*");
        if (wildcardResource !== undefined) {
          return wildcardResource.value === true;
        }
      }
    } else {
      if (permObj.value === true) return true;
      if (permObj.value === false) return false;
      if (permObj.resources && Array.isArray(permObj.resources)) {
        if (permObj.resources.some((r: any) => r && r.value === true)) {
          return true;
        }
      }
      return false;
    }

    return permObj.value === true;
  }
  
  // Fallback to role-based check
  return CAN[action]?.includes(user.role) ?? false;
};
