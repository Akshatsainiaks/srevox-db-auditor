"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, RefreshCw, HardDrive,
  ArrowLeft, Cpu, AlertCircle,
  Radio, Loader2, Key, ShieldAlert,
  Settings, BookOpen, X, Check, Copy, Activity, Lock, Trash2, Plus, Wifi, Save, ShieldCheck
} from "lucide-react";
import {
  api,
  fetchMachine,
  updateMachine,
  deleteMachine,
  regenerateMachineToken,
  createMachineAlertRule,
  verifySudoPassword
} from "@/lib/api";
import { copyToClipboard } from "@/lib/utils";
import MachineConnectionGuideModal from "@/components/machines/MachineConnectionGuideModal";
import MachineConfigureAlertsModal from "@/components/machines/MachineConfigureAlertsModal";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { getUser, hasPermission } from "@/lib/auth";

export default function MachineSettingsPage() {
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
    } catch {
      error("Incorrect security password. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);

  const [machine, setMachine] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form states - General Settings
  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [os, setOs] = useState("Linux");
  const [arch, setArch] = useState("x86_64");
  const [cpuCores, setCpuCores] = useState<number>(1);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempHostname, setTempHostname] = useState("");
  const [tempOs, setTempOs] = useState("Linux");
  const [tempArch, setTempArch] = useState("x86_64");
  const [tempCpuCores, setTempCpuCores] = useState<number>(1);
  const [updatingGeneral, setUpdatingGeneral] = useState(false);

  // Form states - Connection Settings
  const [isEditingConnection, setIsEditingConnection] = useState(false);
  const [agentToken, setAgentToken] = useState("");
  const [regeneratingToken, setRegeneratingToken] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadMachineData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetchMachine(id);
      const m = res.machine;
      setMachine(m);
      if (m) {
        setName(m.name || "");
        setTempName(m.name || "");
        setHostname(m.hostname || "");
        setTempHostname(m.hostname || "");
        setOs(m.os || "Linux");
        setTempOs(m.os || "Linux");
        setArch(m.arch || "x86_64");
        setTempArch(m.arch || "x86_64");
        setCpuCores(m.cpu_cores || 1);
        setTempCpuCores(m.cpu_cores || 1);
        setAgentToken(m.agent_token || "");
      }
    } catch (err: any) {
      console.error(err);
      error("Failed to load machine details");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [id, error]);

  useEffect(() => {
    if (id) {
      loadMachineData(true);
    }
  }, [id, loadMachineData]);

  const handleUpdateGeneral = async () => {
    if (!tempName.trim()) {
      error("Machine display name is required");
      return;
    }
    setUpdatingGeneral(true);
    try {
      await updateMachine(id, {
        name: tempName.trim(),
      });
      success("General settings updated", "Machine display name updated successfully.");
      setName(tempName);
      setIsEditingName(false);
      loadMachineData();
    } catch (e: any) {
      error("Failed to update machine name", e.response?.data?.error || e.message);
    } finally {
      setUpdatingGeneral(false);
    }
  };

  const handleCancelEditGeneral = () => {
    setTempName(name);
    setTempHostname(hostname);
    setTempOs(os);
    setTempArch(arch);
    setTempCpuCores(cpuCores);
    setIsEditingName(false);
  };

  const handleRegenerateToken = async () => {
    const { confirmed } = await confirm({
      title: "Regenerate Machine Agent Token",
      message: "Regenerating the agent token will immediately invalidate your current machine bearer token. You MUST update your srevox-machine-agent service on the host machine to maintain metric streaming.",
      variant: "warning",
      confirmLabel: "Regenerate Token"
    });
    if (!confirmed) return;

    setRegeneratingToken(true);
    try {
      const res = await regenerateMachineToken(id);
      setAgentToken(res.agent_token);
      setMachine((prev: any) => ({ ...prev, agent_token: res.agent_token }));
      success("Agent token regenerated!", "Copy the new token to update your host agent service.");
      loadMachineData();
    } catch (e: any) {
      error("Failed to regenerate token", e.response?.data?.error || e.message);
    } finally {
      setRegeneratingToken(false);
    }
  };

  const handleCopy = (key: string, val: string) => {
    copyToClipboard(val).then(() => {
      setCopiedKey(key);
      success("Copied to clipboard!");
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const handleDeleteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine) return;
    setDeleting(true);
    try {
      const authRes = await api.post("/api/auth/verify-sudo-password", { password: deletePassword });
      if (!authRes.data.success) {
        throw new Error("Incorrect password.");
      }
      await deleteMachine(id);
      success("Machine deleted", `${machine.name} has been removed.`);
      router.push("/dashboard/machines");
    } catch (err: any) {
      error("Failed to delete machine", err.response?.data?.error || err.message || "Incorrect password");
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
      setDeletePassword("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!sudoVerified) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <form onSubmit={verifyPassword} className="max-w-md w-full bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 p-8 rounded-3xl shadow-xl space-y-6 animate-modal-slide-up">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto text-indigo-500">
            <Lock className="w-6 h-6" />
          </div>
          
          <div className="text-center space-y-1.5">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Security Verification</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
              Please enter the organization security password to unlock machine settings.
            </p>
          </div>

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
              "Unlock Machine Settings"
            )}
          </button>
        </form>
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="p-12 text-center space-y-4">
        <p className="text-lg font-bold text-gray-800 dark:text-white">Machine Not Found</p>
        <Link href="/dashboard/machines" className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Machines List
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Top Breadcrumb & Header matching Screenshot 3 */}
      <div className="flex flex-col gap-4 border-b border-gray-200 dark:border-slate-800/80 pb-5">
        <div className="flex items-center justify-between">
          <Link href={`/dashboard/machines/${id}`} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Machine Summary
          </Link>

          <button
            onClick={() => setShowGuideModal(true)}
            className="btn-secondary flex items-center gap-1.5 text-[10px] py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-600 dark:text-slate-350 transition-colors font-bold shadow-sm"
          >
            <BookOpen className="w-3 h-3 text-indigo-500" />
            Setup Guide
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Machine Settings
              </h1>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                Manage details, warnings, connection credentials and alert rules for <span className="font-semibold text-gray-700 dark:text-slate-300">{machine.name}</span>
              </p>
            </div>
          </div>

          <Link
            href={`/dashboard/machines/${id}/alerts`}
            className="btn-primary flex items-center gap-1.5 text-xs py-2 px-4 h-[36px] font-bold bg-indigo-650 text-white rounded-xl shadow-lg shadow-indigo-650/10 hover:bg-indigo-750 transition-all shrink-0 self-start sm:self-auto select-none"
          >
            <Plus className="w-4 h-4" /> Configure Alerts
          </Link>
        </div>
      </div>

      {/* Card 1: General Settings (Matching Screenshot 3) */}
      <div className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800/80 rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800/60 pb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-500" />
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">General Settings</h3>
          </div>
          {!isEditingName ? (
            <button
              onClick={() => setIsEditingName(true)}
              className="btn-secondary text-xs font-bold px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 transition-colors shadow-xs"
            >
              Edit Details
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelEditGeneral}
                className="btn-secondary text-xs font-bold px-3 py-1.5 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateGeneral}
                disabled={updatingGeneral}
                className="btn-primary text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5"
              >
                {updatingGeneral && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          )}
        </div>

        {!isEditingName ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                MACHINE DISPLAY NAME
              </label>
              <input
                type="text"
                readOnly
                value={name || ""}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-[#181b28] border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-white text-xs font-semibold focus:outline-none cursor-default"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                OPERATING SYSTEM
              </label>
              <input
                type="text"
                readOnly
                value={`${os || "Linux"} (${arch || "x86_64"})`}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-[#181b28] border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-white text-xs font-semibold focus:outline-none cursor-default"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                HOSTNAME
              </label>
              <input
                type="text"
                readOnly
                value={hostname || "localhost"}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-[#181b28] border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none cursor-default"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                IP ADDRESS & SPECS
              </label>
              <input
                type="text"
                readOnly
                value={`${machine.ip_address || "127.0.0.1"} • ${cpuCores || 1} CPU Cores`}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-[#181b28] border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-white text-xs font-semibold focus:outline-none cursor-default"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                MACHINE DISPLAY NAME <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="e.g. prod-web-server-01"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-indigo-500/50 rounded-xl text-gray-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                OPERATING SYSTEM
              </label>
              <input
                type="text"
                readOnly
                value={`${os || "Linux"} (${arch || "x86_64"})`}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-[#181b28] border border-gray-200 dark:border-slate-800 rounded-xl text-gray-500 dark:text-slate-400 text-xs font-semibold focus:outline-none cursor-not-allowed opacity-80"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                HOSTNAME
              </label>
              <input
                type="text"
                readOnly
                value={hostname || "localhost"}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-[#181b28] border border-gray-200 dark:border-slate-800 rounded-xl text-gray-500 dark:text-slate-400 text-xs font-mono focus:outline-none cursor-not-allowed opacity-80"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                IP ADDRESS & SPECS
              </label>
              <input
                type="text"
                readOnly
                value={`${machine.ip_address || "127.0.0.1"} • ${cpuCores || 1} CPU Cores`}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-[#181b28] border border-gray-200 dark:border-slate-800 rounded-xl text-gray-500 dark:text-slate-400 text-xs font-semibold focus:outline-none cursor-not-allowed opacity-80"
              />
            </div>
          </div>
        )}
      </div>

      {/* Card 2: Metrics Connection (Matching Screenshot 3) */}
      <div className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800/80 rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800/60 pb-4">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-indigo-500" />
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Metrics Connection</h3>
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-slate-500">
          Provide credentials to let Srevox query your host machine for node and system metrics.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
              CONNECTION MODEL
            </label>
            <input
              type="text"
              readOnly
              value="Outbound Telemetry Agent (systemd)"
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-[#181b28] border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-white text-xs font-semibold focus:outline-none cursor-default"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
              HOST AGENT BEARER TOKEN
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                value={agentToken || ""}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-[#181b28] border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none cursor-default pr-10"
              />
              <button
                onClick={() => handleCopy("tok", agentToken)}
                className="absolute right-2 p-1.5 text-gray-400 hover:text-indigo-500 rounded-lg transition-colors"
                title="Copy token"
              >
                {copiedKey === "tok" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-150 dark:border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-normal">
            Outbound Telemetry Protection. Machine agent pushes system metrics over outbound HTTPS using Bearer tokens.
          </p>
        </div>
      </div>

      {/* Card 3: Danger Zone */}
      <div className="bg-red-500/[0.03] border border-red-500/30 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="font-bold text-red-900 dark:text-red-300 text-sm">Danger Zone</h3>
        </div>

        <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
          Deleting this machine will permanently delete all metric history and remove its connection from Srevox. Sudo password confirmation required.
        </p>

        <button
          onClick={() => setDeleteModalOpen(true)}
          className="btn-primary bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-red-600/10"
        >
          <Trash2 className="w-4 h-4" /> Delete Machine
        </button>
      </div>

      {/* Delete Machine Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setDeleteModalOpen(false)}>
          <div className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                Delete Machine
              </div>
              <button onClick={() => setDeleteModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
              This action cannot be undone. Please enter your security password to confirm deleting <strong className="text-gray-900 dark:text-white">{machine.name}</strong>.
            </p>

            <form onSubmit={handleDeleteConfirm} className="space-y-4">
              <input
                type="password"
                placeholder="Enter security password (default: admin123)"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-red-500/50"
                autoFocus
              />

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDeleteModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={deleting} className="btn-primary bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configure Machine Alerts Modal */}
      {showAlertsModal && machine && (
        <MachineConfigureAlertsModal
          isOpen={showAlertsModal}
          onClose={() => setShowAlertsModal(false)}
          machine={machine}
        />
      )}

      {/* Connection Guide Modal */}
      {showGuideModal && (
        <MachineConnectionGuideModal
          isOpen={showGuideModal}
          onClose={() => setShowGuideModal(false)}
          machineToken={machine.agent_token || "YOUR_MACHINE_AGENT_TOKEN"}
          serverUrl={typeof window !== "undefined" ? window.location.origin : "http://localhost:4000"}
        />
      )}
    </div>
  );
}
