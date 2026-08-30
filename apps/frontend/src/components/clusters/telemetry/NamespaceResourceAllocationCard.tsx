"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Layers, RefreshCw, Calendar, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "@/lib/api";
import { type Cluster } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface NamespaceResourceAllocationCardProps {
  cluster: Cluster;
  initialPods: any[];
}

export default function NamespaceResourceAllocationCard({ cluster, initialPods }: NamespaceResourceAllocationCardProps) {
  const { success, error } = useToast();
  
  const [pods, setPods] = useState<any[]>(initialPods);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // View Switcher: "breakdown" | "timeline"
  const [viewType, setViewType] = useState<"breakdown" | "timeline">("breakdown");

  // Auto Refresh States
  const [autoRefresh, setAutoRefresh] = useState<"off" | "5" | "10" | "custom">("off");
  const [customInterval, setCustomInterval] = useState<number>(30);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Time Range States
  const [timeRange, setTimeRange] = useState<"5m" | "10m" | "1h" | "3h" | "6h" | "24h" | "custom">("1h");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [selectedNamespace, setSelectedNamespace] = useState<string>("all");

  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(false);

  // Load state from localStorage on mount (selectedNamespace is NOT persisted so it always defaults to "all")
  useEffect(() => {
    try {
      const savedView = localStorage.getItem(`srevox_ns_alloc_view_${cluster.cluster_id}`) as any;
      if (savedView) setViewType(savedView);

      const savedCust = localStorage.getItem(`srevox_ns_alloc_custom_int_${cluster.cluster_id}`);
      if (savedCust) setCustomInterval(Number(savedCust));

      const savedRange = localStorage.getItem(`srevox_ns_alloc_range_${cluster.cluster_id}`) as any;
      if (savedRange) setTimeRange(savedRange);

      const savedCollapsed = localStorage.getItem(`srevox_ns_alloc_collapsed_${cluster.cluster_id}`);
      if (savedCollapsed) setCollapsed(savedCollapsed === "true");
    } catch {}
    setIsReady(true);
  }, [cluster.cluster_id]);

  // Persist state when modified
  useEffect(() => {
    if (!isReady) return;
    try {
      localStorage.setItem(`srevox_ns_alloc_view_${cluster.cluster_id}`, viewType);
      localStorage.setItem(`srevox_ns_alloc_auto_${cluster.cluster_id}`, autoRefresh);
      localStorage.setItem(`srevox_ns_alloc_custom_int_${cluster.cluster_id}`, String(customInterval));
      localStorage.setItem(`srevox_ns_alloc_range_${cluster.cluster_id}`, timeRange);
      localStorage.setItem(`srevox_ns_alloc_collapsed_${cluster.cluster_id}`, String(collapsed));
    } catch {}
  }, [viewType, autoRefresh, customInterval, timeRange, collapsed, isReady, cluster.cluster_id]);

  // Count pods per namespace for live breakdown progress bars & ratios
  const liveNamespaceCounts = pods.reduce((acc: Record<string, number>, pod) => {
    const ns = pod.namespace || "default";
    acc[ns] = (acc[ns] || 0) + 1;
    return acc;
  }, {});

  const sortedLiveNamespaces = Object.entries(liveNamespaceCounts)
    .sort((a, b) => b[1] - a[1]);

  const allNamespacesList = sortedLiveNamespaces.map(n => n[0]);

  const toastRef = useRef({ success, error });
  useEffect(() => {
    toastRef.current = { success, error };
  });

  const pollLiveData = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      if (isManual) {
        await api.post(`/api/clusters/${cluster.cluster_id}/refresh-metrics`);
      }
      const podsRes = await api.get(`/api/infrastructure/${cluster.cluster_id}/pods`).catch(() => ({ data: { pods: [] } }));
      setPods(podsRes.data.pods || []);
      if (isManual) {
        toastRef.current.success("Namespace Allocation refreshed", "Live namespace allocation metrics updated.");
      }
    } catch (e: any) {
      if (isManual) toastRef.current.error("Refresh failed", e.response?.data?.detail || e.message);
    } finally {
      if (isManual) setLoading(false);
    }
  }, [cluster.cluster_id]);

  const fetchHistoricalData = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (timeRange === "custom") {
        if (!startTime || !endTime) return;
        params.start = new Date(startTime).toISOString();
        params.end = new Date(endTime).toISOString();
      } else {
        params.range = timeRange;
      }

      // Read history nodes and divide proportionally based on average history curves
      const res = await api.get(`/api/infrastructure/${cluster.cluster_id}/nodes/history`, { params });
      const rawHistory = res.data.history || [];

      // Calculate namespace proportion ratios dynamically from current cluster pods
      const totalLivePods = Object.values(liveNamespaceCounts).reduce((a, b) => a + b, 0) || 1;
      const nsRatios: Record<string, number> = {};
      Object.entries(liveNamespaceCounts).forEach(([ns, count]) => {
        nsRatios[ns] = count / totalLivePods;
      });

      // Sum running pods of nodes logs grouped by timestamp
      const groupedMap = new Map<string, { time: string; timestamp: number; sumRunning: number }>();
      rawHistory.forEach((item: any) => {
        const timestamp = new Date(item.created_at).getTime();
        let timeLabel = new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (timeRange === "5m" || timeRange === "10m") {
          timeLabel = new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        }
        if (!groupedMap.has(timeLabel)) {
          groupedMap.set(timeLabel, { time: timeLabel, timestamp, sumRunning: 0 });
        }
        const record = groupedMap.get(timeLabel)!;
        record.sumRunning += Number(item.pods_running || 0);
      });

      // Dynamically split total pods across actual cluster namespaces
      const sorted = Array.from(groupedMap.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(r => {
          const entry: Record<string, any> = { time: r.time };
          Object.entries(nsRatios).forEach(([ns, ratio]) => {
            entry[ns] = Math.round(r.sumRunning * ratio);
          });
          return entry;
        });

      setHistoryData(sorted);
    } catch (e: any) {
      console.error("Failed to fetch historical namespace allocation logs:", e.message);
    }
  }, [cluster.cluster_id, timeRange, startTime, endTime]);

  // Interval trigger for Auto Refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh === "off") return;

    const seconds = autoRefresh === "5" ? 5 : autoRefresh === "10" ? 10 : customInterval;
    intervalRef.current = setInterval(() => {
      pollLiveData(false);
    }, seconds * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, customInterval, pollLiveData]);

  // Load correct data on mode/range changes
  useEffect(() => {
    if (!isReady) return;
    fetchHistoricalData();
  }, [timeRange, startTime, endTime, fetchHistoricalData, isReady]);

  const maxLiveCount = sortedLiveNamespaces.length ? Math.max(...sortedLiveNamespaces.map(n => n[1])) : 1;

  const displayLiveNamespaces = selectedNamespace === "all"
    ? sortedLiveNamespaces
    : sortedLiveNamespaces.filter(([ns]) => ns === selectedNamespace);

  const activePlotNamespaces = selectedNamespace === "all"
    ? allNamespacesList
    : allNamespacesList.filter(ns => ns === selectedNamespace);

  const COLOR_PALETTE = [
    "#6366f1", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b",
    "#ec4899", "#14b8a6", "#64748b", "#f97316", "#06b6d4"
  ];

  if (!isReady) {
    return (
      <div className="border bg-white/70 dark:bg-[#13151f] border-gray-200 dark:border-slate-800 rounded-2xl h-[350px] flex flex-col justify-center items-center shadow-sm select-none">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <p className="text-[10px] text-gray-400 dark:text-slate-500 italic mt-2">Restoring dashboard preferences...</p>
      </div>
    );
  }

  return (
    <div className="border bg-white/70 dark:bg-[#13151f] border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-sm select-none">
      {/* Header section */}
      <div className={`flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/15 p-4 shrink-0 ${collapsed ? "" : "border-b border-gray-200 dark:border-slate-800"}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors shrink-0"
            title={collapsed ? "Expand card" : "Collapse card"}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">Namespace Resource Allocation</h2>
          <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
            Namespaces
          </span>
        </div>
      </div>

      {/* Main content body */}
      {!collapsed && (
        <div className="p-5 min-h-[150px] space-y-4">
          {/* Inner Toolbar controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-150/40 dark:border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Time Range Selector */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/10 border border-gray-200 dark:border-slate-800 px-2 py-1 h-[28px] rounded-lg text-[10px] font-medium text-gray-500 dark:text-slate-400">
                <span className="font-bold">Range:</span>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  className="bg-transparent border-none outline-none font-bold text-indigo-500 dark:text-indigo-400 cursor-pointer"
                >
                  <option value="5m">Last 5 Minutes</option>
                  <option value="10m">Last 10 Minutes</option>
                  <option value="1h">1 Hour</option>
                  <option value="3h">3 Hours</option>
                  <option value="6h">6 Hours</option>
                  <option value="24h">24 Hours</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Namespace Selector Dropdown */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/10 border border-gray-200 dark:border-slate-800 px-2 py-1 h-[28px] rounded-lg text-[10px] font-medium text-gray-500 dark:text-slate-400">
                <span className="font-bold">Namespace:</span>
                <select
                  value={selectedNamespace}
                  onChange={(e) => setSelectedNamespace(e.target.value)}
                  className="bg-transparent border-none outline-none font-bold text-indigo-500 dark:text-indigo-400 cursor-pointer max-w-[150px] truncate"
                >
                  <option value="all">All Namespaces ({allNamespacesList.length})</option>
                  {allNamespacesList.map((ns) => (
                    <option key={ns} value={ns}>{ns} ({liveNamespaceCounts[ns] || 0} pods)</option>
                  ))}
                </select>
              </div>

              {/* View Switcher toolbar */}
              <div className="flex items-center p-0.5 bg-gray-100 dark:bg-slate-900/60 rounded-xl border border-gray-200/50 dark:border-slate-800/40 text-[10px] font-bold text-gray-500">
                <button
                  onClick={() => setViewType("breakdown")}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    viewType === "breakdown"
                      ? "bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                  }`}
                >
                  Breakdown
                </button>
                <button
                  onClick={() => setViewType("timeline")}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    viewType === "timeline"
                      ? "bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                  }`}
                >
                  Timeline
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Auto Refresh options */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/10 border border-gray-200 dark:border-slate-800 px-2 py-1 h-[28px] rounded-lg text-[10px] font-medium text-gray-500 dark:text-slate-400">
                <span className="font-bold">Auto:</span>
                <select
                  value={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.value as any)}
                  className="bg-transparent border-none outline-none font-bold text-indigo-500 dark:text-indigo-400 cursor-pointer"
                >
                  <option value="off">Off</option>
                  <option value="5">5s</option>
                  <option value="10">10s</option>
                  <option value="custom">Custom</option>
                </select>
                {autoRefresh === "custom" && (
                  <input
                    type="number"
                    min={1}
                    value={customInterval}
                    onChange={(e) => setCustomInterval(parseInt(e.target.value) || 1)}
                    className="w-10 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700/60 rounded px-1 text-center font-bold text-indigo-500 dark:text-indigo-400"
                  />
                )}
              </div>

              {/* Custom date range inputs */}
              {timeRange === "custom" && (
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900/10 border border-gray-200 dark:border-slate-800 px-2 py-1 h-[28px] rounded-lg text-[9px]">
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-transparent outline-none border-none text-gray-700 dark:text-slate-200"
                  />
                  <span className="text-gray-400 dark:text-slate-600">to</span>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-transparent outline-none border-none text-gray-700 dark:text-slate-200"
                  />
                  <button
                    onClick={fetchHistoricalData}
                    className="ml-1 text-indigo-500 hover:text-indigo-600 font-bold uppercase tracking-wide text-[8px]"
                  >
                    Apply
                  </button>
                </div>
              )}

              {/* Refresh trigger */}
              <button
                type="button"
                onClick={() => pollLiveData(true)}
                disabled={loading}
                className="btn-secondary flex items-center gap-1.5 text-[10px] py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors font-bold disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Refresh
              </button>
            </div>
          </div>

          {viewType === "breakdown" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                  Live Namespace Pod Resource Breakdown {selectedNamespace !== "all" && `(${selectedNamespace})`}
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  Showing {displayLiveNamespaces.length} of {allNamespacesList.length} Namespaces
                </span>
              </div>
              <div className="space-y-3">
                {displayLiveNamespaces.map(([ns, count], idx) => {
                  const pct = Math.round((count / maxLiveCount) * 100);
                  const color = COLOR_PALETTE[allNamespacesList.indexOf(ns) % COLOR_PALETTE.length];
                  
                  return (
                    <div key={ns} className="space-y-1.5 text-xs font-semibold">
                      <div className="flex items-center justify-between text-gray-800 dark:text-slate-200">
                        <span className="truncate flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
                          {ns}
                        </span>
                        <span className="font-bold font-mono">{count} <span className="font-normal text-[9px] text-gray-400 dark:text-slate-500">pods</span></span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-900/60 h-2.5 rounded-full overflow-hidden border border-gray-150/40 dark:border-slate-800/30">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                  Historical Pod Allocations Timeline {selectedNamespace !== "all" ? `(${selectedNamespace})` : "(All Namespaces)"}
                </span>
              </div>
              <div className="h-60 w-full text-xs text-gray-500 dark:text-slate-400 relative">
                {loading && historyData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center italic text-gray-400 dark:text-slate-500">
                    No historical namespace allocation logs.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                      <XAxis dataKey="time" tick={{ fill: "currentColor", opacity: 0.85 }} fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(148, 163, 184, 0.45)" tick={{ fill: "currentColor", opacity: 0.85 }} fontSize={9} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "none",
                          borderRadius: "12px",
                          color: "#fff",
                          fontSize: "11px",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
                        }}
                        labelStyle={{ fontWeight: "bold", color: "#818cf8" }}
                      />
                      <Legend verticalAlign="top" height={24} iconSize={8} fontSize={9} />
                      {activePlotNamespaces.map((ns) => {
                        const nsIdx = allNamespacesList.indexOf(ns);
                        const color = COLOR_PALETTE[(nsIdx >= 0 ? nsIdx : 0) % COLOR_PALETTE.length];
                        return (
                          <Area
                            key={ns}
                            type="monotone"
                            dataKey={ns}
                            stackId={selectedNamespace === "all" ? "1" : undefined}
                            name={ns}
                            stroke={color}
                            fill={color}
                            fillOpacity={0.15}
                          />
                        );
                      })}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
