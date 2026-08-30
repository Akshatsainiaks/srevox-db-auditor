"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Layers, RefreshCw, Calendar, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "@/lib/api";
import { type Cluster } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface PodsHealthHotspotsCardProps {
  cluster: Cluster;
  initialNodes: any[];
  initialPods: any[];
}

export default function PodsHealthHotspotsCard({ cluster, initialNodes, initialPods }: PodsHealthHotspotsCardProps) {
  const { success, error } = useToast();
  
  const [nodes, setNodes] = useState<any[]>(initialNodes);
  const [pods, setPods] = useState<any[]>(initialPods);
  const [loading, setLoading] = useState(false);
  const [podsError, setPodsError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // View Switcher: "hotspots" | "timeline"
  const [viewType, setViewType] = useState<"hotspots" | "timeline">("hotspots");

  // Auto Refresh States
  const [autoRefresh, setAutoRefresh] = useState<"off" | "5" | "10" | "custom">("off");
  const [customInterval, setCustomInterval] = useState<number>(30);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Time Range States
  const [timeRange, setTimeRange] = useState<"5m" | "10m" | "1h" | "3h" | "6h" | "24h" | "custom">("1h");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(false);

  const toastRef = useRef({ success, error });
  useEffect(() => {
    toastRef.current = { success, error };
  });

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedView = localStorage.getItem(`srevox_pods_hh_view_${cluster.cluster_id}`) as any;
      if (savedView) setViewType(savedView);

      const savedCust = localStorage.getItem(`srevox_pods_hh_custom_int_${cluster.cluster_id}`);
      if (savedCust) setCustomInterval(Number(savedCust));

      const savedRange = localStorage.getItem(`srevox_pods_hh_range_${cluster.cluster_id}`) as any;
      if (savedRange) setTimeRange(savedRange);

      const savedCollapsed = localStorage.getItem(`srevox_pods_hh_collapsed_${cluster.cluster_id}`);
      if (savedCollapsed) setCollapsed(savedCollapsed === "true");
    } catch {}
    setIsReady(true);
  }, [cluster.cluster_id]);

  // Persist state when modified
  useEffect(() => {
    if (!isReady) return;
    try {
      localStorage.setItem(`srevox_pods_hh_view_${cluster.cluster_id}`, viewType);
      localStorage.setItem(`srevox_pods_hh_auto_${cluster.cluster_id}`, autoRefresh);
      localStorage.setItem(`srevox_pods_hh_custom_int_${cluster.cluster_id}`, String(customInterval));
      localStorage.setItem(`srevox_pods_hh_range_${cluster.cluster_id}`, timeRange);
      localStorage.setItem(`srevox_pods_hh_collapsed_${cluster.cluster_id}`, String(collapsed));
    } catch {}
  }, [viewType, autoRefresh, customInterval, timeRange, collapsed, isReady, cluster.cluster_id]);

  const pollLiveData = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    setPodsError(null);
    try {
      if (isManual) {
        await api.post(`/api/clusters/${cluster.cluster_id}/refresh-metrics`);
      }
      const [nodesRes, podsRes] = await Promise.all([
        api.get(`/api/infrastructure/${cluster.cluster_id}/nodes`),
        api.get(`/api/infrastructure/${cluster.cluster_id}/pods`).catch(() => ({ data: { pods: [] } }))
      ]);
      setNodes(nodesRes.data.nodes || []);
      setPods(podsRes.data.pods || []);
      if (isManual) {
        toastRef.current.success("Pods health updated", "Pod health & Hotspots metrics refreshed.");
      }
    } catch (e: any) {
      setPodsError(e.response?.data?.detail || e.message);
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

      const res = await api.get(`/api/infrastructure/${cluster.cluster_id}/nodes/history`, { params });
      const rawHistory = res.data.history || [];

      // Group running pods logs by time
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

      const sorted = Array.from(groupedMap.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(r => ({
          time: r.time,
          pods: r.sumRunning
        }));

      setHistoryData(sorted);
    } catch (e: any) {
      console.error("Failed to fetch historical pod health logs:", e.message);
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

  // Sum running pods of nodes to match historical aggregated metrics
  const totalPods = nodes.length > 0
    ? nodes.reduce((acc, n) => acc + (n.pods_running || 0), 0)
    : pods.length;

  const totalRestarts = pods.reduce((acc, p) => acc + (p.restarts || 0), 0);
  const unhealthyPods = pods.filter(
    (p) =>
      p.status !== "Running" &&
      p.status !== "Succeeded" &&
      p.status !== "Completed"
  );

  if (!isReady) {
    return (
      <div className="border bg-white/70 dark:bg-[#13151f] border-gray-200 dark:border-slate-800 rounded-2xl h-[350px] flex flex-col justify-center items-center shadow-sm select-none">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <p className="text-[10px] text-gray-405 dark:text-slate-500 italic mt-2">Restoring dashboard preferences...</p>
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
            className="p-1 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-655 dark:hover:text-slate-305 transition-colors shrink-0"
            title={collapsed ? "Expand card" : "Collapse card"}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">Pods Health & Hotspots</h2>
          <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
            Pods Status
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
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/10 border border-gray-200 dark:border-slate-800 px-2 py-1 h-[28px] rounded-lg text-[10px] font-medium text-gray-555 dark:text-slate-400">
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

              {/* View Switcher toolbar */}
              <div className="flex items-center p-0.5 bg-gray-100 dark:bg-slate-900/60 rounded-xl border border-gray-200/50 dark:border-slate-800/40 text-[10px] font-bold text-gray-555">
                <button
                  onClick={() => setViewType("hotspots")}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    viewType === "hotspots"
                      ? "bg-white dark:bg-slate-800 text-indigo-655 dark:text-indigo-400 shadow-sm"
                      : "text-gray-400 hover:text-gray-655 dark:hover:text-slate-350"
                  }`}
                >
                  Hotspots
                </button>
                <button
                  onClick={() => setViewType("timeline")}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    viewType === "timeline"
                      ? "bg-white dark:bg-slate-800 text-indigo-655 dark:text-indigo-400 shadow-sm"
                      : "text-gray-400 hover:text-gray-655 dark:hover:text-slate-350"
                  }`}
                >
                  Timeline
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Auto Refresh options */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/10 border border-gray-205 dark:border-slate-800 px-2 py-1 h-[28px] rounded-lg text-[10px] font-medium text-gray-555 dark:text-slate-400">
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
                    className="w-10 bg-gray-55 dark:bg-slate-800 border border-gray-150 dark:border-slate-700/60 rounded px-1 text-center font-bold text-indigo-500 dark:text-indigo-400"
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
                  <span className="text-gray-355 dark:text-slate-700">to</span>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-transparent outline-none border-none text-gray-700 dark:text-slate-200"
                  />
                  <button
                    onClick={fetchHistoricalData}
                    className="ml-1 text-indigo-500 hover:text-indigo-650 font-bold uppercase tracking-wide text-[8px]"
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
                className="btn-secondary flex items-center gap-1.5 text-[10px] py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-55 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors font-bold disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Refresh
              </button>
            </div>
          </div>

          {viewType === "hotspots" ? (
            <>
              {/* Pods Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-slate-900/35 border border-gray-200/40 dark:border-slate-800/50 rounded-xl space-y-1">
                  <div className="text-gray-400 dark:text-slate-505 text-[9px] font-bold uppercase tracking-wider">Total Pods</div>
                  <div className="text-base font-extrabold text-gray-800 dark:text-slate-300">{totalPods}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-slate-900/35 border border-gray-200/40 dark:border-slate-800/50 rounded-xl space-y-1">
                  <div className="text-gray-400 dark:text-slate-505 text-[9px] font-bold uppercase tracking-wider">Restarts</div>
                  <div className={`text-base font-extrabold ${totalRestarts > 0 ? "text-red-500 animate-pulse" : "text-gray-800 dark:text-slate-300"}`}>{totalRestarts}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-slate-900/35 border border-gray-200/40 dark:border-slate-800/50 rounded-xl space-y-1">
                  <div className="text-gray-400 dark:text-slate-550 text-[9px] font-bold uppercase tracking-wider">Unhealthy</div>
                  <div className={`text-base font-extrabold ${unhealthyPods.length > 0 ? "text-amber-500" : "text-green-500"}`}>{unhealthyPods.length}</div>
                </div>
              </div>

              {/* Top 5 resource consuming pods */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold text-gray-505 dark:text-slate-455 uppercase tracking-wider block">Top Resource Hotspots (CPU / Memory)</span>
                
                {podsError ? (
                  <div className="py-8 text-center bg-red-50/5 dark:bg-red-500/5 border border-dashed border-red-200/50 dark:border-red-500/10 rounded-xl space-y-2 select-text">
                    <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
                    <div>
                      <p className="font-semibold text-gray-855 dark:text-slate-300 text-xs">Top Pod Telemetry Unavailable</p>
                      <p className="text-[10px] text-gray-455 dark:text-slate-500 max-w-xs mx-auto leading-relaxed mt-1">
                        {podsError}
                      </p>
                    </div>
                  </div>
                ) : pods.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-400 dark:text-slate-505 italic border border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                    No active pod resource telemetry reported.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                    {[...pods]
                      .sort((a, b) => (b.memory_usage_mi || 0) - (a.memory_usage_mi || 0))
                      .slice(0, 5)
                      .map(pod => (
                        <div key={`${pod.namespace}/${pod.name}`} className="flex items-center justify-between p-2.5 bg-gray-50/50 dark:bg-slate-900/15 border border-gray-200/30 dark:border-slate-800/40 rounded-xl hover:bg-gray-100/50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-[11px] text-gray-855 dark:text-slate-200 truncate" title={pod.name}>{pod.name}</span>
                              {pod.restarts > 0 && (
                                <span className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-500 text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                                  {pod.restarts} restarts
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-gray-400 dark:text-slate-550 mt-0.5 truncate">{pod.namespace}</div>
                          </div>
                          <div className="text-right shrink-0 font-mono text-[10px] space-y-0.5 text-gray-500 dark:text-slate-405">
                            <div className="font-bold text-gray-700 dark:text-slate-300">{pod.memory_usage_mi} <span className="text-[8px] font-normal">Mi</span></div>
                            <div className="text-[9px]">{pod.cpu_usage_m} <span className="text-[8px] font-normal">m</span></div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-150/40 dark:border-slate-800/80 pb-2">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-455 dark:text-slate-500 uppercase tracking-wider font-bold">
                  <Calendar className="w-3.5 h-3.5" />
                  Historical Pod Count Timeline
                </div>
              </div>
              
              <div className="h-56 w-full text-xs text-gray-500 dark:text-slate-405 relative">
                {loading && historyData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center italic text-gray-400 dark:text-slate-500">
                    No historical pod telemetry logs.
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
                      <Area type="monotone" dataKey="pods" name="Running Pods" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.15} fill="#3b82f6" />
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
