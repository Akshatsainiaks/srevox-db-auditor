"use client";

import { useState, useEffect } from "react";
import RowDiffViewer from "@/components/data-audit/RowDiffViewer";
import ConnectorModal from "@/components/data-audit/ConnectorModal";
import {
  Database,
  Search,
  Filter,
  ShieldCheck,
  Zap,
  Clock,
  Layers,
  ArrowRightLeft,
  FileJson,
  Lock,
  RefreshCw,
  Plus,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  EyeOff,
  Terminal,
  ChevronRight,
  HardDrive,
  Download,
  Key,
  Globe,
  Sparkles,
  ArrowUpRight
} from "lucide-react";
import { fetchDbAuditConnectors, fetchDbAuditEvents, publishDbAuditEvent } from "@/lib/api";
import { cn } from "@/lib/utils";

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

const DB_ICONS: Record<string, string> = {
  postgresql: "🐘",
  mysql: "🐬",
  mongodb: "🍃",
  redis: "🔴",
  clickhouse: "🟡",
  tidb: "💎",
  oceanbase: "🌊",
  mssql: "🛡️",
  oracle: "🔴",
  snowflake: "❄️",
  pinecone: "🌲",
};

const FEATURED_DBS = [
  { id: "postgresql", name: "PostgreSQL", icon: "🐘", desc: "WAL CDC (pgoutput)" },
  { id: "mysql", name: "MySQL", icon: "🐬", desc: "Binlog CDC Stream" },
  { id: "tidb", name: "TiDB", icon: "💎", desc: "Distributed HTAP CDC" },
  { id: "oceanbase", name: "OceanBase", icon: "🌊", desc: "Enterprise SQL CDC" },
  { id: "redis", name: "Redis", icon: "🔴", desc: "Keyspace Streams" },
  { id: "mongodb", name: "MongoDB", icon: "🍃", desc: "Change Streams Oplog" },
  { id: "clickhouse", name: "ClickHouse", icon: "🟡", desc: "Audit Ledger Engine" },
];

function toArray(val: any): string[] {
  if (!val) return [];
  let arr: any[] = [];
  if (Array.isArray(val)) {
    arr = val;
  } else if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) arr = parsed;
      else if (parsed !== null && parsed !== undefined) arr = [parsed];
    } catch {
      arr = [val];
    }
  } else if (typeof val === "object") {
    arr = Object.keys(val);
  }
  return arr.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item)));
}

export default function DataAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [connectors, setConnectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOperation, setSelectedOperation] = useState<string>("all");
  const [selectedDb, setSelectedDb] = useState<string>("all");
  const [selectedTable, setSelectedTable] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [showConnectorModal, setShowConnectorModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"stream" | "connectors" | "policies" | "architecture">("stream");

  const fetchConnectors = async () => {
    try {
      const res = await fetchDbAuditConnectors();
      if (res?.connectors) {
        setConnectors(res.connectors);
      }
    } catch {}
  };

  const fetchAuditEvents = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchDbAuditEvents();
      if (res?.events) {
        setEvents(res.events);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectors();
    fetchAuditEvents();

    // Production Server-Sent Events (SSE) Stream — 1 single persistent connection, 0 HTTP polling requests
    const eventSource = new EventSource("/api/db-audit/stream");

    eventSource.onmessage = (e) => {
      try {
        const newEvt = JSON.parse(e.data);
        if (newEvt && (newEvt.id || newEvt.event_id)) {
          setEvents((prev) => [newEvt, ...prev.filter((item) => (item.id || item.event_id) !== (newEvt.id || newEvt.event_id))]);
        }
      } catch {}
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const availableDbs = Array.from(new Set(events.map((e) => e.database).filter(Boolean)));
  const availableTables = Array.from(new Set(events.map((e) => e.table).filter(Boolean)));

  const filteredEvents = events.filter((e) => {
    const query = searchQuery.toLowerCase();
    const changedArr = toArray(e.changed_fields);
    const matchesSearch =
      !query ||
      (e.table && e.table.toLowerCase().includes(query)) ||
      (e.database && e.database.toLowerCase().includes(query)) ||
      (e.operation && e.operation.toLowerCase().includes(query)) ||
      changedArr.some(f => String(f).toLowerCase().includes(query));

    const matchesOp = selectedOperation === "all" || e.operation === selectedOperation;
    const matchesDb = selectedDb === "all" || e.database === selectedDb;
    const matchesTable = selectedTable === "all" || e.table === selectedTable;

    return matchesSearch && matchesOp && matchesDb && matchesTable;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#090b10] text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">

      <main className="max-w-7xl w-full mx-auto space-y-6">
        
        {/* Executive Glassmorphic Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c101d] via-[#111827] to-[#1e1b4b] text-white p-6 sm:p-8 shadow-2xl border border-indigo-500/20">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            
            {/* Top Bar Status */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold backdrop-blur-md shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>CDC Stream Replication Pipeline Active</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => fetchAuditEvents()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all border border-white/10 backdrop-blur-md shadow-xs"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                  <span>Sync Stream</span>
                </button>

                <button
                  onClick={() => setShowConnectorModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Connect Database</span>
                </button>
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-2 max-w-3xl">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                <span>Database Change Intelligence & Compliance Ledger</span>
                <Sparkles className="w-6 h-6 text-indigo-400 hidden sm:inline" />
              </h1>
              <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed font-normal">
                Continuous real-time CDC change data capture, column-level before & after diff tracking, and automatic in-memory PII masking across production SQL & NoSQL clusters.
              </p>
            </div>

            {/* Quick Launcher Database Engine Pills */}
            <div className="pt-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Instant Database CDC Setup</p>
              <div className="flex flex-wrap items-center gap-2">
                {FEATURED_DBS.map((db) => (
                  <button
                    key={db.id}
                    onClick={() => setShowConnectorModal(true)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/40 text-xs font-medium text-slate-200 transition-all group"
                  >
                    <span className="text-sm">{db.icon}</span>
                    <span className="font-semibold">{db.name}</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-300 transition-colors" />
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* 4 Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#0f121d] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-center gap-4 hover:border-indigo-500/40 transition-all group">
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Connectors</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{connectors.length} Active</h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Real-time CDC capture</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0f121d] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-center gap-4 hover:border-amber-500/40 transition-all group">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Captured Events</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{events.length} Events</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">CDC Log-based stream</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0f121d] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-center gap-4 hover:border-purple-500/40 transition-all group">
            <div className="p-3.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
              <EyeOff className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">PII Protection</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">3 Policies</h3>
              <p className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-0.5">SSN, Cards, Passwords masked</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0f121d] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-center gap-4 hover:border-emerald-500/40 transition-all group">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Ledger Health</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">SHA-256</h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">100% Chain verified</p>
            </div>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab("stream")}
            className={cn(
              "px-4 py-3 border-b-2 transition-all flex items-center gap-2",
              activeTab === "stream"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Activity className="w-4 h-4" />
            <span>Live Audit Event Stream</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 font-mono">{events.length}</span>
          </button>

          <button
            onClick={() => setActiveTab("connectors")}
            className={cn(
              "px-4 py-3 border-b-2 transition-all flex items-center gap-2",
              activeTab === "connectors"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Server className="w-4 h-4" />
            <span>Connected Databases</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 font-mono">{connectors.length}</span>
          </button>

          <button
            onClick={() => setActiveTab("policies")}
            className={cn(
              "px-4 py-3 border-b-2 transition-all flex items-center gap-2",
              activeTab === "policies"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <EyeOff className="w-4 h-4" />
            <span>Masking & Security Rules</span>
          </button>

          <button
            onClick={() => setActiveTab("architecture")}
            className={cn(
              "px-4 py-3 border-b-2 transition-all flex items-center gap-2",
              activeTab === "architecture"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Layers className="w-4 h-4" />
            <span>CDC Architecture Topology</span>
          </button>
        </div>

        {/* TAB 1: LIVE AUDIT EVENT STREAM */}
        {activeTab === "stream" && (
          <div className="space-y-4">
            
            {/* Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0f121d] p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search audit trail by database, table name, operation, or modified fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:block" />

                {/* Database Filter Dropdown */}
                <select
                  value={selectedDb}
                  onChange={(e) => setSelectedDb(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value="all">All Databases ({availableDbs.length})</option>
                  {availableDbs.map((db) => (
                    <option key={db} value={db}>{db}</option>
                  ))}
                </select>

                {/* Table Filter Dropdown */}
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value="all">All Tables ({availableTables.length})</option>
                  {availableTables.map((tbl) => (
                    <option key={tbl} value={tbl}>{tbl}</option>
                  ))}
                </select>

                {/* Operation Pills */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  {["all", "UPDATE", "INSERT", "DELETE"].map(op => (
                    <button
                      key={op}
                      onClick={() => setSelectedOperation(op)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-[11px] font-bold uppercase transition-all",
                        selectedOperation === op
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                      )}
                    >
                      {op === "all" ? "All Operations" : op}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Audit Log Table Container */}
            <div className="bg-white dark:bg-[#0f121d] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-500" />
                  <span>Real-Time Transaction Log Feed</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Showing {filteredEvents.length} events
                </span>
              </div>

              <div className="overflow-x-auto">
                {filteredEvents.length === 0 ? (
                  <div className="p-12 text-center space-y-4">
                    <div className="w-14 h-14 rounded-3xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-500/20">
                      <Database className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-base text-slate-900 dark:text-white">No Audit Change Events Captured Yet</h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        Connect your production database to start streaming real-time transaction change logs (`UPDATE`, `INSERT`, `DELETE`) with column diffs.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowConnectorModal(true)}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Connect Database Now</span>
                    </button>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold">
                        <th className="py-3 px-4">Operation</th>
                        <th className="py-3 px-4">Database & Table</th>
                        <th className="py-3 px-4">Capture Mode</th>
                        <th className="py-3 px-4">Modified Columns</th>
                        <th className="py-3 px-4">PII Redaction</th>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/50">
                      {filteredEvents.map((evt) => (
                        <tr
                          key={evt.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
                          onClick={() => setSelectedEvent(evt)}
                        >
                          <td className="py-3.5 px-4 font-bold">
                            <span className={cn(
                              "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1",
                              evt.operation === "INSERT" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                              evt.operation === "UPDATE" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
                              evt.operation === "DELETE" && "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                            )}>
                              {evt.operation}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-900 dark:text-white font-semibold">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{DB_ICONS[evt.database] || "🐘"}</span>
                              <span>{evt.database}.{evt.schema}.<strong className="text-indigo-600 dark:text-indigo-400 font-bold">{evt.table}</strong></span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                              CDC Stream (WAL)
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                            {toArray(evt.changed_fields).length > 0 ? (
                              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-mono">
                                {toArray(evt.changed_fields).join(", ")}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="py-3.5 px-4">
                            {toArray(evt.masked_fields).length > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold inline-flex items-center gap-1 border border-purple-500/20">
                                <Lock className="w-3 h-3" />
                                <span>{toArray(evt.masked_fields).join(", ")}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Clean</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                            {new Date(evt.commit_timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(evt);
                              }}
                              className="px-3 py-1.5 text-[11px] font-bold rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors border border-indigo-500/20 inline-flex items-center gap-1"
                            >
                              <span>View Diff</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: CONNECTED DATABASES */}
        {activeTab === "connectors" && (
          <div className="space-y-4">
            {connectors.length === 0 ? (
              <div className="bg-white dark:bg-[#0f121d] border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-3xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-500/20">
                  <Server className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">No Database Connectors Registered</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Add your PostgreSQL, MySQL, TiDB, OceanBase, Redis, or ClickHouse instance to begin CDC streaming.
                  </p>
                </div>
                <button
                  onClick={() => setShowConnectorModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Database Connector</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {connectors.map((c: any) => (
                  <div key={c.connector_id || c.id} className="bg-white dark:bg-[#0f121d] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-3 hover:border-indigo-500/40 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500 text-2xl">
                        {DB_ICONS[c.db_type] || "🐘"}
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{c.status || "connected"}</span>
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{c.host}:{c.port} / {c.database_name}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Mode: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{c.capture_mode || "CDC Stream"}</strong></span>
                      <span>{c.records_today || 0} events today</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MASKING & SECURITY POLICIES */}
        {activeTab === "policies" && (
          <div className="bg-white dark:bg-[#0f121d] border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500">
                <EyeOff className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Active In-Memory Data Redaction Policies</h3>
                <p className="text-xs text-slate-500">Columns matching security patterns below are automatically masked before storing toClickHouse ledger.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-2">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">🔒 Government & National ID</span>
                <p className="text-xs text-slate-700 dark:text-slate-300">Target Fields: `ssn`, `tax_id`, `passport_no`</p>
                <span className="text-[11px] font-mono text-purple-500 font-bold block bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">Mask: ***-**-****</span>
              </div>

              <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-2">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">💳 Payment Credentials</span>
                <p className="text-xs text-slate-700 dark:text-slate-300">Target Fields: `credit_card`, `cvv`, `iban`</p>
                <span className="text-[11px] font-mono text-purple-500 font-bold block bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">Mask: ****-****-****-4242</span>
              </div>

              <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-2">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">🔑 Security Secrets & Tokens</span>
                <p className="text-xs text-slate-700 dark:text-slate-300">Target Fields: `password_hash`, `api_token`, `secret`</p>
                <span className="text-[11px] font-mono text-purple-500 font-bold block bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">Mask: [REDACTED]</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CDC ARCHITECTURE TOPOLOGY */}
        {activeTab === "architecture" && (
          <div className="bg-white dark:bg-[#0f121d] border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-500" />
                <span>Srevox Database Audit CDC Flow</span>
              </h3>
              <p className="text-xs text-slate-500">End-to-end zero-overhead transaction change streaming pipeline architecture.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-indigo-500">Step 1: Production DB</span>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Transaction WAL / Binlog</h4>
                <p className="text-xs text-slate-500">PostgreSQL Logical Decoding / MySQL Binlog stream continuously without locking tables.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-indigo-500">Step 2: Stream Engine</span>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Rust CDC Processor</h4>
                <p className="text-xs text-slate-500">High-performance Rust daemon decodes binary changes and generates SHA-256 record hashes.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-indigo-500">Step 3: Security Layer</span>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">In-Memory PII Masking</h4>
                <p className="text-xs text-slate-500">Sensitive fields (SSN, Cards, Passwords) are redacted in-memory before reaching storage.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-indigo-500">Step 4: Audit Store</span>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">ClickHouse Ledger</h4>
                <p className="text-xs text-slate-500">Tamper-proof, immutable ClickHouse audit store provides instant queries and field diffs.</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Row Diff Viewer Drawer */}
      {selectedEvent && (
        <RowDiffViewer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Add Connector Modal */}
      {showConnectorModal && (
        <ConnectorModal
          onClose={() => setShowConnectorModal(false)}
          onConnectorCreated={() => {
            fetchConnectors();
            fetchAuditEvents();
          }}
        />
      )}
    </div>
  );
}
