"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, CheckCircle, AlertTriangle, Zap, Tag, Loader2, Sparkles, RefreshCw, Server, Terminal, FileText, Copy, ExternalLink, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { getUser, hasPermission } from "@/lib/auth";
import { copyToClipboard } from "@/lib/utils";

interface Incident {
  id: string; pod_name: string; namespace: string; container_name?: string;
  crash_reason: string; restart_count: number; exit_code?: number;
  pod_labels?: Record<string,string>; severity: string; status: string;
  first_seen_at: string; last_seen_at: string; resolved_at?: string;
  cluster_name?: string; rule_name?: string;
  acknowledged_by_name?: string; resolved_by_name?: string;
  ai_diagnosis?: { root_cause?: string; fix_steps?: string[]; kubectl_commands?: string[]; prevention?: string; estimated_fix_time?: string; };
}

const SEV: Record<string,string> = {
  critical: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20",
  warning:  "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
  info:     "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
};
const STS: Record<string,string> = {
  open:         "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-100 dark:border-red-500/20",
  acknowledged: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-500/20",
  resolved:     "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-100 dark:border-green-500/20",
};

function timeAgo(iso: string) {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-100 dark:border-slate-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-slate-400 w-36 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-slate-100 text-right">{value}</span>
    </div>
  );
}

function Code({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group my-2">
      <pre className="bg-gray-900 text-green-400 text-xs font-mono rounded-xl px-4 py-3 overflow-x-auto leading-relaxed">{code}</pre>
      <button onClick={async () => { await copyToClipboard(code); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg transition-all">
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

export default function IncidentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { confirm } = useConfirm();
  const [incident, setIncident] = useState<Incident|null>(null);
  const [loading, setLoading] = useState(true);
  const [diagLoading, setDiagLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [logs, setLogs] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState<boolean>(true);
  const [logsError, setLogsError] = useState<{ message: string; status?: number } | null>(null);
  const [showAiSelector, setShowAiSelector] = useState(false);
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [aiSettings, setAiSettings] = useState<any>(null);
  const me = getUser();
  const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL || "https://srevox-website.vercel.app";

  const loadLogs = async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const res = await api.get(`/api/incidents/${id}/logs`);
      setLogs(res.data.logs || "");
    } catch (err: any) {
      console.error("Failed to load logs:", err);
      const status = err.response?.status;
      const detail = err.response?.data?.detail || err.message || "Failed to load logs";
      setLogsError({ message: detail, status });
    } finally {
      setLogsLoading(false);
    }
  };

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const r = await api.get(`/api/incidents/${id}`);
      setIncident(r.data.incident || r.data);
      loadLogs();
    } catch (err: any) {
      if (err.response?.status !== 404) {
        toastError("Failed to load incident");
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      load();
    }
  }, [id]);

  const acknowledge = async () => {
    setActing(true);
    try { 
      await api.patch(`/api/incidents/${id}/acknowledge`); 
      success("Acknowledged"); 
      window.dispatchEvent(new Event("sv_notifications_changed"));
      load(true); 
    }
    catch { toastError("Failed"); } finally { setActing(false); }
  };

  const resolve = async () => {
    const { confirmed } = await confirm({ title:"Mark as resolved?", message:"This will mark the incident resolved.", confirmLabel:"Mark resolved", variant:"info" });
    if (!confirmed) return;
    setActing(true);
    try { 
      await api.patch(`/api/incidents/${id}/resolve`); 
      success("Incident resolved ✅"); 
      window.dispatchEvent(new Event("sv_notifications_changed"));
      load(true); 
    }
    catch { toastError("Failed"); } finally { setActing(false); }
  };

  const deleteThisIncident = async () => {
    const { confirmed } = await confirm({
      title: "Delete Incident?",
      message: "Are you sure you want to permanently delete this incident? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger"
    });
    if (!confirmed) return;
    setActing(true);
    try {
      await api.delete(`/api/incidents/${id}`);
      success("Incident deleted successfully");
      window.dispatchEvent(new Event("sv_notifications_changed"));
      router.push("/dashboard/incidents");
    } catch (err) {
      toastError("Failed to delete incident");
    } finally {
      setActing(false);
    }
  };

  const diagnose = async () => {
    setDiagLoading(true);
    try {
      const res = await api.get("/api/ai-settings");
      setAiSettings(res.data);
      
      const list: string[] = [];
      if (res.data.keys_configured?.groq) list.push("groq");
      if (res.data.keys_configured?.openai) list.push("openai");
      if (res.data.keys_configured?.anthropic) list.push("anthropic");
      if (res.data.provider === "ollama") list.push("ollama");

      if (list.length > 1) {
        setConfiguredProviders(list);
        setShowAiSelector(true);
        setDiagLoading(false);
      } else {
        const providerToUse = list[0] || res.data.provider || "groq";
        await runDiagnosis(providerToUse);
      }
    } catch {
      await runDiagnosis();
    }
  };

  const runDiagnosis = async (selectedProvider?: string) => {
    setDiagLoading(true);
    setShowAiSelector(false);
    try {
      const r = await api.post(`/api/incidents/${id}/diagnose`, { provider: selectedProvider });
      setIncident(p => p ? { ...p, ai_diagnosis: r.data.diagnosis } : p);
      success("AI diagnosis complete!");
      loadLogs();
    } catch {
      toastError(
        "AI diagnosis failed",
        <span>
          Make sure your provider API keys are correctly configured in <Link href="/settings/ai" className="underline font-semibold hover:text-indigo-600 dark:hover:text-indigo-400">AI settings</Link>.
        </span>
      );
    } finally {
      setDiagLoading(false);
    }
  };

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 bg-gray-100 dark:bg-slate-800 rounded w-32"/>
      <div className="card p-6 space-y-3">
        <div className="flex gap-2"><div className="h-6 bg-gray-100 dark:bg-slate-800 rounded-full w-20"/><div className="h-6 bg-gray-100 dark:bg-slate-800 rounded-full w-16"/></div>
        <div className="h-8 bg-gray-100 dark:bg-slate-800 rounded w-56"/>
        <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-24"/>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-6 space-y-4">{[...Array(5)].map((_,i)=><div key={i} className="h-4 bg-gray-100 dark:bg-slate-800 rounded"/>)}</div>
        <div className="card p-6 h-64 flex items-center justify-center"><div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl"/></div>
      </div>
    </div>
  );

  if (!incident) return (
    <div className="text-center py-12 max-w-md mx-auto mt-10 card p-8 border border-red-100 dark:border-red-500/10 bg-white dark:bg-[#13151f] shadow-lg rounded-2xl">
      <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4 animate-bounce" />
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Incident Deleted</h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">This incident has been deleted and is no longer available.</p>
      <Link href="/dashboard/incidents" className="btn-primary w-full inline-flex justify-center py-2.5">Back to incidents</Link>
    </div>
  );

  const labels = incident.pod_labels && Object.keys(incident.pod_labels).length > 0 ? incident.pod_labels : null;

  return (
    <div className="space-y-5">
      <Link href="/dashboard/incidents" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"/> Back to incidents
      </Link>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${SEV[incident.severity]||""}`}>{incident.severity}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STS[incident.status]||""}`}>{incident.status}</span>
              {incident.cluster_name && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20">{incident.cluster_name}</span>}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{incident.pod_name}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{incident.namespace}</p>
          </div>
          {(hasPermission(me, "acknowledgeIncident") || hasPermission(me, "resolveIncident") || hasPermission(me, "deleteIncident")) && (
            <div className="flex items-center gap-2 flex-wrap">
              {incident.status === "open" && hasPermission(me, "acknowledgeIncident") && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); acknowledge(); }}
                  disabled={acting}
                  className="btn-secondary gap-2"
                >
                  {acting?<Loader2 className="w-4 h-4 animate-spin"/>:<Clock className="w-4 h-4"/>} Acknowledge
                </button>
              )}
              {incident.status !== "resolved" && hasPermission(me, "resolveIncident") && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); resolve(); }}
                  disabled={acting}
                  className="btn-primary gap-2"
                >
                  {acting?<Loader2 className="w-4 h-4 animate-spin"/>:<CheckCircle className="w-4 h-4"/>} Mark resolved
                </button>
              )}
              {hasPermission(me, "deleteIncident") && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); deleteThisIncident(); }}
                  disabled={acting}
                  className="btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 border-red-200 dark:border-red-500/20 gap-2 font-semibold"
                >
                  <Trash2 className="w-4 h-4"/> Delete Incident
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-indigo-500"/>
              <h2 className="font-bold text-gray-900 dark:text-white">Incident details</h2>
            </div>
            <Row label="Crash reason"  value={<span className="font-mono text-red-600 dark:text-red-400">{incident.crash_reason}</span>}/>
            {incident.cluster_name && <Row label="Cluster" value={<span className="inline-flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400 font-semibold"><Server className="w-3.5 h-3.5"/>{incident.cluster_name}</span>}/>}
            <Row label="Restart count" value={<span className="text-orange-600 dark:text-orange-400 font-bold">{incident.restart_count}</span>}/>
            <Row label="Namespace"     value={incident.namespace}/>
            {incident.container_name && <Row label="Container" value={<span className="font-mono">{incident.container_name}</span>}/>}
            {incident.exit_code != null && <Row label="Exit code" value={<span className="font-mono">{incident.exit_code}</span>}/>}
            <Row label="First seen" value={timeAgo(incident.first_seen_at)}/>
            <Row label="Last seen"  value={timeAgo(incident.last_seen_at)}/>
            <Row
              label="Acknowledged by"
              value={incident.acknowledged_by_name ? (
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{incident.acknowledged_by_name}</span>
              ) : (
                <span className="text-gray-400 dark:text-slate-500 font-normal">Not acknowledged yet</span>
              )}
            />
            <Row
              label="Resolved by"
              value={incident.resolved_by_name ? (
                <span className="text-green-600 dark:text-green-400 font-semibold">{incident.resolved_by_name}</span>
              ) : (
                <span className="text-gray-400 dark:text-slate-500 font-normal">Not resolved yet</span>
              )}
            />
            {incident.resolved_at && <Row label="Resolved at" value={timeAgo(incident.resolved_at)}/>}
            {incident.rule_name && <Row label="Alert rule" value={incident.rule_name}/>}
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-indigo-500"/>
              <h2 className="font-bold text-gray-900 dark:text-white">Pod labels</h2>
            </div>
            {labels ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(labels).map(([k,v])=>(
                  <span key={k} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 font-mono">{k}={v}</span>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 dark:text-slate-500">No labels</p>}
          </div>
        </div>

        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-500"/>
              <h2 className="font-bold text-gray-900 dark:text-white">AI Diagnosis</h2>
            </div>
            {logs ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20" title="Logs are loaded and will be used to diagnose the crash">
                <CheckCircle className="w-3 h-3 text-emerald-500" /> logs context attached
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20" title="Logs are not available. AI will diagnose using metadata.">
                <AlertTriangle className="w-3 h-3 text-amber-500" /> diagnosing without logs
              </span>
            )}
          </div>
          {incident.ai_diagnosis ? (
            <div className="space-y-4 flex-1 overflow-y-auto">
              {incident.ai_diagnosis.root_cause && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">Root cause</p>
                  <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed bg-red-50 dark:bg-red-500/10 rounded-xl p-3 border border-red-100 dark:border-red-500/20">{incident.ai_diagnosis.root_cause}</p>
                </div>
              )}
              {incident.ai_diagnosis.fix_steps && incident.ai_diagnosis.fix_steps.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">Fix steps</p>
                  <ol className="space-y-2">
                    {incident.ai_diagnosis.fix_steps.map((s,i)=>(
                      <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-slate-300">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {incident.ai_diagnosis.kubectl_commands && incident.ai_diagnosis.kubectl_commands.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">kubectl commands</p>
                  {incident.ai_diagnosis.kubectl_commands.map((c,i)=><Code key={i} code={c}/>)}
                </div>
              )}
              {incident.ai_diagnosis.prevention && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">Prevention</p>
                  <p className="text-sm text-gray-700 dark:text-slate-300 bg-green-50 dark:bg-green-500/10 rounded-xl p-3 border border-green-100 dark:border-green-500/20">{incident.ai_diagnosis.prevention}</p>
                </div>
              )}
              {hasPermission(me, "runDiagnosis") && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    diagnose();
                  }}
                  disabled={diagLoading}
                  className="btn-secondary text-xs gap-2 mt-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${diagLoading?"animate-spin":""}`}/> Re-run diagnosis
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-8">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-indigo-400"/>
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">AI-powered root cause analysis</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-5 leading-relaxed">On-demand analysis — never automatic.</p>
              {hasPermission(me, "runDiagnosis") ? (
                <button onClick={diagnose} disabled={diagLoading} className="btn-primary gap-2">
                  {diagLoading?<><Loader2 className="w-4 h-4 animate-spin"/>Analyzing...</>:<><Sparkles className="w-4 h-4"/>Run AI Diagnosis</>}
                </button>
              ) : (
                <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-full">Only members and admins can run AI diagnosis</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Container Logs */}
      <div className="card p-5 mt-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-500"/>
            <h2 className="font-bold text-gray-900 dark:text-white">Container Logs</h2>
          </div>
          <div className="flex items-center gap-2">
            {logs && (
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  await copyToClipboard(logs);
                  success("Logs copied to clipboard");
                }}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5"/> Copy Logs
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                loadLogs();
              }}
              disabled={logsLoading}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin" : ""}`}/> {logsLoading && logs ? "Reloading..." : "Reload Logs"}
            </button>
          </div>
        </div>

        {logsLoading && logs === null ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2"/>
            <span className="text-sm text-gray-500 dark:text-slate-400 font-medium animate-pulse">Fetching logs from Kubernetes cluster...</span>
          </div>
        ) : logsError ? (
          <div className="border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-400 text-sm">
                  {logsError.status === 404 || logsError.message.includes("404") || logsError.message.toLowerCase().includes("not found")
                    ? "Pod logs not available"
                    : "Failed to retrieve logs"}
                </h3>
                <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-1">
                  {logsError.status === 404 || logsError.message.includes("404") || logsError.message.toLowerCase().includes("not found")
                    ? "The pod might have been stopped, terminated, or replaced by a new deployment."
                    : logsError.message}
                </p>
              </div>
            </div>

            {/* Options to Configure Logs / Metrics */}
            {!(logsError.status === 404 || logsError.message.includes("404") || logsError.message.toLowerCase().includes("not found")) && (
              <div className="mt-4 pt-4 border-t border-red-200/20 dark:border-red-500/10 space-y-4">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-xs font-bold text-gray-800 dark:text-slate-300 uppercase tracking-wider">Configure Metrics & Logs Connectivity</h4>
                </div>
                
                <p className="text-xs text-gray-550 dark:text-slate-400 leading-relaxed">
                  To stream real-time container logs directly in your browser, Srevox needs read access to your cluster's API Server. If your cluster is in <strong>Agent-Only</strong> mode or doesn't have metrics connection set up, you can configure it via one of the following methods:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Method 1: Service Account Token */}
                  <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl p-4 border border-gray-150 dark:border-slate-800/60 flex flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-500/10 mb-2">
                        Recommended
                      </span>
                      <h5 className="text-xs font-bold text-gray-900 dark:text-white mb-1">Service Account Token</h5>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-normal">
                        Create a lightweight read-only ServiceAccount in your cluster and save its token secret.
                      </p>
                    </div>
                    <div className="mt-4">
                      <Link
                        href="/dashboard/clusters"
                        className="inline-flex items-center justify-center w-full px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                      >
                        Configure Cluster <ExternalLink className="w-3 h-3 ml-1.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Method 2: Kubeconfig Paste */}
                  <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl p-4 border border-gray-150 dark:border-slate-800/60 flex flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200/50 dark:border-slate-700/50 mb-2">
                        Direct YAML
                      </span>
                      <h5 className="text-xs font-bold text-gray-900 dark:text-white mb-1">Kubeconfig File</h5>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-normal">
                        Paste your cluster's administrative kubeconfig configuration directly for secure, in-browser access.
                      </p>
                    </div>
                    <div className="mt-4">
                      <Link
                        href="/dashboard/clusters"
                        className="inline-flex items-center justify-center w-full px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 transition-all"
                      >
                        Paste Kubeconfig <ExternalLink className="w-3 h-3 ml-1.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(logsError.status === 403 || logsError.message.toLowerCase().includes("forbidden") || logsError.message.toLowerCase().includes("rbac")) && (
              <div className="mt-3 pt-3 border-t border-red-200/50 dark:border-red-500/10 space-y-3">
                <p className="text-xs font-medium text-gray-700 dark:text-slate-300">
                  This is typically caused by insufficient Kubernetes RBAC permissions for the <code>srevox-agent</code> ServiceAccount.
                </p>
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">How to Fix (RBAC Configuration)</span>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    Add the <code>"pods/log"</code> resource to your agent's ClusterRole. Apply the following patch command directly via terminal:
                  </p>
                  <pre className="bg-gray-900 text-green-400 text-xs font-mono rounded-xl p-3.5 overflow-x-auto leading-relaxed border border-gray-800">
{`kubectl patch clusterrole srevox-agent --type='json' -p='[{"op": "add", "path": "/rules/0/resources/-", "value": "pods/log"}]'`}
                  </pre>
                  <div className="flex items-center gap-2 pt-1.5">
                    <Link
                      href={`${websiteUrl}/docs`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold inline-flex items-center gap-1"
                    >
                      Open RBAC Guide <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative group">
            <div className="max-h-[350px] overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-800 bg-[#0d0e15] p-4 text-xs font-mono text-gray-300 scrollbar-thin">
              {logs ? (
                <pre className="whitespace-pre-wrap break-all leading-relaxed">{logs}</pre>
              ) : (
                <div className="py-8 text-center text-gray-550 dark:text-slate-500 italic">
                  No container logs returned from the pod.
                </div>
              )}
            </div>
            {logs && (
              <span className="absolute bottom-2 right-3 text-[10px] text-gray-500 dark:text-slate-500 bg-[#0d0e15]/80 px-2 py-0.5 rounded backdrop-blur">
                Showing last 100 lines
              </span>
            )}
          </div>
        )}
      </div>

      {showAiSelector && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-modal-slide-up space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Select AI Engine</h3>
              <p className="text-[11px] text-gray-555 dark:text-slate-400 mt-1">
                Multiple AI provider keys are configured. Select which engine to use for analyzing this incident:
              </p>
            </div>

            <div className="space-y-2">
              {configuredProviders.map(prov => {
                const label = prov === "groq" ? "Groq (Llama-3)"
                            : prov === "openai" ? "OpenAI (GPT-4o)"
                            : prov === "anthropic" ? "Anthropic (Claude)"
                            : "Ollama (Local)";
                const desc = prov === "groq" ? "Ultra-fast log parsing"
                           : prov === "openai" ? "Detailed logical flow tracing"
                           : prov === "anthropic" ? "Advanced context understanding"
                           : "Self-hosted offline model";
                return (
                  <button
                    key={prov}
                    onClick={() => runDiagnosis(prov)}
                    className="w-full text-left p-3 border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#13151f] hover:border-indigo-500 hover:bg-indigo-50/10 dark:hover:bg-indigo-500/5 transition-all group flex justify-between items-center"
                  >
                    <div>
                      <div className="text-xs font-bold text-gray-800 dark:text-slate-200 group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">
                        {label}
                      </div>
                      <div className="text-[9px] text-gray-450 dark:text-slate-500 mt-0.5">
                        {desc}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAiSelector(false)}
                className="w-full py-2 border border-gray-300 dark:border-slate-700/80 text-xs font-bold rounded-xl text-gray-750 dark:text-slate-200 bg-gray-50 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800/80 transition-all flex items-center justify-center gap-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
