"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, Loader2, Cpu, Shield, Activity, AlertTriangle, 
  Check, Mail, Users, Bell, BellOff, Search, X, MessageSquare, Info, AlertCircle,
  ChevronDown, ChevronUp, RefreshCw, Settings, Pencil, Plus, Filter
} from "lucide-react";
import { api, acknowledgeIncident, resolveIncident, bulkResolveIncidents } from "@/lib/api";
import { timeAgo, Incident, AlertRule } from "@/lib/utils";
import { getUser, hasPermission } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { createPortal } from "react-dom";
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

interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
}

interface Channel {
  channel_id: string;
  name: string;
  type: string;
  enabled: boolean;
  channel_type?: string;
  is_global_default?: boolean;
}

interface ActivityLog {
  activity_log_id: string;
  org_id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  action: string;
  resource?: string;
  resource_id?: string;
  metadata?: any;
  created_at: string;
}

interface AlertRecipientConfig {
  user_id: string;
  delivery_methods: ("mail" | "teams" | "slack")[];
}

interface ServiceOwner {
  service_owner_id: string; 
  cluster_id: string; 
  cluster_name: string;
  namespace?: string; 
  pod_prefix?: string;
  user_id: string; 
  user_ids: string[];
  owners: User[];
  owner_name: string; 
  owner_email: string;
  channel_ids: string[]; 
  channel_id?: string;
  created_at: string;

  // New alert routing config fields
  alert_source_channel_id?: string;
  alert_recipients?: AlertRecipientConfig[];
  alert_cc?: string;
  alert_bcc?: string;
  alert_mail_template_id?: string;
  alert_crash_reasons?: string[];

  group_ids?: string[];
  groups?: { group_id: string; name: string; description?: string }[];

  incidents?: Incident[];
  rules?: AlertRule[];
  activities?: ActivityLog[];
  muted?: boolean;
  muted_ttl?: number | null;
}

export default function ServiceDetailPage() {
  const { id } = useParams();
  const { success, error } = useToast();
  const me = getUser();

  const [service, setService] = useState<ServiceOwner | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allGroups, setAllGroups] = useState<{ group_id: string; name: string; description?: string }[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [organization, setOrganization] = useState<any>(null);
  const [showConfigure, setShowConfigure] = useState(false);
  const [configTab, setConfigTab] = useState<"owners" | "channels">("owners");

  // Owner Assignment State
  const [assignedOwnerIds, setAssignedOwnerIds] = useState<string[]>([]);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [savingOwners, setSavingOwners] = useState(false);

  // Admin Channels State
  const [assignedChannelIds, setAssignedChannelIds] = useState<string[]>([]);
  const [savingChannels, setSavingChannels] = useState(false);
  const [alertCrashReasons, setAlertCrashReasons] = useState<string[]>([]);
  const [alertSourceChannelId, setAlertSourceChannelId] = useState<string>("");
  const [alertCc, setAlertCc] = useState<string>("");
  const [alertBcc, setAlertBcc] = useState<string>("");
  const [notificationGroups, setNotificationGroups] = useState<any[]>([]);

  // SMTP Inline Form State
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [smtpName, setSmtpName] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [loadingChannelConfig, setLoadingChannelConfig] = useState(false);
  const [savingChannelDetails, setSavingChannelDetails] = useState(false);

  // Modal State
  const [showAllActivitiesModal, setShowAllActivitiesModal] = useState(false);
  const [muteModalOpen, setMuteModalOpen] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingActivities, setRefreshingActivities] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadServiceDetails(),
        loadOrgUsers(),
        loadOrgGroups(),
        loadOrgChannels(),
        loadNotificationGroups()
      ]);
      success("Refreshed", "Loaded latest service details and activities.");
    } catch (err) {
      console.error(err);
      error("Failed to refresh service details.");
    } finally {
      setRefreshing(false);
    }
  };
  const handleRefreshActivities = async () => {
    setRefreshingActivities(true);
    try {
      await loadServiceDetails();
      success("Activities Refreshed", "Loaded latest service activity logs.");
    } catch (err) {
      console.error(err);
      error("Failed to refresh activities.");
    } finally {
      setRefreshingActivities(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMuteService = async (minutes: number) => {
    try {
      await api.post(`/api/service-owners/${id}/mute`, { minutes });
      success(minutes > 0 ? `Service muted for ${minutes} minutes.` : "Service muted indefinitely.");
      await loadServiceDetails();
    } catch {
      error("Failed to mute service");
    }
  };

  const handleUnmuteService = async () => {
    try {
      await api.post(`/api/service-owners/${id}/unmute`);
      success("Service unmuted.");
      await loadServiceDetails();
    } catch {
      error("Failed to unmute service");
    }
  };

  const [incidentStatusFilter, setIncidentStatusFilter] = useState<"active" | "resolved" | "all">("active");

  const handleAcknowledgeIncident = async (incidentId: string) => {
    try {
      await acknowledgeIncident(incidentId);
      success("Incident acknowledged", "Marked incident as acknowledged.");
      await loadServiceDetails();
    } catch (err: any) {
      console.error(err);
      error("Failed to acknowledge incident.");
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    try {
      await resolveIncident(incidentId);
      success("Incident resolved", "Incident has been closed successfully.");
      await loadServiceDetails();
    } catch (err: any) {
      console.error(err);
      error("Failed to resolve incident.");
    }
  };

  const handleResolveAllIncidents = async () => {
    if (!service || !service.incidents || service.incidents.length === 0) return;
    const activeIds = service.incidents
      .filter((i: any) => i.status !== "resolved")
      .map((i: any) => i.incident_id);
    if (activeIds.length === 0) return;
    try {
      await bulkResolveIncidents(activeIds);
      success("Incidents resolved", "All active incidents for this service have been resolved.");
      await loadServiceDetails();
    } catch (err: any) {
      console.error(err);
      error("Failed to resolve incidents.");
    }
  };

  const loadServiceDetails = async (orgOverride?: any) => {
    try {
      const res = await api.get(`/api/service-owners/${id}`);
      setService(res.data);
      setAssignedOwnerIds(res.data.user_ids || []);
      setAssignedGroupIds(res.data.group_ids || []);
      setAssignedChannelIds(res.data.channel_ids || []);
      setAlertCrashReasons(res.data.alert_crash_reasons || []);
      setAlertSourceChannelId(res.data.alert_source_channel_id || "");
      
      const currentOrg = orgOverride !== undefined ? orgOverride : organization;
      setAlertCc(res.data.alert_cc ? res.data.alert_cc : (currentOrg?.default_alert_cc || ""));
      setAlertBcc(res.data.alert_bcc ? res.data.alert_bcc : (currentOrg?.default_alert_bcc || ""));

      // Audit view action
      if (res.data && me) {
        fetch("/api/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            org_id: res.data.org_id || me.org_id || "default",
            user_id: me.user_id,
            action: "view_service_details",
            resource: "service",
            resource_id: id,
            metadata: {
              pod_prefix: res.data.pod_prefix,
              namespace: res.data.namespace,
              cluster_name: res.data.cluster_name,
              path: window.location.pathname
            }
          })
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Failed to load service", err);
      error("Failed to load service details.");
    }
  };

  const loadOrgUsers = async () => {
    try {
      const res = await api.get("/api/users");
      setAllUsers(res.data.users || []);
    } catch (err) {
      console.error("Failed to load organization users", err);
    }
  };

  const loadOrgGroups = async () => {
    try {
      const res = await api.get("/api/groups");
      setAllGroups(res.data.groups || []);
    } catch (err) {
      console.error("Failed to load organization groups", err);
    }
  };

  const loadOrgChannels = async () => {
    try {
      const res = await api.get("/api/channels");
      setChannels(res.data.channels || []);
    } catch (err) {
      console.error("Failed to load channels", err);
    }
  };

  const loadNotificationGroups = async () => {
    try {
      const res = await api.get("/api/notification-groups");
      setNotificationGroups(res.data.groups || res.data || []);
    } catch (err) {
      console.error("Failed to load notification groups", err);
    }
  };

  const loadOrgDetails = async () => {
    try {
      const res = await api.get("/api/service-owners/routing-defaults");
      const org = res.data || null;
      setOrganization(org);
      return org;
    } catch (err) {
      console.error("Failed to load organization service routing defaults details", err);
      return null;
    }
  };

  const initData = async () => {
    setLoading(true);
    try {
      const org = await loadOrgDetails();
      await Promise.all([
        loadServiceDetails(org),
        loadOrgUsers(),
        loadOrgGroups(),
        loadOrgChannels(),
        loadNotificationGroups()
      ]);
    } catch (err) {
      console.error("Failed to initialize service details page data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      initData();
    }
  }, [id]);

  const resetFormState = () => {
    if (!service) return;
    setAssignedOwnerIds(service.user_ids || []);
    setAssignedGroupIds(service.group_ids || []);
    setAssignedChannelIds(service.channel_ids || []);
    setAlertCrashReasons(service.alert_crash_reasons || []);
    setAlertSourceChannelId(service.alert_source_channel_id || "");
    setAlertCc(service.alert_cc ? service.alert_cc : (organization?.default_alert_cc || ""));
    setAlertBcc(service.alert_bcc ? service.alert_bcc : (organization?.default_alert_bcc || ""));
    setOwnerSearch("");
    setGroupSearch("");
  };

  useEffect(() => {
    if (!showConfigure) {
      resetFormState();
      setConfigTab("owners");
    }
  }, [showConfigure]);

  useEffect(() => {
    const serviceOwnerChannels = channels.filter(
      c => c.type === "email" && c.channel_type === "service_owner"
    );
    if (serviceOwnerChannels.length > 0) {
      if (!organization?.default_alert_source_channel_id) {
        const exists = serviceOwnerChannels.some(c => c.channel_id === alertSourceChannelId);
        if (!exists) {
          setAlertSourceChannelId(serviceOwnerChannels[0].channel_id);
        }
      } else {
        if (alertSourceChannelId !== "") {
          const exists = serviceOwnerChannels.some(c => c.channel_id === alertSourceChannelId);
          if (!exists) {
            setAlertSourceChannelId("");
          }
        }
      }
    }
  }, [channels, alertSourceChannelId, organization]);

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
    if (list.length === 0) return <span className="text-gray-400 dark:text-slate-500 italic">None</span>;
    
    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {list.map((item, idx) => {
          let badgeColor = "bg-gray-100 text-gray-800 dark:bg-slate-800/40 dark:text-slate-200 border-gray-200/80 dark:border-slate-700/80";
          if (item.type === "user") {
            badgeColor = "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-100/45 dark:border-indigo-500/20";
          } else if (item.type === "group" || item.type === "notification_group") {
            badgeColor = "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-100/45 dark:border-blue-500/20";
          }
          
          return (
            <span 
              key={idx} 
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border font-semibold ${badgeColor}`}
              title={item.email}
            >
              {item.label}
              {item.email && item.email !== item.label && (
                <span className="opacity-60 text-[10px] font-normal font-sans">({item.email})</span>
              )}
            </span>
          );
        })}
        {isDefault && (
          <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase font-sans ml-1">Default</span>
        )}
      </div>
    );
  };

  // Handle saving owners
  const saveOwners = async () => {
    if (!hasPermission(me, "addServiceOwner")) {
      error("You do not have permission to manage service owners");
      return;
    }
    setSavingOwners(true);
    try {
      await api.patch(`/api/service-owners/${id}`, {
        user_ids: assignedOwnerIds,
        group_ids: assignedGroupIds
      });
      success("Owners assigned successfully", "Owner list has been updated.");
      await loadServiceDetails();
      setShowConfigure(false);
    } catch (err: any) {
      console.error("Failed to update owners", err);
      error(err.response?.data?.detail || "Failed to update service owners.");
    } finally {
      setSavingOwners(false);
    }
  };

  // Toggle owner ID
  const toggleOwner = (userId: string) => {
    setAssignedOwnerIds(prev => 
      prev.includes(userId) ? prev.filter(uid => uid !== userId) : [...prev, userId]
    );
  };

  // Toggle group ID
  const toggleGroup = (groupId: string) => {
    setAssignedGroupIds(prev => 
      prev.includes(groupId) ? prev.filter(gid => gid !== groupId) : [...prev, groupId]
    );
  };

  // Toggle channel ID
  const toggleChannel = (channelId: string) => {
    setAssignedChannelIds(prev => 
      prev.includes(channelId) ? prev.filter(cid => cid !== channelId) : [...prev, channelId]
    );
  };

  // Handle saving channels
  const saveChannels = async () => {
    if (!hasPermission(me, "addServiceOwner")) {
      error("You do not have permission to manage service channels");
      return;
    }
    setSavingChannels(true);
    try {
      const cleanCc = alertCc === organization?.default_alert_cc ? null : (alertCc || null);
      const cleanBcc = alertBcc === organization?.default_alert_bcc ? null : (alertBcc || null);
      const cleanSourceChannel = alertSourceChannelId === organization?.default_alert_source_channel_id ? null : (alertSourceChannelId || null);

      await api.patch(`/api/service-owners/${id}`, {
        channel_ids: assignedChannelIds,
        alert_crash_reasons: alertCrashReasons,
        alert_source_channel_id: cleanSourceChannel,
        alert_cc: cleanCc,
        alert_bcc: cleanBcc
      });
      success("Notification channels updated", "Admin channels and routing options have been configured successfully.");
      await loadServiceDetails();
      setShowConfigure(false);
    } catch (err: any) {
      console.error("Failed to update channels", err);
      error(err.response?.data?.detail || "Failed to update notification channels.");
    } finally {
      setSavingChannels(false);
    }
  };

  const startEditChannel = async (channelId: string) => {
    setLoadingChannelConfig(true);
    setEditingChannelId(channelId);
    try {
      const res = await api.get(`/api/channels/${channelId}`);
      const config = res.data.config || {};
      setSmtpName(res.data.name || "");
      setSmtpHost(config.host || "");
      setSmtpPort(String(config.port || "587"));
      setSmtpUsername(config.username || "");
      setSmtpPassword(config.password || "");
    } catch (err) {
      console.error("Failed to load channel credentials", err);
      error("Failed to load channel settings.");
      setEditingChannelId(null);
    } finally {
      setLoadingChannelConfig(false);
    }
  };

  const startCreateChannel = () => {
    setEditingChannelId("new");
    setSmtpName("");
    setSmtpHost("");
    setSmtpPort("587");
    setSmtpUsername("");
    setSmtpPassword("");
  };

  const cancelChannelEdit = () => {
    setEditingChannelId(null);
  };

  const saveChannelDetails = async () => {
    if (!smtpName || !smtpHost || !smtpPort || !smtpUsername || !smtpPassword) {
      error("All SMTP fields are required");
      return;
    }
    setSavingChannelDetails(true);
    try {
      const payload = {
        name: smtpName,
        type: "email",
        config: {
          host: smtpHost,
          port: Number(smtpPort) || 587,
          username: smtpUsername,
          password: smtpPassword
        }
      };

      if (editingChannelId === "new") {
        const res = await api.post("/api/channels", payload);
        const newChanId = res.data.channel_id;
        success("Email channel created", `Successfully created and saved channel "${smtpName}"`);
        setAssignedChannelIds(prev => [...prev, newChanId]);
      } else {
        await api.patch(`/api/channels/${editingChannelId}`, payload);
        success("Email channel updated", `Successfully updated channel "${smtpName}"`);
      }
      
      setEditingChannelId(null);
      await loadOrgChannels();
      await loadServiceDetails();
    } catch (err: any) {
      console.error("Failed to save channel details", err);
      error(err.response?.data?.detail || "Failed to save email channel settings.");
    } finally {
      setSavingChannelDetails(false);
    }
  };

  const getDotColorClass = (action: string) => {
    switch (action) {
      case "service_created":
        return "bg-[#7b2fff]"; // Purple
      case "owner_assigned":
        return "bg-[#10b981]"; // Green
      case "owner_removed":
        return "bg-[#f43f5e]"; // Rose/Red
      case "alert_sent":
        return "bg-[#f97316]"; // Orange
      default:
        return "bg-slate-400";
    }
  };

  const resolveChannelName = (channelId: string | null) => {
    if (!channelId) return "None";
    const found = channels.find(c => c.channel_id === channelId);
    return found ? `${found.name} (${found.type.toUpperCase()})` : channelId;
  };

  const resolveUserName = (userId: string | null) => {
    if (!userId) return "None";
    const found = allUsers.find(u => u.user_id === userId);
    return found ? found.full_name : userId;
  };

  const formatValueDiff = (field: string, diff: any, resolver?: (val: any) => string) => {
    if (diff && typeof diff === "object" && "old" in diff && "new" in diff) {
      const oldStr = resolver ? resolver(diff.old) : (diff.old !== null && diff.old !== undefined ? String(diff.old) : "None");
      const newStr = resolver ? resolver(diff.new) : (diff.new !== null && diff.new !== undefined ? String(diff.new) : "None");
      return `${field}: ${oldStr} → ${newStr}`;
    }
    return null;
  };

  const getMetadata = (act: ActivityLog) => {
    if (!act.metadata) return {};
    if (typeof act.metadata === "string") {
      try {
        return JSON.parse(act.metadata);
      } catch {
        return {};
      }
    }
    return act.metadata;
  };

  const getActivityTitle = (act: ActivityLog) => {
    const meta = getMetadata(act);
    switch (act.action) {
      case "service_created":
        return "Service registered";
      case "owner_assigned":
        return `Owner assigned — ${meta?.owner_name || "User"}`;
      case "owner_removed":
        return `Owner removed — ${meta?.owner_name || "User"}`;
      case "alert_sent":
        return `Alert sent — ${meta?.severity || "WARNING"} . ${meta?.recipient || ""}`;
      case "service_updated": {
        const changes: string[] = [];
        const changesObj = meta?.changes || meta || {};

        if (changesObj.alert_source_channel_id !== undefined) {
          const diff = formatValueDiff("Channel", changesObj.alert_source_channel_id, resolveChannelName);
          changes.push(diff || (changesObj.alert_source_channel_id ? "source channel updated" : "source channel cleared"));
        }
        if (changesObj.alert_cc !== undefined) {
          const diff = formatValueDiff("CC", changesObj.alert_cc);
          changes.push(diff || "CC updated");
        }
        if (changesObj.alert_bcc !== undefined) {
          const diff = formatValueDiff("BCC", changesObj.alert_bcc);
          changes.push(diff || "BCC updated");
        }
        if (changesObj.alert_mail_template_id !== undefined) {
          const diff = formatValueDiff("Template", changesObj.alert_mail_template_id);
          changes.push(diff || "email template updated");
        }
        if (changesObj.alert_recipients !== undefined) {
          const raw = changesObj.alert_recipients;
          if (raw && typeof raw === "object" && "old" in raw && "new" in raw) {
            const oldLen = Array.isArray(raw.old) ? raw.old.length : 0;
            const newLen = Array.isArray(raw.new) ? raw.new.length : 0;
            changes.push(`Recipients: ${oldLen} → ${newLen} active`);
          } else {
            changes.push("recipients list updated");
          }
        }
        if (changesObj.user_ids !== undefined) {
          const raw = changesObj.user_ids;
          if (raw && typeof raw === "object" && "old" in raw && "new" in raw) {
            const oldLen = Array.isArray(raw.old) ? raw.old.length : 0;
            const newLen = Array.isArray(raw.new) ? raw.new.length : 0;
            changes.push(`Owners: ${oldLen} → ${newLen} assigned`);
          } else {
            changes.push("assigned owners list updated");
          }
        }

        if (changes.length > 0) {
          const joined = changes.join(", ");
          return joined.charAt(0).toUpperCase() + joined.slice(1);
        }
        return "Service configuration updated";
      }
      default:
        return act.action;
    }
  };

  const getActivitySubtitle = (act: ActivityLog) => {
    const timeDisplay = timeAgo(act.created_at);
    const userDisplay = act.user_name || "System";
    return `${timeDisplay} · by ${userDisplay}`;
  };

  const renderActivityIcon = (action: string) => {
    switch (action) {
      case "service_created":
        return (
          <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-150 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Cpu className="w-3.5 h-3.5" />
          </div>
        );
      case "owner_assigned":
        return (
          <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-150 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Users className="w-3.5 h-3.5" />
          </div>
        );
      case "owner_removed":
        return (
          <div className="w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-150 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <X className="w-3.5 h-3.5" />
          </div>
        );
      case "alert_sent":
        return (
          <div className="w-7 h-7 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-150 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Bell className="w-3.5 h-3.5" />
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400">
            <Activity className="w-3.5 h-3.5" />
          </div>
        );
    }
  };

  const renderActivityChanges = (act: ActivityLog) => {
    if (act.action !== "service_updated") return null;
    const meta = getMetadata(act);
    const changesObj = meta?.changes || meta || {};
    const entries = Object.entries(changesObj);
    if (entries.length === 0) return null;

    return (
      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-gray-50/30 dark:bg-slate-900/15 p-3 rounded-2xl border border-gray-150/60 dark:border-slate-800/50 text-[10px] font-mono leading-relaxed max-w-2xl">
        {entries.map(([key, diff]: [string, any]) => {
          let fieldName = key;
          let oldVal = "None";
          let newVal = "None";

          const resolver = key === "alert_source_channel_id" ? resolveChannelName : undefined;

          if (diff && typeof diff === "object" && "old" in diff && "new" in diff) {
            oldVal = resolver ? resolver(diff.old) : (diff.old !== null && diff.old !== undefined ? String(diff.old) : "None");
            newVal = resolver ? resolver(diff.new) : (diff.new !== null && diff.new !== undefined ? String(diff.new) : "None");
          } else {
            newVal = resolver ? resolver(diff) : (diff !== null && diff !== undefined ? String(diff) : "None");
          }

          switch (key) {
            case "alert_source_channel_id":
              fieldName = "Source Channel";
              break;
            case "alert_cc":
              fieldName = "CC Targets";
              break;
            case "alert_bcc":
              fieldName = "BCC Targets";
              break;
            case "alert_mail_template_id":
              fieldName = "Mail Template";
              break;
            case "alert_recipients":
              fieldName = "Recipients";
              if (diff && typeof diff === "object" && "old" in diff) {
                oldVal = `${Array.isArray(diff.old) ? diff.old.length : 0} configured`;
                newVal = `${Array.isArray(diff.new) ? diff.new.length : 0} configured`;
              } else {
                newVal = `${Array.isArray(diff) ? diff.length : 0} configured`;
              }
              break;
            case "user_ids":
              fieldName = "Owners";
              if (diff && typeof diff === "object" && "old" in diff) {
                oldVal = `${Array.isArray(diff.old) ? diff.old.length : 0} assigned`;
                newVal = `${Array.isArray(diff.new) ? diff.new.length : 0} assigned`;
              } else {
                newVal = `${Array.isArray(diff) ? diff.length : 0} assigned`;
              }
              break;
          }

          return (
            <div key={key} className="flex flex-col gap-1 pb-1 last:pb-0">
              <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider">{fieldName}</span>
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400 mt-0.5 min-w-0">
                <span className="bg-red-500/5 dark:bg-red-500/10 text-red-600 dark:text-red-400/90 px-1.5 py-0.5 rounded border border-red-500/10 truncate max-w-[200px]" title={oldVal}>
                  {oldVal}
                </span>
                <span className="text-gray-400 shrink-0">→</span>
                <span className="bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400/90 px-1.5 py-0.5 rounded border border-emerald-500/10 truncate max-w-[200px]" title={newVal}>
                  {newVal}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const filteredUsersForOwner = allUsers.filter(u => 
    !ownerSearch || 
    u.full_name.toLowerCase().includes(ownerSearch.toLowerCase()) || 
    u.email.toLowerCase().includes(ownerSearch.toLowerCase())
  );

  const filteredGroupsForOwner = allGroups.filter(g =>
    !groupSearch ||
    g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
    (g.description && g.description.toLowerCase().includes(groupSearch.toLowerCase()))
  );

  const ownersListToDisplay = allUsers.filter(u => service?.user_ids?.includes(u.user_id));
  const groupsListToDisplay = allGroups.filter(g => service?.group_ids?.includes(g.group_id));
  const channelsListToDisplay = channels.filter(c => c.type === "email" && service?.channel_ids?.includes(c.channel_id));
  const emailChannels = channels.filter(c => c.type === "email");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs text-gray-500 dark:text-slate-400">Loading service details...</span>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="text-center py-20 bg-white dark:bg-[#13151f] rounded-3xl border border-gray-150 dark:border-slate-800/80 p-8 shadow-sm max-w-lg mx-auto">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Service Not Found</h1>
        <p className="text-xs text-gray-500 mt-2">The service catalog does not contain record {id}. It may have been deleted.</p>
        <Link href="/dashboard/services" className="btn-primary mt-6 inline-flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Services
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link 
          href="/dashboard/services" 
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 
          Back to Services
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-500" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {service.pod_prefix || "*"}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              <span className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 px-2.5 py-1 rounded-lg font-semibold">
                <Cpu className="w-3 h-3 text-indigo-500" />
                Cluster: {service.cluster_name || service.cluster_id}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 px-2.5 py-1 rounded-lg font-semibold">
                <Shield className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                Namespace: {service.namespace || "All Namespaces"}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100/50 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg font-mono font-bold">
                ID: {service.service_owner_id}
              </span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-gray-700 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white bg-gray-100 hover:bg-gray-200/80 dark:bg-slate-800/60 dark:hover:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-xl transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-500" : "text-gray-500"}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={() => setShowConfigure(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-gray-700 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white bg-gray-100 hover:bg-gray-200/80 dark:bg-slate-800/60 dark:hover:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-xl transition-all"
            >
              <Settings className="w-3.5 h-3.5 text-gray-500" />
              Configure
            </button>
            <button
              onClick={() => setShowActivities(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/15"
            >
              <Activity className="w-3.5 h-3.5" />
              Show Service Activity
            </button>
          </div>
        </div>

      {service.muted && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-3 text-amber-800 dark:text-amber-300 animate-fade-in shadow-sm">
          <div className="flex items-center gap-2.5">
            <BellOff className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold">This Service is Currently Muted</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                Notifications routed to this service's owners and channels are currently silenced. 
                {service.muted_ttl ? ` Expires in ${Math.ceil(service.muted_ttl / 60)} minutes.` : " Muted indefinitely."}
              </p>
            </div>
          </div>
          <button
            onClick={handleUnmuteService}
            className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-xl transition-all shadow-sm shrink-0"
          >
            Unmute Alerts
          </button>
        </div>
      )}
    </div>

      {/* Main Content Area: Assigned Owners & Notification Routing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assigned Owners Card */}
        <div className="lg:col-span-2 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full min-h-[360px]">
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Assigned Owners</h3>
                <span className="text-[11px] text-gray-400 dark:text-slate-500 font-semibold bg-gray-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                  {ownersListToDisplay.length} Owners · {groupsListToDisplay.length} Groups
                </span>
              </div>

              {ownersListToDisplay.length === 0 && groupsListToDisplay.length === 0 ? (
                <div className="py-12 text-center bg-gray-50/20 dark:bg-slate-900/5 rounded-xl border border-dashed border-gray-200 dark:border-slate-800 flex flex-col justify-center items-center flex-1 min-h-[220px]">
                  <Users className="w-8 h-8 text-gray-350 dark:text-slate-700 mx-auto mb-2" />
                  <p className="font-semibold text-gray-555 dark:text-slate-400 text-xs">No owners or groups assigned</p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                    Assign owners or groups to receive alerts and manage this service prefix.
                  </p>
                  <button
                    onClick={() => {
                      setConfigTab("owners");
                      setShowConfigure(true);
                    }}
                    className="mt-3 btn-primary text-[10px] py-1.5 px-3 rounded-lg font-bold"
                  >
                    Assign Owners / Groups
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Groups section */}
                  {groupsListToDisplay.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Assigned Groups ({groupsListToDisplay.length})</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groupsListToDisplay.map((group) => (
                          <div 
                            key={group.group_id} 
                            className="p-4 rounded-xl border border-indigo-100/50 dark:border-indigo-900/40 bg-indigo-50/5 dark:bg-indigo-950/5 flex items-center gap-3"
                          >
                            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100/50 dark:border-indigo-500/20 flex items-center justify-center text-indigo-655 dark:text-indigo-400 shrink-0">
                              <Users className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 dark:text-white text-xs truncate">{group.name}</p>
                              <p className="text-[10px] text-gray-450 dark:text-slate-500 truncate mt-0.5">{group.description || "No description"}</p>
                              <span className="inline-block text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-555/10 px-1.5 py-0.5 rounded capitalize mt-1.5 border border-indigo-100/30">
                                Team Group
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Individual owners section */}
                  {ownersListToDisplay.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Individual Owners ({ownersListToDisplay.length})</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {ownersListToDisplay.map((user) => (
                          <div 
                            key={user.user_id} 
                            className="p-4 rounded-xl border border-gray-100 dark:border-slate-800/60 bg-gray-50/10 dark:bg-slate-900/5 flex items-center gap-3"
                          >
                            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100/50 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm shrink-0">
                              {user.full_name[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 dark:text-white text-xs truncate">{user.full_name}</p>
                              <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate mt-0.5">{user.email}</p>
                              <span className="inline-block text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded capitalize mt-1.5">
                                {user.role}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notification Routing Card */}
        <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm h-full flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Notification Routing</h3>
              <span className="text-[11px] text-gray-400 dark:text-slate-500 font-semibold bg-gray-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                SMTP
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Sender Channel (From)</span>
                {service?.alert_source_channel_id ? (
                  (() => {
                    const chName = resolveChannelName(service.alert_source_channel_id);
                    const isDeleted = chName === service.alert_source_channel_id; // raw ID fallback
                    return (
                      <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                        isDeleted 
                          ? "border-amber-250 dark:border-amber-900/40 bg-amber-500/5 dark:bg-amber-950/5 text-amber-800 dark:text-amber-400" 
                          : "border-indigo-100/30 dark:border-indigo-900/40 bg-indigo-50/5 dark:bg-indigo-950/5 text-gray-800 dark:text-slate-200"
                      }`}>
                        <div className="flex items-center gap-2">
                          <Mail className={`w-4 h-4 ${isDeleted ? "text-amber-500 animate-pulse" : "text-indigo-500"}`} />
                          <span className="font-semibold">
                            {isDeleted ? `Channel Missing (${service.alert_source_channel_id})` : chName}
                          </span>
                        </div>
                        {isDeleted && (
                          <Link 
                            href="/dashboard/services/features" 
                            className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-bold underline flex items-center gap-1 shrink-0"
                          >
                            Reconfigure in Settings →
                          </Link>
                        )}
                      </div>
                    );
                  })()
                ) : organization?.default_alert_source_channel_id ? (
                  (() => {
                    const chName = resolveChannelName(organization.default_alert_source_channel_id);
                    const isDeleted = chName === organization.default_alert_source_channel_id;
                    return (
                      <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                        isDeleted 
                          ? "border-amber-250 dark:border-amber-900/40 bg-amber-500/5 dark:bg-amber-950/5 text-amber-800 dark:text-amber-400" 
                          : "border-gray-150 dark:border-slate-800/60 bg-gray-50/10 dark:bg-slate-900/5 text-gray-800 dark:text-slate-200"
                      }`}>
                        <div className="flex items-center gap-2">
                          <Mail className={`w-4 h-4 ${isDeleted ? "text-amber-400 animate-pulse" : "text-indigo-400"}`} />
                          <span className="font-semibold text-gray-650 dark:text-slate-350">
                            {isDeleted 
                              ? `Default Channel Missing (${organization.default_alert_source_channel_id})` 
                              : chName
                            }
                            {!isDeleted && <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded ml-1.5 uppercase font-sans">Default</span>}
                          </span>
                        </div>
                        {isDeleted && (
                          <Link 
                            href="/dashboard/services/features" 
                            className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-bold underline flex items-center gap-1 shrink-0"
                          >
                            Reconfigure in Settings →
                          </Link>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-[11px] text-amber-605 dark:text-amber-400 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 p-3 rounded-xl font-medium flex items-center justify-between gap-2">
                    <span>No sender channel configured.</span>
                    <Link
                      href="/dashboard/services/features"
                      className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-bold underline shrink-0"
                    >
                      Go to Service settings →
                    </Link>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">CC Recipients</span>
                <div className="p-3 rounded-xl border border-gray-150 dark:border-slate-800/60 bg-gray-50/20 dark:bg-slate-900/5 min-h-[42px] flex items-center">
                  {service?.alert_cc && service.alert_cc !== organization?.default_alert_cc 
                    ? renderRecipientsBadges(service.alert_cc, false)
                    : (organization?.default_alert_cc 
                        ? renderRecipientsBadges(organization.default_alert_cc, true)
                        : <span className="text-gray-400 dark:text-slate-500 italic">None</span>
                      )
                  }
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">BCC Recipients</span>
                <div className="p-3 rounded-xl border border-gray-150 dark:border-slate-800/60 bg-gray-50/20 dark:bg-slate-900/5 min-h-[42px] flex items-center">
                  {service?.alert_bcc && service.alert_bcc !== organization?.default_alert_bcc 
                    ? renderRecipientsBadges(service.alert_bcc, false)
                    : (organization?.default_alert_bcc 
                        ? renderRecipientsBadges(organization.default_alert_bcc, true)
                        : <span className="text-gray-400 dark:text-slate-500 italic">None</span>
                      )
                  }
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">Active Dispatch Channels</span>
                <div className="p-3 rounded-xl border border-gray-150 dark:border-slate-800/60 bg-gray-50/20 dark:bg-slate-900/5 min-h-[42px] flex items-center">
                  {(() => {
                    const activeChannels = assignedChannelIds.map(chId => channels.find(c => c.channel_id === chId)).filter(Boolean) as Channel[];
                    if (activeChannels.length === 0) {
                      return <span className="text-gray-450 dark:text-slate-500 italic text-[11px]">No channels assigned</span>;
                    }
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {activeChannels.map((ch) => {
                          let colorClass = "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200 border-gray-200/80 dark:border-slate-700/80";
                          if (ch.type === "slack" || ch.type === "webhook") {
                            colorClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-450 border-emerald-100/55 dark:border-emerald-500/20";
                          } else if (ch.type === "teams") {
                            colorClass = "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-100/55 dark:border-blue-500/20";
                          } else if (ch.type === "whatsapp") {
                            colorClass = "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-100/55 dark:border-green-500/20";
                          } else if (ch.type === "email") {
                            colorClass = "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-100/55 dark:border-indigo-500/20";
                          }
                          return (
                            <span key={ch.channel_id} className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg font-bold border ${colorClass}`}>
                              {ch.name} <span className="opacity-60 text-[9px]">({ch.type.toUpperCase()})</span>
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Active Crash Filters</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(!service?.alert_crash_reasons || service.alert_crash_reasons.length === 0) ? (
                    <span className="text-xs text-gray-455 dark:text-slate-550 italic">All crash types (no filters active)</span>
                  ) : (
                    service.alert_crash_reasons.map((reason) => (
                      <span
                        key={reason}
                        className="inline-block text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-550/10 px-1.5 py-0.5 rounded capitalize border border-indigo-100/30"
                      >
                        {reason}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Incidents Card */}
      <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2 flex-wrap">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Service Incidents</h3>
            <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
              {service.incidents?.length || 0} Total
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter Dropdown */}
            <select
              value={incidentStatusFilter}
              onChange={(e) => setIncidentStatusFilter(e.target.value as any)}
              className="text-xs font-semibold bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 rounded-xl px-2.5 py-1.5 cursor-pointer focus:outline-none"
            >
              <option value="active">Active / Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All Incidents</option>
            </select>

            {service.incidents && service.incidents.some(i => i.status !== "resolved") && (
              <button
                onClick={handleResolveAllIncidents}
                className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 px-3 py-1.5 rounded-xl border border-indigo-200/40 dark:border-indigo-500/20 transition-all flex items-center gap-1.5"
              >
                <Check className="w-3 h-3" />
                Resolve All Active
              </button>
            )}
          </div>
        </div>

        {(() => {
          const allIncidents = service.incidents || [];
          const filteredIncidents = allIncidents.filter(i => {
            if (incidentStatusFilter === "all") return true;
            if (incidentStatusFilter === "resolved") return i.status === "resolved";
            return i.status !== "resolved";
          });

          if (filteredIncidents.length === 0) {
            return (
              <div className="py-12 text-center bg-gray-50/20 dark:bg-slate-900/5 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="font-semibold text-gray-555 dark:text-slate-400 text-xs">
                  {incidentStatusFilter === "resolved" ? "No resolved incidents found" : "No active incidents found"}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                  {incidentStatusFilter === "resolved" 
                    ? "Resolved incidents will be listed here after being closed." 
                    : "There are no active or unresolved incidents reported for this service's pod prefix."}
                </p>
              </div>
            );
          }

          return (
            <div className="divide-y divide-gray-100 dark:divide-slate-800/60 max-h-[450px] overflow-y-auto pr-1">
              {filteredIncidents.map((incident) => (
                <div
                  key={incident.incident_id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1 flex items-start gap-3">
                    <span className="relative flex h-2 w-2 shrink-0 mt-1.5">
                      {incident.status !== "resolved" && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          incident.severity === 'critical' ? 'bg-red-400' : incident.severity === 'warning' ? 'bg-amber-400' : 'bg-indigo-400'
                        }`}></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        incident.status === 'resolved' ? 'bg-green-500' : incident.severity === 'critical' ? 'bg-red-500' : incident.severity === 'warning' ? 'bg-amber-500' : 'bg-indigo-500'
                      }`}></span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-gray-900 dark:text-white truncate max-w-[220px]">
                          {incident.pod_name}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase">
                          {incident.namespace}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${
                          incident.severity === 'critical' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' : incident.severity === 'warning' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                        }`}>
                          {incident.severity}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          incident.status === 'resolved' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : incident.status === 'acknowledged' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                        }`}>
                          {incident.status || 'open'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 truncate">
                        {incident.crash_reason}
                      </p>
                      <p className="text-[9px] text-gray-400 dark:text-slate-555 mt-0.5">
                        Seen {timeAgo(incident.last_seen_at)} · Restarts: {incident.restart_count || 0}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {incident.status !== "acknowledged" && incident.status !== "resolved" && (
                      <button
                        onClick={() => handleAcknowledgeIncident(incident.incident_id)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                        title="Acknowledge Incident"
                      >
                        Acknowledge
                      </button>
                    )}
                    {incident.status !== "resolved" && (
                      <button
                        onClick={() => handleResolveIncident(incident.incident_id)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-green-500 hover:bg-green-600 text-white transition flex items-center gap-1 shadow-sm"
                        title="Resolve & Close Incident"
                      >
                        <Check className="w-3 h-3" />
                        Resolve
                      </button>
                    )}
                    <Link
                      href="/dashboard/incidents"
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition"
                      title="Inspect Details"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
      {/* Slide-Over Drawer Panel for Configure Service Settings */}
      {mounted && showConfigure && createPortal((() => {
        return (
          <div className="fixed inset-0 overflow-hidden z-50">
            <div className="absolute inset-0 overflow-hidden">
              {/* Backdrop with fade-in blur */}
              <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
                onClick={() => setShowConfigure(false)} 
              />
              
              {/* Drawer Content */}
              <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
                <div className="w-screen max-w-xl bg-white dark:bg-[#11131a] border-l border-gray-100 dark:border-slate-800/85 shadow-2xl flex flex-col h-full transform transition-transform duration-300 slide-in-from-right">
                  
                  {/* Drawer Header */}
                  <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Settings className="w-5 h-5 text-indigo-500" />
                      <h2 className="font-bold text-gray-900 dark:text-white text-base">
                        Configure Service Settings
                      </h2>
                    </div>
                    <button 
                      onClick={() => setShowConfigure(false)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Drawer Tab Switcher */}
                  <div className="flex border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/10 shrink-0 select-none">
                    <button
                      onClick={() => setConfigTab("owners")}
                      className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                        configTab === "owners"
                          ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900/30"
                          : "border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      Service Owners
                    </button>
                    <button
                      onClick={() => setConfigTab("channels")}
                      className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                        configTab === "channels"
                          ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900/30"
                          : "border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400"
                      }`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Alert Routing
                    </button>
                  </div>

                  {/* Drawer Content Form */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                    {configTab === "owners" ? (
                      <div className="space-y-6">
                        {/* Users section */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-gray-950 dark:text-white uppercase tracking-wider">
                            Individual Owners
                          </label>
                          <RecipientSelector
                            value={assignedOwnerIds.join(", ")}
                            onChange={(newVal) => {
                              setAssignedOwnerIds(newVal.split(",").map(s => s.trim()).filter(Boolean));
                            }}
                            allUsers={allUsers}
                            allGroups={[]}
                            notificationGroups={[]}
                            placeholder="Select users to assign directly..."
                            allowedTypes={["user"]}
                          />
                          <p className="text-[10px] text-gray-400 dark:text-slate-500">
                            Select individual owners to assign directly to this service.
                          </p>
                        </div>

                        {/* Groups section */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-gray-950 dark:text-white uppercase tracking-wider">
                            User Groups
                          </label>
                          <RecipientSelector
                            value={assignedGroupIds.join(", ")}
                            onChange={(newVal) => {
                              setAssignedGroupIds(newVal.split(",").map(s => s.trim()).filter(Boolean));
                            }}
                            allUsers={[]}
                            allGroups={allGroups}
                            notificationGroups={[]}
                            placeholder="Select groups to assign..."
                            allowedTypes={["group"]}
                          />
                          <p className="text-[10px] text-gray-400 dark:text-slate-500">
                            Assign groups to handle ownership at the team level.
                          </p>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={saveOwners}
                            disabled={savingOwners}
                            className="btn-primary w-full justify-center text-xs font-bold flex items-center gap-1.5"
                          >
                            {savingOwners ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Saving Assignment...
                              </>
                            ) : (
                              "Save Assignment Settings"
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Sender Channel */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                            Sender Channel (From)
                          </label>
                          {(() => {
                            const serviceOwnerChannels = channels.filter(
                              c => c.type === "email" && c.channel_type === "service_owner"
                            );
                            if (serviceOwnerChannels.length === 0) {
                              return (
                                <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-gray-150 dark:border-slate-800/60">
                                  <p className="text-xs text-gray-500 dark:text-slate-400">
                                    No Service Owner email channels found.
                                  </p>
                                  <div>
                                    <a
                                      href="/dashboard/services/features"
                                      className="btn-primary py-1.5 px-3.5 text-xs font-bold inline-flex items-center gap-1.5 rounded-lg text-center"
                                    >
                                      Go to Service settings
                                    </a>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="flex gap-2">
                                <select
                                  className="input text-xs flex-1"
                                  value={alertSourceChannelId}
                                  onChange={(e) => setAlertSourceChannelId(e.target.value)}
                                >
                                  <option value="">
                                    {organization?.default_alert_source_channel_id
                                      ? `Using default: ${resolveChannelName(organization.default_alert_source_channel_id)}`
                                      : "None"}
                                  </option>
                                  {serviceOwnerChannels.map((ch) => (
                                    <option key={ch.channel_id} value={ch.channel_id}>
                                      {ch.name}
                                    </option>
                                  ))}
                                </select>
                                <a
                                  href="/settings/channels"
                                  className="px-3.5 bg-gray-150 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-gray-200/80 dark:border-slate-700 justify-center shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Add
                                </a>
                              </div>
                            );
                          })()}
                          <p className="text-[10px] text-gray-500">
                            Only "Service Owner"-type email channels are listed.
                          </p>
                                        {/* CC Recipients */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                            CC Recipients
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

                        {/* BCC Recipients */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                            BCC Recipients
                          </label>
                          <RecipientSelector
                            value={alertBcc}
                            onChange={setAlertBcc}
                            allUsers={allUsers}
                            allGroups={allGroups}
                            notificationGroups={notificationGroups}
                            placeholder="Select users, groups, or type email to BCC..."
                          />
                        </div>           </div>

                        {/* Alert Crash Filters */}
                        <div className="space-y-2">
                          <label className="block text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                            Alert Crash Filters
                          </label>
                          <p className="text-[10px] text-gray-500">
                            Select which pod crash reasons trigger automated alerts to service owners. Leave all unchecked to receive all alerts.
                          </p>
                          <div className="grid grid-cols-2 gap-2 bg-gray-50/50 dark:bg-slate-900/10 p-3 rounded-xl border border-gray-150 dark:border-slate-800">
                            {["OOMKilled", "CrashLoopBackOff", "ImagePullBackOff", "ContainerCannotRun", "Error", "Failed"].map((reason) => {
                              const isChecked = alertCrashReasons.includes(reason);
                              return (
                                <label
                                  key={reason}
                                  className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-slate-350 cursor-pointer select-none py-1"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setAlertCrashReasons(prev =>
                                        prev.includes(reason) 
                                          ? prev.filter(r => r !== reason) 
                                          : [...prev, reason]
                                      );
                                    }}
                                    className="w-4 h-4 text-indigo-600 border-gray-250 dark:border-slate-700 rounded focus:ring-indigo-500 cursor-pointer"
                                  />
                                  {reason}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Live Routing Preview */}
                        <div className="bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/60 dark:border-indigo-900/40 rounded-2xl p-4 space-y-3">
                          <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Bell className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                            Live Routing Preview
                          </h4>
                          <div className="space-y-2.5 text-xs">
                            <div>
                              <span className="font-bold text-gray-500 dark:text-slate-400 block mb-0.5">To (Owners):</span>
                              {assignedOwnerIds.length === 0 && assignedGroupIds.length === 0 ? (
                                <span className="text-gray-400 dark:text-slate-500 italic">No owners assigned (nobody will receive alerts)</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {resolveRecipientsPreview([
                                    ...assignedOwnerIds,
                                    ...assignedGroupIds
                                  ]).map((rec, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded font-semibold text-gray-800 dark:text-slate-200">
                                      {rec.label} {rec.email && <code className="text-[10px] text-indigo-500 font-normal">({rec.email})</code>}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <span className="font-bold text-gray-500 dark:text-slate-400 block mb-0.5">CC List:</span>
                              {!alertCc.trim() ? (
                                <span className="text-gray-450 dark:text-slate-500 italic">
                                  {organization?.default_alert_cc ? `Default: ${organization.default_alert_cc}` : "None"}
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {resolveRecipientsPreview(alertCc.split(",")).map((rec, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded font-semibold text-gray-800 dark:text-slate-200">
                                      {rec.label} {rec.email && <code className="text-[10px] text-indigo-500 font-normal">({rec.email})</code>}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <span className="font-bold text-gray-500 dark:text-slate-400 block mb-0.5">BCC List:</span>
                              {!alertBcc.trim() ? (
                                <span className="text-gray-450 dark:text-slate-500 italic">
                                  {organization?.default_alert_bcc ? `Default: ${organization.default_alert_bcc}` : "None"}
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {resolveRecipientsPreview(alertBcc.split(",")).map((rec, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded font-semibold text-gray-800 dark:text-slate-200">
                                      {rec.label} {rec.email && <code className="text-[10px] text-indigo-500 font-normal">({rec.email})</code>}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={saveChannels}
                            disabled={savingChannels}
                            className="btn-primary w-full justify-center text-xs font-bold flex items-center gap-1.5"
                          >
                            {savingChannels ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Saving Settings...
                              </>
                            ) : (
                              "Save Routing Settings"
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Drawer Footer */}
                  <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50/20 dark:bg-slate-900/10 flex justify-end">
                    <button 
                      onClick={() => setShowConfigure(false)}
                      className="btn-secondary px-5 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-800"
                    >
                      Close
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* Slide-Over Drawer Panel for Activities */}
      {mounted && showActivities && createPortal((() => {
        return (
          <div className="fixed inset-0 overflow-hidden z-50">
            <div className="absolute inset-0 overflow-hidden">
              {/* Backdrop with fade-in blur */}
              <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
                onClick={() => setShowActivities(false)} 
              />
              
              {/* Drawer Content */}
              <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
                <div className="w-screen max-w-xl bg-white dark:bg-[#11131a] border-l border-gray-100 dark:border-slate-800/85 shadow-2xl flex flex-col h-full transform transition-transform duration-300 slide-in-from-right">
                  
                  {/* Drawer Header */}
                  <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Activity className="w-5 h-5 text-indigo-500" />
                      <h2 className="font-bold text-gray-900 dark:text-white text-base">
                        Service Activity Logs
                      </h2>
                      {service.activities && service.activities.length > 0 && (
                        <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          {service.activities.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleRefreshActivities}
                        disabled={refreshingActivities}
                        title="Refresh Activities"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-all flex items-center justify-center shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshingActivities ? "animate-spin text-indigo-500" : ""}`} />
                      </button>
                      <button 
                        onClick={() => setShowActivities(false)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Drawer Content - Scrollable Timeline */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                    {(!service.activities || service.activities.length === 0) ? (
                      <div className="text-center py-10">
                        <Activity className="w-10 h-10 text-gray-300 mx-auto mb-2 animate-pulse" />
                        <p className="text-xs text-gray-500">No activity registered for this service yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {service.activities.map((act, index) => (
                          <div key={act.activity_log_id} className="relative pl-9 pb-2 last:pb-0">
                            {/* Vertical Connecting Line */}
                            {index < (service.activities?.length || 0) - 1 && (
                              <div className="absolute left-[13px] top-[24px] bottom-0 w-0.5 bg-gray-100 dark:bg-slate-800" />
                            )}
                            
                            {/* Floating Circle Icon */}
                            <div className="absolute left-0 top-0.5 shrink-0 z-10 bg-white dark:bg-[#11131a] rounded-full">
                              {renderActivityIcon(act.action)}
                            </div>
                            
                            {/* Event Content Box */}
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                                  {getActivityTitle(act)}
                                </p>
                                <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0 font-medium">
                                  {getActivitySubtitle(act)}
                                </span>
                              </div>
                              {renderActivityChanges(act)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Drawer Footer */}
                  <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50/20 dark:bg-slate-900/10 flex justify-end">
                    <button 
                      onClick={() => setShowActivities(false)}
                      className="btn-secondary px-5 py-2.5 rounded-xl text-xs font-bold text-gray-750 dark:text-slate-200 border border-gray-200 dark:border-slate-800"
                    >
                      Close
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}
      <MuteDurationModal
        isOpen={muteModalOpen}
        onClose={() => setMuteModalOpen(false)}
        onConfirm={async (minutes) => {
          setMuteModalOpen(false);
          await handleMuteService(minutes);
        }}
        title="Mute Service Alerts"
      />
    </div>
  );
}
