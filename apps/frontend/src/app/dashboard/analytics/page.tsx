"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { 
  BarChart3, RefreshCw, AlertTriangle, Bell, Info, ShieldAlert, ShieldCheck,
  CheckCircle2, Calendar, ChevronDown, ChevronUp, Loader2
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { getUser, hasPermission } from "@/lib/auth";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

interface AnalyticsDataPoint {
  period: string;
  count: number;
}

interface SummaryData {
  hourly: { crashes: AnalyticsDataPoint[]; alerts: AnalyticsDataPoint[] };
  daily: { crashes: AnalyticsDataPoint[]; alerts: AnalyticsDataPoint[] };
  monthly: { crashes: AnalyticsDataPoint[]; alerts: AnalyticsDataPoint[] };
  top_crashed: { pod_name: string; namespace: string; count: number }[];
  top_alerting: { pod_name: string; namespace: string; count: number }[];
  custom?: { crashes: AnalyticsDataPoint[]; alerts: AnalyticsDataPoint[]; interval: "hour" | "day" | "month" };
}

export default function AnalyticsPage() {
  const { success, error } = useToast();

  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const toastShownRef = useRef(false);
  const isInitialMount = useRef(true);

  // Layout Preference States
  const [timeRange, setTimeRange] = useState<"5m" | "10m" | "7d" | "30d" | "90d" | "custom">("30d");
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndTimeStr] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  // Auto Refresh States
  const [autoRefresh, setAutoRefresh] = useState<"off" | "5" | "10" | "custom">("off");
  const [customInterval, setCustomInterval] = useState<number>(30);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isReady, setIsReady] = useState(false);

  // Restore states on mount
  useEffect(() => {
    try {
      const savedAuto = localStorage.getItem("srevox_analytics_auto") as any;
      if (savedAuto) setAutoRefresh(savedAuto);

      const savedCust = localStorage.getItem("srevox_analytics_custom_int");
      if (savedCust) setCustomInterval(Number(savedCust));

      const savedRange = localStorage.getItem("srevox_analytics_range") as any;
      if (savedRange) setTimeRange(savedRange);

      const savedCollapsed = localStorage.getItem("srevox_analytics_collapsed");
      if (savedCollapsed) setCollapsed(savedCollapsed === "true");
    } catch {}
    setIsReady(true);

    return () => {
      try {
        localStorage.setItem("srevox_analytics_auto", "off");
      } catch {}
    };
  }, []);

  // Save states on change
  useEffect(() => {
    if (!isReady) return;
    try {
      localStorage.setItem("srevox_analytics_auto", autoRefresh);
      localStorage.setItem("srevox_analytics_custom_int", String(customInterval));
      localStorage.setItem("srevox_analytics_range", timeRange);
      localStorage.setItem("srevox_analytics_collapsed", String(collapsed));
    } catch {}
  }, [autoRefresh, customInterval, timeRange, collapsed, isReady]);

  const getComputedRange = useCallback(() => {
    if (timeRange === "custom") {
      return {
        start: startDateStr ? new Date(startDateStr).toISOString() : "",
        end: endDateStr ? new Date(endDateStr).toISOString() : ""
      };
    }
    const end = new Date();
    const start = new Date();
    if (timeRange === "5m") {
      start.setMinutes(start.getMinutes() - 5);
    } else if (timeRange === "10m") {
      start.setMinutes(start.getMinutes() - 10);
    } else if (timeRange === "7d") {
      start.setDate(start.getDate() - 7);
    } else if (timeRange === "30d") {
      start.setDate(start.getDate() - 30);
    } else if (timeRange === "90d") {
      start.setDate(start.getDate() - 90);
    }
    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }, [timeRange, startDateStr, endDateStr]);

  const loadAnalytics = useCallback(async (quiet = false, showToast = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const { start, end } = getComputedRange();
      const params: Record<string, string> = {};
      if (start && end) {
        params.start_date = start;
        params.end_date = end;
      }
      const res = await api.get("/api/incidents/analytics/summary", { params });
      setData(res.data);
      setAuthorized(true);
      if (quiet && showToast) {
        success("Analytics refreshed", "Incident metrics data updated successfully.");
      }
    } catch (err: any) {
      console.error("Error loading analytics:", err);
      if (err.response?.status === 403) {
        setAuthorized(false);
        if (!toastShownRef.current) {
          error("Access restricted: You do not have permission to view the analytics console.");
          toastShownRef.current = true;
        }
      } else {
        error("Failed to load analytics metrics");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getComputedRange, success, error]);

  // Initial trigger and range changes
  useEffect(() => {
    const user = getUser();
    if (!hasPermission(user, "viewAnalytics")) {
      setAuthorized(false);
      setLoading(false);
      if (!toastShownRef.current) {
        error("Permission Required: You do not have permission to view analytics & reports.");
        toastShownRef.current = true;
      }
      return;
    }
    if (isInitialMount.current) {
      isInitialMount.current = false;
      loadAnalytics(false, false);
    } else {
      loadAnalytics(true, false);
    }
  }, [timeRange, loadAnalytics]);

  // Auto Refresh timer trigger
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh === "off") return;

    const seconds = autoRefresh === "5" ? 5 : autoRefresh === "10" ? 10 : customInterval;
    intervalRef.current = setInterval(() => {
      loadAnalytics(true, false);
    }, seconds * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, customInterval, loadAnalytics]);

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDateStr || !endDateStr) {
      error("Both start and end dates are required for custom timeframe.");
      return;
    }
    if (new Date(startDateStr) > new Date(endDateStr)) {
      error("Start date cannot be after end date.");
      return;
    }
    loadAnalytics(true, true);
  };

  // Format data for Recharts
  const getChartData = () => {
    if (!data) return [];
    
    let crashSrc: AnalyticsDataPoint[] = [];
    let alertSrc: AnalyticsDataPoint[] = [];
    let activeInterval: "hour" | "day" | "month" = "day";

    if (data.custom) {
      crashSrc = data.custom.crashes;
      alertSrc = data.custom.alerts;
      activeInterval = data.custom.interval;
    } else {
      if (timeRange === "5m" || timeRange === "10m") {
        crashSrc = data.hourly.crashes;
        alertSrc = data.hourly.alerts;
        activeInterval = "hour";
      } else if (timeRange === "7d" || timeRange === "30d") {
        crashSrc = data.daily.crashes;
        alertSrc = data.daily.alerts;
        activeInterval = "day";
      } else {
        crashSrc = data.monthly.crashes;
        alertSrc = data.monthly.alerts;
        activeInterval = "month";
      }
    }

    const map: Record<string, { label: string; periodTime: number; Crashes: number; Alerts: number }> = {};
    
    crashSrc.forEach(c => {
      const t = new Date(c.period).getTime();
      map[c.period] = {
        label: formatLabel(c.period, activeInterval),
        periodTime: t,
        Crashes: c.count,
        Alerts: 0
      };
    });

    alertSrc.forEach(a => {
      const t = new Date(a.period).getTime();
      if (!map[a.period]) {
        map[a.period] = {
          label: formatLabel(a.period, activeInterval),
          periodTime: t,
          Crashes: 0,
          Alerts: a.count
        };
      } else {
        map[a.period].Alerts = a.count;
      }
    });

    return Object.values(map).sort((a, b) => a.periodTime - b.periodTime);
  };

  const formatLabel = (isoString: string, tf: "hour" | "day" | "month") => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    
    if (tf === "hour") {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    if (tf === "day") {
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    return d.toLocaleDateString([], { month: "short", year: "2-digit" });
  };

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`viewAnalytics`) to view analytics & reports.
        </p>
      </div>
    );
  }

  const { start: computedStart, end: computedEnd } = getComputedRange();
  const chartData = getChartData();
  const totalCrashes = chartData.reduce((acc, curr) => acc + curr.Crashes, 0);
  const totalAlerts = chartData.reduce((acc, curr) => acc + curr.Alerts, 0);
  const alertRate = totalCrashes > 0 ? Math.round((totalAlerts / totalCrashes) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          Analytics Console
        </h1>
        <p className="text-xs text-gray-400 dark:text-slate-505 mt-1">
          Historical aggregations of pod crashes, diagnostics, and triggered warnings.
        </p>
      </div>

      {/* Feature notice banner */}
      <div className="bg-amber-50/50 dark:bg-amber-500/[0.03] border border-amber-155 dark:border-amber-500/20 p-4 rounded-2xl flex items-start gap-3 select-none animate-fade-in">
        <Info className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Notice: Upcoming Feature Enhancement</p>
          <p className="text-[11px] text-amber-700/90 dark:text-amber-400/80 leading-relaxed">
            Analytics visualizations, metrics reporting, and advanced filter controls will be further updated and fully optimized in the next version release.
          </p>
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-white dark:bg-[#13151f] border border-gray-100 dark:border-slate-800/80 rounded-2xl" />
            ))}
          </div>
          <div className="h-[380px] bg-white dark:bg-[#13151f] border border-gray-100 dark:border-slate-800/80 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div id="analytics-summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Crashes */}
            <div className="rounded-2xl border bg-white/70 dark:bg-[#13151f] border-gray-150 dark:border-slate-800/70 p-5 flex flex-col justify-between shadow-sm select-none">
              <div className="flex items-center justify-between text-gray-450 dark:text-slate-500 mb-2">
                <span className="text-xs font-semibold">Total Crashes</span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {totalCrashes}
              </div>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                crashes in selected window
              </span>
            </div>

            {/* Total Alerts */}
            <div className="rounded-2xl border bg-white/70 dark:bg-[#13151f] border-gray-150 dark:border-slate-800/70 p-5 flex flex-col justify-between shadow-sm select-none">
              <div className="flex items-center justify-between text-gray-455 dark:text-slate-500 mb-2">
                <span className="text-xs font-semibold">Alerts Dispatched</span>
                <Bell className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {totalAlerts}
              </div>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                alerts sent in selected window
              </span>
            </div>

            {/* Alert Trigger Rate */}
            <div className="rounded-2xl border bg-white/70 dark:bg-[#13151f] border-gray-150 dark:border-slate-800/70 p-5 flex flex-col justify-between shadow-sm select-none">
              <div className="flex items-center justify-between text-gray-455 dark:text-slate-500 mb-2">
                <span className="text-xs font-semibold">Alert Rate</span>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {alertRate}%
              </div>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                ratio of warnings dispatched
              </span>
            </div>

            {/* System Diagnostics Status */}
            <div className="rounded-2xl border bg-white/70 dark:bg-[#13151f] border-gray-150 dark:border-slate-800/70 p-5 flex flex-col justify-between shadow-sm select-none">
              <div className="flex items-center justify-between text-gray-450 dark:text-slate-500 mb-2">
                <span className="text-xs font-semibold">Analysis Coverage</span>
                <Info className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                100%
              </div>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                AI diagnosis accuracy coverage
              </span>
            </div>
          </div>

          {/* Main Chart Section */}
          <div className="border bg-white/70 dark:bg-[#13151f] border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-sm select-none">
            {/* Card Header */}
            <div className="flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/15 p-4 shrink-0 border-b border-gray-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCollapsed(!collapsed)}
                  className="p-1 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-655 dark:hover:text-slate-305 transition-colors shrink-0"
                  title={collapsed ? "Expand card" : "Collapse card"}
                >
                  {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                <BarChart3 className="w-4 h-4 text-indigo-500 shrink-0" />
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Crashes vs. Alerts Dispatch</h3>
                <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                  Timeline View
                </span>
              </div>
            </div>

            {/* Card Body */}
            {!collapsed && (
              <div className="p-6 space-y-6">
                {/* Inner Toolbar controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-150/40 dark:border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Time Range Selector Dropdown */}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/10 border border-gray-200 dark:border-slate-800 px-2 py-1 h-[28px] rounded-lg text-[10px] font-medium text-gray-555 dark:text-slate-400">
                      <span className="font-bold">Range:</span>
                      <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as any)}
                        className="bg-transparent border-none outline-none font-bold text-indigo-500 dark:text-indigo-400 cursor-pointer"
                      >
                        <option value="5m">Last 5 Minutes</option>
                        <option value="10m">Last 10 Minutes</option>
                        <option value="7d">7 Days</option>
                        <option value="30d">30 Days</option>
                        <option value="90d">90 Days</option>
                        <option value="custom">Custom</option>
                      </select>
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
                      <form onSubmit={handleApplyCustomDates} className="flex items-center gap-1 bg-white dark:bg-slate-900/10 border border-gray-200 dark:border-slate-800 px-2 py-1 h-[28px] rounded-lg text-[9px]">
                        <input
                          type="datetime-local"
                          value={startDateStr}
                          onChange={e => setStartDateStr(e.target.value)}
                          required
                          className="bg-transparent outline-none border-none text-gray-700 dark:text-slate-200"
                        />
                        <span className="text-gray-350 dark:text-slate-700">to</span>
                        <input
                          type="datetime-local"
                          value={endDateStr}
                          onChange={e => setEndTimeStr(e.target.value)}
                          required
                          className="bg-transparent outline-none border-none text-gray-700 dark:text-slate-200"
                        />
                        <button
                          type="submit"
                          className="ml-1 text-indigo-500 hover:text-indigo-650 font-bold uppercase tracking-wide text-[8px]"
                        >
                          Apply
                        </button>
                      </form>
                    )}

                    {/* Refresh trigger */}
                    <button
                      type="button"
                      onClick={() => loadAnalytics(true, true)}
                      disabled={refreshing || loading}
                      className="btn-secondary flex items-center gap-1.5 text-[10px] py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors font-bold disabled:opacity-50"
                    >
                      {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Refresh
                    </button>
                  </div>
                </div>

                {/* Chart Area */}
                <div className="h-[300px] w-full relative">
                  {refreshing && chartData.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    </div>
                  ) : chartData.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center">
                      <CheckCircle2 className="w-10 h-10 text-green-500 mb-2" />
                      <p className="text-sm font-semibold text-gray-850 dark:text-slate-200">No events found</p>
                      <p className="text-xs text-gray-455 dark:text-slate-555 mt-0.5">No crashes occurred during the selected window.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCrashes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fill: "currentColor", opacity: 0.85, fontSize: 9, fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fill: "currentColor", opacity: 0.85, fontSize: 9, fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: "rgba(19, 21, 31, 0.95)",
                            border: "1px solid rgba(148, 163, 184, 0.1)",
                            borderRadius: "14px",
                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                            padding: "10px 14px",
                            color: "#fff"
                          }}
                          itemStyle={{ fontSize: "11px", fontWeight: "bold" }}
                          labelStyle={{ fontSize: "10px", color: "#94a3b8", marginBottom: "4px" }}
                        />
                        <Legend verticalAlign="top" height={24} iconSize={8} fontSize={9} />
                        <Area type="monotone" dataKey="Crashes" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCrashes)" activeDot={{ r: 5 }} />
                        <Area type="monotone" dataKey="Alerts" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAlerts)" activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Breakdown Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Crashes */}
            <div className="bg-white/70 dark:bg-[#13151f] border border-gray-155 dark:border-slate-800/70 rounded-2xl p-5 flex flex-col justify-between overflow-hidden shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Top Crashed Pods</h3>
                </div>
                <button
                  onClick={() => window.location.href = `/dashboard/analytics/pods?start_date=${encodeURIComponent(computedStart)}&end_date=${encodeURIComponent(computedEnd)}`}
                  className="text-xs text-indigo-650 dark:text-indigo-400 hover:underline font-bold"
                >
                  Show All
                </button>
              </div>
              <div className="flex-1 space-y-4">
                {!data || data.top_crashed.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 py-6 text-center">No pod crash data available.</p>
                ) : (
                  <div className="space-y-3.5">
                    {data.top_crashed.map((pod, idx) => {
                      const maxCount = data.top_crashed[0]?.count || 1;
                      const pct = Math.round((pod.count / maxCount) * 100);
                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="min-w-0">
                              <span className="font-bold text-gray-800 dark:text-slate-200 truncate block">{pod.pod_name}</span>
                              <span className="text-[10px] text-gray-400 dark:text-slate-550 block">Namespace: {pod.namespace}</span>
                            </div>
                            <span className="font-extrabold text-red-500 bg-red-50/50 dark:bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-100/30 dark:border-red-500/10 shrink-0 ml-2">
                              {pod.count} crashes
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-50 dark:bg-slate-900 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-red-500 rounded-full transition-all duration-500" 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Top Alerts */}
            <div className="bg-white/70 dark:bg-[#13151f] border border-gray-155 dark:border-slate-800/70 rounded-2xl p-5 flex flex-col justify-between overflow-hidden shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Top Alerting Pods</h3>
                </div>
                <button
                  onClick={() => window.location.href = `/dashboard/analytics/alerts?start_date=${encodeURIComponent(computedStart)}&end_date=${encodeURIComponent(computedEnd)}`}
                  className="text-xs text-indigo-650 dark:text-indigo-400 hover:underline font-bold"
                >
                  Show All
                </button>
              </div>
              <div className="flex-1 space-y-4">
                {!data || data.top_alerting.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 py-6 text-center">No alert dispatch data available.</p>
                ) : (
                  <div className="space-y-3.5">
                    {data.top_alerting.map((pod, idx) => {
                      const maxCount = data.top_alerting[0]?.count || 1;
                      const pct = Math.round((pod.count / maxCount) * 100);
                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="min-w-0">
                              <span className="font-bold text-gray-800 dark:text-slate-200 truncate block">{pod.pod_name}</span>
                              <span className="text-[10px] text-gray-400 dark:text-slate-550 block">Namespace: {pod.namespace}</span>
                            </div>
                            <span className="font-extrabold text-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-100/30 dark:border-indigo-500/10 shrink-0 ml-2">
                              {pod.count} alerts
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-50 dark:bg-slate-900 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
