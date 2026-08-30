"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  Bell, Cpu, HardDrive, Activity, Server, AlertTriangle, 
  Plus, Zap, Trash2, RefreshCw, X, ShieldAlert, Check, Loader2, Send
} from "lucide-react";
import { 
  fetchMachineAlertRules, 
  createMachineAlertRule, 
  toggleMachineAlertRule, 
  deleteMachineAlertRule, 
  testMachineAlert, 
  fetchChannels 
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";

export interface MachineAlertRule {
  rule_id: string;
  machine_id: string;
  metric: "cpu" | "memory" | "disk" | "load" | "offline" | string;
  operator: ">" | "<";
  threshold_pct: number;
  severity: "critical" | "warning" | "info" | string;
  repeat_enabled: boolean;
  repeat_interval_mins: number;
  channel_ids?: string[];
  enabled: boolean;
  created_at: string;
}

const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? "bg-indigo-600 dark:bg-indigo-500 shadow-md shadow-indigo-500/20" : "bg-gray-200 dark:bg-slate-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
};

export default function MachineConfigureAlertsModal({
  isOpen,
  onClose,
  machine,
}: {
  isOpen: boolean;
  onClose: () => void;
  machine: {
    machine_id: string;
    name: string;
    hostname?: string;
    cpu_cores?: number;
    total_memory_bytes?: number;
    total_disk_bytes?: number;
  };
}) {
  const { success, error } = useToast();
  const { confirm } = useConfirm();

  const [rules, setRules] = useState<MachineAlertRule[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Form / Drawer state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [scope, setScope] = useState<"this" | "all">("this");
  const [metric, setMetric] = useState<"cpu" | "memory" | "disk" | "load" | "offline">("cpu");
  const [operator, setOperator] = useState<">" | "<">(">");
  const [threshold, setThreshold] = useState<number>(85);
  const [severity, setSeverity] = useState<string>("warning");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [repeatEnabled, setRepeatEnabled] = useState<boolean>(true);
  const [repeatIntervalMins, setRepeatIntervalMins] = useState<number>(15);

  const [savingRule, setSavingRule] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadRulesAndChannels = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, channelsRes] = await Promise.all([
        fetchMachineAlertRules(),
        fetchChannels().catch(() => ({ channels: [] })),
      ]);
      setRules(rulesRes.rules || []);
      setChannels(channelsRes.channels || []);
    } catch (err: any) {
      console.error(err);
      error("Failed to load machine alert rules");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    if (isOpen) {
      loadRulesAndChannels();
    }
  }, [isOpen, loadRulesAndChannels]);

  if (!isOpen || !mounted) return null;

  // Filter rules applicable to this machine or global '*'
  const machineRules = rules.filter(
    (r) => r.machine_id === machine.machine_id || r.machine_id === "*"
  );

  const handleToggleRule = async (ruleId: string, currentEnabled: boolean) => {
    try {
      await toggleMachineAlertRule(ruleId, !currentEnabled);
      setRules((prev) =>
        prev.map((r) => (r.rule_id === ruleId ? { ...r, enabled: !currentEnabled } : r))
      );
      success("Alert Rule Updated", `Rule ${!currentEnabled ? "enabled" : "disabled"} successfully.`);
    } catch (err: any) {
      error("Failed to update rule status");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    const res = await confirm({
      title: "Delete Machine Alert Rule",
      message: "Are you sure you want to delete this alert rule? This action cannot be undone.",
      confirmLabel: "Delete Rule",
      variant: "danger",
    });
    if (!res?.confirmed) return;

    try {
      await deleteMachineAlertRule(ruleId);
      setRules((prev) => prev.filter((r) => r.rule_id !== ruleId));
      success("Alert Rule Deleted", "Machine alert rule removed successfully.");
    } catch (err: any) {
      error("Failed to delete rule");
    }
  };

  const handleTestAlert = async (rule?: MachineAlertRule) => {
    let chs: string[] = [];
    if (rule) {
      if (Array.isArray(rule.channel_ids)) chs = rule.channel_ids;
      else if (typeof rule.channel_ids === "string") {
        try {
          const parsed = JSON.parse(rule.channel_ids);
          if (Array.isArray(parsed)) chs = parsed;
        } catch {}
      }
    } else {
      chs = selectedChannels;
    }

    if (!chs || chs.length === 0) {
      error("Selection Required", "Please select at least one notification channel to test dispatch.");
      return;
    }

    setTestingNotification(true);
    try {
      await testMachineAlert({ channel_ids: chs });
      success("Test Alert Dispatched", "Test machine notification sent to configured channels.");
    } catch (err: any) {
      error("Test Failed", err.response?.data?.error || err.message);
    } finally {
      setTestingNotification(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (threshold === undefined || isNaN(threshold)) {
      return error("Validation Error", "Please enter a valid threshold value.");
    }

    setSavingRule(true);
    try {
      const payload = {
        machine_id: scope === "this" ? machine.machine_id : "*",
        metric,
        operator,
        threshold_pct: Number(threshold),
        severity,
        repeat_enabled: repeatEnabled,
        repeat_interval_mins: Number(repeatIntervalMins) || 15,
        channel_ids: selectedChannels,
      };

      const res = await createMachineAlertRule(payload);
      setRules((prev) => [res.rule, ...prev]);
      success("Alert Rule Created", `New ${metric.toUpperCase()} threshold rule configured successfully.`);
      setShowCreateForm(false);
      // Reset form
      setThreshold(85);
      setSelectedChannels([]);
    } catch (err: any) {
      error("Failed to Create Rule", err.response?.data?.error || err.message);
    } finally {
      setSavingRule(false);
    }
  };

  const toggleChannelSelection = (chId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(chId) ? prev.filter((id) => id !== chId) : [...prev, chId]
    );
  };

  const getMetricIcon = (mType: string) => {
    switch (mType) {
      case "cpu": return <Cpu className="w-4 h-4 text-indigo-500" />;
      case "memory": return <Activity className="w-4 h-4 text-purple-500" />;
      case "disk": return <HardDrive className="w-4 h-4 text-emerald-500" />;
      case "load": return <Server className="w-4 h-4 text-amber-500" />;
      case "offline": return <Zap className="w-4 h-4 text-red-500" />;
      default: return <Bell className="w-4 h-4 text-indigo-500" />;
    }
  };

  const getMetricName = (mType: string) => {
    switch (mType) {
      case "cpu": return "CPU Utilization";
      case "memory": return "Memory Usage";
      case "disk": return "Disk Utilization";
      case "load": return "System Load (1m)";
      case "offline": return "Host Agent Offline";
      default: return mType.toUpperCase();
    }
  };

  const content = (
    <div
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-500/20 flex items-center justify-center text-indigo-500 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 dark:text-white text-base">Configure Machine Alerts</h3>
                <span className="badge text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {machine.name}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Manage automated threshold alerts and offline notifications for this host machine.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold"
              >
                <Plus className="w-4 h-4" /> Add Rule
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Create Rule Drawer / Form */}
          {showCreateForm ? (
            <form onSubmit={handleCreateRule} className="bg-slate-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
                <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-500" /> Create Machine Alert Rule
                </h4>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Target Scope */}
                <div>
                  <label className="font-bold text-gray-700 dark:text-slate-300 block mb-1.5">Target Machine Scope</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 font-semibold text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    <option value="this">This Machine Only ({machine.name})</option>
                    <option value="all">All Fleet Host Machines (*)</option>
                  </select>
                </div>

                {/* Metric Type */}
                <div>
                  <label className="font-bold text-gray-700 dark:text-slate-300 block mb-1.5">Monitored Metric</label>
                  <select
                    value={metric}
                    onChange={(e) => {
                      const m = e.target.value as any;
                      setMetric(m);
                      if (m === "load") setThreshold(4.0);
                      else if (m === "offline") setThreshold(1);
                      else setThreshold(85);
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 font-semibold text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    <option value="cpu">CPU Utilization (%)</option>
                    <option value="memory">Memory Usage (%)</option>
                    <option value="disk">Disk Utilization (%)</option>
                    <option value="load">System Load Average (1m)</option>
                    <option value="offline">Host Agent Offline / Unreachable</option>
                  </select>
                </div>

                {/* Operator & Threshold */}
                {metric !== "offline" && (
                  <>
                    <div>
                      <label className="font-bold text-gray-700 dark:text-slate-300 block mb-1.5">Condition Operator</label>
                      <select
                        value={operator}
                        onChange={(e) => setOperator(e.target.value as any)}
                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 font-semibold text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                      >
                        <option value=">">Exceeds (&gt;)</option>
                        <option value="<">Falls Below (&lt;)</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="font-bold text-gray-700 dark:text-slate-300 block">
                          Threshold Value {metric === "load" ? "" : "(%)"}
                        </label>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {threshold} {metric === "load" ? "cores" : "%"}
                        </span>
                      </div>
                      <input
                        type="number"
                        step={metric === "load" ? "0.1" : "1"}
                        min="1"
                        max={metric === "load" ? "128" : "100"}
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 font-semibold text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </>
                )}

                {/* Severity */}
                <div>
                  <label className="font-bold text-gray-700 dark:text-slate-300 block mb-1.5">Alert Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 font-semibold text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    <option value="critical">Critical (P1)</option>
                    <option value="warning">Warning (P2)</option>
                    <option value="info">Informational (P3)</option>
                  </select>
                </div>

                {/* Repeat Notification Settings */}
                <div>
                  <label className="font-bold text-gray-700 dark:text-slate-300 block mb-1.5">Repeat Interval</label>
                  <select
                    value={repeatIntervalMins}
                    onChange={(e) => setRepeatIntervalMins(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 font-semibold text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    <option value={5}>Every 5 minutes</option>
                    <option value={15}>Every 15 minutes</option>
                    <option value={30}>Every 30 minutes</option>
                    <option value={60}>Every 1 hour</option>
                  </select>
                </div>
              </div>

              {/* Notification Channels Multi-Select */}
              <div>
                <label className="font-bold text-gray-700 dark:text-slate-300 block mb-1.5 text-xs">
                  Notification Channels
                </label>
                {channels.length === 0 ? (
                  <p className="text-xs text-amber-500 bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-200 dark:border-amber-500/20">
                    No active notification channels configured yet. Default fallback channel will be used.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {channels.map((ch) => {
                      const selected = selectedChannels.includes(ch.channel_id);
                      return (
                        <button
                          key={ch.channel_id}
                          type="button"
                          onClick={() => toggleChannelSelection(ch.channel_id)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                            selected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:border-indigo-400"
                          }`}
                        >
                          {selected && <Check className="w-3.5 h-3.5" />}
                          {ch.name} ({ch.type})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => handleTestAlert()}
                  disabled={testingNotification || selectedChannels.length === 0}
                  className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
                >
                  {testingNotification ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-indigo-500" />}
                  Test Dispatch
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="btn-secondary text-xs py-2 px-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingRule}
                    className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 font-bold"
                  >
                    {savingRule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    {savingRule ? "Saving Rule..." : "Create Rule"}
                  </button>
                </div>
              </div>
            </form>
          ) : null}

          {/* Active Rules List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">
                Configured Machine Alert Rules ({machineRules.length})
              </h4>
              <button
                onClick={loadRulesAndChannels}
                disabled={loading}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 flex items-center gap-1 font-semibold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : machineRules.length === 0 ? (
              <div className="card p-8 text-center space-y-3 bg-gray-50/50 dark:bg-slate-900/30 border-dashed">
                <Bell className="w-8 h-8 text-gray-400 mx-auto" />
                <div>
                  <p className="text-xs font-bold text-gray-700 dark:text-slate-300">No alert rules configured for this machine</p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                    Click "Add Rule" above to set up automated CPU, Memory, Disk, Load average, or Agent Offline alerts.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Create First Rule
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {machineRules.map((rule) => {
                  const isThisMachine = rule.machine_id === machine.machine_id;
                  const severityBg =
                    rule.severity === "critical"
                      ? "bg-red-50 text-red-600 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
                      : rule.severity === "warning"
                      ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
                      : "bg-blue-50 text-blue-600 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20";

                  return (
                    <div
                      key={rule.rule_id}
                      className={`card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 transition-all ${
                        rule.enabled ? "border-l-indigo-500" : "border-l-gray-300 dark:border-l-slate-700 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                          {getMetricIcon(rule.metric)}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 dark:text-white text-sm">
                              {getMetricName(rule.metric)}
                            </span>
                            {rule.metric !== "offline" && (
                              <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/20">
                                {rule.operator} {rule.threshold_pct}{rule.metric === "load" ? "" : "%"}
                              </span>
                            )}
                            <span className={`badge text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${severityBg}`}>
                              {rule.severity}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-slate-500 flex-wrap">
                            <span>Scope: <strong className="text-gray-700 dark:text-slate-300">{isThisMachine ? "This Machine" : "All Fleet Machines"}</strong></span>
                            <span>•</span>
                            <span>Repeat: <strong className="text-gray-700 dark:text-slate-300">{rule.repeat_enabled !== false ? `Every ${rule.repeat_interval_mins || 15}m` : "Disabled"}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                        <button
                          onClick={() => handleTestAlert(rule)}
                          title="Dispatch Test Notification"
                          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-400 hover:text-indigo-500 transition-colors"
                        >
                          <Send className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteRule(rule.rule_id)}
                          title="Delete Alert Rule"
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-2 pl-2 border-l border-gray-100 dark:border-slate-800">
                          <span className="text-xs text-gray-400 font-semibold">{rule.enabled ? "Active" : "Disabled"}</span>
                          <ToggleSwitch
                            checked={rule.enabled}
                            onChange={() => handleToggleRule(rule.rule_id, rule.enabled)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
