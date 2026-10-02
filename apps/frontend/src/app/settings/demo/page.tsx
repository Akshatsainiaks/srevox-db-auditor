"use client";

import React, { useState, useEffect } from "react";
import { Compass, Play, Sparkles, CheckCircle2, Shield, Info, RefreshCw, Layers, Database, Zap, Bell, Clock } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function DemoTourSettingsPage() {
  const { success } = useToast();
  const [toggleState, setToggleState] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const val = localStorage.getItem("sv_show_navbar_quick_tour");
      setToggleState(val !== "false");
    }
  }, []);

  const startTour = (isSmart = false, isSettingsOnly = false) => {
    try {
      localStorage.setItem("sv_tour_completed", "false");
      if (isSettingsOnly) {
        localStorage.setItem("sv_settings_tour_active", "true");
      } else {
        localStorage.removeItem("sv_settings_tour_active");
      }

      if (isSmart) {
        localStorage.setItem("sv_autopilot_tour_active", "true");
        localStorage.setItem("sv_auto_tour_active", "true");
        localStorage.setItem("sv_auto_tour_page_index", "0");
        window.dispatchEvent(new Event("sv_start_auto_tour"));
        success("Autopilot Live Demo Started", "Beginning automated DB Auditor interactive walkthrough.");
        window.location.href = isSettingsOnly ? "/settings/profile" : "/dashboard";
        return;
      }

      localStorage.removeItem("sv_autopilot_tour_active");
      localStorage.setItem("sv_auto_tour_active", "true");
      localStorage.setItem("sv_auto_tour_page_index", "0");
      window.dispatchEvent(new Event("sv_start_tour"));
      success("Full Tour Started", "Beginning DB Auditor guided tour with demo data.");
      window.location.href = isSettingsOnly ? "/settings/profile" : "/dashboard";
    } catch (e) {
      console.error(e);
    }
  };

  const startLiveTour = () => {
    try {
      localStorage.removeItem("sv_autopilot_tour_active");
      localStorage.setItem("sv_auto_tour_active", "true");
      localStorage.setItem("sv_auto_tour_page_index", "0");
      window.dispatchEvent(new Event("sv_start_tour"));
      success("Quick Manual Tour Started", "Beginning step-by-step tour on your active workspace.");
      window.location.href = "/dashboard";
    } catch (e) {
      console.error(e);
    }
  };

  const resetTourStatus = () => {
    try {
      localStorage.removeItem("sv_tour_completed");
      localStorage.removeItem("sv_completed_tours");
      localStorage.removeItem("sv_auto_tour_active");
      localStorage.removeItem("sv_auto_tour_page_index");
      localStorage.removeItem("sv_autopilot_tour_active");
      localStorage.removeItem("sv_settings_tour_active");
      localStorage.removeItem("sv_mock_connectors");
      localStorage.removeItem("sv_mock_audit_events");
      localStorage.removeItem("sv_mock_channels");
      localStorage.removeItem("sv_mock_retention_db_audit");
      localStorage.removeItem("sv_mock_initialized");
      localStorage.removeItem("sv_backend_offline");

      window.dispatchEvent(new Event("sv_tour_status_changed"));
      success("Tour Status Reset", "Tour progress and demo sandbox cache have been reset.");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-6 animate-modal-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800/60">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Srevox DB Auditor Guided Tours & Sandbox
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Interactive guides, automated walkthroughs, and demo sandbox mode for database change intelligence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetTourStatus}
            className="btn-secondary text-[11px] font-bold py-2 px-3 rounded-xl border border-gray-200 dark:border-slate-800 flex items-center gap-1.5 hover:text-red-500 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Tour Cache</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">
          The Srevox DB Auditor Interactive Tour walks you through every core feature of database change intelligence:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-150 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-gray-900 dark:text-white">Database Connectors</span>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 leading-relaxed">Log-based CDC replication across PostgreSQL, MySQL, MongoDB, and Redis.</p>
          </div>

          <div className="p-3.5 bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-150 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-gray-900 dark:text-white">Live CDC Stream</span>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 leading-relaxed">Real-time row mutations, before/after column diffs, and PII masking.</p>
          </div>

          <div className="p-3.5 bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-150 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold text-gray-900 dark:text-white">Data Retention</span>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 leading-relaxed">Configurable purge policies, cron intervals, and ledger cleanup runs.</p>
          </div>

          <div className="p-3.5 bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-150 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-bold text-gray-900 dark:text-white">Alert Channels</span>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 leading-relaxed">SMTP Email, Microsoft Teams Workflows, WhatsApp, and Webhooks.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          {/* Option A: Quick Manual Tour */}
          <div className="p-4 bg-gray-50/50 dark:bg-slate-900/30 border border-gray-150 dark:border-slate-800/60 rounded-2xl space-y-2 select-none flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-gray-500" /> Quick Manual Tour
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed mt-1.5">
                <strong>Runs on your live data:</strong> A step-by-step guide across your own connected databases, active CDC live stream, and real channels at your own pace.
              </p>
            </div>
          </div>

          {/* Option B: Full Tour with Demo Data */}
          <div className="p-4 bg-gray-50/50 dark:bg-slate-900/30 border border-gray-150 dark:border-slate-800/60 rounded-2xl space-y-2 select-none flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-500" /> Full Tour with Demo Data
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed mt-1.5">
                <strong>Interactive simulated workspace:</strong> Runs a step-by-step tour using pre-populated sample database connectors, simulated mutations, and demo channels.
              </p>
            </div>
          </div>

          {/* Option C: Smart Autopilot Demo */}
          <div className="p-4 bg-indigo-50/40 dark:bg-indigo-500/[0.02] border border-indigo-100/60 dark:border-indigo-900/20 rounded-2xl space-y-2 select-none flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Smart Autopilot Live Demo
              </div>
              <p className="text-[11px] text-indigo-600/80 dark:text-slate-400 leading-relaxed mt-1.5">
                <strong>Automated simulation:</strong> Starts a hands-free tour that auto-advances through pages with live animated progress bars and simulated interaction.
              </p>
            </div>
          </div>
        </div>

        {/* Navbar Preference Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-slate-900/30 border border-gray-150 dark:border-slate-800/60 rounded-2xl select-none max-w-xl">
          <div className="pr-4">
            <span className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /> Navbar Shortcut Button
            </span>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Show the glowing "Quick Tour" button in the top navigation bar for fast page-level guides.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const current = localStorage.getItem("sv_show_navbar_quick_tour") !== "false";
              localStorage.setItem("sv_show_navbar_quick_tour", current ? "false" : "true");
              window.dispatchEvent(new Event("sv_navbar_settings_changed"));
              setToggleState(!current);
            }}
            className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer shrink-0 ${
              mounted ? "transition-all duration-300" : ""
            } ${
              toggleState ? "bg-indigo-600" : "bg-gray-300 dark:bg-slate-800"
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform ${
                mounted ? "transition-all duration-300" : ""
              } ${
                toggleState ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-3 pt-2">
        <button
          type="button"
          onClick={startLiveTour}
          className="btn-secondary min-w-[200px] w-full lg:w-auto justify-center py-3 rounded-xl text-xs font-bold shadow-sm active:scale-[0.99] transition-all group"
        >
          <Compass className="w-4 h-4 text-gray-500 group-hover:rotate-45 transition-transform duration-300" />
          <span>Start Quick Manual Tour</span>
        </button>

        <button
          type="button"
          onClick={() => startTour(false, false)}
          className="btn-secondary min-w-[200px] w-full lg:w-auto justify-center py-3 rounded-xl text-xs font-bold shadow-sm active:scale-[0.99] transition-all group border-indigo-200/50 hover:border-indigo-400/50"
        >
          <Compass className="w-4 h-4 text-indigo-500 group-hover:rotate-45 transition-transform duration-300" />
          <span>Start Full Tour with Demo Data</span>
        </button>

        <button
          type="button"
          onClick={() => startTour(true, false)}
          className="btn-primary min-w-[200px] w-full lg:w-auto justify-center py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 border-0 text-white shadow-lg hover:shadow-indigo-500/25 active:scale-[0.99] transition-all group"
        >
          <Sparkles className="w-4 h-4 text-white group-hover:scale-110 transition-transform duration-300 animate-pulse" />
          <span>Start Autopilot Live Demo</span>
        </button>
      </div>
    </div>
  );
}
