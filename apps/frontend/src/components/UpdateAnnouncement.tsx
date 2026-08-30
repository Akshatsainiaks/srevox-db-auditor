"use client";

import { useState, useEffect } from "react";
import { Github, ExternalLink, X, Bell } from "lucide-react";
import Link from "next/link";
import pkg from "../../package.json";
import { fetchLatestVersion } from "@/lib/api";

// ── CONFIGURATION OPTIONS ───────────────────────────────────────────────────

// Position Choices: "top-banner" | "bottom-banner" | "top-right-toast" | "bottom-right-toast"
const ANNOUNCEMENT_POSITION: "top-banner" | "bottom-banner" | "top-right-toast" | "bottom-right-toast" = "bottom-right-toast"; 

const GITHUB_URL = "https://github.com/Akshatsainiaks/srevox-setup";
const DOCS_URL = "https://github.com/Akshatsainiaks/srevox-setup"; // Can change this to live documentation link in the future
const SHOW_DOCS_LINK = true; // Easily toggle docs visibility

const CURRENT_VERSION = pkg.version; // The current platform version

// Set to true to bypass release check and test the banner/card layout locally
const FORCE_SHOW_FOR_TESTING = false; 

// ────────────────────────────────────────────────────────────────────────────

// Simple version parser and comparison helper
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

export default function UpdateAnnouncement() {
  const [isVisible, setIsVisible] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");

  useEffect(() => {
    // 1. If testing mode is enabled, force display immediately
    if (FORCE_SHOW_FOR_TESTING) {
      setLatestVersion("1.1.0-mock");
      setIsVisible(true);
      return;
    }

    // 2. Fetch the latest release version from backend API
    const checkUpdate = async () => {
      try {
        const data = await fetchLatestVersion();
        const latest = data.version;
        
        if (latest && latest !== "v0.0.0") {
          setLatestVersion(latest);

          // 3. Check if this specific version is permanently muted in localStorage
          const mutedVersion = localStorage.getItem("srevox_update_muted_version");
          if (mutedVersion === latest) return;

          // 4. Check if this specific version was dismissed in this session
          const dismissedVersion = sessionStorage.getItem("srevox_update_dismissed_version");
          if (dismissedVersion === latest) return;

          // 5. Compare versions
          if (isNewerVersion(CURRENT_VERSION, latest)) {
            setIsVisible(true);
          }
        }
      } catch (err) {
        console.error("Failed to check Srevox version update:", err);
      }
    };

    checkUpdate();
  }, []);

  const handleDismiss = () => {
    if (latestVersion) {
      sessionStorage.setItem("srevox_update_dismissed_version", latestVersion);
    }
    setIsVisible(false);
  };

  const handleMuteVersion = () => {
    if (latestVersion) {
      localStorage.setItem("srevox_update_muted_version", latestVersion);
      setIsVisible(false);
    }
  };

  if (!isVisible || !latestVersion) return null;

  const isToast = ANNOUNCEMENT_POSITION.includes("toast");

  // CSS Animations for different position styles
  const animationStyles = (
    <style>{`
      @keyframes slideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes slideUpToast {
        from { transform: translateY(24px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .animate-slide-down { animation: slideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      .animate-slide-up { animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      .animate-slide-up-toast { animation: slideUpToast 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      .animate-slide-in-right { animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    `}</style>
  );

  // Position class mapping
  let positionClasses = "";
  let animationClass = "";

  if (ANNOUNCEMENT_POSITION === "top-banner") {
    positionClasses = "relative w-full border-b border-indigo-500/20 dark:border-indigo-500/10 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 dark:from-[#1b1c2b] dark:via-[#22243d] dark:to-[#1b1c2b] text-white";
    animationClass = "animate-slide-down";
  } else if (ANNOUNCEMENT_POSITION === "bottom-banner") {
    positionClasses = "fixed bottom-0 left-0 right-0 z-[999] border-t border-indigo-500/20 dark:border-indigo-500/10 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 dark:from-[#1b1c2b] dark:via-[#22243d] dark:to-[#1b1c2b] text-white";
    animationClass = "animate-slide-up";
  } else if (ANNOUNCEMENT_POSITION === "top-right-toast") {
    positionClasses = "fixed top-20 right-6 z-[999] max-w-sm w-full border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#111524]/95 text-slate-800 dark:text-slate-100 shadow-2xl backdrop-blur-md rounded-2xl";
    animationClass = "animate-slide-in-right";
  } else {
    // Default to "bottom-right-toast"
    positionClasses = "fixed bottom-6 right-6 z-[999] max-w-sm w-full border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#111524]/95 text-slate-800 dark:text-slate-100 shadow-2xl backdrop-blur-md rounded-2xl";
    animationClass = "animate-slide-up-toast";
  }

  // 1. Toast Layout
  if (isToast) {
    return (
      <div className={`${positionClasses} ${animationClass} p-5 select-none`}>
        {animationStyles}
        
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Update Available</h4>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/30">
                v{CURRENT_VERSION} → {latestVersion}
              </span>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              A new Srevox release is available for your self-hosted platform instance. Get the latest reliability features and AI fixes.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/settings/more-settings?tab=update"
                onClick={() => setIsVisible(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition shadow-sm"
              >
                <Bell className="h-3.5 w-3.5" />
                Update Platform
              </Link>

              {SHOW_DOCS_LINK && (
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 transition"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Docs
                </a>
              )}

              <button
                onClick={handleMuteVersion}
                className="ml-auto text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition"
                title="Don't show update alert again for this version"
              >
                Don't show again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Banner Layout (Top / Bottom Banner)
  return (
    <div className={`relative z-50 ${positionClasses} ${animationClass}`}>
      {animationStyles}
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <span className="flex p-1.5 rounded-lg bg-indigo-500/20 text-indigo-200">
              <Bell className="h-4 w-4 animate-bounce" />
            </span>
            <p className="text-sm font-medium text-slate-100 truncate">
              <span className="md:hidden">New Srevox update {latestVersion} is available! (Current: v{CURRENT_VERSION})</span>
              <span className="hidden md:inline">
                A new Srevox release (<strong>{latestVersion}</strong>) is available. Your current version is <strong>v{CURRENT_VERSION}</strong>.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Link
                href="/settings/more-settings?tab=update"
                onClick={() => setIsVisible(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-indigo-700 hover:bg-slate-50 active:bg-slate-100 transition shadow-sm"
              >
                Update Now
              </Link>

              {SHOW_DOCS_LINK && (
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-500/30 text-indigo-100 border border-indigo-400/30 hover:bg-indigo-500/40 transition"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Docs
                </a>
              )}
            </div>

            <div className="flex items-center gap-2 border-l border-indigo-500/30 pl-3">
              <button
                onClick={handleMuteVersion}
                className="text-[11px] font-medium text-indigo-200 hover:text-white transition"
                title="Don't show update prompt again for this version"
              >
                Don't show again
              </button>

              <button
                onClick={handleDismiss}
                className="p-1 rounded-md text-indigo-200 hover:text-white hover:bg-indigo-500/20 transition"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
