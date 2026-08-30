"use client";
import { useEffect, useState, useRef } from "react";
import { 
  Shield, Lock, Check, RotateCcw, AlertTriangle, Crown, 
  Eye, User, Settings, Info, X, ChevronRight, CheckCircle2, RefreshCw, Search,
  BookOpen, ShieldCheck
} from "lucide-react";
import { api } from "@/lib/api";
import { getUser, hasPermission, CAN, PERMISSION_IDS } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { createPortal } from "react-dom";
import PermissionsGuideModal from "@/components/settings/more-settings/PermissionsGuideModal";

interface Member {
  user_id: string;
  email: string;
  full_name?: string;
  role: string;
  permissions?: any;
  effective_permissions?: any;
  groups?: { group_id: string; name: string }[];
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = [
  {
    title: "Incidents",
    permissions: [
      { key: "viewIncidents", label: "View Incidents", desc: "Read and list open/resolved incident events" },
      { key: "acknowledgeIncident", label: "Acknowledge Incidents", desc: "Claim ownership of active incidents" },
      { key: "resolveIncident", label: "Resolve Incidents", desc: "Mark incident crashes as resolved" },
      { key: "runDiagnosis", label: "AI Diagnosis & Logs", desc: "View pod logs and trigger AI analysis" },
      { key: "deleteIncident", label: "Delete Incidents", desc: "Permanently delete incident history" },
    ]
  },
  {
    title: "Clusters",
    permissions: [
      { key: "viewClusters", label: "View Clusters", desc: "List kubernetes clusters and health status" },
      { key: "addCluster", label: "Add & Edit Clusters", desc: "Register new clusters or edit credentials" },
      { key: "deleteCluster", label: "Delete Clusters", desc: "Permanently delete cluster configurations" },
    ]
  },
  {
    title: "Channels",
    permissions: [
      { key: "viewChannels", label: "View Channels", desc: "List Slack, Email, and webhook notification channels" },
      { key: "addChannel", label: "Add & Edit Channels", desc: "Create new delivery channels or edit webhook details" },
      { key: "deleteChannel", label: "Delete Channels", desc: "Permanently delete alert channels" },
      { key: "testChannel", label: "Test Channels", desc: "Send test payloads through configured integrations" },
    ]
  },
  {
    title: "Alert Rules",
    permissions: [
      { key: "viewRules", label: "View Alert Rules", desc: "View cluster alerting policies" },
      { key: "addRule", label: "Add & Edit Rules", desc: "Create, edit, or mute/unmute alert rules" },
      { key: "deleteRule", label: "Delete Rules", desc: "Permanently delete alert rules" },
      { key: "toggleRule", label: "Toggle Rules", desc: "Quickly enable/disable specific policies" },
    ]
  },
  {
    title: "Team & Access Control",
    permissions: [
      { key: "viewTeam", label: "View Team", desc: "View organization user lists" },
      { key: "inviteUser", label: "Invite Members", desc: "Send organization invites to new users" },
      { key: "removeUser", label: "Remove Members", desc: "Revoke organization access from members" },
      { key: "changeRole", label: "Modify Roles & Permissions", desc: "Update user roles and custom permissions" },
      { key: "changeSudoLock", label: "Sudo Security Passcode", desc: "Modify organization-wide Sudo Security Lock passcode" },
      { key: "viewApiDocs", label: "API Credentials & Docs", desc: "Access credentials, endpoints and documentation details" },
    ]
  },
  {
    title: "Service Routing",
    permissions: [
      { key: "viewServiceOwners", label: "View Service Routing", desc: "Read and list service owner routing rules" },
      { key: "addServiceOwner", label: "Add & Edit Service Owners", desc: "Create, assign, or edit service routing settings" },
      { key: "deleteServiceOwner", label: "Delete Service Owners", desc: "Remove service owner routing assignments" }
    ]
  },
  {
    title: "Machines & Host Nodes",
    permissions: [
      { key: "viewMachines", label: "View Machines & Host Nodes", desc: "Read and list Linux machine telemetry and system metrics" },
      { key: "addMachine", label: "Connect & Add Host Machines", desc: "Generate agent installation tokens and connect host nodes" },
      { key: "deleteMachine", label: "Delete Host Machines", desc: "Remove machine monitors and disconnect agent telemetry" },
    ]
  },
  {
    title: "Analytics & System",
    permissions: [
      { key: "viewAnalytics", label: "View Analytics Page", desc: "Access high-level crash reports and charts" },
      { key: "viewActivityLog", label: "View Audit Activity Logs", desc: "Access platform-wide security audit logs and traces" },
      { key: "changeRetention", label: "Data Retention Policies", desc: "Manage database retention purge intervals for audit log ledgers and incident logs" },
      { key: "systemAlerts", label: "System Alerts Configuration", desc: "Configure organization-wide system alert routing and event triggers" },
    ]
  }
];

const ROLE_ICONS: Record<string, React.ElementType> = {
  admin: Crown,
  member: Shield,
  viewer: Eye,
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
  member: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
  viewer: "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600",
};

export default function PermissionsPage() {
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  
  // Selected user for Slide-Over Drawer
  const [selectedUser, setSelectedUser] = useState<Member | null>(null);
  
  // Track working copy of permissions per user
  const [workingState, setWorkingState] = useState<Record<string, { isCustom: boolean; permissions: Record<string, any> }>>({});

  // Local state for the Slide-Over Drawer
  const [drawerIsCustom, setDrawerIsCustom] = useState<boolean>(false);
  const [drawerPermissions, setDrawerPermissions] = useState<Record<string, any>>({});
  
  const me = getUser();
  const { success, error } = useToast();
  const [authorized, setAuthorized] = useState(true);
  const toastShownRef = useRef(false);

  const load = (quiet = false) => {
    if (!quiet) setLoading(true);
    api.get("/api/users")
      .then(r => {
        const list: Member[] = r.data.users || [];
        setUsers(list);
        
        // Initialize working state
        const state: Record<string, { isCustom: boolean; permissions: Record<string, any> }> = {};
        list.forEach(u => {
          const hasCustom = u.permissions && typeof u.permissions === "object" && !Array.isArray(u.permissions) && Object.keys(u.permissions).length > 0;
          state[u.user_id] = {
            isCustom: hasCustom || false,
            permissions: u.permissions || {}
          };
        });
        setWorkingState(state);
        setAuthorized(true);

        if (selectedUser) {
          const updatedSelected = list.find(x => x.user_id === selectedUser.user_id);
          if (updatedSelected) {
            setSelectedUser(updatedSelected);
          }
        }
      })
      .catch(err => {
        console.error(err);
        if (err.response?.status === 403) {
          setAuthorized(false);
          if (!toastShownRef.current) {
            error("Access restricted: Only administrators can configure user roles and permissions.");
            toastShownRef.current = true;
          }
        } else {
          error("Failed to load user list");
        }
      })
      .finally(() => {
        if (!quiet) setLoading(false);
      });
  };

  useEffect(() => {
    setMounted(true);
    const me = getUser();
    if (!hasPermission(me, "changeRole")) {
      setAuthorized(false);
      setLoading(false);
      if (!toastShownRef.current) {
        error("Permission Required: You do not have permission to configure user permissions.");
        toastShownRef.current = true;
      }
      return;
    }
    load(false);
  }, []);

  // Sync local drawer state when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      const activeState = workingState[selectedUser.user_id] || { isCustom: false, permissions: {} };
      setDrawerIsCustom(activeState.isCustom);
      setDrawerPermissions({ ...activeState.permissions });
    }
  }, [selectedUser, workingState]);

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`changeRole`) to configure user permissions.
        </p>
      </div>
    );
  }

  const handleSave = async (userId: string): Promise<boolean> => {
    setSavingId(userId);
    try {
      const permsObj = drawerIsCustom ? drawerPermissions : {};
      await api.patch(`/api/users/${userId}/permissions`, { permissions: permsObj });
      success("Permissions updated successfully");
      
      setWorkingState(prev => ({
        ...prev,
        [userId]: {
          isCustom: drawerIsCustom,
          permissions: permsObj
        }
      }));

      setUsers(prev => prev.map(item => {
        if (item.user_id === userId) {
          return { ...item, permissions: permsObj };
        }
        return item;
      }));

      if (userId === me?.user_id) {
        await api.get("/api/auth/account").then(r => {
          localStorage.setItem("lz_user", JSON.stringify(r.data));
          window.dispatchEvent(new CustomEvent("sv_user_updated", { detail: r.data }));
        });
      }
      
      return true;
    } catch (err: any) {
      error(err.response?.data?.detail || "Failed to update permissions");
      return false;
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 p-5 rounded-2xl shadow-sm flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" />
            Permissions Manager
          </h1>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Manage user capabilities on a member-by-member basis. Apply standard roles or create custom permission overrides.
          </p>
        </div>
        <div className="flex items-center gap-2 select-none">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="btn-secondary flex items-center gap-1.5 text-[10px] py-1.5 px-3 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-600 dark:text-slate-350 transition-colors font-bold shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
            Permission Guide
          </button>
          <button
            type="button"
            onClick={() => load(false)}
            disabled={loading}
            className="btn-secondary py-1.5 px-3.5 text-xs font-semibold gap-1.5 inline-flex items-center shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>
      {/* Search Input Bar */}
      <div className="relative max-w-md w-full select-none">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-gray-400" />
        </div>
        <input
          id="permissions-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search permissions by name or email..."
          className="input pl-9 pr-8 w-full py-2 text-xs"
        />
        {searchQuery && (
          <button 
            type="button" 
            onClick={() => setSearchQuery("")} 
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-350 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse bg-gray-100 dark:bg-slate-800/50 h-16 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden border border-gray-150 dark:border-slate-800/80 bg-white dark:bg-[#13151f] rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table id="permissions-table" className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-[#0c0d12]/45 text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 font-bold">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Permissions Mode</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/85">
                {(() => {
                  const filteredUsers = users.filter(u => 
                    (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.email.toLowerCase().includes(searchQuery.toLowerCase())
                  );

                  if (filteredUsers.length === 0) {
                    return (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-xs text-gray-400 dark:text-slate-500">
                          No users found matching your search.
                        </td>
                      </tr>
                    );
                  }

                  return filteredUsers.map(u => {
                    const state = workingState[u.user_id] || { isCustom: false, permissions: {} };
                    const Icon = ROLE_ICONS[u.role] || User;
                    const isMe = u.user_id === me?.user_id;

                  return (
                    <tr 
                      key={u.user_id}
                      className="group hover:bg-gray-50/40 dark:hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-100/40 dark:border-indigo-500/10">
                            {(u.full_name || u.email)[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {u.full_name || "Invited User"}
                              </span>
                              {isMe && (
                                <span className="text-[9px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 dark:text-slate-500">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center badge text-[10px] py-0.5 px-2 font-bold uppercase tracking-wider rounded-md border ${ROLE_COLORS[u.role]}`}>
                          <Icon className="w-3 h-3 mr-1" />
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {state.isCustom ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500 font-medium shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Custom Overrides ({
                                Object.values(state.permissions || {})
                                  .flat()
                                  .filter((p: any) => p && (p.value === true || (p.resources && p.resources.some((r: any) => r.value === true))))
                                  .length
                              })
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500 font-medium shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Role Defaults
                            </span>
                          )}
                          {u.groups && u.groups.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {u.groups.map((g: any) => (
                                <span 
                                  key={g.group_id} 
                                  className="text-[9px] bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800 px-1.5 py-0.5 rounded font-semibold shrink-0"
                                  title={g.name}
                                >
                                  {g.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(u);
                          }}
                          className="btn-secondary py-1.5 px-3.5 text-xs font-semibold gap-1 inline-flex items-center"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Configure
                          <ChevronRight className="w-3 h-3 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-Over Drawer Panel */}
      {mounted && selectedUser && createPortal((() => {
        const u = selectedUser;
        const Icon = ROLE_ICONS[u.role] || User;
        const isMe = u.user_id === me?.user_id;

        return (
          <div className="fixed inset-0 overflow-hidden z-50">
            <div className="absolute inset-0 overflow-hidden">
              <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
                onClick={() => setSelectedUser(null)} 
              />
              
              <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
                <div className="w-screen max-w-xl bg-white dark:bg-[#11131a] border-l border-gray-150 dark:border-slate-800/85 shadow-2xl flex flex-col h-full transform transition-transform duration-300 slide-in-from-right">
                  
                  <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 flex items-center justify-center font-bold text-base shrink-0 border border-indigo-100/40 dark:border-indigo-500/10">
                        {(u.full_name || u.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <h2 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                          {u.full_name || "Invited User"}
                          <span className={`inline-flex items-center badge text-[9px] py-0.5 px-1.5 font-bold uppercase tracking-wider rounded border ${ROLE_COLORS[u.role]}`}>
                            <Icon className="w-2.5 h-2.5 mr-1" />
                            {u.role}
                          </span>
                        </h2>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{u.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedUser(null)}
                      className="p-1.5 rounded-lg border border-gray-150 dark:border-slate-800 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isMe && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-900/30 rounded-xl flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          You cannot change your own permissions or role overrides to prevent locking yourself out of Srevox administration features.
                        </p>
                      </div>
                    )}

                    <div className="bg-gray-50/50 dark:bg-[#0c0d12]/45 border border-gray-150 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Permissions Override</span>
                          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Toggle between standard role settings and customized exceptions.</p>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          drawerIsCustom 
                            ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {drawerIsCustom ? "Custom Overrides" : "Role Default"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={() => {
                            const nextIsCustom = !drawerIsCustom;
                            setDrawerIsCustom(nextIsCustom);
                            
                            const nextSet: Record<string, any[]> = {};
                            Object.entries(CAN).forEach(([action, roles]) => {
                              if (roles.includes(u.role)) {
                                const map = (PERMISSION_IDS as any)[action];
                                if (map) {
                                  if (!nextSet[map.categoryId]) {
                                    nextSet[map.categoryId] = [];
                                  }
                                  nextSet[map.categoryId].push({ id: map.id, value: true });
                                }
                              }
                            });
                            setDrawerPermissions(nextSet);
                          }}
                          disabled={isMe}
                          className={`btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 ${
                            isMe ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          <Settings className="w-3.5 h-3.5" />
                          {drawerIsCustom ? "Revert to Role Defaults" : "Enable Custom Overrides"}
                        </button>

                        {drawerIsCustom && !isMe && (
                          <button
                            onClick={() => {
                              const nextSet: Record<string, any[]> = {};
                              Object.entries(CAN).forEach(([action, roles]) => {
                                if (roles.includes(u.role)) {
                                  const map = (PERMISSION_IDS as any)[action];
                                  if (map) {
                                    if (!nextSet[map.categoryId]) {
                                      nextSet[map.categoryId] = [];
                                    }
                                    nextSet[map.categoryId].push({ id: map.id, value: true });
                                  }
                                }
                              });
                              setDrawerPermissions(nextSet);
                            }}
                            title="Reset list choices to role defaults"
                            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 text-gray-500 dark:text-slate-400"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset Selection
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      {CATEGORIES.map(cat => (
                        <div key={cat.title} className="space-y-2.5">
                          <h3 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider border-b border-gray-100 dark:border-slate-800/80 pb-1.5">
                            {cat.title}
                          </h3>
                          <div className="space-y-2">
                            {cat.permissions.map(perm => {
                              const map = (PERMISSION_IDS as any)[perm.key];
                              const categoryArray = drawerPermissions[map?.categoryId] || [];
                              const permItem = categoryArray.find((item: any) => item.id === map?.id);
                              const isChecked = !!(permItem && (permItem.value === true || (permItem.resources && permItem.resources.some((r: any) => r.value === true))));
                              const disabled = !drawerIsCustom || isMe;

                              return (
                                <label
                                  key={perm.key}
                                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                    disabled
                                      ? "border-transparent bg-gray-50/20 dark:bg-slate-900/10 opacity-70"
                                      : "border-gray-150 dark:border-slate-800/60 hover:bg-gray-55 dark:hover:bg-slate-800/30 hover:border-gray-250 cursor-pointer"
                                  }`}
                                >
                                  <div className="relative flex items-center mt-0.5">
                                    <input
                                      type="checkbox"
                                      disabled={disabled}
                                      checked={isChecked}
                                      onChange={() => {
                                        if (!map) return;
                                        setDrawerPermissions(prev => {
                                          const next = { ...prev };
                                          const categoryId = map.categoryId;
                                          const permId = map.id;
                                          const arr = next[categoryId] ? [...next[categoryId]] : [];
                                          const index = arr.findIndex((item: any) => item.id === permId);
                                          
                                          if (isChecked) {
                                            if (index !== -1) {
                                              const existing = arr[index];
                                              arr[index] = {
                                                ...existing,
                                                value: false,
                                                resources: existing.resources 
                                                  ? existing.resources.map((r: any) => ({ ...r, value: false })) 
                                                  : undefined
                                              };
                                            } else {
                                              arr.push({ id: permId, value: false });
                                            }
                                          } else {
                                            if (index !== -1) {
                                              arr[index] = { id: permId, value: true, resources: undefined };
                                            } else {
                                              arr.push({ id: permId, value: true });
                                            }
                                          }
                                          next[categoryId] = arr;
                                          return next;
                                        });
                                      }}
                                      className="rounded border-gray-300 dark:border-slate-700 text-indigo-650 focus:ring-indigo-500 w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                                    />
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="text-xs font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                                      {perm.label}
                                      {isChecked && (
                                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                                      )}
                                    </span>
                                    <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-normal">
                                      {perm.desc}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>

                  <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-[#0c0d12]/45 flex items-center justify-end gap-3 shrink-0">
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="btn-secondary text-xs py-2 px-4 font-semibold"
                    >
                      Close
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await handleSave(u.user_id);
                        if (ok) setSelectedUser(null);
                      }}
                      disabled={isMe || savingId === u.user_id}
                      className="btn-primary text-xs py-2 px-5 font-semibold flex items-center gap-1.5"
                    >
                      {savingId === u.user_id ? "Saving..." : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>

                </div>
              </div>

            </div>
          </div>
        );
      })(), document.body)}

      <PermissionsGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />

    </div>
  );
}
