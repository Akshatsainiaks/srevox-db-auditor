"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Plus, Trash2, Pencil, Bell, BellOff, Zap, RefreshCw, AlertTriangle, ShieldCheck, ChevronRight } from "lucide-react";
import { fetchRules, updateRule, deleteRule, toggleRule, fetchClusters, fetchChannels, muteRule, unmuteRule } from "@/lib/api";
import type { AlertRule, Cluster, Channel } from "@/lib/utils";
import { severityBadge, timeAgo } from "@/lib/utils";
import { getUser, hasPermission } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import AddModal from "@/components/rules/AddModal";
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

export default function RulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const me = getUser();
  const { confirm } = useConfirm();
  const { error } = useToast();
  const [authorized, setAuthorized] = useState(true);
  const toastShownRef = useRef(false);

  const load = (quiet = false) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    Promise.all([fetchRules(), fetchClusters(), fetchChannels()])
      .then(([r, c, ch]) => { 
        setRules(r.rules || []); 
        setClusters(c.clusters || []); 
        setChannels(ch.channels || []); 
        setAuthorized(true);
      })
      .catch((err: any) => {
        console.error(err);
        if (err.response?.status === 403) {
          setAuthorized(false);
          if (!toastShownRef.current) {
            error("Access restricted: You do not have permission to view alert rules.");
            toastShownRef.current = true;
          }
        }
      }).finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };
  useEffect(() => {
    const user = getUser();
    if (!hasPermission(user, "viewRules")) {
      setAuthorized(false);
      setLoading(false);
      if (!toastShownRef.current) {
        error("Permission Required: You do not have permission to view alert rules.");
        toastShownRef.current = true;
      }
      return;
    }
    load();
  }, []);

  const remove = async (id: string) => {
    const { confirmed } = await confirm({
      title: "Delete rule?",
      message: "Are you sure you want to delete this alert rule?",
      confirmLabel: "Delete",
      variant: "danger"
    });
    if (!confirmed) return;
    await deleteRule(id);
    load(true);
  };
  const toggle = async (id: string) => { await toggleRule(id); load(true); };
  const toggleOnlyIncrease = async (id: string, currentVal: boolean) => {
    try {
      await updateRule(id, { only_increase_restarts: !currentVal });
      load(true);
    } catch (e) {
      console.error(e);
    }
  };
  const handleMute = async (id: string, mins: number) => { await muteRule(id, mins); load(true); };
  const handleUnmute = async (id: string) => { await unmuteRule(id); load(true); };
  const clusterName = (id: string | null) => !id ? 'All clusters' : clusters.find((c) => c.cluster_id === id)?.name || id.slice(0, 8);

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`viewRules`) to view alert rules & configurations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alert rules</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Define when and how to alert on pod crashes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className="btn-secondary flex items-center gap-1.5 text-xs py-2.5 px-3.5">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          {hasPermission(me, "addRule") && (
            <button id="add-rule-btn" onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-xs py-2.5 px-3.5"><Plus className="w-4 h-4" /> New rule</button>
          )}
        </div>
      </div>
      {showAdd && <AddModal clusters={clusters} channels={channels} onClose={() => setShowAdd(false)} onAdded={load} />}
      {editing && <EditModal ruleId={editing.rule_id} clusters={clusters} channels={channels} onClose={() => setEditing(null)} onSaved={load} />}
      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="card p-5 animate-pulse bg-gray-100 dark:bg-slate-800 h-24" />)}</div>
      ) : rules.length === 0 ? (
        <div className="card py-20 text-center">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><BookOpen className="w-8 h-8 text-indigo-400" /></div>
          <p className="font-bold text-gray-800 dark:text-white mb-1">No alert rules yet</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mb-6">Create a rule to define when Srevox sends alerts</p>
          {hasPermission(me, "addRule") && (
            <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create first rule</button>
          )}
        </div>
      ) : (
        <div id="rules-list" className="space-y-3">
          {rules.map((rule) => {
            const ns = parseArr(rule.namespaces);
            const reasons = parseArr(rule.crash_reasons);
            return (
              <div 
                key={rule.rule_id} 
                onClick={() => router.push(`/dashboard/rules/${rule.rule_id}`)}
                className={`card p-5 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all ${!rule.enabled ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                        {rule.name}
                      </span>
                      <span className={`badge text-xs ${severityBadge(rule.severity)}`}>{rule.severity}</span>
                      {!rule.enabled && <span className="badge bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-600 text-xs">paused</span>}
                      {rule.muted_ttl && rule.muted_ttl > 0 && (
                        <span className="badge bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 text-xs flex items-center gap-1">
                          <BellOff className="w-3 h-3 text-amber-500" />
                          Muted ({Math.ceil(rule.muted_ttl / 60)}m left)
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-[10.5px] font-semibold border ${
                        rule.only_increase_restarts !== false
                          ? "bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-250/20 dark:border-emerald-500/15"
                          : "bg-amber-50/70 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-250/20 dark:border-amber-500/15"
                      }`}>
                        {rule.only_increase_restarts !== false ? (
                          <>
                            <Zap className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-450 animate-pulse" />
                            <span>New Restarts Only</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3 text-amber-500 dark:text-amber-450" />
                            <span>Repeat Alerts</span>
                          </>
                        )}
                      </span>
                    </div>
                    {rule.description && <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{rule.description}</p>}
                    <div className="text-xs text-gray-500 dark:text-slate-400 flex flex-wrap gap-3">
                      <span>Cluster: <span className="text-gray-700 dark:text-slate-200 font-medium">{rule.cluster_name || clusterName(rule.cluster_id)}</span></span>
                      <span>Namespaces: <span className="text-gray-700 dark:text-slate-200 font-medium">{ns.length ? ns.join(", ") : "all"}</span></span>
                      <span>Min restarts: <span className="text-gray-700 dark:text-slate-200 font-medium">{rule.min_restarts}</span></span>
                      <span>Cooldown: <span className="text-gray-700 dark:text-slate-200 font-medium">{rule.cooldown_minutes}m</span></span>
                      <span>Created: <span className="text-gray-700 dark:text-slate-200 font-medium">{timeAgo(rule.created_at)}</span></span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {reasons.map((r: string) => <span key={r} className="badge bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 text-xs">{r}</span>)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {hasPermission(me, "toggleRule") && (
                      <>
                        {rule.muted_ttl && rule.muted_ttl > 0 ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUnmute(rule.rule_id); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-250/60 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all shadow-sm"
                            title="Click to unmute"
                          >
                            <BellOff className="w-3.5 h-3.5 text-amber-500 dark:text-amber-450" />
                            <span>Muted ({Math.ceil(rule.muted_ttl / 60)}m left)</span>
                          </button>
                        ) : (
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <select
                              value=""
                              onChange={(e) => {
                                e.stopPropagation();
                                if (e.target.value) {
                                  handleMute(rule.rule_id, Number(e.target.value));
                                }
                              }}
                              className="block pl-3 pr-8 py-1.5 text-xs font-semibold rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700/60 hover:bg-gray-100 dark:hover:bg-slate-700/80 cursor-pointer transition focus:outline-none appearance-none shadow-sm"
                              style={{
                                backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                                backgroundPosition: 'right 0.5rem center',
                                backgroundSize: '1.25em 1.25em',
                                backgroundRepeat: 'no-repeat',
                              }}
                            >
                              <option value="" disabled hidden>Mute...</option>
                              <option value="5">Mute 5m</option>
                              <option value="15">Mute 15m</option>
                              <option value="30">Mute 30m</option>
                              <option value="60">Mute 1h</option>
                              <option value="120">Mute 2h</option>
                              <option value="1440">Mute 24h</option>
                            </select>
                          </div>
                        )}

                        {/* On/Off Toggle Switch */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggle(rule.rule_id); }}
                          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 outline-none ${
                            rule.enabled ? "bg-indigo-600 shadow-sm shadow-indigo-600/30" : "bg-gray-200 dark:bg-slate-800"
                          }`}
                          title={rule.enabled ? "Click to pause rule" : "Click to enable rule"}
                        >
                          <span
                            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform"
                            style={{
                              backgroundColor: "#ffffff",
                              transform: rule.enabled ? "translateX(16px)" : "translateX(0px)"
                            }}
                          />
                        </button>
                      </>
                    )}

                    <ChevronRight className="w-5 h-5 text-gray-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
