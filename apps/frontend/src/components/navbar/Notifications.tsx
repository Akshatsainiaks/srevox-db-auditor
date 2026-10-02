"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck, CheckCircle, AlertTriangle, Zap, Database, ArrowRight } from "lucide-react";
import { useToast } from "../Toast";
import { api } from "@/lib/api";

interface NotifItem {
  id: string;
  type: "mutation" | "schema" | "pii" | "system" | "retention";
  icon: React.ElementType;
  color: string;
  bg: string;
  title: string;
  sub: string;
  read: boolean;
  time: string;
  link?: string;
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
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

async function loadRealNotifications(): Promise<NotifItem[]> {
  const readSet = getReadNotifIds();
  try {
    const res = await api.get("/api/db-audit/events");
    const events = res.data.events || [];

    if (events.length > 0) {
      return events.slice(0, 15).map((ev: any) => {
        const isDelete = ev.operation === "DELETE";
        const isUpdate = ev.operation === "UPDATE";
        const isInsert = ev.operation === "INSERT";

        let icon = Database;
        let color = "text-indigo-500";
        let bg = "bg-indigo-50 dark:bg-indigo-500/10";

        if (isDelete) {
          icon = AlertTriangle;
          color = "text-rose-500";
          bg = "bg-rose-50 dark:bg-rose-500/10";
        } else if (isUpdate) {
          icon = Zap;
          color = "text-amber-500";
          bg = "bg-amber-50 dark:bg-amber-500/10";
        } else if (isInsert) {
          icon = CheckCircle;
          color = "text-emerald-500";
          bg = "bg-emerald-50 dark:bg-emerald-500/10";
        }

        const id = ev.event_id || ev.id;
        const tableName = ev.table_name || ev.table || "table";
        const dbName = ev.database_name || ev.database || "production_db";
        const schemaName = ev.schema_name || ev.schema || "public";
        const pkDisplay = formatPrimaryKey(ev.primary_key);

        return {
          id,
          type: "mutation",
          icon,
          color,
          bg,
          title: `${ev.operation} on ${tableName}`,
          sub: `${dbName} · ${schemaName} · PK: ${pkDisplay}`,
          read: readSet.has(id),
          time: ev.commit_timestamp || ev.created_at || new Date().toISOString(),
          link: "/dashboard/connectors",
        };
      });
    }

    return [
      {
        id: "sys-ready",
        type: "system",
        icon: CheckCircle,
        color: "text-emerald-500",
        bg: "bg-emerald-50 dark:bg-emerald-500/10",
        title: "CDC Audit Stream Active",
        sub: "Replication pipeline is monitoring connected databases for mutations.",
        read: readSet.has("sys-ready"),
        time: new Date().toISOString(),
        link: "/dashboard/connectors",
      },
    ];
  } catch {
    return [];
  }
}

export default function NavbarNotifications() {
  const router = useRouter();
  const { success } = useToast();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    const list = await loadRealNotifications();
    setNotifs(list);
  }, []);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  // Connect to SSE live stream for real-time notification pushes (same as Srevox)
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sv_token") : null;
    if (!token || (typeof window !== "undefined" && localStorage.getItem("sv_auto_tour_active") === "true")) return;

    const url = `/api/notifications/live?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "notification" || data.type === "connected" || data.event_id) {
          fetchNotifs();
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    eventSource.onerror = () => {
      fetchNotifs();
    };

    return () => {
      eventSource.close();
    };
  }, [fetchNotifs]);

  useEffect(() => {
    const handleSync = () => {
      fetchNotifs();
    };
    window.addEventListener("sv_notifications_changed", handleSync);
    return () => {
      window.removeEventListener("sv_notifications_changed", handleSync);
    };
  }, [fetchNotifs]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;

  const markRead = (id: string) => {
    saveReadNotifId(id);
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    window.dispatchEvent(new Event("sv_notifications_changed"));
  };

  const markAllRead = () => {
    const allIds = notifs.map((n) => n.id);
    saveAllReadNotifIds(allIds);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    success("All marked as read", "Notifications updated");
    window.dispatchEvent(new Event("sv_notifications_changed"));
  };

  return (
    <div className="relative" ref={notifRef}>
      <button
        onClick={() => setNotifOpen(!notifOpen)}
        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors relative cursor-pointer"
        title="Audit Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white dark:border-[#151823]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {notifOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800 shadow-2xl z-50 animate-modal-slide-up overflow-hidden select-none">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 dark:text-white text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <Link
                href="/dashboard/notifications"
                onClick={() => setNotifOpen(false)}
                className="text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title="Open notifications page"
              >
                View all
              </Link>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-slate-800/60">
            {notifs.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-400" />
                <p className="text-xs font-semibold text-gray-600 dark:text-slate-300">All caught up!</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Notifications appear here when database changes occur</p>
              </div>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    markRead(n.id);
                    setNotifOpen(false);
                    router.push(n.link || "/dashboard/connectors");
                  }}
                  className={`p-3.5 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group relative ${
                    !n.read ? "bg-indigo-50/20 dark:bg-indigo-500/5" : ""
                  }`}
                >
                  {!n.read && (
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-indigo-500" />
                  )}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.bg}`}>
                    <n.icon className={`w-4 h-4 ${n.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${!n.read ? "font-bold text-gray-900 dark:text-white" : "font-medium text-gray-700 dark:text-slate-300"}`}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
                      {n.sub}
                    </p>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 block">
                      {timeAgo(n.time)}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover:text-indigo-500 shrink-0 self-center transition-colors group-hover:translate-x-0.5" />
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50/50 dark:bg-[#11131a] text-center">
            <Link
              href="/dashboard/notifications"
              onClick={() => setNotifOpen(false)}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center justify-center gap-1.5 py-1"
            >
              <span>View all notifications →</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
