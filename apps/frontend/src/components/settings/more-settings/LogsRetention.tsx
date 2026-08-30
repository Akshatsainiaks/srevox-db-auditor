"use client";
import React, { useState, useEffect } from "react";
import { Database, Info, Loader2, Clock, Calendar, CheckCircle2, History, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { fetchLogsRetentionPolicy, saveLogsRetentionPolicy, clearRetentionHistory } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { getUser, hasPermission } from "@/lib/auth";

interface SweepRun {
  run_id: string;
  run_type: string;
  items_purged: number;
  completed_at: string;
}

interface LogsRetentionProps {
  isAdmin: boolean;
}

export default function LogsRetention({ isAdmin }: LogsRetentionProps) {
  const { success, error: toastError } = useToast();
  const { confirm } = useConfirm();
  const user = getUser();
  const canEdit = hasPermission(user, "changeRetention");

  const [mounted, setMounted] = useState(false);
  const [retentionActivityDays, setRetentionActivityDays] = useState<number | string>(0);
  const [retentionIntervalHours, setRetentionIntervalHours] = useState<number | string>(4);
  const [loadingRetention, setLoadingRetention] = useState(false);

  // Original saved values tracking for Cancel/Save visibility check
  const [originalActivityDays, setOriginalActivityDays] = useState<number | string>(0);
  const [originalIntervalHours, setOriginalIntervalHours] = useState<number | string>(4);

  // Custom toggles
  const [customLogsActive, setCustomLogsActive] = useState(false);
  const [customIntervalActive, setCustomIntervalActive] = useState(false);

  const [runs, setRuns] = useState<SweepRun[]>([]);
  const [savingLogs, setSavingLogs] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  const loadRetentionData = () => {
    setLoadingRetention(true);
    fetchLogsRetentionPolicy()
      .then((res) => {
        if (res.policy) {
          const actDays = res.policy.activity_days || 0;
          const intervalHrs = res.policy.purge_interval_hours || 4;
          setRetentionActivityDays(actDays);
          setRetentionIntervalHours(intervalHrs);

          setOriginalActivityDays(actDays);
          setOriginalIntervalHours(intervalHrs);

          const presets = [0, 7, 30, 90, 180, 365];
          setCustomLogsActive(!presets.includes(actDays));

          const intervalPresets = [1, 4, 12, 24];
          setCustomIntervalActive(!intervalPresets.includes(intervalHrs));
        }
        if (res.runs) {
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

  const handleSaveLogsRetention = async () => {
    if (!canEdit) return;
    setSavingLogs(true);
    try {
      await saveLogsRetentionPolicy({
        activity_days: Number(retentionActivityDays),
        purge_interval_hours: Number(retentionIntervalHours),
      });
      success("Audit logs retention policy updated successfully.");
      loadRetentionData();
    } catch (err: any) {
      console.error(err);
      toastError(err.message || "Failed to update audit logs retention policy.");
    } finally {
      setSavingLogs(false);
    }
  };

  const handleClearHistory = async () => {
    if (!canEdit) return;
    const { confirmed } = await confirm({
      title: "Clear logs history?",
      message: "Are you sure you want to clear the retention logs history? This action cannot be undone.",
      confirmLabel: "Clear",
      variant: "danger"
    });
    if (!confirmed) return;
    setClearingHistory(true);
    try {
      await clearRetentionHistory("logs");
      success("Logs retention execution history cleared.");
      loadRetentionData();
    } catch {
      toastError("Failed to clear history.");
    } finally {
      setClearingHistory(false);
    }
  };

  const getLogsStatus = () => {
    const logsRuns = runs.filter(r => r.run_type === "logs");
    const lastRun = logsRuns[0];
    const intervalHrs = Number(retentionIntervalHours) || 4;
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
          You do not have the required permission (`changeRetention`) to view or modify audit logs retention policies.
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

  const logsStatus = getLogsStatus();
  const hasLogsChanges = 
    Number(retentionActivityDays) !== Number(originalActivityDays) || 
    Number(retentionIntervalHours) !== Number(originalIntervalHours);

  return (
    <div className="space-y-6 animate-fade-in">
      <div id="audit-logs-retention" className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Audit Logs Retention Policy
            </h2>
            <p className="text-[11px] text-gray-550 dark:text-slate-400 mt-0.5">
              Configure data retention schedules and automated purging intervals for organization member activities ledger.
            </p>
          </div>
        </div>

        {/* Info callout block */}
        <div className="bg-indigo-50/40 dark:bg-indigo-500/5 border border-indigo-100/40 dark:border-indigo-500/10 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed">
          <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-gray-600 dark:text-slate-400">
            <p className="font-bold text-gray-850 dark:text-slate-200">How Retention & Purging Works</p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-gray-555 dark:text-slate-455">
              <li><strong>Retention Period (Days):</strong> Dictates the maximum age of audit activities log entries. Logs older than this threshold (e.g. 30 days) are flagged as stale and targeted for deletion. Setting this to 0 keeps them indefinitely.</li>
              <li><strong>Purge Frequency (Hours):</strong> Configures the automated cron schedule on the background worker. E.g. &quot;Every 4 hours&quot; means the system checks for and removes stale logs 6 times a day.</li>
              <li><strong>Immediate Execution:</strong> Whenever you change your retention settings, an immediate database purge runs for that specific logs type to clean up any newly deprecated entries instantly.</li>
            </ul>
          </div>
        </div>

        {/* Status statistics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 dark:bg-slate-900/35 border border-gray-100 dark:border-slate-800/60 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Last Run Status</span>
            <p className="text-xs font-semibold text-gray-800 dark:text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
              {logsStatus.lastRunTime}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/35 border border-gray-100 dark:border-slate-800/60 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Next Scheduled Purge</span>
            <p className="text-xs font-semibold text-gray-800 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              {logsStatus.nextRunTime}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/35 border border-gray-100 dark:border-slate-800/60 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Last Purged Count</span>
            <p className="text-xs font-semibold text-gray-800 dark:text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
              {logsStatus.purgedCount} log entries deleted
            </p>
          </div>
        </div>

        {/* Form Input fields */}
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5 max-w-md">
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
              Logs Retention Period
            </label>
            <select
              disabled={!canEdit || loadingRetention}
              value={customLogsActive ? "custom" : retentionActivityDays}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setCustomLogsActive(true);
                  setRetentionActivityDays(45); // default custom
                } else {
                  setCustomLogsActive(false);
                  setRetentionActivityDays(Number(val));
                }
              }}
              className="input text-xs py-1.5 px-2.5 h-[34px] rounded-lg bg-gray-55/30 dark:bg-slate-900/40"
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

          {customLogsActive && (
            <div className="space-y-1.5 max-w-md p-4 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-gray-100 dark:border-slate-800/40 animate-fade-in">
              <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                Enter Custom Days
              </label>
              <input
                type="number"
                disabled={!canEdit || loadingRetention}
                min={1}
                value={retentionActivityDays}
                onChange={(e) => setRetentionActivityDays(e.target.value)}
                placeholder="e.g. 45"
                className="input text-xs py-1.5 px-2.5 h-[34px] rounded-lg"
              />
            </div>
          )}

          <div className="space-y-1.5 max-w-md">
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
                  setRetentionIntervalHours(6); // default custom
                } else {
                  setCustomIntervalActive(false);
                  setRetentionIntervalHours(Number(val));
                }
              }}
              className="input text-xs py-1.5 px-2.5 h-[34px] rounded-lg bg-gray-55/30 dark:bg-slate-900/40"
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
                className="input text-xs py-1.5 px-2.5 h-[34px] rounded-lg"
              />
            </div>
          )}
        </div>

        {canEdit && hasLogsChanges && (
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800/60 animate-fade-in">
            <button
              type="button"
              onClick={loadRetentionData}
              disabled={savingLogs}
              className="btn-secondary text-xs py-1.5 px-4 rounded-lg font-bold border border-gray-200 dark:border-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveLogsRetention}
              disabled={savingLogs}
              className="btn-primary text-xs py-1.5 px-4 rounded-lg font-bold flex items-center gap-1.5"
            >
              {savingLogs ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving Logs Policy...
                </>
              ) : (
                "Save Logs Retention"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Sweep Run Log Table */}
      <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-500" />
            Audit Logs Cleanup Logs History
          </h3>
          {canEdit && runs.filter(r => r.run_type === "logs").length > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={clearingHistory}
              className="text-[10px] font-bold text-red-555 hover:text-red-655 hover:underline inline-flex items-center gap-1"
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
                <th className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.filter(r => r.run_type === "logs").length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-xs text-gray-400 dark:text-slate-500">
                    No recent logs cleanup runs recorded
                  </td>
                </tr>
              ) : (
                runs.filter(r => r.run_type === "logs").map((run, i) => (
                  <tr key={i} className="border-b border-gray-100/50 dark:border-slate-800/20 text-xs text-gray-655 dark:text-slate-350 hover:bg-slate-50/20 dark:hover:bg-slate-900/10">
                    <td className="px-4 py-2.5 font-medium">{new Date(run.completed_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-mono text-indigo-650 dark:text-indigo-400">{run.items_purged} items</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-100/40">
                        Success
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {run.run_id ? (
                        <Link
                          href={`/settings/more-settings/runs/${run.run_id}`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-655 hover:text-indigo-700 dark:text-indigo-400 hover:underline"
                        >
                          View Details &rarr;
                        </Link>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">No details</span>
                      )}
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
