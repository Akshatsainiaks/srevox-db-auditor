import { useEffect, useState } from "react";
import { Activity, AlertCircle, Loader2, RefreshCw, Key, Copy, Check, ShieldAlert } from "lucide-react";
import { api, fetchCluster, regenerateAgentToken, regenerateClusterId } from "@/lib/api";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";

export default function EditModal({
  clusterId,
  onClose,
  onSaved
}: {
  clusterId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [masterAlertsEnabled, setMasterAlertsEnabled] = useState(true);
  const [workerAlertsEnabled, setWorkerAlertsEnabled] = useState(true);
  const [nodeCpuThreshold, setNodeCpuThreshold] = useState(85);
  const [nodeMemoryThreshold, setNodeMemoryThreshold] = useState(90);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error } = useToast();
  const { confirm } = useConfirm();

  const [activeTab, setActiveTab] = useState<"alerts" | "connection">("alerts");
  const [method, setMethod] = useState<"token" | "kubeconfig" | "agent_only">("agent_only");
  const [apiServerUrl, setApiServerUrl] = useState("");
  const [saToken, setSaToken] = useState("");
  const [currentClusterId, setCurrentClusterId] = useState(clusterId);
  const [currentAgentToken, setCurrentAgentToken] = useState("");
  const [regeneratingToken, setRegeneratingToken] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [regenResult, setRegenResult] = useState<{ newToken?: string; newClusterId?: string; updateCmd: string; instructions?: string } | null>(null);
  const [skipTlsVerify, setSkipTlsVerify] = useState(false);
  const [kubeconfig, setKubeconfig] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleCopy = (key: string, val: string) => {
    copyToClipboard(val).then(() => {
      setCopiedKey(key);
      success("Copied to clipboard!");
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  useEffect(() => {
    fetchCluster(clusterId)
      .then((cl) => {
        setName(cl.name);
        setCurrentClusterId(cl.cluster_id || clusterId);
        setMasterAlertsEnabled(cl.master_alerts_enabled ?? true);
        setWorkerAlertsEnabled(cl.worker_alerts_enabled ?? true);
        setNodeCpuThreshold(cl.node_cpu_threshold ?? 85);
        setNodeMemoryThreshold(cl.node_memory_threshold ?? 90);
        setMethod(cl.kubeconfig_encrypted ? "kubeconfig" : cl.api_server_url ? "token" : "agent_only");
        setApiServerUrl(cl.api_server_url || "");
        setSaToken(cl.sa_token ? "••••••••••••••••" : "");
        setCurrentAgentToken((cl.agent_token && cl.agent_token.startsWith("agt")) ? cl.agent_token : "");
        setSkipTlsVerify(cl.skip_tls_verify ?? false);
        setKubeconfig(cl.kubeconfig_encrypted || "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clusterId]);

  const handleRegenerateToken = async () => {
    const { confirmed } = await confirm({
      title: "Regenerate Agent Token",
      message: "Regenerating the Agent Token will immediately invalidate your current watcher token. You MUST update your srevox-agent deployment in Kubernetes with the new token to keep it connected.",
      variant: "warning",
      confirmLabel: "Regenerate Token"
    });
    if (!confirmed) return;

    setRegeneratingToken(true);
    setRegenResult(null);
    try {
      const res = await regenerateAgentToken(currentClusterId);
      setCurrentAgentToken(res.agent_token);
      setRegenResult({
        newToken: res.agent_token,
        updateCmd: res.update_command,
        instructions: res.instructions
      });
      success("Agent token regenerated!", "Copy the command below to update your cluster agent.");
      onSaved();
    } catch (e: any) {
      error("Failed to regenerate token", e.response?.data?.detail || e.message);
    } finally {
      setRegeneratingToken(false);
    }
  };

  const handleRegenerateClusterId = async () => {
    const { confirmed } = await confirm({
      title: "Regenerate Cluster ID",
      message: "Regenerating the Cluster ID will assign a new unique ID to this cluster. You MUST update your srevox-agent deployment in Kubernetes with the new CLUSTER_ID environment variable.",
      variant: "warning",
      confirmLabel: "Regenerate Cluster ID"
    });
    if (!confirmed) return;

    setRegeneratingId(true);
    setRegenResult(null);
    try {
      const res = await regenerateClusterId(currentClusterId);
      setCurrentClusterId(res.new_cluster_id);
      setRegenResult({
        newClusterId: res.new_cluster_id,
        updateCmd: res.update_command,
        instructions: res.instructions
      });
      success("Cluster ID regenerated!", "Copy the command below to update your cluster agent environment.");
      onSaved();
    } catch (e: any) {
      error("Failed to regenerate cluster ID", e.response?.data?.detail || e.message);
    } finally {
      setRegeneratingId(false);
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await api.patch(`/api/clusters/${clusterId}`, {
        name: trimmed,
        master_alerts_enabled: masterAlertsEnabled,
        worker_alerts_enabled: workerAlertsEnabled,
        node_cpu_threshold: Number(nodeCpuThreshold),
        node_memory_threshold: Number(nodeMemoryThreshold),
      });
      success("Cluster updated", `${trimmed} settings saved`);
      onSaved();
      onClose();
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || "Failed to update cluster";
      error("Failed to update cluster", errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMetrics = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await api.post(`/api/clusters/${clusterId}/metrics-connection`, {
        method,
        api_server_url: apiServerUrl,
        sa_token: saToken,
        skip_tls_verify: skipTlsVerify,
        kubeconfig,
      });
      setTestResult({ success: true, message: res.data.message });
      success("Connection saved", res.data.message);
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || "Connection failed";
      setTestResult({ success: false, message: errMsg });
      error("Connection failed", errMsg);
    } finally {
      setTestingConnection(false);
      onSaved();
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
      <div className="bg-white dark:bg-[#1e2130] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-gray-900 dark:text-white">Edit Cluster Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-xl">&times;</button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/10 shrink-0">
          <button
            onClick={() => setActiveTab("alerts")}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === "alerts"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900/30"
                : "border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400"
            }`}
          >
            Alerts & General
          </button>
          <button
            onClick={() => setActiveTab("connection")}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === "connection"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900/30"
                : "border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400"
            }`}
          >
            Metrics Connection
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === "alerts" ? (
            <div className="space-y-4">
              <div>
                <label className="label">Cluster name</label>
                <input className="input" value={name} onChange={e=>setName(e.target.value)} autoFocus onKeyDown={e=>e.key==="Enter"&&save()} />
              </div>

              <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Node Status Alerts</h3>
                
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={masterAlertsEnabled}
                      onChange={(e) => setMasterAlertsEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-200 dark:border-slate-700 text-indigo-600 bg-white dark:bg-slate-800 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Enable Master Node alerts</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={workerAlertsEnabled}
                      onChange={(e) => setWorkerAlertsEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-200 dark:border-slate-700 text-indigo-600 bg-white dark:bg-slate-800 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Enable Worker Node alerts</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="label flex items-center justify-between text-xs mb-1.5">
                      <span>CPU Warn (%)</span>
                      <span className="font-semibold text-indigo-500">{nodeCpuThreshold}%</span>
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={nodeCpuThreshold}
                      onChange={(e) => setNodeCpuThreshold(Number(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-gray-200 rounded-lg appearance-none"
                    />
                  </div>

                  <div>
                    <label className="label flex items-center justify-between text-xs mb-1.5">
                      <span>Mem Warn (%)</span>
                      <span className="font-semibold text-indigo-500">{nodeMemoryThreshold}%</span>
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={nodeMemoryThreshold}
                      onChange={(e) => setNodeMemoryThreshold(Number(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-gray-200 rounded-lg appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Agent Credentials & Token Regeneration */}
              <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Cluster Credentials & Security</h3>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Manage Cluster ID and Watcher Agent Token credentials for srevox-agent</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-gray-50 dark:bg-slate-900/60 border border-gray-200/60 dark:border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
                    <span className="text-gray-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">Cluster ID</span>
                    <span className="text-gray-900 dark:text-white font-bold select-all truncate mt-0.5">{currentClusterId || "N/A"}</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-900/60 border border-gray-200/60 dark:border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
                    <span className="text-gray-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">Agent Token</span>
                    <span className="text-gray-900 dark:text-white font-bold select-all truncate mt-0.5">{currentAgentToken || "N/A"}</span>
                  </div>
                </div>

                {/* Copy options pills */}
                <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleCopy("cid", currentClusterId)}
                    className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-750 text-gray-700 dark:text-slate-300 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-colors border border-gray-200 dark:border-slate-700"
                  >
                    {copiedKey === "cid" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-indigo-500" />}
                    Copy Cluster ID
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy("atoken", currentAgentToken)}
                    className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-750 text-gray-700 dark:text-slate-300 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-colors border border-gray-200 dark:border-slate-700"
                  >
                    {copiedKey === "atoken" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-indigo-500" />}
                    Copy Agent Token
                  </button>
                </div>

                {/* Single regeneration buttons */}
                <div className="flex gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={handleRegenerateClusterId}
                    disabled={regeneratingId || regeneratingToken}
                    className="btn-secondary py-1.5 px-3 text-[11px] rounded-xl border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all flex items-center gap-1.5 font-bold flex-1 justify-center shadow-sm"
                  >
                    <RefreshCw className={`w-3 h-3 ${regeneratingId ? "animate-spin" : ""}`} />
                    Regenerate Cluster ID
                  </button>

                  <button
                    type="button"
                    onClick={handleRegenerateToken}
                    disabled={regeneratingId || regeneratingToken}
                    className="btn-secondary py-1.5 px-3 text-[11px] rounded-xl border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all flex items-center gap-1.5 font-bold flex-1 justify-center shadow-sm"
                  >
                    <Key className={`w-3 h-3 ${regeneratingToken ? "animate-spin" : ""}`} />
                    Regenerate Agent Token
                  </button>
                </div>

                {regenResult && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Credentials Updated! Update Your Agent Deployment:</span>
                    </div>
                    <p className="text-[11px] text-gray-600 dark:text-slate-300 leading-relaxed">
                      {regenResult.instructions || "Execute this command in your Kubernetes cluster to update srevox-agent environment variables:"}
                    </p>
                    <pre className="p-2.5 bg-gray-900 text-green-400 text-[11px] font-mono rounded-lg overflow-x-auto select-all border border-gray-800 leading-relaxed">
                      {regenResult.updateCmd}
                    </pre>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-amber-500 dark:text-amber-400 font-semibold">
                        ⚠️ Watcher agent will reconnect automatically once updated.
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy("cmd", regenResult.updateCmd)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 shrink-0"
                      >
                        {copiedKey === "cmd" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        Copy Command
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button onClick={save} disabled={!name||saving} className="btn-primary flex-1 justify-center">{saving?"Saving...":"Save changes"}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                  Provide metrics credentials to enable real-time CPU/memory metrics and log streaming inside incident pages.
                </p>
              </div>

              {/* Sub tabs selector */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-50 dark:bg-slate-900/20 rounded-xl border border-gray-150 dark:border-slate-800">
                {[
                  { id: "token", label: "Service Account" },
                  { id: "kubeconfig", label: "Kubeconfig" },
                  { id: "agent_only", label: "Agent Only" },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setMethod(item.id as any);
                      setTestResult(null);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      method === item.id
                        ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {method === "token" && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">API Server URL</label>
                    <input
                      type="text"
                      className="input mt-1 w-full bg-slate-50 dark:bg-slate-900 border-gray-200 dark:border-slate-850 rounded-xl px-3.5 py-2 text-xs focus:border-indigo-500 text-gray-800 dark:text-slate-200 font-mono"
                      placeholder="https://192.168.1.206:6443"
                      value={apiServerUrl}
                      onChange={e => setApiServerUrl(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Service Account Token</label>
                    <textarea
                      className="input mt-1 w-full bg-slate-50 dark:bg-slate-900 border-gray-200 dark:border-slate-855 rounded-xl px-3.5 py-2 text-xs focus:border-indigo-500 text-gray-800 dark:text-slate-200 font-mono h-20 resize-none"
                      placeholder="Paste service account token..."
                      value={saToken}
                      onChange={e => setSaToken(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-slate-500/[0.02] dark:bg-slate-500/[0.01] border border-gray-150/40 dark:border-slate-800/60 rounded-xl p-3 select-none">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Skip TLS Verify</label>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Allow self-signed cluster certificates (KubeSphere, RKE2, k3s)</p>
                    </div>
                    <button
                      onClick={() => setSkipTlsVerify(!skipTlsVerify)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
                        skipTlsVerify ? "bg-indigo-600" : "bg-gray-200 dark:bg-slate-700"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${skipTlsVerify ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>
              )}

              {method === "kubeconfig" && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Kubeconfig YAML</label>
                    <textarea
                      className="input mt-1.5 w-full bg-slate-50 dark:bg-slate-900 border-gray-200 dark:border-slate-850 rounded-xl px-3.5 py-3 text-xs focus:border-indigo-500 text-gray-800 dark:text-slate-200 font-mono h-32 resize-none"
                      placeholder="Paste kubeconfig YAML..."
                      value={kubeconfig}
                      onChange={e => setKubeconfig(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {method === "agent_only" && (
                <div className="py-6 text-center px-4 bg-indigo-500/[0.02] border border-dashed border-indigo-500/15 rounded-2xl">
                  <Activity className="w-7 h-7 text-indigo-400/80 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">Agent-Only Mode</p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 max-w-[280px] mx-auto mt-1 leading-relaxed">
                    Crash loop detection and alerting are fully operational. Metrics and log streaming features will be disabled.
                  </p>
                </div>
              )}

              {testResult && (
                <div className={`flex items-start gap-2.5 border rounded-xl px-3.5 py-3 ${
                  testResult.success
                    ? "bg-green-50/50 dark:bg-green-500/5 border-green-150 dark:border-green-500/15 text-green-700 dark:text-green-400"
                    : "bg-red-50/50 dark:bg-red-500/5 border-red-150 dark:border-red-500/15 text-red-600 dark:text-red-400"
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-none">{testResult.success ? "Success" : "Connection Failed"}</p>
                    <p className="text-[11px] font-mono mt-1 leading-normal break-all">{testResult.message}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={handleSaveMetrics}
                  disabled={testingConnection || (method === "token" && !apiServerUrl) || (method === "kubeconfig" && !kubeconfig)}
                  className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {testingConnection ? "Saving & Testing..." : "Save & Test Connection"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
