"use client";

import React, { useState } from "react";
import { Lock, Eye, EyeOff, Loader2, ShieldCheck, Key, Server, Activity, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { updateSudoPassword, resetSudoPassword } from "@/lib/api";
import { getUser, hasPermission } from "@/lib/auth";

interface SecurityLockProps {
  isAdmin: boolean;
}

export default function SecurityLock({ isAdmin }: SecurityLockProps) {
  const { success, error: toastError } = useToast();
  const { confirm } = useConfirm();
  const user = getUser();
  const canEdit = hasPermission(user, "changeSudoLock");

  const [currentSudoPassword, setCurrentSudoPassword] = useState("");
  const [newSudoPassword, setNewSudoPassword] = useState("");
  const [confirmSudoPassword, setConfirmSudoPassword] = useState("");
  const [updatingSudoPassword, setUpdatingSudoPassword] = useState(false);
  const [showCurrentSudo, setShowCurrentSudo] = useState(false);
  const [showNewSudo, setShowNewSudo] = useState(false);
  const [showConfirmSudo, setShowConfirmSudo] = useState(false);
  const [resettingSudoPassword, setResettingSudoPassword] = useState(false);

  const handleResetSudoPassword = async () => {
    if (!isAdmin) return;
    const { confirmed } = await confirm({
      title: "Reset Sudo Passcode?",
      message: "Are you sure you want to reset the Sudo passcode back to default 'admin123'?",
      confirmLabel: "Reset Passcode",
      variant: "danger"
    });
    if (!confirmed) return;

    setResettingSudoPassword(true);
    try {
      await resetSudoPassword();
      success("Sudo passcode successfully reset to default 'admin123'.");
      setCurrentSudoPassword("");
      setNewSudoPassword("");
      setConfirmSudoPassword("");
    } catch (err: any) {
      console.error(err);
      toastError(err.response?.data?.detail || "Failed to reset security passcode.");
    } finally {
      setResettingSudoPassword(false);
    }
  };

  const handleUpdateSudoPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!currentSudoPassword || !newSudoPassword || !confirmSudoPassword) {
      toastError("All password fields are required.");
      return;
    }
    if (newSudoPassword !== confirmSudoPassword) {
      toastError("New passwords do not match.");
      return;
    }
    if (newSudoPassword.length < 6) {
      toastError("Password must be at least 6 characters.");
      return;
    }

    setUpdatingSudoPassword(true);
    try {
      await updateSudoPassword({
        current_password: currentSudoPassword,
        new_password: newSudoPassword,
      });
      success("Sudo security password updated successfully.");
      setCurrentSudoPassword("");
      setNewSudoPassword("");
      setConfirmSudoPassword("");
    } catch (err: any) {
      console.error(err);
      toastError(err.response?.data?.detail || "Failed to update security password.");
    } finally {
      setUpdatingSudoPassword(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <form id="sudo-security-lock" onSubmit={handleUpdateSudoPassword} className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        
        {/* Header with Title & Status Pill */}
        <div className="flex items-start justify-between gap-4 pb-6 border-b border-gray-100 dark:border-slate-800/60 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-500 shrink-0 shadow-sm">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Sudo Security Lock Passcode
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 max-w-xl">
                Enforce organization-level security locks for Cluster Settings, Audit Logs, and Administrative Controls.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Security Lock
          </div>
        </div>

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Form Controls */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Default Passcode Guidance Callout */}
            <div className="p-4 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/20 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-300">
                <Key className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Default Passcode Information</span>
              </div>
              <p className="text-[11px] text-indigo-700/90 dark:text-indigo-400/90 leading-relaxed">
                By default, your workspace security lock passcode is set to <code className="bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded font-mono font-bold text-indigo-900 dark:text-indigo-200">admin123</code>. Please update it to secure your instance.
              </p>
            </div>

            {/* Inputs Container */}
            <div className="space-y-4">
              
              {/* Current Password */}
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                  Current Security Passcode
                </label>
                <div className="relative">
                  <input
                    type={showCurrentSudo ? "text" : "password"}
                    value={currentSudoPassword}
                    onChange={(e) => setCurrentSudoPassword(e.target.value)}
                    placeholder="Current password (default: admin123)"
                    disabled={!canEdit || updatingSudoPassword}
                    className="input pr-10 text-xs py-2.5 px-3.5 h-[40px] rounded-xl w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentSudo(!showCurrentSudo)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                  >
                    {showCurrentSudo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Side-by-Side New & Confirm Password Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* New Password */}
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                    New Passcode
                  </label>
                  <div className="relative">
                    <input
                      type={showNewSudo ? "text" : "password"}
                      value={newSudoPassword}
                      onChange={(e) => setNewSudoPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={!canEdit || updatingSudoPassword}
                      className="input pr-10 text-xs py-2.5 px-3.5 h-[40px] rounded-xl w-full"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewSudo(!showNewSudo)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                    >
                      {showNewSudo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                    Confirm New Passcode
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmSudo ? "text" : "password"}
                      value={confirmSudoPassword}
                      onChange={(e) => setConfirmSudoPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={!canEdit || updatingSudoPassword}
                      className="input pr-10 text-xs py-2.5 px-3.5 h-[40px] rounded-xl w-full"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmSudo(!showConfirmSudo)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                    >
                      {showConfirmSudo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Action Submit Button */}
            {canEdit && (
              <div className="pt-2 flex items-center gap-3 flex-wrap">
                <button
                  type="submit"
                  disabled={updatingSudoPassword || !currentSudoPassword || !newSudoPassword || !confirmSudoPassword}
                  className="btn-primary py-2.5 px-6 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {updatingSudoPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating Passcode...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Update Passcode
                    </>
                  )}
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleResetSudoPassword}
                    disabled={resettingSudoPassword}
                    className="py-2.5 px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-red-200 dark:border-red-500/20 text-red-650 hover:text-red-750 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all shadow-sm"
                  >
                    {resettingSudoPassword ? (
                      <>
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset passcode to admin123"
                    )}
                  </button>
                )}
              </div>
            )}

          </div>

          {/* Right Column: Protected Capabilities Feature Cards */}
          <div className="lg:col-span-5 space-y-3 bg-gray-50/50 dark:bg-slate-900/30 border border-gray-150 dark:border-slate-800/60 p-5 rounded-2xl">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-500" /> Protected Views & Controls
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
              Once set, this organization passcode unlocks access to these sensitive management views:
            </p>

            <div className="space-y-2.5 pt-1">
              
              <div className="p-3 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-xl flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0 mt-0.5">
                  <Server className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-850 dark:text-slate-200">Cluster Settings</h4>
                  <p className="text-[10px] text-gray-450 dark:text-slate-450 leading-relaxed mt-0.5">
                    Modifying metrics endpoints, token rotation, and cluster deletion authorization.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-xl flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0 mt-0.5">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-850 dark:text-slate-200">Audit Activity Logs</h4>
                  <p className="text-[10px] text-gray-450 dark:text-slate-450 leading-relaxed mt-0.5">
                    Accessing full security audit logs and tracking organization member activity history.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-xl flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-850 dark:text-slate-200">Platform Administration</h4>
                  <p className="text-[10px] text-gray-450 dark:text-slate-450 leading-relaxed mt-0.5">
                    Validating authorization for administrative overrides and workspace management.
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>

      </form>
    </div>
  );
}
