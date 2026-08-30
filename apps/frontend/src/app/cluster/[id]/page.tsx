"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle, RefreshCw, Server,
  Activity, ArrowLeft, Cpu, Network, AlertCircle,
  Clock, Bell, Copy, ShieldAlert, Radio, Layers, Loader2,
  Trash2, Check, Settings, Save, ArrowRight, X, BookOpen, Plus,
  ChevronDown, ChevronUp, ShieldCheck
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid, Legend } from "recharts";
import {
  fetchIncidentStats,
  fetchIncidents,
  fetchCluster,
  updateCluster,
  updateMetricsConnection,
  refreshMetrics,
  deleteCluster,
  api
} from "@/lib/api";
import type { IncidentStats, Incident, Cluster } from "@/lib/utils";
import { copyToClipboard, timeAgo } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { getUser, hasPermission } from "@/lib/auth";
import IncidentRow from "@/components/dashboard/IncidentRow";
import ConnectionGuideModal from "@/components/clusters/ConnectionGuideModal";
import ClusterNodesCard from "@/components/clusters/telemetry/ClusterNodesCard";
import ResourceTrendsCard from "@/components/clusters/telemetry/ResourceTrendsCard";
import NodeComparisonCard from "@/components/clusters/telemetry/NodeComparisonCard";
import PodAllocationCard from "@/components/clusters/telemetry/PodAllocationCard";
import PodsHealthHotspotsCard from "@/components/clusters/telemetry/PodsHealthHotspotsCard";
import DiagnosticsChecklistCard from "@/components/clusters/telemetry/DiagnosticsChecklistCard";
import NamespaceResourceAllocationCard from "@/components/clusters/telemetry/NamespaceResourceAllocationCard";

const CONN_INFO: Record<string, { label: string; desc: string; color: string }> = {
  agent:       { label: "Agent",            desc: "Tiny pod inside your cluster. Outbound only — no inbound firewall rules.", color: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20" },
  token:       { label: "Service Account",  desc: "Connect via direct Service Account API Token.", color: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20" },
  kubeconfig:  { label: "Kubeconfig",       desc: "Upload a read-only kubeconfig. API server must be reachable from Srevox.", color: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" },
  self_hosted: { label: "Service Account",  desc: "Run Srevox entirely inside your own infrastructure.", color: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20" },
};

const getProviderStyles = (provider: string) => {
  const p = (provider || "").toLowerCase();
  if (p === "aws") return "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20";
  if (p === "gcp") return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20";
  if (p === "azure") return "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20";
  return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700";
};

export default function ClusterDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { success, error, info } = useToast();
  const { confirm } = useConfirm();
  const me = getUser();

  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"nodes" | "settings">("nodes");
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showAllIncidents, setShowAllIncidents] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [metricType, setMetricType] = useState<"resources" | "pods" | "nodes_bar">("resources");
  const [pods, setPods] = useState<any[]>([]);
  const [nodesError, setNodesError] = useState<string | null>(null);
  const [podsError, setPodsError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [incidentsCollapsed, setIncidentsCollapsed] = useState(false);

  useEffect(() => {
    if (!mounted || !id) return;
    try {
      const saved = localStorage.getItem(`srevox_incidents_collapsed_${id}`);
      if (saved) setIncidentsCollapsed(saved === "true");
    } catch {}
  }, [mounted, id]);

  useEffect(() => {
    if (!mounted || !id) return;
    try {
      localStorage.setItem(`srevox_incidents_collapsed_${id}`, String(incidentsCollapsed));
    } catch {}
  }, [incidentsCollapsed, mounted, id]);

  const [dismissedError, setDismissedError] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedAgentToken, setCopiedAgentToken] = useState(false);

  useEffect(() => {
    if (id) {
      setDismissedError(sessionStorage.getItem(`dismissed-error:${id}`) === "true");
    }
  }, [id]);

  const handleDismissError = () => {
    sessionStorage.setItem(`dismissed-error:${id}`, "true");
    setDismissedError(true);
  };

  const handleCopyId = () => {
    if (cluster) {
      copyToClipboard(cluster.cluster_id);
      setCopiedId(true);
      success("Copied to clipboard", "Cluster ID copied successfully!");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleCopyAgentToken = () => {
    if (cluster && cluster.agent_token) {
      copyToClipboard(cluster.agent_token);
      setCopiedAgentToken(true);
      success("Copied to clipboard", "Agent Token copied successfully!");
      setTimeout(() => setCopiedAgentToken(false), 2000);
    }
  };

  // Edit / Config State
  const [name, setName] = useState("");
  const [cloudProvider, setCloudProvider] = useState("other");
  const [masterAlerts, setMasterAlerts] = useState(true);
  const [workerAlerts, setWorkerAlerts] = useState(true);
  const [cpuThresh, setCpuThresh] = useState(85);
  const [memThresh, setMemThresh] = useState(90);
  const [updatingName, setUpdatingName] = useState(false);
  const [updatingAlerts, setUpdatingAlerts] = useState(false);
  const [updatingThresholds, setUpdatingThresholds] = useState(false);

  // Connection Credentials State
  const [method, setMethod] = useState<"token" | "kubeconfig" | "agent_only">("agent_only");
  const [apiServerUrl, setApiServerUrl] = useState("");
  const [agentToken, setAgentToken] = useState("");
  const [skipTlsVerify, setSkipTlsVerify] = useState(false);
  const [kubeconfig, setKubeconfig] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [refreshingMetrics, setRefreshingMetrics] = useState(false);


  const [authorized, setAuthorized] = useState(true);
  const toastShownRef = useRef(false);

  const loadData = useCallback(async (quiet = false) => {
    const user = getUser();
    if (!hasPermission(user, "viewClusters")) {
      setAuthorized(false);
      setLoading(false);
      if (!toastShownRef.current) {
        error("Permission Required: You do not have permission to view clusters.");
        toastShownRef.current = true;
      }
      return;
    }

    if (!quiet) setLoading(true);
    else setRefreshing(false);
    try {
      const cl = await fetchCluster(id);
      setCluster(cl);
      setName(cl.name);
      setCloudProvider(cl.cloud_provider || "other");
      setMasterAlerts(cl.master_alerts_enabled ?? true);
      setWorkerAlerts(cl.worker_alerts_enabled ?? true);
      setCpuThresh(cl.node_cpu_threshold ?? 85);
      setMemThresh(cl.node_memory_threshold ?? 90);

      const defaultMethod = cl.kubeconfig_encrypted
        ? "kubeconfig"
        : cl.api_server_url
        ? "token"
        : "agent_only";
      setMethod(defaultMethod);
      setApiServerUrl(cl.api_server_url || "");
      setAgentToken(cl.agent_token || "");
      setSkipTlsVerify(cl.skip_tls_verify ?? false);
      setKubeconfig(cl.kubeconfig_encrypted || "");

      const shouldFetchMetrics = cl.metrics_configured && cl.metrics_status === "connected";

      const [incRes, statsRes, nodesRes, podsRes] = await Promise.all([
        fetchIncidents({ cluster_id: id, limit: "30" }),
        fetchIncidentStats({ cluster_id: id }),
        shouldFetchMetrics ? api.get(`/api/infrastructure/${id}/nodes`).catch(() => ({ data: { nodes: [], error: null } })) : Promise.resolve({ data: { nodes: [], error: null } }),
        shouldFetchMetrics ? api.get(`/api/infrastructure/${id}/pods`).catch(() => ({ data: { pods: [], error: null } })) : Promise.resolve({ data: { pods: [], error: null } }),
      ]);

      setIncidents(incRes.incidents || []);
      setStats(statsRes);
      setNodes(nodesRes.data?.nodes || []);
      setPods(podsRes.data?.pods || []);
      setNodesError(shouldFetchMetrics ? (nodesRes.data?.error || null) : null);
      setPodsError(shouldFetchMetrics ? (podsRes.data?.error || null) : null);
    } catch (err) {
      console.error(err);
      error("Failed to load cluster details");
    } finally {
      setLoading(false);
    }
  }, [id, error]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  const handleUpdateGeneral = async () => {
    setUpdatingName(true);
    try {
      await updateCluster(id, {
        name,
        cloud_provider: cloudProvider,
      });
      success("General settings updated", "Cluster display name and provider saved successfully.");
      loadData(true);
    } catch {
      error("Failed to update general settings");
    } finally {
      setUpdatingName(false);
    }
  };

  const handleUpdateAlerts = async () => {
    setUpdatingAlerts(true);
    try {
      await updateCluster(id, {
        master_alerts_enabled: masterAlerts,
        worker_alerts_enabled: workerAlerts,
      });
      success("Alert rules updated", "Node offline alert settings saved successfully.");
      loadData(true);
    } catch {
      error("Failed to update alert rules");
    } finally {
      setUpdatingAlerts(false);
    }
  };

  const handleUpdateThresholds = async () => {
    setUpdatingThresholds(true);
    try {
      await updateCluster(id, {
        node_cpu_threshold: Number(cpuThresh),
        node_memory_threshold: Number(memThresh),
      });
      success("Thresholds updated", "Resource usage warn limits saved successfully.");
      loadData(true);
    } catch {
      error("Failed to update threshold limits");
    } finally {
      setUpdatingThresholds(false);
    }
  };

  const handleSaveMetrics = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await updateMetricsConnection(id, {
        method,
        api_server_url: apiServerUrl,
        agent_token: agentToken,
        skip_tls_verify: skipTlsVerify,
        kubeconfig,
      });
      setTestResult({ success: true, message: res.message });
      success("Connection saved", res.message);
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || "Connection failed";
      setTestResult({ success: false, message: errMsg });
      error("Connection failed", errMsg);
    } finally {
      setTestingConnection(false);
      loadData(true);
    }
  };

  const handleRefreshMetrics = async () => {
    setRefreshingMetrics(true);
    try {
      await refreshMetrics(id);
      success("Metrics refreshed", "Clearing client cache and rechecking node metrics");
      loadData(true);
    } catch (e: any) {
      error("Refresh failed", e.response?.data?.detail || e.message);
    } finally {
      setRefreshingMetrics(false);
    }
  };

  const handleDelete = async () => {
    if (!cluster) return;
    const { confirmed } = await confirm({
      title: `Delete "${cluster.name}"?`,
      message: "This will permanently remove the cluster connection and all active alert rules. This cannot be undone.",
      confirmLabel: "Delete cluster",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await deleteCluster(id);
      success("Cluster deleted", cluster.name);
      router.push("/dashboard/clusters");
    } catch {
      error("Failed to delete cluster");
    }
  };

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`viewClusters`) to view cluster details and telemetry.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="card py-16 text-center max-w-md mx-auto mt-12 bg-white dark:bg-[#13151f] border rounded-3xl">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cluster Not Found</h2>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">The cluster you are looking for does not exist or has been deleted.</p>
        <Link href="/dashboard/clusters" className="btn-primary mt-6 inline-flex items-center gap-1.5 py-2 px-4 rounded-xl">
          <ArrowLeft className="w-4 h-4" /> Back to Clusters
        </Link>
      </div>
    );
  }

  const isHealthy = cluster.status === "connected";
  const isError     = cluster.status === "error";
  const openInc     = incidents.filter(i => i.status === "open");
  const resolvedInc = incidents.filter(i => i.status !== "open");

  const totalClNodes = (cluster.master_nodes_total ?? 0) + (cluster.worker_nodes_total ?? 0);
  const readyClNodes = (cluster.master_nodes_ready ?? 0) + (cluster.worker_nodes_ready ?? 0);
  const nodeRatio = totalClNodes > 0 ? (readyClNodes / totalClNodes) * 100 : 0;
  
  const avgCpu = nodes.length ? Math.round(nodes.reduce((acc, n) => acc + (n.cpu_usage_pct || 0), 0) / nodes.length) : 0;
  const avgMem = nodes.length ? Math.round(nodes.reduce((acc, n) => acc + (n.memory_usage_pct || 0), 0) / nodes.length) : 0;
  const totalPods = pods.length;
  const podsCapacity = nodes.length ? nodes.reduce((acc, n) => acc + (n.pods_capacity || 110), 0) : 0;
  const podPct = podsCapacity ? Math.round((totalPods / podsCapacity) * 100) : 0;

  const chartData = [
    { time: "10:00", cpu: Math.max(0, avgCpu - 8), mem: Math.max(0, avgMem - 4), pods: Math.max(0, podPct - 3) },
    { time: "11:00", cpu: Math.max(0, avgCpu - 3), mem: Math.max(0, avgMem - 1), pods: Math.max(0, podPct - 2) },
    { time: "12:00", cpu: Math.max(0, avgCpu + 5), mem: Math.max(0, avgMem + 2), pods: Math.max(0, podPct + 1) },
    { time: "13:00", cpu: Math.max(0, avgCpu - 4), mem: Math.max(0, avgMem - 3), pods: Math.max(0, podPct) },
    { time: "14:00", cpu: avgCpu, mem: avgMem, pods: podPct }
  ];

  const nodeBarData = nodes.map(n => ({
    name: n.name.length > 15 ? `${n.name.substring(0, 12)}...` : n.name,
    CPU: n.cpu_usage_pct,
    Memory: n.memory_usage_pct
  }));

  const totalRestarts = pods.reduce((acc, p) => acc + (p.restarts || 0), 0);
  const unhealthyPods = pods.filter(p => p.status !== "Running" && p.status !== "Succeeded");

  // Group pods by namespace for Namespace resource distribution card
  const nsUsageMap = new Map<string, { count: number; cpu: number; mem: number }>();
  pods.forEach(p => {
    const ns = p.namespace || "default";
    const current = nsUsageMap.get(ns) || { count: 0, cpu: 0, mem: 0 };
    nsUsageMap.set(ns, {
      count: current.count + 1,
      cpu: current.cpu + (p.cpu_usage_m || 0),
      mem: current.mem + (p.memory_usage_mi || 0)
    });
  });
  const nsList = Array.from(nsUsageMap.entries()).map(([name, data]) => ({
    name,
    ...data
  })).sort((a, b) => b.mem - a.mem); // sort by memory usage
  const maxNsMem = nsList.length > 0 ? Math.max(...nsList.map(n => n.mem)) : 1;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col gap-4 border-b border-gray-200 dark:border-slate-800/80 pb-5">
        <div className="flex items-center justify-between">
          <Link href="/dashboard/clusters" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-605 dark:hover:text-slate-200 transition-colors font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Clusters
          </Link>
          <button
            onClick={() => setShowGuideModal(true)}
            className="btn-secondary flex items-center gap-1.5 text-[10px] py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-600 dark:text-slate-350 transition-colors font-bold shadow-sm"
          >
            <BookOpen className="w-3 h-3 text-indigo-500" />
            Connection Guide
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center shrink-0">
                <Server className="w-5.5 h-5.5 text-indigo-500" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">{cluster.name}</h1>
                  <span className={`badge text-[10px] font-semibold px-2 py-0.5 rounded-full ${CONN_INFO[cluster.connection_type]?.color || "bg-gray-100 text-gray-600"}`}>
                    {CONN_INFO[cluster.connection_type]?.label || cluster.connection_type}
                  </span>
                  {cluster.cloud_provider && (
                    <span className={`badge text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getProviderStyles(cluster.cloud_provider)}`}>
                      {cluster.cloud_provider}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-lg border border-gray-200/40 dark:border-slate-800/60 select-all">
                    ID: {cluster.cluster_id}
                  </span>
                  <button
                    onClick={handleCopyId}
                    className="p-1 bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-350 border border-gray-200/40 dark:border-slate-800 rounded-lg transition-all shadow-sm flex items-center justify-center mr-2"
                    title="Copy Cluster ID"
                  >
                    {copiedId ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {cluster.agent_token && cluster.agent_token.startsWith("agt") && (
                    <>
                      <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-lg border border-gray-200/40 dark:border-slate-800/60 select-all">
                        Agent Token: {cluster.agent_token}
                      </span>
                      <button
                        onClick={handleCopyAgentToken}
                        className="p-1 bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-350 border border-gray-200/40 dark:border-slate-800 rounded-lg transition-all shadow-sm flex items-center justify-center mr-2"
                        title="Copy Agent Token"
                      >
                        {copiedAgentToken ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </>
                  )}

                  {/* Connection health badges */}
                  <div 
                    className={`relative group flex items-center gap-1.5 bg-gray-50/50 dark:bg-slate-900/10 border border-gray-200/45 dark:border-slate-800/60 rounded-xl px-2.5 py-1 text-xs transition-all ${cluster.status === "error" ? "cursor-help hover:border-red-500/50 dark:hover:border-red-900/40" : ""}`}
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      {isHealthy ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </>
                      ) : cluster.status === "pending" ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </>
                      ) : (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      )}
                    </span>
                    <span className="font-semibold capitalize text-gray-700 dark:text-slate-300">Agent: {isHealthy ? "active" : cluster.status}</span>

                    {/* Instant Custom Error Tooltip */}
                    {cluster.status === "error" && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-64 p-3 bg-red-950/95 dark:bg-[#1c0f13] border border-red-500/30 text-red-200 dark:text-red-300 text-[11px] font-medium rounded-xl shadow-xl pointer-events-none opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-100 origin-bottom z-50 text-center leading-relaxed select-none">
                        <span className="font-bold block text-red-400 mb-0.5">Agent Connection Error</span>
                        {cluster.error_message || "Agent went offline or connection failed."}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-red-950/95 dark:border-t-[#1c0f13]"></div>
                      </div>
                    )}
                  </div>

                  <div 
                    className={`relative group flex items-center gap-1.5 bg-gray-50/50 dark:bg-slate-900/10 border border-gray-200/45 dark:border-slate-800/60 rounded-xl px-2.5 py-1 text-xs transition-all ${cluster.metrics_status === "error" ? "cursor-help hover:border-red-500/50 dark:hover:border-red-900/40" : ""}`}
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      {cluster.metrics_status === "connected" ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </>
                      ) : cluster.metrics_status === "error" ? (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      ) : cluster.metrics_status === "pending" ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </>
                      ) : (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400 dark:bg-slate-600"></span>
                      )}
                    </span>
                    <span className="font-semibold capitalize text-gray-700 dark:text-slate-300">
                      Metrics: {cluster.metrics_status === "connected" ? "active" : cluster.metrics_status === "error" ? "error" : cluster.metrics_status === "pending" ? "pending" : "disabled"}
                    </span>

                    {/* Instant Custom Metrics Tooltip */}
                    {cluster.metrics_status === "error" && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-64 p-3 bg-red-950/95 dark:bg-[#1c0f13] border border-red-500/30 text-red-200 dark:text-red-300 text-[11px] font-medium rounded-xl shadow-xl pointer-events-none opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-100 origin-bottom z-50 text-center leading-relaxed select-none">
                        <span className="font-bold block text-red-400 mb-0.5">Metrics Connection Error</span>
                        {cluster.metrics_error || "Metrics Server not installed or reporting."}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-red-950/95 dark:border-t-[#1c0f13]"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
                   {/* Action buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Refresh Button */}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3 h-[34px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors shadow-sm font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {/* Infrastructure Link Button */}
            <Link
              href={`/cluster/${id}/infrastructure`}
              className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3 h-[34px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors shadow-sm font-bold animate-pulse-subtle"
            >
              <Activity className="w-3.5 h-3.5 text-gray-400" />
              Infrastructure
            </Link>
            {/* Settings Link Button */}
            <Link
              href={`/cluster/${id}/settings`}
              className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3 h-[34px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors shadow-sm font-bold"
            >
              <Settings className="w-3.5 h-3.5 text-gray-400" />
              Settings
            </Link>
          </div>
        </div>
      </div>
      <div className="space-y-6">
        {/* Agent-Only Banner Card when metrics are not configured */}
        {!cluster.metrics_configured && (
          <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none">
            <div className="flex items-center gap-3 text-left">
              <Activity className="w-5 h-5 text-indigo-500 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Agent-Only Mode Active</h4>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-0.5 leading-relaxed">
                  Your cluster is using Srevox Agent for crash logs & incident monitoring. To enable real-time CPU & memory telemetry graphs, configure a <strong>Service Account Token</strong> or <strong>Kubeconfig</strong> in Settings.
                </p>
              </div>
            </div>
            <Link
              href={`/cluster/${id}/settings`}
              className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap shrink-0 font-bold"
            >
              Configure Metrics
            </Link>
          </div>
        )}

        {/* Summary Stats Grid */}
        <div className={`grid grid-cols-1 ${cluster.metrics_configured ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-4`}>
          <div className="card p-4 bg-white/40 dark:bg-slate-900/40 border border-gray-200/40 dark:border-slate-800/40 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-655 dark:text-red-400 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-white leading-none">{stats?.open_count ?? 0}</div>
              <div className="text-[10px] font-medium text-gray-400 dark:text-slate-500 mt-1.5 uppercase tracking-wider">Open Incidents</div>
            </div>
          </div>

          <div className="card p-4 bg-white/40 dark:bg-slate-900/40 border border-gray-200/40 dark:border-slate-800/40 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-white leading-none">{stats?.resolved_count ?? 0}</div>
              <div className="text-[10px] font-medium text-gray-400 dark:text-slate-500 mt-1.5 uppercase tracking-wider">Resolved Incidents</div>
            </div>
          </div>

          {cluster.metrics_configured && (
            <div className="card p-4 bg-white/40 dark:bg-slate-900/40 border border-gray-200/40 dark:border-slate-800/40 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900 dark:text-white leading-none">{totalClNodes}</div>
                <div className="text-[10px] font-medium text-gray-400 dark:text-slate-500 mt-1.5 uppercase tracking-wider">Total Nodes</div>
              </div>
            </div>
          )}
        </div>

          {/* Connection Error Banner */}
          {cluster.metrics_configured && ((isError) || (cluster.metrics_status === "error")) && !dismissedError && (
            <div className="flex items-start justify-between gap-3 bg-red-50/50 dark:bg-red-500/5 border border-red-150/60 dark:border-red-500/15 rounded-2xl p-4 w-full">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-xs text-red-700 dark:text-red-400 space-y-1">
                  <p className="font-bold">
                    {cluster.status === "error" ? "Cluster connection error detected." : "Metrics Server error detected."}
                  </p>
                  <p className="opacity-90 leading-relaxed">
                    {cluster.status === "error" 
                      ? "Srevox is failing to connect to the cluster. Please verify that the API Server endpoint is reachable or update the connection credentials."
                      : "Kubernetes Metrics Server is not reporting data or is not installed in this cluster. Nodes/pods telemetry metrics are disabled. Please install metrics-server on your cluster."}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismissError}
                className="text-red-400 hover:text-red-650 shrink-0 p-1 rounded-lg transition-colors"
                title="Dismiss warning until next session"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Node Health Alert Banners */}
          {cluster.metrics_configured && cluster.master_alerts_enabled && cluster.master_nodes_ready !== undefined && cluster.master_nodes_total !== undefined && cluster.master_nodes_ready < cluster.master_nodes_total && (
            <div className="flex items-start gap-3 bg-amber-50/50 dark:bg-amber-500/5 border border-amber-150/60 dark:border-amber-500/15 rounded-2xl p-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <p className="font-bold">Control Plane warning!</p>
                <p className="opacity-90 leading-relaxed">
                  Only {cluster.master_nodes_ready} out of {cluster.master_nodes_total} control plane nodes are active / ready in this cluster.
                </p>
              </div>
            </div>
          )}

          {/* Direct Metrics Connection Error Panel (when configured but failing) */}
          {cluster.metrics_configured && cluster.metrics_status !== "connected" && (
            <div className="card p-6 bg-red-500/[0.02] border border-red-500/10 rounded-2xl flex flex-col items-center text-center justify-center space-y-4 py-12 select-none">
              <AlertTriangle className="w-12 h-12 text-red-500 animate-pulse" />
              <div className="space-y-1.5 max-w-md">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Direct Metrics Connection Offline</h3>
                <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed">
                  Srevox is unable to query live nodes/pods metrics from your Kubernetes API server. Check your Service Account Token, Kubeconfig, or API Server URL.
                </p>
                {cluster.metrics_error && (
                  <pre className="bg-red-950/20 dark:bg-[#1a0c10] border border-red-500/15 rounded-xl p-3 font-mono text-[10px] text-red-655 dark:text-red-400 overflow-x-auto text-left leading-relaxed mt-2 select-all max-w-full">
                    {cluster.metrics_error}
                  </pre>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="btn-secondary text-xs py-1.5 px-3 h-[30px] rounded-lg font-bold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  Retry Connection
                </button>
                <Link
                  href={`/cluster/${id}/settings`}
                  className="btn-primary text-xs py-1.5 px-3 h-[30px] rounded-lg font-bold"
                >
                  Update Credentials
                </Link>
              </div>
            </div>
          )}

          {/* Nodes Telemetry & Metrics Cards (Only rendered if metrics_configured is active and connected) */}
          {cluster.metrics_configured && cluster.metrics_status === "connected" && (
            <>
              {/* Nodes Telemetry Card */}
              <ClusterNodesCard
                cluster={cluster}
                initialNodes={nodes}
                initialError={nodesError}
              />

              {/* Cluster Telemetry Standalone Cards */}
              <ResourceTrendsCard
                cluster={cluster}
                initialNodes={nodes}
              />
              <NodeComparisonCard
                cluster={cluster}
                initialNodes={nodes}
              />
              <PodAllocationCard
                cluster={cluster}
                initialNodes={nodes}
                initialPods={pods}
              />

              {/* Pods Health & Hotspots Card */}
              <PodsHealthHotspotsCard
                cluster={cluster}
                initialNodes={nodes}
                initialPods={pods}
              />

              {/* Diagnostics Checklist Card */}
              <DiagnosticsChecklistCard
                cluster={cluster}
                initialNodes={nodes}
                initialPods={pods}
              />

              {/* Namespace Resource Allocation Card */}
              <NamespaceResourceAllocationCard
                cluster={cluster}
                initialPods={pods}
              />
            </>
          )}

        {/* Incident Logs Card */}
        <div className="border bg-white/70 dark:bg-[#13151f] border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-sm select-none">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/15 p-4 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIncidentsCollapsed(!incidentsCollapsed)}
                className="p-1 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-650 dark:hover:text-slate-300 transition-colors shrink-0"
                title={incidentsCollapsed ? "Expand card" : "Collapse card"}
              >
                {incidentsCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <h2 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Active Cluster Incidents
                <span className="bg-red-50 dark:bg-red-500/10 text-red-655 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {stats?.open_count ?? 0} total
                </span>
              </h2>
            </div>
            <Link
              href={`/dashboard/incidents?cluster_id=${id}`}
              className="text-xs text-indigo-500 hover:text-indigo-655 transition-colors font-bold inline-flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {!incidentsCollapsed && (
            <div className="divide-y divide-gray-100 dark:divide-slate-800/80">
              {incidents.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 dark:text-slate-500 italic">
                  No active incidents recorded for this cluster.
                </div>
              ) : (
                incidents.slice(0, 10).map((inc) => (
                  <IncidentRow key={inc.incident_id} inc={inc} />
                ))
              )}
            </div>
          )}
        </div>

        <ConnectionGuideModal
          isOpen={showGuideModal}
          onClose={() => setShowGuideModal(false)}
          cluster={cluster}
        />
      </div>
    </div>
  );
}
