"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  TerminalSquare, Loader2, Key, Filter, Calendar, Users, 
  Search, ShieldAlert, ChevronLeft, ChevronRight, RefreshCw, Lock,
  Trash2, AlertCircle, X, ExternalLink, Settings, Clock
} from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";
import { getUser, hasPermission } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { timeAgo } from "@/lib/utils";

interface ActivityLog {
  activity_log_id: string;
  org_id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  metadata: any;
  created_at: string;
}

interface User {
  user_id: string;
  full_name: string;
  email: string;
}

interface Group {
  group_id: string;
  name: string;
}

const formatAction = (action: string) => {
  switch (action) {
    
    case "connector_created":
    case "add_connector":
    case "connect_database":
      return { label: "Database Connector Created", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100/50" };
    case "connector_updated":
    case "update_connector":
      return { label: "Connector Config Updated", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100/50" };
    case "connector_deleted":
    case "delete_connector":
      return { label: "Connector Removed", color: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-100/50" };
    case "retention_updated":
    case "update_retention_policy":
      return { label: "Retention Policy Updated", color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100/50" };
    case "retention_purged":
    case "purge_retention_records":
      return { label: "Audit Records Purged", color: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-100/50" };
    case "channel_created":
    case "add_channel":
      return { label: "Alert Channel Created", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100/50" };
    case "channel_updated":
    case "update_channel":
      return { label: "Alert Channel Updated", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100/50" };
    case "channel_deleted":
    case "delete_channel":
      return { label: "Alert Channel Deleted", color: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-100/50" };
    case "channel_tested":
    case "test_channel":
      return { label: "Alert Channel Tested", color: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100/50" };
    case "user_login":
    case "login":
      return { label: "User Logged In", color: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100/50" };
    case "user_logout":
    case "logout":
      return { label: "User Logged Out", color: "bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border border-gray-200" };
    case "update_profile":
    case "profile_updated":
      return { label: "Profile Updated", color: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border border-violet-100/50" };
    case "password_changed":
    case "change_password":
      return { label: "Password Updated", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100/50" };
    case "invite_member":
    case "member_invited":
      return { label: "Member Invited", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100/50" };
    case "group_created":
      return { label: "User Group Created", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100/50" };
    case "page_view":
    case "view_data_audit_ledger":
      return { label: "Viewed CDC Audit Ledger", color: "bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border border-gray-200" };
    case "view_notifications":
      return { label: "Viewed Notifications", color: "bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border border-gray-200" };
    case "service_created": return { label: "Service Registered", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100/50" };
    case "service_updated": return { label: "Service Config Updated", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100/50" };
    case "resource_alert_created": return { label: "Resource Alert Created", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100/50" };
    case "resource_alert_updated": return { label: "Resource Alert Updated", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100/50" };
    case "resource_alert_deleted": return { label: "Resource Alert Deleted", color: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-100/50" };
    case "resource_alert_muted": return { label: "Resource Alert Muted", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100/50" };
    case "resource_alert_unmuted": return { label: "Resource Alert Unmuted", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100/50" };
    case "owner_assigned": return { label: "Owner Assigned", color: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100/50" };
    case "owner_removed": return { label: "Owner Unassigned", color: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-100/50" };
    case "alert_sent": return { label: "Alert Dispatched", color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100/50" };
    case "notification_sent": return { label: "Owner Notified", color: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-100/50" };
    case "email_change": return { label: "Email Updated", color: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-100/50" };
    case "org_name_change": return { label: "Org Name Changed", color: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border border-violet-100/50" };
    case "view_services_list": return { label: "Viewed Services", color: "bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border border-gray-200" };
    case "view_service_details": return { label: "Viewed Service Details", color: "bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border border-gray-200" };
    case "view_dashboard": return { label: "Viewed Dashboard", color: "bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border border-gray-200" };
    case "view_incidents_list": return { label: "Viewed Incidents", color: "bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border border-gray-200" };
    case "view_audit_logs_settings": return { label: "Audit Log Accessed", color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400 border border-cyan-100/50" };
    default: return { label: action.replace(/_/g, " "), color: "bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border border-gray-200" };
  }
};

const resolveUserDisplay = (
  val: any,
  usersList: User[] = [],
  groupsList: Group[] = [],
  channelsList: any[] = [],
  connectorsList: any[] = []
): string => {
  if (typeof val !== "string") return JSON.stringify(val);
  if (val.startsWith("usr")) {
    const matched = usersList.find(u => u.user_id === val);
    return matched ? `${matched.full_name} (${matched.email})` : val;
  }
  if (val.startsWith("grp")) {
    const matched = groupsList.find(g => g.group_id === val);
    return matched ? `Group: ${matched.name}` : val;
  }
  if (val.startsWith("conn") || val.startsWith("con_")) {
    const matched = connectorsList.find(c => c.connector_id === val || c.id === val);
    return matched ? `Connector: ${matched.name}` : `Connector: ${val}`;
  }
  if (val.startsWith("cha")) {
    const matched = channelsList.find(c => c.channel_id === val);
    return matched ? `Channel: ${matched.name}` : val;
  }
  if (val.includes(",")) {
    const ids = val.split(",").map(s => s.trim());
    const mapped = ids.map(id => resolveUserDisplay(id, usersList, groupsList, channelsList, connectorsList));
    return mapped.join(", ");
  }
  return val;
};

const formatMetadata = (
  act: ActivityLog,
  usersList: User[] = [],
  groupsList: Group[] = [],
  channelsList: any[] = [],
  connectorsList: any[] = []
) => {
  let meta = act.metadata;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch (e) {
      meta = {};
    }
  }
  if (!meta || typeof meta !== "object") {
    meta = {};
  }

  const getUserDisplay = (val: any): string =>
    resolveUserDisplay(val, usersList, groupsList, channelsList, connectorsList);

  const getDisplayValue = (val: any): string => {
    if (val === undefined || val === null) return "none";
    if (Array.isArray(val)) {
      const names = val.map(id => getUserDisplay(id));
      return `[${names.join(", ")}]`;
    }
    return getUserDisplay(val);
  };
  
  if (act.action === "view_audit_logs_settings" || act.action === "view_services_list" || act.action === "view_service_details" || act.action === "view_dashboard" || act.action === "view_incidents_list") {
    if (meta.path) {
      return (
        <div className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
          Accessed URL <span className="font-semibold text-indigo-500 dark:text-indigo-400 font-mono">{meta.path}</span>
        </div>
      );
    }
  }

  if (meta.changes) {
    return (
      <div className="space-y-1">
        {Object.entries(meta.changes).map(([field, delta]: [string, any]) => {
          const oldVal = delta && delta.old !== undefined ? getDisplayValue(delta.old) : "none";
          const newVal = delta && delta.new !== undefined ? getDisplayValue(delta.new) : "none";
          return (
            <div key={field} className="text-[11px] leading-relaxed text-gray-600 dark:text-slate-350">
              Modified <span className="font-bold text-gray-800 dark:text-slate-200 capitalize">{field.replace(/_/g, " ")}</span> from{" "}
              <code className="text-[10px] bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 px-1 py-0.5 rounded font-mono">{oldVal}</code>{" "}
              to{" "}
              <code className="text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 px-1 py-0.5 rounded font-mono">{newVal}</code>
            </div>
          );
        })}
      </div>
    );
  }

  // Format custom fields nicely
  const details: string[] = [];
  if (meta.pod_prefix) details.push(`Prefix: "${meta.pod_prefix}"`);
  if (meta.namespace) details.push(`Namespace: "${meta.namespace}"`);
  if (meta.owner_name) details.push(`Owner: ${meta.owner_name}`);
  if (meta.group_name) details.push(`Group: ${meta.group_name}`);
  if (meta.email) details.push(`Email: ${meta.email}`);
  if (meta.cluster_name) details.push(`Cluster: ${meta.cluster_name}`);
  if (meta.resource_type) details.push(`Resource: ${meta.resource_type.toUpperCase()}`);
  if (meta.threshold_pct) details.push(`Threshold: ${meta.threshold_pct}%`);
  if (meta.target) details.push(`Target: ${meta.target}${meta.target_name ? ` (${meta.target_name})` : ""}`);
  if (meta.mute_until) details.push(`Muted until: ${meta.mute_until}`);
  if (meta.old && meta.new) {
    const oldLabel = getDisplayValue(meta.old);
    const newLabel = getDisplayValue(meta.new);
    details.push(`Changed from "${oldLabel}" to "${newLabel}"`);
  }

  if (details.length > 0) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {details.map((d, idx) => (
          <span key={idx} className="text-[10px] font-semibold bg-gray-50 dark:bg-slate-800/40 border border-gray-150 dark:border-slate-800 text-gray-600 dark:text-slate-400 px-2 py-0.5 rounded-md">
            {d}
          </span>
        ))}
      </div>
    );
  }

  // Fallback to simple key-value listing
  const keys = Object.keys(meta).filter(k => k !== "org_id" && k !== "user_id");
  if (keys.length === 0) {
    return <span className="text-[10px] text-gray-400 dark:text-slate-550 italic">No additional details</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {keys.map(k => (
        <span key={k} className="text-[9px] font-mono bg-gray-55 dark:bg-slate-900/40 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-gray-100 dark:border-slate-800/50">
          {k}: {getDisplayValue(meta[k])}
        </span>
      ))}
    </div>
  );
};

const getActivityLink = (act: ActivityLog) => {
  let meta = act.metadata;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch (e) {
      meta = {};
    }
  }
  if (!meta || typeof meta !== "object") {
    meta = {};
  }
  
  if (meta.path) {
    return meta.path;
  }
  
  if (act.resource === "service" && act.resource_id) {
    return `/dashboard/services/${act.resource_id}`;
  }
  if (act.resource === "incident") {
    return "/dashboard/incidents";
  }
  if (act.resource === "channel") {
    return "/settings/channels";
  }
  if (act.resource === "user" || act.resource === "profile") {
    return "/settings/profile";
  }
  if (act.resource === "permissions") {
    return "/settings/permissions";
  }
  
  return null;
};

export default function AuditLogsPage() {
  const me = getUser();
  const isAdmin = me?.role === "admin";
  const canView = hasPermission(me, "viewActivityLog");
  const { success, error: toastError } = useToast();
  const toastShownRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!canView && !toastShownRef.current) {
      toastError("Permission Required: You do not have permission to view activity logs.");
      toastShownRef.current = true;
    }
  }, [canView, toastError]);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Authentication State
  const [sudoVerified, setSudoVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sudoToken, setSudoToken] = useState<string | null>(null);

  const lastActivityRef = useRef<number>(Date.now());

  // Load session state on mount if valid
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = sessionStorage.getItem("srevox_sudo_token");
      const storedLastActivity = sessionStorage.getItem("srevox_sudo_last_activity");
      if (storedToken && storedLastActivity) {
        const timeSinceActivity = Date.now() - Number(storedLastActivity);
        if (timeSinceActivity < 5 * 60 * 1000) {
          setSudoToken(storedToken);
          setSudoVerified(true);
          sessionStorage.setItem("srevox_sudo_last_activity", Date.now().toString());
          lastActivityRef.current = Date.now();
        } else {
          sessionStorage.removeItem("srevox_sudo_token");
          sessionStorage.removeItem("srevox_sudo_last_activity");
        }
      }
    }
  }, []);

  // Idle movement activity listeners
  useEffect(() => {
    if (!sudoVerified) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      if (typeof window !== "undefined") {
        sessionStorage.setItem("srevox_sudo_last_activity", Date.now().toString());
      }
    };

    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart"];
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= 5 * 60 * 1000) {
        setSudoVerified(false);
        setSudoToken(null);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("srevox_sudo_token");
          sessionStorage.removeItem("srevox_sudo_last_activity");
        }
        toastError("Sudo session expired due to inactivity. Please verify your password again.");
      }
    }, 1000);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(interval);
    };
  }, [sudoVerified]);

  // Filter States
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedDuration, setSelectedDuration] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Loading & Pagination States
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const [hasMore, setHasMore] = useState(true);

  // Multi-select & Delete States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<"selected" | "all">("selected");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Active Detail Drawer State
  const [activeDetail, setActiveDetail] = useState<ActivityLog | null>(null);

  const [channelsList, setChannelsList] = useState<any[]>([]);
  const [connectorsList, setConnectorsList] = useState<any[]>([]);

  // Fetch users & metadata entities for resolution
  useEffect(() => {
    if (!canView) return;
    api.get("/api/users").then(res => setUsers(res.data.users || [])).catch(() => {});
    api.get("/api/groups").then(res => setGroups(res.data.groups || [])).catch(() => {});
    api.get("/api/channels").then(res => setChannelsList(res.data.channels || [])).catch(() => {});
    api.get("/api/db-audit/connectors").then(res => setConnectorsList(res.data.connectors || [])).catch(() => {});
  }, [canView]);

  // Page View Auditing
  useEffect(() => {
    const activeUser = getUser();
    if (!activeUser) return;
    api.get("/api/auth/account").then((res) => {
      const orgId = res.data.org?.org_id || activeUser.org_id || "default";
      const token = typeof window !== "undefined" ? localStorage.getItem("sv_token") : null;
      fetch("/api/activities", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          org_id: orgId,
          user_id: activeUser.user_id,
          action: "view_audit_logs_settings",
          resource: "settings_page",
          resource_id: "activity",
          metadata: { path: window.location.pathname }
        })
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // Password Unlock Gate Handler
  const verifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setVerifying(true);
    try {
      const res = await api.post("/api/auth/verify-sudo-password", { password });
      if (res.data.success) {
        const tokenVal = res.data.sudo_token || "unlocked";
        setSudoToken(tokenVal);
        setSudoVerified(true);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("srevox_sudo_token", tokenVal);
          sessionStorage.setItem("srevox_sudo_last_activity", Date.now().toString());
        }
        lastActivityRef.current = Date.now();
        success("Audit logs unlocked", "Sudo mode activated successfully.");
      }
    } catch (err: any) {
      toastError(err?.response?.data?.detail || "Incorrect security password. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  // Fetch Activities from Rust microservice
  const loadActivities = async (currentOffset = offset, showToast = false) => {
    if (!sudoToken) return;
    setLoadingLogs(true);
    try {
      const queryParams = new URLSearchParams({
        limit: String(limit),
        offset: String(currentOffset),
        duration: selectedDuration,
      });

      if (selectedUser) queryParams.append("user_id", selectedUser);
      if (selectedGroup) queryParams.append("group_id", selectedGroup);
      if (searchQuery) queryParams.append("search", searchQuery);

      const token = typeof window !== "undefined" ? localStorage.getItem("sv_token") : null;
      const response = await fetch(`/api/activities?${queryParams.toString()}`, {
        headers: {
          "X-Sudo-Token": sudoToken,
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });

      if (response.status === 401 || response.status === 403) {
        setSudoVerified(false);
        setSudoToken(null);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("srevox_sudo_token");
          sessionStorage.removeItem("srevox_sudo_last_activity");
        }
        toastError("Sudo session expired. Please verify your password again.");
        return;
      }

      const data = await response.json();
      const items = data.activities || [];
      setActivities(items);
      setHasMore(items.length === limit);
      if (showToast) {
        success("Audit logs reloaded", "The activity ledger was successfully updated.");
      }
    } catch (err) {
      console.error("Failed to query audit logs from Rust service", err);
      toastError("Failed to retrieve audit activity logs. Please try again later.");
    } finally {
      setLoadingLogs(false);
    }
  };

  // Trigger load when filters or offset changes
  useEffect(() => {
    if (sudoVerified) {
      loadActivities(offset);
    }
  }, [sudoVerified, selectedUser, selectedGroup, selectedDuration, searchQuery, offset]);

  // Handle filter changes (resets pagination offset)
  const resetAndSearch = () => {
    setOffset(0);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === activities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activities.map(a => a.activity_log_id)));
    }
  };

  const handleDeleteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmPassword) return;
    setDeleting(true);
    try {
      // 1. Verify password to get a fresh sudo token
      const authRes = await api.post("/api/auth/verify-password", { password: confirmPassword });
      if (!authRes.data.success || !authRes.data.sudo_token) {
        toastError("Incorrect password. Deletion authorization failed.");
        setDeleting(false);
        return;
      }
      
      const tokenToUse = authRes.data.sudo_token;
      
      // 2. Perform deletion request to Rust service via Next.js proxy
      const payload = deleteType === "all" 
        ? { clear_all: true }
        : { activity_log_ids: Array.from(selectedIds), clear_all: false };

      const response = await fetch("/api/activities", {
        method: "DELETE",
        headers: {
          "X-Sudo-Token": tokenToUse,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Deletion request failed");
      }

      success(
        deleteType === "all" ? "Audit ledger cleared" : "Selected logs deleted",
        "Activity log entries have been permanently removed."
      );
      
      // Clean up states
      setSelectedIds(new Set());
      setConfirmPassword("");
      setDeleteModalOpen(false);
      
      // Reload logs
      setOffset(0);
      loadActivities(0);
    } catch (err: any) {
      console.error(err);
      toastError(err.message || "Failed to delete activity logs.");
    } finally {
      setDeleting(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permissions (`viewActivityLog`) to read organization audit logs.
        </p>
      </div>
    );
  }

  // Render Sudo Password Prompter Overlay if not verified
  if (!sudoVerified) {
    return (
      <div className="flex items-center justify-center min-h-[55vh] px-4">
        <form onSubmit={verifyPassword} className="max-w-md w-full bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 p-8 rounded-3xl shadow-xl space-y-6 animate-modal-slide-up">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto text-indigo-500">
            <Lock className="w-6 h-6" />
          </div>
          
          <div className="text-center space-y-1.5">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Security Verification</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
              Please enter the organization security password to unlock organization audit logs.
            </p>
          </div>

          {/* New Setup / Password Helper Box */}
          <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/20 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-300">
              <Key className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Default Security Password</span>
            </div>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed">
              Default security password for new setup is <code className="bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded font-mono font-bold text-indigo-800 dark:text-indigo-200">admin123</code>.
            </p>
            <div className="pt-1">
              <Link
                href="/settings/org"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Update Security Password in Organization Settings &rarr;
              </Link>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Security Password</label>
            <input
              type="password"
              placeholder="Enter security password (default: admin123)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input text-xs"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={verifying}
            className="btn-primary w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5"
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Unlock Audit Logs"
            )}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800/60 pb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TerminalSquare className="w-5 h-5 text-indigo-500" />
            Audit Activity Logs
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Security audit ledger logging read, write, and background workers tasks organization-wide
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => { setDeleteType("selected"); setDeleteModalOpen(true); }}
              className="btn-danger flex items-center gap-1.5 text-xs py-2 px-3 rounded-lg bg-red-650 hover:bg-red-700 text-white font-semibold shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => { setDeleteType("all"); setDeleteModalOpen(true); }}
            className="btn-secondary text-red-650 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10 border border-red-200 hover:border-red-300 dark:border-red-500/20 flex items-center gap-1.5 text-xs py-2 px-3 rounded-lg"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All Logs
          </button>
          <button
            onClick={() => loadActivities(offset, true)}
            disabled={loadingLogs}
            className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3 rounded-lg"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
            Reload logs
          </button>
        </div>
      </div>

      {/* Active development banner notice */}
      <div className="bg-amber-50/20 dark:bg-amber-550/5 border border-amber-200/40 dark:border-amber-500/10 rounded-2xl p-4 flex gap-3 items-center">
        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-500 shrink-0">
          <AlertCircle className="w-4.5 h-4.5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-400">Beta Version — Active Development</p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-500/70 mt-0.5">
            This feature is currently in active development and may not be fully stable. Performance fixes and additional improvements will be shipped in next upcoming versions.
          </p>
        </div>
      </div>

      {/* Filters controls panel */}
      <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end shadow-sm">
        {/* User filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3 h-3 text-indigo-500" /> User
          </label>
          <select
            className="input text-xs py-1.5 px-2.5 h-[34px] rounded-lg"
            value={selectedUser}
            onChange={(e) => { setSelectedUser(e.target.value); resetAndSearch(); }}
          >
            <option value="">All Users</option>
            {users.map(u => (
              <option key={u.user_id} value={u.user_id}>{u.full_name || u.email}</option>
            ))}
          </select>
        </div>

        {/* Group filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3 h-3 text-indigo-500" /> Group / Team
          </label>
          <select
            className="input text-xs py-1.5 px-2.5 h-[34px] rounded-lg"
            value={selectedGroup}
            onChange={(e) => { setSelectedGroup(e.target.value); resetAndSearch(); }}
          >
            <option value="">All Groups</option>
            {groups.map(g => (
              <option key={g.group_id} value={g.group_id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* Time filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-indigo-500" /> Timeframe
          </label>
          <select
            className="input text-xs py-1.5 px-2.5 h-[34px] rounded-lg"
            value={selectedDuration}
            onChange={(e) => { setSelectedDuration(e.target.value); resetAndSearch(); }}
          >
            <option value="all">All Time</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        {/* Text Search */}
        <div className="space-y-1 lg:col-span-2">
          <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Search className="w-3 h-3 text-indigo-500" /> Keyword Search
          </label>
          <input
            type="text"
            placeholder="Search action type, resource name..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); resetAndSearch(); }}
            className="input text-xs py-1.5 px-2.5 h-[34px] rounded-lg"
          />
        </div>
      </div>

      {/* Log & Incident Retention Policy Configuration Card */}
      {/* Logs Table */}
      <div className="card overflow-hidden bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          {loadingLogs && activities.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs text-gray-500 dark:text-slate-400">Loading audit ledger logs...</span>
            </div>
          ) : activities.length === 0 ? (
            <div className="py-20 text-center">
              <TerminalSquare className="w-10 h-10 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="font-semibold text-gray-550 dark:text-slate-400 text-xs">No audit logs found</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Try adjusting the filter configurations or keywords.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800/60 bg-gray-50/50 dark:bg-slate-800/10 text-[10px] font-bold text-gray-400 dark:text-slate-550 uppercase tracking-wider">
                  <th className="px-5 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={activities.length > 0 && selectedIds.size === activities.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 dark:border-slate-700 bg-white dark:bg-[#1e293b]"
                    />
                  </th>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Actor (User)</th>
                  <th className="px-5 py-3">Action Type</th>
                  <th className="px-5 py-3">Resource / Target Name</th>
                  <th className="px-5 py-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {activities.map((act) => (
                  <tr 
                    key={act.activity_log_id} 
                    className="text-xs hover:bg-gray-50/30 dark:hover:bg-slate-800/10 cursor-pointer transition-colors"
                    onClick={() => setActiveDetail(act)}
                  >
                    <td className="px-5 py-3.5 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(act.activity_log_id)}
                        onChange={() => toggleSelect(act.activity_log_id)}
                        className="rounded border-gray-300 dark:border-slate-700 bg-white dark:bg-[#1e293b]"
                      />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-gray-450 dark:text-slate-500 text-[11px]">
                      {timeAgo(act.created_at)} ({new Date(act.created_at).toLocaleTimeString()})
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800 dark:text-slate-200">
                          {act.user_name || "System Automated"}
                        </span>
                        {act.user_email && (
                          <span className="text-[10px] text-gray-400 dark:text-slate-550">
                            {act.user_email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {(() => {
                        const info = formatAction(act.action);
                        return (
                          <span className={`inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${info.color}`}>
                            {info.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col min-w-[140px]">
                        <span className="font-medium text-gray-900 dark:text-white capitalize">
                          {act.resource || "General"}
                        </span>
                        {act.resource_id && (
                          <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-400 truncate max-w-[200px]" title={act.resource_id}>
                            {resolveUserDisplay(act.resource_id, users, groups, channelsList, connectorsList)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-sm">
                      {formatMetadata(act, users, groups, channelsList, connectorsList)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination controls footer */}
        {activities.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-800/60 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/10">
            <span className="text-[10px] text-gray-450 dark:text-slate-500">
              Showing offset {offset + 1}-{offset + activities.length} logs
            </span>
            <div className="flex gap-2">
              <button
                disabled={offset === 0 || loadingLogs}
                onClick={() => setOffset(prev => Math.max(0, prev - limit))}
                className="btn-secondary py-1 px-2.5 text-[11px] rounded flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                disabled={!hasMore || loadingLogs}
                onClick={() => setOffset(prev => prev + limit)}
                className="btn-secondary py-1 px-2.5 text-[11px] rounded flex items-center gap-1"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Password Modal */}
      {mounted && deleteModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-5 animate-modal-slide-up">
            <div className="flex items-center gap-3 text-red-500 border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Confirm Log Deletion</h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">Security authorization required</p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 rounded-xl p-3.5 flex gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold text-amber-800 dark:text-amber-400">Warning: Permanent Action</p>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-500/70 leading-relaxed">
                  {deleteType === "all"
                    ? "This will delete every audit activity entry for your entire organization. This action cannot be reversed."
                    : `This will permanently delete the ${selectedIds.size} selected audit log entries. This action cannot be reversed.`
                  }
                </p>
              </div>
            </div>

            <form onSubmit={handleDeleteConfirm} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 dark:text-slate-550 uppercase tracking-wider block">
                  Verify Password to Authorize
                </label>
                <input
                  type="password"
                  placeholder="Enter your account password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input text-xs"
                  required
                  autoFocus
                />
                <p className="text-[10px] text-gray-400 dark:text-slate-500">
                  Confirm with your personal account login password.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setDeleteModalOpen(false); setConfirmPassword(""); }}
                  className="btn-secondary text-xs px-4 py-2 rounded-lg"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-danger bg-red-650 hover:bg-red-700 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Authorize & Delete"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {mounted && activeDetail && createPortal(
        <div 
          onClick={() => setActiveDetail(null)}
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#13151f] h-full w-full max-w-lg shadow-2xl flex flex-col border-l border-gray-150 dark:border-slate-800 animate-slide-in-right"
          >
            
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest block">
                  Audit Event Summary
                </span>
                <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                  {formatAction(activeDetail.action).label}
                </span>
              </div>
              <button
                onClick={() => setActiveDetail(null)}
                className="p-1.5 rounded-lg border border-gray-150 dark:border-slate-800 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Event Pill */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-450 dark:text-slate-400">Action Status</span>
                {(() => {
                  const info = formatAction(activeDetail.action);
                  return (
                    <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${info.color}`}>
                      {info.label}
                    </span>
                  );
                })()}
              </div>

              {/* Actor Details */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  Actor (User)
                </h4>
                <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-slate-800/10 border border-gray-100 dark:border-slate-800/50 p-3 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm uppercase">
                    {(activeDetail.user_name || "S").substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      {activeDetail.user_name || "System Automated"}
                    </p>
                    {activeDetail.user_email && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-550">
                        {activeDetail.user_email}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Timeline details highlighted in dark and light mode */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-indigo-50/80 dark:bg-indigo-500/15 border border-indigo-200/80 dark:border-indigo-500/30 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-500" /> Occurred
                  </span>
                  <span className="text-xs font-bold text-indigo-950 dark:text-indigo-100 block">
                    {timeAgo(activeDetail.created_at)}
                  </span>
                </div>
                <div className="p-3 bg-purple-50/80 dark:bg-purple-500/15 border border-purple-200/80 dark:border-purple-500/30 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-purple-500" /> Timestamp
                  </span>
                  <span className="text-xs font-bold font-mono text-purple-950 dark:text-purple-100 block">
                    {new Date(activeDetail.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Affected Resource */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  Target Resource
                </h4>
                <div className="grid grid-cols-2 gap-3 bg-gray-50/30 dark:bg-slate-800/5 border border-gray-100 dark:border-slate-800/80 p-3 rounded-xl">
                  <div>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 block">Type</span>
                    <span className="text-xs font-semibold capitalize text-gray-800 dark:text-slate-200">
                      {activeDetail.resource || "General"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 block">Resource Name</span>
                    <span className="text-xs font-semibold text-gray-800 dark:text-slate-200 block break-words">
                      {activeDetail.resource_id ? resolveUserDisplay(activeDetail.resource_id, users, groups, channelsList, connectorsList) : "none"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Parsed Metadata changes */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  Changes & Context Details
                </h4>
                <div className="border border-gray-100 dark:border-slate-800/80 rounded-2xl p-4">
                  {formatMetadata(activeDetail, users, groups, channelsList, connectorsList)}
                </div>
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50/50 dark:bg-slate-800/10 grid grid-cols-2 gap-3">
              {(() => {
                const targetPath = getActivityLink(activeDetail);
                if (targetPath) {
                  return (
                    <Link
                      href={targetPath}
                      onClick={() => setActiveDetail(null)}
                      className="btn-primary flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-center text-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Inspect Location
                    </Link>
                  );
                }
                return (
                  <button
                    disabled
                    className="btn-primary py-2.5 rounded-xl font-bold text-xs opacity-50 cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    No Inspect Target
                  </button>
                );
              })()}

              <Link
                href={`/settings/activity/${activeDetail.activity_log_id}`}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-center text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-gray-200 dark:border-slate-700"
              >
                <TerminalSquare className="w-3.5 h-3.5" />
                View Full Details
              </Link>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
