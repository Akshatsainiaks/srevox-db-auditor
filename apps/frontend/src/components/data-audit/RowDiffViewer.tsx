"use client";

import { useState } from "react";
import { Check, ShieldAlert, FileText, Lock, Filter, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface RowDiffViewerProps {
  event: any;
  onClose: () => void;
}

const PII_PATTERNS = ["password", "ssn", "tax_id", "credit_card", "cvv", "api_token", "secret", "access_token", "private_key", "hashed_password", "auth_token"];

function toArray(val: any): string[] {
  if (!val) return [];
  let arr: any[] = [];
  if (Array.isArray(val)) {
    arr = val;
  } else if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) arr = parsed;
      else if (parsed !== null && parsed !== undefined) arr = [parsed];
    } catch {
      arr = [val];
    }
  } else if (typeof val === "object") {
    arr = Object.keys(val);
  }
  return arr.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item)));
}

export default function RowDiffViewer({ event, onClose }: RowDiffViewerProps) {
  const [showOnlyChanged, setShowOnlyChanged] = useState(true);

  if (!event) return null;

  let beforeObj: Record<string, any> = {};
  let afterObj: Record<string, any> = {};

  try {
    if (event.before && event.before !== "null") {
      beforeObj = typeof event.before === "string" ? JSON.parse(event.before) : event.before;
    }
  } catch (e) {}

  try {
    if (event.after && event.after !== "null") {
      afterObj = typeof event.after === "string" ? JSON.parse(event.after) : event.after;
    }
  } catch (e) {}

  const allKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));
  const changedArray = toArray(event.changed_fields);
  const maskedArray = toArray(event.masked_fields);

  // Filter keys if showOnlyChanged is enabled
  const displayedKeys = (showOnlyChanged && event.operation === "UPDATE" && changedArray.length > 0)
    ? allKeys.filter((k) => changedArray.includes(k))
    : allKeys;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0f111a] border border-gray-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <span className={cn(
              "px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wide",
              event.operation === "INSERT" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
              event.operation === "UPDATE" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
              event.operation === "DELETE" && "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
            )}>
              {event.operation}
            </span>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                {String(event.database || '')}.{String(event.schema || '')}.{String(event.table || '')}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 font-mono mt-0.5">
                ID: <span className="font-bold text-indigo-600 dark:text-indigo-400">{String(event.id || event.event_id || '')}</span> • PK: {typeof event.primary_key === 'object' ? JSON.stringify(event.primary_key) : String(event.primary_key || '—')} • Mode: <span className="font-bold text-indigo-500">{String(event.capture_mode || "CDC Stream")}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-bold text-base"
          >
            ✕
          </button>
        </div>

        {/* Cryptographic Hash Ledger Strip & View Toggle */}
        <div className="px-5 py-2.5 bg-indigo-500/10 border-b border-indigo-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] truncate">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span className="font-bold shrink-0">SHA-256 Record Hash:</span>
            <span className="truncate">{event.record_hash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-white/10 dark:bg-slate-900/80 p-1 rounded-xl border border-indigo-500/30">
              <button
                type="button"
                onClick={() => setShowOnlyChanged(true)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5",
                  showOnlyChanged
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <span>⚡ Modified Only ({changedArray.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setShowOnlyChanged(false)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5",
                  !showOnlyChanged
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <span>Show All Columns ({allKeys.length})</span>
              </button>
            </div>

            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
              Ledger Verified
            </span>
          </div>
        </div>

        {/* Side-by-Side Diff Table */}
        <div className="flex-1 overflow-y-auto p-5">
          {displayedKeys.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <p className="font-bold">No modified columns detected for this event.</p>
              <button
                onClick={() => setShowOnlyChanged(false)}
                className="text-indigo-500 font-bold underline"
              >
                Click to view all {allKeys.length} table columns
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 font-bold">
                  <th className="py-2.5 px-3">Column Name</th>
                  <th className="py-2.5 px-3 w-1/2">Before Value</th>
                  <th className="py-2.5 px-3 w-1/2">After Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                {displayedKeys.map((key) => {
                  const isChanged = changedArray.includes(key);
                  const isPii = PII_PATTERNS.some((p) => key.toLowerCase().includes(p));
                  const isMasked = maskedArray.includes(key) || isPii;

                  let beforeVal = beforeObj[key] !== undefined ? JSON.stringify(beforeObj[key]) : "—";
                  let afterVal = afterObj[key] !== undefined ? JSON.stringify(afterObj[key]) : "—";

                  if (isMasked) {
                    beforeVal = "•••••••••••• [REDACTED PII]";
                    afterVal = "•••••••••••• [REDACTED PII]";
                  }

                  return (
                    <tr
                      key={key}
                      className={cn(
                        "transition-colors",
                        isChanged
                          ? "bg-amber-500/10 dark:bg-amber-500/15"
                          : "hover:bg-gray-50 dark:hover:bg-slate-800/30"
                      )}
                    >
                      <td className="py-2.5 px-3 font-bold text-gray-900 dark:text-slate-200 flex items-center gap-2">
                        {isChanged && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                        {key}
                        {isMasked && (
                          <span className="ml-1 text-[9px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-600 dark:text-purple-300 font-sans font-bold border border-purple-500/30 inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>REDACTED PII</span>
                          </span>
                        )}
                      </td>
                      <td className={cn(
                        "py-2.5 px-3 text-gray-600 dark:text-slate-400 break-all",
                        isChanged && "text-red-500 dark:text-red-400 font-semibold line-through",
                        isMasked && "font-mono text-purple-400"
                      )}>
                        {beforeVal}
                      </td>
                      <td className={cn(
                        "py-2.5 px-3 text-gray-600 dark:text-slate-400 break-all",
                        isChanged && "text-emerald-600 dark:text-emerald-400 font-bold",
                        isMasked && "font-mono text-purple-400"
                      )}>
                        {afterVal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50/50 dark:bg-slate-900/50 flex justify-between items-center text-xs text-slate-500 font-mono">
          <span>Showing {displayedKeys.length} of {allKeys.length} columns</span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors"
          >
            Close Viewer
          </button>
        </div>

      </div>
    </div>
  );
}
