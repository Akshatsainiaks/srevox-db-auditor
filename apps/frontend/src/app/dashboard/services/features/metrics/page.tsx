"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, ArrowLeft, BarChart3, Bell, Calendar, Search, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { getUser, hasPermission } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ServiceOwner {
  service_owner_id: string;
  cluster_name: string;
  namespace?: string;
  pod_prefix?: string;
  owner_name: string;
  owner_email: string;
  channel_ids: string[];
  owners?: { full_name: string; email: string; }[];
}

interface ServiceCount {
  service_owner_id: string;
  count: number;
}

export default function ServiceMetricsPage() {
  const { success, error: toastError } = useToast();
  const user = getUser();
  const isAdmin = user?.role === "admin";
  const canAddServiceOwner = hasPermission(user, "addServiceOwner");

  const [services, setServices] = useState<ServiceOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Array<{ period: string; count: number }>>([]);
  const [serviceCounts, setServiceCounts] = useState<ServiceCount[]>([]);
  
  // Timeframe states
  const [preset, setPreset] = useState("24h");
  
  // Custom dates
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [queryError, setQueryError] = useState("");

  // Auto Refresh States
  const [autoRefresh, setAutoRefresh] = useState<"off" | "5" | "10" | "custom">("off");
  const [customInterval, setCustomInterval] = useState<number>(30);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Load registered services on mount
  useEffect(() => {
    if (!canAddServiceOwner) return;

    api.get("/api/service-owners")
      .then((res) => {
        setServices(res.data.service_owners || []);
      })
      .catch((err) => {
        console.error("Failed to load services", err);
        toastError(err?.response?.data?.detail || "Failed to load services info");
      })
      .finally(() => setLoading(false));
  }, [canAddServiceOwner, toastError]);

  // Load metrics data
  const loadMetrics = async (quiet = false, showToast = false) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoadingMetrics(true);
    }
    setQueryError("");
    try {
      let startStr = "";
      let endStr = "";
      let interval = "hour";

      if (preset !== "custom") {
        let start = new Date();
        if (preset === "5m") {
          start = new Date(Date.now() - 5 * 60 * 1000);
          interval = "5m";
        } else if (preset === "10m") {
          start = new Date(Date.now() - 10 * 60 * 1000);
          interval = "5m";
        } else if (preset === "1h") {
          start = new Date(Date.now() - 60 * 60 * 1000);
          interval = "5m";
        } else if (preset === "24h") {
          start = new Date(Date.now() - 24 * 3600 * 1000);
          interval = "hour";
        } else if (preset === "7d") {
          start = new Date(Date.now() - 7 * 24 * 3600 * 1000);
          interval = "hour";
        } else if (preset === "30d") {
          start = new Date(Date.now() - 30 * 24 * 3600 * 1000);
          interval = "day";
        } else if (preset === "90d") {
          start = new Date(Date.now() - 90 * 24 * 3600 * 1000);
          interval = "day";
        }
        startStr = start.toISOString();
        endStr = new Date().toISOString();
      } else {
        if (!startDate || !endDate) {
          if (showToast) {
            setQueryError("Please select both start and end date/time.");
          }
          setLoadingMetrics(false);
          setRefreshing(false);
          return;
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          setQueryError("Invalid custom date range.");
          setLoadingMetrics(false);
          setRefreshing(false);
          return;
        }
        if (start >= end) {
          setQueryError("Start date must be before end date.");
          setLoadingMetrics(false);
          setRefreshing(false);
          return;
        }
        
        startStr = start.toISOString();
        endStr = end.toISOString();
        
        // Decide interval dynamically
        const diffMs = end.getTime() - start.getTime();
        const diffHours = diffMs / (1000 * 3600);
        if (diffHours <= 2) {
          interval = "5m";
        } else if (diffHours <= 48) {
          interval = "hour";
        } else {
          interval = "day";
        }
      }

      const res = await api.get("/api/service-owners/alerts-metrics", {
        params: {
          start_date: startStr,
          end_date: endStr,
          interval
        }
      });
      setMetrics(res.data.metrics || []);
      setServiceCounts(res.data.serviceCounts || []);
      if (showToast) {
        success("Metrics refreshed", "Alert dispatch data updated successfully.");
      }
    } catch (err: any) {
      console.error("Failed to load metrics", err);
      setQueryError(err?.response?.data?.detail || "Failed to load metrics data.");
    } finally {
      setLoadingMetrics(false);
      setRefreshing(false);
    }
  };

  // Restore states on mount
  useEffect(() => {
    try {
      const savedAuto = localStorage.getItem("srevox_metrics_auto") as any;
      if (savedAuto) setAutoRefresh(savedAuto);

      const savedCust = localStorage.getItem("srevox_metrics_custom_int");
      if (savedCust) setCustomInterval(Number(savedCust));

      const savedPreset = localStorage.getItem("srevox_metrics_preset") as any;
      if (savedPreset) setPreset(savedPreset);
    } catch {}
    setIsReady(true);

    return () => {
      try {
        localStorage.setItem("srevox_metrics_auto", "off");
      } catch {}
    };
  }, []);

  // Save states on change
  useEffect(() => {
    if (!isReady) return;
    try {
      localStorage.setItem("srevox_metrics_auto", autoRefresh);
      localStorage.setItem("srevox_metrics_custom_int", String(customInterval));
      localStorage.setItem("srevox_metrics_preset", preset);
    } catch {}
  }, [autoRefresh, customInterval, preset, isReady]);

  // Auto Refresh timer trigger
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh === "off") return;

    const seconds = autoRefresh === "5" ? 5 : autoRefresh === "10" ? 10 : customInterval;
    intervalRef.current = setInterval(() => {
      loadMetrics(true, false);
    }, seconds * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, customInterval, loadMetrics]);

  useEffect(() => {
    if (canAddServiceOwner && preset !== "custom") {
      loadMetrics();
    }
  }, [preset, canAddServiceOwner]);

  const formatPeriodLabel = (pStr: string) => {
    try {
      const d = new Date(pStr);
      if (isNaN(d.getTime())) return pStr;
      
      const intervalMode = preset;
      
      if (intervalMode === "5m" || intervalMode === "1h") {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (intervalMode === "24h" || intervalMode === "7d") {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
      } else {
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch {
      return pStr;
    }
  };

  const chartData = metrics.map(item => ({
    label: formatPeriodLabel(item.period),
    "Alerts Sent": item.count
  }));

  if (!canAddServiceOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center w-full">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`addServiceOwner`) to view service dispatch metrics.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card p-6 min-h-[400px] flex items-center justify-center bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 animate-modal-slide-up" style={{ animationDuration: "0.2s" }}>
      {/* Back link */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/services/features" className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-350 font-bold transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Service Features
        </Link>
      </div>

      {/* Header Overview */}
      <div className="card p-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-base">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          Alert Analytics & Metrics
        </h2>
        <p className="text-xs text-gray-550 dark:text-slate-400 mt-1">
          Track and filter real-time alert dispatch summaries across all services.
        </p>
      </div>

      {preset === "custom" && queryError && (
        <div className="card p-3 bg-red-50 dark:bg-red-500/5 border border-red-100/50 dark:border-red-500/10 rounded-xl text-xs text-red-500 font-semibold shadow-sm animate-modal-slide-up" style={{ animationDuration: "0.15s" }}>
          {queryError}
        </div>
      )}

      {/* Alert Dispatch Graph Card */}
      <div className="card p-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-gray-850 dark:text-slate-200 uppercase tracking-wider">Alert Dispatch Metrics</h3>
            <p className="text-[11px] text-gray-550 dark:text-slate-450 mt-0.5">Alert dispatches plotted in chronological bins</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Timeframe Presets Select */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#13151f] border border-gray-205 dark:border-slate-805 px-2.5 py-1.5 h-[34px] rounded-xl text-[10px] font-medium text-gray-555 dark:text-slate-400 shadow-sm">
              <span className="font-bold text-gray-500">Range:</span>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as any)}
                className="bg-transparent border-none outline-none font-bold text-indigo-500 dark:text-indigo-400 cursor-pointer"
              >
                <option value="5m">Last 5 Minutes</option>
                <option value="10m">Last 10 Minutes</option>
                <option value="1h">Last 1 Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom date range inputs */}
            {preset === "custom" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadMetrics(true, true);
                }}
                className="flex items-center gap-1.5 bg-white dark:bg-[#13151f] border border-gray-205 dark:border-slate-800 px-2.5 py-1.5 h-[34px] rounded-xl text-[10px] shadow-sm animate-modal-slide-up"
                style={{ animationDuration: "0.15s" }}
              >
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="bg-transparent outline-none border-none text-gray-700 dark:text-slate-200"
                />
                <span className="text-gray-350 dark:text-slate-700 font-bold">to</span>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="bg-transparent outline-none border-none text-gray-700 dark:text-slate-200"
                />
                <button
                  type="submit"
                  className="ml-1 text-indigo-500 hover:text-indigo-650 font-bold uppercase tracking-wide text-[9px]"
                >
                  Apply
                </button>
              </form>
            )}

            {/* Auto Refresh options */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#13151f] border border-gray-205 dark:border-slate-800 px-2.5 py-1.5 h-[34px] rounded-xl text-[10px] font-medium text-gray-555 dark:text-slate-400 shadow-sm">
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

            {/* Refresh trigger */}
            <button
              type="button"
              onClick={() => loadMetrics(true, true)}
              disabled={refreshing || loadingMetrics || loading}
              className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3.5 h-[34px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#13151f] hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors font-bold disabled:opacity-50 shadow-sm"
            >
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </button>
          </div>
        </div>

        {loadingMetrics ? (
          <div className="h-[280px] w-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[280px] w-full flex flex-col items-center justify-center text-center py-8">
            <Bell className="w-8 h-8 text-gray-300 dark:text-slate-700 mb-2" />
            <p className="text-xs font-semibold text-gray-800 dark:text-slate-300">No alerts sent</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">No alerts were dispatched during the selected window.</p>
          </div>
        ) : (
          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="alertMetricsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800/40" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: "rgba(19, 21, 31, 0.95)",
                    border: "1px solid rgba(148, 163, 184, 0.1)",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                    padding: "8px 12px",
                    color: "#fff"
                  }}
                  itemStyle={{ fontSize: "11px", fontWeight: "bold" }}
                  labelStyle={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px" }}
                />
                <Area type="monotone" dataKey="Alerts Sent" stroke="#818cf8" strokeWidth={2} fillOpacity={0.15} fill="#818cf8" activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Services Alert Count Table below the graph */}
      <div className="card p-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm space-y-4">
        <div>
          <h3 className="text-xs font-bold text-gray-850 dark:text-slate-200 uppercase tracking-wider">Service Alert Distribution</h3>
          <p className="text-[11px] text-gray-555 dark:text-slate-450 leading-relaxed mt-0.5">
            Total number of alert notifications sent for each service workload during the selected query timeframe.
          </p>
        </div>

        {services.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-slate-900/30 rounded-xl border border-gray-150 dark:border-slate-800/40 text-xs text-gray-400">
            No registered services found. Add services in the Services dashboard.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-150 dark:border-slate-800 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Service Workload</th>
                  <th className="py-2.5 px-3">Responsible Owner</th>
                  <th className="py-2.5 px-3 text-right">Total Alerts Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {services.map((svc) => {
                  // Find resolved count
                  const match = serviceCounts.find(sc => sc.service_owner_id === svc.service_owner_id);
                  const count = match ? match.count : 0;

                  return (
                    <tr key={svc.service_owner_id} className="hover:bg-gray-55/40 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-gray-850 dark:text-slate-200">
                          {svc.pod_prefix || "All Pods"}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400">
                          Namespace: {svc.namespace || "All"} | Cluster: {svc.cluster_name}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {svc.owners && svc.owners.length > 0 ? (
                          <div className="space-y-1.5">
                            {svc.owners.map((owner: any, index: number) => (
                              <div key={index} className="flex flex-col">
                                <div className="font-semibold text-gray-800 dark:text-slate-300">{owner.full_name}</div>
                                <div className="text-[10px] text-gray-500 dark:text-slate-400">{owner.email}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            <div className="font-semibold text-gray-800 dark:text-slate-300">{svc.owner_name}</div>
                            {svc.owner_email && <div className="text-[10px] text-gray-500 dark:text-slate-400">{svc.owner_email}</div>}
                          </>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                        {loadingMetrics ? (
                          <span className="text-gray-400 animate-pulse">...</span>
                        ) : (
                          count.toLocaleString()
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
