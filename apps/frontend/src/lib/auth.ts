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
  localStorage.setItem("lz_user", JSON.stringify(u));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sv_user_updated", { detail: u }));
  }
};

// FIX 1: Use same BASE as api.ts so fetch hits port 4000, not 3000
const BASE = "";

export const refreshUser = async (): Promise<AuthUser | null> => {
  const token = getToken();
  if (!token) return null;

  if (typeof window !== "undefined" && localStorage.getItem("sv_auto_tour_active") === "true") {
    const localUser = getUser() || {
      user_id: "usrjncj44t4hb4",
      email: "admin@srevox.local",
      full_name: "Admin User (Offline Mode)",
      role: "admin",
      permissions: {},
      org_id: "orgjncj44t4hb4",
      org: {
        org_id: "orgjncj44t4hb4",
        name: "My Organization",
        slug: "my-org"
      }
    };
    setUser(localUser);
    return localUser;
  }

  try {
    const res = await fetch(`${BASE}/api/auth/account`, {  // FIX 1: was "/api/auth/me"
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
      role:      data.role,
      permissions: data.effective_permissions || data.permissions,
      direct_permissions: data.permissions,
      groups:    data.groups || [],
      org_id:    data.org_id,
      org:       data.org,
    };
    setUser(user); // always fires sv_user_updated → Navbar re-renders
    lastRefreshTime = Date.now();
    return user;
  } catch (err) {
    return null;
  }
};

let lastRefreshTime = 0;

export const startRoleSync = (intervalMs = 300_000): (() => void) => {
  if (typeof window === "undefined") return () => {};
  
  // Set initial time
  lastRefreshTime = Date.now();
  refreshUser(); 

  const id = window.setInterval(() => {
    if (!getToken()) return;
    lastRefreshTime = Date.now();
    refreshUser();
  }, intervalMs);

  return () => {
    window.clearInterval(id);
  };
};

// Permission matrix aligning with backend CAN definitions
export const CAN = {
  // Incidents
  viewIncidents:      ["viewer", "member", "admin"],
  acknowledgeIncident:["member", "admin"],
  resolveIncident:    ["member", "admin"],
  runDiagnosis:       ["member", "admin"],
  deleteIncident:     ["admin"],

  // Clusters
  viewClusters:   ["viewer", "member", "admin"],
  addCluster:     ["admin"],
  deleteCluster:  ["admin"],

  // Channels
  viewChannels:   ["viewer", "member", "admin"],
  addChannel:     ["admin"],
  deleteChannel:  ["admin"],
  testChannel:    ["member", "admin"],

  // Alert Rules
  viewRules:      ["viewer", "member", "admin"],
  addRule:        ["admin"],
  deleteRule:     ["admin"],
  toggleRule:     ["member", "admin"],

  // Team / Users
  viewTeam:       ["member", "admin"],
  inviteUser:     ["admin"],
  removeUser:     ["admin"],
  changeRole:     ["admin"],

  // Service Owners
  viewServiceOwners:   ["viewer", "member", "admin"],
  addServiceOwner:     ["admin"],
  deleteServiceOwner:  ["admin"],

  // Analytics
  viewAnalytics:  ["admin"],
  viewActivityLog: ["admin"],

  // Machines & Host Nodes
  viewMachines:   ["viewer", "member", "admin"],
  addMachine:     ["admin"],
  deleteMachine:  ["admin"],

  // More Settings
  changeSudoLock: ["admin"],
  changeRetention: ["admin"],
  systemAlerts: ["admin"],
  viewApiDocs: ["viewer", "member", "admin"],
};

export const PERMISSION_IDS: Record<string, { categoryId: string; id: string }> = {
  // Incidents (Category: "inci3hbr43hb")
  viewIncidents:       { categoryId: "inci3hbr43hb", id: "vie3jrhb4r" },
  acknowledgeIncident: { categoryId: "inci3hbr43hb", id: "ack4rnf4jbf" },
  resolveIncident:     { categoryId: "inci3hbr43hb", id: "res34f4hfb" },
  runDiagnosis:        { categoryId: "inci3hbr43hb", id: "run45g4hfb" },
  deleteIncident:      { categoryId: "inci3hbr43hb", id: "del56h4hfb" },

  // Clusters (Category: "clu4rhbrhb")
  viewClusters:        { categoryId: "clu4rhbrhb", id: "vie45g4hfb" },
  addCluster:          { categoryId: "clu4rhbrhb", id: "add56h4hfb" },
  deleteCluster:       { categoryId: "clu4rhbrhb", id: "del67i4hfb" },

  // Machines (Category: "mac90l4hfb")
  viewMachines:        { categoryId: "mac90l4hfb", id: "vie01mac" },
  addMachine:          { categoryId: "mac90l4hfb", id: "add02mac" },
  deleteMachine:       { categoryId: "mac90l4hfb", id: "del03mac" },

  // Channels (Category: "cha56h4hfb")
  viewChannels:        { categoryId: "cha56h4hfb", id: "vie56h4hfb" },
  addChannel:          { categoryId: "cha56h4hfb", id: "add67i4hfb" },
  deleteChannel:       { categoryId: "cha56h4hfb", id: "del78j4hfb" },
  testChannel:         { categoryId: "cha56h4hfb", id: "tes89k4hfb" },

  // Alert Rules (Category: "rul67i4hfb")
  viewRules:           { categoryId: "rul67i4hfb", id: "vie67i4hfb" },
  addRule:             { categoryId: "rul67i4hfb", id: "add78j4hfb" },
  deleteRule:          { categoryId: "rul67i4hfb", id: "del89k4hfb" },
  toggleRule:          { categoryId: "rul67i4hfb", id: "tog90l4hfb" },

  // Team / Access Control (Category: "tea78j4hfb")
  viewTeam:            { categoryId: "tea78j4hfb", id: "vie78j4hfb" },
  inviteUser:          { categoryId: "tea78j4hfb", id: "inv89k4hfb" },
  removeUser:          { categoryId: "tea78j4hfb", id: "rem90l4hfb" },
  changeRole:          { categoryId: "tea78j4hfb", id: "cha01m4hfb" },
  changeSudoLock:      { categoryId: "tea78j4hfb", id: "sud90l4hfb" },
  viewApiDocs:         { categoryId: "tea78j4hfb", id: "api90l4hfb" },

  // Service Owners (Category: "own89k4hfb")
  viewServiceOwners:   { categoryId: "own89k4hfb", id: "vie02n4hfb" },
  addServiceOwner:     { categoryId: "own89k4hfb", id: "add03o4hfb" },
  deleteServiceOwner:  { categoryId: "own89k4hfb", id: "del04p4hfb" },

  // Analytics (Category: "ana89k4hfb")
  viewAnalytics:       { categoryId: "ana89k4hfb", id: "vie89k4hfb" },
  viewActivityLog:     { categoryId: "ana89k4hfb", id: "vie90l4hfb" },
  changeRetention:     { categoryId: "ana89k4hfb", id: "ret90l4hfb" },
  systemAlerts:        { categoryId: "ana89k4hfb", id: "sys90l4hfb" },
};

export const hasPermission = (user: AuthUser | null, action: keyof typeof CAN, resourceId?: string): boolean => {
  if (!user) return false;
  
  const customPerms = (user as any).effective_permissions || user.permissions;
  const hasCustom = customPerms && typeof customPerms === "object" && !Array.isArray(customPerms) && Object.keys(customPerms).length > 0;
  
  if (hasCustom && customPerms) {
    const map = PERMISSION_IDS[action];
    if (!map) return CAN[action]?.includes(user.role) ?? false;

    const categoryArray = customPerms[map.categoryId];
    if (!Array.isArray(categoryArray)) {
      return CAN[action]?.includes(user.role) ?? false;
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