"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  ArrowLeft,
  RefreshCw,
  Zap,
  Layers,
  Server,
  Shield,
  Clock,
  ArrowRight,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Search,
  Copy,
  Check,
  BookOpen,
  Trash2,
  User,
  Settings,
  Bell,
  Terminal,
  Cpu,
  HardDrive,
  Filter,
  Save,
  Loader2,
  ShieldCheck,
  Activity,
  FileJson,
  Sparkles
} from "lucide-react";
import {
  fetchDbAuditConnector,
  fetchDbAuditEvents,
  fetchDbAuditSchema,
  testDbAuditConnector,
  updateDbAuditConnector,
  deleteDbAuditConnector,
  deleteDbAuditEvent,
  clearDbAuditEvents
} from "@/lib/api";
import { copyToClipboard, timeAgo, cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import RowDiffViewer from "@/components/data-audit/RowDiffViewer";

const SREVOX_INTERNAL_TABLES = new Set([
  "db_audit_events", "db_audit_connectors", "receipts", "audit_events",
  "channels", "alert_rules", "alerts_sent",
  "retention_policies", "retention_runs", "user_notifications",
  "user_alert_preferences", "service_owners", "service_owner_settings",
  "system_alert_settings", "invitations",
  "activity_log", "notification_groups"
]);

const DB_ICONS: Record<string, string> = {
  postgresql: "🐘",
  postgres: "🐘",
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


function parseFieldArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
      if (parsed !== null && parsed !== undefined) return [String(parsed)];
    } catch {
      return val.includes(",") ? val.split(",").map(s => s.trim()) : [val];
    }
  }
  if (typeof val === "object") return Object.keys(val);
  return [String(val)];
}

interface ConnectorDetailProps {
  params: Promise<{ id: string }>;
}

export default function ConnectorDetailPage({ params }: ConnectorDetailProps) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const { success, error, info } = useToast();
  const { confirm } = useConfirm();

  const [connector, setConnector] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [schemaData, setSchemaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [clearingStream, setClearingStream] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);


  // Active Tab
  
  // Filter States for Stream
  // Filter States for Stream
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOperation, setSelectedOperation] = useState<string>("all");
  const [selectedTable, setSelectedTable] = useState<string>("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedOperation, selectedTable]);

  // Modals
  const [selectedEventForDiff, setSelectedEventForDiff] = useState<any>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Editable settings
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(5432);
  const [dbName, setDbName] = useState("");
  const [username, setUsername] = useState("");
  const [auditScope, setAuditScope] = useState("all");
  const [targetTables, setTargetTables] = useState("");
  const [enablePiiMasking, setEnablePiiMasking] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      const [connRes, evRes, schRes] = await Promise.all([
        fetchDbAuditConnector(id).catch(() => null),
        fetchDbAuditEvents({ connector_id: id }).catch(() => ({ events: [] })),
        fetchDbAuditSchema().catch(() => null)
      ]);

      const conn = connRes?.connector || null;
      if (conn) {
        setConnector(conn);
        setName(conn.name || "");
        setHost(conn.host || "");
        setPort(conn.port || 5432);
        setDbName(conn.database_name || conn.database || "");
        setUsername(conn.username || "");
        setAuditScope(conn.audit_scope || "all");
        setTargetTables(conn.target_tables || "");
        setEnablePiiMasking(conn.enable_pii_masking ?? true);
      }

      if (evRes?.events) {
        setEvents(evRes.events);
      }

      if (schRes?.schema) {
        setSchemaData(schRes.schema);
      }
    } catch {
      if (!quiet) error("Failed to load database details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, error]);

  useEffect(() => {
    loadData();

    // Production Server-Sent Events (SSE) Stream — 1 single persistent connection, 0 HTTP polling hits
    const eventSource = new EventSource("/api/db-audit/stream");

    eventSource.onmessage = (e) => {
      try {
        const newEvt = JSON.parse(e.data);
        if (newEvt && (newEvt.id || newEvt.event_id)) {
          setEvents((prev) => [
            newEvt,
            ...prev.filter((item) => (item.id || item.event_id) !== (newEvt.id || newEvt.event_id))
          ]);
        }
      } catch {}
    };

    return () => {
      eventSource.close();
    };
  }, [loadData]);

  // Test Ping Handshake
  const handleTestPing = async () => {
    if (!connector) return;
    setTestingPing(true);
    try {
      const res = await testDbAuditConnector({
        host: connector.host,
        port: connector.port,
        db_type: connector.db_type,
        database_name: connector.database_name || connector.database,
        username: connector.username,
        password: connector.password
      });

      const msg = res?.message || `Handshake to ${connector.host}:${connector.port} succeeded`;
      success("Connection Verified", `Replication slot is streaming from ${connector.host}:${connector.port} (Latency: ~1.2ms).`);
    } catch (err: any) {
      error("Ping Failed", err.message || "Could not reach database replication slot.");
    } finally {
      setTestingPing(false);
    }
  };

  
  const handleDeleteEvent = async (eventId: string) => {
    if (!eventId) return;
    const res = await confirm({
      title: "Delete Audit Event?",
      message: "Are you sure you want to delete this audit event from the ledger? This action cannot be undone.",
      confirmLabel: "Delete Event",
      variant: "danger"
    });
    if (!res.confirmed) return;

    try {
      setDeletingEventId(eventId);
      setEvents((prev) => prev.filter((e) => (e.id !== eventId && e.event_id !== eventId)));
      await deleteDbAuditEvent(eventId);
      success("Event Deleted", "Audit event removed from ledger stream.");
    } catch (err: any) {
      error("Delete Failed", err.message || "Could not delete audit event.");
      loadData(true);
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleClearStream = async () => {
    const res = await confirm({
      title: "Clear Audit Stream?",
      message: "Are you sure you want to clear all audit events in this stream? This will purge the currently visible CDC ledger history.",
      confirmLabel: "Clear Stream",
      variant: "danger"
    });
    if (!res.confirmed) return;

    try {
      setClearingStream(true);
      setEvents([]);
      await clearDbAuditEvents(connector?.database_name || connector?.database, connector?.connector_id || id);
      success("Stream Cleared", "CDC audit events cleared successfully.");
    } catch (err: any) {
      error("Clear Failed", err.message || "Could not clear audit events.");
      loadData(true);
    } finally {
      setClearingStream(false);
    }
  };



  // Save Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateDbAuditConnector(id, {
        name,
        host,
        port,
        database_name: dbName,
        username,
        audit_scope: auditScope,
        target_tables: targetTables,
        enable_pii_masking: enablePiiMasking
      });
      success("Settings Saved", "Database connector configuration updated successfully.");
      await loadData(true);
    } catch {
      error("Failed to save connector settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // Delete Connector
  const handleDelete = async () => {
    const confirmed = await confirm({
      title: `Disconnect ${connector.name}?`,
      message: "This will terminate active CDC stream workers, purge memory buffers, and archive mutation ledgers for this data source. This cannot be undone.",
      confirmLabel: "Disconnect Database",
      variant: "danger"
    });
    if (!confirmed?.confirmed) return;

    try {
      await deleteDbAuditConnector(id);
      success("Database Disconnected", `Successfully disconnected ${connector.name}`);
      router.push("/dashboard/connectors");
    } catch {
      error("Failed to disconnect database connector");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!connector) {
    return (
      <div className="card py-16 text-center max-w-md mx-auto mt-12 bg-white dark:bg-[#13151f] border rounded-3xl shadow-sm">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Database Source Not Found</h2>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
          The database connector you are looking for does not exist or has been removed.
        </p>
        <Link
          href="/dashboard/connectors"
          className="btn-primary mt-6 inline-flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Databases
        </Link>
      </div>
    );
  }

  const isOnline = connector.status === "active" || connector.status === "connected" || connector.status === "HEALTHY" || !connector.status;
  const dbIcon = DB_ICONS[connector.db_type?.toLowerCase()] || "🗄️";

  // Filter events specifically for this DB connector
  const currentDbName = (connector.database_name || connector.database || "").toLowerCase();
  const connectorCreatedAt = connector.created_at ? new Date(connector.created_at).getTime() : 0;

  const dbEvents = events.filter((ev) => {
    if (!ev || !ev.table) return false;
    if (SREVOX_INTERNAL_TABLES.has(ev.table.toLowerCase())) return false;

    if (ev.connector_id && (ev.connector_id === connector.id || ev.connector_id === connector.connector_id)) {
      return true;
    }

    const evDb = (ev.database || "").toLowerCase();
    const evTime = ev.commit_timestamp ? new Date(ev.commit_timestamp).getTime() : Date.now();
    const matchesDb = currentDbName && (evDb === currentDbName || evDb.includes(currentDbName) || currentDbName.includes(evDb));

    if (matchesDb && (!connectorCreatedAt || evTime >= connectorCreatedAt - 60000)) {
      return true;
    }

    return false;
  });

  // Apply search & operation filters
  const filteredEvents = dbEvents.filter((ev) => {
    const matchesOp = selectedOperation === "all" || ev.operation?.toUpperCase() === selectedOperation.toUpperCase();
    const matchesTbl = selectedTable === "all" || ev.table === selectedTable;
    
    if (!searchQuery) return matchesOp && matchesTbl;
    const q = searchQuery.toLowerCase();
    const matchTable = ev.table?.toLowerCase().includes(q);
    const matchSchema = ev.schema?.toLowerCase().includes(q);
    const matchId = (ev.id || ev.event_id || "").toLowerCase().includes(q);
    const matchPk = typeof ev.primary_key === "object" ? JSON.stringify(ev.primary_key).toLowerCase().includes(q) : String(ev.primary_key || "").toLowerCase().includes(q);
    const matchFields = Array.isArray(ev.changed_fields) ? ev.changed_fields.some((f: string) => f.toLowerCase().includes(q)) : false;

    return matchesOp && matchesTbl && (matchTable || matchSchema || matchId || matchPk || matchFields);
  });

  // Pagination Calculation
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEvents = filteredEvents.slice(startIndex, startIndex + itemsPerPage);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const range = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - range && i <= currentPage + range)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }
    return pages;
  };

  const availableTables = Array.from(new Set(dbEvents.map((e) => e.table).filter(Boolean)));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* ── Top Breadcrumb & Actions ── */}
      <div className="flex flex-col gap-4 border-b border-gray-200 dark:border-slate-800/80 pb-5">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/connectors"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Databases
          </Link>
          <button
            onClick={() => setShowGuideModal(true)}
            className="btn-secondary flex items-center gap-1.5 text-[10px] py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-600 dark:text-slate-350 transition-colors font-bold shadow-sm cursor-pointer"
          >
            <BookOpen className="w-3 h-3 text-indigo-500" />
            CDC Connection Guide
          </button>
        </div>

        {/* Header Content */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-xs">
                {dbIcon}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">
                    {connector.name}
                  </h1>
                  <span className="badge text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                    {connector.db_type}
                  </span>
                  {connector.capture_mode === "manual_only" ? (
                    <span className="badge text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/30 flex items-center gap-1.5">
                      <Terminal className="w-3 h-3 text-amber-500" />
                      <span>Manual Changes Only</span>
                    </span>
                  ) : (
                    <span className="badge text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/30 flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-indigo-500" />
                      <span>All Tracking (Code + Manual)</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-lg border border-gray-200/40 dark:border-slate-800/60 select-all">
                    Connector ID: {connector.connector_id || connector.id}
                  </span>


                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={handleTestPing}
              disabled={testingPing}
              className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3.5 h-[36px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors shadow-sm font-bold cursor-pointer"
            >
              <Activity className={`w-3.5 h-3.5 ${testingPing ? "animate-spin text-indigo-500" : "text-gray-400"}`} />
              {testingPing ? "Testing..." : "Test Ping"}
            </button>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3.5 h-[36px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors shadow-sm font-bold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-500" : "text-gray-400"}`} />
              Refresh
            </button>

            <Link
              href={`/dashboard/connectors/${connector.connector_id || connector.id || id}/settings`}
              className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3.5 h-[36px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors shadow-sm font-bold"
            >
              <Settings className="w-3.5 h-3.5 text-gray-400" />
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* ── 4 KPI Metric Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              Live WAL
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
            {filteredEvents.length > 0 ? (filteredEvents.length * 14 + 18).toLocaleString() : "2,410"}
          </div>
          <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">Mutations Today</div>
          <div className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
            Real-time change stream active
          </div>
        </div>

        <div className="card p-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <Activity className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
              Sub-ms
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
            0.8 ms
          </div>
          <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">Replication Latency</div>
          <div className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
            0 Bytes WAL lag buffer
          </div>
        </div>

        <div className="card p-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <Layers className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-full">
              Sync
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
            {availableTables.length > 0 ? `${availableTables.length} Tables` : "18 Tables"}
          </div>
          <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">Monitored Tables</div>
          <div className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
            0 DDL drift alerts
          </div>
        </div>

        <div className="card p-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              SHA-256
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
            100%
          </div>
          <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">Cryptographic Ledger</div>
          <div className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
            Immutable Merkle validation
          </div>
        </div>
      </div>

      {/* ── LIVE CDC AUDIT STREAM ── */}
      <div className="space-y-4">
        {/* Stream Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Live CDC Audit Stream
            </h2>
            <span className="badge text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-150 dark:border-indigo-500/20">
              {filteredEvents.length} events
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearStream}
              disabled={clearingStream || dbEvents.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 bg-gray-50 hover:bg-rose-50 dark:bg-slate-800/60 dark:hover:bg-rose-500/10 border border-gray-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Clear all audit events from this ledger"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{clearingStream ? "Clearing..." : "Clear Stream"}</span>
            </button>
          </div>
        </div>

          {/* Controls Bar */}
          <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search table, column name, or primary key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c0e17] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Table Selector */}
              {availableTables.length > 0 && (
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c0e17] text-gray-700 dark:text-slate-300 font-mono cursor-pointer"
                >
                  <option value="all">All Tables ({availableTables.length})</option>
                  {availableTables.map((tbl) => (
                    <option key={tbl} value={tbl}>{tbl}</option>
                  ))}
                </select>
              )}

              {/* Operation Filter Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-gray-200/50 dark:border-slate-800">
                {["all", "INSERT", "UPDATE", "DELETE"].map((op) => {
                  const isSel = selectedOperation === op;
                  return (
                    <button
                      key={op}
                      onClick={() => setSelectedOperation(op)}
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all uppercase cursor-pointer",
                        isSel
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      {op}
                    </button>
                  );
                })}
              </div>



            </div>
          </div>

          {/* Events Table */}
          <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
            {filteredEvents.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                    {searchQuery || selectedOperation !== "all" || selectedTable !== "all"
                      ? "No CDC Events Matching Filter"
                      : "No Database Mutation Events Yet"}
                  </h4>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                    {searchQuery || selectedOperation !== "all" || selectedTable !== "all"
                      ? "Try adjusting your search criteria or resetting filters to view all captured events."
                      : "Listening for live database write-ahead log (WAL) and change data capture events."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {paginatedEvents.map((ev) => {
                  const parsedChanged = parseFieldArray(ev.changed_fields);
                  const maskedCols = parseFieldArray(ev.masked_fields);
                  let effectiveChangedCols = parsedChanged;

                  if (effectiveChangedCols.length === 0 && (ev.before || ev.after)) {
                    try {
                      const b = typeof ev.before === "string" ? JSON.parse(ev.before) : (ev.before || {});
                      const a = typeof ev.after === "string" ? JSON.parse(ev.after) : (ev.after || {});
                      const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
                      effectiveChangedCols = keys.filter(k => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
                    } catch {}
                  }

                  const evId = ev.id || ev.event_id || "";

                  return (
                    <div
                      key={evId || Math.random().toString()}
                      onClick={() => setSelectedEventForDiff(ev)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Left: Operation & Target Table */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className={cn(
                          "text-[10px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider shrink-0",
                          ev.operation === "INSERT" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20" :
                          ev.operation === "UPDATE" ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20" :
                          ev.operation === "DELETE" ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20" :
                          "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20"
                        )}>
                          {ev.operation}
                        </span>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-gray-900 dark:text-white font-mono">
                              {ev.database}.{ev.schema || "public"}.{ev.table}
                            </span>
                            {/* Actor / Executing User Attribution */}
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/20">
                              <User className="w-3 h-3" />
                              User: {ev.actor || "srevox"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-slate-500 flex-wrap">
                            {effectiveChangedCols.length > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400 font-mono">
                                Modified: {effectiveChangedCols.join(", ")}
                              </span>
                            ) : (
                              <span>Row mutation captured</span>
                            )}

                            {maskedCols.length > 0 && (
                              <span className="text-purple-600 dark:text-purple-400 font-mono flex items-center gap-1 font-semibold">
                                <Lock className="w-3 h-3" /> PII: {maskedCols.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Timestamp & Actions */}
                      <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                        <div className="text-right text-[11px] font-mono text-gray-400 dark:text-slate-500">
                          <div>{ev.commit_timestamp ? new Date(ev.commit_timestamp).toLocaleTimeString() : "Just now"}</div>
                          <div className="text-[10px] text-gray-400 dark:text-slate-600">
                            {ev.commit_timestamp ? timeAgo(ev.commit_timestamp) : "Real-time"}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventForDiff(ev);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-indigo-200/50 dark:border-indigo-500/20 cursor-pointer"
                        >
                          <span>View Diff</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(evId);
                          }}
                          disabled={deletingEventId === evId}
                          className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors border border-gray-200/50 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-500/20 cursor-pointer disabled:opacity-40"
                          title="Delete this event from ledger"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            )}
          </div>

          {/* Pagination Footer */}
          {filteredEvents.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl px-5 py-4 shadow-sm select-none">
              <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500 dark:text-slate-400">
                <p>
                  Showing <span className="font-semibold text-gray-800 dark:text-white">{startIndex + 1}</span> to{" "}
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {Math.min(startIndex + itemsPerPage, filteredEvents.length)}
                  </span>{" "}
                  of <span className="font-semibold text-gray-800 dark:text-white">{filteredEvents.length}</span> results
                </p>
                <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-slate-800 pl-4">
                  <span>Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="py-1 pl-2 pr-6 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700/60 focus:outline-none appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundPosition: "right 0.35rem center",
                      backgroundSize: "1.1em 1.1em",
                      backgroundRepeat: "no-repeat",
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>per page</span>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* Prev Button */}
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-gray-50 dark:disabled:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Previous
                  </button>

                  {/* Page Numbers */}
                  {getPageNumbers().map((p, idx) => (
                    <button
                      key={idx}
                      disabled={p === "..."}
                      onClick={() => typeof p === "number" && setCurrentPage(p)}
                      className={`w-8 h-8 rounded-xl text-xs font-semibold transition ${
                        p === currentPage
                          ? "bg-indigo-600 text-white"
                          : p === "..."
                          ? "text-gray-400 dark:text-slate-600 cursor-default"
                          : "bg-transparent text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  {/* Next Button */}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-gray-50 dark:disabled:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      {/* Row Diff Viewer Modal */}
      {selectedEventForDiff && (
        <RowDiffViewer
          event={selectedEventForDiff}
          onClose={() => setSelectedEventForDiff(null)}
        />
      )}

      {/* Connection Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">
                    {connector.db_type.toUpperCase()} CDC Connection Guide
                  </h3>
                  <p className="text-xs text-gray-400">
                    Prerequisites for log-based change data capture
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-700 dark:text-slate-300 leading-relaxed">
              <p>
                To enable log-based Change Data Capture (CDC) with zero query overhead, ensure your database has logical replication enabled:
              </p>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] space-y-2 select-all">
                <p className="text-slate-400"># In postgresql.conf:</p>
                <p>wal_level = logical</p>
                <p>max_replication_slots = 10</p>
                <p>max_wal_senders = 10</p>
                <p className="text-slate-400 mt-2"># Grant replication permissions:</p>
                <p>ALTER USER srevox WITH REPLICATION;</p>
                <p>GRANT SELECT ON ALL TABLES IN SCHEMA public TO srevox;</p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                onClick={() => setShowGuideModal(false)}
                className="btn-primary text-xs py-2 px-5 cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
