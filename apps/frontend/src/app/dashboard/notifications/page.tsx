"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { 
  Bell, 
  CheckCheck, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Zap, 
  ExternalLink, 
  ArrowLeft, 
  Trash2,
  BellOff,
  Database
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { api } from "@/lib/api";
import MuteDurationModal from "@/components/services/MuteDurationModal";

interface NotifItem {
  id: string;
  incident_id?: string;
  cluster_id?: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  title: string;
  sub: string;
  time: string;
  read: boolean;
  severity: "critical" | "warning" | "info";
  type: "mutation" | "schema" | "system";
  operation?: "INSERT" | "UPDATE" | "DELETE" | string;
  link?: string;
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (isNaN(s)) return "recently";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function getReadNotifIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const saved = localStorage.getItem("sv_read_notifs");
    if (saved) return new Set(JSON.parse(saved));
  } catch {}
  return new Set();
}

function saveReadNotifId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const readSet = getReadNotifIds();
    readSet.add(id);
    localStorage.setItem("sv_read_notifs", JSON.stringify(Array.from(readSet)));
  } catch {}
}

function saveAllReadNotifIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    const readSet = getReadNotifIds();
    ids.forEach((id) => readSet.add(id));
    localStorage.setItem("sv_read_notifs", JSON.stringify(Array.from(readSet)));
  } catch {}
}

function formatPrimaryKey(pk: any): string {
  if (!pk) return "N/A";
  if (typeof pk === "object") {
    try {
      const keys = Object.keys(pk);
      if (keys.length === 1) {
        return `${keys[0]}=${pk[keys[0]]}`;
      }
      return JSON.stringify(pk);
    } catch {
      return "PK";
    }
  }
  return String(pk);
}

async function fetchNotifs(): Promise<NotifItem[]> {
  const readSet = getReadNotifIds();
  try {
    const res = await api.get("/api/db-audit/events");
    const events = res.data.events || [];

    if (events.length > 0) {
      return events.map((ev: any) => {
        const isDelete = ev.operation === "DELETE";
        const isUpdate = ev.operation === "UPDATE";
        const isInsert = ev.operation === "INSERT";

        let icon = Database;
        let color = "text-indigo-500";
        let bg = "bg-indigo-50 dark:bg-indigo-500/10";
        let severity: "critical" | "warning" | "info" = "info";

        if (isDelete) {
          icon = AlertTriangle;
          color = "text-red-500";
          bg = "bg-red-50 dark:bg-red-500/10";
          severity = "critical";
        } else if (isUpdate) {
          icon = Zap;
          color = "text-amber-500";
          bg = "bg-amber-50 dark:bg-amber-500/10";
          severity = "warning";
        } else if (isInsert) {
          icon = CheckCircle;
          color = "text-green-500";
          bg = "bg-green-50 dark:bg-green-500/10";
          severity = "info";
        }

        const id = ev.event_id || ev.id;
        const tableName = ev.table_name || ev.table || "table";
        const dbName = ev.database_name || ev.database || "production_db";
        const schemaName = ev.schema_name || ev.schema || "public";
        const pkDisplay = formatPrimaryKey(ev.primary_key);

        return {
          id,
          icon,
          color,
          bg,
          title: `${ev.operation} on table "${tableName}"`,
          sub: `${dbName} · ${schemaName} · PK: ${pkDisplay}`,
          time: ev.commit_timestamp || ev.created_at || new Date().toISOString(),
          read: readSet.has(id),
          severity,
          type: "mutation",
          operation: ev.operation,
          link: "/dashboard/connectors"
        };
      });
    }

    return [
      {
        id: "sys-ready",
        icon: CheckCircle,
        color: "text-green-500",
        bg: "bg-green-50 dark:bg-green-500/10",
        title: "CDC Audit Stream Active",
        sub: "production_db · public · Replication pipeline active",
        time: new Date().toISOString(),
        read: readSet.has("sys-ready"),
        severity: "info",
        type: "system",
        operation: "SYSTEM",
        link: "/dashboard/connectors"
      }
    ];
  } catch {
    return [];
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifs,  setNotifs]  = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<"all" | "unread" | "crashes" | "resolved">("all");
  const [muted, setMuted] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [isMuteModalOpen, setIsMuteModalOpen] = useState(false);

  const { success } = useToast();
  const { confirm } = useConfirm();

  const checkMute = useCallback(async () => {
    try {
      const res = await api.get("/api/notifications/mute-status");
      setMuted(res.data.muted);
      setMutedUntil(res.data.muted_until);
    } catch {
      // safe swallow
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setNotifs(await fetchNotifs());
    await checkMute();
    setLoading(false);
  }, [checkMute]);

  useEffect(() => {
    load();
  }, [load]);

  // Connect to SSE live updates (matching Srevox real-time streaming)
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sv_token") : null;
    if (!token || (typeof window !== "undefined" && localStorage.getItem("sv_auto_tour_active") === "true")) return;

    const url = `/api/notifications/live?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "notification" || data.type === "connected" || data.event_id) {
          fetchNotifs().then(setNotifs);
          checkMute();
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    eventSource.onerror = () => {
      fetchNotifs().then(setNotifs);
    };

    return () => {
      eventSource.close();
    };
  }, [checkMute]);

  useEffect(() => {
    const handleSync = () => {
      fetchNotifs().then(setNotifs);
      checkMute();
    };
    window.addEventListener("sv_notifications_changed", handleSync);
    return () => {
      window.removeEventListener("sv_notifications_changed", handleSync);
    };
  }, [checkMute]);

  const handleDeleteAll = async () => {
    if (notifs.length === 0) return;
    const { confirmed } = await confirm({
      title: "Clear All Notifications?",
      message: `Are you sure you want to dismiss all ${notifs.length} notifications? This will clear them from your view.`,
      confirmLabel: "Clear All",
      variant: "danger"
    });
    if (!confirmed) return;
    setNotifs([]);
    success("Notifications cleared", "All notifications have been dismissed.");
    window.dispatchEvent(new Event("sv_notifications_changed"));
  };

  const handleDeleteSingle = async (n: NotifItem) => {
    setNotifs(p => p.filter(item => item.id !== n.id));
    success("Notification dismissed", "The notification has been hidden.");
    window.dispatchEvent(new Event("sv_notifications_changed"));
  };

  const markRead = (id: string) => {
    saveReadNotifId(id);
    setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
    window.dispatchEvent(new Event("sv_notifications_changed"));
  };

  const markAllRead = () => {
    const allIds = notifs.map(n => n.id);
    saveAllReadNotifIds(allIds);
    setNotifs(p => p.map(n => ({ ...n, read: true })));
    success("All caught up!", "All notifications marked as read");
    window.dispatchEvent(new Event("sv_notifications_changed"));
  };

  const handleMute = async (minutes: number) => {
    setMuted(true);
    success(minutes === -1 ? "Notifications permanently muted" : `Notifications muted for ${minutes} minutes`);
    window.dispatchEvent(new Event("sv_notifications_changed"));
  };

  const handleUnmute = async () => {
    setMuted(false);
    success("Notifications unmuted");
    window.dispatchEvent(new Event("sv_notifications_changed"));
  };

  const unreadCount = notifs.filter(n => !n.read).length;
  const criticalCount = notifs.filter(n => n.severity === "critical" || n.operation === "DELETE").length;
  const updateCount = notifs.filter(n => n.severity === "warning" || n.operation === "UPDATE" || n.operation === "INSERT").length;

  const filteredNotifs = notifs.filter(n => {
    if (filter === "unread") return !n.read;
    if (filter === "crashes") return n.severity === "critical" || n.operation === "DELETE";
    if (filter === "resolved") return n.severity === "warning" || n.operation === "UPDATE" || n.operation === "INSERT";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Back to Dashboard Link */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors group select-none">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Dashboard
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold px-2.5 py-0.5 rounded-full select-none border border-red-100/60 dark:border-red-500/15 animate-pulse">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
            Real-time database mutation alerts and change tracking updates
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={load} className="btn-secondary text-xs gap-1.5 py-2 px-3 hover:scale-[1.01] transition-transform">
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-primary text-xs gap-1.5 py-2 px-3.5 hover:scale-[1.01] transition-transform">
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
          {notifs.length > 0 && (
            <button onClick={handleDeleteAll} className="btn-danger text-xs gap-1.5 py-2 px-3.5 hover:scale-[1.01] transition-transform">
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Mute Preferences Card */}
      <div className="card p-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl flex items-center justify-between gap-4 shadow-sm select-none animate-modal-slide-up" style={{ animationDuration: "0.2s" }}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${muted ? "bg-amber-50 dark:bg-amber-500/10" : "bg-indigo-50 dark:bg-indigo-500/10"}`}>
            <BellOff className={`w-5 h-5 ${muted ? "text-amber-600 dark:text-amber-400" : "text-indigo-600 dark:text-indigo-400"}`} />
          </div>
          <div>
            <div className="font-bold text-gray-900 dark:text-white text-sm">Silence Notifications</div>
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {muted ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  Muted {mutedUntil ? `until ${new Date(mutedUntil).toLocaleString()}` : "permanently"}
                </span>
              ) : (
                "Receive real-time alerts inside your Srevox workspace"
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {muted && (
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded border border-amber-200 uppercase">
              Muted
            </span>
          )}
          <button
            className={`relative w-9 h-5 rounded-full transition-all duration-200 focus:outline-none ${muted ? "bg-amber-500" : "bg-gray-200 dark:bg-slate-700"}`}
            onClick={async () => {
              if (muted) {
                await handleUnmute();
              } else {
                setIsMuteModalOpen(true);
              }
            }}
          >
            <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm bg-white transition-transform duration-200" style={{ transform: muted ? "translateX(16px)" : "translateX(0px)" }} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div id="notifications-filter-bar" className="flex gap-1.5 border-b border-gray-150 dark:border-slate-800/80 pb-3">
        {[
          { id: "all", label: "All Events", count: notifs.length },
          { id: "unread", label: "Unread", count: unreadCount },
          { id: "crashes", label: "Critical & Deletes", count: criticalCount },
          { id: "resolved", label: "Mutations & Inserts", count: updateCount },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
              filter === t.id
                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                : "text-gray-500 dark:text-slate-400 hover:bg-gray-100/60 dark:hover:bg-slate-800/40 hover:text-gray-800 dark:hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span>{t.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                filter === t.id 
                  ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
              }`}>
                {t.count}
              </span>
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse bg-white dark:bg-[#13151f] border border-gray-100 dark:border-slate-800/60 h-20 rounded-2xl" />
          ))}
        </div>
      ) : filteredNotifs.length === 0 ? (
        <div id="notifications-list-feed" className="card py-20 text-center bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100/50 dark:border-indigo-500/10">
            <Bell className="w-8 h-8 text-indigo-400 dark:text-indigo-500" />
          </div>
          <p className="font-bold text-gray-800 dark:text-slate-200 text-base">All clear here!</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            No notifications match your current filter selection.
          </p>
        </div>
      ) : (
        <div id="notifications-list-feed" className="space-y-3.5">
          {filteredNotifs.map((n) => (
            <div
              key={n.id}
              className={`group flex items-start gap-4 p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden select-none backdrop-blur-sm ${
                !n.read
                  ? "bg-gradient-to-r from-indigo-500/[0.04] to-transparent dark:from-indigo-500/[0.02] border-indigo-100 dark:border-indigo-500/20 shadow-[0_2px_8px_rgba(99,102,241,0.04)]"
                  : "bg-white dark:bg-[#13151f] border-gray-150 dark:border-slate-800/60"
              } hover:border-indigo-300 dark:hover:border-slate-700 hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.25)] hover:scale-[1.003] cursor-pointer`}
              onClick={() => {
                markRead(n.id);
                router.push(n.link || "/dashboard/connectors");
              }}
            >
              {/* Unread Indicator Accent Bar */}
              {!n.read && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500 dark:bg-indigo-400" />
              )}

              {/* Icon Container */}
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 relative shadow-sm border border-gray-100/50 dark:border-slate-800/40 ${
                n.operation === "DELETE" || n.severity === "critical"
                  ? "bg-red-50 dark:bg-red-500/10 text-red-500"
                  : n.operation === "UPDATE" || n.severity === "warning"
                    ? "bg-amber-50 dark:bg-amber-500/10 text-amber-500"
                    : "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
              }`}>
                {!n.read && (n.operation === "DELETE" || n.severity === "critical") && (
                  <span className="absolute -inset-0.5 rounded-xl bg-current opacity-15 animate-ping pointer-events-none" />
                )}
                <n.icon className="w-5.5 h-5.5" />
              </div>

              {/* Main Info */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <p className={`text-sm font-bold tracking-tight ${!n.read ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-slate-400"}`}>
                    {n.title}
                  </p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                    n.operation === "DELETE"
                      ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20"
                      : n.operation === "UPDATE"
                        ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20"
                        : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-500/20"
                  }`}>
                    {n.operation || n.type}
                  </span>
                </div>
                
                {/* Visual Description */}
                <div className="flex flex-wrap gap-2.5 items-center text-[10px] text-gray-500 dark:text-slate-400">
                  <span className="font-semibold px-2 py-1 bg-gray-100 dark:bg-slate-900/60 rounded-lg border border-gray-150 dark:border-slate-800/80">
                    {n.sub}
                  </span>
                </div>
              </div>

              {/* Actions & Timestamp */}
              <div className="flex flex-col items-end gap-3 shrink-0 ml-auto self-stretch justify-between">
                <div className="flex items-center gap-2">
                  {!n.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead(n.id);
                      }}
                      title="Mark as read"
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-150 dark:border-slate-800 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shadow-sm bg-white dark:bg-[#13151f]"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSingle(n);
                    }}
                    title="Delete notification"
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-150 dark:border-slate-800 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors shadow-sm bg-white dark:bg-[#13151f]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium whitespace-nowrap bg-gray-50 dark:bg-slate-900/40 px-2.5 py-1 rounded-full border border-gray-100 dark:border-slate-800/40">
                    {timeAgo(n.time)}
                  </span>
                </div>

                <Link
                  href={n.link || "/dashboard/connectors"}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors group/link bg-indigo-50/50 dark:bg-indigo-500/5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border border-indigo-100/30 dark:border-indigo-500/10 px-3 py-1.5 rounded-xl shadow-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  View in Ledger 
                  <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-0.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mute Duration Modal */}
      <MuteDurationModal
        isOpen={isMuteModalOpen}
        onClose={() => setIsMuteModalOpen(false)}
        onConfirm={async (minutes) => {
          await handleMute(minutes);
          setIsMuteModalOpen(false);
        }}
        title="Mute Workspace Notifications"
      />
    </div>
  );
}
