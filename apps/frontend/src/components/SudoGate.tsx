"use client";

import React, { useEffect, useState } from "react";
import { Lock, Loader2, AlertTriangle, ArrowLeft, Eye, EyeOff, Key } from "lucide-react";
import { verifySudoPassword } from "@/lib/api";
import { getUser } from "@/lib/auth";
import Link from "next/link";

interface SudoGateProps {
  children: React.ReactNode;
}

export default function SudoGate({ children }: SudoGateProps) {
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [password, setPassword] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const me = getUser();
  const isAdmin = me?.role === "admin";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isUnlocked = sessionStorage.getItem("sv_sudo_unlocked") === "true";
      setUnlocked(isUnlocked);
    }
    setLoading(false);
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setVerifying(true);
    setErrorMsg(null);
    try {
      await verifySudoPassword(password);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("sv_sudo_unlocked", "true");
      }
      setUnlocked(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || "Invalid security password. Access denied.");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // If already unlocked, or user is not logged in at all (auth guard will handle it), render page
  if (unlocked || !me) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4 py-12 select-none animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl shadow-2xl p-8 space-y-6 relative overflow-hidden select-text">
        {/* Glow decoration */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-100 dark:border-indigo-500/20 shadow-sm animate-pulse-subtle">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white">Administrative Lock</h2>
            <p className="text-xs text-gray-550 dark:text-slate-450 max-w-sm mx-auto leading-relaxed">
              This section contains sensitive administrative controls. Please enter your organization security password to unlock.
            </p>
          </div>
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

        {errorMsg && (
          <div className="flex items-start gap-2.5 bg-red-50/50 dark:bg-red-500/5 border border-red-100/50 dark:border-red-500/15 rounded-xl px-4 py-3 text-xs text-red-700 dark:text-red-400 animate-shake">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="space-y-1.5 relative">
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
              Security Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                className="input pr-10 text-xs py-2 px-3 h-[36px] rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="btn-secondary text-xs flex-1 py-2 rounded-xl font-bold justify-center border border-gray-200 dark:border-slate-800"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={verifying || !password}
              className="btn-primary text-xs flex-1 py-2 rounded-xl font-bold justify-center flex items-center gap-1.5"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Unlock Access"
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-2">
          <Link
            href="/dashboard"
            className="text-[11px] font-semibold text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 inline-flex items-center gap-1 group transition-colors"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
