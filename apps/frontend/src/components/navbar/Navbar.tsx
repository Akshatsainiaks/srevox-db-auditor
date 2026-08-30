"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Compass, LifeBuoy } from "lucide-react";
import { SrevoxWordmark } from "../Logo";
import { TOURS } from "../PageTutorial";
import NavbarSearch from "./Search";
import NavbarNotifications from "./Notifications";
import NavbarProfile from "./Profile";
import NavbarUpdate from "./NavbarUpdate";

export default function Navbar() {
  const pathname = usePathname();
  const [tourCompleted, setTourCompleted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showQuickTour, setShowQuickTour] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const updateShowTour = () => {
      if (typeof window !== "undefined") {
        const val = localStorage.getItem("sv_show_navbar_quick_tour");
        setShowQuickTour(val !== "false");
      }
    };
    updateShowTour();
    window.addEventListener("sv_navbar_settings_changed", updateShowTour);
    return () => window.removeEventListener("sv_navbar_settings_changed", updateShowTour);
  }, []);

  const hasTour = (() => {
    if (!pathname) return false;
    if (
      pathname === "/settings/engineering" ||
      pathname.startsWith("/settings/engineering") ||
      (pathname.startsWith("/dashboard/incidents/") && pathname !== "/dashboard/incidents")
    ) {
      return false;
    }
    const keys = Object.keys(TOURS);
    return keys.some(k => pathname === k || (k !== "/dashboard" && pathname.startsWith(k)));
  })();

  useEffect(() => {
    const checkTourStatus = () => {
      if (!pathname) return;
      try {
        const saved = localStorage.getItem("sv_completed_tours");
        let pageCompleted = false;
        if (saved) {
          const parsed = JSON.parse(saved);
          pageCompleted = !!parsed[pathname];
        }
        setTourCompleted(pageCompleted);
      } catch {
        setTourCompleted(false);
      }
    };

    checkTourStatus();
    window.addEventListener("sv_tour_status_changed", checkTourStatus);
    return () => window.removeEventListener("sv_tour_status_changed", checkTourStatus);
  }, [pathname]);

  return (
    <header className="h-14 bg-white dark:bg-[#151823] border-b border-gray-100 dark:border-slate-800 flex items-center px-5 sticky top-0 z-30 w-full">
      <Link href="/dashboard" className="mr-auto">
        <SrevoxWordmark size="md" />
      </Link>

      <div className="flex items-center gap-2">
        {/* Search component */}
        <NavbarSearch />

        {/* Platform Update Icon */}
        <NavbarUpdate />

        {/* Quick Tour */}
        {hasTour && showQuickTour && (
          <button
            onClick={() => {
              try {
                const saved = localStorage.getItem("sv_completed_tours");
                let completed: Record<string, boolean> = {};
                if (saved) {
                  try { completed = JSON.parse(saved); } catch {}
                }
                completed[pathname || ""] = true;
                localStorage.setItem("sv_completed_tours", JSON.stringify(completed));
                window.dispatchEvent(new Event("sv_tour_status_changed"));
              } catch (e) {
                console.error(e);
              }
              window.dispatchEvent(new Event("sv_start_tour"));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold text-xs shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all shrink-0 mr-1.5 group"
            title="Start page walkthrough tutorial"
          >
            <Compass className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 group-hover:rotate-45 transition-transform duration-300" />
            <span>Quick Tour</span>
            {mounted && (
              <span className="relative flex h-1.5 w-1.5 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
            )}
          </button>
        )}

        {/* Troubleshooter */}
        <div className="relative group">
          <Link href="/dashboard/troubleshooter"
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-150 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors relative">
            <LifeBuoy className="w-4 h-4 text-indigo-500 dark:text-indigo-400 animate-pulse" />
          </Link>
          
          {/* Hover popup card */}
          <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-[#1e2130] border border-gray-100 dark:border-slate-700 rounded-2xl shadow-xl p-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 transform translate-y-1 group-hover:translate-y-0">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                <LifeBuoy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white text-xs">Troubleshooter</div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500 leading-tight mt-0.5">Diagnose setup logs & cluster errors.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications component */}
        <NavbarNotifications />

        <div className="w-px h-6 bg-gray-100 dark:bg-slate-800 mx-1" />

        {/* Profile component */}
        <NavbarProfile />
      </div>
    </header>
  );
}
