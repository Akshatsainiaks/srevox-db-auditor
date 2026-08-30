"use client";
import React from "react";
import { MessageSquare, Compass } from "lucide-react";

export default function FeedbackSettingsPage() {
  const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL || "https://srevox-website.vercel.app";

  return (
    <div id="settings-feedback" className="card p-8 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm space-y-6 animate-modal-slide-up text-center max-w-xl mx-auto" style={{ animationDuration: "0.2s" }}>
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mx-auto mb-2">
        <MessageSquare className="w-8 h-8 text-indigo-650 dark:text-indigo-400" />
      </div>
      <div className="space-y-2">
        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Help us improve Srevox</h3>
        <p className="text-xs text-gray-550 dark:text-slate-400 leading-relaxed">
          Have ideas for new features, found a bug, or need help configuring your setup? Please visit our official feedback portal to submit your thoughts directly to the Srevox core team.
        </p>
      </div>

      <div className="pt-2">
        <a
          href={`${websiteUrl}/feedback`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl text-xs transition-all shadow-sm shadow-indigo-200 dark:shadow-none"
        >
          Share Feedback
          <Compass className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
