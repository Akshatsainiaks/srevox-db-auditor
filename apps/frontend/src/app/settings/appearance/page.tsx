"use client";
import React from "react";
import { CheckCircle, Sun, Moon, Monitor, Palette } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import type { Theme } from "@/components/ThemeProvider";

const THEMES: { value: Theme; label: string; icon: React.ElementType; desc: string }[] = [
  { value: "light",  label: "Light Mode",  icon: Sun,     desc: "Clean white interface" },
  { value: "dark",   label: "Dark Mode",   icon: Moon,    desc: "Easy on the eyes at night" },
  { value: "system", label: "System", icon: Monitor, desc: "Follows your OS setting" },
];

export default function ThemeSettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div id="settings-appearance" className="card p-6 space-y-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm animate-modal-slide-up" style={{ animationDuration: "0.2s" }}>
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/60">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
          <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">Theme Appearance</h2>
          <p className="text-xs text-gray-550 dark:text-slate-400">Choose how the Srevox client interfaces render for you</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {THEMES.map((t) => {
          const isActive = theme === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              className={`flex flex-col items-center gap-3 p-4.5 rounded-2xl border-2 transition-all hover:scale-[1.015] select-none relative ${
                isActive
                  ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/[0.06] shadow-sm"
                  : "border-gray-200 dark:border-slate-800/80 bg-white dark:bg-[#13151f] hover:border-gray-300 dark:hover:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/40"
              }`}
            >
              {/* Preview screen */}
              <div className={`w-full h-20 rounded-xl overflow-hidden border relative flex flex-col ${
                t.value === "dark"   ? "bg-[#0d0f17] border-slate-800"
                : t.value === "light" ? "bg-white border-gray-200"
                : "border-gray-200 dark:border-slate-800"
              }`}
                style={t.value === "system" ? { background: "linear-gradient(135deg, #ffffff 50%, #0d0f17 50%)" } : {}}
              >
                {/* Titlebar preview */}
                <div className={`h-4 w-full flex items-center px-1.5 gap-1 shrink-0 ${
                  t.value === "dark" ? "bg-[#151823]" : t.value === "system" ? "transparent" : "bg-gray-55"
                }`}
                  style={t.value === "system" ? { background: "linear-gradient(135deg, #f9fafb 50%, #151823 50%)" } : {}}
                >
                  <div className="w-1 h-1 rounded-full bg-red-400" />
                  <div className="w-1 h-1 rounded-full bg-yellow-400" />
                  <div className="w-1 h-1 rounded-full bg-green-400" />
                </div>
                {/* Main area preview */}
                <div className="p-2 space-y-1.5 flex-1 flex flex-col justify-center">
                  <div className={`h-1.5 rounded-full w-3/4 ${
                    t.value === "dark" ? "bg-slate-700" : t.value === "light" ? "bg-gray-200" : "bg-indigo-300/40"
                  }`} />
                  <div className={`h-1.5 rounded-full w-1/2 ${
                    t.value === "dark" ? "bg-slate-800" : t.value === "light" ? "bg-gray-100" : "bg-indigo-200/30"
                  }`} />
                </div>
              </div>

              <div className="text-center w-full">
                <div className={`text-xs font-bold flex items-center gap-1.5 justify-center ${isActive ? "text-indigo-700 dark:text-indigo-400" : "text-gray-700 dark:text-slate-300"}`}>
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{t.desc}</div>
              </div>

              {isActive && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-650 flex items-center justify-center shadow-md">
                  <CheckCircle className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
