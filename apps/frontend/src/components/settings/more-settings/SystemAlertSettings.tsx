"use client";
import React, { useState, useEffect } from "react";
import { Bell, Info, Loader2, Save, Edit3 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import Link from "next/link";
import { getUser, hasPermission } from "@/lib/auth";

interface SystemAlertSettingsProps {
  isAdmin: boolean;
}

interface Channel {
  channel_id: string;
  name: string;
  type: string;
  enabled: boolean;
}

export default function SystemAlertSettings({ isAdmin }: SystemAlertSettingsProps) {
  const { success, error: toastError } = useToast();
  const user = getUser();
  const canEdit = hasPermission(user, "systemAlerts");

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [enabled, setEnabled] = useState(true);
  const [enabledEvents, setEnabledEvents] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  // Original saved states (for change tracking & cancellation)
  const [originalEnabled, setOriginalEnabled] = useState(true);
  const [originalEnabledEvents, setOriginalEnabledEvents] = useState<string[]>([]);
  const [originalSelectedChannels, setOriginalSelectedChannels] = useState<string[]>([]);

  // List of all channels
  const [channels, setChannels] = useState<Channel[]>([]);

  const loadSettingsData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [settingsRes, channelsRes] = await Promise.all([
        api.get("/api/system-alert-settings"),
        api.get("/api/channels")
      ]);

      if (settingsRes.data?.settings) {
        const s = settingsRes.data.settings;
        setEnabled(s.enabled ?? true);
        setOriginalEnabled(s.enabled ?? true);

        const evts = s.enabled_events || [];
        setEnabledEvents(evts);
        setOriginalEnabledEvents(evts);

        const chs = s.channel_ids || [];
        setSelectedChannels(chs);
        setOriginalSelectedChannels(chs);
      }

      if (channelsRes.data?.channels) {
        setChannels(channelsRes.data.channels.filter((c: any) => c.channel_type === "normal" || !c.channel_type));
      }
    } catch (err: any) {
      console.error(err);
      toastError("Failed to load system alert configurations.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      loadSettingsData();
    }
  }, [mounted]);

  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, index) => val === sortedB[index]);
  };

  const hasChanges = 
    enabled !== originalEnabled ||
    !arraysEqual(enabledEvents, originalEnabledEvents) ||
    !arraysEqual(selectedChannels, originalSelectedChannels);

  const handleCancel = () => {
    setEnabled(originalEnabled);
    setEnabledEvents(originalEnabledEvents);
    setSelectedChannels(originalSelectedChannels);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await api.put("/api/system-alert-settings", {
        enabled,
        enabled_events: enabledEvents,
        channel_ids: selectedChannels
      });
      success("System alert settings updated successfully.");
      
      // Update original reference state locally to reset dirty state
      setOriginalEnabled(enabled);
      setOriginalEnabledEvents(enabledEvents);
      setOriginalSelectedChannels(selectedChannels);
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      toastError(err.response?.data?.detail || err.message || "Failed to update system alert settings.");
    } finally {
      setSaving(false);
    }
  };

  const toggleEvent = (evt: string) => {
    if (!isEditing) return;
    setEnabledEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]
    );
  };

  const toggleChannel = (id: string) => {
    if (!isEditing) return;
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const eventsList = [
    { key: "cluster_disconnected", label: "Cluster Disconnected", desc: "Triggers when a cluster goes offline or heartbeat pings are missed for > 3 minutes." },
    { key: "cluster_connected", label: "Cluster Reconnected", desc: "Triggers when a disconnected cluster successfully recovers and checks back online." },
    { key: "cluster_error", label: "Cluster Connection Error", desc: "Triggers when direct metrics collection or agent connection reports errors." },
    { key: "cluster_deleted", label: "Cluster Configuration Deleted", desc: "Triggers when an administrator permanently deletes a cluster config from Srevox." }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                System Alerts Configuration
              </h2>
              <p className="text-[11px] text-gray-555 dark:text-slate-400 mt-0.5">
                Choose which platform-level cluster connectivity and lifecycle events are dispatched to your team's alerting channels.
              </p>
            </div>
          </div>
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-gray-200 dark:border-slate-700"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
              Edit Settings
            </button>
          )}
        </div>

        {/* Info box */}
        <div className="bg-indigo-50/40 dark:bg-indigo-500/5 border border-indigo-100/40 dark:border-indigo-500/10 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed">
          <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-gray-600 dark:text-slate-400">
            <p className="font-bold text-gray-850 dark:text-slate-200 text-xs">Muting Rules & Noise Reduction</p>
            <p className="text-[11px] text-gray-555 dark:text-slate-455">
              System alerts only notify chosen destination integrations. CPU, Memory, and container crash alerts do not run through system alerts and must be configured via cluster-specific custom warning alert rules.
            </p>
          </div>
        </div>

        {/* Master Switch */}
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/35 border border-gray-100 dark:border-slate-800/60 rounded-2xl">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-gray-900 dark:text-white block">Enable System Alerts</span>
            <span className="text-[10px] text-gray-500 dark:text-slate-400 block">Globally mute or enable all platform connectivity warnings.</span>
          </div>
          <button
            type="button"
            disabled={!isEditing || !canEdit}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              !isEditing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
            } ${
              enabled ? "bg-indigo-600 dark:bg-indigo-500 shadow-md shadow-indigo-500/20" : "bg-gray-200 dark:bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 animate-fade-in">
            
            {/* Event Checklist */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                Select Alert Events
              </h3>
              <div className="space-y-3">
                {eventsList.map((evt) => (
                  <label
                    key={evt.key}
                    className={`flex items-start gap-3 p-3 bg-slate-50/50 dark:bg-slate-900/20 border border-gray-100 dark:border-slate-800/40 rounded-xl block ${
                      isEditing ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30" : "opacity-80 cursor-not-allowed"
                    } transition-all`}
                  >
                    <input
                      type="checkbox"
                      disabled={!isEditing || !canEdit}
                      checked={enabledEvents.includes(evt.key)}
                      onChange={() => toggleEvent(evt.key)}
                      className="checkbox mt-0.5 rounded border-gray-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="space-y-0.5 text-left">
                      <span className="text-xs font-bold text-gray-900 dark:text-white block">{evt.label}</span>
                      <span className="text-[10px] text-gray-455 dark:text-slate-400 block leading-normal">{evt.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Channels Selector */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                Send Alerts to Channels
              </h3>
              {channels.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                  <span className="text-xs text-gray-400 dark:text-slate-500 block">No active alerting channels found.</span>
                  {isEditing && (
                    <Link href="/settings/channels" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-1 inline-block">
                      Create alert channels &rarr;
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {channels.map((ch) => (
                    <label
                      key={ch.channel_id}
                      className={`flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-900/20 border border-gray-100 dark:border-slate-800/40 rounded-xl block ${
                        isEditing ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30" : "opacity-80 cursor-not-allowed"
                      } transition-all`}
                    >
                      <input
                        type="checkbox"
                        disabled={!isEditing || !canEdit}
                        checked={selectedChannels.includes(ch.channel_id)}
                        onChange={() => toggleChannel(ch.channel_id)}
                        className="checkbox rounded border-gray-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="text-left">
                        <span className="text-xs font-bold text-gray-900 dark:text-white block">{ch.name}</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase block mt-0.5">{ch.type} Integration</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Save/Cancel button footer */}
        {canEdit && isEditing && (
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800/60 animate-fade-in">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="btn-secondary text-xs py-1.5 px-4 rounded-lg font-bold border border-gray-200 dark:border-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`text-xs py-1.5 px-4 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                saving || !hasChanges
                  ? "bg-gray-100 dark:bg-slate-800/60 text-gray-400 dark:text-slate-500 cursor-not-allowed border border-transparent"
                  : "btn-primary"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
