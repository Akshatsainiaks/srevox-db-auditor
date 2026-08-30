"use client";
import { useEffect, useState } from "react";
import {
  Bell, CheckCircle, Loader2, Moon, Filter,
  SlidersHorizontal, Save, RotateCcw, Plus, X, Info, BellOff
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";

const ALL_SEVERITIES    = ["critical", "warning", "info"];
const ALL_CRASH_REASONS = [
  "CrashLoopBackOff", "OOMKilled", "Error",
  "BackOff", "ImagePullBackOff", "ErrImagePull",
  "CreateContainerError", "RunContainerError",
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Preferences {
  severities:          string[];
  crash_reasons:       string[];
  namespaces:          string[];
  quiet_hours_start:   number | null;
  quiet_hours_end:     number | null;
  notify_resolved:     boolean;
  notify_acknowledged: boolean;
  enabled:             boolean;
  notifications_muted: boolean;
  notifications_muted_until: string | null;
}

const DEFAULT_PREFS: Preferences = {
  severities: ["critical", "warning", "info"],
  crash_reasons: [], namespaces: [],
  quiet_hours_start: null, quiet_hours_end: null,
  notify_resolved: false, notify_acknowledged: false,
  enabled: true,
  notifications_muted: false,
  notifications_muted_until: null,
};

const SEV_STYLES: Record<string, { active: string; inactive: string }> = {
  critical: { active: "bg-red-600 text-white border-red-600 shadow-sm shadow-red-500/30",   inactive: "border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10" },
  warning:  { active: "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/30", inactive: "border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10" },
  info:     { active: "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30",  inactive: "border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10" },
};

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function PreferencesPage() {
  const [prefs,   setPrefs]   = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [nsInput, setNsInput] = useState("");
  const { success, error } = useToast();

  useEffect(() => {
    api.get("/api/preferences")
      .then(r => setPrefs({ ...DEFAULT_PREFS, ...r.data.preferences }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleSeverity = (s: string) => setPrefs(p => ({
    ...p, severities: p.severities.includes(s)
      ? p.severities.filter(x => x !== s)
      : [...p.severities, s],
  }));

  const toggleReason = (r: string) => setPrefs(p => ({
    ...p, crash_reasons: p.crash_reasons.includes(r)
      ? p.crash_reasons.filter(x => x !== r)
      : [...p.crash_reasons, r],
  }));

  const addNamespace = () => {
    const ns = nsInput.trim();
    if (!ns || prefs.namespaces.includes(ns)) return;
    setPrefs(p => ({ ...p, namespaces: [...p.namespaces, ns] }));
    setNsInput("");
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/api/preferences", prefs);
      success("Preferences saved!", "Your alert preferences have been updated");
    } catch { error("Failed to save preferences"); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 dark:bg-slate-800 rounded-xl w-48" />
      {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-100 dark:bg-slate-800 rounded-2xl" />)}
    </div>
  );

  return (
    <div className="space-y-5 animate-modal-slide-up" style={{ animationDuration: "0.2s" }}>
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-indigo-500" />
          Alert Preferences
        </h1>
        <p className="text-xs text-gray-550 dark:text-slate-400 mt-1">
          Customize which alerts you personally receive. These apply to your service owner alerts only.
        </p>
      </div>

      {/* Feature notice banner */}
      <div className="bg-amber-50/50 dark:bg-amber-500/[0.03] border border-amber-150 dark:border-amber-500/20 p-4 rounded-2xl flex items-start gap-3 select-none">
        <Info className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Notice: Upcoming Feature Enhancement</p>
          <p className="text-[11px] text-amber-700/90 dark:text-amber-400/80 leading-relaxed">
            Personal alert routing configurations and filter controls will be further updated and fully optimized in the next version release.
          </p>
        </div>
      </div>

      {/* Master toggle */}
      <div id="prefs-toggle" className="card p-5 flex items-center justify-between bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${prefs.enabled ? "bg-indigo-50 dark:bg-indigo-500/10" : "bg-gray-100 dark:bg-slate-800"}`}>
            <Bell className={`w-5 h-5 ${prefs.enabled ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-slate-500"}`} />
          </div>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white text-sm">Personal alerts</div>
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {prefs.enabled ? "You will receive personal crash alerts" : "Personal alerts are paused"}
            </div>
          </div>
        </div>
        {/* Toggle switch */}
        <button
          onClick={() => setPrefs(p => ({ ...p, enabled: !p.enabled }))}
          className={`relative w-11 h-6 rounded-full transition-all duration-200 focus:outline-none ${prefs.enabled ? "bg-indigo-650" : "bg-gray-300 dark:bg-slate-700"}`}
        >
          <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow-sm transition-transform duration-200" style={{ backgroundColor: "#ffffff", transform: prefs.enabled ? "translateX(20px)" : "translateX(0px)" }} />
        </button>
      </div>

      {/* Notifications Muting Preferences */}
      <div className="card p-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${prefs.notifications_muted || (prefs.notifications_muted_until && new Date(prefs.notifications_muted_until) > new Date()) ? "bg-amber-50 dark:bg-amber-500/10" : "bg-indigo-50 dark:bg-indigo-500/10"}`}>
            <BellOff className={`w-5 h-5 ${prefs.notifications_muted || (prefs.notifications_muted_until && new Date(prefs.notifications_muted_until) > new Date()) ? "text-amber-600 dark:text-amber-400" : "text-indigo-650 dark:text-indigo-400"}`} />
          </div>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white text-sm">Workspace Notification Muting</div>
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {prefs.notifications_muted ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">Muted permanently</span>
              ) : (prefs.notifications_muted_until && new Date(prefs.notifications_muted_until) > new Date()) ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">Muted until {new Date(prefs.notifications_muted_until).toLocaleString()}</span>
              ) : (
                "Notifications are active"
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-2">
          <button
            onClick={() => setPrefs(p => ({ ...p, notifications_muted: false, notifications_muted_until: null }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${!prefs.notifications_muted && (!prefs.notifications_muted_until || new Date(prefs.notifications_muted_until) <= new Date()) ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 text-indigo-700 dark:text-indigo-400" : "border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400"}`}
          >
            Active (On)
          </button>
          <button
            onClick={() => setPrefs(p => ({ ...p, notifications_muted: true, notifications_muted_until: null }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${prefs.notifications_muted ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 text-amber-700 dark:text-amber-400" : "border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400"}`}
          >
            Mute permanently
          </button>
          {[30, 60, 120, 1440].map(m => {
            const isMutedForThis = prefs.notifications_muted_until && Math.abs(new Date(prefs.notifications_muted_until).getTime() - (Date.now() + m * 60 * 1000)) < 60000;
            return (
              <button
                key={m}
                onClick={() => setPrefs(p => ({ ...p, notifications_muted: false, notifications_muted_until: new Date(Date.now() + m * 60 * 1000).toISOString() }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isMutedForThis ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 text-amber-700 dark:text-amber-400" : "border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400"}`}
              >
                Mute {m >= 1440 ? "24h" : m >= 60 ? `${m/60}h` : `${m}m`}
              </button>
            );
          })}
        </div>
      </div>

      {prefs.enabled && (
        <>
          {/* Severity filter */}
          <Section title="Severity filter" icon={Filter}>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">Only receive alerts for selected severities.</p>
            <div className="flex gap-3 flex-wrap">
              {ALL_SEVERITIES.map(s => {
                const active = prefs.severities.includes(s);
                const st = SEV_STYLES[s];
                return (
                  <button key={s} onClick={() => toggleSeverity(s)}
                    className={`px-5 py-2 rounded-xl border-2 font-semibold text-sm capitalize transition-all ${active ? st.active : `bg-transparent ${st.inactive}`}`}>
                    {active && "✓ "}{s}
                  </button>
                );
              })}
            </div>
            {prefs.severities.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1.5">
                <span>⚠</span> No severities selected — you won't receive any alerts
              </p>
            )}
          </Section>

          {/* Crash reason filter */}
          <Section title="Crash reason filter" icon={Filter}>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
              Select specific crash reasons. Leave all unselected to receive all crash types.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CRASH_REASONS.map(r => {
                const active = prefs.crash_reasons.includes(r);
                return (
                  <button key={r} onClick={() => toggleReason(r)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-mono text-left transition-all ${
                      active
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                        : "border-gray-200 dark:border-slate-800 text-gray-605 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                    }`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${active ? "bg-indigo-600 border-indigo-600" : "border-gray-300 dark:border-slate-600"}`}>
                      {active && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    {r}
                  </button>
                );
              })}
            </div>
            {prefs.crash_reasons.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">All crash reasons active (default)</p>
            )}
          </Section>

          {/* Namespace filter */}
          <Section title="Namespace filter" icon={SlidersHorizontal}>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
              Only receive alerts from specific namespaces. Empty = all namespaces.
            </p>
            <div className="flex gap-2 mb-3">
              <input className="input flex-1" placeholder="production"
                value={nsInput} onChange={e => setNsInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addNamespace()} />
              <button onClick={addNamespace} className="btn-secondary gap-1.5"><Plus className="w-4 h-4"/>Add</button>
            </div>
            {prefs.namespaces.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {prefs.namespaces.map(ns => (
                  <span key={ns} className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/20 text-xs px-2.5 py-1.5 rounded-xl font-medium">
                    {ns}
                    <button onClick={() => setPrefs(p => ({ ...p, namespaces: p.namespaces.filter(n => n !== ns) }))}
                      className="hover:text-red-550 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-slate-500">All namespaces watched (default)</p>
            )}
          </Section>

          {/* Quiet hours */}
          <Section title="Quiet hours" icon={Moon}>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
              Pause personal alerts during specific hours (UTC). Org-level alerts still fire.
            </p>
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <div className={`relative w-10 h-5 rounded-full transition-colors ${prefs.quiet_hours_start != null ? "bg-indigo-650" : "bg-gray-300 dark:bg-slate-700"}`}
                onClick={() => setPrefs(p => ({ ...p, quiet_hours_start: p.quiet_hours_start != null ? null : 22, quiet_hours_end: p.quiet_hours_end != null ? null : 8 }))}>
                <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm transition-transform" style={{ backgroundColor: "#ffffff", transform: prefs.quiet_hours_start != null ? "translateX(20px)" : "translateX(0px)" }} />
              </div>
              <span className="text-xs font-semibold text-gray-700 dark:text-slate-355">Enable quiet hours</span>
            </label>

            {prefs.quiet_hours_start != null && (
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <label className="label text-[10px]">From (UTC)</label>
                  <select className="input py-2 text-xs w-32"
                    value={prefs.quiet_hours_start ?? 22}
                    onChange={e => setPrefs(p => ({ ...p, quiet_hours_start: Number(e.target.value) }))}>
                    {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>)}
                  </select>
                </div>
                <div className="text-gray-450 dark:text-slate-500 text-xs mt-4">→</div>
                <div>
                  <label className="label text-[10px]">To (UTC)</label>
                  <select className="input py-2 text-xs w-32"
                    value={prefs.quiet_hours_end ?? 8}
                    onChange={e => setPrefs(p => ({ ...p, quiet_hours_end: Number(e.target.value) }))}>
                    {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>)}
                  </select>
                </div>
                <div className="mt-5 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-400 font-semibold">
                  Silent {String(prefs.quiet_hours_start).padStart(2,"0")}:00 – {String(prefs.quiet_hours_end ?? 8).padStart(2,"0")}:00 UTC
                </div>
              </div>
            )}
          </Section>

          {/* Other notifications */}
          <Section title="Lifecycle notifications" icon={Bell}>
            <div className="space-y-4">
              {[
                { key: "notify_resolved",     label: "Incident resolved",     desc: "Get alerted when your service incident is resolved" },
                { key: "notify_acknowledged", label: "Incident acknowledged", desc: "Get alerted when someone acknowledges your service incident" },
              ].map(item => (
                <label key={item.key} className="flex items-start gap-3 cursor-pointer group">
                  <div className={`relative w-10 h-5 rounded-full mt-0.5 transition-colors shrink-0 ${(prefs as any)[item.key] ? "bg-indigo-650" : "bg-gray-300 dark:bg-slate-700"}`}
                    onClick={() => setPrefs(p => ({ ...p, [item.key]: !(p as any)[item.key] }))}>
                    <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm transition-transform" style={{ backgroundColor: "#ffffff", transform: (prefs as any)[item.key] ? "translateX(20px)" : "translateX(0px)" }} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-800 dark:text-slate-200">{item.label}</div>
                    <div className="text-[10px] text-gray-450 dark:text-slate-500 mt-0.5">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </Section>
        </>
      )}

      {/* Save / Reset */}
      <div id="prefs-save" className="flex items-center gap-3 pb-6">
        <button onClick={save} disabled={saving} className="btn-primary gap-2 py-2 px-4 text-xs font-semibold">
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
            : <><Save className="w-4 h-4" />Save Preferences</>
          }
        </button>
        <button onClick={() => setPrefs(DEFAULT_PREFS)} className="btn-secondary gap-2 text-xs font-semibold py-2 px-4">
          <RotateCcw className="w-3.5 h-3.5" /> Reset to Defaults
        </button>
      </div>
    </div>
  );
}
