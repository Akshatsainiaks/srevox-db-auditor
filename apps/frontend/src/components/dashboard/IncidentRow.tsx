"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Incident } from "@/lib/utils";
import { timeAgo, severityBadge, statusBadge, severityDot } from "@/lib/utils";

export default function IncidentRow({ inc }: { inc: Incident }) {
  return (
    <Link
      href={`/dashboard/incidents/${inc.incident_id}`}
      className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors group"
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${severityDot(inc.severity)}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-900 dark:text-slate-100 truncate max-w-[200px]">
            {inc.pod_name}
          </span>
          <span className={`badge text-xs ${severityBadge(inc.severity)}`}>{inc.crash_reason}</span>
          <span className={`badge text-xs ${statusBadge(inc.status)}`}>{inc.status}</span>
        </div>
        <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5">
          <span className="font-mono text-[10px]">{inc.namespace}</span>
          {inc.cluster_name && (
            <>
              <span className="text-gray-200 dark:text-slate-700">·</span>
              <span className="text-indigo-500 dark:text-indigo-400 font-medium text-[11px]">{inc.cluster_name}</span>
            </>
          )}
          <span className="text-gray-200 dark:text-slate-700">·</span>
          <span>{timeAgo(inc.first_seen_at)}</span>
        </div>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  );
}
