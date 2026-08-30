"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Calendar, FileText, Activity, CheckCircle, Database, ShieldAlert, Loader2, Sparkles
} from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

interface PurgedLogDetails {
  action: string;
  resource: string;
  resource_id?: string;
  created_at: string;
}

interface PurgedIncidentDetails {
  pod_name: string;
  namespace: string;
  crash_reason: string;
  first_seen_at: string;
}

interface RunDetailsResponse {
  run_id: string;
  run_type: "logs" | "incidents";
  items_purged: number;
  completed_at: string;
  details: (PurgedLogDetails | PurgedIncidentDetails)[];
}

export default function RetentionRunDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [run, setRun] = useState<RunDetailsResponse | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    setError("");

    api.get(`/api/retention/runs/${runId}`)
      .then((res) => {
        setRun(res.data);
      })
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.detail || "Failed to load retention run details");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [runId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs text-gray-500 dark:text-slate-400">Loading sweep details...</span>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="bg-red-50/10 dark:bg-red-500/5 border border-red-200/40 dark:border-red-500/10 rounded-2xl p-6 text-center max-w-md mx-auto my-12 space-y-4">
        <ShieldAlert className="w-10 h-10 text-red-550 mx-auto" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Failed to Load</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400">{error || "Retention run details not found."}</p>
        <button
          onClick={() => router.back()}
          className="btn-primary text-xs py-1.5 px-4 rounded-lg font-bold inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
        </button>
      </div>
    );
  }

  const backTab = run.run_type === "logs" ? "logs" : "incidents";

  const totalItems = run.details.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDetails = run.details.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6 w-full animate-fade-in text-gray-800 dark:text-slate-200">
      
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-slate-500 font-medium">
            <span>Settings</span>
            <span>&bull;</span>
            <Link href={`/settings/more-settings?tab=${backTab}`} className="hover:underline hover:text-indigo-500">
              More settings
            </Link>
            <span>&bull;</span>
            <span className="text-gray-600 dark:text-slate-300 font-semibold">Sweep details</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            Purge Execution Details
          </h1>
        </div>

        <Link
          href={`/settings/more-settings?tab=${backTab}`}
          className="btn-secondary text-xs py-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5 border border-gray-200 dark:border-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Retention Policies</span>
        </Link>
      </div>

      {/* Sweep Overview Statistics Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Date Card */}
        <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Purged At</span>
            <p className="text-xs font-bold text-gray-900 dark:text-white">
              {new Date(run.completed_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Type Card */}
        <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
            {run.run_type === "logs" ? <FileText className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Record Type</span>
            <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              {run.run_type === "logs" ? "Audit Ledger Logs" : "Incident Crash Logs"}
            </p>
          </div>
        </div>

        {/* Count Card */}
        <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Total Purged</span>
            <p className="text-xs font-bold text-gray-900 dark:text-white">
              {run.items_purged} {run.run_type === "logs" ? "logs" : "incidents"} deleted
            </p>
          </div>
        </div>

      </div>

      {/* Main Records Details Card */}
      <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-500" />
            Purged Database Records
          </h2>
          <p className="text-[11px] text-gray-550 dark:text-slate-400 mt-0.5">
            The following table displays metadata of the records that were permanently removed from the database during this purge sweep.
          </p>
        </div>

        <div className="overflow-x-auto border border-gray-100 dark:border-slate-800/80 rounded-xl">
          <table className="w-full text-left border-collapse">
            
            {/* Logs Columns */}
            {run.run_type === "logs" ? (
              <>
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/35 border-b border-gray-100 dark:border-slate-800/60">
                    <th className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3">Action Name</th>
                    <th className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3">Resource</th>
                    <th className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3">Resource ID</th>
                    <th className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3 text-right">Log Time</th>
                  </tr>
                </thead>
                <tbody>
                  {totalItems === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-xs text-gray-400 dark:text-slate-500">
                        No individual log records details available for this sweep run.
                      </td>
                    </tr>
                  ) : (
                    (paginatedDetails as PurgedLogDetails[]).map((log, index) => (
                      <tr key={index} className="border-b border-gray-100/50 dark:border-slate-800/20 text-xs text-gray-650 dark:text-slate-350 hover:bg-slate-50/20 dark:hover:bg-slate-900/10">
                        <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white">
                          {log.action}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-[10px] text-slate-700 dark:text-slate-300">
                            {log.resource}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-400 text-[10px]">
                          {log.resource_id || "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400 dark:text-slate-500 font-medium">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            ) : (
              // Incidents Columns
              <>
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/35 border-b border-gray-100 dark:border-slate-800/60">
                    <th className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3">Pod Name</th>
                    <th className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3">Namespace</th>
                    <th className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3">Crash Reason</th>
                    <th className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-3 text-right">Detected At</th>
                  </tr>
                </thead>
                <tbody>
                  {totalItems === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-xs text-gray-400 dark:text-slate-500">
                        No individual incident records details available for this sweep run.
                      </td>
                    </tr>
                  ) : (
                    (paginatedDetails as PurgedIncidentDetails[]).map((inc, index) => (
                      <tr key={index} className="border-b border-gray-100/50 dark:border-slate-800/20 text-xs text-gray-650 dark:text-slate-350 hover:bg-slate-50/20 dark:hover:bg-slate-900/10">
                        <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white">
                          {inc.pod_name}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                          {inc.namespace}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center text-[10px] bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 px-2 py-0.5 rounded font-bold border border-red-100/40">
                            {inc.crash_reason}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400 dark:text-slate-500 font-medium">
                          {new Date(inc.first_seen_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            )}

          </table>
        </div>

        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-[#13151f] border-t border-gray-100 dark:border-slate-850/60 pt-4 select-none">
            <div className="text-xs text-gray-500 dark:text-slate-400">
              Showing <span className="font-semibold text-gray-800 dark:text-white">{startIndex + 1}</span> to{" "}
              <span className="font-semibold text-gray-800 dark:text-white">
                {Math.min(startIndex + itemsPerPage, totalItems)}
              </span>{" "}
              of <span className="font-semibold text-gray-800 dark:text-white">{totalItems}</span> results
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {/* Prev Button */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-gray-50 dark:disabled:hover:bg-slate-800 transition"
                >
                  Previous
                </button>

                {/* Page Numbers */}
                {(() => {
                  const pages = [];
                  const range = 2;
                  for (let i = 1; i <= totalPages; i++) {
                    if (
                      i === 1 ||
                      i === totalPages ||
                      (i >= currentPage - range && i <= currentPage + range)
                    ) {
                      pages.push(i);
                    } else if (pages[pages.length - 1] !== "...") {
                      pages.push("...");
                    }
                  }
                  return pages;
                })().map((p, idx) => (
                  <button
                    key={idx}
                    disabled={p === "..."}
                    onClick={() => typeof p === "number" && setCurrentPage(p)}
                    className={`w-8 h-8 rounded-xl text-xs font-semibold transition ${
                      p === currentPage
                        ? "bg-indigo-600 text-white"
                        : p === "..."
                        ? "text-gray-400 dark:text-slate-600 cursor-default"
                        : "bg-transparent text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {p}
                  </button>
                ))}

                {/* Next Button */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-gray-50 dark:disabled:hover:bg-slate-800 transition"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
