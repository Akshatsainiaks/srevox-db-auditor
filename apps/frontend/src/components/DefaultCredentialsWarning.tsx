"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { getUser, AuthUser } from "@/lib/auth";

export default function DefaultCredentialsWarning() {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setUserState(getUser());
    const handleUserUpdate = (e: any) => setUserState(e.detail);
    window.addEventListener("sv_user_updated", handleUserUpdate);
    
    if (typeof window !== "undefined") {
      const hide = localStorage.getItem("sv_hide_default_warning");
      if (hide === "true") setDismissed(true);
    }
    
    return () => window.removeEventListener("sv_user_updated", handleUserUpdate);
  }, []);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sv_hide_default_warning", "true");
    }
    setDismissed(true);
  };

  if (dismissed || !user || user.email !== "admin@srevox.local") return null;

  return (
    <div className="w-full bg-red-600 text-white dark:bg-red-955/85 dark:text-red-200 border-b border-red-700 dark:border-red-900/60 px-4 py-2 text-xs font-semibold flex items-center justify-between gap-3 shadow-md relative z-40 select-none animate-pulse-subtle">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-white dark:text-red-400 shrink-0 animate-bounce" />
        <span>
          <strong className="font-bold">Security Alert:</strong> You are using Srevox's default administrator credentials. Please update both your email and password immediately.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link 
          href="/settings/profile" 
          className="inline-flex items-center gap-1 bg-white text-red-700 dark:bg-red-900 dark:text-red-100 hover:bg-red-50 dark:hover:bg-red-800 px-3 py-1 rounded-lg transition-all text-[11px] font-bold shadow-sm whitespace-nowrap group"
        >
          Change Credentials
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <button 
          onClick={handleDismiss} 
          title="Dismiss warning" 
          className="text-white/80 hover:text-white dark:text-red-450 dark:hover:text-red-300 transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
