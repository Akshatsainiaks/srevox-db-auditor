"use client";

import { useEffect, useState } from "react";
import { Server, CheckCircle, Loader2, AlertTriangle, Trash2, ShieldCheck } from "lucide-react";
import { apiUpdateMe, apiGetMe, api } from "@/lib/api";
import { getUser, setUser } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import SecurityLock from "@/components/settings/more-settings/SecurityLock";

export default function OrgSettingsPage() {
  const { success, error } = useToast();

  const [orgName, setOrgName] = useState("");
  const [initialOrgName, setInitialOrgName] = useState("");
  const [showOrgOnDashboard, setShowOrgOnDashboard] = useState(true);
  const [initialShowOrgOnDashboard, setInitialShowOrgOnDashboard] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Danger Zone purge states
  const [purgeAction, setPurgeAction] = useState<"incidents" | "clusters" | "all" | null>(null);
  const [purgePassword, setPurgePassword] = useState("");
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeError, setPurgeError] = useState("");
  const [purgeSuccess, setPurgeSuccess] = useState("");

  useEffect(() => {
    apiGetMe()
      .then((data) => {
        setOrgName(data.org?.name || "");
        setInitialOrgName(data.org?.name || "");
      })
      .catch(console.error);

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("sv_show_org_dashboard");
      if (stored !== null) {
        setShowOrgOnDashboard(stored === "true");
        setInitialShowOrgOnDashboard(stored === "true");
      }
    }
  }, []);

  const saveOrg = async () => {
    if (!orgName.trim()) {
      error("Organization name cannot be empty");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await apiUpdateMe({ org_name: orgName });
      setInitialOrgName(orgName);
      
      const localUser = getUser();
      if (localUser) {
        setUser({
          ...localUser,
          org: localUser.org 
            ? { ...localUser.org, name: orgName } 
            : { org_id: localUser.org_id || "", name: orgName, slug: "" }
        });
      }

      localStorage.setItem("sv_show_org_dashboard", String(showOrgOnDashboard));
      setInitialShowOrgOnDashboard(showOrgOnDashboard);
      
      success("Organization updated successfully");
      setSaved(true);
      setIsEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      error(err?.response?.data?.detail || "Failed to save organization");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setOrgName(initialOrgName);
    setShowOrgOnDashboard(initialShowOrgOnDashboard);
    setIsEditing(false);
  };

  const handlePurge = async () => {
    if (!purgePassword) {
      setPurgeError("Please enter your password to confirm.");
      return;
    }
    setPurgeLoading(true);
    setPurgeError("");
    setPurgeSuccess("");
    try {
      await api.post("/api/auth/purge-data", {
        password: purgePassword,
        action: purgeAction,
      });
      success("Data purged successfully");
      setPurgeSuccess("Data purged successfully. This page will now reload.");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setPurgeError(err.response?.data?.detail || "Failed to purge data. Please verify your password.");
      error("Purge authorization failed");
    } finally {
      setPurgeLoading(false);
    }
  };

  const user = getUser();
  const isAdmin = user?.role === "admin";
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center w-full">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`changeSudoLock`) to view organization profile settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-modal-slide-up" style={{ animationDuration: "0.2s" }}>
      {/* Organization Info Card */}
      <div className="card p-6 space-y-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/60">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Organization Settings</h2>
            <p className="text-xs text-gray-550 dark:text-slate-400">Manage workspace identity</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Organization Name</label>
          <input 
            className="input w-full disabled:opacity-70 disabled:cursor-not-allowed" 
            value={orgName} 
            onChange={(e) => setOrgName(e.target.value)} 
            placeholder="Your organization" 
            disabled={!isEditing || saving}
          />
        </div>

        {/* Show Org Name on Dashboard Preference Toggle */}
        <div className={cn(
          "flex items-center justify-between p-4 bg-gray-50/50 dark:bg-slate-900/30 rounded-2xl border border-gray-150 dark:border-slate-800/60 select-none transition-opacity duration-200",
          (!isEditing || saving) && "opacity-75"
        )}>
          <div>
            <div className="text-xs font-bold text-gray-800 dark:text-slate-200">Show Org on Dashboard</div>
            <div className="text-[10px] text-gray-400 dark:text-slate-550 mt-0.5">Display your organization name badge in the dashboard welcome header</div>
          </div>
          <button
            type="button"
            disabled={!isEditing || saving}
            onClick={() => {
              setShowOrgOnDashboard(!showOrgOnDashboard);
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
              showOrgOnDashboard ? "bg-indigo-600 dark:bg-indigo-505" : "bg-gray-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                showOrgOnDashboard ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="pt-2 flex items-center gap-2">
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)} 
              className="btn-primary min-w-[150px] justify-center py-2.5"
            >
              Edit Organization
            </button>
          ) : (
            <>
              <button 
                onClick={saveOrg} 
                disabled={saving || !orgName || (orgName === initialOrgName && showOrgOnDashboard === initialShowOrgOnDashboard)} 
                className="btn-primary min-w-[150px] justify-center py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</>
                  : saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  : "Save Organization"}
              </button>
              <button 
                onClick={handleCancel} 
                disabled={saving} 
                className="py-2.5 px-5 rounded-xl text-xs font-bold border border-gray-300 dark:border-slate-700/80 text-gray-750 dark:text-slate-200 bg-gray-55/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-850 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-40"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sudo Security Lock Password Settings */}
      <div id="sudo-security-lock">
        <SecurityLock isAdmin={user?.role === "admin"} />
      </div>

      {/* Danger Zone warning banner */}
      <div className="bg-red-50/50 dark:bg-red-500/[0.03] border border-red-150 dark:border-red-500/25 p-5 rounded-2xl space-y-2 mt-6">
        <h3 className="text-sm font-bold text-red-650 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
          ⚠️ Administrative Danger Zone
        </h3>
        <p className="text-xs text-red-600/90 dark:text-red-400/80 leading-relaxed">
          These actions are highly destructive and will permanently delete data from your organization. Please execute them with caution. You will be required to input your account password to authorize any of these actions.
        </p>
      </div>

      {/* Purge Incidents */}
      <div className="card p-6 space-y-4 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Purge All Incident Logs</h4>
            <p className="text-xs text-gray-550 dark:text-slate-400 leading-normal max-w-xl">
              Permanently wipes all historical and active pod crash incident records, AI diagnoses, and alert logs. Your clusters will continue to be monitored.
            </p>
          </div>
          <button
            onClick={() => setPurgeAction("incidents")}
            className="btn-danger text-xs font-semibold py-2.5 px-4 rounded-xl shrink-0"
          >
            Purge Incidents
          </button>
        </div>
      </div>

      {/* Purge Clusters */}
      <div className="card p-6 space-y-4 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Purge All Clusters</h4>
            <p className="text-xs text-gray-550 dark:text-slate-400 leading-normal max-w-xl">
              Permanently deletes all registered Kubernetes clusters. This stops all monitoring agents, event processing, and metrics streams.
            </p>
          </div>
          <button
            onClick={() => setPurgeAction("clusters")}
            className="btn-danger text-xs font-semibold py-2.5 px-4 rounded-xl shrink-0"
          >
            Purge Clusters
          </button>
        </div>
      </div>

      {/* Purge All Data */}
      <div className="card p-6 space-y-4 bg-white dark:bg-[#13151f] border border-red-250 dark:border-red-500/20 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-650" />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
              Reset Entire Organization Data
            </h4>
            <p className="text-xs text-gray-550 dark:text-slate-450 leading-normal max-w-xl">
              Performs a complete wipe of all clusters, rules, channels, resource alerts, and logs. Your organization account will remain active, but all workspaces will be reset to a blank slate.
            </p>
          </div>
          <button
            onClick={() => setPurgeAction("all")}
            className="btn-danger bg-red-600 hover:bg-red-700 text-white border-red-650 hover:border-red-700 text-xs font-bold py-2.5 px-4 rounded-xl shrink-0"
          >
            Reset Organization Data
          </button>
        </div>
      </div>

      {/* Confirmation Purge Modal Overlay */}
      {purgeAction && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 animate-modal-slide-up" style={{ animationDuration: "0.25s" }}>
            <div className="flex items-center gap-3 text-red-650 dark:text-red-400 pb-2 border-b border-gray-100 dark:border-slate-800/60">
              <div className="w-10 h-10 rounded-xl bg-red-55/10 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide">Confirm Data Purge</h3>
                <p className="text-[10px] text-gray-450 dark:text-slate-500">Authorized Personnel Only</p>
              </div>
            </div>

            <div className="bg-red-50/50 dark:bg-red-500/[0.03] border border-red-100 dark:border-red-500/20 p-3.5 rounded-xl text-xs text-red-705 dark:text-red-400 leading-normal font-semibold">
              {purgeAction === "incidents" && (
                <><strong>Warning:</strong> You are about to permanently delete all incident records from your organization. This will clear the dashboard feed completely.</>
              )}
              {purgeAction === "clusters" && (
                <><strong>Warning:</strong> You are about to delete all clusters. All real-time node metrics, alert watcher routines, and connected settings will be deleted.</>
              )}
              {purgeAction === "all" && (
                <><strong>CRITICAL WARNING:</strong> You are about to reset all organization data. This will purge all clusters, rules, channels, resource alerts, and logs, returning the workspace to its default blank state.</>
              )}
            </div>

            {purgeError && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-150 dark:border-red-500/20 p-3 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400">
                {purgeError}
              </div>
            )}

            {purgeSuccess && (
              <div className="bg-green-55 dark:bg-green-500/10 border border-green-150 dark:border-green-500/25 p-3 rounded-xl text-xs font-semibold text-green-600 dark:text-green-400">
                {purgeSuccess}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                Enter your password to authorize:
              </label>
              <input
                type="password"
                className="input w-full"
                value={purgePassword}
                onChange={(e) => setPurgePassword(e.target.value)}
                placeholder="••••••••"
                disabled={purgeLoading || !!purgeSuccess}
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPurgeAction(null);
                  setPurgePassword("");
                  setPurgeError("");
                  setPurgeSuccess("");
                }}
                disabled={purgeLoading}
                className="py-2.5 px-5 rounded-xl text-xs font-bold border border-gray-300 dark:border-slate-700/80 text-gray-750 dark:text-slate-200 bg-gray-55/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-850 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-40 flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurge}
                disabled={purgeLoading || !purgePassword || !!purgeSuccess}
                className="btn-danger bg-red-600 hover:bg-red-700 border-red-650 hover:border-red-700 text-white flex-1 justify-center py-2.5 rounded-xl text-xs font-bold disabled:opacity-40"
              >
                {purgeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
