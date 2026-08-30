"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck, CheckCircle, AlertTriangle, Zap, Clock } from "lucide-react";
import { useToast } from "../Toast";
import { api } from "@/lib/api";

interface NotifItem {
  id: string;
  incident_id: string;
  cluster_id?: string;
  type: "crash" | "resolved" | "system";
  icon: React.ElementType;
  color: string;
  bg: string;
  title: string;
  sub: string;
  read: boolean;
  time: string;
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

async function loadRealNotifications(): Promise<NotifItem[]> {
  if (typeof window !== "undefined" && localStorage.getItem("sv_auto_tour_active") === "true") {
    try {
      const raw = localStorage.getItem("sv_mock_incidents");
      const incidents = raw ? JSON.parse(raw) : [];
      return incidents.map((inc: any) => {
        const id = `${inc.status}-${inc.incident_id}`;
        const isOpen = inc.status === "open";
        const isCrit = inc.severity === "critical";
        return {
          id,
          icon: isOpen ? (isCrit ? Zap : AlertTriangle) : CheckCircle,
          color: isOpen ? (isCrit ? "text-red-500" : "text-amber-500") : "text-green-500",
          bg:    isOpen ? (isCrit ? "bg-red-50 dark:bg-red-500/10" : "bg-amber-50 dark:bg-amber-500/10") : "bg-green-50 dark:bg-green-500/10",
          title: isOpen ? `${inc.pod_name} crashed` : `${inc.pod_name} resolved`,
          sub:   `${inc.crash_reason} · ${inc.namespace} · ${inc.restart_count} restarts`,
          incident_id: inc.incident_id,
          type: isOpen ? "crash" : "resolved",
          time:  inc.first_seen_at,
          read:  false,
        };
      }).filter((x: NotifItem) => x && x.time).sort((a: NotifItem, b: NotifItem) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 15);
    } catch { return []; }
  }

  try {
    const res = await api.get("/api/notifications");
    const notifications = res.data.notifications || [];
    return notifications.map((n: any) => {
      const isOpen = n.type !== "resolved";
      const isCrit = n.severity === "critical";
      return {
        id: n.id,
        incident_id: n.incident_id,
        cluster_id: n.cluster_id,
        type: n.type,
        icon: isOpen ? (isCrit ? Zap : AlertTriangle) : CheckCircle,
        color: isOpen ? (isCrit ? "text-red-500" : "text-amber-500") : "text-green-500",
        bg:    isOpen ? (isCrit ? "bg-red-50 dark:bg-red-500/10" : "bg-amber-50 dark:bg-amber-500/10") : "bg-green-50 dark:bg-green-500/10",
        title: n.title,
        sub:   n.sub,
        read:  n.read,
        time:  n.time,
      };
    });
  } catch {
    return [];
  }
}

let lastNotifFetchTime = 0;

export default function NavbarNotifications() {
  const router = useRouter();
  const { success, error } = useToast();
  const [notifOpen, setNotifOpen] = useState(false);
  const [muteMenuOpen, setMuteMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [muted, setMuted] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const checkMute = useCallback(async () => {
    try {
      const res = await api.get("/api/notifications/mute-status");
      setMuted(res.data.muted);
      setMutedUntil(res.data.muted_until);
    } catch {
      // safe swallow
    }
  }, []);

  const loadNotifs = useCallback(async () => {
    const items = await loadRealNotifications();
    setNotifs(items);
    lastNotifFetchTime = Date.now();
  }, []);

  useEffect(() => {
    loadNotifs();
  }, [loadNotifs]);

  useEffect(() => {
    if (notifOpen) {
      checkMute();
      loadNotifs();
    }
  }, [notifOpen, checkMute, loadNotifs]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sv_token") : null;
    if (!token || (typeof window !== "undefined" && localStorage.getItem("sv_auto_tour_active") === "true")) return;

    const url = `/api/notifications/live?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "notification") {
          loadNotifs();
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    eventSource.onerror = () => {
      loadNotifs();
    };

    return () => {
      eventSource.close();
    };
  }, [loadNotifs]);

  useEffect(() => {
    const handleSync = () => {
      loadNotifs();
      if (notifOpen) {
        checkMute();
      }
    };
    window.addEventListener("sv_notifications_changed", handleSync);
    return () => {
      window.removeEventListener("sv_notifications_changed", handleSync);
    };
  }, [loadNotifs, checkMute, notifOpen]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
        setMuteMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const markRead = async (id: string) => {
    setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await api.post(`/api/notifications/${id}/read`);
      window.dispatchEvent(new Event("sv_notifications_changed"));
    } catch (err) {
      console.error(err);
    }
  };

  const dismissNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifs(p => p.filter(n => n.id !== id));
    try {
      await api.delete(`/api/notifications/${id}`);
      window.dispatchEvent(new Event("sv_notifications_changed"));
      success("Notification dismissed");
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    setNotifs(p => p.map(n => ({ ...n, read: true })));
    try {
      await api.post("/api/notifications/read-all");
      success("All caught up!", "All notifications marked as read");
      window.dispatchEvent(new Event("sv_notifications_changed"));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMute = async (minutes: number) => {
    try {
      await api.post("/api/notifications/mute", { minutes });
      success(minutes === -1 ? "Notifications permanently muted" : `Notifications muted for ${minutes} minutes`);
      loadNotifs();
      setMuteMenuOpen(false);
      window.dispatchEvent(new Event("sv_notifications_changed"));
    } catch {
      error("Failed to mute notifications");
    }
  };

  const handleUnmute = async () => {
    try {
      await api.post("/api/notifications/unmute");
      success("Notifications unmuted");
      loadNotifs();
      window.dispatchEvent(new Event("sv_notifications_changed"));
    } catch {
      error("Failed to unmute notifications");
    }
  };

  const unread = notifs.filter(n => !n.read).length;

  return (
    <div ref={notifRef} className="relative">
      <button onClick={() => setNotifOpen(o => !o)}
        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors relative">
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white dark:border-[#151823]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {notifOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-[#1e2130] border border-gray-100 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 dark:text-white text-sm">Notifications</span>
              {unread > 0 && <span className="text-xs bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">{unread} new</span>}
            </div>
            <div className="flex items-center gap-3">
              {unread > 0 && <button onClick={markAllRead} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"><CheckCheck className="w-3 h-3" />Mark all read</button>}
              <Link href="/dashboard/notifications" onClick={() => setNotifOpen(false)} className="text-xs text-gray-400 dark:text-slate-500 hover:underline">View all</Link>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-slate-700/50">
            {notifs.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-gray-50 dark:bg-slate-800/40 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6 text-gray-350 dark:text-slate-650" />
                </div>
                <p className="text-sm text-gray-500 dark:text-slate-500 font-medium">All clear! No incidents.</p>
                <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">Notifications appear here when pods crash</p>
              </div>
            ) : notifs.map(n => (
              <div key={n.id}
                className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors group ${!n.read ? "bg-indigo-50/40 dark:bg-indigo-500/5" : ""} hover:bg-gray-50 dark:hover:bg-slate-800/50`}
                onClick={() => {
                  markRead(n.id);
                  setNotifOpen(false);
                  if (n.type === "crash" || n.type === "resolved") {
                    router.push(`/dashboard/incidents/${n.incident_id}`);
                  } else if (n.cluster_id) {
                    router.push(`/cluster/${n.cluster_id}`);
                  } else {
                    success("Incident detail is no longer available.");
                  }
                }}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${n.bg}`}>
                  <n.icon className={`w-4 h-4 ${n.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight truncate ${!n.read ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-slate-400"}`}>{n.title}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">{n.sub}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 select-none">
                  {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                  <span className="text-[10px] text-gray-400 dark:text-slate-500">{timeAgo(n.time)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
            <Link href="/dashboard/notifications" onClick={() => setNotifOpen(false)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center justify-center gap-1">
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
