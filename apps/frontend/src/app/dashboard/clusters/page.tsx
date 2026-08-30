"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Server, Plus, Trash2, Copy, CheckCircle, RefreshCw, Wifi, WifiOff, Clock, Pencil, Activity, AlertCircle, ExternalLink, Cpu, AlertTriangle, X, ShieldCheck } from "lucide-react";
import { fetchClusters, deleteCluster } from "@/lib/api";
import type { Cluster } from "@/lib/utils";
import { timeAgo, copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { getUser, hasPermission } from "@/lib/auth";
import AddModal from "@/components/clusters/AddModal";
import EditModal from "@/components/clusters/EditModal";
import ConnectionGuideModal from "@/components/clusters/ConnectionGuideModal";
import { BookOpen } from "lucide-react";

const CONN_INFO: Record<string, { label: string; desc: string; color: string }> = {
  agent:       { label: "Agent",            desc: "Tiny pod inside your cluster. Outbound only — no inbound firewall rules.", color: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20" },
  token:       { label: "Service Account",  desc: "Connect via direct Service Account API Token.", color: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20" },
  kubeconfig:  { label: "Kubeconfig",       desc: "Upload a read-only kubeconfig. API server must be reachable from Srevox.", color: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" },
  self_hosted: { label: "Service Account",  desc: "Run Srevox entirely inside your own infrastructure.", color: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20" },
};
const CLOUD_PROVIDERS = ["aws","gcp","azure","on-prem","other"];

const getProviderStyles = (provider: string) => {
  const p = (provider || "").toLowerCase();
  if (p === "aws") return "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20";
  if (p === "gcp") return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20";
  if (p === "azure") return "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20";
  return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700";
};


export default function ClustersPage() {
  const router = useRouter();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [editing,  setEditing]  = useState<Cluster|null>(null);
  const [copiedClusterId, setCopiedClusterId] = useState<string|null>(null);
  const { success, error } = useToast();
  const { confirm } = useConfirm();
  const me = getUser();
  const [authorized, setAuthorized] = useState(true);
  const toastShownRef = useRef(false);

  const [dismissedErrors, setDismissedErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    clusters.forEach(c => {
      if (sessionStorage.getItem(`dismissed-error:${c.cluster_id}`) === "true") {
        initial[c.cluster_id] = true;
      }
    });
    setDismissedErrors(initial);
  }, [clusters]);

  const handleDismissError = (clusterId: string) => {
    sessionStorage.setItem(`dismissed-error:${clusterId}`, "true");
    setDismissedErrors(prev => ({ ...prev, [clusterId]: true }));
  };

  const totalClusters = clusters.length;
  const connectedAgents = clusters.filter(c => c.status === "connected").length;
  const metricsConfigured = clusters.filter(c => c.metrics_configured).length;
  
  const totalMasterNodes = clusters.reduce((acc, c) => acc + (c.master_nodes_total ?? 0), 0);
  const readyMasterNodes = clusters.reduce((acc, c) => acc + (c.master_nodes_ready ?? 0), 0);
  const totalWorkerNodes = clusters.reduce((acc, c) => acc + (c.worker_nodes_total ?? 0), 0);
  const readyWorkerNodes = clusters.reduce((acc, c) => acc + (c.worker_nodes_ready ?? 0), 0);
  
  const totalNodes = totalMasterNodes + totalWorkerNodes;
  const readyNodes = readyMasterNodes + readyWorkerNodes;

  const copyClusterId = async (id: string, name: string) => {
    await copyToClipboard(id);
    setCopiedClusterId(id);
    success("Copied Cluster ID", `${name} ID copied to clipboard`);
    setTimeout(() => setCopiedClusterId(null), 2000);
  };

  const [refreshing, setRefreshing] = useState(false);

  const load = async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const d = await fetchClusters();
      setClusters(d.clusters || []);
      setAuthorized(true);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 403) {
        setAuthorized(false);
        if (!toastShownRef.current) {
          error("Access restricted: You do not have permission to view cluster infrastructure.");
          toastShownRef.current = true;
        }
      } else {
        error("Failed to load clusters");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const me = getUser();
    if (!hasPermission(me, "viewClusters")) {
      setAuthorized(false);
      setLoading(false);
      if (!toastShownRef.current) {
        error("Permission Required: You do not have permission to view clusters.");
        toastShownRef.current = true;
      }
      return;
    }
    load();
  }, []);

  const remove = async (cl: Cluster) => {
    const { confirmed } = await confirm({
      title: `Delete "${cl.name}"?`,
      message: "This will permanently remove the cluster and all its alert rules. This cannot be undone.",
      confirmLabel: "Delete cluster",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await deleteCluster(cl.cluster_id);
      success("Cluster deleted", cl.name);
      load(true);
    } catch { error("Failed to delete cluster"); }
  };

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`viewClusters`) to view cluster infrastructure.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clusters</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Connect your K8s clusters — cloud or on-prem</p>
        </div>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => setShowGuide(true)} 
            className="btn-secondary flex items-center gap-1.5 text-xs py-2.5 px-3.5 border border-gray-200 dark:border-slate-800"
            title="View Setup & RBAC Connection Guide"
          >
            <BookOpen className="w-4 h-4 text-indigo-500" /> Connection Guide
          </button>
          <button onClick={() => load(true)} disabled={refreshing} className="btn-secondary flex items-center gap-1.5 text-xs py-2.5 px-3.5">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          {hasPermission(me, "addCluster") && (
            <button id="add-cluster-btn" onClick={()=>setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-xs py-2.5 px-3.5"><Plus className="w-4 h-4"/>Add cluster</button>
          )}
        </div>
      </div>

      {showAdd && <AddModal onClose={()=>setShowAdd(false)} onAdded={load}/>}
      {editing  && <EditModal clusterId={editing.cluster_id} onClose={()=>setEditing(null)} onSaved={load}/>}
      {showGuide && <ConnectionGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} cluster={null} />}

      {/* Summary Stats Grid */}
      {clusters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Clusters */}
          <div className="card p-5 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Total Clusters</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalClusters}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
          </div>

          {/* Active Agents */}
          <div className="card p-5 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Active Agents</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{connectedAgents}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">/ {totalClusters}</p>
              </div>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              connectedAgents === totalClusters && totalClusters > 0
                ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}>
              <Wifi className="w-5 h-5" />
            </div>
          </div>

          {/* Metrics Ingestion */}
          <div className="card p-5 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Metrics Ingestion</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{metricsConfigured}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">/ {totalClusters}</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          {/* Ready Nodes */}
          <div className="card p-5 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Ready Nodes</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{readyNodes}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">/ {totalNodes}</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Read-Only Banner Note Above Cluster List */}
      <div className="bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-150 dark:border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-lg shrink-0 select-none">🔒</span>
          <div>
            <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300">Read-only access only</p>
            <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-0.5 leading-relaxed">
              Srevox only watches pod events and monitors cluster metrics. It never modifies your cluster. The agent uses a read-only ClusterRole scoped to pods and events only.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="text-xs font-bold text-indigo-650 dark:text-indigo-400 hover:underline shrink-0 hidden md:block"
        >
          View Connection Guide &rarr;
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_,i)=><div key={i} className="card p-5 animate-pulse bg-gray-100 dark:bg-slate-800 h-20"/>)}</div>
      ) : clusters.length===0 ? (
        <div className="card py-20 text-center">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><Server className="w-8 h-8 text-indigo-400"/></div>
          <p className="font-bold text-gray-800 dark:text-white mb-1">No clusters connected yet</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mb-6">Connect your first Kubernetes cluster to start monitoring</p>
          {hasPermission(me, "addCluster") && (
            <button onClick={()=>setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4"/>Add your first cluster</button>
          )}
        </div>
      ) : (
        <div id="clusters-list" className="space-y-4">
          {clusters.map((cl) => {
            const status = cl.status;
            const totalClNodes = (cl.master_nodes_total ?? 0) + (cl.worker_nodes_total ?? 0);
            const readyClNodes = (cl.master_nodes_ready ?? 0) + (cl.worker_nodes_ready ?? 0);
            const nodeRatio = totalClNodes > 0 ? (readyClNodes / totalClNodes) * 100 : 0;
            const isHealthy = status === "connected";
            const isError = status === "error";

            return (
              <div
                key={cl.cluster_id}
                onClick={() => router.push(`/cluster/${cl.cluster_id}`)}
                className={`card p-6 flex flex-col gap-4 border-l-4 hover:shadow-lg dark:hover:shadow-slate-900/40 transition-all text-left block cursor-pointer ${
                  isHealthy
                    ? "border-l-green-500"
                    : isError
                    ? "border-l-red-500 animate-pulse-slow"
                    : "border-l-amber-500"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Column 1: Info */}
                  <div className="flex items-start gap-4 min-w-0 lg:w-80 shrink-0">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center shrink-0">
                      <Server className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex flex-col gap-1.5">
                      <span className="font-bold text-gray-900 dark:text-white text-base truncate block" title={cl.name}>
                        {cl.name}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`badge text-[10px] font-semibold px-2 py-0.5 rounded-full ${CONN_INFO[cl.connection_type]?.color || "bg-gray-100 text-gray-600"}`}>
                          {CONN_INFO[cl.connection_type]?.label || cl.connection_type}
                        </span>
                        {cl.cloud_provider && (
                          <span className={`badge text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getProviderStyles(cl.cloud_provider)}`}>
                            {cl.cloud_provider}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
                        <span>Added {timeAgo(cl.created_at)}</span>
                        <span className="text-gray-300 dark:text-slate-700 select-none">•</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-gray-300 dark:text-slate-600" title={cl.cluster_id}>
                            {cl.cluster_id.slice(0, 8)}...
                          </span>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyClusterId(cl.cluster_id, cl.name); }}
                            className="p-1 bg-white dark:bg-slate-800 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 rounded transition-all shadow-sm"
                            title="Copy full Cluster ID"
                          >
                            {copiedClusterId === cl.cluster_id ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Nodes & Capacities */}
                  <div className="flex-1 min-w-0">
                    {status === "connected" && cl.metrics_configured && cl.metrics_status === "connected" && totalClNodes > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                            <Cpu className="w-3.5 h-3.5 text-indigo-500" /> Nodes Infrastructure
                          </span>
                          <span className="font-bold text-gray-800 dark:text-slate-200">
                            {readyClNodes} / {totalClNodes} Ready
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-gray-150 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              nodeRatio === 100
                                ? "bg-green-500"
                                : nodeRatio >= 50
                                ? "bg-amber-500"
                                : "bg-red-500 animate-pulse"
                            }`}
                            style={{ width: `${nodeRatio}%` }}
                          />
                        </div>
                        {/* Node details */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {(cl.master_nodes_total ?? 0) > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30">
                              Master: {cl.master_nodes_ready}/{cl.master_nodes_total}
                            </span>
                          )}
                          {(cl.worker_nodes_total ?? 0) > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                              Worker: {cl.worker_nodes_ready}/{cl.worker_nodes_total}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center h-full text-xs text-gray-400 dark:text-slate-500">
                        {status === "connected"
                          ? cl.metrics_configured
                            ? "No node metrics reported yet"
                            : "Metrics disabled in Agent mode"
                          : "Connect agent to view node metrics"}
                      </div>
                    )}
                  </div>

                  {/* Column 3: Status Details & Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-5 shrink-0 border-t border-gray-100 dark:border-slate-800/40 lg:border-t-0 pt-4 lg:pt-0">
                    <div className="flex items-center gap-4">
                      {/* Agent status */}
                      <div 
                        className={`relative group flex items-center gap-2 min-w-[100px] transition-all ${status === "error" ? "cursor-help text-red-500 hover:opacity-90" : ""}`}
                      >
                        <span className="relative flex h-2 w-2 shrink-0">
                          {isHealthy ? (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </>
                          ) : status === "pending" ? (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </>
                          ) : (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          )}
                        </span>
                        <div className="text-left">
                          <p className="text-[9px] uppercase font-bold text-gray-400 dark:text-slate-500 leading-none">Agent</p>
                          <p className={`text-xs font-semibold mt-0.5 capitalize ${
                            isHealthy ? "text-green-600 dark:text-green-400" : status === "pending" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                          }`}>
                            {isHealthy ? "active" : status}
                          </p>
                        </div>

                        {/* Instant Custom Error Tooltip */}
                        {status === "error" && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-64 p-3 bg-red-950/95 dark:bg-[#1c0f13] border border-red-500/30 text-red-200 dark:text-red-300 text-[11px] font-medium rounded-xl shadow-xl pointer-events-none opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-100 origin-bottom z-50 text-center leading-relaxed select-none">
                            <span className="font-bold block text-red-400 mb-0.5">Agent Connection Error</span>
                            {cl.error_message || "Agent went offline or connection failed."}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-red-950/95 dark:border-t-[#1c0f13]"></div>
                          </div>
                        )}
                      </div>

                      {/* Metrics status */}
                      <div 
                        className={`relative group flex items-center gap-2 border-l border-gray-100 dark:border-slate-800 pl-4 min-w-[110px] transition-all ${cl.metrics_status === "error" ? "cursor-help text-red-500 hover:opacity-90" : ""}`}
                      >
                        <span className="relative flex h-2 w-2 shrink-0">
                          {cl.metrics_status === "connected" ? (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </>
                          ) : cl.metrics_status === "error" ? (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          ) : cl.metrics_status === "pending" ? (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </>
                          ) : (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400 dark:bg-slate-600"></span>
                          )}
                        </span>
                        <div className="text-left">
                          <p className="text-[9px] uppercase font-bold text-gray-400 dark:text-slate-500 leading-none">Metrics</p>
                          <p className={`text-xs font-semibold mt-0.5 capitalize ${
                            cl.metrics_status === "connected"
                              ? "text-green-600 dark:text-green-400"
                              : cl.metrics_status === "error"
                              ? "text-red-600 dark:text-red-400"
                              : cl.metrics_status === "pending"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-gray-500 dark:text-slate-400"
                          }`}>
                            {cl.metrics_status === "connected" ? "active" : cl.metrics_status === "error" ? "error" : cl.metrics_status === "pending" ? "pending" : "disabled"}
                          </p>
                        </div>

                        {/* Instant Custom Metrics Tooltip */}
                        {cl.metrics_status === "error" && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-64 p-3 bg-red-950/95 dark:bg-[#1c0f13] border border-red-500/30 text-red-200 dark:text-red-300 text-[11px] font-medium rounded-xl shadow-xl pointer-events-none opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-100 origin-bottom z-50 text-center leading-relaxed select-none">
                            <span className="font-bold block text-red-400 mb-0.5">Metrics Connection Error</span>
                            {cl.metrics_error || "Metrics Server not installed or reporting."}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-red-950/95 dark:border-t-[#1c0f13]"></div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between border-t sm:border-t-0 border-gray-100 dark:border-slate-800/40 pt-3 sm:pt-0">
                      <Link
                        href={`/dashboard/incidents?cluster_id=${cl.cluster_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn-secondary text-xs font-semibold py-2 px-3 flex items-center gap-1 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all"
                        title="View cluster incidents feed"
                      >
                        Incidents
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Warning Banner if cluster has connection or metrics error */}
                {((status === "error") || (cl.metrics_status === "error")) && !dismissedErrors[cl.cluster_id] && (
                  <div className="mt-2 flex items-start justify-between gap-2.5 bg-red-50/50 dark:bg-red-500/5 border border-red-100/50 dark:border-red-500/15 rounded-xl px-4 py-3 w-full">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-red-700 dark:text-red-400">
                        <p className="font-semibold">
                          {status === "error" ? "Cluster connection error detected." : "Metrics Server error detected."}
                        </p>
                        <p className="text-[11px] mt-1 opacity-90 leading-relaxed">
                          {status === "error" 
                            ? "Srevox is failing to connect to the cluster. Please verify that the API Server endpoint is reachable or update the connection credentials."
                            : "Kubernetes Metrics Server is not reporting data or is not installed in this cluster. Nodes/pods telemetry metrics are disabled. Please install metrics-server on your cluster."}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDismissError(cl.cluster_id); }}
                      className="text-red-400 hover:text-red-650 shrink-0 p-0.5 rounded transition-colors"
                      title="Dismiss warning until next session"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}