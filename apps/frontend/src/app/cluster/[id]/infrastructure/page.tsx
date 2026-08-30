"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Server, Cpu, HardDrive, Activity, AlertTriangle, 
  RefreshCw, Plus, Zap, ChevronDown, ChevronUp, 
  ArrowLeft, Layers, ShieldAlert, Globe, ExternalLink, Loader2, ShieldCheck
} from "lucide-react";
import { api, fetchCluster } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { getUser, hasPermission } from "@/lib/auth";
import { timeAgo, type Cluster } from "@/lib/utils";

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

function UsageBar({ pct, warn = 70, crit = 90 }: { pct: number; warn?: number; crit?: number }) {
  const color = pct >= crit ? "bg-red-500" : pct >= warn ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-[10px] font-mono font-bold w-8 text-right shrink-0 ${pct >= crit ? "text-red-600 dark:text-red-400" : pct >= warn ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, sub }: { label: string; value: string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
          <div className="text-xs text-gray-500 dark:text-slate-405 font-medium">{label}</div>
          {sub && <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function ClusterInfrastructurePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [nodes, setNodes] = useState<NodeMetric[]>([]);
  const [pods, setPods] = useState<PodMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [nsFilter, setNsFilter] = useState("all");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Pods table states
  const [podSearch, setPodSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<"name" | "cpu" | "memory" | "restarts">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { success, error } = useToast();

  const handleSort = (field: "name" | "cpu" | "memory" | "restarts") => {
    if (sortField === field) {
      setSortOrder(o => o === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
    setPage(1);
  };

  const SortArrow = ({ field }: { field: "name" | "cpu" | "memory" | "restarts" }) => {
    if (sortField !== field) return <span className="ml-1 text-gray-300 dark:text-slate-700">↕</span>;
    return sortOrder === "asc" ? <span className="ml-1 text-indigo-500">▲</span> : <span className="ml-1 text-indigo-500">▼</span>;
  };

  const loadMetrics = useCallback(async (quiet = false) => {
    if (!id) return;
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const clusterRes = await fetchCluster(id).catch(() => null);
      if (clusterRes) {
        setCluster(clusterRes);
      }

      const shouldFetchMetrics = clusterRes?.metrics_configured && clusterRes?.metrics_status === "connected";

      const [nm, pm] = await Promise.all([
        shouldFetchMetrics ? api.get(`/api/infrastructure/${id}/nodes`).catch(() => ({ data: { nodes: [] } })) : Promise.resolve({ data: { nodes: [] } }),
        shouldFetchMetrics ? api.get(`/api/infrastructure/${id}/pods`).catch(() => ({ data: { pods: [] } })) : Promise.resolve({ data: { pods: [] } }),
      ]);

      setNodes(nm.data?.nodes || []);
      setPods(pm.data?.pods || []);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    const me = getUser();
    if (!hasPermission(me, "viewClusters")) {
      setAuthorized(false);
      setLoading(false);
      error("Access restricted: You do not have permission to view cluster infrastructure.");
      return;
    }
    loadMetrics();
  }, [loadMetrics]);

  // Pods computation lists
  const namespaces = ["all", ...Array.from(new Set(pods.map(p => p.namespace)))];
  let processedPods = nsFilter === "all" ? pods : pods.filter(p => p.namespace === nsFilter);

  if (podSearch.trim()) {
    const q = podSearch.toLowerCase().trim();
    processedPods = processedPods.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.namespace.toLowerCase().includes(q) || 
      p.node.toLowerCase().includes(q)
    );
  }

  processedPods.sort((a, b) => {
    let valA: any = a.name.toLowerCase();
    let valB: any = b.name.toLowerCase();

    if (sortField === "cpu") {
      valA = a.cpu_usage_m;
      valB = b.cpu_usage_m;
    } else if (sortField === "memory") {
      valA = a.memory_usage_mi;
      valB = b.memory_usage_mi;
    } else if (sortField === "restarts") {
      valA = a.restarts;
      valB = b.restarts;
    }

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const itemsPerPage = 15;
  const totalPages = Math.max(1, Math.ceil(processedPods.length / itemsPerPage));
  const startIndex = (page - 1) * itemsPerPage;
  const paginatedPods = processedPods.slice(startIndex, startIndex + itemsPerPage);

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

  if (loading && !cluster) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header and Back Link */}
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => router.push(`/cluster/${id}`)}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 font-semibold transition-colors w-fit select-none bg-transparent border-none outline-none cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Cluster Summary
        </button>

        <div className="flex items-center justify-between flex-wrap gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>{cluster?.name || "Cluster Details"}</span>
              <span className="text-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-750 dark:text-indigo-400 px-2 py-0.5 rounded-md uppercase font-mono">
                {cluster?.k8s_version || "Live Metrics"}
              </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-405 mt-0.5">Live CPU cores, memory thresholds, node constraints, and workload details.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
              Updated {timeAgo(lastUpdated.toISOString())}
            </span>
            <button 
              onClick={() => loadMetrics(true)} 
              disabled={refreshing} 
              className="btn-secondary gap-2 text-xs py-2 px-3 hover:scale-[1.01] transition-transform font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Cluster overview */}
      {nodes.length > 0 && (
        <div id="infra-metric-cards" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard label="Avg CPU" value={`${avgCpu}%`} icon={Cpu} color="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" sub={`${nodes.length} nodes`} />
          <MetricCard label="Avg Memory" value={`${avgMem}%`} icon={HardDrive} color="bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400" sub={`${nodes.length} nodes`} />
          <MetricCard label="Total Pods" value={String(pods.length)} icon={Activity} color="bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400" sub={`${pods.filter(p=>p.status==="Running").length} running`} />
          <MetricCard label="Critical" value={String(criticalNodes)} icon={AlertTriangle} color={criticalNodes > 0 ? "bg-red-50 dark:bg-red-500/10 text-red-655 dark:text-red-400" : "bg-gray-50 dark:bg-slate-805 text-gray-400 dark:text-slate-500"} sub="nodes > 90%" />
        </div>
      )}

      {/* Pods */}
      <div id="infra-pods-list" className="card overflow-hidden bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            <h2 className="font-bold text-gray-900 dark:text-white">Pods</h2>
            <span className="text-xs text-gray-450 dark:text-slate-500">({processedPods.length})</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="infra-pods-search"
              type="text"
              placeholder="Search pods..."
              value={podSearch}
              onChange={e => {
                setPodSearch(e.target.value);
                setPage(1);
              }}
              className="input py-1.5 px-3 text-xs w-48 bg-transparent"
            />
            <select className="input py-1.5 text-xs w-40" value={nsFilter} onChange={e => { setNsFilter(e.target.value); setPage(1); }}>
              {namespaces.map(ns => <option key={ns} value={ns}>{ns === "all" ? "All namespaces" : ns}</option>)}
            </select>
          </div>
        </div>
        {loading ? (
          <div className="p-5 space-y-2">
            {[...Array(4)].map((_,i) => <div key={i} className="h-10 bg-gray-55 dark:bg-slate-800/40 rounded-lg animate-pulse" />)}
          </div>
        ) : paginatedPods.length === 0 ? (
          <div className="py-12 text-center bg-white dark:bg-[#13151f]">
            <Activity className="w-10 h-10 text-gray-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No pod metrics found</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#13151f]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-550 dark:text-slate-455 select-none">
                    <th onClick={() => handleSort("name")} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors">
                      <div className="flex items-center">Pod <SortArrow field="name" /></div>
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-bold uppercase tracking-wide">Namespace</th>
                    <th className="text-left px-3 py-3 text-xs font-bold uppercase tracking-wide">Node</th>
                    <th onClick={() => handleSort("cpu")} className="text-left px-3 py-3 text-xs font-bold uppercase tracking-wide cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors w-48">
                      <div className="flex items-center">CPU <SortArrow field="cpu" /></div>
                    </th>
                    <th onClick={() => handleSort("memory")} className="text-left px-3 py-3 text-xs font-bold uppercase tracking-wide cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors w-56">
                      <div className="flex items-center">Memory <SortArrow field="memory" /></div>
                    </th>
                    <th onClick={() => handleSort("restarts")} className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wide cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors">
                      <div className="flex items-center justify-end">Restarts <SortArrow field="restarts" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800/60">
                  {paginatedPods.map(pod => {
                    const cpuPct = pod.cpu_limit_m ? (pod.cpu_usage_m / pod.cpu_limit_m) * 100 : null;
                    const memPct = pod.memory_limit_mi ? (pod.memory_usage_mi / pod.memory_limit_mi) * 100 : null;
                    return (
                      <tr key={`${pod.namespace}/${pod.name}`} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pod.status === "Running" ? "bg-green-500" : pod.status === "Pending" ? "bg-amber-500" : "bg-red-500"}`} />
                            <span className="font-semibold text-gray-950 dark:text-slate-100 text-xs font-mono truncate max-w-[280px]" title={pod.name}>{pod.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs text-indigo-650 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-md">{pod.namespace}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[120px] block font-semibold">{pod.node}</span>
                        </td>
                        <td className="px-3 py-3 w-48">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs text-gray-750 dark:text-slate-300 font-semibold font-mono w-16 text-right shrink-0">
                              {pod.cpu_usage_m}m
                            </span>
                            {pod.cpu_limit_m ? (
                              <div className="flex-1">
                                <UsageBar pct={cpuPct ?? 0} />
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold italic">no limit</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 w-56">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs text-gray-755 dark:text-slate-300 font-semibold font-mono w-20 text-right shrink-0">
                              {pod.memory_usage_mi}Mi
                            </span>
                            {pod.memory_limit_mi ? (
                              <div className="flex-1">
                                <UsageBar pct={memPct ?? 0} />
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold italic">no limit</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-xs font-bold ${pod.restarts > 5 ? "text-red-655 dark:text-red-400" : pod.restarts > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                            {pod.restarts}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/20 dark:bg-slate-900/10">
                <span className="text-xs text-gray-500 dark:text-slate-405">
                  Showing <span className="font-semibold text-gray-900 dark:text-white">{startIndex + 1}</span> to{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {Math.min(startIndex + itemsPerPage, processedPods.length)}
                  </span>{" "}
                  of <span className="font-semibold text-gray-900 dark:text-white">{processedPods.length}</span> pods
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary py-1.5 px-3 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-semibold text-gray-600 dark:text-slate-350 px-2 select-none">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-secondary py-1.5 px-3 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
