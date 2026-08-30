"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, CheckCircle, Loader2, AlertTriangle, Info, Plus, Save, ArrowLeft, BarChart3, BellOff, Bell, Trash2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { getUser, hasPermission } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import RecipientSelector from "@/components/services/RecipientSelector";
import MuteDurationModal from "@/components/services/MuteDurationModal";

const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? "bg-amber-500" : "bg-gray-200 dark:bg-slate-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
};

interface Channel {
  channel_id: string;
  name: string;
  type: string;
  channel_type?: string;
  created_at?: string;
}

interface ServiceOwner {
  service_owner_id: string;
  cluster_id: string;
  cluster_name: string;
  namespace?: string;
  pod_prefix?: string;
  user_id: string;
  user_ids?: string[];
  group_ids?: string[];
  owner_name: string;
  owner_email: string;
  channel_ids: string[];
  alert_source_channel_id?: string | null;
  alert_cc?: string | null;
  alert_bcc?: string | null;
  created_at: string;
  muted?: boolean;
  muted_ttl?: number | null;
}

export default function ServiceFeaturesPage() {
  const { success, error: toastError } = useToast();
  const user = getUser();
  const isAdmin = user?.role === "admin";
  const canAddServiceOwner = hasPermission(user, "addServiceOwner");

  const [alertSourceChannelId, setAlertSourceChannelId] = useState("");
  const [alertCc, setAlertCc] = useState("");
  const [alertBcc, setAlertBcc] = useState("");
  
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [services, setServices] = useState<ServiceOwner[]>([]);
  
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [notificationGroups, setNotificationGroups] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { confirm } = useConfirm();

  const [globalMuted, setGlobalMuted] = useState(false);
  const [globalMutedTtl, setGlobalMutedTtl] = useState<number | null>(null);
  const [globalMuteModalOpen, setGlobalMuteModalOpen] = useState(false);
  const [activeMuteServiceId, setActiveMuteServiceId] = useState<string | null>(null);

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allSelected = services.length > 0 && services.every(s => selectedIds.includes(s.service_owner_id));
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(services.map(s => s.service_owner_id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const { confirmed } = await confirm({
      title: `Delete ${selectedIds.length} Service${selectedIds.length > 1 ? "s" : ""}?`,
      message: `Are you sure you want to permanently delete the ${selectedIds.length} selected services? This action cannot be undone.`,
      confirmLabel: "Delete Selected",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await api.post("/api/service-owners/bulk-delete", { ids: selectedIds });
      success(`Successfully deleted ${selectedIds.length} services`);
      setSelectedIds([]);
      const servicesRes = await api.get("/api/service-owners");
      setServices(servicesRes.data.service_owners || []);
    } catch {
      toastError("Failed to delete selected services");
    }
  };

  const handleDeleteOne = async (id: string, name: string) => {
    const { confirmed } = await confirm({
      title: "Delete Service Routing?",
      message: `Are you sure you want to permanently delete the custom routing configuration for "${name}"? This action cannot be undone.`,
      confirmLabel: "Delete Mapping",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await api.post("/api/service-owners/bulk-delete", { ids: [id] });
      success(`Successfully deleted service routing for "${name}"`);
      setSelectedIds(prev => prev.filter(item => item !== id));
      const servicesRes = await api.get("/api/service-owners");
      setServices(servicesRes.data.service_owners || []);
    } catch {
      toastError("Failed to delete service routing");
    }
  };

  useEffect(() => {
    if (!canAddServiceOwner) return;

    setLoading(true);
    Promise.all([
      api.get("/api/service-owners/routing-defaults"),
      api.get("/api/channels"),
      api.get("/api/service-owners"),
      api.get("/api/users"),
      api.get("/api/groups"),
      api.get("/api/notification-groups"),
      api.get("/api/service-owners/mute-status")
    ])
      .then(([settingsRes, channelsRes, servicesRes, usersRes, groupsRes, notifGroupsRes, muteRes]) => {
        const org = settingsRes.data || {};
        const orgChannelId = org.default_alert_source_channel_id || "";
        const allChs = channelsRes.data.channels || [];
        setAllChannels(allChs);
        setAllUsers(usersRes.data.users || []);
        setAllGroups(groupsRes.data.groups || []);
        setNotificationGroups(notifGroupsRes.data.notification_groups || []);
        
        const filtered = allChs.filter(
          (c: any) => c.type === "email" && c.channel_type === "service_owner"
        );
        setChannels(filtered);
        
        setServices(servicesRes.data.service_owners || []);
        setGlobalMuted(muteRes.data.global_muted);
        setGlobalMutedTtl(muteRes.data.global_ttl);
        
        if (filtered.length === 1) {
          setAlertSourceChannelId(filtered[0].channel_id);
        } else if (filtered.length > 1) {
          const exists = filtered.some((c: any) => c.channel_id === orgChannelId);
          if (exists) {
            setAlertSourceChannelId(orgChannelId);
          } else {
            setAlertSourceChannelId(filtered[0].channel_id);
          }
        } else {
          setAlertSourceChannelId("");
        }

        setAlertCc(org.default_alert_cc || "");
        setAlertBcc(org.default_alert_bcc || "");
      })
      .catch((err) => {
        console.error("Failed to load service features settings", err);
        toastError(err?.response?.data?.detail || "Failed to load service feature settings");
      })
      .finally(() => setLoading(false));
  }, [canAddServiceOwner, toastError]);

  const submit = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.patch("/api/service-owners/routing-defaults", {
        default_alert_source_channel_id: alertSourceChannelId || null,
        default_alert_cc: alertCc || null,
        default_alert_bcc: alertBcc || null,
      });
      success("Settings saved", "Fallback alert routing settings have been saved successfully.");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to update service features settings");
      toastError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleMuteGlobal = async (minutes: number) => {
    try {
      await api.post("/api/service-owners/mute", { minutes });
      success(minutes > 0 ? `Service Owner alerts globally muted for ${minutes} minutes.` : "Service Owner alerts globally muted indefinitely.");
      const res = await api.get("/api/service-owners/mute-status");
      setGlobalMuted(res.data.global_muted);
      setGlobalMutedTtl(res.data.global_ttl);
    } catch (err: any) {
      toastError(err?.response?.data?.detail || "Failed to mute service alerts");
    }
  };

  const handleUnmuteGlobal = async () => {
    try {
      await api.post("/api/service-owners/unmute");
      success("Service Owner alerts globally unmuted.");
      const res = await api.get("/api/service-owners/mute-status");
      setGlobalMuted(res.data.global_muted);
      setGlobalMutedTtl(res.data.global_ttl);
    } catch (err: any) {
      toastError(err?.response?.data?.detail || "Failed to unmute service alerts");
    }
  };

  const handleMuteService = async (serviceOwnerId: string, minutes: number) => {
    try {
      await api.post(`/api/service-owners/${serviceOwnerId}/mute`, { minutes });
      success(minutes > 0 ? `Service muted for ${minutes} minutes.` : "Service muted indefinitely.");
      const res = await api.get("/api/service-owners");
      setServices(res.data.service_owners || []);
    } catch (err: any) {
      toastError(err?.response?.data?.detail || "Failed to mute service");
    }
  };

  const handleUnmuteService = async (serviceOwnerId: string) => {
    try {
      await api.post(`/api/service-owners/${serviceOwnerId}/unmute`);
      success("Service unmuted.");
      const res = await api.get("/api/service-owners");
      setServices(res.data.service_owners || []);
    } catch (err: any) {
      toastError(err?.response?.data?.detail || "Failed to unmute service");
    }
  };

  const getChannelBadge = (chId: string) => {
    const ch = allChannels.find(c => c.channel_id === chId);
    if (!ch) return null;
    
    let typeLabel = ch.type.toUpperCase();
    let colorClass = "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200 border-gray-200/80 dark:border-slate-700/80";
    if (ch.type === "slack" || ch.type === "webhook") {
      colorClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-450 border-emerald-100 dark:border-emerald-500/20";
    } else if (ch.type === "teams") {
      colorClass = "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-100 dark:border-blue-500/20";
    } else if (ch.type === "whatsapp") {
      colorClass = "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-100 dark:border-green-500/20";
    } else if (ch.type === "email") {
      colorClass = "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20";
    }

    return (
      <span key={chId} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${colorClass}`}>
        {ch.name} <span className="opacity-60 text-[9px]">({typeLabel})</span>
      </span>
    );
  };

  const resolveRecipientsPreview = (items: string[]) => {
    const resolved: { label: string; email?: string; type: "user" | "group" | "notification_group" | "email" }[] = [];
    
    items.forEach(item => {
      if (!item) return;
      const val = item.trim();
      if (val.includes("@")) {
        resolved.push({ label: val, email: val, type: "email" });
      } else if (val.startsWith("ngp")) {
        const ng = notificationGroups.find(g => g.group_id === val);
        if (ng) {
          const emails = Array.isArray(ng.emails) ? ng.emails : JSON.parse(ng.emails || "[]");
          resolved.push({ label: `Group: ${ng.name}`, email: emails.join(", "), type: "notification_group" });
        } else {
          resolved.push({ label: `Notification Group: ${val}`, type: "notification_group" });
        }
      } else if (val.startsWith("usr")) {
        const u = allUsers.find(user => user.user_id === val);
        if (u) {
          resolved.push({ label: u.full_name, email: u.email, type: "user" });
        } else {
          resolved.push({ label: `User: ${val}`, type: "user" });
        }
      } else {
        const g = allGroups.find(group => group.group_id === val);
        if (g) {
          resolved.push({ label: `RBAC Group: ${g.name}`, type: "group" });
        } else {
          resolved.push({ label: val, type: "email" });
        }
      }
    });
    
    return resolved;
  };

  const renderRecipientsBadges = (rawString: string, isDefault = false) => {
    const list = resolveRecipientsPreview(rawString.split(",").map(s => s.trim()).filter(Boolean));
    if (list.length === 0) return <span className="text-gray-400 dark:text-slate-500 italic text-[10px]">None</span>;
    
    return (
      <div className="flex flex-wrap gap-1 items-center">
        {list.map((item, idx) => {
          let badgeColor = "bg-gray-100 text-gray-805 dark:bg-slate-800/40 dark:text-slate-250 border-gray-200/80 dark:border-slate-700/80";
          if (item.type === "user") {
            badgeColor = "bg-indigo-50 text-indigo-705 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-100/45 dark:border-indigo-500/20";
          } else if (item.type === "group" || item.type === "notification_group") {
            badgeColor = "bg-blue-50 text-blue-705 dark:bg-blue-500/10 dark:text-blue-400 border-blue-100/45 dark:border-blue-500/20";
          }
          
          return (
            <span 
              key={idx} 
              className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border font-semibold ${badgeColor}`}
              title={item.email}
            >
              {item.label}
              {item.email && <span className="opacity-60 text-[9px] font-normal font-sans">({item.email})</span>}
            </span>
          );
        })}
        {isDefault && (
          <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50/70 dark:bg-indigo-500/10 px-1 py-0.5 rounded uppercase font-sans ml-1">Default</span>
        )}
      </div>
    );
  };

  if (!canAddServiceOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center w-full">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`addServiceOwner`) to manage service feature settings.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card p-6 min-h-[400px] flex items-center justify-center bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 animate-modal-slide-up" style={{ animationDuration: "0.2s" }}>
      {/* Back button and Analytics Link */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/services" className="inline-flex items-center gap-1.5 text-xs text-indigo-650 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-350 font-bold transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Services
        </Link>
        <Link href="/dashboard/services/features/metrics" className="btn-primary py-2 px-4 text-xs font-bold rounded-xl flex items-center gap-1.5 hover:scale-[1.005]">
          <BarChart3 className="w-4 h-4 text-white" /> View Service Analytics
        </Link>
      </div>

      {/* Description & Overview Panel */}
      <div className="card p-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/60">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Service Feature Settings</h2>
            <p className="text-xs text-gray-555 dark:text-slate-400">Configure alert routing rules and defaults for registered services</p>
          </div>
          {saved && (
            <span className="text-[10px] font-bold text-green-600 dark:text-green-400 flex items-center gap-1 bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 px-2 py-1 rounded-md">
              <CheckCircle className="w-3.5 h-3.5" /> Saved!
            </span>
          )}
        </div>

        {/* Info card describing the features */}
        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <h3 className="text-xs font-bold text-indigo-900 dark:text-indigo-300">About Service Owner Features</h3>
          </div>
          <p className="text-xs text-indigo-700 dark:text-indigo-400/90 leading-relaxed">
            Service Owner features enable ownership assignments for Kubernetes deployments and namespaces. 
            When a pod encounters issues or crashes, alerts are automatically routed to the responsible service owners.
          </p>
          <div className="text-[11px] text-indigo-750 dark:text-indigo-400/80 space-y-1.5 pl-6">
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-indigo-600">•</span>
              <span><strong>Workload Mapping:</strong> Group crashes and issues using target cluster, namespace, and pod patterns.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-indigo-600">•</span>
              <span><strong>Owner Alert Channels:</strong> Route notifications to distinct developers or Slack, Teams, Email, and WhatsApp channels.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-indigo-600">•</span>
              <span><strong>Fallback Protection:</strong> If a specific service lacks custom alert channels, the configurations below are used as fallbacks.</span>
            </div>
          </div>
        </div>

        {/* Fallback Configuration Options */}
        <div id="fallback-route-options" className="space-y-4 pt-2">
          <h3 className="text-xs font-bold text-gray-855 dark:text-slate-200 uppercase tracking-wider">Fallback Route Options</h3>
          
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              Default Sender Channel (From)
            </label>
            {channels.length === 0 ? (
              <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-gray-150 dark:border-slate-800/60">
                <p className="text-xs text-gray-555 dark:text-slate-400">
                  No Service Owner email channels found.
                </p>
                <div>
                  <a
                    href="/settings/channels"
                    className="btn-primary py-1.5 px-3.5 text-xs font-bold inline-flex items-center gap-1.5 rounded-lg text-center text-white"
                  >
                    Go to Channels page
                  </a>
                </div>
              </div>
            ) : channels.length === 1 ? (
              <div className="flex gap-2">
                <div className="flex-1 input bg-gray-50 dark:bg-slate-800/40 text-xs py-2.5 px-3 rounded-xl border border-gray-200 dark:border-slate-800/80 font-semibold text-gray-855 dark:text-slate-250 cursor-not-allowed select-none">
                  {channels[0].name}
                </div>
                <a
                  href="/settings/channels"
                  className="px-3.5 bg-gray-55 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1 border border-gray-200/80 dark:border-slate-750 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                  Add
                </a>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  className="input text-xs flex-1"
                  value={alertSourceChannelId}
                  onChange={(e) => setAlertSourceChannelId(e.target.value)}
                >
                  {channels.map((ch) => (
                    <option key={ch.channel_id} value={ch.channel_id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
                <a
                  href="/settings/channels"
                  className="px-3.5 bg-gray-55 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1 border border-gray-200/80 dark:border-slate-750 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                  Add
                </a>
              </div>
            )}
            <p className="text-xs text-gray-400 dark:text-slate-500">
              The default SMTP mail channel used to send alerts to owners.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              Default CC Recipients
            </label>
            <RecipientSelector
              value={alertCc}
              onChange={setAlertCc}
              allUsers={allUsers}
              allGroups={allGroups}
              notificationGroups={notificationGroups}
              placeholder="Select users, groups, or type email to CC..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              Default BCC Recipients
            </label>
            <RecipientSelector
              value={alertBcc}
              onChange={setAlertBcc}
              allUsers={allUsers}
              allGroups={allGroups}
              notificationGroups={notificationGroups}
              placeholder="Select users, groups, or type email to BCC..."
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl px-3 py-2 text-sm text-red-650 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="btn-primary min-w-[150px] justify-center py-2.5 rounded-xl font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Defaults
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Global Service Alert Muting Card */}
      <div id="global-service-muting" className="card p-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
              <BellOff className="w-4.5 h-4.5 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Global Service Alert Muting</h3>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Temporarily silence or disable all incoming service owner notifications</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${globalMuted ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20" : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20"}`}>
              {globalMuted ? `MUTED ${globalMutedTtl ? `(Expires in ${Math.ceil(globalMutedTtl / 60)}m)` : "(Indefinitely)"}` : "ACTIVE"}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-gray-500 dark:text-slate-400 max-w-xl">
            When global muting is enabled, no alerts will be dispatched to any service owner channels (Email, Slack, Teams, etc.). Rule-based cluster alerts are unaffected.
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] font-bold text-gray-400 dark:text-slate-550 uppercase tracking-wider">
              {globalMuted ? "Muted" : "Active"}
            </span>
            <ToggleSwitch
              checked={globalMuted}
              onChange={async () => {
                if (globalMuted) {
                  await handleUnmuteGlobal();
                } else {
                  setGlobalMuteModalOpen(true);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Service Channels Usage */}
      <div id="service-route-mappings" className="card p-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-gray-850 dark:text-slate-200 uppercase tracking-wider">Service Route Mappings & Channels</h3>
            <p className="text-[11px] text-gray-555 dark:text-slate-455 leading-relaxed mt-0.5">
              This table lists all registered microservices, their custom email routing configurations, and their active alert dispatch channels.
            </p>
          </div>
          {selectedIds.length > 0 && hasPermission(user, "deleteServiceOwner") && (
            <button
              onClick={handleBulkDelete}
              className="btn-danger flex items-center gap-1.5 text-xs py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition shrink-0"
            >
              <Trash2 className="w-4 h-4" /> Delete Selected ({selectedIds.length})
            </button>
          )}
        </div>

        {services.length === 0 ? (
          <div className="text-center py-8 bg-gray-55 dark:bg-slate-900/30 rounded-xl border border-gray-150 dark:border-slate-800/40 text-xs text-gray-400">
            No registered services found. Add services on the main Services page.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-150 dark:border-slate-800 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  {hasPermission(user, "deleteServiceOwner") && (
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        checked={services.length > 0 && services.every(s => selectedIds.includes(s.service_owner_id))}
                        onChange={handleSelectAll}
                        title="Select All Services"
                      />
                    </th>
                  )}
                  <th className="py-2.5 px-3">Service Workload</th>
                  <th className="py-2.5 px-3">SMTP Sender (From)</th>
                  <th className="py-2.5 px-3">CC & BCC Overrides</th>
                  <th className="py-2.5 px-3">Active Dispatch Channels</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {services.map((svc) => {
                  const senderChId = svc.alert_source_channel_id;
                  const customSender = allChannels.find(c => c.channel_id === senderChId);
                  const fallbackSender = allChannels.find(c => c.channel_id === alertSourceChannelId);
                  
                  return (
                    <tr key={svc.service_owner_id} className="hover:bg-gray-55/40 dark:hover:bg-slate-900/20 transition-colors">
                      {hasPermission(user, "deleteServiceOwner") && (
                        <td className="py-3 px-3 w-8 select-none">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                            checked={selectedIds.includes(svc.service_owner_id)}
                            onChange={() => handleSelectOne(svc.service_owner_id)}
                          />
                        </td>
                      )}
                      <td className="py-3 px-3">
                        <div className="font-bold text-gray-850 dark:text-slate-200">
                          {svc.pod_prefix || "All Pods"}
                        </div>
                        <div className="text-[10px] text-gray-450 dark:text-slate-500">
                          Namespace: {svc.namespace || "All"} | Cluster: {svc.cluster_name}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {senderChId ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-450">
                            {customSender ? customSender.name : "Custom Channel"}
                          </span>
                        ) : (
                          <span className="text-gray-450 dark:text-slate-500 italic">
                            Default: {fallbackSender ? fallbackSender.name : "None configured"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 space-y-1">
                        <div className="flex items-start gap-1">
                          <span className="text-[10px] text-gray-400 font-bold uppercase shrink-0 mt-0.5">CC:</span>
                          <div className="flex-1">
                            {svc.alert_cc 
                              ? renderRecipientsBadges(svc.alert_cc, false)
                              : (alertCc 
                                  ? renderRecipientsBadges(alertCc, true)
                                  : <span className="text-gray-400 dark:text-slate-500 italic text-[10px]">None</span>
                                )
                            }
                          </div>
                        </div>
                        <div className="flex items-start gap-1">
                          <span className="text-[10px] text-gray-400 font-bold uppercase shrink-0 mt-0.5">BCC:</span>
                          <div className="flex-1">
                            {svc.alert_bcc 
                              ? renderRecipientsBadges(svc.alert_bcc, false)
                              : (alertBcc 
                                  ? renderRecipientsBadges(alertBcc, true)
                                  : <span className="text-gray-400 dark:text-slate-500 italic text-[10px]">None</span>
                                )
                            }
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1.5">
                          {svc.channel_ids && svc.channel_ids.length > 0 ? (
                            svc.channel_ids.map(id => getChannelBadge(id))
                          ) : (
                            <span className="text-[10px] text-gray-405 dark:text-slate-500 italic">No channels assigned</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-3">
                          {svc.muted && (
                            <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-705 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 shrink-0">
                              🔕 {svc.muted_ttl ? `${Math.ceil(svc.muted_ttl / 60)}m left` : "Muted"}
                            </span>
                          )}
                          <ToggleSwitch
                            checked={!!svc.muted}
                            onChange={async () => {
                              if (svc.muted) {
                                await handleUnmuteService(svc.service_owner_id);
                              } else {
                                setActiveMuteServiceId(svc.service_owner_id);
                              }
                            }}
                          />
                          {hasPermission(user, "deleteServiceOwner") && (
                            <button
                              type="button"
                              onClick={() => handleDeleteOne(svc.service_owner_id, svc.pod_prefix || "All Pods")}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150"
                              title="Delete service mapping"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MuteDurationModal
        isOpen={globalMuteModalOpen}
        onClose={() => setGlobalMuteModalOpen(false)}
        onConfirm={async (minutes) => {
          setGlobalMuteModalOpen(false);
          await handleMuteGlobal(minutes);
        }}
        title="Mute All Services"
      />

      <MuteDurationModal
        isOpen={activeMuteServiceId !== null}
        onClose={() => setActiveMuteServiceId(null)}
        onConfirm={async (minutes) => {
          if (activeMuteServiceId) {
            await handleMuteService(activeMuteServiceId, minutes);
          }
          setActiveMuteServiceId(null);
        }}
        title="Mute Service Alerts"
      />
    </div>
  );
}
