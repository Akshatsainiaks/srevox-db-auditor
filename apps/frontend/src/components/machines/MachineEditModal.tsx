"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Copy, Check, Zap, HardDrive, ShieldCheck, X } from "lucide-react";
import { fetchMachine, updateMachine, regenerateMachineToken } from "@/lib/api";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";

export default function MachineEditModal({
  machineId,
  onClose,
  onSaved,
}: {
  machineId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [os, setOs] = useState("");
  const [arch, setArch] = useState("");
  const [cpuCores, setCpuCores] = useState<number>(1);
  const [agentToken, setAgentToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regeneratingToken, setRegeneratingToken] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "token">("general");

  const { success, error } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    fetchMachine(machineId)
      .then((m) => {
        setName(m.name || "");
        setHostname(m.hostname || "");
        setOs(m.os || "");
        setArch(m.arch || "");
        setCpuCores(m.cpu_cores || 1);
        setAgentToken(m.agent_token || "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [machineId]);

  const handleCopy = (key: string, val: string) => {
    copyToClipboard(val).then(() => {
      setCopiedKey(key);
      success("Copied to clipboard!");
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const handleRegenerateToken = async () => {
    const { confirmed } = await confirm({
      title: "Regenerate Machine Agent Token?",
      message:
        "Regenerating the agent token will immediately invalidate your current machine token. You MUST update your host collector service with the new token to keep metrics streaming.",
      variant: "warning",
      confirmLabel: "Regenerate Token",
    });
    if (!confirmed) return;

    setRegeneratingToken(true);
    try {
      const res = await regenerateMachineToken(machineId);
      setAgentToken(res.agent_token);
      success("Agent token regenerated!", "Copy the new token to update your host agent service.");
      onSaved();
    } catch (e: any) {
      error("Failed to regenerate token", e.response?.data?.error || e.message);
    } finally {
      setRegeneratingToken(false);
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      error("Validation error", "Machine name is required");
      return;
    }
    setSaving(true);
    try {
      await updateMachine(machineId, {
        name: trimmed,
        hostname: hostname.trim() || undefined,
        os: os.trim() || undefined,
        arch: arch.trim() || undefined,
        cpu_cores: Number(cpuCores) || 1,
      });
      success("Machine updated", `${trimmed} settings saved`);
      onSaved();
      onClose();
    } catch (e: any) {
      error("Failed to update machine", e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-[#13151f] rounded-3xl p-8 border border-gray-100 dark:border-slate-800/80 shadow-2xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1e2130] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden text-xs" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-500" />
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Edit Machine Settings</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/10 shrink-0 select-none">
          <button
            onClick={() => setActiveTab("general")}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === "general"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900/30"
                : "border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400"
            }`}
          >
            General Settings
          </button>
          <button
            onClick={() => setActiveTab("token")}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === "token"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900/30"
                : "border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400"
            }`}
          >
            Agent Token & Credentials
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === "general" ? (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Machine Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. prod-web-server-01"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">Hostname</label>
                <input
                  type="text"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  placeholder="e.g. ubuntu-server.local"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">OS</label>
                  <input
                    type="text"
                    value={os}
                    onChange={(e) => setOs(e.target.value)}
                    placeholder="Linux"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">Architecture</label>
                  <input
                    type="text"
                    value={arch}
                    onChange={(e) => setArch(e.target.value)}
                    placeholder="x86_64"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">CPU Cores</label>
                  <input
                    type="number"
                    min={1}
                    value={cpuCores}
                    onChange={(e) => setCpuCores(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white text-xs flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-indigo-500" /> Host Agent Bearer Token
                  </span>
                  <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 uppercase tracking-wider">
                    Active
                  </span>
                </div>

                <p className="text-[11px] text-gray-600 dark:text-slate-300 font-mono select-all bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 break-all font-semibold">
                  {agentToken}
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCopy("tok", agentToken)}
                    className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs py-2 font-bold"
                  >
                    {copiedKey === "tok" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === "tok" ? "Copied!" : "Copy Token"}
                  </button>

                  <button
                    type="button"
                    onClick={handleRegenerateToken}
                    disabled={regeneratingToken}
                    className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-500/10 hover:bg-amber-100 font-bold transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regeneratingToken ? "animate-spin" : ""}`} />
                    {regeneratingToken ? "Regenerating..." : "Regenerate Token"}
                  </button>
                </div>
              </div>

              <div className="bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-150 dark:border-emerald-500/20 rounded-2xl p-3.5 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-normal">
                  Outbound HTTPS Bearer Authentication. Regenerating token immediately invalidates the previous bearer token.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-end gap-2 shrink-0 bg-gray-50/50 dark:bg-slate-900/30">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-4 py-2 text-xs font-semibold rounded-xl"
          >
            Cancel
          </button>
          {activeTab === "general" && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary px-4 py-2 text-xs font-bold rounded-xl text-white bg-indigo-650 hover:bg-indigo-750 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
