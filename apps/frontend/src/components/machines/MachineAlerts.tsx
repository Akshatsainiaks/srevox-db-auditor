"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { 
  ArrowLeft, Cpu, HardDrive, Activity, AlertTriangle, 
  Plus, Zap, Trash2, Edit3, RefreshCw, X, Settings, Bell, ShieldAlert, Save, Loader2
} from "lucide-react";
import { api, fetchMachine, updateMachine } from "@/lib/api";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import MuteDurationModal from "@/components/services/MuteDurationModal";

interface MachineResourceAlert {
  resource_alert_id: string;
  machine_id: string;
  resource_type: "cpu" | "memory" | "disk" | "load" | "offline" | string;
  threshold_pct: number;
  target: "machine" | "all" | string;
  target_name?: string;
  severity: string;
  enabled: boolean;
  channel_ids?: string[];
  mute_until?: string | null;
  repeat_interval_mins?: number;
  repeat_enabled?: boolean;
  created_at: string;
  updated_at?: string;
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

export default function MachineAlerts({ machineId, machineName }: { machineId: string; machineName: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const { confirm } = useConfirm();

  const [alerts, setAlerts] = useState<MachineResourceAlert[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Drawer & Form states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resourceType, setResourceType] = useState<"cpu" | "memory" | "disk" | "load" | "offline">("cpu");
  const [threshold, setThreshold] = useState(80);
  const [target, setTarget] = useState<"machine" | "all">("machine");
  const [targetName, setTargetName] = useState("");
  const [severity, setSeverity] = useState("warning");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [repeatIntervalMins, setRepeatIntervalMins] = useState<number>(15);
  const [repeatEnabled, setRepeatEnabled] = useState<boolean>(true);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);

  // Mute modal state
  const [muteModalOpen, setMuteModalOpen] = useState(false);
  const [activeMuteAlertId, setActiveMuteAlertId] = useState<string | null>(null);
  const [testingNotification, setTestingNotification] = useState(false);
  const [isMutingAll, setIsMutingAll] = useState(false);

  // Machine offline alert settings
  const [machineData, setMachineData] = useState<any>(null);
  const [loadingMachine, setLoadingMachine] = useState(true);
  const [isEditingOffline, setIsEditingOffline] = useState(false);
  const [offlineAlertsEnabled, setOfflineAlertsEnabled] = useState(true);
  const [loadAlertsEnabled, setLoadAlertsEnabled] = useState(true);
  const [tempOfflineAlertsEnabled, setTempOfflineAlertsEnabled] = useState(true);
  const [tempLoadAlertsEnabled, setTempLoadAlertsEnabled] = useState(true);
  const [updatingOffline, setUpdatingOffline] = useState(false);

  const loadMachineDetails = useCallback(async () => {
    setLoadingMachine(true);
    try {
      const res = await fetchMachine(machineId);
      const m = res.machine;
      setMachineData(m);
      setOfflineAlertsEnabled(m.offline_alerts_enabled !== false);
      setTempOfflineAlertsEnabled(m.offline_alerts_enabled !== false);
      setLoadAlertsEnabled(m.load_alerts_enabled !== false);
      setTempLoadAlertsEnabled(m.load_alerts_enabled !== false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMachine(false);
    }
  }, [machineId]);

  const loadData = useCallback(async (silent = false) => {
    if (!machineId) return;
    if (!silent) setLoading(true);
    try {
      const [rulesRes, channelsRes] = await Promise.all([
        api.get("/api/machines/alerts/rules").catch(() => ({ data: { rules: [] } })),
        api.get("/api/channels").catch(() => ({ data: { channels: [] } }))
      ]);

      const rawRules: any[] = rulesRes.data.rules || [];
      const normalizedRules: MachineResourceAlert[] = rawRules.map((r) => ({
        ...r,
        resource_alert_id: r.resource_alert_id || r.rule_id || r.id || String(Math.random()),
        resource_type: String(r.resource_type || r.metric || "cpu"),
        target: r.target || (r.machine_id === "*" ? "all" : "machine"),
        threshold_pct: Number(r.threshold_pct || 0),
        enabled: r.enabled !== false,
      }));

      const filtered = normalizedRules.filter(
        (r) => r.machine_id === machineId || r.machine_id === "*"
      );
      setAlerts(filtered);
      setChannels(channelsRes.data.channels || []);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    setMounted(true);
    loadData();
    loadMachineDetails();
  }, [loadData, loadMachineDetails]);

  const normalChannels = channels.filter(ch => ch.channel_type !== "service_owner");

  const handleUpdateOffline = async () => {
    setUpdatingOffline(true);
    try {
      await updateMachine(machineId, {
        offline_alerts_enabled: tempOfflineAlertsEnabled,
        load_alerts_enabled: tempLoadAlertsEnabled,
      });
      success("Alert rules updated", "Host agent offline alert settings saved successfully.");
      setOfflineAlertsEnabled(tempOfflineAlertsEnabled);
      setLoadAlertsEnabled(tempLoadAlertsEnabled);
      setIsEditingOffline(false);
      loadMachineDetails();
    } catch {
      error("Failed to update offline alert settings");
    } finally {
      setUpdatingOffline(false);
    }
  };

  const handleCancelOffline = () => {
    setTempOfflineAlertsEnabled(offlineAlertsEnabled);
    setTempLoadAlertsEnabled(loadAlertsEnabled);
    setIsEditingOffline(false);
  };

  const testAlertNotification = async (targetAlert?: MachineResourceAlert) => {
    let chs: string[] = [];
    if (targetAlert) {
      if (Array.isArray(targetAlert.channel_ids)) {
        chs = targetAlert.channel_ids;
      } else if (typeof targetAlert.channel_ids === "string") {
        try {
          const parsed = JSON.parse(targetAlert.channel_ids);
          if (Array.isArray(parsed)) chs = parsed;
        } catch {}
      }
    } else {
      chs = selectedChannels;
    }

    if (!chs || chs.length === 0) {
      error("Selection required", "Please select at least one notification channel to test.");
      return;
    }

    setTestingNotification(true);
    try {
      const res = await api.post("/api/machines/alerts/test", {
        channel_ids: chs,
        machine_name: machineName || machineData?.name || machineData?.hostname || "Host Machine"
      });
      success("Test Alert Triggered", res.data.message || "Test alert notification sent successfully.");
    } catch (e: any) {
      error("Test failed", e.response?.data?.error || e.message);
    } finally {
      setTestingNotification(false);
    }
  };

  const saveAlert = async () => {
    if (!machineId) return;
    if (selectedChannels.length === 0) {
      error("Selection required", "Please select at least one notification channel.");
      return;
    }
    setSaving(true);
    try {
      if (editingAlertId) {
        await api.delete(`/api/machines/alerts/rules/${editingAlertId}`).catch(() => {});
      }
      
      await api.post("/api/machines/alerts/rules", {
        machine_id: machineId,
        metric: resourceType,
        operator: ">",
        threshold_pct: threshold,
        severity,
        repeat_enabled: repeatEnabled,
        repeat_interval_mins: repeatIntervalMins,
        channel_ids: selectedChannels,
      });

      success("Threshold alert rule configured");
      setTargetName("");
      setSelectedChannels([]);
      setRepeatIntervalMins(15);
      setRepeatEnabled(true);
      setDrawerOpen(false);
      loadData(true);
    } catch {
      error("Failed to save alert rule");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (alert: MachineResourceAlert) => {
    setEditingAlertId(alert.resource_alert_id);
    setResourceType((alert.resource_type as any) || "cpu");
    setThreshold(alert.threshold_pct);
    setTarget(alert.machine_id === "*" ? "all" : "machine");
    setTargetName(alert.target_name || "");
    setSeverity(alert.severity);
    setRepeatIntervalMins(alert.repeat_interval_mins || 15);
    setRepeatEnabled(alert.repeat_enabled !== false);
    
    let parsedChannels: string[] = [];
    if (Array.isArray(alert.channel_ids)) {
      parsedChannels = alert.channel_ids;
    } else if (typeof alert.channel_ids === "string") {
      try {
        const parsed = JSON.parse(alert.channel_ids);
        if (Array.isArray(parsed)) parsedChannels = parsed;
      } catch {}
    }
    setSelectedChannels(parsedChannels);
    setDrawerOpen(true);
  };

  const startCreate = () => {
    setEditingAlertId(null);
    setResourceType("cpu");
    setThreshold(80);
    setTarget("machine");
    setTargetName("");
    setSelectedChannels([]);
    setRepeatIntervalMins(15);
    setRepeatEnabled(true);
    setDrawerOpen(true);
  };

  const deleteAlert = async (id: string) => {
    const res = await confirm({
      title: "Delete alert rule?",
      message: "This host machine threshold alert rule will be permanently deleted.",
      confirmLabel: "Delete rule",
      variant: "danger"
    });
    if (!res?.confirmed) return;
    try {
      await api.delete(`/api/machines/alerts/rules/${id}`);
      success("Alert rule deleted");
      loadData(true);
    } catch {
      error("Failed to delete alert rule");
    }
  };

  const toggleAlert = async (alert: MachineResourceAlert) => {
    try {
      await api.patch(`/api/machines/alerts/rules/${alert.resource_alert_id}`, {
        enabled: !alert.enabled
      });
      success(alert.enabled ? "Alert rule disabled" : "Alert rule enabled");
      loadData(true);
    } catch {
      error("Failed to update status");
    }
  };

  const handleEnableAll = async () => {
    if (alerts.length === 0) return;
    setLoading(true);
    try {
      await Promise.all(
        alerts.map(a =>
          api.patch(`/api/machines/alerts/rules/${a.resource_alert_id}`, {
            enabled: true
          })
        )
      );
      success("All alerts enabled", "All machine threshold alerts enabled successfully.");
      loadData(true);
    } catch (e) {
      error("Failed to enable all alerts");
    } finally {
      setLoading(false);
    }
  };

  const handleDisableAll = async () => {
    if (alerts.length === 0) return;
    setLoading(true);
    try {
      await Promise.all(
        alerts.map(a =>
          api.patch(`/api/machines/alerts/rules/${a.resource_alert_id || (a as any).rule_id}`, {
            enabled: false
          })
        )
      );
      success("All alerts disabled", "All machine threshold alerts disabled successfully.");
      loadData(true);
    } catch (e) {
      error("Failed to disable all alerts");
    } finally {
      setLoading(false);
    }
  };

  const handleMuteAllTrigger = () => {
    setIsMutingAll(true);
    setMuteModalOpen(true);
  };

  const handleUnmuteAll = async () => {
    if (alerts.length === 0) return;
    setLoading(true);
    try {
      await Promise.all(
        alerts.map(a =>
          api.patch(`/api/machines/alerts/rules/${a.resource_alert_id || (a as any).rule_id}`, {
            mute_until: null
          })
        )
      );
      success("All alerts unmuted", "All machine threshold alerts unmuted successfully.");
      loadData(true);
    } catch (e) {
      error("Failed to unmute all alerts");
    } finally {
      setLoading(false);
    }
  };

  const muteAlert = async (id: string, minutes: number | null) => {
    let untilStr: string | null = null;
    if (minutes !== null && minutes > 0) {
      untilStr = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    } else if (minutes === 0) {
      untilStr = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
    }

    try {
      await api.patch(`/api/machines/alerts/rules/${id}`, {
        mute_until: untilStr
      });
      success(untilStr ? "Alert rule muted" : "Alert rule unmuted");
      loadData(true);
    } catch {
      error("Failed to update mute state");
    }
  };

  const isMuted = (alert: MachineResourceAlert) => {
    if (!alert.mute_until) return false;
    return new Date(alert.mute_until).getTime() > Date.now();
  };

  const getMuteRemaining = (alert: MachineResourceAlert) => {
    if (!alert.mute_until) return "";
    const diff = new Date(alert.mute_until).getTime() - Date.now();
    if (diff <= 0) return "";
    
    if (diff > 10 * 365 * 24 * 60 * 60 * 1000) {
      return "Indefinitely";
    }

    const mins = Math.ceil(diff / 60000);
    if (mins < 60) return `${mins}m left`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m left`;
  };

  return (
    <div className="space-y-6 w-full">
      {/* Top Header */}
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => router.push(`/dashboard/machines/${machineId}`)}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 font-semibold transition-colors w-fit select-none bg-transparent border-none outline-none cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Machine Details
        </button>

        <div className="flex items-center justify-between flex-wrap gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Resource Alerts Configuration
            </h1>
            <p className="text-sm text-gray-550 dark:text-slate-400 mt-0.5">
              Manage custom bounds, severities, muting schedules, and channels for host machine {machineName}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => loadData()} 
              disabled={loading} 
              className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3 select-none font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Reload
            </button>
            <button 
              onClick={startCreate}
              className="btn-primary flex items-center gap-1.5 text-xs py-2.5 px-3.5 font-bold bg-indigo-650 text-white rounded-xl shadow-lg shadow-indigo-650/10 hover:bg-indigo-750 transition-all select-none"
            >
              <Plus className="w-4 h-4" /> Set alert
            </button>
          </div>
        </div>
      </div>

      {/* Rules List Container */}
      <div className="card p-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3.5 mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-gray-900 dark:text-white text-base">Threshold Configurations</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap select-none">
            {alerts.length > 0 && (
              <div className="flex items-center gap-1.5 border-r border-gray-200 dark:border-slate-800 pr-3 mr-1">
                <button
                  onClick={handleEnableAll}
                  disabled={loading}
                  className="btn-secondary text-[10px] font-bold py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-350 transition-colors shadow-sm disabled:opacity-50"
                >
                  Enable All
                </button>
                <button
                  onClick={handleDisableAll}
                  disabled={loading}
                  className="btn-secondary text-[10px] font-bold py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-350 transition-colors shadow-sm disabled:opacity-50"
                >
                  Disable All
                </button>
                <button
                  onClick={handleMuteAllTrigger}
                  disabled={loading}
                  className="btn-secondary text-[10px] font-bold py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-350 transition-colors shadow-sm disabled:opacity-50"
                >
                  Mute All
                </button>
                <button
                  onClick={handleUnmuteAll}
                  disabled={loading}
                  className="btn-secondary text-[10px] font-bold py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-350 transition-colors shadow-sm disabled:opacity-50"
                >
                  Unmute All
                </button>
              </div>
            )}
            <span className="text-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full font-bold">
              {alerts.length} Rules
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-400 dark:text-slate-500">Loading machine threshold constraints...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-20 text-center">
            <Zap className="w-12 h-12 text-gray-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600 dark:text-slate-400">No custom threshold alerts configured yet</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              Click "+ Configure Alerts" in the upper right to set custom CPU, memory, disk boundaries or agent offline alerts.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
            {alerts.map(a => {
              const muted = isMuted(a);
              const muteStr = getMuteRemaining(a);
              
              let channelIds: string[] = [];
              if (Array.isArray(a.channel_ids)) {
                channelIds = a.channel_ids;
              } else if (typeof a.channel_ids === "string") {
                try {
                  const parsed = JSON.parse(a.channel_ids);
                  if (Array.isArray(parsed)) channelIds = parsed;
                } catch {}
              }

              const isThisMachine = a.machine_id === machineId;
              const resType = String(a.resource_type || (a as any).metric || "cpu");

              return (
                <div key={a.resource_alert_id || (a as any).rule_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full ${a.severity === "critical" ? "bg-red-500" : a.severity === "warning" ? "bg-amber-500" : "bg-blue-500"}`} />
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm capitalize">
                        {resType.replace("_", " ")} {resType !== "offline" ? `> ${a.threshold_pct}%` : "Offline"}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-500 dark:text-slate-400 mt-1 select-none">
                      <span className="font-semibold uppercase text-[10px] tracking-wider text-gray-400 dark:text-slate-500">
                        {a.severity}
                      </span>
                      
                      {channelIds.length > 0 && (
                        <>
                          <span className="text-gray-300 dark:text-slate-700">•</span>
                          <span className="font-medium text-gray-400">Notify:</span>
                          <div className="flex flex-wrap gap-1">
                            {channelIds.map((cid: string) => {
                              const chan = normalChannels.find((c: any) => c.channel_id === cid);
                              return (
                                <span key={cid} className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold text-[9px]">
                                  {chan ? chan.name : cid}
                                </span>
                              );
                            })}
                          </div>
                        </>
                      )}

                      <span className="text-gray-300 dark:text-slate-700">•</span>
                      {a.repeat_enabled !== false ? (
                        <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-500/20 px-1.5 py-0.5 rounded font-bold text-[9px]">
                          Resend: Every {a.repeat_interval_mins || 15}m
                        </span>
                      ) : (
                        <span className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 px-1.5 py-0.5 rounded font-bold text-[9px]">
                          Resend: Disabled (Once)
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 select-none">
                      Created: {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 select-none">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-gray-400 dark:text-slate-500 font-semibold">{a.enabled ? "Enabled" : "Disabled"}</span>
                      <ToggleSwitch
                        checked={a.enabled}
                        onChange={() => toggleAlert(a)}
                      />
                    </div>

                    {/* Mute badge & Switch Toggle */}
                    <div className="flex items-center gap-2 border-l border-gray-200 dark:border-slate-800 pl-3">
                      {muted && (
                        <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 shrink-0">
                          🔕 Muted ({muteStr})
                        </span>
                      )}
                      
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-gray-400 dark:text-slate-500 font-semibold">Mute</span>
                        <ToggleSwitch
                          checked={muted}
                          onChange={async () => {
                            const rId = a.resource_alert_id || (a as any).rule_id;
                            if (muted) {
                              await muteAlert(rId, null);
                            } else {
                              setActiveMuteAlertId(rId);
                              setMuteModalOpen(true);
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-l border-gray-200 dark:border-slate-800 pl-3">
                      <button 
                        onClick={() => testAlertNotification(a)}
                        disabled={testingNotification}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                        title="Send test alert notification"
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>

                      <button 
                        onClick={() => startEdit(a)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit rule settings"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button 
                        onClick={() => deleteAlert(a.resource_alert_id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors"
                        title="Remove rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-over Drawer for Add/Edit Alert configuration matching Screenshot 3 */}
      {mounted && drawerOpen && createPortal(
        <div className="fixed inset-0 overflow-hidden z-50">
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            .animate-slide-in-right {
              animation: slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          <div className="absolute inset-0 overflow-hidden">
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setDrawerOpen(false)}
            />
            
            <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
              <div className="w-screen max-w-lg bg-white dark:bg-[#11131a] border-l border-gray-100 dark:border-slate-800 shadow-2xl flex flex-col h-full transform transition-transform duration-300 animate-slide-in-right">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Settings className="w-5 h-5 text-indigo-500" />
                    <h2 className="font-bold text-gray-900 dark:text-white text-base">
                      {editingAlertId ? "Edit Machine Resource Alert" : "Configure Resource Alert"}
                    </h2>
                  </div>
                  <button 
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form Body matching Screenshot 3 */}
                <div className="p-6 flex-1 overflow-y-auto space-y-5 text-xs text-gray-700 dark:text-slate-350">
                  <div>
                    <label className="label text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">RESOURCE TYPE</label>
                    <div className="grid grid-cols-4 gap-2 mt-1.5">
                      {(["cpu", "memory", "disk", "load"] as const).map(r => (
                        <button 
                          key={r} 
                          type="button"
                          onClick={() => setResourceType(r)}
                          className={`px-3 py-2.5 rounded-xl border text-xs font-semibold uppercase transition-all ${resourceType === r ? "border-indigo-600 bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300" : "border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/40"}`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                      THRESHOLD ({threshold}{resourceType === "load" ? " cores" : "%"})
                    </label>
                    <input 
                      type="range" 
                      min={resourceType === "load" ? 1 : 50} 
                      max={resourceType === "load" ? 32 : 100}
                      value={threshold} 
                      onChange={e => setThreshold(Number(e.target.value))}
                      className="w-full accent-indigo-600 mt-2 cursor-pointer" 
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                      <span>{resourceType === "load" ? "1 core" : "50%"}</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{threshold}{resourceType === "load" ? " cores" : "%"}</span>
                      <span>{resourceType === "load" ? "32 cores" : "100%"}</span>
                    </div>
                  </div>



                  <div>
                    <label className="label text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">SEVERITY LEVEL</label>
                    <div className="flex gap-2 mt-1.5">
                      {["info","warning","critical"].map(s => (
                        <button 
                          key={s} 
                          type="button"
                          onClick={() => setSeverity(s)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-semibold capitalize transition-all ${severity === s ? "border-indigo-600 bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300" : "border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/40"}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50/70 dark:bg-slate-800/30 rounded-xl border border-gray-200/60 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-bold text-gray-900 dark:text-white block">
                          Resend recurring alerts if unresolved
                        </label>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 block mt-0.5">
                          Re-sends notification if resource usage stays above threshold without returning to normal.
                        </span>
                      </div>
                      <ToggleSwitch
                        checked={repeatEnabled}
                        onChange={() => setRepeatEnabled(!repeatEnabled)}
                      />
                    </div>

                    {repeatEnabled && (
                      <div className="pt-2 border-t border-gray-200/50 dark:border-slate-700/50">
                        <label className="label text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                          RESEND INTERVAL
                        </label>
                        <select
                          value={repeatIntervalMins}
                          onChange={e => setRepeatIntervalMins(Number(e.target.value))}
                          className="w-full mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none"
                        >
                          <option value={5}>Every 5 minutes</option>
                          <option value={15}>Every 15 minutes (Default)</option>
                          <option value={30}>Every 30 minutes</option>
                          <option value={60}>Every 1 hour</option>
                          <option value={120}>Every 2 hours</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Notify Channels selector */}
                  <div className="space-y-1.5">
                    <label className="label text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">NOTIFY CHANNELS</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-slate-800 rounded-xl p-3 bg-gray-50/50 dark:bg-slate-900/50">
                      {normalChannels.length === 0 ? (
                        <p className="text-[11px] text-gray-400">No communication channels configured.</p>
                      ) : (
                        normalChannels.map(ch => {
                          return (
                            <label key={ch.channel_id} className="flex items-center gap-2.5 text-xs text-gray-800 dark:text-slate-200 cursor-pointer select-none py-1 hover:bg-gray-100/50 dark:hover:bg-slate-800/50 rounded px-1.5 transition-colors">
                              <input
                                type="checkbox"
                                checked={selectedChannels.includes(ch.channel_id)}
                                onChange={e => {
                                  if (e.target.checked) setSelectedChannels([...selectedChannels, ch.channel_id]);
                                  else setSelectedChannels(selectedChannels.filter(id => id !== ch.channel_id));
                                }}
                                className="rounded border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                              />
                              <div className="flex-1 flex items-center justify-between">
                                <span className="font-semibold text-gray-900 dark:text-white">{ch.name}</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/20">
                                  {ch.type || "channel"}
                                </span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Drawer Footer Actions matching Screenshot 3 */}
                <div className="p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex flex-col gap-2">
                  {selectedChannels.length === 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold text-center">
                      ⚠️ Please select at least one notification channel.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => testAlertNotification()}
                      disabled={testingNotification || selectedChannels.length === 0}
                      className="px-3 py-2.5 rounded-xl border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-500/10 hover:bg-amber-100/50 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      {testingNotification ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      Test Alert
                    </button>
                    <button 
                      onClick={() => setDrawerOpen(false)}
                      className="btn-secondary flex-1 py-2.5 rounded-xl font-bold justify-center text-xs"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={saveAlert}
                      disabled={saving || selectedChannels.length === 0}
                      className={`btn-primary flex-1 py-2.5 rounded-xl font-bold justify-center text-white text-xs ${
                        selectedChannels.length === 0 ? "opacity-50 cursor-not-allowed bg-gray-400 dark:bg-slate-700" : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                    >
                      {saving ? "Saving..." : editingAlertId ? "Save Changes" : "Confirm Settings"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Mute Modal */}
      {muteModalOpen && (
        <MuteDurationModal
          isOpen={muteModalOpen}
          onClose={() => {
            setMuteModalOpen(false);
            setActiveMuteAlertId(null);
            setIsMutingAll(false);
          }}
          onConfirm={async (minutes) => {
            setMuteModalOpen(false);
            if (isMutingAll) {
              let untilStr: string | null = null;
              if (minutes !== null && minutes > 0) {
                untilStr = new Date(Date.now() + minutes * 60 * 1000).toISOString();
              } else if (minutes === 0) {
                untilStr = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
              }
              try {
                await Promise.all(
                  alerts.map(a => api.patch(`/api/machines/alerts/rules/${a.resource_alert_id}`, { mute_until: untilStr }))
                );
                success(untilStr ? "All machine alerts muted" : "All machine alerts unmuted");
                loadData(true);
              } catch {
                error("Failed to mute all alerts");
              } finally {
                setIsMutingAll(false);
              }
            } else if (activeMuteAlertId) {
              let untilStr: string | null = null;
              if (minutes !== null && minutes > 0) {
                untilStr = new Date(Date.now() + minutes * 60 * 1000).toISOString();
              } else if (minutes === 0) {
                untilStr = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
              }
              try {
                await api.patch(`/api/machines/alerts/rules/${activeMuteAlertId}`, { mute_until: untilStr });
                success(untilStr ? "Alert rule muted" : "Alert rule unmuted");
                loadData(true);
              } catch {
                error("Failed to update mute state");
              } finally {
                setActiveMuteAlertId(null);
              }
            }
          }}
        />
      )}
    </div>
  );
}
