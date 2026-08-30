"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  AlertTriangle, RefreshCw, Server,
  ArrowLeft, Cpu, AlertCircle,
  Radio, Loader2, Key, ShieldAlert,
  Settings, BookOpen, X, Check, Copy, Activity, Lock, Trash2, Plus
} from "lucide-react";
import {
  api,
  fetchCluster,
  updateCluster,
  updateMetricsConnection,
  deleteCluster,
  regenerateAgentToken,
  regenerateClusterId
} from "@/lib/api";
import { type Cluster, copyToClipboard } from "@/lib/utils";
import ConnectionGuideModal from "@/components/clusters/ConnectionGuideModal";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { getUser, hasPermission } from "@/lib/auth";

export default function ClusterSettingsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { success, error } = useToast();
  const { confirm } = useConfirm();
  const me = getUser();

  const [sudoVerified, setSudoVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sudoToken, setSudoToken] = useState<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Load session state on mount if valid
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = sessionStorage.getItem("srevox_sudo_token");
      const storedLastActivity = sessionStorage.getItem("srevox_sudo_last_activity");
      if (storedToken && storedLastActivity) {
        const timeSinceActivity = Date.now() - Number(storedLastActivity);
        if (timeSinceActivity < 5 * 60 * 1000) {
          setSudoToken(storedToken);
          setSudoVerified(true);
          sessionStorage.setItem("srevox_sudo_last_activity", Date.now().toString());
          lastActivityRef.current = Date.now();
        } else {
          sessionStorage.removeItem("srevox_sudo_token");
          sessionStorage.removeItem("srevox_sudo_last_activity");
        }
      }
    }
  }, []);

  // Idle movement activity listeners
  useEffect(() => {
    if (!sudoVerified) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      if (typeof window !== "undefined") {
        sessionStorage.setItem("srevox_sudo_last_activity", Date.now().toString());
      }
    };

    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart"];
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= 5 * 60 * 1000) {
        setSudoVerified(false);
        setSudoToken(null);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("srevox_sudo_token");
          sessionStorage.removeItem("srevox_sudo_last_activity");
        }
        error("Sudo session expired due to inactivity. Please verify your password again.");
      }
    }, 1000);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(interval);
    };
  }, [sudoVerified, error]);

  const verifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setVerifying(true);
    try {
      const res = await api.post("/api/auth/verify-sudo-password", { password });
      if (res.data.success) {
        const dummyToken = "unlocked";
        setSudoToken(dummyToken);
        setSudoVerified(true);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("srevox_sudo_token", dummyToken);
          sessionStorage.setItem("srevox_sudo_last_activity", Date.now().toString());
        }
        lastActivityRef.current = Date.now();
        success("Settings unlocked", "Sudo mode activated successfully.");
      }
    } catch (err: any) {
      error("Incorrect security password. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const [showGuideModal, setShowGuideModal] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [cloudProvider, setCloudProvider] = useState("other");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempCloudProvider, setTempCloudProvider] = useState("other");

  // Metrics Connection states
  const [method, setMethod] = useState<"token" | "kubeconfig" | "agent_only">("agent_only");
  const [apiServerUrl, setApiServerUrl] = useState("");
  const [saToken, setSaToken] = useState("");
  const [skipTlsVerify, setSkipTlsVerify] = useState(false);
  const [kubeconfig, setKubeconfig] = useState("");

  const [isEditingConnection, setIsEditingConnection] = useState(false);
  const [tempMethod, setTempMethod] = useState<"token" | "kubeconfig" | "agent_only">("agent_only");
  const [tempApiServerUrl, setTempApiServerUrl] = useState("");
  const [tempSaToken, setTempSaToken] = useState("");
  const [tempSkipTlsVerify, setTempSkipTlsVerify] = useState(false);
  const [tempKubeconfig, setTempKubeconfig] = useState("");

  const [updatingName, setUpdatingName] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [currentClusterId, setCurrentClusterId] = useState(id);
  const [currentAgentToken, setCurrentAgentToken] = useState("");
  const [regeneratingToken, setRegeneratingToken] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [regenResult, setRegenResult] = useState<{ newToken?: string; newClusterId?: string; updateCmd: string; instructions?: string } | null>(null);

  const loadClusterData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const cl = await fetchCluster(id);
      setCluster(cl);
      setName(cl.name);
      setTempName(cl.name);
      setCurrentClusterId(cl.cluster_id || id);
      setCurrentAgentToken((cl.agent_token && cl.agent_token.startsWith("agt")) ? cl.agent_token : "");
      setCloudProvider(cl.cloud_provider || "other");
      setTempCloudProvider(cl.cloud_provider || "other");

      const defaultMethod = cl.kubeconfig_encrypted
        ? "kubeconfig"
        : cl.api_server_url
        ? "token"
        : "agent_only";
      setMethod(defaultMethod);
      setTempMethod(defaultMethod);
      setApiServerUrl(cl.api_server_url || "");
      setTempApiServerUrl(cl.api_server_url || "");
      const loadedSaToken = cl.sa_token || "";
      setSaToken(loadedSaToken);
      setTempSaToken(loadedSaToken);
      setSkipTlsVerify(cl.skip_tls_verify ?? false);
      setTempSkipTlsVerify(cl.skip_tls_verify ?? false);
      setKubeconfig(cl.kubeconfig_encrypted || "");
      setTempKubeconfig(cl.kubeconfig_encrypted || "");
    } catch (err) {
      console.error(err);
      error("Failed to load cluster details");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [id, error]);

  const handleCopy = (key: string, val: string) => {
    copyToClipboard(val).then(() => {
      setCopiedKey(key);
      success("Copied to clipboard!");
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

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
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/cluster/${res.new_cluster_id}/settings`);
      }
      success("Cluster ID regenerated!", "Copy the command below to update your cluster agent environment.");
    } catch (e: any) {
      error("Failed to regenerate cluster ID", e.response?.data?.detail || e.message);
    } finally {
      setRegeneratingId(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadClusterData(true);
    }
  }, [id, loadClusterData]);

  const handleUpdateGeneral = async () => {
    setUpdatingName(true);
    try {
      await updateCluster(id, {
        name: tempName,
        cloud_provider: tempCloudProvider,
      });
      success("General settings updated", "Cluster display name and provider saved successfully.");
      setName(tempName);
      setCloudProvider(tempCloudProvider);
      setIsEditingName(false);
      loadClusterData();
    } catch {
      error("Failed to update general settings");
    } finally {
      setUpdatingName(false);
    }
  };

  const handleCancelEditGeneral = () => {
    setTempName(name);
    setTempCloudProvider(cloudProvider);
    setIsEditingName(false);
  };



  const handleSaveMetrics = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await updateMetricsConnection(id, {
        method: tempMethod,
        api_server_url: tempApiServerUrl,
        sa_token: tempSaToken,
        skip_tls_verify: tempSkipTlsVerify,
        kubeconfig: tempKubeconfig,
      });
      setTestResult({ success: true, message: res.message });
      success("Connection saved", res.message);
      setMethod(tempMethod);
      setApiServerUrl(tempApiServerUrl);
      setSaToken(tempSaToken);
      setSkipTlsVerify(tempSkipTlsVerify);
      setKubeconfig(tempKubeconfig);
      setIsEditingConnection(false);
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || "Connection failed";
      setTestResult({ success: false, message: errMsg });
      // The backend always saves credentials prior to connection tests. So we close edit mode.
      success("Connection saved with warnings", errMsg);
      setMethod(tempMethod);
      setApiServerUrl(tempApiServerUrl);
      setSaToken(tempSaToken);
      setSkipTlsVerify(tempSkipTlsVerify);
      setKubeconfig(tempKubeconfig);
      setIsEditingConnection(false);
    } finally {
      setTestingConnection(false);
      await loadClusterData();
    }
  };

  const handleDelete = () => {
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cluster) return;
    setDeleting(true);
    try {
      const authRes = await api.post("/api/auth/verify-sudo-password", { password: deletePassword });
      if (!authRes.data.success) {
        throw new Error("Incorrect password.");
      }
      await deleteCluster(id);
      success("Cluster deleted", cluster.name);
      setDeleteModalOpen(false);
      setDeletePassword("");
      router.push("/dashboard/clusters");
    } catch (err: any) {
      error(err?.response?.data?.detail || "Incorrect security password. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="card py-16 text-center max-w-md mx-auto mt-12 bg-white dark:bg-[#13151f] border rounded-3xl">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cluster Not Found</h2>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">The cluster you are looking for does not exist or has been deleted.</p>
        <Link href="/dashboard/clusters" className="btn-primary mt-6 inline-flex items-center gap-1.5 py-2 px-4 rounded-xl">
          Back to Clusters
        </Link>
      </div>
    );
  }

  if (!sudoVerified) {
    return (
      <div className="flex items-center justify-center min-h-[55vh] px-4">
        <form onSubmit={verifyPassword} className="max-w-md w-full bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 p-8 rounded-3xl shadow-xl space-y-6 animate-modal-slide-up">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto text-indigo-500">
            <Lock className="w-6 h-6" />
          </div>
          
          <div className="text-center space-y-1.5">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Security Verification</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
              Please enter the organization security password to unlock cluster settings.
            </p>
          </div>

          {/* New Setup / Password Helper Box */}
          <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/20 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-300">
              <Key className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Default Security Password</span>
            </div>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed">
              Default security password for new setup is <code className="bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded font-mono font-bold text-indigo-800 dark:text-indigo-200">admin123</code>.
            </p>
            <div className="pt-1">
              <Link
                href="/settings/org"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Update Security Password in Organization Settings &rarr;
              </Link>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Security Password</label>
            <input
              type="password"
              placeholder="Enter security password (default: admin123)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input text-xs"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={verifying}
            className="btn-primary w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5"
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Unlock Cluster Settings"
            )}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col gap-4 border-b border-gray-200 dark:border-slate-800/80 pb-5">
        <div className="flex items-center justify-between">
          <Link href={`/cluster/${id}`} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-655 dark:hover:text-slate-200 transition-colors font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Cluster Summary
          </Link>
          <button
            onClick={() => setShowGuideModal(true)}
            className="btn-secondary flex items-center gap-1.5 text-[10px] py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-600 dark:text-slate-350 transition-colors font-bold shadow-sm"
          >
            <BookOpen className="w-3 h-3 text-indigo-500" />
            Connection Guide
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center shrink-0">
              <Settings className="w-5.5 h-5.5 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">Cluster Settings</h1>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">Manage details, warnings, connection credentials and alert rules for {cluster.name}</p>
            </div>
          </div>
          <div className="flex items-center shrink-0">
            <Link
              href={`/cluster/${id}/alerts`}
              className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3.5 h-[36px] rounded-xl text-white bg-indigo-650 hover:bg-indigo-700 transition-colors shadow-sm font-bold"
            >
              <Plus className="w-4 h-4" />
              Configure Alerts
            </Link>
          </div>
        </div>
      </div>

      {/* General Settings (Full Width Card) */}
      <div className="card p-6 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm select-text">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
          <h2 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-indigo-500" />
            General Settings
          </h2>
          <div className="flex items-center gap-2">
            {!isEditingName ? (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="btn-secondary text-[11px] font-bold py-1 px-3 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1"
              >
                Edit Details
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEditGeneral}
                  className="btn-secondary text-[11px] font-bold py-1 px-3 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateGeneral}
                  disabled={!tempName.trim() || updatingName}
                  className="btn-primary text-[11px] font-bold py-1 px-3 h-[28px] rounded-lg text-white bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {updatingName && <Loader2 className="w-3 h-3 animate-spin" />}
                  {updatingName ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          <div>
            <label className="label text-[10px] uppercase font-bold tracking-wider text-gray-400 dark:text-slate-500">Cluster Display Name</label>
            <input
              type="text"
              disabled={!isEditingName}
              className={`input mt-1.5 text-xs font-semibold w-full border-gray-300 dark:border-slate-800 rounded-xl px-3 py-2 text-gray-800 dark:text-slate-200 ${
                isEditingName ? "bg-white dark:bg-slate-900 border-indigo-500/50" : "bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed opacity-80"
              }`}
              value={isEditingName ? tempName : name}
              onChange={(e) => setTempName(e.target.value)}
            />
          </div>

          <div>
            <label className="label text-[10px] uppercase font-bold tracking-wider text-gray-400 dark:text-slate-500">Cloud Provider</label>
            <select
              disabled={!isEditingName}
              value={isEditingName ? tempCloudProvider : cloudProvider}
              onChange={(e) => setTempCloudProvider(e.target.value)}
              className={`input mt-1.5 text-xs font-semibold w-full border-gray-300 dark:border-slate-800 rounded-xl px-3 py-2 text-gray-800 dark:text-slate-200 cursor-pointer ${
                isEditingName ? "bg-white dark:bg-slate-900 border-indigo-500/50" : "bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed opacity-80"
              }`}
            >
              <option value="aws">AWS</option>
              <option value="gcp">GCP</option>
              <option value="azure">Azure</option>
              <option value="on-prem">On-Premises</option>
              <option value="other">Other / Custom</option>
            </select>
          </div>
        </div>
      </div>

      {/* Metrics Connection (Full Width Card) */}
      <div className="card p-6 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm select-text">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
          <h2 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-indigo-500" />
            Metrics Connection
          </h2>
          <div className="flex items-center gap-2">
            {!isEditingConnection ? (
              <button
                type="button"
                onClick={() => {
                  setTempMethod(method);
                  setTempApiServerUrl(apiServerUrl);
                  setTempSaToken(saToken);
                  setTempSkipTlsVerify(skipTlsVerify);
                  setTempKubeconfig(kubeconfig);
                  setIsEditingConnection(true);
                }}
                className="btn-secondary text-[11px] font-bold py-1 px-3 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1"
              >
                Edit Details
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingConnection(false)}
                  className="btn-secondary text-[11px] font-bold py-1 px-3 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMetrics}
                  disabled={testingConnection || (tempMethod === "token" && !tempApiServerUrl) || (tempMethod === "kubeconfig" && !tempKubeconfig)}
                  className="btn-primary text-[11px] font-bold py-1 px-3 h-[28px] rounded-lg text-white bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {testingConnection && <Loader2 className="w-3 h-3 animate-spin" />}
                  {testingConnection ? "Saving & Testing..." : "Save"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[11px] text-gray-500 dark:text-slate-500 leading-relaxed">
            Provide credentials to let Srevox query your Kubernetes API server for node and pod metrics.
          </p>

          {/* Connection Model Selector Dropdown */}
          <div className="max-w-md">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Connection Model</label>
            <select
              disabled={!isEditingConnection}
              value={isEditingConnection ? tempMethod : method}
              onChange={e => {
                const val = e.target.value as any;
                if (isEditingConnection) {
                  setTempMethod(val);
                  if (val === "agent_only") {
                    setTempApiServerUrl("");
                    setTempSaToken("");
                    setTempKubeconfig("");
                  } else if (val === "token") {
                    setTempKubeconfig("");
                    setTempSaToken(saToken || "");
                  } else if (val === "kubeconfig") {
                    setTempApiServerUrl("");
                    setTempSaToken("");
                    setTempKubeconfig(kubeconfig || "");
                  }
                } else {
                  setMethod(val);
                }
                setTestResult(null);
              }}
              className={`input mt-1.5 w-full border-gray-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer ${
                isEditingConnection ? "bg-white dark:bg-slate-900 border-indigo-500/50" : "bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed opacity-80"
              }`}
            >
              <option value="token">Service Account Token</option>
              <option value="kubeconfig">Kubeconfig YAML</option>
              <option value="agent_only">Agent Only</option>
            </select>
          </div>

          {(isEditingConnection ? tempMethod : method) === "token" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">API Server URL</label>
                <input
                  type="text"
                  disabled={!isEditingConnection}
                  className={`input mt-1.5 w-full border-gray-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono ${
                    isEditingConnection ? "bg-white dark:bg-slate-900 border-indigo-500/50" : "bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed opacity-80"
                  }`}
                  placeholder="https://10.155.0.10:6443"
                  value={isEditingConnection ? tempApiServerUrl : apiServerUrl}
                  onChange={e => setTempApiServerUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Service Account Token</label>
                <textarea
                  disabled={!isEditingConnection}
                  className={`input mt-1.5 w-full border-gray-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono h-20 resize-none ${
                    isEditingConnection ? "bg-white dark:bg-slate-900 border-indigo-500/50" : "bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed opacity-80"
                  }`}
                  placeholder="Paste service account token..."
                  value={isEditingConnection ? tempSaToken : saToken}
                  onChange={e => setTempSaToken(e.target.value)}
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-between bg-gray-55 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800/80 rounded-xl p-3.5 select-none max-w-md">
                <div>
                  <span className="text-xs font-bold text-gray-855 dark:text-slate-205">Skip TLS Verify</span>
                  <p className="text-[10px] text-gray-405 dark:text-slate-555 mt-0.5 leading-normal">
                    Allow self-signed cluster certificates (KubeSphere, RKE2, k3s)
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!isEditingConnection}
                  onClick={() => setTempSkipTlsVerify(!tempSkipTlsVerify)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    (isEditingConnection ? tempSkipTlsVerify : skipTlsVerify) ? "bg-indigo-500" : "bg-gray-200 dark:bg-slate-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span
                    style={{ backgroundColor: '#ffffff' }}
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                      (isEditingConnection ? tempSkipTlsVerify : skipTlsVerify) ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {(isEditingConnection ? tempMethod : method) === "kubeconfig" && (
            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Kubeconfig YAML</label>
                <textarea
                  disabled={!isEditingConnection}
                  className={`input mt-1.5 w-full border-gray-300 dark:border-slate-800 rounded-xl px-3 py-3 text-[11px] font-mono h-32 resize-none ${
                    isEditingConnection ? "bg-white dark:bg-slate-900 border-indigo-500/50" : "bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed opacity-80"
                  }`}
                  placeholder="Paste kubeconfig YAML..."
                  value={isEditingConnection ? tempKubeconfig : kubeconfig}
                  onChange={e => setTempKubeconfig(e.target.value)}
                />
              </div>
            </div>
          )}

          {(isEditingConnection ? tempMethod : method) === "agent_only" && (
            <div className="py-5 text-center px-4 bg-indigo-500/[0.01] border border-dashed border-indigo-500/15 rounded-2xl w-full">
              <Cpu className="w-7 h-7 text-indigo-400/80 mx-auto mb-2.5" />
              <p className="text-xs font-semibold text-gray-700 dark:text-slate-350">Agent-Only Mode</p>
              <p className="text-[10px] text-gray-455 dark:text-slate-500 max-w-xl mx-auto mt-1 leading-relaxed">
                Crash loop detection and alerting are fully operational. Metrics and log streaming features are disabled.
              </p>
            </div>
          )}

          {testResult && (
            <div className={`flex items-start gap-2.5 border rounded-xl px-3.5 py-3 w-full ${
              testResult.success
                ? "bg-green-50/50 dark:bg-green-500/5 border-green-150 dark:border-green-500/15 text-green-700 dark:text-green-400"
                : "bg-red-50/50 dark:bg-red-500/5 border-red-150 dark:border-red-500/15 text-red-650 dark:text-red-400"
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold leading-none">{testResult.success ? "Success" : "Connection Failed"}</p>
                <p className="text-[10px] font-mono mt-1 leading-normal break-all">{testResult.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cluster Credentials & Security (Full Width Card) */}
      <div className="card p-6 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm select-text">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-500" />
              Cluster Credentials & Security
            </h2>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Manage Cluster ID and Agent Token for srevox-agent watcher deployment</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleRegenerateClusterId}
              disabled={regeneratingId || regeneratingToken}
              className="btn-secondary py-1.5 px-3 text-[11px] rounded-xl border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all flex items-center gap-1.5 font-bold shadow-sm"
            >
              <RefreshCw className={`w-3 h-3 ${regeneratingId ? "animate-spin" : ""}`} />
              Regenerate Cluster ID
            </button>
            <button
              type="button"
              onClick={handleRegenerateToken}
              disabled={regeneratingId || regeneratingToken}
              className="btn-secondary py-1.5 px-3 text-[11px] rounded-xl border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all flex items-center gap-1.5 font-bold shadow-sm"
            >
              <Key className={`w-3 h-3 ${regeneratingToken ? "animate-spin" : ""}`} />
              Regenerate Agent Token
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-gray-200/60 dark:border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-gray-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">Cluster ID</span>
            <div className="flex items-center justify-between mt-1 gap-2">
              <span className="text-gray-900 dark:text-white font-bold select-all truncate">{currentClusterId || "N/A"}</span>
              <button
                type="button"
                onClick={() => handleCopy("cid", currentClusterId)}
                className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-750 text-gray-700 dark:text-slate-300 rounded-md text-[10px] font-mono font-bold flex items-center gap-1 transition-colors border border-gray-200 dark:border-slate-700 shrink-0"
              >
                {copiedKey === "cid" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-indigo-500" />}
                Copy Cluster ID
              </button>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 border border-gray-200/60 dark:border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-gray-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">Agent Token</span>
            <div className="flex items-center justify-between mt-1 gap-2">
              <span className="text-gray-900 dark:text-white font-bold select-all truncate">{currentAgentToken || "N/A"}</span>
              <button
                type="button"
                onClick={() => handleCopy("atoken", currentAgentToken)}
                className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-750 text-gray-700 dark:text-slate-300 rounded-md text-[10px] font-mono font-bold flex items-center gap-1 transition-colors border border-gray-200 dark:border-slate-700 shrink-0"
              >
                {copiedKey === "atoken" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-indigo-500" />}
                Copy Agent Token
              </button>
            </div>
          </div>
        </div>

        {regenResult && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2 select-text">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Credentials Updated! Update Your Agent Deployment:</span>
            </div>
            <p className="text-[11px] text-gray-600 dark:text-slate-300 leading-relaxed">
              {regenResult.instructions || "Execute this command in your Kubernetes cluster to update srevox-agent environment variables:"}
            </p>
            <pre className="p-3 bg-gray-900 text-green-400 text-xs font-mono rounded-xl overflow-x-auto select-all border border-gray-800 leading-relaxed">
              {regenResult.updateCmd}
            </pre>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-amber-500 dark:text-amber-400 font-semibold">
                ⚠️ Watcher agent will reconnect automatically once updated in Kubernetes.
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

      {/* Danger Zone */}
      <div className="card p-6 bg-white dark:bg-[#13151f] border border-red-200 dark:border-red-500/20 rounded-2xl space-y-4 shadow-sm bg-red-500/[0.005]">
        <div className="flex items-center gap-1.5 border-b border-gray-100 dark:border-slate-800 pb-3">
          <AlertTriangle className="w-4 h-4 text-red-550" />
          <h2 className="font-bold text-red-600 dark:text-red-500 text-sm">Danger Zone</h2>
        </div>
        <div className="space-y-4 text-xs">
          <p className="text-gray-500 dark:text-slate-455 leading-relaxed">
            Permanently delete this cluster connection. This will clear all stored incident histories, alert logs, and thresholds configurations.
          </p>
          {hasPermission(me, "deleteCluster") ? (
            <button
              onClick={handleDelete}
              className="btn-secondary w-full justify-center border-red-200 hover:border-red-500 hover:bg-red-50 text-red-655 dark:border-red-500/20 dark:hover:bg-red-500/10 font-bold text-xs py-2.5 rounded-xl transition-all"
            >
              Delete Cluster Connection
            </button>
          ) : (
            <div className="p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-center text-gray-400 dark:text-slate-500 italic">
              Administrator privileges required to delete.
            </div>
          )}
        </div>
      </div>

      {/* Connection Guide Modal */}
      <ConnectionGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        cluster={cluster}
      />

      {/* Delete Confirmation Password Modal */}
      {mounted && deleteModalOpen && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-5 animate-modal-slide-up select-text text-xs">
            <div className="flex items-center gap-3 text-red-500 border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Confirm Cluster Deletion</h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">Security authorization required</p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 rounded-xl p-3.5 flex gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold text-amber-800 dark:text-amber-400">Warning: Permanent Action</p>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-500/70 leading-relaxed">
                  This will permanently delete the cluster connection "{cluster?.name}" and all associated telemetry. This action cannot be reversed.
                </p>
              </div>
            </div>

            <form onSubmit={handleDeleteConfirm} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                  Verify Security Password to Authorize
                </label>
                <input
                  type="password"
                  placeholder="Enter security password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="input text-xs"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setDeleteModalOpen(false); setDeletePassword(""); }}
                  className="btn-secondary text-xs px-4 py-2 rounded-lg"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-danger bg-red-650 hover:bg-red-700 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Cluster"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
