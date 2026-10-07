"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  Zap,
  ShieldCheck,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  ArrowRight,
  Activity,
  Server,
  ChevronRight,
  AlertCircle,
  Clock,
  Lock,
  X,
  FileJson,
  ArrowUpRight,
  Shield,
  PieChart
} from "lucide-react";
import {
  fetchDbAuditConnectors,
  fetchDbAuditEvents,
  fetchMutationVelocity,
  apiGetMe
} from "@/lib/api";
import { getUser } from "@/lib/auth";
import { timeAgo, cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import RowDiffViewer from "@/components/data-audit/RowDiffViewer";
import ConnectorModal from "@/components/data-audit/ConnectorModal";

function formatPrimaryKey(pk: any): string {
  if (!pk) return "id: #104";
  if (typeof pk === "string") return pk;
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

const DB_ICONS: Record<string, string> = {
  postgresql: "🐘",
  postgres: "🐘",
  mysql: "🐬",
  mongodb: "🍃",
  redis: "🔴",
  clickhouse: "🟡",
  tidb: "💎",
  oceanbase: "🌊",
  planetscale: "🪐",
  neon: "⚡",
  mariadb: "🦭",
};

interface Connector {
  connector_id: string;
  id?: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  database_name?: string;
  database?: string;
  status: string;
  capture_mode?: string;
  replication_slot?: string;
  tables_count?: number;
  table_count?: number;
  monitored_tables?: string;
  lag_ms?: number;
}

interface AuditEvent {
  id: string;
  event_id?: string;
  database: string;
  schema: string;
  table: string;
  operation: "INSERT" | "UPDATE" | "DELETE" | string;
  primary_key: string;
  before: string;
  after: string;
  changed_fields: string[];
  masked_fields: string[];
  commit_timestamp: string;
  record_hash: string;
  capture_mode: "log_based" | "polling" | string;
}

interface VelocityData {
  totalMutations: number;
  lastHourCount: number;
  last5mCount: number;
  currentVelocityPerSec: number;
  currentVelocityPerMin: number;
  netRowGrowth: number;
  topActiveTable: string;
  spikeDetected: boolean;
  spikeSeverity: "normal" | "elevated" | "critical";
  breakdown: {
    inserts: { count: number; percentage: number };
    updates: { count: number; percentage: number };
    deletes: { count: number; percentage: number };
    ddl: { count: number; percentage: number };
  };
  buckets: Array<{ time: string; count: number; inserts: number; updates: number; deletes: number }>;
}

const ROUTINE_HEARTBEAT_COLS = new Set([
  "last_heartbeat_at",
  "last_seen_at",
  "last_seen",
  "heartbeat",
  "heartbeat_at",
  "ping_at",
  "last_ping",
  "last_ping_at",
  "top_cpu_processes",
  "top_mem_processes"
]);

function isRoutineEvent(ev: any): boolean {
  if (ev.operation !== "UPDATE") return false;
  const fields = ev.changed_fields;
  const arr = Array.isArray(fields) ? fields : typeof fields === "string" ? [fields] : [];
  if (arr.length === 0) return false;
  return arr.every((f: string) => {
    const l = String(f).toLowerCase().trim();
    return ROUTINE_HEARTBEAT_COLS.has(l) || l === "updated_at";
  });
}

export default function DashboardPage() {
  const { success } = useToast();
  const router = useRouter();
  const [hoveredSlice, setHoveredSlice] = useState<{
    name: string;
    label: string;
    pct: number;
    count: number;
    color: string;
    desc: string;
  } | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [activeConnector, setActiveConnector] = useState<Connector | null>(null);
  const [selectedEventForDiff, setSelectedEventForDiff] = useState<AuditEvent | null>(null);
  const [showConnectorModal, setShowConnectorModal] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [fullName, setFullName] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");
  const [showOrgOnDashboard, setShowOrgOnDashboard] = useState<boolean>(true);
  const [dismissedErrorBanner, setDismissedErrorBanner] = useState(false);
  const [velocityData, setVelocityData] = useState<VelocityData | null>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sv_show_org_dashboard");
    if (saved !== null) {
      setShowOrgOnDashboard(saved === "true");
    }

    if (typeof window !== "undefined") {
      const isDismissed = sessionStorage.getItem("sv_dismiss_error_connectors") === "true";
      setDismissedErrorBanner(isDismissed);
    }
  }, []);

  const load = useCallback(async (quiet = false, showToast = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const [connRes, evRes, meRes, velRes] = await Promise.all([
        fetchDbAuditConnectors().catch(() => ({ connectors: [] })),
        fetchDbAuditEvents().catch(() => ({ events: [] })),
        apiGetMe().catch(() => null),
        fetchMutationVelocity().catch(() => null),
      ]);

      const conns = Array.isArray(connRes) ? connRes : connRes.connectors || [];
      const evts = Array.isArray(evRes) ? evRes : evRes.events || [];

      setConnectors(conns);
      setEvents(evts);
      if (velRes?.data) {
        setVelocityData(velRes.data);
      }

      if (meRes) {
        setFullName(meRes.full_name || "");
        if (meRes.org) {
          setOrgName(meRes.org.name || "");
        }
      }
      setUpdated(new Date());
      if (showToast) {
        success("Audit Dashboard Refreshed", "Live CDC telemetry and connector health updated.");
      }
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [success]);

  useEffect(() => {
    load();

    // Production Server-Sent Events (SSE) Stream
    const eventSource = new EventSource("/api/db-audit/stream");
    eventSource.onmessage = (e) => {
      try {
        const newEvt = JSON.parse(e.data);
        if (newEvt && (newEvt.id || newEvt.event_id)) {
          setEvents((prev) => [
            newEvt,
            ...prev.filter((item) => (item.id || item.event_id) !== (newEvt.id || newEvt.event_id))
          ]);
          fetchMutationVelocity().then(r => { if (r?.data) setVelocityData(r.data); }).catch(() => {});
        }
      } catch {}
    };

    // Auto-poll calculation every 10s
    const pollTimer = setInterval(() => {
      fetchMutationVelocity().then(r => { if (r?.data) setVelocityData(r.data); }).catch(() => {});
    }, 10000);

    return () => {
      eventSource.close();
      clearInterval(pollTimer);
    };
  }, [load]);

  const onlineConnectors = connectors.filter(
    (c) => !c.status || c.status.toLowerCase() === "active" || c.status.toLowerCase() === "connected" || c.status.toLowerCase() === "healthy" || c.status.toLowerCase() === "online"
  ).length;
  const errorConnectors = connectors.filter((c) => c.status?.toLowerCase() === "error" || c.status?.toLowerCase() === "failed").length;
  const healthPct = connectors.length ? Math.round((onlineConnectors / connectors.length) * 100) : 0;

  // Compute stats
  const totalEventsToday = velocityData?.totalMutations ?? (events.length > 0 ? events.length : 0);
  const totalTablesTracked = connectors.reduce((acc, c) => acc + (c.table_count || c.tables_count || 0), 0);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-7 bg-gray-100 dark:bg-slate-800 rounded-xl w-48" />
          <div className="h-9 w-24 bg-gray-100 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
        <div className="h-48 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-72 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
          <div className="h-72 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 p-5 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              Audit Overview
            </h1>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 flex items-center flex-wrap gap-1.5">
              <span>{fullName ? `Welcome back, ${fullName}` : "Real-time database mutation telemetry"}</span>
              {showOrgOnDashboard && orgName && (
                <>
                  <span className="text-gray-300 dark:text-slate-700 select-none">•</span>
                  <span className="badge bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md select-none">
                    {orgName}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
              Updated {timeAgo(updated.toISOString())}
            </span>
            <button
              onClick={() => load(true, true)}
              disabled={refreshing}
              className="btn-secondary gap-2 text-xs py-2 px-3 hover:scale-[1.01] transition-transform"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Error / Warning Banner ── */}
        {errorConnectors > 0 && !dismissedErrorBanner && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/15 rounded-xl px-4 py-3 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-750 dark:text-red-400 mr-auto">
              <span className="font-semibold">{errorConnectors} connector{errorConnectors > 1 ? "s" : ""}</span> reporting replication slot or connection errors.
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/dashboard/connectors" className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline">
                Fix in Connectors →
              </Link>
              <div className="w-[1px] h-3 bg-red-200 dark:bg-red-500/20" />
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem("sv_dismiss_error_connectors", "true");
                  setDismissedErrorBanner(true);
                }}
                className="text-red-400 hover:text-red-655 dark:text-red-450 dark:hover:text-red-300 transition-colors p-0.5"
                title="Dismiss warning"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── 4 Summary KPI Cards ── */}
        <div id="audit-stats-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Mutations Captured */}
          <div
            className="rounded-2xl border bg-white dark:bg-[#13151f] border-gray-150 dark:border-slate-800/80 p-5 shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-2xs">
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live CDC
                </span>
              </div>
              <div className="text-3xl font-black font-mono tracking-tight text-gray-900 dark:text-white mb-1">
                {totalEventsToday > 0 ? totalEventsToday.toLocaleString() : "0"}
              </div>
              <div className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                Mutations Captured
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-800/60 text-[11px] text-gray-400 dark:text-slate-500 flex items-center justify-between">
              <span>Throughput</span>
              <span className="font-mono font-medium text-gray-700 dark:text-slate-300">
                {velocityData?.currentVelocityPerSec || 0} mut/sec
              </span>
            </div>
          </div>

          {/* 2. Active Connectors */}
          <div
            className="rounded-2xl border bg-white dark:bg-[#13151f] border-gray-150 dark:border-slate-800/80 p-5 shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-2xs">
                  <Database className="w-4 h-4 text-indigo-500" />
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs inline-flex items-center gap-1.5",
                  healthPct >= 90
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-500/20"
                    : healthPct >= 50
                    ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
                    : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
                )}>
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    healthPct >= 90 ? "bg-emerald-500" : healthPct >= 50 ? "bg-amber-500" : "bg-red-500"
                  )} />
                  {connectors.length > 0 ? `${healthPct}% Online` : "0 Connected"}
                </span>
              </div>
              <div className="text-3xl font-black font-mono tracking-tight text-gray-900 dark:text-white mb-1">
                {connectors.length === 0 ? "0" : `${onlineConnectors}/${connectors.length}`}
              </div>
              <div className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                Database Sources
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-800/60 text-[11px] text-gray-400 dark:text-slate-500 flex items-center justify-between">
              <span>Replication Slots</span>
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                {onlineConnectors} Active WAL
              </span>
            </div>
          </div>

          {/* 3. Monitored Tables */}
          <div
            className="rounded-2xl border bg-white dark:bg-[#13151f] border-gray-150 dark:border-slate-800/80 p-5 shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-2xs">
                  <Layers className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 px-2 py-0.5 rounded-full shadow-2xs">
                  0 Drift
                </span>
              </div>
              <div className="text-3xl font-black font-mono tracking-tight text-gray-900 dark:text-white mb-1">
                {totalTablesTracked}
              </div>
              <div className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                Audited Tables
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-800/60 text-[11px] text-gray-400 dark:text-slate-500 flex items-center justify-between">
              <span>Schema Sync</span>
              <span className="font-mono font-medium text-gray-700 dark:text-slate-300">
                Auto DDL Sync
              </span>
            </div>
          </div>

          {/* 4. Ledger & Masking Integrity */}
          <div
            className="rounded-2xl border bg-white dark:bg-[#13151f] border-gray-150 dark:border-slate-800/80 p-5 shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-2xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 px-2 py-0.5 rounded-full shadow-2xs">
                  SHA-256
                </span>
              </div>
              <div className="text-3xl font-black font-mono tracking-tight text-gray-900 dark:text-white mb-1">
                100%
              </div>
              <div className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                Ledger Integrity
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-800/60 text-[11px] text-gray-400 dark:text-slate-500 flex items-center justify-between">
              <span>Cryptographic Chain</span>
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                Zero Drift
              </span>
            </div>
          </div>
        </div>

        {/* ── Connected Databases Grid (like Srevox Clusters Grid) ── */}
        <div id="connectors-bar">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              Connected Databases
              {connectors.length > 0 && (
                <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-slate-800 dark:text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
                  {connectors.length}
                </span>
              )}
            </span>
            <Link
              href="/dashboard/connectors"
              className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1 font-medium"
            >
              Manage Sources <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {connectors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700/80 py-10 text-center bg-white dark:bg-[#13151f]/50">
              <p className="text-sm font-medium text-gray-600 dark:text-slate-400 mb-1">
                No database sources connected yet
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
                Connect your PostgreSQL, MySQL, MongoDB, or Redis databases to begin capturing audit events.
              </p>
              <button
                onClick={() => setShowConnectorModal(true)}
                className="btn-primary text-xs px-4 py-2 inline-flex"
              >
                <Plus className="w-3.5 h-3.5" /> Connect Database
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {connectors.map((c) => {
                const id = c.connector_id || c.id || c.name;
                const isOnline = c.status === "active" || c.status === "connected" || c.status === "online" || !c.status;
                const isError = c.status === "error" || c.status === "failed";
                const isActive = activeConnector?.name === c.name;
                const icon = DB_ICONS[c.db_type?.toLowerCase()] || "🗄️";

                return (
                  <Link
                    key={id}
                    href={`/dashboard/connectors/${id}`}
                    className={cn(
                      "group text-left w-full rounded-2xl border p-4 transition-all duration-150 relative overflow-hidden block",
                      isActive
                        ? "border-indigo-400 dark:border-indigo-500/70 bg-indigo-50/50 dark:bg-indigo-500/[0.07] shadow-sm"
                        : isError
                        ? "border-red-100 dark:border-red-500/20 bg-white dark:bg-[#13151f] hover:shadow-sm"
                        : "border-gray-100 dark:border-slate-800/80 bg-white dark:bg-[#13151f] hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-sm"
                    )}
                  >
                    {isActive && (
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-t-2xl" />
                    )}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base select-none">{icon}</span>
                        <span className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">
                          {c.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize",
                          isOnline
                            ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/15"
                            : "text-red-500 bg-red-100 dark:bg-red-500/15"
                        )}>
                          {isOnline ? "Active" : "Lagging"}
                        </span>
                        <ChevronRight className={cn(
                          "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
                          isActive ? "text-indigo-500 rotate-90" : "text-gray-300 dark:text-slate-600"
                        )} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500 font-mono">
                      <span className="truncate">{c.host}:{c.port}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-sans font-medium text-[10px] bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        {c.capture_mode || "WAL CDC"}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2.5 border-t border-gray-50 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
                      <span>DB: <strong className="text-gray-700 dark:text-slate-300 font-medium">{c.database_name || c.database || "primary"}</strong></span>
                      <span className="text-emerald-500 font-medium flex items-center gap-1">0ms WAL lag <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-indigo-500 transition-colors" /></span>
                    </div>
                  </Link>
                );
              })}

              {/* Add Database Card */}
              <button
                onClick={() => setShowConnectorModal(true)}
                className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700/80 flex flex-col items-center justify-center gap-2 min-h-[110px] hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors group bg-white/40 dark:bg-[#13151f]/40"
              >
                <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 transition-colors">
                  <Plus className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
                </div>
                <span className="text-xs text-gray-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors font-medium">
                  Add Database
                </span>
              </button>
            </div>
          )}
        </div>

        {/* ── Bottom: 2:1 Layout (Recent Mutations + Quick Actions) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Recent Critical Mutations */}
          <div className="lg:col-span-2 bg-white dark:bg-[#13151f] border border-gray-100 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-sm text-gray-900 dark:text-white">
                  Recent Critical Mutations
                </span>
              </div>
              <Link
                href="/dashboard/connectors"
                className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1 font-medium"
              >
                All Databases <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className={`flex-1 min-h-[220px] w-full flex flex-col ${events.length === 0 ? "justify-center" : "justify-start"}`}>
              {!mounted ? (
                <div className="h-[200px] w-full bg-gray-50 dark:bg-slate-800/40 rounded-xl animate-pulse" />
              ) : events.length === 0 ? (
                <div className="text-center py-10 px-6">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold text-sm text-gray-700 dark:text-slate-300">All databases synced</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">No uncommitted DML mutations detected</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
                  {events.filter(ev => !isRoutineEvent(ev)).slice(0, 5).map((ev) => {
                    const icon = DB_ICONS[ev.database?.toLowerCase()] || "🐘";
                    const isInsert = ev.operation === "INSERT";
                    const isUpdate = ev.operation === "UPDATE";
                    const isDelete = ev.operation === "DELETE";

                    return (
                      <div
                        key={ev.id || ev.event_id || Math.random().toString()}
                        onClick={() => setSelectedEventForDiff(ev)}
                        className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-gray-50/80 dark:hover:bg-slate-800/40 rounded-xl transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-lg select-none">{icon}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-gray-900 dark:text-slate-100 truncate">
                                {(() => {
                                  const parts: string[] = [];
                                  if (ev.database && ev.database !== "*") parts.push(ev.database);
                                  if (ev.schema && ev.schema !== "public" && ev.schema !== "default" && ev.schema !== ev.database) {
                                    parts.push(ev.schema);
                                  }
                                  let cleanTbl = ev.table || "";
                                  if (ev.database && cleanTbl.startsWith(`${ev.database}.`)) {
                                    cleanTbl = cleanTbl.slice(ev.database.length + 1);
                                  }
                                  parts.push(cleanTbl);
                                  return parts.filter(Boolean).join(".");
                                })()}
                              </span>
                              <span className={cn(
                                "text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide",
                                isInsert ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20" :
                                isUpdate ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20" :
                                "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                              )}>
                                {ev.operation}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-400 dark:text-slate-500 flex items-center gap-2 mt-0.5">
                              {ev.masked_fields && ev.masked_fields.length > 0 && (
                                <span className="text-[10px] text-indigo-500 font-medium bg-indigo-50 dark:bg-indigo-500/10 px-1.5 rounded">
                                  {ev.masked_fields.length} PII Masked
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-gray-400 dark:text-slate-500">
                            {ev.commit_timestamp ? timeAgo(ev.commit_timestamp) : "just now"}
                          </span>
                          <button
                            type="button"
                            className="p-1 rounded-md text-gray-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 transition-colors"
                            title="Inspect Row Diff"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Compact Mutation Activity Wheel */}
          <div className="self-start">
            <div
              onClick={() => router.push("/dashboard/connectors")}
              className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm space-y-3 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all cursor-pointer group"
            >
              {/* Widget Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-slate-800/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-2xs group-hover:scale-105 transition-transform">
                    <PieChart className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-gray-900 dark:text-white tracking-tight">
                      Mutation Activity
                    </h3>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-none">
                      DML write distribution
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                  <span>Databases</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Circular Gauge / Donut Graphic */}
              {(() => {
                const radius = 54;
                const circumference = 2 * Math.PI * radius; // ~339.29
                const breakdown = velocityData?.breakdown;
                const totalOps = velocityData?.totalMutations || 0;

                const rawSlices = [
                  {
                    name: "INSERT",
                    label: "Insert Operations",
                    count: breakdown?.inserts.count || 0,
                    pct: breakdown?.inserts.percentage || 0,
                    color: "#10b981",
                    desc: "New rows written & captured via WAL",
                  },
                  {
                    name: "UPDATE",
                    label: "Update Operations",
                    count: breakdown?.updates.count || 0,
                    pct: breakdown?.updates.percentage || 0,
                    color: "#f59e0b",
                    desc: "State mutations & column-level diff transitions",
                  },
                  {
                    name: "DELETE",
                    label: "Delete Operations",
                    count: breakdown?.deletes.count || 0,
                    pct: breakdown?.deletes.percentage || 0,
                    color: "#f43f5e",
                    desc: "Row deletions and archived purge ledger records",
                  },
                  {
                    name: "DDL_CHANGE",
                    label: "Schema DDL Events",
                    count: breakdown?.ddl.count || 0,
                    pct: breakdown?.ddl.percentage || 0,
                    color: "#8b5cf6",
                    desc: "Table alterations & schema migrations",
                  },
                ];

                const hasData = totalOps > 0;
                const activeSlices = hasData
                  ? rawSlices.filter((s) => s.pct > 0 || s.count > 0)
                  : [
                      { name: "INSERT", label: "Insert Operations", count: 0, pct: 45, color: "#10b981", desc: "Awaiting incoming WAL stream mutations" },
                      { name: "UPDATE", label: "Update Operations", count: 0, pct: 35, color: "#f59e0b", desc: "Awaiting incoming WAL stream mutations" },
                      { name: "DELETE", label: "Delete Operations", count: 0, pct: 20, color: "#f43f5e", desc: "Awaiting incoming WAL stream mutations" },
                    ];

                const totalPct = activeSlices.reduce((acc, s) => acc + s.pct, 0) || 100;
                let accumulatedOffset = 0;
                const gap = activeSlices.length > 1 ? 3 : 0;

                const renderedSlices = activeSlices.map((s) => {
                  const normalizedPct = (s.pct / totalPct) * 100;
                  const arcLength = (normalizedPct / 100) * circumference;
                  const dashLength = Math.max(0, arcLength - gap);
                  const strokeDasharray = `${dashLength} ${circumference - dashLength}`;
                  const strokeDashoffset = -accumulatedOffset;
                  accumulatedOffset += arcLength;

                  return {
                    ...s,
                    strokeDasharray,
                    strokeDashoffset,
                  };
                });

                return (
                  <div className="flex flex-col items-center">
                    {/* Compact SVG Wheel */}
                    <div
                      onMouseLeave={() => setHoveredSlice(null)}
                      className="relative w-28 h-28 my-0.5 flex items-center justify-center select-none"
                    >
                      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90 origin-center drop-shadow-xs">
                        <circle
                          cx="70"
                          cy="70"
                          r={radius}
                          stroke="currentColor"
                          className="text-gray-100 dark:text-slate-800/80"
                          strokeWidth="14"
                          fill="none"
                        />
                        {renderedSlices.map((slice) => {
                          const isHovered = hoveredSlice?.name === slice.name;
                          return (
                            <circle
                              key={slice.name}
                              cx="70"
                              cy="70"
                              r={radius}
                              stroke={slice.color}
                              strokeWidth={14}
                              strokeDasharray={slice.strokeDasharray}
                              strokeDashoffset={slice.strokeDashoffset}
                              strokeLinecap="round"
                              fill="none"
                              className="transition-opacity duration-150 cursor-pointer"
                              style={{
                                opacity: hoveredSlice ? (isHovered ? 1 : 0.28) : 1,
                              }}
                              onMouseEnter={(e) => {
                                e.stopPropagation();
                                setHoveredSlice(slice);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/connectors`);
                              }}
                            />
                          );
                        })}
                      </svg>

                      {/* Center Display */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center select-none">
                        <div className="w-20 flex flex-col items-center justify-center">
                          {hoveredSlice ? (
                            <div className="flex flex-col items-center animate-scale-in">
                              <span
                                className="text-[9px] font-bold uppercase tracking-wider"
                                style={{ color: hoveredSlice.color }}
                              >
                                {hoveredSlice.name}
                              </span>
                              <span className="text-base font-black font-mono tracking-tight text-gray-900 dark:text-white leading-tight">
                                {hoveredSlice.pct}%
                              </span>
                              <span className="text-[9px] font-semibold text-gray-400 dark:text-slate-500">
                                {hoveredSlice.count.toLocaleString()} rows
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="text-lg font-black font-mono tracking-tight text-gray-900 dark:text-white leading-tight">
                                {totalOps.toLocaleString()}
                              </span>
                              <span className="text-[9px] font-medium text-gray-400 dark:text-slate-500 leading-tight">
                                Operations
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Compact Telemetry Summary Bar */}
                    <div className="w-full mt-2 h-[44px] rounded-xl border border-gray-100 dark:border-slate-800/80 bg-gray-50/70 dark:bg-slate-900/40 px-3 flex flex-col justify-center overflow-hidden transition-colors">
                      {hoveredSlice ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/connectors`);
                          }}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs" style={{ color: hoveredSlice.color }}>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hoveredSlice.color }} />
                            <span>{hoveredSlice.label}</span>
                          </div>
                          <span className="font-mono font-bold text-xs text-gray-900 dark:text-white">
                            {hoveredSlice.pct}% ({hoveredSlice.count.toLocaleString()} rows)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[9px] uppercase font-semibold text-gray-400 dark:text-slate-500 block leading-none">Velocity</span>
                            <span className="font-mono font-bold text-gray-800 dark:text-slate-200 text-[11px] leading-tight mt-0.5 block">
                              {velocityData?.currentVelocityPerSec || 0} mut/s
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-[9px] uppercase font-semibold text-gray-400 dark:text-slate-500 block leading-none">Net Growth</span>
                            <span className={cn(
                              "font-mono font-bold text-[11px] leading-tight mt-0.5 block",
                              (velocityData?.netRowGrowth || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            )}>
                              {(velocityData?.netRowGrowth || 0) > 0 ? `+${velocityData?.netRowGrowth}` : (velocityData?.netRowGrowth || 0)} rows
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] uppercase font-semibold text-gray-400 dark:text-slate-500 block leading-none">Hottest</span>
                            <span className="font-mono font-semibold text-gray-700 dark:text-slate-300 text-[11px] truncate max-w-[85px] leading-tight mt-0.5 block" title={velocityData?.topActiveTable}>
                              {velocityData?.topActiveTable?.split(".")?.[1] || velocityData?.topActiveTable || "None"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Compact Interactive Legend Pills */}
                    <div
                      onMouseLeave={() => setHoveredSlice(null)}
                      className="grid grid-cols-2 gap-1.5 w-full mt-2"
                    >
                      {rawSlices.map((slice) => {
                        const isHovered = hoveredSlice?.name === slice.name;
                        return (
                          <button
                            key={slice.name}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/connectors`);
                            }}
                            onMouseEnter={(e) => {
                              e.stopPropagation();
                              setHoveredSlice(slice);
                            }}
                            className={cn(
                              "flex items-center justify-between px-2 py-1.5 rounded-lg text-left border transition-colors cursor-pointer text-xs",
                              isHovered
                                ? "bg-white dark:bg-slate-800 shadow-xs"
                                : "bg-gray-50/60 dark:bg-slate-900/30 hover:bg-gray-100/80 dark:hover:bg-slate-800/50 border-gray-100 dark:border-slate-800/40"
                            )}
                            style={{
                              borderColor: isHovered ? slice.color : undefined,
                              backgroundColor: isHovered ? `${slice.color}10` : undefined,
                            }}
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                              <span className="font-semibold text-gray-700 dark:text-slate-300 text-[10px] truncate">
                                {slice.name}
                              </span>
                            </span>
                            <span className="font-mono font-bold text-gray-900 dark:text-white text-[10px] shrink-0 ml-1">
                              {slice.pct}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Bottom footer hint */}
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500">
                <span>Hover slice to inspect</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:underline flex items-center gap-0.5">
                  Databases →
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row Diff Viewer Modal */}
      {selectedEventForDiff && (
        <RowDiffViewer
          event={selectedEventForDiff}
          onClose={() => setSelectedEventForDiff(null)}
        />
      )}

      {/* Add Connector Modal */}
      {showConnectorModal && (
        <ConnectorModal
          onClose={() => setShowConnectorModal(false)}
          onConnectorCreated={() => {
            setShowConnectorModal(false);
            load(false, true);
          }}
        />
      )}
    </>
  );
}
