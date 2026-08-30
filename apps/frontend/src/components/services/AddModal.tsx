"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, Info, X } from "lucide-react";
import { api } from "@/lib/api";
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

export default function AddModal({
  clusters,
  onClose,
  onAdded,
}: {
  clusters: Cluster[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [clusterId, setClusterId] = useState(clusters[0]?.cluster_id || "");
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/api/service-owners/routing-defaults").catch(err => {
        console.error("Failed to load routing defaults", err);
        return { data: {} };
      }),
      api.get("/api/channels").catch(err => {
        console.error("Failed to load channels", err);
        return { data: { channels: [] } };
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
      .then(([settingsRes, channelsRes, usersRes, groupsRes, notifGroupsRes]) => {
        const currentOrg = settingsRes.data || {};
        const filtered = (channelsRes.data.channels || []).filter(
          (c: any) => c.type === "email" && c.channel_type === "service_owner"
        );
        setChannels(filtered);
        setOrg(currentOrg);

        setAllUsers(usersRes.data.users || []);
        setAllGroups(groupsRes.data.groups || []);
        setNotificationGroups(notifGroupsRes.data.groups || notifGroupsRes.data || []);
        
        if (!currentOrg.default_alert_source_channel_id && filtered.length > 0) {
          setAlertSourceChannelId(filtered[0].channel_id);
        } else {
          setAlertSourceChannelId("");
        }

        setAlertCc(currentOrg.default_alert_cc || "");
        setAlertBcc(currentOrg.default_alert_bcc || "");
      })
      .catch((err) => {
        console.error("Failed to load account or email channels", err);
      });
  }, []);

  const submit = async () => {
    if (!clusterId) return;
    if (!podPrefix.trim()) {
      setError("Service name (pod prefix) is required");
      return;
    }
    setLoading(true);
    setError("");
    const defaultChannelId = org?.default_alert_source_channel_id || "";
    const defaultCc = org?.default_alert_cc || "";
    const defaultBcc = org?.default_alert_bcc || "";

    const finalChannelId = alertSourceChannelId === defaultChannelId ? null : (alertSourceChannelId || null);
    const finalCc = alertCc === defaultCc ? null : (alertCc || null);
    const finalBcc = alertBcc === defaultBcc ? null : (alertBcc || null);

    try {
      await api.post("/api/service-owners", {
        cluster_id: clusterId,
        namespace: namespace || null,
        pod_prefix: podPrefix || null,
        alert_source_channel_id: finalChannelId,
        alert_cc: finalCc,
        alert_bcc: finalBcc,
      });
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create service");
    } finally {
      setLoading(false);
    }
  };

  const resolveChannelName = (channelId: string | null) => {
    if (!channelId) return "None";
    const found = channels.find(c => c.channel_id === channelId);
    return found ? `${found.name} (${found.type.toUpperCase()})` : channelId;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2130] rounded-2xl shadow-2xl border border-gray-150 dark:border-slate-800/80 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-[#1e2130] z-10">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Add service</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Register a new service in the platform registry
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
          <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-3 flex gap-2">
            <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">
              Define the service name (pod prefix) and target cluster/namespace. Once registered, you will be able to assign owners and routing rules to this service.
            </p>
          </div>

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
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center py-2.5 rounded-xl font-bold">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!clusterId || loading}
              className="btn-primary flex-1 justify-center py-2.5 rounded-xl font-bold flex items-center gap-1.5"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add service
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
