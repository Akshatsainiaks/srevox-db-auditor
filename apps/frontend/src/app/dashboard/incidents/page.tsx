"use client";
import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, RefreshCw, ArrowRight, Search, Server, Trash2, ShieldCheck } from "lucide-react";
import { api, fetchIncidents, fetchClusters, deleteIncident, bulkAcknowledgeIncidents, bulkResolveIncidents, bulkDeleteIncidents } from "@/lib/api";
import type { Incident, Cluster } from "@/lib/utils";
import { timeAgo, severityBadge, statusBadge, severityDot } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { getUser, hasPermission } from "@/lib/auth";

const STATUSES   = ["", "open", "acknowledged", "resolved"] as const;
const SEVERITIES = ["", "critical", "warning", "info"]      as const;


function IncidentsList() {
  const searchParams = useSearchParams();
  const clusterParam = searchParams.get("cluster_id") || "";

  const [incidents,  setIncidents]  = useState<Incident[]>([]);
  const [clusters,   setClusters]   = useState<Cluster[]>([]);
  const [clusterFilter, setClusterFilter] = useState(clusterParam);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status,     setStatus]     = useState("");
  const [severity,   setSeverity]   = useState("");
  const [search,     setSearch]     = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);
  const [me,         setMe]         = useState<any>(null);

  useEffect(() => {
    setClusterFilter(clusterParam);
    setMe(getUser());
  }, [clusterParam]);

  const { success, error: toastError } = useToast();
  const { confirm } = useConfirm();


  const [authorized, setAuthorized] = useState(true);
  const toastShownRef = useRef(false);

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    const params: Record<string, string> = { limit: "1000" };
    if (status)   params.status   = status;
    if (severity) params.severity = severity;
    if (clusterFilter) params.cluster_id = clusterFilter;
    
    try {
      const [incData, clData] = await Promise.all([
        fetchIncidents(params),
        fetchClusters().catch(() => ({ clusters: [] }))
      ]);
      setIncidents(incData.incidents || []);
      setClusters(clData.clusters || []);
      setAuthorized(true);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 403) {
        setAuthorized(false);
        if (!toastShownRef.current) {
          toastError("Access restricted: You do not have permission to view incidents.");
          toastShownRef.current = true;
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, severity, clusterFilter]);

  const isInitialMount = useRef(true);

  useEffect(() => {
    const user = getUser();
    if (!hasPermission(user, "viewIncidents")) {
      setAuthorized(false);
      setLoading(false);
      if (!toastShownRef.current) {
        toastError("Permission Required: You do not have permission to view incidents.");
        toastShownRef.current = true;
      }
      return;
    }
    if (isInitialMount.current) {
      isInitialMount.current = false;
      load();

      // Audit page view (only once on load)
      if (user) {
        fetch("/api/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            org_id: user.org_id || "default",
            user_id: user.user_id,
            action: "view_incidents_list",
            resource: "incidents_page",
            resource_id: "incidents",
            metadata: { path: window.location.pathname }
          })
        }).catch(() => {});
      }
    } else {
      load(true);
    }
  }, [load]);

  // Reset page and selection when filters or search change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [search, status, severity, clusterFilter]);

  // Reset selection when page changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage]);

  const filtered = incidents.filter((i) =>
    !search ||
    i.pod_name.toLowerCase().includes(search.toLowerCase()) ||
    i.namespace.toLowerCase().includes(search.toLowerCase()) ||
    i.crash_reason.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedIncidents = filtered.slice(startIndex, startIndex + itemsPerPage);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedIncidents.length && paginatedIncidents.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedIncidents.map((i) => i.incident_id)));
    }
  };

  const handleDelete = async (id: string) => {
    const { confirmed } = await confirm({
      title: "Delete incident?",
      message: "Are you sure you want to delete this incident? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await deleteIncident(id);
      success("Incident deleted successfully");
      window.dispatchEvent(new Event("sv_notifications_changed"));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      load(true);
    } catch {
      toastError("Failed to delete incident");
    }
  };

  const handleBulkAcknowledge = async () => {
    setBulkActing(true);
    try {
      await bulkAcknowledgeIncidents(Array.from(selectedIds));
      success("Selected incidents acknowledged");
      window.dispatchEvent(new Event("sv_notifications_changed"));
      setSelectedIds(new Set());
      load(true);
    } catch {
      toastError("Failed to acknowledge selected incidents");
    } finally {
      setBulkActing(false);
    }
  };

  const handleBulkResolve = async () => {
    const { confirmed } = await confirm({
      title: "Resolve selected incidents?",
      message: `Are you sure you want to resolve the ${selectedIds.size} selected incidents?`,
      confirmLabel: "Resolve",
      variant: "info",
    });
    if (!confirmed) return;
    setBulkActing(true);
    try {
      await bulkResolveIncidents(Array.from(selectedIds));
      success("Selected incidents marked as resolved");
      window.dispatchEvent(new Event("sv_notifications_changed"));
      setSelectedIds(new Set());
      load(true);
    } catch {
      toastError("Failed to resolve selected incidents");
    } finally {
      setBulkActing(false);
    }
  };

  const handleBulkDelete = async () => {
    const { confirmed } = await confirm({
      title: "Delete selected incidents?",
      message: `Are you sure you want to delete the ${selectedIds.size} selected incidents? This action cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    setBulkActing(true);
    try {
      await bulkDeleteIncidents(Array.from(selectedIds));
      success("Selected incidents deleted");
      window.dispatchEvent(new Event("sv_notifications_changed"));
      setSelectedIds(new Set());
      load(true);
    } catch {
      toastError("Failed to delete selected incidents");
    } finally {
      setBulkActing(false);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
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

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`viewIncidents`) to view container incident failure logs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Incidents</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">All pod crash events across your clusters</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className="btn-secondary flex items-center gap-1.5 text-xs py-2.5 px-3.5">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div id="incidents-filter" className="bg-white dark:bg-[#151823] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 py-2" placeholder="Search pods, namespaces..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input py-2 text-sm w-40 bg-white dark:bg-[#111422] border border-gray-200 dark:border-slate-800 rounded-xl text-gray-600 dark:text-slate-300"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All Statuses"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="input py-2 text-sm w-40 bg-white dark:bg-[#111422] border border-gray-200 dark:border-slate-800 rounded-xl text-gray-600 dark:text-slate-300"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All Severities"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="input py-2 text-sm w-48 bg-white dark:bg-[#111422] border border-gray-200 dark:border-slate-800 rounded-xl text-gray-600 dark:text-slate-300"
          >
            <option value="">All Clusters</option>
            {clusters.map((c) => (
              <option key={c.cluster_id} value={c.cluster_id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">{filtered.length} results</span>
      </div>

      {/* List */}
      <div id="incidents-list" className="card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 dark:bg-slate-800 rounded w-48" />
                  <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <AlertTriangle className="w-10 h-10 text-gray-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="font-medium text-gray-500 dark:text-slate-400">No incidents found</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">{search ? "Try different search terms" : "Your pods are healthy 🎉"}</p>
          </div>
        ) : (
          <div>
            {/* Selection & Bulk Actions Header */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center gap-4 bg-gray-50/50 dark:bg-[#0d0f17]/60">
              <input
                type="checkbox"
                checked={paginatedIncidents.length > 0 && selectedIds.size === paginatedIncidents.length}
                onChange={toggleSelectAll}
                className="rounded border-gray-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              {selectedIds.size > 0 ? (
                <div className="flex items-center gap-4 flex-1">
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {selectedIds.size} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={bulkActing}
                      onClick={handleBulkAcknowledge}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50 transition"
                    >
                      Acknowledge
                    </button>
                    <button
                      disabled={bulkActing}
                      onClick={handleBulkResolve}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20 disabled:opacity-50 transition"
                    >
                      Mark Resolved
                    </button>
                    {hasPermission(me, "deleteIncident") && (
                      <button
                        disabled={bulkActing}
                        onClick={handleBulkDelete}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 transition"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                  Select incidents to perform bulk actions
                </span>
              )}
            </div>

            <div className="divide-y divide-gray-50 dark:divide-slate-800">
              {paginatedIncidents.map((inc) => (
                <div key={inc.incident_id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors group">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(inc.incident_id)}
                    onChange={() => toggleSelect(inc.incident_id)}
                    className="rounded border-gray-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <Link href={`/dashboard/incidents/${inc.incident_id}`}
                    className="flex-1 flex items-center gap-4 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${severityDot(inc.severity)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[220px]">{inc.pod_name}</span>
                        <span className={`badge text-xs ${severityBadge(inc.severity)}`}>{inc.crash_reason}</span>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="font-medium text-gray-500 dark:text-slate-400">{inc.namespace}</span>·
                        <span>{inc.restart_count} restarts</span>·
                        <span>First: {timeAgo(inc.first_seen_at)}</span>·
                        <span>Last: {timeAgo(inc.last_seen_at)}</span>
                        {inc.cluster_name && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 text-indigo-500 dark:text-indigo-400 font-medium">
                              <Server className="w-3 h-3" />
                              {inc.cluster_name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0 min-w-[100px]">
                      <span className={`badge text-xs ${statusBadge(inc.status)}`}>{inc.status}</span>
                      {inc.status === "acknowledged" && inc.acknowledged_by_name && (
                        <span className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 truncate max-w-[90px]">by {inc.acknowledged_by_name}</span>
                      )}
                      {inc.status === "resolved" && inc.resolved_by_name && (
                        <span className="text-[10px] font-semibold text-green-500 dark:text-green-400 truncate max-w-[90px]">by {inc.resolved_by_name}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-slate-500 w-16 text-right hidden sm:block shrink-0">{inc.severity}</span>
                  </Link>
                  {hasPermission(me, "deleteIncident") && (
                    <button
                      onClick={() => handleDelete(inc.incident_id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                      title="Delete incident"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-[#151823] border border-gray-100 dark:border-slate-800 rounded-2xl px-5 py-4 shadow-sm select-none">
          <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500 dark:text-slate-400">
            <p>
              Showing <span className="font-semibold text-gray-800 dark:text-white">{startIndex + 1}</span> to{" "}
              <span className="font-semibold text-gray-800 dark:text-white">
                {Math.min(startIndex + itemsPerPage, filtered.length)}
              </span>{" "}
              of <span className="font-semibold text-gray-800 dark:text-white">{filtered.length}</span> results
            </p>
            <div className="flex items-center gap-1.5 border-l border-gray-150 dark:border-slate-800/80 pl-4">
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
                  backgroundPosition: 'right 0.35rem center',
                  backgroundSize: '1.1em 1.1em',
                  backgroundRepeat: 'no-repeat',
                }}
              >
                <option value={20}>20</option>
                <option value={30}>30</option>
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
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-gray-50 dark:disabled:hover:bg-slate-800 transition"
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
                      : "bg-transparent text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {p}
                </button>
              ))}

              {/* Next Button */}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-gray-50 dark:disabled:hover:bg-slate-800 transition"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 dark:bg-slate-800 rounded w-48" />
          <div className="h-9 w-24 bg-gray-200 dark:bg-slate-800 rounded" />
        </div>
        <div className="h-14 bg-gray-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-96 bg-gray-200 dark:bg-slate-800 rounded-2xl" />
      </div>
    }>
      <IncidentsList />
    </Suspense>
  );
}