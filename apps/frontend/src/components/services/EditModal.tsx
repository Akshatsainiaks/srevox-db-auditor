"use client";

import { useEffect, useState } from "react";
import { Loader2, Info, X, Save } from "lucide-react";
import { fetchServiceOwner, updateServiceOwner, api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import RecipientSelector from "./RecipientSelector";

interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
}

interface Cluster {
  cluster_id: string;
  name: string;
}

interface Channel {
  channel_id: string;
  name: string;
  type: string;
}

export default function EditModal({
  ownerId,
  clusters,
  onClose,
  onSaved,
}: {
  ownerId: string;
  clusters: Cluster[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clusterId, setClusterId] = useState("");
  const [namespace, setNamespace] = useState("");
  const [podPrefix, setPodPrefix] = useState("");
  
  const [alertSourceChannelId, setAlertSourceChannelId] = useState("");
  const [alertCc, setAlertCc] = useState("");
  const [alertBcc, setAlertBcc] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [org, setOrg] = useState<any>(null);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [notificationGroups, setNotificationGroups] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  const { success, error: toastError } = useToast();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchServiceOwner(ownerId),
      api.get("/api/channels").catch(err => {
        console.error("Failed to load channels", err);
        return { data: { channels: [] } };
      }),
      api.get("/api/service-owners/routing-defaults").catch(err => {
        console.error("Failed to load routing defaults", err);
        return { data: {} };
      }),
      api.get("/api/users").catch(err => {
        console.error("Failed to load users", err);
        return { data: { users: [] } };
      }),
      api.get("/api/groups").catch(err => {
        console.error("Failed to load groups", err);
        return { data: { groups: [] } };
      }),
      api.get("/api/notification-groups").catch(err => {
        console.error("Failed to load notification groups", err);
        return { data: { groups: [] } };
      })
    ])
      .then(([data, channelsRes, settingsRes, usersRes, groupsRes, notifGroupsRes]) => {
        setClusterId(data.cluster_id || "");
        setNamespace(data.namespace || "");
        setPodPrefix(data.pod_prefix || "");
        const orgData = settingsRes.data || {};
        setOrg(orgData);
        const filtered = (channelsRes.data.channels || []).filter((c: any) => c.type === "email" && c.channel_type === "service_owner");
        setChannels(filtered);

        setAllUsers(usersRes.data.users || []);
        setAllGroups(groupsRes.data.groups || []);
        setNotificationGroups(notifGroupsRes.data.groups || notifGroupsRes.data || []);

        const currentChannelId = data.alert_source_channel_id || "";
        const exists = filtered.some((c: any) => c.channel_id === currentChannelId);
        setAlertSourceChannelId(exists ? currentChannelId : "");

        setAlertCc(data.alert_cc ? data.alert_cc : (orgData.default_alert_cc || ""));
        setAlertBcc(data.alert_bcc ? data.alert_bcc : (orgData.default_alert_bcc || ""));
      })
      .catch((err) => {
        console.error("Failed to load service, channels, or account", err);
        toastError("Failed to load service details");
        onClose();
      })
      .finally(() => setLoading(false));
  }, [ownerId, onClose, toastError]);

  const submit = async () => {
    if (!clusterId) return;
    if (!podPrefix.trim()) {
      setError("Service name is required");
      return;
    }
    setSaving(true);
    setError("");
    const defaultChannelId = org?.default_alert_source_channel_id || "";
    const defaultCc = org?.default_alert_cc || "";
    const defaultBcc = org?.default_alert_bcc || "";

    const finalChannelId = alertSourceChannelId === defaultChannelId ? null : (alertSourceChannelId || null);
    const finalCc = alertCc === defaultCc ? null : (alertCc || null);
    const finalBcc = alertBcc === defaultBcc ? null : (alertBcc || null);

    try {
      await updateServiceOwner(ownerId, {
        cluster_id: clusterId,
        namespace: namespace || null,
        pod_prefix: podPrefix || null,
        alert_source_channel_id: finalChannelId,
        alert_cc: finalCc,
        alert_bcc: finalBcc,
      });
      success("Service updated", "Your changes have been saved.");
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to update service");
    } finally {
      setSaving(false);
    }
  };

  const resolveChannelName = (channelId: string | null) => {
    if (!channelId) return "None";
    const found = channels.find(c => c.channel_id === channelId);
    return found ? `${found.name} (${found.type.toUpperCase()})` : channelId;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#07080d]/75 backdrop-blur-[6px] flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-[#13151f] rounded-3xl p-8 border border-gray-150 dark:border-slate-800/80 shadow-2xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2130] rounded-2xl shadow-2xl border border-gray-150 dark:border-slate-800/80 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-[#1e2130] z-10">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Edit service</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Update service details and email routing settings
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="label">
              Cluster
            </label>
            <select
              className="input"
              value={clusterId}
              onChange={(e) => setClusterId(e.target.value)}
            >
              {clusters.map((c) => (
                <option key={c.cluster_id} value={c.cluster_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">
              Service Name (Pod Prefix)
            </label>
            <input
              className="input"
              placeholder="e.g. auth-service"
              value={podPrefix}
              onChange={(e) => setPodPrefix(e.target.value)}
            />
          </div>

          <div>
            <label className="label">
              Namespace
            </label>
            <input
              className="input"
              placeholder="production"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
            />
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800/80 my-4 pt-4 space-y-4">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Email Routing Settings</h4>
            
            <div>
              <label className="label">
                Sender Channel (From)
              </label>
              <select
                className="input"
                value={alertSourceChannelId}
                onChange={(e) => setAlertSourceChannelId(e.target.value)}
              >
                <option value="">
                  {org?.default_alert_source_channel_id
                    ? `Using default: ${resolveChannelName(org.default_alert_source_channel_id)}`
                    : "None"}
                </option>
                {alertSourceChannelId && !channels.some(c => c.channel_id === alertSourceChannelId) && (
                  <option value={alertSourceChannelId}>
                    ⚠️ Deleted Channel ({alertSourceChannelId})
                  </option>
                )}
                {channels.map((ch) => (
                  <option key={ch.channel_id} value={ch.channel_id}>
                    {ch.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Select the global email channel used to send alerts from.
              </p>
            </div>

             <div>
              <label className="label">
                CC Recipients
              </label>
              <RecipientSelector
                value={alertCc}
                onChange={setAlertCc}
                allUsers={allUsers}
                allGroups={allGroups}
                notificationGroups={notificationGroups}
                placeholder="Select users, groups, or type custom email and press Enter..."
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Select users, groups, or type custom email addresses to CC on service alerts.
              </p>
            </div>

            <div>
              <label className="label">
                BCC Recipients
              </label>
              <RecipientSelector
                value={alertBcc}
                onChange={setAlertBcc}
                allUsers={allUsers}
                allGroups={allGroups}
                notificationGroups={notificationGroups}
                placeholder="Select users, groups, or type custom email and press Enter..."
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Select users, groups, or type custom email addresses to BCC on service alerts.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 justify-center py-2.5 rounded-xl font-bold"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!clusterId || saving}
              className="btn-primary flex-1 justify-center py-2.5 rounded-xl font-bold flex items-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
