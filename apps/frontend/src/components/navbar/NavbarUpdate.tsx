"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpCircle, Sparkles, CheckCircle2 } from "lucide-react";
import pkg from "../../../package.json";
import { fetchLatestVersion } from "@/lib/api";

const parseVersion = (v: string): number[] => {
  if (!v) return [0, 0, 0];
  const clean = v.replace(/^v/, "").trim();
  return clean.split(".").map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
};

const isNewerVersion = (current: string, latest: string): boolean => {
  try {
    const curParts = parseVersion(current);
    const latParts = parseVersion(latest);
    for (let i = 0; i < Math.max(curParts.length, latParts.length); i++) {
      const cur = curParts[i] || 0;
      const lat = latParts[i] || 0;
      if (lat > cur) return true;
      if (cur > lat) return false;
    }
  } catch {}
  return false;
};

export default function NavbarUpdate() {
  const [latestVersion, setLatestVersion] = useState<string>("");
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [checked, setChecked] = useState<boolean>(false);
  
  const currentVersion = pkg.version.startsWith("v") ? pkg.version : `v${pkg.version}`;

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const data = await fetchLatestVersion();
        const latest = data.version || "";
        if (latest && latest !== "v0.0.0") {
          const formatted = latest.startsWith("v") ? latest : `v${latest}`;
          setLatestVersion(formatted);
          if (isNewerVersion(pkg.version, latest)) {
            setHasUpdate(true);
          } else {
            setHasUpdate(false);
          }
        } else {
          setHasUpdate(false);
        }
      } catch (err) {
        setHasUpdate(false);
      } finally {
        setChecked(true);
      }
    };
    checkUpdate();
  }, []);

  if (!checked) return null;

  if (hasUpdate) {
    return (
      <div className="relative group">
        <Link
          href="/settings/more-settings?tab=update"
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-amber-50 dark:hover:bg-amber-500/10 text-amber-500 transition-all relative group"
          title={`New version ${latestVersion} available`}
        >
          <ArrowUpCircle className="w-4 h-4 text-amber-500 animate-bounce" />
          
          {/* Glow badge dot */}
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        </Link>

        {/* Hover Popup Tooltip Card */}
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#1e2130] border border-amber-200/60 dark:border-amber-500/30 rounded-2xl shadow-xl p-3.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 transform translate-y-1 group-hover:translate-y-0">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center shrink-0 border border-amber-200/50 dark:border-amber-500/30">
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-gray-900 dark:text-white text-xs">New Update</span>
                <span className="text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-200/80 dark:border-amber-500/40">
                  {latestVersion}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-tight">
                A new platform update ({latestVersion}) is available. Click to manage updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Up to Date State
  return (
    <div className="relative group">
      <Link
        href="/settings/more-settings?tab=update"
        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-500 transition-all relative group"
        title={`Up to Date (${currentVersion})`}
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      </Link>

      {/* Hover Popup Tooltip Card */}
      <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-[#1e2130] border border-emerald-200/60 dark:border-emerald-500/30 rounded-2xl shadow-xl p-3.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 transform translate-y-1 group-hover:translate-y-0">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center shrink-0 border border-emerald-200/50 dark:border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-gray-900 dark:text-white text-xs">Up to Date</span>
              <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-500/40">
                {currentVersion}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-tight">
              You are running the latest version of Srevox ({currentVersion}).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
