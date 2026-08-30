"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { 
  ArrowLeft, Search, ChevronLeft, ChevronRight, 
  ArrowUpDown, AlertTriangle, Calendar, Filter
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface PodCrashItem {
  pod_name: string;
  namespace: string;
  count: number;
}

function PodsContent() {
  const searchParams = useSearchParams();
  const { error } = useToast();

  // Date Range state
  const [timeframeMode, setTimeframeMode] = useState<"preset" | "custom">("preset");
  const [preset, setPreset] = useState("30d");
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");

  // Grid / Table states
  const [items, setItems] = useState<PodCrashItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"count" | "pod_name" | "namespace">("count");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Initialize dates from query params if present
  useEffect(() => {
    const queryStart = searchParams.get("start_date");
    const queryEnd = searchParams.get("end_date");
    if (queryStart && queryEnd) {
      setTimeframeMode("custom");
      // Convert ISO to local input format (YYYY-MM-DDTHH:mm)
      try {
        const d1 = new Date(queryStart);
        const d2 = new Date(queryEnd);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
          setStartDateStr(new Date(d1.getTime() - d1.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
          setEndDateStr(new Date(d2.getTime() - d2.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        }
      } catch {}
    }
  }, [searchParams]);

  const getComputedRange = () => {
    if (timeframeMode === "custom") {
      return {
        start: startDateStr ? new Date(startDateStr).toISOString() : "",
        end: endDateStr ? new Date(endDateStr).toISOString() : ""
      };
    }
    const end = new Date();
    const start = new Date();
    if (preset === "24h") {
      start.setHours(start.getHours() - 24);
    } else if (preset === "7d") {
      start.setDate(start.getDate() - 7);
    } else if (preset === "30d") {
      start.setDate(start.getDate() - 30);
    } else if (preset === "90d") {
      start.setDate(start.getDate() - 90);
    }
    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  };

  const loadPods = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const { start, end } = getComputedRange();
      const offset = (page - 1) * limit;

      const res = await api.get("/api/incidents/analytics/top-pods", {
        params: {
          start_date: start,
          end_date: end,
          search: search || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
          limit: limit.toString(),
          offset: offset.toString()
        }
      });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
      error("Failed to load top crashed pods");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      loadPods(false);
    } else {
      loadPods(true);
    }
  }, [preset, timeframeMode, page, limit, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadPods();
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortOrder(p => p === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      
      {/* Back link */}
      <div>
        <Link href="/dashboard/analytics" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-650 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors group select-none">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Analytics
        </Link>
      </div>

      {/* Header and Filter panel */}
      <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
              Top Crashed Pods
            </h1>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Analyze pod failures with high restart frequencies. Sort, search, and page through records.
            </p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
            {/* Timeframe selector */}
            <div className="flex bg-gray-50 dark:bg-slate-900 p-0.5 border border-gray-150 dark:border-slate-800/60 rounded-xl">
              <button
                onClick={() => setTimeframeMode("preset")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  timeframeMode === "preset"
                    ? "bg-white dark:bg-[#13151f] text-indigo-650 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Presets
              </button>
              <button
                onClick={() => setTimeframeMode("custom")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  timeframeMode === "custom"
                    ? "bg-white dark:bg-[#13151f] text-indigo-650 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Custom Range
              </button>
            </div>
          </div>
        </div>

        {/* Date picking row */}
        <div className="border-t border-gray-100 dark:border-slate-800/80 pt-4 flex flex-wrap items-center justify-between gap-4">
          {timeframeMode === "preset" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 mr-2 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                Timeframe:
              </span>
              {[
                { id: "24h", label: "Past 24 Hours" },
                { id: "7d", label: "Past 7 Days" },
                { id: "30d", label: "Past 30 Days" },
                { id: "90d", label: "Past 90 Days" }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPreset(p.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                    preset === p.id
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20"
                      : "bg-transparent border-gray-150 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); setPage(1); loadPods(); }} className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-450 dark:text-slate-550 block">Start Date & Time</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={startDateStr}
                    onChange={e => setStartDateStr(e.target.value)}
                    required
                    className="pl-9 pr-3 py-1 text-xs font-semibold rounded-xl border border-gray-150 dark:border-slate-800 bg-transparent text-gray-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  />
                  <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-450 dark:text-slate-550 block">End Date & Time</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={endDateStr}
                    onChange={e => setEndDateStr(e.target.value)}
                    required
                    className="pl-9 pr-3 py-1 text-xs font-semibold rounded-xl border border-gray-150 dark:border-slate-800 bg-transparent text-gray-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  />
                  <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <button 
                type="submit"
                className="btn-primary py-1.5 px-4 text-xs font-bold"
              >
                Apply
              </button>
            </form>
          )}

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="relative max-w-sm w-full md:w-80">
            <input
              type="text"
              placeholder="Search pod name or namespace..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-150 dark:border-slate-800 bg-transparent text-gray-700 dark:text-slate-200 placeholder-gray-400 focus:ring-1 focus:ring-indigo-500"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </form>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card overflow-hidden border border-gray-150 dark:border-slate-800/80 bg-white dark:bg-[#13151f] rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-[#0c0d12]/45 text-[10px] uppercase tracking-wider text-gray-450 dark:text-slate-500 font-bold select-none">
                <th className="px-6 py-4 w-20">Rank</th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100/30 dark:hover:bg-slate-800/20" onClick={() => toggleSort("pod_name")}>
                  <div className="flex items-center gap-1.5">
                    Pod Name
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100/30 dark:hover:bg-slate-800/20" onClick={() => toggleSort("namespace")}>
                  <div className="flex items-center gap-1.5">
                    Namespace
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100/30 dark:hover:bg-slate-800/20" onClick={() => toggleSort("count")}>
                  <div className="flex items-center gap-1.5">
                    Crash Count
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/85">
              {loading ? (
                [...Array(limit)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-8" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-48" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-24" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-16" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-xs text-gray-400 dark:text-slate-500 font-semibold">
                    No crashed pods found in this date range.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const rank = (page - 1) * limit + idx + 1;
                  return (
                    <tr key={idx} className="hover:bg-gray-50/30 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-400 dark:text-slate-550 text-xs">
                        #{rank}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-gray-905 dark:text-white font-mono truncate max-w-xs">
                        {item.pod_name}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className="px-2 py-1 bg-gray-50 dark:bg-slate-900 border border-gray-150 dark:border-slate-800 text-gray-600 dark:text-slate-400 rounded-lg font-semibold font-mono">
                          {item.namespace}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className="font-extrabold text-red-500 bg-red-50/50 dark:bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-100/30 dark:border-red-500/10">
                          {item.count} crashes
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer pagination */}
        {!loading && items.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-[#0c0d12]/20 flex items-center justify-between gap-4 flex-wrap text-xs select-none">
            <span className="text-gray-400 dark:text-slate-500 font-semibold">
              Showing <strong className="text-gray-700 dark:text-slate-200">{(page - 1) * limit + 1}</strong> to{" "}
              <strong className="text-gray-700 dark:text-slate-200">{Math.min(total, page * limit)}</strong> of{" "}
              <strong className="text-gray-700 dark:text-slate-200">{total}</strong> pods
            </span>

            <div className="flex items-center gap-4">
              {/* Limit Picker */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 dark:text-slate-500">Rows per page:</span>
                <select
                  value={limit}
                  onChange={e => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-transparent border border-gray-150 dark:border-slate-800 rounded-lg px-2 py-1 cursor-pointer font-bold text-gray-700 dark:text-slate-300"
                >
                  {[10, 20, 50].map(v => (
                    <option key={v} value={v} className="bg-white dark:bg-[#13151f]">
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prev / Next buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-150 dark:border-slate-800 hover:bg-gray-55 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-semibold text-gray-500 dark:text-slate-400 px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-150 dark:border-slate-800 hover:bg-gray-55 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default function TopCrashedPodsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-6 w-32 bg-gray-100 dark:bg-slate-800 rounded" />
        <div className="h-20 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
        <div className="h-96 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
      </div>
    }>
      <PodsContent />
    </Suspense>
  );
}
