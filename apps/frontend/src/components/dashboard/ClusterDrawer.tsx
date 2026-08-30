"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle, RefreshCw, Server,
  Plus, ArrowRight, Activity, X, Circle, Cpu,
  Network, ExternalLink, AlertCircle, Clock,
  Bell, Copy
} from "lucide-react";
import {
  fetchIncidentStats,
  fetchIncidents,
  updateCluster,
  updateMetricsConnection,
  refreshMetrics,
  api
} from "@/lib/api";
import type { IncidentStats, Incident, Cluster } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { getUser, hasPermission } from "@/lib/auth";
import IncidentRow from "./IncidentRow";
import NodeRow from "./NodeRow";

export default function ClusterDrawer({
  cluster,
  onClose,
  onRefresh
}: {
  cluster: Cluster;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const me = getUser();
  const canViewClusters = hasPermission(me, "viewClusters");
  const canViewIncidents = hasPermission(me, "viewIncidents");
  const { success, error } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"incidents" | "nodes">("incidents");

  const [masterAlerts, setMasterAlerts] = useState(cluster.master_alerts_enabled ?? true);
  const [workerAlerts, setWorkerAlerts] = useState(cluster.worker_alerts_enabled ?? true);
  const [cpuThresh, setCpuThresh] = useState(cluster.node_cpu_threshold ?? 85);
  const [memThresh, setMemThresh] = useState(cluster.node_memory_threshold ?? 90);
  const [savingAlerts, setSavingAlerts] = useState(false);

  const [method, setMethod] = useState<"token" | "kubeconfig" | "agent_only">("agent_only");
  const [apiServerUrl, setApiServerUrl] = useState("");
  const [agentToken, setAgentToken] = useState("");
  const [skipTlsVerify, setSkipTlsVerify] = useState(false);
  const [kubeconfig, setKubeconfig] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [refreshingMetrics, setRefreshingMetrics] = useState(false);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  const copyStepText = async (stepNum: number, text: string) => {
    await copyToClipboard(text);
    setCopiedStep(stepNum);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const [dismissedError, setDismissedError] = useState(false);

  useEffect(() => {
    setDismissedError(sessionStorage.getItem(`dismissed-error:${cluster.cluster_id}`) === "true");
  }, [cluster.cluster_id]);

  const handleDismissError = () => {
    sessionStorage.setItem(`dismissed-error:${cluster.cluster_id}`, "true");
    setDismissedError(true);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchIncidents({ cluster_id: cluster.cluster_id, limit: "30" }),
      fetchIncidentStats({ cluster_id: cluster.cluster_id }),
      api.get(`/api/infrastructure/${cluster.cluster_id}/nodes`).catch(() => ({ data: { nodes: [] } })),
    ]).then(([i, s, n]) => {
      setIncidents(i.incidents || []);
      setStats(s);
      setNodes(n.data.nodes || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [cluster.cluster_id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleRefreshMetrics = async () => {
    setRefreshingMetrics(true);
    try {
      await refreshMetrics(cluster.cluster_id);
      success("Metrics refreshed", "Clearing client cache and rechecking node metrics");
      onRefresh();
    } catch (e: any) {
      error("Refresh failed", e.response?.data?.detail || e.message);
    } finally {
      setRefreshingMetrics(false);
    }
  };

  const isConnected = cluster.status === "connected";
  const isError     = cluster.status === "error";
  const openInc     = incidents.filter(i => i.status === "open");
  const resolvedInc = incidents.filter(i => i.status !== "open");

  // Check node offline alerts
  const showMasterOfflineAlert = cluster.master_alerts_enabled && cluster.master_nodes_ready !== undefined && cluster.master_nodes_total !== undefined && cluster.master_nodes_ready < cluster.master_nodes_total;
  const showWorkerOfflineAlert = cluster.worker_alerts_enabled && cluster.worker_nodes_ready !== undefined && cluster.worker_nodes_total !== undefined && cluster.worker_nodes_ready < cluster.worker_nodes_total;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 dark:bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col w-full sm:w-[600px] bg-white dark:bg-[#0d0f18] border-l border-gray-100 dark:border-slate-800"
        style={{ animation: "drawerIn .2s cubic-bezier(.4,0,.2,1)" }}
      >

        <style>{`
          @keyframes drawerIn { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
          .drawer-scroll::-webkit-scrollbar { width: 4px }
          .drawer-scroll::-webkit-scrollbar-thumb { background: rgba(100,100,120,0.2); border-radius: 4px }
        `}</style>

        {/* Drawer header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-800/80">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isConnected ? "bg-green-500" : isError ? "bg-red-500" : "bg-amber-500"}`} />
                <h2 className="font-bold text-gray-900 dark:text-white text-base truncate">{cluster.name}</h2>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 capitalize pl-[18px]">
                {cluster.connection_type?.replace("_", " ") ?? "Self Hosted"}
                {cluster.cloud_provider ? ` · ${cluster.cloud_provider}` : ""}
                {cluster.k8s_version && (
                  <span className="ml-1.5 font-mono bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">k8s {cluster.k8s_version}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={handleRefreshMetrics} disabled={refreshingMetrics} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 transition-colors" title="Refresh metrics cache">
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingMetrics ? "animate-spin" : ""}`} />
              </button>
              {canViewClusters && (
                <Link href={`/cluster/${cluster.cluster_id}`} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="pl-[18px] flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              isConnected || isError
                ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20"
                : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
            }`}>
              <Circle className="w-1.5 h-1.5 fill-current" />
              agent: {isConnected || isError ? "active" : "pending"}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              cluster.metrics_configured
                ? cluster.error_message
                  ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20"
                  : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20"
                : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
            }`}>
              <Circle className="w-1.5 h-1.5 fill-current" />
              metrics: {cluster.metrics_configured ? cluster.error_message ? "connection error" : "connected" : "not configured"}
            </span>
          </div>
          {cluster.error_message && !dismissedError && (
            <div className="mt-3 flex items-start justify-between gap-2 bg-red-50 dark:bg-red-500/5 border border-red-100/50 dark:border-red-500/15 rounded-xl px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 dark:text-red-400 font-mono leading-relaxed">{cluster.error_message}</p>
              </div>
              <button
                onClick={handleDismissError}
                className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 shrink-0 p-0.5 rounded transition-colors"
                title="Dismiss warning until next session"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          
          {/* Node alert warning banners in header */}
          {(showMasterOfflineAlert || showWorkerOfflineAlert) && (
            <div className="mt-3 space-y-2">
              {showMasterOfflineAlert && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/15 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                  <p className="text-xs text-red-600 dark:text-red-400 font-semibold leading-relaxed">
                    Alert: {cluster.master_nodes_total! - cluster.master_nodes_ready!} master / control-plane node(s) offline!
                  </p>
                </div>
              )}
              {showWorkerOfflineAlert && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/15 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                  <p className="text-xs text-red-600 dark:text-red-400 font-semibold leading-relaxed">
                    Alert: {cluster.worker_nodes_total! - cluster.worker_nodes_ready!} worker node(s) offline!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer stats */}
        <div className="grid grid-cols-3 gap-px bg-gray-100 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-800/80">
          {[
            { label: "Open",     value: loading ? "—" : stats?.open_count ?? 0,     color: "text-red-500"    },
            { label: "Resolved", value: loading ? "—" : stats?.resolved_count ?? 0, color: "text-green-500"  },
            { label: "24h",      value: loading ? "—" : stats?.last_24h ?? 0,       color: "text-indigo-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-[#0d0f18] px-4 py-3 text-center">
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 font-medium uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>

        {/* Node counts */}
        {cluster.metrics_configured && cluster.metrics_status === "connected" && ((cluster.worker_nodes_total ?? 0) + (cluster.master_nodes_total ?? 0) > 0) && (
          <div className="px-5 py-3 flex gap-4 border-b border-gray-100 dark:border-slate-800/80 bg-gray-50/50 dark:bg-slate-900/30">
            {(cluster.master_nodes_total ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <Cpu className={`w-3.5 h-3.5 ${showMasterOfflineAlert ? "text-red-500 animate-pulse" : "text-gray-400 dark:text-slate-500"}`} />
                <span className={`text-sm font-bold ${showMasterOfflineAlert ? "text-red-500 animate-pulse" : "text-gray-800 dark:text-slate-200"}`}>
                  {cluster.master_nodes_ready}<span className="text-gray-300 dark:text-slate-600 font-normal">/{cluster.master_nodes_total}</span>
                </span>
                <span className="text-[11px] text-gray-400 dark:text-slate-500">masters</span>
              </div>
            )}
            {(cluster.worker_nodes_total ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <Network className={`w-3.5 h-3.5 ${showWorkerOfflineAlert ? "text-red-500 animate-pulse" : "text-gray-400 dark:text-slate-500"}`} />
                <span className={`text-sm font-bold ${showWorkerOfflineAlert ? "text-red-500 animate-pulse" : "text-gray-800 dark:text-slate-200"}`}>
                  {cluster.worker_nodes_ready}<span className="text-gray-300 dark:text-slate-600 font-normal">/{cluster.worker_nodes_total}</span>
                </span>
                <span className="text-[11px] text-gray-400 dark:text-slate-500">workers</span>
              </div>
            )}
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex border-b border-gray-100 dark:border-slate-800/80 bg-gray-50/20 dark:bg-[#0c0d15] select-none">
          <button
            onClick={() => setActiveTab("incidents")}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === "incidents"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900/30"
                : "border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400"
            }`}
          >
            Incidents
          </button>
          <button
            onClick={() => setActiveTab("nodes")}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === "nodes"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900/30"
                : "border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400"
            }`}
          >
            Nodes {nodes.length > 0 && `(${nodes.length})`}
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto drawer-scroll">
          {loading ? (
            <div className="px-5 pt-5 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-gray-100 dark:bg-slate-800 mt-2 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 dark:bg-slate-800 rounded-lg w-3/4" />
                    <div className="h-2.5 bg-gray-200 dark:bg-slate-800/60 rounded-lg w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === "incidents" ? (
            incidents.length === 0 ? (
              <div className="py-20 text-center px-6">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-3" />
                <p className="font-semibold text-gray-700 dark:text-slate-300">All clear</p>
                <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">No incidents in this cluster</p>
              </div>
            ) : (
              <div>
                {openInc.length > 0 && (
                  <>
                    <div className="px-5 pt-4 pb-2">
                      <span className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Open · {openInc.length}</span>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
                      {openInc.map(inc => <IncidentRow key={inc.incident_id} inc={inc} />)}
                    </div>
                  </>
                )}
                {resolvedInc.length > 0 && (
                  <>
                    <div className="px-5 pt-5 pb-2">
                      <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Resolved · {resolvedInc.length}</span>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-slate-800/50 opacity-75">
                      {resolvedInc.map(inc => <IncidentRow key={inc.incident_id} inc={inc} />)}
                    </div>
                  </>
                )}
                <div className="h-6" />
              </div>
            )
          ) : nodes.length === 0 ? (
            <div className="py-20 text-center px-6">
              <Server className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="font-semibold text-gray-700 dark:text-slate-300">No node metrics</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Metrics server is not ready or configured.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
              {nodes.map(node => <NodeRow key={node.name} node={node} cluster={cluster} />)}
            </div>
          )}
        </div>

        {/* Drawer footer */}
        {(canViewIncidents || canViewClusters) && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-800/80 flex gap-2">
            {canViewIncidents && (
              <Link href={`/dashboard/incidents?cluster_id=${cluster.cluster_id}`} className="flex-1 btn-secondary justify-center text-sm">
                <Activity className="w-4 h-4" /> All incidents
              </Link>
            )}
            {canViewClusters && (
              <Link href={`/cluster/${cluster.cluster_id}`} className="flex-1 btn-secondary justify-center text-sm">
                <Server className="w-4 h-4" /> Manage
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
