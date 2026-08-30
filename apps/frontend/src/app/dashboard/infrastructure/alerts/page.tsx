"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { 
  ArrowLeft, Cpu, HardDrive, Activity, AlertTriangle, 
  Plus, Zap, Trash2, Edit3, RefreshCw, X, Settings 
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import MuteDurationModal from "@/components/services/MuteDurationModal";

interface ResourceAlert {
  resource_alert_id: string;
  cluster_id: string;
  resource_type: "cpu" | "memory" | "pod_restarts";
  threshold_pct: number;
  target: "node" | "pod" | "namespace";
  target_name?: string;
  severity: string;
  enabled: boolean;
  channel_ids?: string[];
  mute_until?: string | null;
  created_at: string;
  updated_at?: string;
}

const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => {
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

export default function ResourceAlertsPage() {
  const [clusterId, setClusterId] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const cid = searchParams.get("cluster_id") || "";
  const [clusterName, setClusterName] = useState("");
  const [alerts, setAlerts] = useState<ResourceAlert[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Drawer & Form states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resourceType, setResourceType] = useState<"cpu" | "memory" | "pod_restarts">("cpu");
  const [threshold, setThreshold] = useState(80);
  const [target, setTarget] = useState<"node" | "pod" | "namespace">("node");
  const [targetName, setTargetName] = useState("");
  const [severity, setSeverity] = useState("warning");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);

  // Mute modal state
  const [muteModalOpen, setMuteModalOpen] = useState(false);
  const [activeMuteAlertId, setActiveMuteAlertId] = useState<string | null>(null);

  const { success, error } = useToast();
  const { confirm } = useConfirm();

  const loadData = useCallback(async (cid: string, silent = false) => {
    if (!cid) return;
    if (!silent) setLoading(true);
    try {
      if (silent) {
        const res = await api.get(`/api/resource-alerts?cluster_id=${cid}`);
        setAlerts(res.data.alerts || []);
      } else {
        const [alertsRes, channelsRes, clustersRes] = await Promise.all([
          api.get(`/api/resource-alerts?cluster_id=${cid}`).catch(() => ({ data: { alerts: [] } })),
          api.get("/api/channels").catch(() => ({ data: { channels: [] } })),
          api.get("/api/clusters").catch(() => ({ data: { clusters: [] } }))
        ]);

        setAlerts(alertsRes.data.alerts || []);
        setChannels(channelsRes.data.channels || []);
        
        const cl = clustersRes.data.clusters?.find((c: any) => c.cluster_id === cid);
        if (cl) setClusterName(cl.name);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    if (cid) {
      setClusterId(cid);
      loadData(cid);
    }
  }, [cid, loadData]);

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
        await api.put(`/api/resource-alerts/${editingAlertId}`, {
          resource_type: resourceType,
          threshold_pct: threshold,
          target,
          target_name: targetName || null,
          severity,
          channel_ids: selectedChannels
        });
        success("Alert rule updated successfully");
        setEditingAlertId(null);
      } else {
        // Create Mode
        await api.post("/api/resource-alerts", {
          cluster_id: clusterId,
          resource_type: resourceType,
          threshold_pct: threshold,
          target,
          target_name: targetName || null,
          severity,
          enabled: true,
          channel_ids: selectedChannels
        });
        success("Threshold alert rule created");
      }
      // Reset form & state
      setTargetName("");
      setSelectedChannels([]);
      setDrawerOpen(false);
      loadData(clusterId, true);
    } catch {
      error("Failed to save alert rule");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (alert: ResourceAlert) => {
    setEditingAlertId(alert.resource_alert_id);
    setResourceType(alert.resource_type);
    setThreshold(alert.threshold_pct);
    setTarget(alert.target);
    setTargetName(alert.target_name || "");
    setSeverity(alert.severity);
    
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
      loadData(clusterId, true);
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
      loadData(clusterId, true);
    } catch {
      error("Failed to update mute state");
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
          onClick={() => router.push(`/dashboard/infrastructure?cluster_id=${clusterId}`)}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 font-semibold transition-colors w-fit select-none"
        >
          <ArrowLeft className="w-4 h-4" /> Back to {clusterName || "Cluster"} Details
        </button>

        <div className="flex items-center justify-between flex-wrap gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Resource Alerts Configuration
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-405 mt-0.5">
              Manage custom bounds, severities, muting schedules, and channels for cluster {clusterName}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => loadData(clusterId)} 
              disabled={loading} 
              className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3 select-none font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Reload
            </button>
            <button 
              id="infra-set-alert-btn"
              onClick={startCreate}
              className="btn-primary flex items-center gap-1.5 text-xs py-2.5 px-3.5 font-bold bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/10 hover:bg-indigo-750 transition-all select-none"
            >
              <Plus className="w-4 h-4" /> Set alert
            </button>
          </div>
        </div>
      </div>

      {/* Rules List Container */}
      <div id="rules-list-card" className="card p-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3.5 mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-gray-900 dark:text-white text-base">Threshold Configurations</h2>
          </div>
          <span className="text-xs bg-indigo-55/10 text-indigo-650 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
            {alerts.length} Rules
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-400 dark:text-slate-500">Loading custom threshold constraints...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-20 text-center">
            <Zap className="w-12 h-12 text-gray-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-605 dark:text-slate-400">No custom threshold alerts configured yet</p>
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
                        {a.resource_type.replace("_", " ")} &gt; {a.threshold_pct}
                        {a.resource_type === "pod_restarts" 
                          ? " restarts" 
                          : (a.target === "node" 
                              ? "%" 
                              : (a.resource_type === "memory" ? " GB" : " Cores")
                            )
                        }
                      </h3>
                      <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">on</span>
                      <span className="bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-semibold capitalize text-gray-700 dark:text-slate-300">
                        {a.target} {a.target_name && `(${a.target_name})`}
                      </span>
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
                                <span key={cid} className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold text-[9px]">
                                  {chan ? chan.name : cid}
                                </span>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                    {/* Timestamps */}
                    <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 select-none">
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
                    
                    {/* Mute badge & Switch Toggle */}
                    <div className="flex items-center gap-2">
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
                              await muteAlert(a.resource_alert_id, null); // sending null unmutes
                            } else {
                              setActiveMuteAlertId(a.resource_alert_id);
                              setMuteModalOpen(true);
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-l border-gray-200 dark:border-slate-800 pl-3">
                      {/* Edit option */}
                      <button 
                        onClick={() => startEdit(a)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-indigo-650 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors"
                        title="Edit rule settings"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Remove option */}
                      <button 
                        onClick={() => deleteAlert(a.resource_alert_id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors"
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

      {/* Slide-over Drawer for Add/Edit Alert configuration - matching service owners style */}
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
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form Body - Scrollable */}
                <div className="p-6 flex-1 overflow-y-auto space-y-5">
                  <div>
                    <label className="label text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Resource type</label>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {(["cpu", "memory", "pod_restarts"] as const).map(r => (
                        <button 
                          key={r} 
                          type="button"
                          onClick={() => setResourceType(r)}
                          className={`px-3 py-2.5 rounded-xl border text-xs font-semibold capitalize transition-all ${resourceType === r ? "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-slate-800 text-gray-650 dark:text-slate-400 hover:bg-gray-55 dark:hover:bg-slate-800/40"}`}
                        >
                          {r === "pod_restarts" ? "Restarts" : r.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                      {resourceType === "pod_restarts" 
                        ? "Restart count threshold" 
                        : (target === "node" 
                            ? `Threshold (${threshold}%)` 
                            : (resourceType === "memory" ? "Memory threshold (GB)" : "CPU threshold (Cores)")
                          )
                      }
                    </label>
                    {((target === "pod" || target === "namespace") && resourceType !== "pod_restarts") ? (
                      <div className="flex gap-2 items-center mt-2">
                        <input
                          type="number"
                          step={resourceType === "memory" ? 0.5 : 0.1}
                          min={0.1}
                          value={threshold}
                          onChange={e => setThreshold(parseFloat(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl bg-transparent text-gray-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                          {resourceType === "memory" ? "GB" : "Cores"}
                        </span>
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
                        <div className="flex justify-between text-xs text-gray-400 dark:text-slate-505 mt-1">
                          <span>{resourceType === "pod_restarts" ? "1 restart" : "50%"}</span>
                          <span className="font-bold text-indigo-650 dark:text-indigo-400">{threshold}{resourceType === "pod_restarts" ? " restarts" : "%"}</span>
                          <span>{resourceType === "pod_restarts" ? "100 restarts" : "100%"}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div>
                    <label className="label text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Apply target bounds</label>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {(["node", "pod", "namespace"] as const).map(t => (
                        <button 
                          key={t} 
                          type="button"
                          onClick={() => {
                            setTarget(t);
                            // Adjust default threshold value based on bounds type
                            if (t !== "node" && resourceType !== "pod_restarts") {
                              setThreshold(resourceType === "memory" ? 2 : 1);
                            } else if (t === "node" && resourceType !== "pod_restarts") {
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
                    <label className="label text-xs font-bold text-gray-400 dark:text-slate-505 uppercase tracking-wider">
                      {target === "node" ? "Node name (empty = all nodes)" : target === "namespace" ? "Namespace (empty = all)" : "Pod prefix (empty = all pods)"}
                    </label>
                    <input 
                      className="input mt-1.5 dark:bg-slate-800/70 dark:border-slate-700 dark:text-white" 
                      placeholder={target === "node" ? "worker-1" : target === "namespace" ? "production" : "payment-service"}
                      value={targetName} 
                      onChange={e => setTargetName(e.target.value)} 
                    />
                  </div>

                  <div>
                    <label className="label text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Severity level</label>
                    <div className="flex gap-2 mt-1.5">
                      {["info","warning","critical"].map(s => (
                        <button 
                          key={s} 
                          type="button"
                          onClick={() => setSeverity(s)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-semibold capitalize transition-all ${severity === s ? "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/40"}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Combined Notify Channels selector */}
                  <div className="space-y-1.5">
                    <label className="label text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Notify Channels</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-150 dark:border-slate-800/75 rounded-xl p-3 bg-gray-50/20 dark:bg-slate-800/40">
                      {normalChannels.length === 0 ? (
                        <p className="text-[11px] text-gray-400 dark:text-slate-500">No communication channels configured.</p>
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
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${isEmail ? "bg-blue-105/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/15" : "bg-purple-105/10 text-purple-650 dark:text-purple-400 border border-purple-100 dark:border-purple-500/15"}`}>
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

                {/* Drawer Footer Actions - Sticky */}
                <div className="p-5 border-t border-gray-100 dark:border-slate-805 bg-gray-50/30 dark:bg-slate-900/10 flex flex-col gap-2">
                  {selectedChannels.length === 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold text-center">
                      ⚠️ Please select at least one notification channel.
                    </p>
                  )}
                  <div className="flex gap-3">
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

      {/* Srevox Service-Owner style Mute Modal */}
      <MuteDurationModal
        isOpen={muteModalOpen}
        onClose={() => {
          setMuteModalOpen(false);
          setActiveMuteAlertId(null);
        }}
        onConfirm={async (minutes) => {
          if (activeMuteAlertId) {
            await muteAlert(activeMuteAlertId, minutes);
          }
          setMuteModalOpen(false);
          setActiveMuteAlertId(null);
        }}
        title="Mute Resource Alert"
      />
    </div>
  );
}
