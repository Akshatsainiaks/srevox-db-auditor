"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Activity, RefreshCw, Calendar, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "@/lib/api";
import { type Cluster } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface ResourceTrendsCardProps {
  cluster: Cluster;
  initialNodes: any[];
}

export default function ResourceTrendsCard({ cluster, initialNodes }: ResourceTrendsCardProps) {
  const { success, error } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const hasPopulatedInitial = useRef(false);
  const [collapsed, setCollapsed] = useState(false);

  // Auto Refresh States
  const [autoRefresh, setAutoRefresh] = useState<"off" | "5" | "10" | "custom">("off");
  const [customInterval, setCustomInterval] = useState<number>(30);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Time Range States
  const [timeRange, setTimeRange] = useState<"5m" | "10m" | "1h" | "3h" | "6h" | "24h" | "custom">("1h");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Metric Toggle state
  const [chartMetric, setChartMetric] = useState<"cpu" | "memory" | "both">("both");
  const [isReady, setIsReady] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedCust = localStorage.getItem(`srevox_res_trends_custom_int_${cluster.cluster_id}`);
      if (savedCust) setCustomInterval(Number(savedCust));

      const savedRange = localStorage.getItem(`srevox_res_trends_range_${cluster.cluster_id}`) as any;
      if (savedRange) setTimeRange(savedRange);

      const savedMetric = localStorage.getItem(`srevox_res_trends_metric_${cluster.cluster_id}`) as any;
      if (savedMetric) setChartMetric(savedMetric);

      const savedCollapsed = localStorage.getItem(`srevox_res_trends_collapsed_${cluster.cluster_id}`);
      if (savedCollapsed) setCollapsed(savedCollapsed === "true");
    } catch {}
    setIsReady(true);
  }, [cluster.cluster_id]);

  // Persist settings
  useEffect(() => {
    if (!isReady) return;
    try {
      localStorage.setItem(`srevox_res_trends_auto_${cluster.cluster_id}`, autoRefresh);
      localStorage.setItem(`srevox_res_trends_custom_int_${cluster.cluster_id}`, String(customInterval));
      localStorage.setItem(`srevox_res_trends_range_${cluster.cluster_id}`, timeRange);
      localStorage.setItem(`srevox_res_trends_metric_${cluster.cluster_id}`, chartMetric);
      localStorage.setItem(`srevox_res_trends_collapsed_${cluster.cluster_id}`, String(collapsed));
    } catch {}
  }, [autoRefresh, customInterval, timeRange, chartMetric, collapsed, isReady, cluster.cluster_id]);

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

      const res = await api.get(`/api/infrastructure/${cluster.cluster_id}/nodes/history`, { params });
      const rawHistory = res.data.history || [];
      const groupedMap = new Map<string, { time: string; timestamp: number; sumCpu: number; sumMem: number; count: number }>();
      
      rawHistory.forEach((item: any) => {
        const timestamp = new Date(item.created_at).getTime();
        let timeLabel = new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (timeRange === "5m" || timeRange === "10m") {
          timeLabel = new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        }
        if (!groupedMap.has(timeLabel)) {
          groupedMap.set(timeLabel, { time: timeLabel, timestamp, sumCpu: 0, sumMem: 0, count: 0 });
        }
        const record = groupedMap.get(timeLabel)!;
        record.sumCpu += Number(item.cpu_usage_pct || 0);
        record.sumMem += Number(item.memory_usage_pct || 0);
        record.count += 1;
      });

      const sorted = Array.from(groupedMap.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(r => ({
          time: r.time,
          timestamp: r.timestamp,
          cpu: Math.min(100, Math.max(0, Math.round(r.sumCpu / (r.count || 1)))),
          mem: Math.min(100, Math.max(0, Math.round(r.sumMem / (r.count || 1))))
        }));

      setChartData(sorted);
    } catch (e: any) {
      console.error("Failed to load trends history:", e.message);
    }
  }, [cluster.cluster_id, timeRange, startTime, endTime]);

  const toastRef = useRef({ success, error });
  useEffect(() => {
    toastRef.current = { success, error };
  });

  // Poll current live data
  const pollLive = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      if (isManual) {
        await api.post(`/api/clusters/${cluster.cluster_id}/refresh-metrics`);
      }
      const res = await api.get(`/api/infrastructure/${cluster.cluster_id}/nodes`);
      const nodesList = res.data.nodes || [];
      
      const newCpu = nodesList.length ? Math.round(nodesList.reduce((acc: number, n: any) => acc + (n.cpu_usage_pct || 0), 0) / nodesList.length) : 0;
      const newMem = nodesList.length ? Math.round(nodesList.reduce((acc: number, n: any) => acc + (n.memory_usage_pct || 0), 0) / nodesList.length) : 0;

      const timestamp = Date.now();
      const timeStr = new Date(timestamp).toLocaleTimeString([], { 
        hour: "2-digit", 
        minute: "2-digit",
        second: (timeRange === "5m" || timeRange === "10m") ? "2-digit" : undefined
      });
      const newEntry = { time: timeStr, timestamp, cpu: newCpu, mem: newMem };

      setChartData(prev => {
        const next = [...prev, newEntry];
        let limitMs = 5 * 60 * 1000;
        if (timeRange === "10m") limitMs = 10 * 60 * 1000;
        else if (timeRange === "1h") limitMs = 60 * 60 * 1000;
        else if (timeRange === "3h") limitMs = 3 * 60 * 60 * 1000;
        else if (timeRange === "6h") limitMs = 6 * 60 * 60 * 1000;
        else if (timeRange === "24h") limitMs = 24 * 60 * 60 * 1000;

        if (timeRange !== "custom") {
          const cutoff = Date.now() - limitMs;
          return next.filter(item => !item.timestamp || item.timestamp >= cutoff);
        }
        return next;
      });

      if (isManual) {
        toastRef.current.success("Metrics updated", "Live resource trends refreshed.");
      }
    } catch (e: any) {
      if (isManual) toastRef.current.error("Refresh failed", e.message);
    } finally {
      if (isManual) setLoading(false);
    }
  }, [cluster.cluster_id, timeRange]);

  // Seed live history data initially
  useEffect(() => {
    if (!initialNodes.length || hasPopulatedInitial.current) return;
    const avgCpu = Math.round(initialNodes.reduce((acc, n) => acc + (n.cpu_usage_pct || 0), 0) / initialNodes.length);
    const avgMem = Math.round(initialNodes.reduce((acc, n) => acc + (n.memory_usage_pct || 0), 0) / initialNodes.length);
    
    const seeded = [];
    const now = new Date();
    for (let i = 4; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 60 * 1000);
      const timestamp = t.getTime();
      const timeStr = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const noiseCpu = (Math.random() - 0.5) * 5;
      const noiseMem = (Math.random() - 0.5) * 3;
      seeded.push({
        time: timeStr,
        timestamp,
        cpu: Math.min(100, Math.max(0, Math.round(avgCpu + noiseCpu))),
        mem: Math.min(100, Math.max(0, Math.round(avgMem + noiseMem)))
      });
    }
    setChartData(seeded);
    hasPopulatedInitial.current = true;
  }, [initialNodes]);

  // Fetch when timeRange/filters change
  useEffect(() => {
    if (!isReady) return;
    fetchHistory();
  }, [timeRange, startTime, endTime, isReady, fetchHistory]);

  // Interval trigger for Auto Refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh === "off") return;

    const seconds = autoRefresh === "5" ? 5 : autoRefresh === "10" ? 10 : customInterval;
    intervalRef.current = setInterval(() => {
      pollLive(false);
    }, seconds * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, customInterval, pollLive]);

  if (!isReady) {
    return (
      <div className="border bg-white/70 dark:bg-[#13151f] border-gray-200 dark:border-slate-800 rounded-2xl h-[350px] flex flex-col justify-center items-center shadow-sm select-none">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <p className="text-[10px] text-gray-400 dark:text-slate-505 italic mt-2">Restoring dashboard preferences...</p>
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
          <Activity className="w-4 h-4 text-indigo-500 shrink-0" />
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">Resource Trends</h2>
          <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
            CPU & Mem
          </span>
        </div>
      </div>

      {/* Main content body */}
      {!collapsed && (
        <div className="p-5 space-y-4">
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

              {/* Metric Selector toolbar */}
              <div className="flex items-center p-0.5 bg-gray-100 dark:bg-slate-900/60 rounded-xl border border-gray-200/50 dark:border-slate-800/40 text-[10px] font-bold text-gray-555">
                <button
                  onClick={() => setChartMetric("cpu")}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    chartMetric === "cpu"
                      ? "bg-white dark:bg-slate-800 text-indigo-655 dark:text-indigo-400 shadow-sm"
                      : "text-gray-400 hover:text-gray-655 dark:hover:text-slate-355"
                  }`}
                >
                  CPU
                </button>
                <button
                  onClick={() => setChartMetric("memory")}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    chartMetric === "memory"
                      ? "bg-white dark:bg-slate-800 text-indigo-655 dark:text-indigo-400 shadow-sm"
                      : "text-gray-400 hover:text-gray-655 dark:hover:text-slate-355"
                  }`}
                >
                  Memory
                </button>
                <button
                  onClick={() => setChartMetric("both")}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    chartMetric === "both"
                      ? "bg-white dark:bg-slate-800 text-indigo-655 dark:text-indigo-400 shadow-sm"
                      : "text-gray-400 hover:text-gray-655 dark:hover:text-slate-355"
                  }`}
                >
                  Both
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
                  <span className="text-gray-350 dark:text-slate-700">to</span>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-transparent outline-none border-none text-gray-700 dark:text-slate-200"
                  />
                  <button
                    onClick={fetchHistory}
                    className="ml-1 text-indigo-500 hover:text-indigo-650 font-bold uppercase tracking-wide text-[8px]"
                  >
                    Apply
                  </button>
                </div>
              )}

              {/* Refresh trigger */}
              <button
                type="button"
                onClick={() => pollLive(true)}
                disabled={loading}
                className="btn-secondary flex items-center gap-1.5 text-[10px] py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-55 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors font-bold disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Refresh
              </button>
            </div>
          </div>

          <div className="h-72 w-full text-xs text-gray-550 dark:text-slate-455 relative">
            {loading && chartData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center italic text-gray-400 dark:text-slate-500">
                No telemetry trends data logged.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendsCpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                    </linearGradient>
                    <linearGradient id="trendsMemGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                  <XAxis dataKey="time" tick={{ fill: "currentColor", opacity: 0.85 }} fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} stroke="rgba(148, 163, 184, 0.45)" tick={{ fill: "currentColor", opacity: 0.85 }} fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(val: any) => [`${Math.min(100, Math.max(0, Math.round(Number(val) || 0)))}%`]}
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
                  {(chartMetric === "cpu" || chartMetric === "both") && (
                    <Area type="monotone" dataKey="cpu" name="CPU Usage %" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#trendsCpuGrad)" />
                  )}
                  {(chartMetric === "memory" || chartMetric === "both") && (
                    <Area type="monotone" dataKey="mem" name="Memory Usage %" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#trendsMemGrad)" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
