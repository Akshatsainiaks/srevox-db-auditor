"use client";

import React, { useState, useEffect } from "react";
import { Database, Info, Loader2, Clock, Calendar, CheckCircle2, History, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { fetchDbAuditRetention, saveDbAuditRetention, clearRetentionHistory } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { getUser, hasPermission } from "@/lib/auth";

interface SweepRun {
  run_id: string;
  run_type: string;
  items_purged: number;
  completed_at: string;
}

interface AuditRetentionProps {
  isAdmin?: boolean;
}

export default function AuditRetention({ isAdmin = true }: AuditRetentionProps) {
  const { success, error: toastError } = useToast();
  const { confirm } = useConfirm();
  const user = getUser();
  const canEdit = hasPermission(user, "changeRetention") || isAdmin;

  const [mounted, setMounted] = useState(false);
  const [retentionDays, setRetentionDays] = useState<number | string>(90);
  const [retentionIntervalHours, setRetentionIntervalHours] = useState<number | string>(24);
  const [loadingRetention, setLoadingRetention] = useState(false);

  // Original saved values tracking for Cancel/Save visibility check
  const [originalDays, setOriginalDays] = useState<number | string>(90);
  const [originalIntervalHours, setOriginalIntervalHours] = useState<number | string>(24);

  // Custom toggles
  const [customDaysActive, setCustomDaysActive] = useState(false);
  const [customIntervalActive, setCustomIntervalActive] = useState(false);

  const [runs, setRuns] = useState<SweepRun[]>([]);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  const loadRetentionData = () => {
    setLoadingRetention(true);
    fetchDbAuditRetention()
      .then((res) => {
        if (res?.policy) {
          const days = res.policy.db_audit_days ?? 90;
          const intervalHrs = res.policy.purge_interval_hours ?? 24;
          setRetentionDays(days);
          setRetentionIntervalHours(intervalHrs);

          setOriginalDays(days);
          setOriginalIntervalHours(intervalHrs);

          const presets = [0, 7, 30, 90, 180, 365];
          setCustomDaysActive(!presets.includes(Number(days)));

          const intervalPresets = [1, 4, 12, 24];
          setCustomIntervalActive(!intervalPresets.includes(Number(intervalHrs)));
        }
        if (res?.runs) {
          setRuns(res.runs);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingRetention(false));
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      loadRetentionData();
    }
  }, [mounted]);

  const handleSavePolicy = async () => {
    if (!canEdit) return;
    setSavingPolicy(true);
    try {
      await saveDbAuditRetention({
        db_audit_days: Number(retentionDays),
        purge_interval_hours: Number(retentionIntervalHours),
      });
      success("Database audit retention policy updated successfully.");
      loadRetentionData();
    } catch (err: any) {
      console.error(err);
      toastError(err.message || "Failed to update database audit retention policy.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleClearHistory = async () => {
    if (!canEdit) return;
    const ok = await confirm({
      title: "Clear logs history?",
      message: "Are you sure you want to clear the retention logs history? This action cannot be undone.",
      confirmLabel: "Clear",
      variant: "danger"
    });
    if (!ok) return;

    setClearingHistory(true);
    try {
      await clearRetentionHistory("db_audit");
      success("Database audit retention execution history cleared.");
      loadRetentionData();
    } catch {
      toastError("Failed to clear history.");
    } finally {
      setClearingHistory(false);
    }
  };

  const getStatus = () => {
    const auditRuns = runs.filter(r => r.run_type === "db_audit" || !r.run_type);
    const lastRun = auditRuns[0];
    const intervalHrs = Number(retentionIntervalHours) || 24;
    if (!lastRun) {
      return {
        lastRunTime: "Never executed",
        nextRunTime: `Scheduled within ${intervalHrs} hours`,
        purgedCount: 0
      };
    }
    const lastDate = new Date(lastRun.completed_at);
    const nextDate = new Date(lastDate.getTime() + intervalHrs * 60 * 60 * 1000);
    return {
      lastRunTime: timeAgo(lastRun.completed_at),
      nextRunTime: nextDate > new Date() ? timeAgo(nextDate.toISOString()) + " from now" : "Pending execution",
      purgedCount: lastRun.items_purged
    };
  };

  if (mounted && !canEdit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[45vh] p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`changeRetention`) to view or modify database audit retention policies.
        </p>
      </div>
    );
  }

  if (!mounted || loadingRetention) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const auditStatus = getStatus();
  const hasPolicyChanges =
    Number(retentionDays) !== Number(originalDays) ||
    Number(retentionIntervalHours) !== Number(originalIntervalHours);

  return (
    <div className="space-y-6 animate-fade-in">
      <div id="retention-policy-card" className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Database Audit & CDC Retention Policy
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Configure data retention schedules and automated purging intervals for CDC mutation events and transaction ledgers.
            </p>
          </div>
        </div>

        {/* Info callout block */}
        <div className="bg-indigo-50/40 dark:bg-indigo-500/5 border border-indigo-100/40 dark:border-indigo-500/10 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed">
          <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-gray-600 dark:text-slate-400">
            <p className="font-bold text-gray-800 dark:text-slate-200">How Retention & Purging Works</p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-gray-500 dark:text-slate-400">
              <li><strong>Retention Period (Days):</strong> Dictates the maximum age of CDC database mutation event records. Events older than this threshold (e.g. 90 days) are flagged as stale and targeted for deletion. Setting this to 0 keeps them indefinitely.</li>
              <li><strong>Purge Frequency (Hours):</strong> Configures the automated cron schedule on the background engine. E.g. &quot;Daily (24 hours)&quot; means the system checks for and removes stale events every day.</li>
              <li><strong>Immediate Execution:</strong> Whenever you change your retention settings, an immediate database purge runs for that specific database audit type to clean up any newly deprecated entries instantly.</li>
            </ul>
          </div>
        </div>

        {/* Status statistics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 dark:bg-slate-900/35 border border-gray-100 dark:border-slate-800/60 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Last Run Status</span>
            <p className="text-xs font-semibold text-gray-800 dark:text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
              {auditStatus.lastRunTime}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/35 border border-gray-100 dark:border-slate-800/60 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Next Scheduled Purge</span>
            <p className="text-xs font-semibold text-gray-800 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              {auditStatus.nextRunTime}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/35 border border-gray-100 dark:border-slate-800/60 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Last Purged Count</span>
            <p className="text-xs font-semibold text-gray-800 dark:text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
              {auditStatus.purgedCount} events deleted
            </p>
          </div>
        </div>

        {/* Form Input fields */}
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5 max-w-md">
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
              Audit Events Retention Period
            </label>
            <select
              disabled={!canEdit || loadingRetention}
              value={customDaysActive ? "custom" : retentionDays}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setCustomDaysActive(true);
                  setRetentionDays(45);
                } else {
                  setCustomDaysActive(false);
                  setRetentionDays(Number(val));
                }
              }}
              className="input text-xs py-1.5 px-2.5 h-[34px] rounded-lg bg-gray-50/30 dark:bg-slate-900/40 w-full"
            >
              <option value={0}>Keep Indefinitely (Never Delete)</option>
              <option value={7}>1 Week (7 Days)</option>
              <option value={30}>1 Month (30 Days)</option>
              <option value={90}>3 Months (90 Days)</option>
              <option value={180}>6 Months (180 Days)</option>
              <option value={365}>1 Year (365 Days)</option>
              <option value="custom">Custom Days...</option>
            </select>
          </div>

          {customDaysActive && (
            <div className="space-y-1.5 max-w-md p-4 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-gray-100 dark:border-slate-800/40 animate-fade-in">
              <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                Enter Custom Days
              </label>
              <input
                type="number"
                disabled={!canEdit || loadingRetention}
                min={1}
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                placeholder="e.g. 45"
                className="input text-xs py-1.5 px-2.5 h-[34px] rounded-lg w-full"
              />
            </div>
          )}

          <div id="retention-interval-card" className="space-y-1.5 max-w-md">
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
              Purge Execution Frequency
            </label>
            <select
              disabled={!canEdit || loadingRetention}
              value={customIntervalActive ? "custom" : retentionIntervalHours}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setCustomIntervalActive(true);
                  setRetentionIntervalHours(6);
                } else {
                  setCustomIntervalActive(false);
                  setRetentionIntervalHours(Number(val));
                }
              }}
              className="input text-xs py-1.5 px-2.5 h-[34px] rounded-lg bg-gray-50/30 dark:bg-slate-900/40 w-full"
            >
              <option value={1}>Every 1 hour</option>
              <option value={4}>Every 4 hours</option>
              <option value={12}>Every 12 hours</option>
              <option value={24}>Daily (24 hours)</option>
              <option value="custom">Custom Hours...</option>
            </select>
          </div>

          {customIntervalActive && (
            <div className="space-y-1.5 max-w-md p-4 bg-slate-50 dark:bg-slate-950/20 rounded-xl border border-gray-100 dark:border-slate-800/40 animate-fade-in">
              <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                Enter Custom Hours
              </label>
              <input
                type="number"
                disabled={!canEdit || loadingRetention}
                min={1}
                value={retentionIntervalHours}
                onChange={(e) => setRetentionIntervalHours(e.target.value)}
                placeholder="e.g. 6"
                className="input text-xs py-1.5 px-2.5 h-[34px] rounded-lg w-full"
              />
            </div>
          )}
        </div>

        {canEdit && hasPolicyChanges && (
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800/60 animate-fade-in">
            <button
              type="button"
              onClick={loadRetentionData}
              disabled={savingPolicy}
              className="btn-secondary text-xs py-1.5 px-4 rounded-lg font-bold border border-gray-200 dark:border-slate-800"
            >
              Cancel
            </button>
            <button
              id="purge-now-btn"
              onClick={handleSavePolicy}
              disabled={savingPolicy}
              className="btn-primary text-xs py-1.5 px-4 rounded-lg font-bold flex items-center gap-1.5"
            >
              {savingPolicy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving Audit Policy...
                </>
              ) : (
                "Save Audit Retention"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Sweep Run Log Table */}
      <div id="retention-runs-list" className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-500" />
            Audit Events Cleanup Logs History
          </h3>
          {canEdit && runs.filter(r => r.run_type === "db_audit" || !r.run_type).length > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={clearingHistory}
              className="text-[10px] font-bold text-red-500 hover:text-red-600 hover:underline inline-flex items-center gap-1"
            >
              {clearingHistory ? <Loader2 className="w-3 h-3 animate-spin" /> : "Clear History"}
            </button>
          )}
        </div>
        <div className="overflow-x-auto border border-gray-100 dark:border-slate-800/80 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/35 border-b border-gray-100 dark:border-slate-800/60">
                <th className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3">Completed At</th>
                <th className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3">Items Purged</th>
                <th className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3">Execution Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.filter(r => r.run_type === "db_audit" || !r.run_type).length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-6 text-xs text-gray-400 dark:text-slate-500">
                    No recent database audit cleanup runs recorded
                  </td>
                </tr>
              ) : (
                runs.filter(r => r.run_type === "db_audit" || !r.run_type).map((run, i) => (
                  <tr key={i} className="border-b border-gray-100/50 dark:border-slate-800/20 text-xs text-gray-600 dark:text-slate-300 hover:bg-slate-50/20 dark:hover:bg-slate-900/10">
                    <td className="px-4 py-2.5 font-medium">{new Date(run.completed_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{run.items_purged} events</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-100/40">
                        Success
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
