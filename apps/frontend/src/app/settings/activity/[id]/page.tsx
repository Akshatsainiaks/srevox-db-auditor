"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, TerminalSquare, Loader2, Key, Calendar, Users, 
  ShieldAlert, Clock, Lock, ExternalLink, Activity, Info, AlertCircle
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

const formatAction = (action: string) => {
  switch (action) {
    case "service_created": return { label: "Service Registered", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100/50" };
    case "service_updated": return { label: "Service Config Updated", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100/50" };
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

export default function ActivityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const me = getUser();
  const isAdmin = me?.role === "admin";
  const canView = hasPermission(me, "viewActivityLog");

  const { success, error: toastError } = useToast();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Authentication State
  const [sudoVerified, setSudoVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sudoToken, setSudoToken] = useState<string | null>(null);

  // Target log item state
  const [activity, setActivity] = useState<ActivityLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [groupsList, setGroupsList] = useState<any[]>([]);
  const [servicesList, setServicesList] = useState<any[]>([]);
  const [channelsList, setChannelsList] = useState<any[]>([]);
  const [resourceAlertsList, setResourceAlertsList] = useState<any[]>([]);
  const [clustersList, setClustersList] = useState<any[]>([]);
  const [rulesList, setRulesList] = useState<any[]>([]);

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

  // Fetch list metadata for ID resolution
  useEffect(() => {
    if (!canView) return;
    api.get("/api/users").then(res => setUsersList(res.data.users || [])).catch(console.error);
    api.get("/api/groups").then(res => setGroupsList(res.data.groups || [])).catch(console.error);
    api.get("/api/service-owners").then(res => setServicesList(res.data.service_owners || [])).catch(console.error);
    api.get("/api/channels").then(res => setChannelsList(res.data.channels || [])).catch(console.error);
    api.get("/api/resource-alerts").then(res => setResourceAlertsList(res.data.alerts || [])).catch(console.error);
    api.get("/api/clusters").then(res => setClustersList(res.data.clusters || [])).catch(console.error);
    api.get("/api/alert-rules").then(res => setRulesList(res.data.rules || [])).catch(console.error);
  }, [canView]);

  // Fetch target activity detail
  const loadTargetActivity = async () => {
    if (!sudoToken || !id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/activities?activity_id=${id}`, {
        headers: {
          "X-Sudo-Token": sudoToken,
          "Content-Type": "application/json"
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
      if (items.length > 0) {
        const act = items[0];
        let meta = act.metadata;
        if (typeof meta === "string") {
          try {
            meta = JSON.parse(meta);
          } catch (e) {}
        }
        if (typeof meta === "string") {
          try {
            meta = JSON.parse(meta);
          } catch (e) {}
        }
        act.metadata = meta;
        setActivity(act);
      } else {
        setActivity(null);
      }
    } catch (err) {
      console.error(err);
      toastError("Failed to fetch activity log details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sudoVerified) {
      loadTargetActivity();
    }
  }, [sudoVerified, id]);

  const verifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setVerifying(true);
    try {
      const res = await api.post("/api/auth/verify-password", { password });
      if (res.data.success && res.data.sudo_token) {
        setSudoToken(res.data.sudo_token);
        setSudoVerified(true);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("srevox_sudo_token", res.data.sudo_token);
          sessionStorage.setItem("srevox_sudo_last_activity", Date.now().toString());
        }
        lastActivityRef.current = Date.now();
        success("Audit logs unlocked", "Sudo mode activated successfully.");
      }
    } catch (err: any) {
      toastError(err?.response?.data?.detail || "Incorrect password. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const getActivityLink = (act: ActivityLog) => {
    if (act.action.includes("service") && act.resource_id) {
      return `/dashboard/services/${act.resource_id}`;
    }
    if (act.action.includes("incident") || act.action === "alert_sent") {
      return "/dashboard/incidents";
    }
    if (act.action.includes("channel")) {
      return "/settings/channels";
    }
    if (act.action.includes("user") || act.action.includes("team")) {
      return "/settings/team";
    }
    if (act.action.includes("group")) {
      return "/settings/groups";
    }
    if (act.action.includes("org")) {
      return "/settings/org";
    }
    return null;
  };

  const getUserDisplay = (val: any): string => {
    if (typeof val !== "string") return JSON.stringify(val);
    if (val.startsWith("usr")) {
      const matched = usersList.find(u => u.user_id === val);
      return matched ? `${matched.full_name} (${matched.email})` : val;
    }
    if (val.startsWith("grp")) {
      const matched = groupsList.find(g => g.group_id === val);
      return matched ? `Group: ${matched.name}` : val;
    }
    if (val.startsWith("srv")) {
      const matched = servicesList.find(s => s.service_owner_id === val);
      return matched ? `Service: ${matched.name}` : val;
    }
    if (val.startsWith("cha")) {
      const matched = channelsList.find(c => c.channel_id === val);
      return matched ? `Channel: ${matched.name}` : val;
    }
    if (val.startsWith("ral")) {
      const matched = resourceAlertsList.find(r => r.resource_alert_id === val);
      return matched ? `Threshold Rule: ${matched.resource_type.toUpperCase()} > ${matched.threshold_pct}%` : val;
    }
    if (val.startsWith("cls")) {
      const matched = clustersList.find(c => c.cluster_id === val);
      return matched ? `Cluster: ${matched.name}` : val;
    }
    if (val.startsWith("rul")) {
      const matched = rulesList.find(r => r.rule_id === val);
      return matched ? `Alert Rule: ${matched.name}` : val;
    }
    return val;
  };

  const formatMetadataDisplay = (act: ActivityLog) => {
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
          <div className="text-xs text-gray-600 dark:text-slate-400 font-medium">
            Accessed URL <span className="font-semibold text-indigo-500 dark:text-indigo-400 font-mono">{meta.path}</span>
          </div>
        );
      }
    }

    if (meta.changes) {
      return (
        <div className="space-y-4">
          {Object.entries(meta.changes).map(([field, delta]: [string, any]) => {
            const oldVal = delta && delta.old !== undefined ? getDisplayValue(delta.old) : "none";
            const newVal = delta && delta.new !== undefined ? getDisplayValue(delta.new) : "none";
            return (
              <div key={field} className="space-y-2">
                <span className="text-xs font-bold text-gray-800 dark:text-slate-200 capitalize">
                  {field.replace(/_/g, " ")} Modification
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Old Value Card */}
                  <div className="p-3.5 bg-red-50/70 dark:bg-red-500/10 border border-red-200/70 dark:border-red-500/20 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider block">
                      Previous / Old Value
                    </span>
                    <span className="text-xs font-bold font-mono text-red-900 dark:text-red-300 block break-all">
                      {oldVal}
                    </span>
                  </div>

                  {/* New Value Card */}
                  <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                      Updated / New Value
                    </span>
                    <span className="text-xs font-bold font-mono text-emerald-900 dark:text-emerald-300 block break-all">
                      {newVal}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    const hasOldNew = (meta.old_value !== undefined && meta.new_value !== undefined) || (meta.old !== undefined && meta.new !== undefined) || (meta.previous !== undefined && meta.current !== undefined);
    
    if (hasOldNew) {
      const oldVal = getDisplayValue(meta.old_value ?? meta.old ?? meta.previous);
      const newVal = getDisplayValue(meta.new_value ?? meta.new ?? meta.current);
      return (
        <div className="space-y-2">
          <span className="text-xs font-bold text-gray-800 dark:text-slate-200 capitalize">
            State Modification
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Old Value Card */}
            <div className="p-3.5 bg-red-50/70 dark:bg-red-500/10 border border-red-200/70 dark:border-red-500/20 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider block">
                Previous / Old Value
              </span>
              <span className="text-xs font-bold font-mono text-red-900 dark:text-red-300 block break-all">
                {oldVal}
              </span>
            </div>

            {/* New Value Card */}
            <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                Updated / New Value
              </span>
              <span className="text-xs font-bold font-mono text-emerald-900 dark:text-emerald-300 block break-all">
                {newVal}
              </span>
            </div>
          </div>
        </div>
      );
    }

    const details: string[] = [];
    Object.entries(meta).forEach(([key, val]) => {
      if (key !== "ip" && key !== "user_agent" && key !== "path") {
        details.push(`${key}: ${getDisplayValue(val)}`);
      }
    });

    if (details.length > 0) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {details.map((det, index) => {
            const parts = det.split(": ");
            return (
              <div key={index} className="p-3 bg-slate-50 dark:bg-slate-900/35 border border-gray-150 dark:border-slate-800/40 rounded-xl">
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-550 uppercase tracking-wider block capitalize">{parts[0].replace(/_/g, " ")}</span>
                <span className="text-xs font-bold text-gray-800 dark:text-slate-300 mt-0.5 block">{parts[1]}</span>
              </div>
            );
          })}
        </div>
      );
    }

    return <span className="text-xs text-gray-400 dark:text-slate-500">No properties recorded</span>;
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-555 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permissions (`viewActivityLog`) to read organization audit logs.
        </p>
      </div>
    );
  }

  if (!sudoVerified) {
    return (
      <div className="flex items-center justify-center min-h-[55vh] px-4 animate-fade-in">
        <form onSubmit={verifyPassword} className="max-w-md w-full bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 p-8 rounded-3xl shadow-xl space-y-6">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto text-indigo-500">
            <Lock className="w-6 h-6" />
          </div>
          
          <div className="text-center space-y-1.5">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Security Verification</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs mx-auto">
              Please verify your account password to unlock dedicated activity log details.
            </p>
          </div>

          {/* Account Password Helper Box */}
          <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/20 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-300">
              <Key className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Password Guidance</span>
            </div>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed">
              Enter your account password. You can manage or update your password anytime in Profile Settings.
            </p>
            <div className="pt-1">
              <Link
                href="/settings/profile"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Manage Profile & Password &rarr;
              </Link>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Confirm Password</label>
            <input
              type="password"
              placeholder="Enter your account password"
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
              "Unlock Details"
            )}
          </button>
        </form>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="space-y-6 w-full">
        <Link href="/settings/activity" className="inline-flex items-center gap-1 text-xs text-indigo-650 dark:text-indigo-400 hover:underline mb-4 font-semibold">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Activity Logs
        </Link>
        <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-8 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-red-500 mx-auto" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Activity Not Found</h3>
          <p className="text-xs text-gray-555 dark:text-slate-400 max-w-sm mx-auto">
            The target activity identifier does not exist or belongs to another organization workspace.
          </p>
        </div>
      </div>
    );
  }

  const actionInfo = formatAction(activity.action);
  const targetPath = getActivityLink(activity);

  const rawIp = (activity.metadata as any)?.ip || "";
  const isLoopback = !rawIp || rawIp === "127.0.0.1" || rawIp === "::1" || rawIp === "0.0.0.0" || rawIp === "localhost";
  const displayIp = isLoopback ? (typeof window !== "undefined" ? window.location.hostname : "127.0.0.1") : rawIp;

  return (
    <div className="space-y-6 w-full animate-fade-in">
      {/* Back button */}
      <div>
        <Link href="/settings/activity" className="inline-flex items-center gap-1.5 text-xs text-indigo-650 dark:text-indigo-400 hover:underline font-bold">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Activity Logs
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
            <TerminalSquare className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-550 uppercase tracking-widest block">Audit Event Log</span>
            <h1 className="text-base font-extrabold text-gray-900 dark:text-white mt-0.5">
              {actionInfo.label}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${actionInfo.color}`}>
            {actionInfo.label}
          </span>
          {targetPath ? (
            <Link
              href={targetPath}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Inspect Affected Page
            </Link>
          ) : (
            <span className="text-[10px] text-gray-400 dark:text-slate-550 bg-slate-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 px-3 py-1.5 rounded-lg">
              No Inspectable Target
            </span>
          )}
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

      {/* Two Column Grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Properties / Diff Summary */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Properties summary card */}
          <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800/60">
              <Activity className="w-4 h-4 text-indigo-500" />
              Activity Properties & Changes
            </h3>
            <div className="space-y-4">
              {formatMetadataDisplay(activity)}
            </div>
          </div>

        </div>

        {/* Right Column: User Actor & Context Metadata */}
        <div className="space-y-6">
          
          {/* User Actor card */}
          <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800/60">
              <Users className="w-4 h-4 text-indigo-500" />
              User Context
            </h3>

            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-955/60 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-sm shrink-0 border border-indigo-100/40">
                {(activity.user_name || "S").substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-gray-900 dark:text-white text-xs block truncate">
                  {activity.user_name || "System Automated"}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500 block truncate">
                  {activity.user_email || "System daemon runner"}
                </span>
              </div>
            </div>

            <div className="space-y-3.5 pt-3 border-t border-gray-100 dark:border-slate-800/60 text-[11px] leading-relaxed">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-400 dark:text-slate-550 shrink-0">User Identity</span>
                <span className="font-semibold text-gray-800 dark:text-slate-300 text-right truncate">
                  {activity.user_id ? (
                    (() => {
                      const matched = usersList.find(u => u.user_id === activity.user_id);
                      return matched ? `${matched.full_name} (${matched.email})` : (activity.user_name || activity.user_email || "User");
                    })()
                  ) : (
                    "System Automated"
                  )}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-400 dark:text-slate-550">Client IP Address</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-slate-300 select-all">
                  {displayIp}
                </span>
              </div>
              
              <div className="space-y-1">
                <span className="text-gray-400 dark:text-slate-550 block">User Agent</span>
                <span className="font-mono font-medium text-gray-650 dark:text-slate-450 block text-[10px] break-all bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800/40 leading-normal">
                  {(activity.metadata as any)?.user_agent || "Srevox daemon agent"}
                </span>
              </div>
            </div>
          </div>

          {/* Time Context card */}
          <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800/60">
              <Clock className="w-4 h-4 text-indigo-500" />
              Event Timeline
            </h3>

            <div className="space-y-3.5 text-[11px] leading-relaxed">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 dark:text-slate-550">Relative Time</span>
                <span className="font-semibold text-gray-800 dark:text-slate-300 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-500" />
                  {timeAgo(activity.created_at)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400 dark:text-slate-550">Logged At</span>
                <span className="font-semibold text-gray-800 dark:text-slate-300">
                  {new Date(activity.created_at).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400 dark:text-slate-550">Affected Resource</span>
                <span className="font-semibold text-gray-850 dark:text-slate-300">
                  {activity.resource || "General"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-400 dark:text-slate-550 shrink-0">Affected Resource Name</span>
                <span className="font-semibold text-gray-800 dark:text-slate-300 text-right leading-tight break-all">
                  {activity.resource_id ? (
                    (() => {
                      const display = getUserDisplay(activity.resource_id);
                      return display;
                    })()
                  ) : (
                    "none"
                  )}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
