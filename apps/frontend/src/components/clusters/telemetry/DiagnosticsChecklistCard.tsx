"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ShieldAlert, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { type Cluster } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface DiagnosticsChecklistCardProps {
  cluster: Cluster;
  initialNodes: any[];
  initialPods: any[];
}

export default function DiagnosticsChecklistCard({ cluster, initialNodes, initialPods }: DiagnosticsChecklistCardProps) {
  const { success, error } = useToast();
  
  const [nodes, setNodes] = useState<any[]>(initialNodes);
  const [pods, setPods] = useState<any[]>(initialPods);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem(`srevox_diag_check_collapsed_${cluster.cluster_id}`);
      if (savedCollapsed) setCollapsed(savedCollapsed === "true");
    } catch {}
    setIsReady(true);
  }, [cluster.cluster_id]);

  // Save collapsed state when modified
  useEffect(() => {
    if (!isReady) return;
    try {
      localStorage.setItem(`srevox_diag_check_collapsed_${cluster.cluster_id}`, String(collapsed));
    } catch {}
  }, [collapsed, isReady, cluster.cluster_id]);

  const toastRef = useRef({ success, error });
  useEffect(() => {
    toastRef.current = { success, error };
  });

  const fetchLiveData = useCallback(async (isManual = false) => {
    setLoading(true);
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
        toastRef.current.success("Diagnostics refreshed", "Diagnostics & setup validation checks completed.");
      }
    } catch (e: any) {
      if (isManual) toastRef.current.error("Refresh failed", e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }, [cluster.cluster_id]);

  // Sync with initial props
  useEffect(() => {
    if (initialNodes.length) setNodes(initialNodes);
    if (initialPods.length) setPods(initialPods);
  }, [initialNodes, initialPods]);

  // Live validations values
  const isHealthy = cluster.status === "connected";
  const totalClNodes = nodes.length;
  const readyClNodes = nodes.filter(n => n.status === "Ready").length;
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
            className="p-1 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-650 dark:hover:text-slate-300 transition-colors shrink-0"
            title={collapsed ? "Expand card" : "Collapse card"}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <ShieldAlert className="w-4 h-4 text-indigo-500 shrink-0" />
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">Diagnostics & Configuration Checklist</h2>
          <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-655 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
            Cluster Checks
          </span>
        </div>
      </div>

      {/* Main content body */}
      {!collapsed && (
        <div className="p-5 space-y-4">
          {/* Inner Toolbar controls */}
          <div className="flex items-center justify-end pb-3 border-b border-gray-150/40 dark:border-slate-800/80">
            {/* Refresh trigger */}
            <button
              type="button"
              onClick={() => fetchLiveData(true)}
              disabled={loading}
              className="btn-secondary flex items-center gap-1.5 text-[10px] py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors font-bold disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Refresh
            </button>
          </div>

          <div className="space-y-3.5 pt-1">
            {/* Item 1: Agent Watcher */}
            <div className="flex items-start justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-semibold text-gray-900 dark:text-white">Go Watcher Agent</span>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-normal">
                  {isHealthy ? "Watcher agent connected and monitoring active crashes." : "Watcher agent went offline or is not installed."}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                isHealthy ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
              }`}>
                {isHealthy ? "Active" : "Missing"}
              </span>
            </div>

            {/* Item 2: Metrics Server integration */}
            <div className="flex items-start justify-between gap-3 text-xs border-t border-gray-200 dark:border-slate-800/50 pt-3.5">
              <div className="space-y-0.5">
                <span className="font-semibold text-gray-900 dark:text-white">Metrics API Connection</span>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-normal">
                  {cluster.metrics_status === "disabled"
                    ? "Metrics connection is disabled for agent-only mode." 
                    : cluster.metrics_status === "error" 
                    ? "Connection failing. Check your credentials configuration or metrics-server setup." 
                    : "Metrics credentials verified and collecting resource stats."}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                cluster.metrics_status === "disabled"
                  ? "bg-slate-500/10 text-slate-500 dark:text-slate-200 border border-slate-500/20"
                  : cluster.metrics_status === "error"
                  ? "bg-red-500/10 text-red-500 border border-red-500/20"
                  : "bg-green-500/10 text-green-500 border border-green-500/20"
              }`}>
                {cluster.metrics_status === "disabled" ? "Disabled" : cluster.metrics_status === "error" ? "Failing" : "Verified"}
              </span>
            </div>

            {/* Item 3: Node Availability */}
            <div className="flex items-start justify-between gap-3 text-xs border-t border-gray-200 dark:border-slate-800/50 pt-3.5">
              <div className="space-y-0.5">
                <span className="font-semibold text-gray-900 dark:text-white">Node Availability</span>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-normal">
                  {cluster.metrics_status === "disabled"
                    ? "Node monitoring is disabled for agent-only mode."
                    : readyClNodes === totalClNodes && totalClNodes > 0
                    ? "All node instances Ready & Online."
                    : `${totalClNodes - readyClNodes} nodes are reporting offline.`}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                cluster.metrics_status === "disabled"
                  ? "bg-slate-500/10 text-slate-500 dark:text-slate-200 border border-slate-500/20"
                  : readyClNodes === totalClNodes && totalClNodes > 0
                  ? "bg-green-500/10 text-green-500 border border-green-500/20"
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              }`}>
                {cluster.metrics_status === "disabled" ? "Disabled" : readyClNodes === totalClNodes && totalClNodes > 0 ? "Healthy" : "Offline"}
              </span>
            </div>

            {/* Item 4: Workload Diagnostics */}
            <div className="flex items-start justify-between gap-3 text-xs border-t border-gray-200 dark:border-slate-800/50 pt-3.5">
              <div className="space-y-0.5">
                <span className="font-semibold text-gray-900 dark:text-white">Workload Diagnostics</span>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-normal">
                  {cluster.metrics_status === "disabled"
                    ? "Workload diagnostics are disabled for agent-only mode."
                    : unhealthyPods.length === 0
                    ? "No active crash-looping or failed pods."
                    : `${unhealthyPods.length} pods are failing or in pending state.`}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                cluster.metrics_status === "disabled"
                  ? "bg-slate-500/10 text-slate-500 dark:text-slate-200 border border-slate-500/20"
                  : unhealthyPods.length === 0
                  ? "bg-green-500/10 text-green-500 border border-green-500/20"
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              }`}>
                {cluster.metrics_status === "disabled" ? "Disabled" : unhealthyPods.length === 0 ? "Stable" : "Unstable"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
