"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { 
  ArrowLeft, Cpu, HardDrive, Activity, AlertTriangle, 
  Plus, Zap, Trash2, Edit3, RefreshCw, X, Settings, Bell, ShieldAlert, Save, Loader2
} from "lucide-react";
import { api, fetchCluster, updateCluster } from "@/lib/api";
import { type Cluster } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import MuteDurationModal from "@/components/services/MuteDurationModal";

interface ResourceAlert {
  resource_alert_id: string;
  cluster_id: string;
  resource_type: "cpu" | "memory" | "disk" | "pod_restarts" | string;
  threshold_pct: number;
  memory_threshold_pct?: number;
  target: "node" | "pod" | "namespace";
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

export default function ClusterAlerts({ clusterId, clusterName }: { clusterId: string; clusterName: string }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<ResourceAlert[]>([]);

  const getSliderBackground = (val: number) => {
    const pct = (val - 50) * 2;
    return `linear-gradient(to right, #6366f1 0%, #6366f1 ${pct}%, var(--range-bg, #e2e8f0) ${pct}%, var(--range-bg, #e2e8f0) 100%)`;
  };
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Drawer & Form states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resourceType, setResourceType] = useState<"cpu" | "memory" | "disk" | "pod_restarts" | "cpu_memory">("cpu");
  const [threshold, setThreshold] = useState(80);
  const [cpuThreshold, setCpuThreshold] = useState<number>(1.5);
  const [memThreshold, setMemThreshold] = useState<number>(6);
  const [target, setTarget] = useState<"node" | "pod" | "namespace">("node");
  const [targetName, setTargetName] = useState("");
  const [severity, setSeverity] = useState("warning");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [repeatIntervalMins, setRepeatIntervalMins] = useState<number>(15);
  const [repeatEnabled, setRepeatEnabled] = useState<boolean>(true);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [podThresholdMode, setPodThresholdMode] = useState<"pct" | "abs">("pct");

  // Mute modal state
  const [muteModalOpen, setMuteModalOpen] = useState(false);
  const [activeMuteAlertId, setActiveMuteAlertId] = useState<string | null>(null);
  const [testingNotification, setTestingNotification] = useState(false);

  const testAlertNotification = async (targetAlert?: ResourceAlert) => {
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
      const res = await api.post("/api/resource-alerts/test", {
        cluster_id: clusterId,
        resource_type: targetAlert ? targetAlert.resource_type : resourceType,
        threshold_pct: targetAlert ? targetAlert.threshold_pct : threshold,
        target: targetAlert ? targetAlert.target : target,
        target_name: targetAlert ? targetAlert.target_name : targetName,
        channel_ids: chs
      });
      success("Test Alert Triggered", res.data.message || "Test alert notification sent successfully.");
    } catch (e: any) {
      error("Test failed", e.response?.data?.detail || e.message);
    } finally {
      setTestingNotification(false);
    }
  };

  const { success, error } = useToast();
  const { confirm } = useConfirm();

  // Warning Thresholds states
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [loadingCluster, setLoadingCluster] = useState(true);

  const [isEditingThresholds, setIsEditingThresholds] = useState(false);
  const [cpuThresh, setCpuThresh] = useState(85);
  const [memThresh, setMemThresh] = useState(90);
  const [tempCpuThresh, setTempCpuThresh] = useState(85);
  const [tempMemThresh, setTempMemThresh] = useState(90);
  const [updatingThresholds, setUpdatingThresholds] = useState(false);

  // Node Offline Alerts states
  const [isEditingOffline, setIsEditingOffline] = useState(false);
  const [masterAlerts, setMasterAlerts] = useState(true);
  const [workerAlerts, setWorkerAlerts] = useState(true);
  const [tempMasterAlerts, setTempMasterAlerts] = useState(true);
  const [tempWorkerAlerts, setTempWorkerAlerts] = useState(true);
  const [updatingOffline, setUpdatingOffline] = useState(false);

  const loadClusterData = useCallback(async () => {
    setLoadingCluster(true);
    try {
      const cl = await fetchCluster(clusterId);
      setCluster(cl);
      setCpuThresh(cl.node_cpu_threshold ?? 85);
      setTempCpuThresh(cl.node_cpu_threshold ?? 85);
      setMemThresh(cl.node_memory_threshold ?? 90);
      setTempMemThresh(cl.node_memory_threshold ?? 90);
      setMasterAlerts(cl.master_alerts_enabled ?? true);
      setTempMasterAlerts(cl.master_alerts_enabled ?? true);
      setWorkerAlerts(cl.worker_alerts_enabled ?? true);
      setTempWorkerAlerts(cl.worker_alerts_enabled ?? true);
    } catch (err) {
      console.error(err);
      error("Failed to load warning/offline alert settings");
    } finally {
      setLoadingCluster(false);
    }
  }, [clusterId, error]);

  useEffect(() => {
    loadClusterData();
  }, [loadClusterData]);

  const handleUpdateThresholds = async () => {
    setUpdatingThresholds(true);
    try {
      await updateCluster(clusterId, {
        node_cpu_threshold: Number(tempCpuThresh),
        node_memory_threshold: Number(tempMemThresh),
      });
      success("Thresholds updated", "Resource usage warn limits saved successfully.");
      setCpuThresh(tempCpuThresh);
      setMemThresh(tempMemThresh);
      setIsEditingThresholds(false);
      loadClusterData();
    } catch {
      error("Failed to update threshold limits");
    } finally {
      setUpdatingThresholds(false);
    }
  };

  const handleUpdateOffline = async () => {
    setUpdatingOffline(true);
    try {
      await updateCluster(clusterId, {
        master_alerts_enabled: tempMasterAlerts,
        worker_alerts_enabled: tempWorkerAlerts,
      });
      success("Alert rules updated", "Node offline alert settings saved successfully.");
      setMasterAlerts(tempMasterAlerts);
      setWorkerAlerts(tempWorkerAlerts);
      setIsEditingOffline(false);
      loadClusterData();
    } catch {
      error("Failed to update alert rules");
    } finally {
      setUpdatingOffline(false);
    }
  };

  const handleCancelThresholds = () => {
    setTempCpuThresh(cpuThresh);
    setTempMemThresh(memThresh);
    setIsEditingThresholds(false);
  };

  const handleCancelOffline = () => {
    setTempMasterAlerts(masterAlerts);
    setTempWorkerAlerts(workerAlerts);
    setIsEditingOffline(false);
  };

  const [isMutingAll, setIsMutingAll] = useState(false);

  const handleEnableAll = async () => {
    if (alerts.length === 0) return;
    setLoading(true);
    try {
      await Promise.all(
        alerts.map(a =>
          api.put(`/api/resource-alerts/${a.resource_alert_id}`, {
            enabled: true
          })
        )
      );
      success("All alerts enabled", "All threshold alerts have been enabled successfully.");
      loadData(true);
    } catch (e) {
      console.error(e);
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
          api.put(`/api/resource-alerts/${a.resource_alert_id}`, {
            enabled: false
          })
        )
      );
      success("All alerts disabled", "All threshold alerts have been disabled successfully.");
      loadData(true);
    } catch (e) {
      console.error(e);
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
          api.put(`/api/resource-alerts/${a.resource_alert_id}`, {
            mute_until: null
          })
        )
      );
      success("All alerts unmuted", "All threshold alerts have been unmuted successfully.");
      loadData(true);
    } catch (e) {
      console.error(e);
      error("Failed to unmute all alerts");
    } finally {
      setLoading(false);
    }
  };

  const muteAllAlerts = async (minutes: number | null) => {
    let untilStr: string | null = null;
    if (minutes !== null && minutes > 0) {
      untilStr = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    } else if (minutes === 0) {
      untilStr = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(); // Indefinite (100 years)
    }

    setLoading(true);
    try {
      await Promise.all(
        alerts.map(a =>
          api.put(`/api/resource-alerts/${a.resource_alert_id}`, {
            mute_until: untilStr
          })
        )
      );
      success(untilStr ? "All alerts muted" : "All alerts unmuted");
      loadData(true);
    } catch {
      error("Failed to update mute state for all alerts");
    } finally {
      setLoading(false);
    }
  };

  const loadData = useCallback(async (silent = false) => {
    if (!clusterId) return;
    if (!silent) setLoading(true);
    try {
      const [alertsRes, channelsRes] = await Promise.all([
        api.get(`/api/resource-alerts?cluster_id=${clusterId}`).catch(() => ({ data: { alerts: [] } })),
        api.get("/api/channels").catch(() => ({ data: { channels: [] } }))
      ]);
      setAlerts(alertsRes.data.alerts || []);
      setChannels(channelsRes.data.channels || []);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [clusterId]);

  useEffect(() => {
    setMounted(true);
    loadData();
  }, [loadData]);

  // Normal channels filter
  const normalChannels = channels.filter(ch => ch.channel_type === "normal");

  const saveAlert = async () => {
    if (!clusterId) return;
    if (selectedChannels.length === 0) {
      error("Selection required", "Please select at least one notification channel.");
      return;
    }
    setSaving(true);
    try {
      if (editingAlertId) {
        // Edit Mode
        const payload: any = {
          resource_type: resourceType,
          target,
          target_name: targetName || null,
          severity,
          channel_ids: selectedChannels,
          repeat_interval_mins: repeatIntervalMins,
          repeat_enabled: repeatEnabled
        };

        if (resourceType === "cpu_memory") {
          payload.threshold_pct = cpuThreshold;
          payload.memory_threshold_pct = memThreshold;
        } else {
          payload.threshold_pct = (target === "pod" || target === "namespace")
            ? (resourceType === "memory" ? memThreshold : resourceType === "cpu" ? cpuThreshold : threshold)
            : threshold;
          payload.memory_threshold_pct = null;
        }

        await api.put(`/api/resource-alerts/${editingAlertId}`, payload);
        success("Alert rule updated successfully");
        setEditingAlertId(null);
      } else {
        // Create Mode
        const payload: any = {
          cluster_id: clusterId,
          resource_type: resourceType,
          target,
          target_name: targetName || null,
          severity,
          enabled: true,
          channel_ids: selectedChannels,
          repeat_interval_mins: repeatIntervalMins,
          repeat_enabled: repeatEnabled
        };

        if (resourceType === "cpu_memory") {
          payload.threshold_pct = cpuThreshold;
          payload.memory_threshold_pct = memThreshold;
        } else {
          payload.threshold_pct = (target === "pod" || target === "namespace")
            ? (resourceType === "memory" ? memThreshold : resourceType === "cpu" ? cpuThreshold : threshold)
            : threshold;
        }

        await api.post("/api/resource-alerts", payload);
        success("Threshold alert rule created");
      }
      // Reset form & state
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

  const startEdit = (alert: any) => {
    setEditingAlertId(alert.resource_alert_id);
    const rt = (alert.resource_type || "cpu").toLowerCase();
    setResourceType((rt === "storage" ? "disk" : rt) as any);
    setThreshold(alert.threshold_pct || 80);
    setCpuThreshold(alert.threshold_pct || 1.5);
    setMemThreshold(alert.memory_threshold_pct || 6);
    setTarget(alert.target);
    setTargetName(alert.target_name || "");
    setSeverity(alert.severity);
    setRepeatIntervalMins(alert.repeat_interval_mins || 15);
    setRepeatEnabled(alert.repeat_enabled !== false);
    
    // Parse channels
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
    setTarget("node");
    setTargetName("");
    setSelectedChannels([]);
    setRepeatIntervalMins(15);
    setRepeatEnabled(true);
    setDrawerOpen(true);
  };

  const deleteAlert = async (id: string) => {
    const { confirmed } = await confirm({
      title: "Delete alert rule?",
      message: "This resource threshold alert constraint will be permanently deleted.",
      confirmLabel: "Delete rule",
      variant: "danger"
    });
    if (!confirmed) return;
    try {
      await api.delete(`/api/resource-alerts/${id}`);
      success("Alert rule deleted");
      loadData(true);
    } catch {
      error("Failed to delete alert rule");
    }
  };

  const muteAlert = async (id: string, minutes: number | null) => {
    let untilStr: string | null = null;
    if (minutes !== null && minutes > 0) {
      untilStr = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    } else if (minutes === 0) {
      untilStr = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(); // Indefinite (100 years)
    }

    try {
      await api.put(`/api/resource-alerts/${id}`, {
        mute_until: untilStr
      });
      success(untilStr ? "Alert rule muted" : "Alert rule unmuted");
      loadData(true);
    } catch {
      error("Failed to update mute state");
    }
  };

  const toggleAlert = async (alert: ResourceAlert) => {
    try {
      await api.put(`/api/resource-alerts/${alert.resource_alert_id}`, {
        enabled: !alert.enabled
      });
      success(alert.enabled ? "Alert rule disabled" : "Alert rule enabled");
      loadData(true);
    } catch {
      error("Failed to update status");
    }
  };

  const isMuted = (alert: ResourceAlert) => {
    if (!alert.mute_until) return false;
    return new Date(alert.mute_until).getTime() > Date.now();
  };

  const getMuteRemaining = (alert: ResourceAlert) => {
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
          onClick={() => router.push(`/cluster/${clusterId}/settings`)}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 font-semibold transition-colors w-fit select-none bg-transparent border-none outline-none cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Cluster Settings
        </button>

        <div className="flex items-center justify-between flex-wrap gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Resource Alerts Configuration
            </h1>
            <p className="text-sm text-gray-550 dark:text-slate-400 mt-0.5">
              Manage custom bounds, severities, muting schedules, and channels for cluster {clusterName}.
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
              id="infra-set-alert-btn"
              onClick={startCreate}
              className="btn-primary flex items-center gap-1.5 text-xs py-2.5 px-3.5 font-bold bg-indigo-650 text-white rounded-xl shadow-lg shadow-indigo-650/10 hover:bg-indigo-750 transition-all select-none"
            >
              <Plus className="w-4 h-4" /> Set alert
            </button>
          </div>
        </div>
      </div>

      {/* Node Offline Alerts Card */}
      <div className="card p-6 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm select-text">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
          <h2 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-indigo-500" />
            Node Offline Alerts
          </h2>
          <div className="flex items-center gap-2">
            {!isEditingOffline ? (
              <button
                type="button"
                disabled={loadingCluster}
                onClick={() => {
                  setTempMasterAlerts(masterAlerts);
                  setTempWorkerAlerts(workerAlerts);
                  setIsEditingOffline(true);
                }}
                className="btn-secondary text-[11px] font-bold py-1 px-3 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1 disabled:opacity-50"
              >
                Edit Details
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelOffline}
                  className="btn-secondary text-[11px] font-bold py-1 px-3 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateOffline}
                  disabled={updatingOffline}
                  className="btn-primary text-[11px] font-bold py-1 px-3 h-[28px] rounded-lg text-white bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {updatingOffline && <Loader2 className="w-3 h-3 animate-spin" />}
                  {updatingOffline ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <label className={`flex items-center gap-2.5 select-none ${isEditingOffline ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`}>
              <input
                type="checkbox"
                disabled={!isEditingOffline || loadingCluster}
                checked={isEditingOffline ? tempMasterAlerts : masterAlerts}
                onChange={(e) => setTempMasterAlerts(e.target.checked)}
                className="w-4.5 h-4.5 rounded border-gray-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-gray-55 dark:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-gray-800 dark:text-slate-200">Control Plane Alerts</span>
                <p className="text-[10px] text-gray-600 dark:text-slate-300 mt-0.5 leading-normal">Alert immediately if control plane / master nodes status goes NotReady</p>
              </div>
            </label>

            <label className={`flex items-center gap-2.5 select-none ${isEditingOffline ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`}>
              <input
                type="checkbox"
                disabled={!isEditingOffline || loadingCluster}
                checked={isEditingOffline ? tempWorkerAlerts : workerAlerts}
                onChange={(e) => setTempWorkerAlerts(e.target.checked)}
                className="w-4.5 h-4.5 rounded border-gray-300 dark:border-slate-800 text-indigo-650 focus:ring-indigo-500 bg-gray-55 dark:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-gray-800 dark:text-slate-200">Worker Node Alerts</span>
                <p className="text-[10px] text-gray-600 dark:text-slate-300 mt-0.5 leading-normal">Alert if worker nodes report NotReady status</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Rules List Container */}
      <div id="rules-list-card" className="card p-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3.5 mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-gray-900 dark:text-white text-base">Threshold Configurations</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap select-none">
            {alerts.length > 0 && (
              <div className="flex items-center gap-1.5 border-r border-gray-205 dark:border-slate-800 pr-3 mr-1">
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
            <span className="text-xs bg-indigo-55/10 text-indigo-655 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
              {alerts.length} Rules
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-400 dark:text-slate-500">Loading custom threshold constraints...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-20 text-center">
            <Zap className="w-12 h-12 text-gray-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-655 dark:text-slate-400">No custom threshold alerts configured yet</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              Click "Set alert" in the upper right to set custom CPU, memory boundaries or pod restart alerts.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
            {alerts.map(a => {
              const muted = isMuted(a);
              const muteStr = getMuteRemaining(a);
              
              // Parse channels
              let channelIds: string[] = [];
              if (Array.isArray(a.channel_ids)) {
                channelIds = a.channel_ids;
              } else if (typeof a.channel_ids === "string") {
                try {
                  const parsed = JSON.parse(a.channel_ids);
                  if (Array.isArray(parsed)) channelIds = parsed;
                } catch {}
              }

              return (
                <div key={a.resource_alert_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full ${a.severity === "critical" ? "bg-red-500" : a.severity === "warning" ? "bg-amber-500" : "bg-blue-500"}`} />
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm capitalize">
                        {a.resource_type === "cpu_memory" ? (
                          <>
                            CPU &gt; {a.threshold_pct}{a.threshold_pct > 10 ? "% limit" : " Cores"} &nbsp;|&nbsp; Memory &gt; {a.memory_threshold_pct || a.threshold_pct}{(a.memory_threshold_pct || a.threshold_pct) > 10 ? "% limit" : " GB"}
                          </>
                        ) : (
                          <>
                            {a.resource_type.replace("_", " ")} &gt; {a.threshold_pct}
                            {a.resource_type === "pod_restarts" 
                              ? " restarts" 
                              : (a.target === "node" 
                                  ? "%" 
                                  : (a.threshold_pct > 10 ? "% limit" : (a.resource_type === "memory" ? " GB" : " Cores"))
                                )
                            }
                          </>
                        )}
                      </h3>
                      <span className="text-xs text-gray-400 dark:text-slate-505 font-medium">on</span>
                      <span className="bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-semibold capitalize text-gray-700 dark:text-slate-300">
                        {a.target} {a.target_name && `(${a.target_name})`}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-500 dark:text-slate-400 mt-1 select-none">
                      <span className="font-semibold uppercase text-[10px] tracking-wider text-gray-400 dark:text-slate-505">
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
                                <span key={cid} className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-655 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold text-[9px]">
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
                    {/* Timestamps */}
                    <div className="text-[10px] text-gray-405 dark:text-slate-500 mt-1 select-none">
                      Created: {new Date(a.created_at).toLocaleString()}
                      {a.updated_at && a.updated_at !== a.created_at && (
                        <span className="ml-2 pl-2 border-l border-gray-200 dark:border-slate-800">
                          Updated: {new Date(a.updated_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Service-Owner Style Mute Toggle & Action Buttons */}
                  <div className="flex items-center gap-4 shrink-0 select-none">
                    
                    {/* Enable toggle switch */}
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
                            if (muted) {
                              await muteAlert(a.resource_alert_id, null);
                            } else {
                              setActiveMuteAlertId(a.resource_alert_id);
                              setMuteModalOpen(true);
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-l border-gray-200 dark:border-slate-800 pl-3">
                      {/* Test alert trigger */}
                      <button 
                        onClick={() => testAlertNotification(a)}
                        disabled={testingNotification}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                        title="Send test alert notification to selected channels"
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit option */}
                      <button 
                        onClick={() => startEdit(a)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-indigo-650 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-gray-55 dark:hover:bg-slate-800/40 transition-colors"
                        title="Edit rule settings"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Remove option */}
                      <button 
                        onClick={() => deleteAlert(a.resource_alert_id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-505 hover:text-red-500 dark:text-slate-405 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors"
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

      {/* Slide-over Drawer for Add/Edit Alert configuration */}
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
            {/* Dark Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setDrawerOpen(false)}
            />
            
            {/* Sliding Drawer Container */}
            <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
              <div className="w-screen max-w-lg bg-white dark:bg-[#11131a] border-l border-gray-100 dark:border-slate-800/85 shadow-2xl flex flex-col h-full transform transition-transform duration-300 animate-slide-in-right">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Settings className="w-5 h-5 text-indigo-500" />
                    <h2 className="font-bold text-gray-900 dark:text-white text-base">
                      {editingAlertId ? "Edit Resource Alert" : "Configure Resource Alert"}
                    </h2>
                  </div>
                  <button 
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-55 dark:hover:bg-slate-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form Body - Scrollable */}
                <div className="p-6 flex-1 overflow-y-auto space-y-5 text-xs text-gray-700 dark:text-slate-350">
                  <div>
                    <label className="label text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Resource type</label>
                    <div className={`grid gap-2 mt-1.5 ${(target === "pod" || target === "namespace") ? "grid-cols-2" : "grid-cols-4"}`}>
                      {(target === "pod" || target === "namespace") ? (
                        ([
                          { id: "cpu_memory", label: "CPU + MEMORY" },
                          { id: "pod_restarts", label: "Restarts" }
                        ] as const).map(r => (
                          <button 
                            key={r.id} 
                            type="button"
                            onClick={() => setResourceType(r.id as any)}
                            className={`px-3 py-2.5 rounded-xl border text-xs font-semibold whitespace-nowrap flex items-center justify-center transition-all ${resourceType === r.id ? "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-slate-800 text-gray-650 dark:text-slate-400 hover:bg-gray-55 dark:hover:bg-slate-800/40"}`}
                          >
                            {r.label}
                          </button>
                        ))
                      ) : (
                        (["cpu", "memory", "disk", "pod_restarts"] as const).map(r => (
                          <button 
                            key={r} 
                            type="button"
                            onClick={() => setResourceType(r)}
                            className={`px-3 py-2.5 rounded-xl border text-xs font-semibold capitalize transition-all ${resourceType === r ? "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-slate-800 text-gray-650 dark:text-slate-400 hover:bg-gray-55 dark:hover:bg-slate-800/40"}`}
                          >
                            {r === "pod_restarts" ? "Restarts" : r === "disk" ? "STORAGE" : r.toUpperCase()}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="label text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                      Threshold Configuration
                    </label>

                    {(target === "pod" || target === "namespace") ? (
                      <div className="space-y-4 bg-gray-55 dark:bg-slate-900/40 p-4 rounded-xl border border-gray-150 dark:border-slate-800/80">
                        {/* Option 1: CPU Threshold */}
                        {(resourceType === "cpu" || resourceType === "cpu_memory") && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                                ⚡ CPU Threshold (Cores or % of Limit)
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step={cpuThreshold > 10 ? 1 : 0.1}
                                min={0.1}
                                value={cpuThreshold}
                                onChange={e => setCpuThreshold(parseFloat(e.target.value) || 1)}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                                placeholder="e.g. 1.5 for 1.5 Cores or 80 for 80% limit"
                              />
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 min-w-[50px]">
                                {cpuThreshold > 10 ? "% limit" : "Cores"}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 pt-0.5">
                              {cpuThreshold > 10 
                                ? `Alerts when pod CPU usage exceeds ${cpuThreshold}% of its CPU limit.` 
                                : `Alerts when pod CPU usage exceeds ${cpuThreshold} Cores.`}
                            </p>
                          </div>
                        )}

                        {/* Option 2: Memory Threshold */}
                        {(resourceType === "memory" || resourceType === "cpu_memory") && (
                          <div className={`space-y-1 ${resourceType === "cpu_memory" ? "border-t border-gray-200/60 dark:border-slate-800/60 pt-3" : ""}`}>
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                                💾 Memory Threshold (GB or % of Limit)
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step={memThreshold > 10 ? 1 : 0.5}
                                min={0.1}
                                value={memThreshold}
                                onChange={e => setMemThreshold(parseFloat(e.target.value) || 1)}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                                placeholder="e.g. 6 for 6 GB or 80 for 80% limit"
                              />
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 min-w-[50px]">
                                {memThreshold > 10 ? "% limit" : "GB"}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 pt-0.5">
                              {memThreshold > 10 
                                ? `Alerts when pod memory usage exceeds ${memThreshold}% of its Memory limit.` 
                                : `Alerts when pod memory usage exceeds ${memThreshold} GB.`}
                            </p>
                          </div>
                        )}

                        {/* Option 3: Restarts Threshold */}
                        {resourceType === "pod_restarts" && (
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                              🔄 Restart Count Threshold
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={threshold}
                              onChange={e => setThreshold(parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                            />
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                              Alerts when pod restarts reach or exceed {threshold} restarts.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <input 
                          type="range" 
                          min={resourceType === "pod_restarts" ? 1 : 50} 
                          max={resourceType === "pod_restarts" ? 100 : 100}
                          value={threshold} 
                          onChange={e => setThreshold(Number(e.target.value))}
                          className="w-full accent-indigo-600 mt-2 cursor-pointer" 
                        />
                        <div className="flex justify-between text-[10px] text-gray-405 dark:text-slate-505 mt-1">
                          <span>{resourceType === "pod_restarts" ? "1 restart" : "50%"}</span>
                          <span className="font-bold text-indigo-650 dark:text-indigo-400">
                            {threshold}{resourceType === "pod_restarts" ? " restarts" : "%"}
                          </span>
                          <span>{resourceType === "pod_restarts" ? "100 restarts" : "100%"}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div>
                    <label className="label text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Apply target bounds</label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      {(["node", "pod"] as const).map(t => (
                        <button 
                          key={t} 
                          type="button"
                          onClick={() => {
                            setTarget(t);
                            if (t !== "node") {
                              if (resourceType !== "pod_restarts") setResourceType("cpu_memory");
                            } else {
                              if (resourceType === "cpu_memory") setResourceType("cpu");
                              setThreshold(80);
                            }
                          }}
                          className={`px-3 py-2.5 rounded-xl border text-xs font-semibold capitalize transition-all ${target === t ? "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-slate-800 text-gray-650 dark:text-slate-400 hover:bg-gray-55 dark:hover:bg-slate-800/40"}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label text-[10px] font-bold text-gray-450 dark:text-slate-500 uppercase tracking-wider">
                      {target === "node" ? "Node name (empty = all nodes)" : "Pod prefix (empty = all pods)"}
                    </label>
                    <input 
                      className="input mt-1.5 dark:bg-slate-800/75 dark:border-slate-700 dark:text-white text-xs" 
                      placeholder={target === "node" ? "worker-1" : "payment-service"}
                      value={targetName} 
                      onChange={e => setTargetName(e.target.value)} 
                    />
                  </div>

                  <div>
                    <label className="label text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Severity level</label>
                    <div className="flex gap-2 mt-1.5">
                      {["info","warning","critical"].map(s => (
                        <button 
                          key={s} 
                          type="button"
                          onClick={() => setSeverity(s)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-semibold capitalize transition-all ${severity === s ? "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-slate-800 text-gray-650 dark:text-slate-400 hover:bg-gray-55 dark:hover:bg-slate-800/40"}`}
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
                          Resend Interval
                        </label>
                        <select
                          value={repeatIntervalMins}
                          onChange={e => setRepeatIntervalMins(Number(e.target.value))}
                          className="input mt-1 dark:bg-slate-800/75 dark:border-slate-700 dark:text-white text-xs font-semibold"
                        >
                          <option value={5}>Every 5 minutes</option>
                          <option value={15}>Every 15 minutes (Default)</option>
                          <option value={30}>Every 30 minutes</option>
                          <option value={60}>Every 1 hour</option>
                          <option value={120}>Every 2 hours</option>
                          <option value={360}>Every 6 hours</option>
                          <option value={720}>Every 12 hours</option>
                          <option value={1440}>Every 24 hours</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Notify Channels selector */}
                  <div className="space-y-1.5">
                    <label className="label text-[10px] font-bold text-gray-400 dark:text-slate-505 uppercase tracking-wider">Notify Channels</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-150 dark:border-slate-800/75 rounded-xl p-3 bg-gray-55/20 dark:bg-slate-800/40">
                      {normalChannels.length === 0 ? (
                        <p className="text-[11px] text-gray-400 dark:text-slate-505">No communication channels configured.</p>
                      ) : (
                        normalChannels.map(ch => {
                          const isEmail = ch.type === "email" || ch.type === "smtp" || ch.name.toLowerCase().includes("mail") || ch.name.toLowerCase().includes("email");
                          return (
                            <label key={ch.channel_id} className="flex items-center gap-2.5 text-xs text-gray-800 dark:text-slate-200 cursor-pointer select-none py-1 hover:bg-gray-100/30 dark:hover:bg-slate-800/30 rounded px-1.5 transition-colors">
                              <input
                                type="checkbox"
                                checked={selectedChannels.includes(ch.channel_id)}
                                onChange={e => {
                                  if (e.target.checked) setSelectedChannels([...selectedChannels, ch.channel_id]);
                                  else setSelectedChannels(selectedChannels.filter(id => id !== ch.channel_id));
                                }}
                                className="rounded border-gray-350 dark:border-slate-550 bg-white dark:bg-slate-700 text-indigo-650 dark:text-indigo-400 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                              />
                              <div className="flex-1 flex items-center justify-between">
                                <span className="font-semibold text-gray-900 dark:text-white">{ch.name}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${isEmail ? "bg-blue-105/10 text-blue-650 dark:text-blue-400 border border-blue-100 dark:border-blue-500/15" : "bg-purple-105/10 text-purple-650 dark:text-purple-400 border border-purple-100 dark:border-purple-500/15"}`}>
                                  {ch.type}
                                </span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Drawer Footer Actions */}
                <div className="p-5 border-t border-gray-100 dark:border-slate-805 bg-gray-50/30 dark:bg-slate-900/10 flex flex-col gap-2">
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
                      title="Send test notification to selected channels"
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
                        selectedChannels.length === 0 ? "opacity-50 cursor-not-allowed bg-gray-400 dark:bg-slate-700" : "bg-indigo-650 hover:bg-indigo-700"
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

      <MuteDurationModal
        isOpen={muteModalOpen}
        onClose={() => {
          setMuteModalOpen(false);
          setActiveMuteAlertId(null);
          setIsMutingAll(false);
        }}
        onConfirm={async (minutes) => {
          const activeId = activeMuteAlertId;
          const mutingAll = isMutingAll;
          setMuteModalOpen(false);
          setActiveMuteAlertId(null);
          setIsMutingAll(false);

          if (mutingAll) {
            await muteAllAlerts(minutes);
          } else if (activeId) {
            await muteAlert(activeId, minutes);
          }
        }}
        title={isMutingAll ? "Mute All Resource Alerts" : "Mute Resource Alert"}
      />
    </div>
  );
}
