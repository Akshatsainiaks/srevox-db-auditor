"use client";
import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { updateRule, fetchRule } from "@/lib/api";
import type { AlertRule, Cluster, Channel } from "@/lib/utils";

const parseArr = (v: unknown): string[] => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
};

export default function EditModal({
  ruleId,
  clusters,
  channels,
  onClose,
  onSaved
}: {
  ruleId: string;
  clusters: Cluster[];
  channels: Channel[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [clusterId, setClusterId] = useState("");
  const [desc, setDesc] = useState("");
  const [namespaces, setNs] = useState("");
  const [minRst, setMinRst] = useState(3);
  const [cooldown, setCooldown] = useState(15);
  const [severity, setSeverity] = useState("warning");
  const [selChannels, setSelCh] = useState<string[]>([]);
  const [onlyIncrease, setOnlyIncrease] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRule(ruleId)
      .then((ru) => {
        setName(ru.name);
        setClusterId(ru.cluster_id || "");
        setDesc(ru.description || "");
        setNs(parseArr(ru.namespaces).join(", "));
        setMinRst(ru.min_restarts);
        setCooldown(ru.cooldown_minutes);
        setSeverity(ru.severity);
        setSelCh(parseArr(ru.channel_ids));
        setOnlyIncrease(ru.only_increase_restarts !== false);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ruleId]);

  const toggleCh = (id: string) =>
    setSelCh((p) => (p.includes(id) ? p.filter((c) => c !== id) : [...p, id]));

  const submit = async () => {
    if (!name || !clusterId) return;
    setSaving(true);
    try {
      await updateRule(ruleId, {
        name,
        cluster_id: clusterId,
        description: desc,
        namespaces: namespaces ? namespaces.split(",").map((s) => s.trim()).filter(Boolean) : [],
        min_restarts: minRst,
        cooldown_minutes: cooldown,
        severity,
        channel_ids: selChannels,
        only_increase_restarts: onlyIncrease
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#07080d]/75 backdrop-blur-[6px] flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-[#13151f] rounded-3xl p-8 border border-gray-100 dark:border-slate-800/80 shadow-2xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2130] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-[#1e2130]">
          <h2 className="font-bold text-gray-900 dark:text-white">Edit alert rule</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 text-xl"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="label">Rule name</label><input className="input" placeholder="Production critical" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div><label className="label">Description (optional)</label><input className="input" placeholder="Alert on all production crashes" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div>
            <label className="label">Cluster</label>
            <select className="input" value={clusterId} onChange={(e) => setClusterId(e.target.value)}>
              {clusters.map((c) => <option key={c.cluster_id} value={c.cluster_id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Namespaces (comma-separated, empty = all)</label><input className="input" placeholder="production, staging" value={namespaces} onChange={(e) => setNs(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Min restarts to alert</label><input type="number" className="input" min={1} value={minRst} onChange={(e) => setMinRst(Number(e.target.value))} /><p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Noise filter</p></div>
            <div><label className="label">Cooldown (minutes)</label><input type="number" className="input" min={1} value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} /><p className="text-xs text-gray-400 dark:text-slate-500 mt-1">No repeat alerts</p></div>
          </div>
          <div className="flex items-start gap-3 bg-gray-50/50 dark:bg-slate-800/30 border border-gray-100 dark:border-slate-800 rounded-xl p-3 select-none">
            <input
              type="checkbox"
              id="edit-only-increase"
              checked={onlyIncrease}
              onChange={(e) => setOnlyIncrease(e.target.checked)}
              className="rounded mt-0.5"
            />
            <label htmlFor="edit-only-increase" className="cursor-pointer">
              <span className="text-xs font-semibold text-gray-800 dark:text-slate-200">Only notify on new restarts</span>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Skip duplicate alerts if the pod has not crashed further since the last alert</p>
            </label>
          </div>
          <div>
            <label className="label">Severity</label>
            <div className="flex gap-2">
              {(["info","warning","critical"] as const).map((s) => (
                <button key={s} onClick={() => setSeverity(s)} className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all capitalize ${severity === s ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Alert channels</label>
            {channels.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800 rounded-xl p-3">No channels yet. Add channels first.</p>
            ) : (
              <div className="space-y-2 bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                {channels.map((ch) => (
                  <label key={ch.channel_id} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={selChannels.includes(ch.channel_id)} onChange={() => toggleCh(ch.channel_id)} className="rounded" />
                    <span className="text-sm text-gray-700 dark:text-slate-300">{ch.name}</span>
                    <span className="badge bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-600 text-xs capitalize">{ch.type}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={submit} disabled={!name || !clusterId || saving} className="btn-primary flex-1 justify-center">{saving ? "Saving..." : "Save changes"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
