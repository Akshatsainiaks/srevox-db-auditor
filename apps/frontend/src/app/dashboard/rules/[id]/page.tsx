"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  BookOpen, 
  Bell, 
  BellOff, 
  Pencil, 
  Trash2, 
  ShieldCheck, 
  Server, 
  Zap, 
  RefreshCw, 
  Layers, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Activity, 
  Send, 
  Loader2,
  Check,
  AlertCircle
} from "lucide-react";
import { 
  fetchRule, 
  fetchClusters, 
  fetchChannels, 
  fetchIncidents, 
  deleteRule, 
  toggleRule, 
  updateRule, 
  muteRule, 
  unmuteRule,
  api 
} from "@/lib/api";
import type { AlertRule, Cluster, Channel, Incident } from "@/lib/utils";
import { severityBadge, timeAgo } from "@/lib/utils";
import { getUser, hasPermission } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import EditModal from "@/components/rules/EditModal";

const parseArr = (v: unknown): string[] => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
};

export default function RuleDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const ruleId = params?.id as string;

  const [rule, setRule] = useState<any | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);
  const [authorized, setAuthorized] = useState(true);

  const me = getUser();
  const { confirm } = useConfirm();
  const { success, error } = useToast();
  const toastShownRef = useRef(false);

  const loadData = async (quiet = false) => {
    if (!ruleId) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const [rData, cData, chData, incData] = await Promise.all([
        fetchRule(ruleId),
        fetchClusters(),
        fetchChannels(),
        fetchIncidents()
      ]);

      setRule(rData);
      setClusters(cData.clusters || []);
      setChannels(chData.channels || []);

      // Filter incidents related to this rule's cluster or matching namespaces
      const allInc: Incident[] = incData.incidents || [];
      const ruleClusterId = rData.cluster_id;
      const ruleNs = parseArr(rData.namespaces);

      const filteredInc = allInc.filter((inc) => {
        if (ruleClusterId && inc.cluster_id !== ruleClusterId) return false;
        if (ruleNs.length > 0 && inc.namespace && !ruleNs.includes(inc.namespace.toLowerCase())) {
          return false;
        }
        return true;
      });

      setIncidents(filteredInc);
      setAuthorized(true);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 403) {
        setAuthorized(false);
        if (!toastShownRef.current) {
          error("Access restricted: You do not have permission to view this alert rule.");
          toastShownRef.current = true;
        }
      } else if (err.response?.status === 404) {
        error("Alert rule not found.");
        router.push("/dashboard/rules");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!hasPermission(me, "viewRules")) {
      setAuthorized(false);
      setLoading(false);
      return;
    }
    loadData();
  }, [ruleId]);

  const handleToggle = async () => {
    if (!rule) return;
    try {
      await toggleRule(rule.rule_id);
      success(`Rule ${rule.enabled ? "paused" : "enabled"} successfully`);
      loadData(true);
    } catch {
      error("Failed to update rule status");
    }
  };

  const handleToggleOnlyIncrease = async () => {
    if (!rule) return;
    try {
      const newVal = rule.only_increase_restarts === false;
      await updateRule(rule.rule_id, { only_increase_restarts: newVal });
      success(`Alert mode updated to: ${newVal ? "New restarts only" : "Repeat alerts"}`);
      loadData(true);
    } catch {
      error("Failed to update alert mode");
    }
  };

  const handleMute = async (mins: number) => {
    if (!rule) return;
    try {
      await muteRule(rule.rule_id, mins);
      success(`Rule muted for ${mins} minutes`);
      loadData(true);
    } catch {
      error("Failed to mute rule");
    }
  };

  const handleUnmute = async () => {
    if (!rule) return;
    try {
      await unmuteRule(rule.rule_id);
      success("Rule unmuted successfully");
      loadData(true);
    } catch {
      error("Failed to unmute rule");
    }
  };

  const handleDelete = async () => {
    if (!rule) return;
    const { confirmed } = await confirm({
      title: "Delete alert rule?",
      message: `Are you sure you want to delete '${rule.name}'? This action cannot be undone.`,
      confirmLabel: "Delete Rule",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await deleteRule(rule.rule_id);
      success("Alert rule deleted");
      router.push("/dashboard/rules");
    } catch {
      error("Failed to delete rule");
    }
  };

  const handleTestAlert = async () => {
    if (!rule) return;
    setTestingNotif(true);
    try {
      const targetChans = parseArr(rule.channel_ids);
      if (targetChans.length === 0) {
        error("No notification channels configured for this rule.");
        return;
      }

      await api.post("/api/resource-alerts/test", {
        cluster_id: rule.cluster_id || "all",
        resource_type: "pod_restarts",
        threshold_pct: rule.min_restarts || 1,
        channel_ids: targetChans,
      });

      success("Test notification dispatched to configured channels!");
    } catch (err: any) {
      error(err.response?.data?.detail || "Failed to send test notification");
    } finally {
      setTestingNotif(false);
    }
  };

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`viewRules`) to view alert rule details.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-slate-800 rounded-lg" />
        <div className="card p-6 h-48 bg-gray-100 dark:bg-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6 h-36 bg-gray-100 dark:bg-slate-800" />
          <div className="card p-6 h-36 bg-gray-100 dark:bg-slate-800" />
          <div className="card p-6 h-36 bg-gray-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  if (!rule) return null;

  const namespaces = parseArr(rule.namespaces);
  const crashReasons = parseArr(rule.crash_reasons);
  const channelIds = parseArr(rule.channel_ids);

  const linkedChannels = channels.filter((ch) => channelIds.includes(ch.channel_id));
  const clusterObj = clusters.find((c) => c.cluster_id === rule.cluster_id);
  const clusterDisplayName = rule.cluster_name || clusterObj?.name || (rule.cluster_id ? rule.cluster_id.slice(0, 8) : "All Clusters");

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link 
            href="/dashboard/rules"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Alert Rules
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
              <BookOpen className="w-6 h-6 text-indigo-500" />
              {rule.name}
            </h1>
            <span className={`badge text-xs font-semibold px-2.5 py-1 ${severityBadge(rule.severity)}`}>
              {rule.severity}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              rule.enabled 
                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" 
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${rule.enabled ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
              {rule.enabled ? "Active" : "Paused"}
            </span>

            {rule.muted_ttl && rule.muted_ttl > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                <BellOff className="w-3 h-3 text-amber-500" />
                Muted ({Math.ceil(rule.muted_ttl / 60)}m left)
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>

          {hasPermission(me, "addRule") && (
            <button
              onClick={handleTestAlert}
              disabled={testingNotif}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-800 hover:text-indigo-600"
            >
              {testingNotif ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-indigo-500" />}
              Test Alert
            </button>
          )}

          {hasPermission(me, "toggleRule") && (
            <>
              {rule.muted_ttl && rule.muted_ttl > 0 ? (
                <button
                  onClick={handleUnmute}
                  className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
                >
                  <BellOff className="w-3.5 h-3.5 text-amber-500" /> Unmute Rule
                </button>
              ) : (
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handleMute(Number(e.target.value));
                    }}
                    className="block pl-3 pr-7 py-2 text-xs font-semibold rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700/60 cursor-pointer appearance-none shadow-sm"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundPosition: 'right 0.4rem center',
                      backgroundSize: '1.2em 1.2em',
                      backgroundRepeat: 'no-repeat',
                    }}
                  >
                    <option value="" disabled hidden>Mute...</option>
                    <option value="5">Mute 5m</option>
                    <option value="15">Mute 15m</option>
                    <option value="30">Mute 30m</option>
                    <option value="60">Mute 1h</option>
                    <option value="1440">Mute 24h</option>
                  </select>
                </div>
              )}

              <button
                onClick={handleToggle}
                className={`btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-800`}
              >
                <Bell className="w-3.5 h-3.5 text-indigo-500" />
                {rule.enabled ? "Pause Rule" : "Enable Rule"}
              </button>
            </>
          )}

          {hasPermission(me, "addRule") && (
            <button
              onClick={() => setEditing(true)}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-800 hover:text-indigo-600"
            >
              <Pencil className="w-3.5 h-3.5 text-indigo-500" /> Edit
            </button>
          )}

          {hasPermission(me, "deleteRule") && (
            <button
              onClick={handleDelete}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2-Cols: Rule Specifications & Trigger Parameters */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Rule Details & Metadata */}
          <div className="card p-6 space-y-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 shadow-sm rounded-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800/80 pb-4">
              <h2 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" /> Rule Overview
              </h2>
              <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">ID: {rule.rule_id}</span>
            </div>

            {rule.description && (
              <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed bg-gray-55 dark:bg-slate-900/60 p-3.5 rounded-xl border border-gray-100 dark:border-slate-800/60">
                {rule.description}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl bg-gray-55 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-indigo-500" /> Target Cluster
                </span>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {clusterDisplayName}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-55 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" /> Target Namespaces
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {namespaces.length > 0 ? (
                    namespaces.map((ns) => (
                      <span key={ns} className="badge bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20 text-xs font-medium">
                        {ns}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">All Namespaces</span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gray-55 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-500" /> Minimum Restarts Threshold
                </span>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  ≥ {rule.min_restarts || 1} restarts
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-55 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" /> Cooldown Period
                </span>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {rule.cooldown_minutes} minutes
                </p>
              </div>
            </div>

            {/* Alert Mode Banner */}
            <div className="pt-2">
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                rule.only_increase_restarts !== false
                  ? "bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                  : "bg-amber-50/60 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
              }`}>
                <div className="flex items-center gap-3">
                  {rule.only_increase_restarts !== false ? (
                    <Zap className="w-5 h-5 text-emerald-500 shrink-0 animate-pulse" />
                  ) : (
                    <RefreshCw className="w-5 h-5 text-amber-500 shrink-0" />
                  )}
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      Alert Behavior: {rule.only_increase_restarts !== false ? "New Restarts Only" : "Repeat Alerts on Every Check"}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                      {rule.only_increase_restarts !== false 
                        ? "Only dispatches notifications when pod restart count increases." 
                        : "Repeats alerts on every periodic check if restarts exceed threshold."}
                    </p>
                  </div>
                </div>

                {hasPermission(me, "toggleRule") && (
                  <button
                    onClick={handleToggleOnlyIncrease}
                    className="btn-secondary text-[11px] font-bold py-1.5 px-3 rounded-lg border bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 shrink-0"
                  >
                    Switch to {rule.only_increase_restarts !== false ? "Repeat Alerts" : "New Restarts Only"}
                  </button>
                )}
              </div>
            </div>

            {/* Crash Reasons Filter Tags */}
            <div className="pt-2">
              <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-2">
                Crash Reason Filters
              </label>
              {crashReasons.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {crashReasons.map((reason) => (
                    <span key={reason} className="badge bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20 text-xs font-semibold px-2.5 py-1">
                      {reason}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-slate-400 italic">No specific crash reason filter set (Alerts on all container crash types).</p>
              )}
            </div>
          </div>
        </div>

        {/* Right 1-Col: Dispatch Channels & Metadata Sidebar */}
        <div className="space-y-6">

          {/* Connected Notification Channels */}
          <div className="card p-6 space-y-4 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 shadow-sm rounded-2xl">
            <h2 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2 border-b border-gray-100 dark:border-slate-800/80 pb-3">
              <Bell className="w-4 h-4 text-indigo-500" /> Alert Dispatch Channels ({linkedChannels.length})
            </h2>

            {linkedChannels.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-center">
                <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">No channels linked</p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">Edit rule to attach Teams, Slack, or Email channels.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedChannels.map((ch) => (
                  <div 
                    key={ch.channel_id}
                    className="p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 bg-gray-55 dark:bg-slate-900/40 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{ch.name}</p>
                      <span className="text-[10px] font-semibold uppercase text-indigo-500 tracking-wider">{ch.type}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      ch.enabled !== false 
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                        : "bg-gray-100 dark:bg-slate-800 text-gray-400"
                    }`}>
                      {ch.enabled !== false ? <Check className="w-3 h-3 text-emerald-500" /> : null}
                      {ch.enabled !== false ? "Active" : "Disabled"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Metadata Card */}
          <div className="card p-6 space-y-3.5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 shadow-sm rounded-2xl text-xs text-gray-600 dark:text-slate-400">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-800/80 pb-2">
              Rule Metadata
            </h3>

            <div className="flex justify-between items-center py-1">
              <span>Created:</span>
              <span className="font-semibold text-gray-900 dark:text-slate-200">{timeAgo(rule.created_at)}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span>Last Modified:</span>
              <span className="font-semibold text-gray-900 dark:text-slate-200">{rule.updated_at ? timeAgo(rule.updated_at) : timeAgo(rule.created_at)}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span>Severity Level:</span>
              <span className={`badge text-[11px] ${severityBadge(rule.severity)}`}>{rule.severity}</span>
            </div>
          </div>

        </div>

      </div>

      {/* Edit Rule Modal */}
      {editing && (
        <EditModal 
          ruleId={rule.rule_id} 
          clusters={clusters} 
          channels={channels} 
          onClose={() => setEditing(false)} 
          onSaved={() => loadData(true)} 
        />
      )}
    </div>
  );
}
