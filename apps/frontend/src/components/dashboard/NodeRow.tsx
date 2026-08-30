"use client";

import { AlertTriangle, Cpu, Network } from "lucide-react";
import type { Cluster } from "@/lib/utils";

export default function NodeRow({ node, cluster }: { node: any; cluster: Cluster }) {
  const isReady = node.status === "Ready";
  const cpuThreshold = cluster.node_cpu_threshold ?? 85;
  const memThreshold = cluster.node_memory_threshold ?? 90;

  const cpuCoresNum = Number(node.cpu_cores || 0);
  const cpuPct = Number(node.cpu_usage_pct || 0);
  const cpuUsedCores = Math.round((cpuPct / 100) * cpuCoresNum * 100) / 100;

  const memGbNum = Number(node.memory_gb || 0);
  const memPct = Number(node.memory_usage_pct || 0);
  const memUsedGb = Math.round((memPct / 100) * memGbNum * 100) / 100;

  const isCpuHigh = cpuPct > cpuThreshold;
  const isMemHigh = memPct > memThreshold;
  const hasAlert = !isReady || isCpuHigh || isMemHigh;

  return (
    <div className={`px-5 py-3.5 border-b border-gray-100 dark:border-slate-800/40 transition-colors ${
      hasAlert ? "bg-red-500/[0.03] dark:bg-red-500/[0.02]" : ""
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isReady ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
          <span className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate" title={node.name}>
            {node.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasAlert && (
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
            node.role === "master"
              ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20"
              : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20"
          }`}>
            {node.role}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {/* CPU */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 dark:text-slate-500 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" /> CPU
          </span>
          <span className={`font-medium ${isCpuHigh ? "text-red-500 font-bold" : "text-gray-700 dark:text-slate-300"}`}>
            {cpuPct}% of {cpuCoresNum} cores ({cpuUsedCores} cores)
            {isCpuHigh && ` (exceeds ${cpuThreshold}%)`}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-300 ${
            isCpuHigh ? "bg-red-500 animate-pulse" : cpuPct >= 70 ? "bg-amber-500" : "bg-green-500"
          }`} style={{ width: `${Math.min(cpuPct, 100)}%` }} />
        </div>

        {/* Memory */}
        <div className="flex items-center justify-between text-xs mt-1.5">
          <span className="text-gray-400 dark:text-slate-500 flex items-center gap-1">
            <Network className="w-3.5 h-3.5" /> Mem
          </span>
          <span className={`font-medium ${isMemHigh ? "text-red-500 font-bold" : "text-gray-700 dark:text-slate-300"}`}>
            {memPct}% of {memGbNum} GB ({memUsedGb} GB)
            {isMemHigh && ` (exceeds ${memThreshold}%)`}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-300 ${
            isMemHigh ? "bg-red-500 animate-pulse" : memPct >= 70 ? "bg-amber-500" : "bg-green-500"
          }`} style={{ width: `${Math.min(memPct, 100)}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500 mt-2.5">
        <span>Age: {node.age}</span>
        <span>{node.pods_running} / {node.pods_capacity} pods</span>
      </div>
    </div>
  );
}
