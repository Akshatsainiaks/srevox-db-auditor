"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Server, Cpu, HardDrive, Activity, AlertTriangle, RefreshCw, Plus, Zap, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { getUser, hasPermission } from "@/lib/auth";
import { useRef } from "react";

interface NodeMetric {
  name: string;
  role: "master" | "worker";
  status: "Ready" | "NotReady";
  cpu_usage_pct: number;
  memory_usage_pct: number;
  cpu_cores: number;
  memory_gb: number;
  pods_running: number;
  pods_capacity: number;
  age: string;
  conditions: { type: string; status: string }[];
}

interface PodMetric {
  name: string;
  namespace: string;
  node: string;
  status: string;
  cpu_usage_m: number;   // millicores
  memory_usage_mi: number; // MiB
  cpu_limit_m?: number;
  memory_limit_mi?: number;
  restarts: number;
  age: string;
}

interface ClusterInfo {
  cluster_id: string;
  name: string;
  status: string;
  connection_type?: string;
  metrics_configured?: boolean;
  metrics_status?: string;
}

interface ResourceAlert {
  resource_alert_id: string;
  cluster_id: string;
  resource_type: "cpu" | "memory" | "pod_restarts";
  threshold_pct: number;
  target: "node" | "pod" | "namespace";
  target_name?: string;
  severity: string;
  enabled: boolean;
}

function UsageBar({ pct, warn = 70, crit = 90 }: { pct: number; warn?: number; crit?: number }) {
  const color = pct >= crit ? "bg-red-500" : pct >= warn ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-bold w-10 text-right ${pct >= crit ? "text-red-600 dark:text-red-400" : pct >= warn ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, sub }: { label: string; value: string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">{label}</div>
          {sub && <div className="text-xs text-gray-400 dark:text-slate-500">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function AddAlertModal({ clusters, onClose, onSaved }: { clusters: ClusterInfo[]; onClose: () => void; onSaved: () => void }) {
  const [clusterId, setClusterId] = useState(clusters[0]?.cluster_id || "");
  const [resourceType, setResourceType] = useState<"cpu" | "memory" | "pod_restarts">("cpu");
  const [threshold, setThreshold] = useState(80);
  const [target, setTarget] = useState<"node" | "pod" | "namespace">("node");
  const [targetName, setTargetName] = useState("");
  const [severity, setSeverity] = useState("warning");
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const submit = async () => {
    setLoading(true);
    try {
      await api.post("/api/resource-alerts", {
        cluster_id: clusterId, resource_type: resourceType,
        threshold_pct: threshold, target, target_name: targetName || null,
        severity, enabled: true,
      });
      success("Resource alert created!", `Alert when ${resourceType} > ${threshold}%`);
      onSaved(); onClose();
    } catch { error("Failed to create alert"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2130] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-white">New resource alert</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Cluster</label>
            <select className="input" value={clusterId} onChange={e => setClusterId(e.target.value)}>
              {clusters.map(c => <option key={c.cluster_id} value={c.cluster_id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Resource type</label>
            <div className="grid grid-cols-3 gap-2">
              {(["cpu", "memory", "pod_restarts"] as const).map(r => (
                <button key={r} onClick={() => setResourceType(r)}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium capitalize transition-all ${resourceType === r ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"}`}>
                  {r === "pod_restarts" ? "Restarts" : r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">
              {resourceType === "pod_restarts" ? "Restart count threshold" : `Threshold (${threshold}%)`}
            </label>
            <input type="range" min={resourceType === "pod_restarts" ? 1 : 50} max={resourceType === "pod_restarts" ? 100 : 100}
              value={threshold} onChange={e => setThreshold(Number(e.target.value))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-1">
              <span>{resourceType === "pod_restarts" ? "1 restart" : "50%"}</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{threshold}{resourceType === "pod_restarts" ? " restarts" : "%"}</span>
              <span>{resourceType === "pod_restarts" ? "100 restarts" : "100%"}</span>
            </div>
          </div>
          <div>
            <label className="label">Apply to</label>
            <div className="grid grid-cols-3 gap-2">
              {(["node", "pod", "namespace"] as const).map(t => (
                <button key={t} onClick={() => setTarget(t)}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium capitalize transition-all ${target === t ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{target === "node" ? "Node name (empty = all nodes)" : target === "namespace" ? "Namespace (empty = all)" : "Pod prefix (empty = all pods)"}</label>
            <input className="input" placeholder={target === "node" ? "worker-1" : target === "namespace" ? "production" : "payment-service"}
              value={targetName} onChange={e => setTargetName(e.target.value)} />
          </div>
          <div>
            <label className="label">Severity</label>
            <div className="flex gap-2">
              {["info","warning","critical"].map(s => (
                <button key={s} onClick={() => setSeverity(s)}
                  className={`flex-1 py-2 rounded-xl border text-xs font-medium capitalize transition-all ${severity === s ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={submit} disabled={!clusterId || loading} className="btn-primary flex-1 justify-center">
              {loading ? "Creating..." : "Create alert"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InfrastructurePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/clusters");
  }, [router]);

  const showPage = false;
  if (!showPage) {
    return null;
  }

  const [clusters,      setClusters]     = useState<ClusterInfo[]>([]);
  const [selectedCluster, setSelected]  = useState<string>("");
  const [nodes,         setNodes]        = useState<NodeMetric[]>([]);
  const [pods,          setPods]         = useState<PodMetric[]>([]);
  const [alerts,        setAlerts]       = useState<ResourceAlert[]>([]);
  const [loading,       setLoading]      = useState(false);
  const [refreshing,    setRefreshing]   = useState(false);
  const [showAddAlert,  setShowAddAlert] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const toastShownRef = useRef(false);
  const [expandedNode,  setExpandedNode] = useState<string | null>(null);
  const [nsFilter,      setNsFilter]     = useState("all");
  const { success, error } = useToast();
  const { confirm } = useConfirm();

  const loadClusters = async () => {
    try {
      const r = await api.get("/api/clusters");
      const cls = r.data.clusters || [];
      setClusters(cls);
      if (cls.length > 0) setSelected(cls[0].cluster_id);
      setAuthorized(true);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 403) {
        setAuthorized(false);
        if (!toastShownRef.current) {
          error("Access restricted: You do not have permission to view cluster infrastructure.");
          toastShownRef.current = true;
        }
      }
    }
  };

  const loadMetrics = useCallback(async (clusterId: string, quiet = false) => {
    if (!clusterId) return;
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const targetCl = clusters.find(c => c.cluster_id === clusterId);
      const shouldFetch = targetCl ? (targetCl.metrics_configured && targetCl.metrics_status === "connected") : false;

      const [nm, pm, am] = await Promise.all([
        shouldFetch ? api.get(`/api/infrastructure/${clusterId}/nodes`).catch(() => ({ data: { nodes: [] } })) : Promise.resolve({ data: { nodes: [] } }),
        shouldFetch ? api.get(`/api/infrastructure/${clusterId}/pods`).catch(() => ({ data: { pods: [] } })) : Promise.resolve({ data: { pods: [] } }),
        api.get(`/api/resource-alerts?cluster_id=${clusterId}`).catch(() => ({ data: { alerts: [] } })),
      ]);
      setNodes(nm.data?.nodes || []);
      setPods(pm.data?.pods || []);
      setAlerts(am.data?.alerts || []);
    } catch (e) { console.error(e); }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const me = getUser();
    if (!hasPermission(me, "viewClusters")) {
      setAuthorized(false);
      setLoading(false);
      if (!toastShownRef.current) {
        error("Access restricted: You do not have permission to view cluster infrastructure.");
        toastShownRef.current = true;
      }
      return;
    }
    loadClusters();
  }, []);
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (authorized && selectedCluster) {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        loadMetrics(selectedCluster, false);
      } else {
        loadMetrics(selectedCluster, true);
      }
    }
  }, [selectedCluster, loadMetrics, authorized]);

  const deleteAlert = async (id: string) => {
    const { confirmed } = await confirm({ title:"Delete alert?", message:"This resource alert will be removed.", confirmLabel:"Delete", variant:"danger" });
    if (!confirmed) return;
    try { await api.delete(`/api/resource-alerts/${id}`); success("Alert deleted"); loadMetrics(selectedCluster, true); }
    catch { error("Failed to delete"); }
  };

  const namespaces = ["all", ...Array.from(new Set(pods.map(p => p.namespace)))];
  const filteredPods = nsFilter === "all" ? pods : pods.filter(p => p.namespace === nsFilter);

  const avgCpu = nodes.length ? Math.round(nodes.reduce((a,n) => a + n.cpu_usage_pct, 0) / nodes.length) : 0;
  const avgMem = nodes.length ? Math.round(nodes.reduce((a,n) => a + n.memory_usage_pct, 0) / nodes.length) : 0;
  const criticalNodes = nodes.filter(n => n.cpu_usage_pct > 90 || n.memory_usage_pct > 90).length;

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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Infrastructure</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Node & pod CPU/memory usage with threshold alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="input py-2 text-sm w-48" value={selectedCluster} onChange={e => setSelected(e.target.value)}>
            {clusters.map(c => <option key={c.cluster_id} value={c.cluster_id}>{c.name}</option>)}
          </select>
          <button onClick={() => loadMetrics(selectedCluster, true)} disabled={refreshing} className="btn-secondary flex items-center gap-1.5 text-xs py-2.5 px-3.5">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button id="infra-set-alert-btn" onClick={() => setShowAddAlert(true)} className="btn-primary flex items-center gap-1.5 text-xs py-2.5 px-3.5"><Plus className="w-4 h-4" /> Set alert</button>
        </div>
      </div>

      {showAddAlert && <AddAlertModal clusters={clusters} onClose={() => setShowAddAlert(false)} onSaved={() => loadMetrics(selectedCluster, true)} />}

      {/* Cluster overview */}
      {nodes.length > 0 && (
        <div id="infra-metric-cards" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard label="Avg CPU" value={`${avgCpu}%`} icon={Cpu} color="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" sub={`${nodes.length} nodes`} />
          <MetricCard label="Avg Memory" value={`${avgMem}%`} icon={HardDrive} color="bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400" sub={`${nodes.length} nodes`} />
          <MetricCard label="Total Pods" value={String(pods.length)} icon={Activity} color="bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400" sub={`${pods.filter(p=>p.status==="Running").length} running`} />
          <MetricCard label="Critical" value={String(criticalNodes)} icon={AlertTriangle} color={criticalNodes > 0 ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" : "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500"} sub="nodes > 90%" />
        </div>
      )}

      {/* Nodes */}
      <div id="infra-nodes-list" className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-500" />
          <h2 className="font-bold text-gray-900 dark:text-white">Nodes</h2>
          <span className="text-xs text-gray-400 dark:text-slate-500">({nodes.length})</span>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(2)].map((_,i) => <div key={i} className="h-16 bg-gray-50 dark:bg-slate-800 rounded-xl animate-pulse" />)}
          </div>
        ) : nodes.length === 0 ? (
          <div className="py-12 text-center">
            <Server className="w-10 h-10 text-gray-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">No node metrics available</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Connect a cluster with Metrics Server enabled</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {nodes.map(node => (
              <div key={node.name}>
                <div className="px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors"
                  onClick={() => setExpandedNode(expandedNode === node.name ? null : node.name)}>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-48 shrink-0">
                      <div className={`w-2 h-2 rounded-full ${node.status === "Ready" ? "bg-green-500" : "bg-red-500"}`} />
                      <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{node.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${node.role === "master" ? "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400" : "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400"}`}>
                        {node.role}
                      </span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Cpu className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                          <span className="text-xs text-gray-500 dark:text-slate-400">CPU ({node.cpu_cores} cores)</span>
                        </div>
                        <UsageBar pct={node.cpu_usage_pct} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <HardDrive className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                          <span className="text-xs text-gray-500 dark:text-slate-400">Memory ({node.memory_gb}GB)</span>
                        </div>
                        <UsageBar pct={node.memory_usage_pct} />
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-slate-500 text-right shrink-0">
                      <div>{node.pods_running}/{node.pods_capacity} pods</div>
                      <div>{node.age}</div>
                    </div>
                    {expandedNode === node.name ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  </div>
                </div>
                {expandedNode === node.name && (
                  <div className="px-5 pb-4 bg-gray-50 dark:bg-slate-800/30">
                    <div className="text-xs text-gray-500 dark:text-slate-400 font-semibold mb-2 uppercase tracking-wide">Conditions</div>
                    <div className="flex flex-wrap gap-2">
                      {node.conditions.map(c => (
                        <span key={c.type} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${c.status === "True" ? "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400"}`}>
                          {c.type}: {c.status}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pods */}
      <div id="infra-pods-list" className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            <h2 className="font-bold text-gray-900 dark:text-white">Pods</h2>
            <span className="text-xs text-gray-400 dark:text-slate-500">({filteredPods.length})</span>
          </div>
          <select className="input py-1.5 text-xs w-40" value={nsFilter} onChange={e => setNsFilter(e.target.value)}>
            {namespaces.map(ns => <option key={ns} value={ns}>{ns === "all" ? "All namespaces" : ns}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="p-5 space-y-2">
            {[...Array(4)].map((_,i) => <div key={i} className="h-10 bg-gray-50 dark:bg-slate-800 rounded-lg animate-pulse" />)}
          </div>
        ) : filteredPods.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="w-10 h-10 text-gray-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400 dark:text-slate-500">No pod metrics available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Pod</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Namespace</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Node</th>
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">CPU</th>
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Memory</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Restarts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800/60">
                {filteredPods.map(pod => {
                  const cpuPct = pod.cpu_limit_m ? (pod.cpu_usage_m / pod.cpu_limit_m) * 100 : null;
                  const memPct = pod.memory_limit_mi ? (pod.memory_usage_mi / pod.memory_limit_mi) * 100 : null;
                  return (
                    <tr key={`${pod.namespace}/${pod.name}`} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pod.status === "Running" ? "bg-green-500" : pod.status === "Pending" ? "bg-amber-500" : "bg-red-500"}`} />
                          <span className="font-medium text-gray-900 dark:text-slate-100 text-xs font-mono truncate max-w-[180px]">{pod.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{pod.namespace}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[100px] block">{pod.node}</span>
                      </td>
                      <td className="px-3 py-3 w-32">
                        <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">{pod.cpu_usage_m}m{pod.cpu_limit_m ? ` / ${pod.cpu_limit_m}m` : ""}</div>
                        {cpuPct !== null && <UsageBar pct={cpuPct} />}
                      </td>
                      <td className="px-3 py-3 w-32">
                        <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">{pod.memory_usage_mi}Mi{pod.memory_limit_mi ? ` / ${pod.memory_limit_mi}Mi` : ""}</div>
                        {memPct !== null && <UsageBar pct={memPct} />}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`text-xs font-bold ${pod.restarts > 5 ? "text-red-600 dark:text-red-400" : pod.restarts > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                          {pod.restarts}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resource alerts */}
      {alerts.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            <h2 className="font-bold text-gray-900 dark:text-white">Resource alerts</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {alerts.map(a => (
              <div key={a.resource_alert_id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800 dark:text-slate-200 capitalize">
                    {a.resource_type.replace("_", " ")} &gt; {a.threshold_pct}% on {a.target}
                    {a.target_name && <span className="font-mono text-indigo-500 ml-1">({a.target_name})</span>}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-slate-500 capitalize">{a.severity} · {a.enabled ? "Active" : "Paused"}</div>
                </div>
                <button onClick={() => deleteAlert(a.resource_alert_id)} className="text-xs text-red-500 hover:text-red-700 transition-colors">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}