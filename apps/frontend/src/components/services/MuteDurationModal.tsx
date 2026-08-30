"use client";
import React, { useState } from "react";
import { X, Clock } from "lucide-react";

interface MuteDurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
  title?: string;
}

export default function MuteDurationModal({ isOpen, onClose, onConfirm, title = "Mute Alerts" }: MuteDurationModalProps) {
  const [preset, setPreset] = useState("60"); // Default 1 hour
  const [customVal, setCustomVal] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (preset === "custom") {
      const mins = parseInt(customVal, 10);
      if (isNaN(mins) || mins <= 0) {
        alert("Please enter a valid number of minutes");
        return;
      }
      onConfirm(mins);
    } else {
      onConfirm(Number(preset));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-3xl w-full max-w-md shadow-2xl p-6 relative animate-modal-slide-up">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-350 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-800/60 pb-3 mb-4">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">{title}</h3>
            <p className="text-xs text-gray-400 dark:text-slate-500">Select how long to silence notifications</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              Mute Duration
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "15 Minutes", value: "15" },
                { label: "1 Hour", value: "60" },
                { label: "8 Hours", value: "480" },
                { label: "24 Hours", value: "1440" },
                { label: "Indefinitely", value: "0" },
                { label: "Custom Minutes", value: "custom" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPreset(opt.value)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition-all ${
                    preset === opt.value
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/15"
                      : "bg-gray-55 dark:bg-slate-900/40 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {preset === "custom" && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                Custom Minutes
              </label>
              <input
                type="number"
                placeholder="Enter minutes (e.g. 30)"
                value={customVal}
                onChange={(e) => setCustomVal(e.target.value)}
                className="input text-xs w-full py-2 px-3 rounded-xl"
                autoFocus
                required
                min="1"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800/60">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs py-2 px-4 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary text-xs py-2 px-5 rounded-xl font-bold"
            >
              Confirm Mute
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
