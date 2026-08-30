"use client";

import { useEffect, useState, Suspense } from "react";
import { Settings, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getUser, hasPermission } from "@/lib/auth";

// Decoupled sub-tab components
import LogsRetention from "@/components/settings/more-settings/LogsRetention";
import IncidentsRetention from "@/components/settings/more-settings/IncidentsRetention";
import UpdateChecks from "@/components/settings/more-settings/UpdateChecks";
import ApiDocs from "@/components/settings/more-settings/ApiDocs";
import SystemAlertSettings from "@/components/settings/more-settings/SystemAlertSettings";

type TabType = "logs" | "incidents" | "update" | "api-docs" | "system-alerts";

export default function MoreSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <MoreSettingsPageContent />
    </Suspense>
  );
}

function MoreSettingsPageContent() {
  const me = getUser();
  const isAdmin = me?.role === "admin";
  const searchParams = useSearchParams();

  const defaultTab: TabType = (() => {
    if (hasPermission(me, "changeRetention")) return "logs";
    if (hasPermission(me, "systemAlerts")) return "system-alerts";
    if (hasPermission(me, "viewApiDocs")) return "update";
    return "update";
  })();

  const activeTab = (searchParams.get("tab") || defaultTab) as TabType;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full animate-fade-in">
      {/* Header Info */}
      <div className="flex flex-col gap-1 border-b border-gray-100 dark:border-slate-800/60 pb-5 pb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500" />
          More settings
        </h1>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Advanced administrative controls, cleanup schedules, updates guides, and API documentation integrations.
        </p>
      </div>

      {/* Render selected component */}
      <div className="space-y-6">
        {activeTab === "logs" && <LogsRetention isAdmin={isAdmin} />}
        {activeTab === "incidents" && <IncidentsRetention isAdmin={isAdmin} />}
        {activeTab === "system-alerts" && <SystemAlertSettings isAdmin={isAdmin} />}
        {activeTab === "update" && <UpdateChecks />}
        {activeTab === "api-docs" && <ApiDocs />}
      </div>
    </div>
  );
}
