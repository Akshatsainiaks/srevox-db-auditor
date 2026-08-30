"use client";

import { useState } from "react";
import { Copy, CheckCircle } from "lucide-react";
import { createCluster } from "@/lib/api";
import type { Cluster } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/Toast";

const CONN_INFO: Record<string, { label: string; desc: string; color: string }> = {
  agent:       { label: "Agent (on-prem)",  desc: "Tiny pod inside your cluster. Outbound only — no inbound firewall rules.", color: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20" },
  kubeconfig:  { label: "Kubeconfig",       desc: "Upload a read-only kubeconfig. API server must be reachable from Srevox.", color: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" },
  self_hosted: { label: "Self-hosted",      desc: "Run Srevox entirely inside your own infrastructure.", color: "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-600" },
};
const CLOUD_PROVIDERS = ["aws","gcp","azure","on-prem","other"];

export default function AddModal({ onClose, onAdded }: { onClose:()=>void; onAdded:()=>void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("agent");
  const [provider, setProvider] = useState("other");
  const [kubeconfig, setKube] = useState("");
  const [result, setResult] = useState<Cluster|null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const { success, error } = useToast();

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await createCluster({ name: trimmed, connection_type: type, cloud_provider: provider, kubeconfig: kubeconfig||undefined });
      setResult(res); onAdded();
      success("Cluster added!", `${trimmed} is now connected`);
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || "Failed to add cluster";
      error("Failed to add cluster", errMsg);
    }
    finally { setLoading(false); }
  };

  const copyId = async (text: string) => { await copyToClipboard(text); setCopiedId(true); setTimeout(()=>setCopiedId(false),2000); };
  const copyCmd = async (text: string) => { await copyToClipboard(text); setCopiedCmd(true); setTimeout(()=>setCopiedCmd(false),2000); };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2130] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-[#1e2130]">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Add cluster</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Connect a Kubernetes cluster to Srevox</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 text-xl">&times;</button>
        </div>
        {result ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-100 dark:border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300 mb-1">Cluster added!</p>
                <div className="flex items-center gap-2 flex-wrap text-sm text-green-600 dark:text-green-500">
                  <span>Cluster ID:</span>
                  <span className="font-mono bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-lg select-all text-green-800 dark:text-green-300">{result.cluster_id}</span>
                  <button onClick={() => copyId(result.cluster_id)}
                    className="p-1.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-all shrink-0 shadow-sm"
                    title="Copy Cluster ID"
                  >
                    {copiedId ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            {result.install_command && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Run inside your cluster:</p>
                <div className="bg-gray-900 rounded-xl p-4 flex items-start gap-3">
                  <code className="text-green-400 text-xs font-mono break-all flex-1 leading-relaxed">{result.install_command}</code>
                  <button onClick={() => copyCmd(result.install_command!)} className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors">
                    {copiedCmd ? <CheckCircle className="w-4 h-4 text-green-400"/> : <Copy className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
            )}
            <button onClick={onClose} className="btn-primary w-full justify-center">Done</button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div>
              <label className="label">Cluster name <span className="text-red-500 font-bold">*</span></label>
              <input className="input" placeholder="production-us-east" value={name} onChange={e=>setName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Connection type</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.keys(CONN_INFO).map(t=>(
                  <button key={t} onClick={()=>setType(t)} className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${type===t?"border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400":"border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"}`}>
                    {CONN_INFO[t].label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-2">{CONN_INFO[type]?.desc}</p>
            </div>
            <div>
              <label className="label">Cloud provider</label>
              <select className="input" value={provider} onChange={e=>setProvider(e.target.value)}>
                {CLOUD_PROVIDERS.map(p=><option key={p} value={p}>{p.toUpperCase()}</option>)}
              </select>
            </div>
            {type==="kubeconfig" && (
              <div>
                <label className="label">Kubeconfig (read-only) <span className="text-red-500 font-bold">*</span></label>
                <textarea className="input font-mono text-xs h-28 resize-none" placeholder="Paste kubeconfig YAML..." value={kubeconfig} onChange={e=>setKube(e.target.value)} />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submit} disabled={!name.trim() || loading || (type === "kubeconfig" && !kubeconfig.trim())} className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                {loading?"Adding...":"Add cluster"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
