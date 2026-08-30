"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle, RefreshCw, Server,
  Plus, ArrowRight, Activity, Cpu,
  Network, ChevronRight, AlertCircle, Clock,
  Bell, X
} from "lucide-react";
import { fetchIncidentStats, fetchIncidents, fetchClusters, apiGetMe } from "@/lib/api";
import { getUser, hasPermission } from "@/lib/auth";
import type { IncidentStats, Incident, Cluster } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import IncidentRow from "@/components/dashboard/IncidentRow";
import NodeRow from "@/components/dashboard/NodeRow";
import ClusterDrawer from "@/components/dashboard/ClusterDrawer";
import { useToast } from "@/components/Toast";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { success } = useToast();
  const [stats,         setStats]         = useState<IncidentStats | null>(null);
  const [clusters,      setClusters]      = useState<Cluster[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [activeCluster, setActiveCluster] = useState<Cluster | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [updated,       setUpdated]       = useState(new Date());
  const [mounted,       setMounted]       = useState(false);
  const [fullName,      setFullName]      = useState<string>("");
  const [orgName,       setOrgName]       = useState<string>("");
  const [showOrgOnDashboard, setShowOrgOnDashboard] = useState<boolean>(true);
  const [dismissedErrorBanner, setDismissedErrorBanner] = useState(false);

  const me = getUser();
  const canViewClusters  = hasPermission(me, "viewClusters");
  const canAddCluster    = hasPermission(me, "addCluster");
  const canViewIncidents = hasPermission(me, "viewIncidents");
  const canAddRule       = hasPermission(me, "addRule");
  const canAddChannel    = hasPermission(me, "addChannel");

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sv_show_org_dashboard");
    if (saved !== null) {
      setShowOrgOnDashboard(saved === "true");
    }

    if (typeof window !== "undefined") {
      const isDismissed = sessionStorage.getItem("sv_dismiss_error_clusters") === "true";
      setDismissedErrorBanner(isDismissed);
    }

    // Audit page view
    const me = getUser();
    if (me) {
      fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: me.org_id || "default",
          user_id: me.user_id,
          action: "view_dashboard",
          resource: "dashboard_page",
          resource_id: "overview",
          metadata: { path: window.location.pathname }
        })
      }).catch(() => {});
    }
  }, []);

  const load = useCallback(async (quiet = false, showToast = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const [s, c, r, me] = await Promise.all([
        fetchIncidentStats().catch(() => null),
        fetchClusters().catch(() => ({ clusters: [] })),
        fetchIncidents({ limit: "5" }).catch(() => ({ incidents: [] })),
        apiGetMe().catch(() => null),
      ]);
      setStats(s);
      setClusters(c.clusters || []);
      setRecentIncidents(r.incidents || []);
      if (me) {
        setFullName(me.full_name || "");
        if (me.org) {
          setOrgName(me.org.name || "");
        }
      }
      setUpdated(new Date());
      if (showToast) {
        success("Dashboard refreshed", "Your overview widgets were updated successfully.");
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [success]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      load(true);
    }, 60000);
    return () => clearInterval(t);
  }, [load]);

  const onlineClusters = clusters.filter(c => c.status === "connected").length;
  const errorClusters  = clusters.filter(c => c.status === "error").length;
  const healthPct      = clusters.length ? Math.round((onlineClusters / clusters.length) * 100) : null;

  // ── Loading skeleton ──
  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 bg-gray-100 dark:bg-slate-800 rounded-xl w-36" />
        <div className="h-9 w-24 bg-gray-100 dark:bg-slate-800 rounded-xl" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 dark:bg-slate-800 rounded-2xl" />)}
      </div>
      <div className="h-48 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-64 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
        <div className="h-48 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 p-5 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              Dashboard
            </h1>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 flex items-center flex-wrap gap-1.5">
              <span>{fullName ? `Welcome back, ${fullName}` : "Overview of cluster health"}</span>
              {showOrgOnDashboard && orgName && (
                <>
                  <span className="text-gray-300 dark:text-slate-700 select-none">•</span>
                  <span className="badge bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md select-none">
                    {orgName}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
              Updated {timeAgo(updated.toISOString())}
            </span>
            <button
              onClick={() => load(true, true)}
              disabled={refreshing}
              className="btn-secondary gap-2 text-xs py-2 px-3 hover:scale-[1.01] transition-transform"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Error banner ── */}
        {errorClusters > 0 && !dismissedErrorBanner && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/15 rounded-xl px-4 py-3 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-750 dark:text-red-400 mr-auto">
              <span className="font-semibold">{errorClusters} cluster{errorClusters > 1 ? "s" : ""}</span> reporting connection errors.
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/dashboard/clusters" className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline">
                Fix →
              </Link>
              <div className="w-[1px] h-3 bg-red-200 dark:bg-red-500/20" />
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem("sv_dismiss_error_clusters", "true");
                  setDismissedErrorBanner(true);
                }}
                className="text-red-400 hover:text-red-655 dark:text-red-450 dark:hover:text-red-300 transition-colors p-0.5"
                title="Dismiss warning"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── 3 summary stat cards ── */}
        <div className="grid grid-cols-3 gap-3">

          {/* Open incidents */}
          <div className="rounded-2xl border bg-white dark:bg-[#13151f] border-gray-100 dark:border-slate-800/80 p-5">
            <div className="flex items-center justify-between mb-3">
              <AlertTriangle className={`w-4 h-4 ${(stats?.open_count ?? 0) > 0 ? "text-red-500" : "text-gray-300 dark:text-slate-600"}`} />
              {(stats?.critical_open ?? 0) > 0 && (
                <span className="text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-500/15 px-1.5 py-0.5 rounded-full">
                  {stats?.critical_open} critical
                </span>
              )}
            </div>
            <div className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
              {stats?.open_count ?? 0}
            </div>
            <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">Open incidents</div>
          </div>

          {/* Clusters online */}
          <div className="rounded-2xl border bg-white dark:bg-[#13151f] border-gray-100 dark:border-slate-800/80 p-5">
            <div className="flex items-center justify-between mb-3">
              <Server className="w-4 h-4 text-indigo-500" />
              {healthPct !== null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  healthPct === 100 ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/15"
                  : healthPct >= 50  ? "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15"
                  : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/15"
                }`}>
                  {healthPct}%
                </span>
              )}
            </div>
            <div className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
              {onlineClusters}<span className="text-lg font-normal text-gray-300 dark:text-slate-600">/{clusters.length}</span>
            </div>
            <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">Clusters online</div>
            {clusters.length > 0 && (
              <div className="mt-3 w-full h-1 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    healthPct === 100 ? "bg-green-500"
                    : healthPct && healthPct >= 50 ? "bg-amber-500"
                    : "bg-red-500"
                  }`}
                  style={{ width: `${healthPct ?? 0}%` }}
                />
              </div>
            )}
          </div>

          {/* Resolved */}
          <div className="rounded-2xl border bg-white dark:bg-[#13151f] border-gray-100 dark:border-slate-800/80 p-5">
            <div className="mb-3">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
              {stats?.resolved_count ?? 0}
            </div>
            <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">Resolved all time</div>
            {(stats?.last_24h ?? 0) > 0 && (
              <div className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
                {stats?.last_24h} crash{(stats?.last_24h ?? 0) !== 1 ? "es" : ""} today
              </div>
            )}
          </div>
        </div>

        {/* ── Clusters ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-indigo-500" />
              Clusters
              {clusters.length > 0 && (
                <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-slate-800 dark:text-slate-500 px-1.5 py-0.5 rounded-full">{clusters.length}</span>
              )}
            </span>
            {canViewClusters && (
              <Link href="/dashboard/clusters" className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1 font-medium">
                Manage <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {clusters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700/80 py-10 text-center">
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                {canViewClusters ? "No clusters yet" : "Cluster monitoring restricted"}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
                {canViewClusters ? "Connect your first Kubernetes cluster to start monitoring" : "You do not have permission (`viewClusters`) to view cluster infrastructure."}
              </p>
              {canAddCluster && (
                <Link href="/dashboard/clusters" className="btn-primary text-xs px-4 py-2 inline-flex">
                  <Plus className="w-3.5 h-3.5" /> Add cluster
                </Link>
              )}
            </div>
          ) : (
            <div id="clusters-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {clusters.map(cl => {
                const isConnected = cl.status === "connected";
                const isError     = cl.status === "error";
                const isActive    = activeCluster?.cluster_id === cl.cluster_id;
                return (
                  <button
                    key={cl.cluster_id}
                    onClick={() => setActiveCluster(isActive ? null : cl)}
                    className={`group text-left w-full rounded-2xl border p-4 transition-colors duration-150 relative overflow-hidden
                      ${isActive
                        ? "border-indigo-400 dark:border-indigo-500/70 bg-indigo-50/50 dark:bg-indigo-500/[0.07] shadow-sm"
                        : isError
                          ? "border-red-100 dark:border-red-500/20 bg-white dark:bg-[#13151f] hover:shadow-sm"
                          : "border-gray-100 dark:border-slate-800/80 bg-white dark:bg-[#13151f] hover:shadow-sm"
                      }`}
                  >
                    {/* Active top accent bar */}
                    {isActive && (
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-t-2xl" />
                    )}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isConnected ? "bg-green-500" : isError ? "bg-red-500" : "bg-amber-500"}`} />
                        <span className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">{cl.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {cl.open_incidents_count !== undefined && cl.open_incidents_count > 0 && (
                          <span className="text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-500/15 px-1.5 py-0.5 rounded-full">
                            {cl.open_incidents_count} open
                          </span>
                        )}
                        <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isActive ? "text-indigo-500 rotate-90" : "text-gray-300 dark:text-slate-600"}`} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400 dark:text-slate-500 capitalize">
                        {cl.connection_type?.replace("_", " ") ?? "Self Hosted"}
                        {cl.cloud_provider ? ` · ${cl.cloud_provider}` : ""}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          isConnected || isError
                            ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-150 dark:border-green-500/25"
                            : "bg-gray-50 dark:bg-slate-800 text-gray-400 border border-gray-150 dark:border-slate-700"
                        }`}>
                          agent
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          cl.metrics_configured
                            ? cl.error_message
                              ? "bg-red-50 dark:bg-red-500/10 text-red-500 border border-red-150 dark:border-red-500/25"
                              : "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-150 dark:border-green-500/25"
                            : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 border border-amber-150 dark:border-amber-500/25"
                        }`}>
                          {cl.metrics_configured ? cl.error_message ? "metrics error" : "metrics" : "no metrics"}
                        </span>
                      </div>
                    </div>
                    {cl.metrics_configured && cl.metrics_status === "connected" && ((cl.worker_nodes_total ?? 0) + (cl.master_nodes_total ?? 0) > 0) && (
                      <div className="mt-2.5 pt-2.5 border-t border-gray-50 dark:border-slate-800/60 flex gap-3 text-[11px] text-gray-400 dark:text-slate-500">
                        <span className="flex items-center gap-1" title="Master nodes ready/total">
                          <Cpu className={`w-3 h-3 ${cl.master_nodes_ready !== undefined && cl.master_nodes_total !== undefined && cl.master_nodes_ready < cl.master_nodes_total ? "text-red-500 animate-pulse" : ""}`} />
                          <span className={cl.master_nodes_ready !== undefined && cl.master_nodes_total !== undefined && cl.master_nodes_ready < cl.master_nodes_total ? "text-red-500 font-bold" : ""}>
                            {cl.master_nodes_ready}/{cl.master_nodes_total}
                          </span>
                        </span>
                        <span className="flex items-center gap-1" title="Worker nodes ready/total">
                          <Network className={`w-3 h-3 ${cl.worker_nodes_ready !== undefined && cl.worker_nodes_total !== undefined && cl.worker_nodes_ready < cl.worker_nodes_total ? "text-red-500 animate-pulse" : ""}`} />
                          <span className={cl.worker_nodes_ready !== undefined && cl.worker_nodes_total !== undefined && cl.worker_nodes_ready < cl.worker_nodes_total ? "text-red-500 font-bold" : ""}>
                            {cl.worker_nodes_ready}/{cl.worker_nodes_total}
                          </span>
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
              {canAddCluster && (
                <Link
                  href="/dashboard/clusters"
                  className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700/80 flex flex-col items-center justify-center gap-2 min-h-[100px] hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 transition-colors">
                    <Plus className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <span className="text-xs text-gray-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors font-medium">Add cluster</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom: Trends Chart + Quick actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Recent Incidents */}
          <div id="recent-incidents" className="lg:col-span-2 bg-white dark:bg-[#13151f] border border-gray-100 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-sm text-gray-900 dark:text-white">Recent Incidents</span>
              </div>
              {canViewIncidents && (
                <Link href="/dashboard/incidents" className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1 font-medium">
                  All Incidents <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            <div className={`flex-1 min-h-[200px] w-full flex flex-col ${recentIncidents.length === 0 ? "justify-center" : "justify-start"}`}>
              {!mounted ? (
                <div className="h-[200px] w-full bg-gray-50 dark:bg-slate-800/40 rounded-xl animate-pulse" />
              ) : recentIncidents.length === 0 ? (
                <div className="text-center py-10 px-6">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold text-sm text-gray-700 dark:text-slate-300">All stable</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">No pod crashes observed</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
                  {recentIncidents.slice(0, 4).map(inc => (
                    <IncidentRow key={inc.incident_id} inc={inc} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white dark:bg-[#13151f] border border-gray-100 dark:border-slate-800/80 rounded-2xl p-5 self-start">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Quick actions</h3>
            <div className="space-y-1">
              {[
                ...(canAddCluster ? [{ label: "Add cluster",    href: "/dashboard/clusters", icon: Server,        desc: "Connect Kubernetes"   }] : []),
                ...(canAddRule ? [{ label: "New alert rule", href: "/dashboard/rules",    icon: Bell,          desc: "Set up notifications" }] : []),
                ...(canAddChannel ? [{ label: "Add channel",    href: "/settings/channels", icon: Clock,         desc: "Slack, PagerDuty..."  }] : []),
              ].map(({ label, href, icon: Icon, desc }) => (
                <Link
                  key={href} href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg bg-gray-50 dark:bg-slate-800/80 flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 transition-colors">
                    <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 dark:text-slate-300">{label}</div>
                    <div className="text-[11px] text-gray-400 dark:text-slate-500">{desc}</div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-gray-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cluster drawer overlay ── */}
      {activeCluster && (
        <ClusterDrawer cluster={activeCluster} onClose={() => setActiveCluster(null)} onRefresh={() => load(true)} />
      )}
    </>
  );
}
