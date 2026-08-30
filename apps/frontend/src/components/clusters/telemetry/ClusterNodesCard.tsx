"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Network, RefreshCw, Calendar, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "@/lib/api";
import { type Cluster } from "@/lib/utils";
import NodeRow from "@/components/dashboard/NodeRow";
import { useToast } from "@/components/Toast";

let hasNavigatedAway = false;

interface ClusterNodesCardProps {
  cluster: Cluster;
  initialNodes: any[];
  initialError: string | null;
}

export default function ClusterNodesCard({ cluster, initialNodes, initialError }: ClusterNodesCardProps) {
  const { success, error } = useToast();
  const [nodes, setNodes] = useState<any[]>(initialNodes);
  const [nodesError, setNodesError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  // View Type: "nodes" | "chart"
  const [viewType, setViewType] = useState<"nodes" | "chart">("nodes");

  // Auto Refresh States
  const [autoRefresh, setAutoRefresh] = useState<"off" | "5" | "10" | "custom">("off");
  const [customInterval, setCustomInterval] = useState<number>(30);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Time Range States
  const [timeRange, setTimeRange] = useState<"5m" | "10m" | "1h" | "3h" | "6h" | "24h" | "custom">("1h");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Timeline chart data
  const [chartData, setChartData] = useState<any[]>(() => {
    try {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(`srevox_telemetry_history_${cluster.cluster_id}`);
        return cached ? JSON.parse(cached) : [];
      }
    } catch {}
    return [];
  });
  const [chartMetric, setChartMetric] = useState<"cpu" | "memory" | "both">("cpu");

  const [collapsed, setCollapsed] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Persist settings to localStorage when changed
  useEffect(() => {
    if (!isReady) return;
    try {
      localStorage.setItem(`srevox_nodes_view_${cluster.cluster_id}`, viewType);
      localStorage.setItem(`srevox_nodes_auto_refresh_${cluster.cluster_id}`, autoRefresh);
      localStorage.setItem(`srevox_nodes_custom_interval_${cluster.cluster_id}`, String(customInterval));
      localStorage.setItem(`srevox_nodes_time_range_${cluster.cluster_id}`, timeRange);
      localStorage.setItem(`srevox_nodes_chart_metric_${cluster.cluster_id}`, chartMetric);
      localStorage.setItem(`srevox_nodes_collapsed_${cluster.cluster_id}`, String(collapsed));
    } catch (e) {}
  }, [viewType, autoRefresh, customInterval, timeRange, chartMetric, collapsed, isReady, cluster.cluster_id]);

  // Load history data (base dataset)
  const fetchHistory = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (timeRange === "custom") {
        if (!startTime || !endTime) return;
        params.start = new Date(startTime).toISOString();
        params.end = new Date(endTime).toISOString();
      } else {
        params.range = timeRange;
      }

      const res = await api.get(`/api/infrastructure/${cluster.cluster_id}/nodes/history`, { params }).catch(() => ({ data: { history: [] } }));
      const rawHistory = res.data.history || [];
      const groupedMap = new Map<string, any>();
      
      try {
        const cached = localStorage.getItem(`srevox_telemetry_history_${cluster.cluster_id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.forEach((item: any) => {
            if (item.time) groupedMap.set(item.time, item);
          });
        }
      } catch (e) {}

      rawHistory.forEach((item: any) => {
        const timestamp = new Date(item.created_at).getTime();
        let timeLabel = new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (timeRange === "5m" || timeRange === "10m") {
          timeLabel = new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        }
        if (!groupedMap.has(timeLabel)) {
          groupedMap.set(timeLabel, { time: timeLabel, timestamp });
        }
        const record = groupedMap.get(timeLabel);
        record[`${item.name} CPU`] = item.cpu_usage_pct;
        record[`${item.name} Mem`] = item.memory_usage_pct;
      });

      const sortedData = Array.from(groupedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
      setChartData(sortedData);
      try {
        localStorage.setItem(`srevox_telemetry_history_${cluster.cluster_id}`, JSON.stringify(sortedData));
      } catch (e) {}
    } catch (e: any) {
      console.error("Failed to load historical nodes trends:", e.message);
    }
  }, [cluster.cluster_id, timeRange, startTime, endTime]);

  const toastRef = useRef({ success, error });
  useEffect(() => {
    toastRef.current = { success, error };
  });

  // Poll current live nodes
  const pollLiveNodes = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      if (isManual) {
        await api.post(`/api/clusters/${cluster.cluster_id}/refresh-metrics`);
      }
      const res = await api.get(`/api/infrastructure/${cluster.cluster_id}/nodes`);
      const latestNodes = res.data.nodes || [];
      setNodes(latestNodes);
      setNodesError(res.data.error || null);

      // Format live point
      const timestamp = Date.now();
      const timeLabel = new Date(timestamp).toLocaleTimeString([], { 
        hour: "2-digit", 
        minute: "2-digit", 
        second: (timeRange === "5m" || timeRange === "10m") ? "2-digit" : undefined 
      });

      const newRecord: any = { time: timeLabel, timestamp };
      latestNodes.forEach((node: any) => {
        newRecord[`${node.name} CPU`] = node.cpu_usage_pct;
        newRecord[`${node.name} Mem`] = node.memory_usage_pct;
      });

      // Append live point and clean up old records
      setChartData(prev => {
        const next = [...prev, newRecord];
        let limitMs = 5 * 60 * 1000;
        if (timeRange === "10m") limitMs = 10 * 60 * 1000;
        else if (timeRange === "1h") limitMs = 60 * 60 * 1000;
        else if (timeRange === "3h") limitMs = 3 * 60 * 60 * 1000;
        else if (timeRange === "6h") limitMs = 6 * 60 * 60 * 1000;
        else if (timeRange === "24h") limitMs = 24 * 60 * 60 * 1000;

        let filtered = next;
        if (timeRange !== "custom") {
          const cutoff = Date.now() - limitMs;
          filtered = next.filter(item => !item.timestamp || item.timestamp >= cutoff);
        }

        // Deduplicate by timestamp
        const seen = new Set();
        filtered = filtered.filter(item => {
          if (!item.timestamp) return true;
          if (seen.has(item.timestamp)) return false;
          seen.add(item.timestamp);
          return true;
        });

        try {
          localStorage.setItem(`srevox_telemetry_history_${cluster.cluster_id}`, JSON.stringify(filtered));
        } catch (e) {}

        return filtered;
      });

      if (isManual) {
        toastRef.current.success("Metrics updated", "Cluster nodes telemetry refreshed successfully.");
      }
    } catch (e: any) {
      setNodesError(e.response?.data?.detail || e.message || "Failed to fetch nodes");
      if (isManual) {
        toastRef.current.error("Refresh failed", e.response?.data?.detail || e.message);
      }
    } finally {
      if (isManual) setLoading(false);
    }
  }, [cluster.cluster_id, timeRange]);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedView = localStorage.getItem(`srevox_nodes_view_${cluster.cluster_id}`);
      if (savedView) setViewType(savedView as any);

      const savedInterval = localStorage.getItem(`srevox_nodes_custom_interval_${cluster.cluster_id}`);
      if (savedInterval) setCustomInterval(parseInt(savedInterval) || 30);

      const savedRange = localStorage.getItem(`srevox_nodes_time_range_${cluster.cluster_id}`);
      if (savedRange) setTimeRange(savedRange as any);

      const savedMetric = localStorage.getItem(`srevox_nodes_chart_metric_${cluster.cluster_id}`);
      if (savedMetric) setChartMetric(savedMetric as any);

      const savedCollapsed = localStorage.getItem(`srevox_nodes_collapsed_${cluster.cluster_id}`);
      if (savedCollapsed) setCollapsed(savedCollapsed === "true");
    } catch (e) {
      console.error("Failed to read settings from localStorage:", e);
    } finally {
      fetchHistory();
      setIsReady(true);
    }
  }, [cluster.cluster_id]);

  // Fetch history when timeRange/filters change
  useEffect(() => {
    if (!isReady) return;
    fetchHistory();
  }, [timeRange, startTime, endTime, isReady]);

  // Handle auto-refresh timers
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh === "off") return;

    const seconds = autoRefresh === "5" ? 5 : autoRefresh === "10" ? 10 : customInterval;
    intervalRef.current = setInterval(() => {
      pollLiveNodes(false);
    }, seconds * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, customInterval, pollLiveNodes]);

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
          <Network className="w-4 h-4 text-indigo-500 shrink-0" />
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">Cluster Nodes</h2>
          <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
            {nodes.length} total
          </span>
        </div>
      </div>

      {/* Main content body */}
      {!collapsed && (
        <div className="p-5 min-h-[150px] space-y-5">
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

              {/* View switcher (Nodes / Chart) */}
              <div className="flex items-center p-0.5 bg-gray-100 dark:bg-slate-900/60 rounded-xl border border-gray-200/50 dark:border-slate-800/40 text-[10px] font-bold text-gray-500">
                <button
                  type="button"
                  onClick={() => setViewType("nodes")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    viewType === "nodes"
                      ? "bg-white dark:bg-slate-800 text-indigo-655 dark:text-indigo-400 shadow-sm"
                      : "text-gray-400 hover:text-gray-655 dark:hover:text-slate-355"
                  }`}
                >
                  Nodes
                </button>
                <button
                  type="button"
                  onClick={() => setViewType("chart")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    viewType === "chart"
                      ? "bg-white dark:bg-slate-800 text-indigo-655 dark:text-indigo-400 shadow-sm"
                      : "text-gray-400 hover:text-gray-655 dark:hover:text-slate-355"
                  }`}
                >
                  Chart
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Auto Refresh options */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/10 border border-gray-205 dark:border-slate-800 px-2 py-1 h-[28px] rounded-lg text-[10px] font-medium text-gray-500 dark:text-slate-400">
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

              {/* Custom Date Picker Inputs */}
              {timeRange === "custom" && (
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900/10 border border-gray-200 dark:border-slate-800 px-2 py-1 h-[28px] rounded-lg text-[9px]">
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-transparent outline-none border-none text-gray-700 dark:text-slate-200"
                  />
                  <span className="text-gray-305 dark:text-slate-700">to</span>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-transparent outline-none border-none text-gray-700 dark:text-slate-200"
                  />
                  <button
                    onClick={fetchHistory}
                    className="ml-1 text-indigo-500 hover:text-indigo-655 font-bold uppercase tracking-wide text-[8px]"
                  >
                    Apply
                  </button>
                </div>
              )}

              {/* Refresh trigger */}
              <button
                type="button"
                onClick={() => pollLiveNodes(true)}
                disabled={loading}
                className="btn-secondary flex items-center gap-1.5 text-[10px] py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-55 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors font-bold disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Refresh
              </button>
            </div>
          </div>

          {loading && chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-[10px] text-gray-405 dark:text-slate-500 italic">Fetching telemetry data...</p>
            </div>
          ) : nodesError ? (
            <div className="p-6 text-center text-xs text-red-500 dark:text-red-400 font-medium">
              {nodesError}
            </div>
          ) : nodes.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 dark:text-slate-500 italic">
              No metrics reported. Connect the agent or save metrics credentials.
            </div>
          ) : (
            <div className="space-y-6">
              {viewType === "chart" ? (
                <div className="bg-gray-55/30 dark:bg-slate-900/10 border border-gray-150 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-gray-150/40 dark:border-slate-800/80 pb-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-455 dark:text-slate-500 uppercase tracking-wider font-bold">
                      <Calendar className="w-3.5 h-3.5" />
                      Telemetry Timeline
                    </div>
                    {/* CPU vs Memory Toggle */}
                    <div className="flex items-center p-0.5 bg-gray-100 dark:bg-slate-900 rounded-lg text-[9px] font-bold">
                      <button
                        onClick={() => setChartMetric("cpu")}
                        className={`px-2 py-0.5 rounded transition-all ${
                          chartMetric === "cpu"
                            ? "bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm"
                            : "text-gray-400 hover:text-gray-655 dark:hover:text-slate-355"
                        }`}
                      >
                        CPU
                      </button>
                      <button
                        onClick={() => setChartMetric("memory")}
                        className={`px-2 py-0.5 rounded transition-all ${
                          chartMetric === "memory"
                            ? "bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm"
                            : "text-gray-400 hover:text-gray-655 dark:hover:text-slate-355"
                        }`}
                      >
                        Memory
                      </button>
                      <button
                        onClick={() => setChartMetric("both")}
                        className={`px-2 py-0.5 rounded transition-all ${
                          chartMetric === "both"
                            ? "bg-white dark:bg-slate-800 text-indigo-655 dark:text-indigo-400 shadow-sm"
                            : "text-gray-405 hover:text-gray-655 dark:hover:text-slate-355"
                        }`}
                      >
                        Both
                      </button>
                    </div>
                  </div>

                  <div className="h-60 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                        <XAxis dataKey="time" tick={{ fill: "currentColor", opacity: 0.85 }} fontSize={8} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: "currentColor", opacity: 0.85 }} fontSize={8} tickLine={false} axisLine={false} />
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
                        <Legend verticalAlign="top" height={28} iconSize={8} fontSize={9} />
                        {nodes.map((node, index) => {
                          const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899"];
                          const col = colors[index % colors.length];
                          const elements = [];
                          if (chartMetric === "cpu" || chartMetric === "both") {
                            elements.push(
                              <Line
                                key={`${node.name}-cpu`}
                                type="monotone"
                                dataKey={`${node.name} CPU`}
                                name={`${node.name} CPU %`}
                                stroke={col}
                                strokeWidth={1.5}
                                dot={chartData.length === 1 ? { r: 3 } : false}
                                activeDot={{ r: 4 }}
                              />
                            );
                          }
                          if (chartMetric === "memory" || chartMetric === "both") {
                            elements.push(
                              <Line
                                key={`${node.name}-mem`}
                                type="monotone"
                                dataKey={`${node.name} Mem`}
                                name={`${node.name} Mem %`}
                                stroke={col}
                                strokeWidth={1.5}
                                strokeDasharray="4 4"
                                dot={chartData.length === 1 ? { r: 3 } : false}
                                activeDot={{ r: 4 }}
                              />
                            );
                          }
                          return elements;
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Node Instance Status & Core Allocations</span>
                  <div className="divide-y divide-gray-150/40 dark:divide-slate-800/80">
                    {nodes.map((node) => (
                      <NodeRow key={node.node_id || node.name} node={node} cluster={cluster} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
