"use client";
import React, { useState, useEffect } from "react";
import { Compass, Sparkles, Settings } from "lucide-react";

export default function DemoSettingsPage() {
  const [toggleState, setToggleState] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToggleState(localStorage.getItem("sv_show_navbar_quick_tour") !== "false");
      const timer = setTimeout(() => {
        setMounted(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, []);

  const startLiveTour = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("sv_auto_tour_active");
      localStorage.removeItem("sv_autopilot_tour_active");
      localStorage.removeItem("sv_settings_tour_active");
      localStorage.setItem("sv_start_live_tour_on_load", "true");
      localStorage.removeItem("sv_completed_tours");
      localStorage.removeItem("sv_tour_completed");
      window.dispatchEvent(new Event("sv_tour_status_changed"));
      window.location.href = "/dashboard";
    }
  };

  const startTour = (autopilot: boolean, isSettingsOnly: boolean = false) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sv_auto_tour_active", "true");
      localStorage.setItem("sv_auto_tour_page_index", "0");
      if (autopilot) {
        localStorage.setItem("sv_autopilot_tour_active", "true");
      } else {
        localStorage.removeItem("sv_autopilot_tour_active");
      }
      if (isSettingsOnly) {
        localStorage.setItem("sv_settings_tour_active", "true");
      } else {
        localStorage.removeItem("sv_settings_tour_active");
      }
      localStorage.removeItem("sv_mock_initialized"); // Force re-initialization of mock data
      localStorage.removeItem("sv_mock_clusters");
      localStorage.removeItem("sv_mock_incidents");
      localStorage.removeItem("sv_mock_channels");
      localStorage.removeItem("sv_mock_rules");
      localStorage.removeItem("sv_mock_resource_alerts");
      localStorage.removeItem("sv_mock_service_owners");
      localStorage.removeItem("sv_completed_tours");
      localStorage.removeItem("sv_tour_completed");
      window.dispatchEvent(new Event("sv_tour_status_changed"));
      window.dispatchEvent(new Event("sv_start_auto_tour"));
      
      // Redirect to the first page in the tour sequence
      if (isSettingsOnly) {
        window.location.href = "/settings/profile";
      } else {
        window.location.href = "/dashboard";
      }
    }
  };

  return (
    <div className="card p-6 space-y-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm animate-modal-slide-up" style={{ animationDuration: "0.2s" }}>
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/60">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
          <Compass className="w-4 h-4 text-indigo-650 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">Interactive Workspace Demo</h2>
          <p className="text-xs text-gray-555 dark:text-slate-405">Launch an automatic system-wide guided tour of all Srevox dashboard pages</p>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-gray-655 dark:text-slate-405 leading-relaxed">
          The Srevox Auto-Play System Tour will automatically walk you through every critical feature of the dashboard:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-150 dark:border-slate-800/60">
            <span className="text-xs font-bold text-gray-900 dark:text-white">🖥️ Infrastructure Clusters</span>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 leading-relaxed">How to connect clusters and view node health status.</p>
          </div>
          <div className="p-3 bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-150 dark:border-slate-800/60">
            <span className="text-xs font-bold text-gray-900 dark:text-white">🚨 Live Crash Incident Feed</span>
            <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-1 leading-relaxed">Real-time incident streams, log telemetry, and AI diagnosis reports.</p>
          </div>
          <div className="p-3 bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-150 dark:border-slate-800/60">
            <span className="text-xs font-bold text-gray-900 dark:text-white">🔔 Notification Channels</span>
            <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-1 leading-relaxed">Slack, Webhooks, WhatsApp, SMTP Email routing configurations.</p>
          </div>
          <div className="p-3 bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-150 dark:border-slate-800/60">
            <span className="text-xs font-bold text-gray-900 dark:text-white">📜 Custom Alerting Rules</span>
            <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-1 leading-relaxed">Configuring namespace filtering and noise reduction cooldowns.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          {/* Option A: Quick Manual Tour info */}
          <div className="p-4 bg-gray-50/50 dark:bg-slate-900/30 border border-gray-150 dark:border-slate-800/60 rounded-2xl space-y-2 select-none flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-gray-500" /> Quick Manual Tour
              </div>
              <p className="text-[11px] text-gray-555 dark:text-slate-400 leading-relaxed mt-1.5">
                <strong>Runs on your live data:</strong> A manual step-by-step guide across your own connected Kubernetes clusters, active alerts, and real configured Slack/email channels. Let's you learn Srevox within your actual workspace at your own pace.
              </p>
            </div>
          </div>

          {/* Option B: Full Tour with Demo Data info */}
          <div className="p-4 bg-gray-50/50 dark:bg-slate-900/30 border border-gray-150 dark:border-slate-800/60 rounded-2xl space-y-2 select-none flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-500" /> Full Tour with Demo Data
              </div>
              <p className="text-[11px] text-gray-555 dark:text-slate-400 leading-relaxed mt-1.5">
                <strong>Interactive faked-workspace manual:</strong> Runs a step-by-step tour using pre-populated faked cluster instances, faked live crash feeds, faked rule definitions, and dummy notification channels, safely isolated from your setup.
              </p>
            </div>
          </div>

          {/* Option C: Smart Autopilot Demo info */}
          <div className="p-4 bg-indigo-50/40 dark:bg-indigo-500/[0.02] border border-indigo-100/60 dark:border-indigo-900/20 rounded-2xl space-y-2 select-none flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-indigo-650 dark:text-indigo-405 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Smart Autopilot Live Demo
              </div>
              <p className="text-[11px] text-indigo-600 dark:text-slate-400 leading-relaxed mt-1.5">
                <strong>Runs on isolated mock data:</strong> Starts a fully automated simulation that pre-populates faked pod crashes, configures mock channels, and automatically triggers typing/clicks to showcase Srevox features instantly.
              </p>
            </div>
          </div>
        </div>

        {/* Navbar Preference Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-slate-900/30 border border-gray-150 dark:border-slate-800/60 rounded-2xl select-none max-w-xl">
          <div className="pr-4">
            <span className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-550 dark:text-indigo-400" /> Navbar Shortcut Button
            </span>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Show the glowing "Quick Tour" button in the main top navigation bar for fast page-level guides.
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
