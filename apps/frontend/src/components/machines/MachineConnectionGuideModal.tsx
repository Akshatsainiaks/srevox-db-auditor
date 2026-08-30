"use client";

import { useState, useEffect } from "react";
import { BookOpen, X, Copy, Check, Terminal, ShieldCheck, Cpu, HardDrive, AlertTriangle, Globe } from "lucide-react";
import { copyToClipboard } from "@/lib/utils";

interface MachineConnectionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineToken?: string;
  serverUrl?: string;
}

export default function MachineConnectionGuideModal({
  isOpen,
  onClose,
  machineToken = "YOUR_SERVICE_OR_MACHINE_TOKEN",
  serverUrl
}: MachineConnectionGuideModalProps) {
  const defaultUrl = serverUrl || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const [targetServerUrl, setTargetServerUrl] = useState(defaultUrl);
  const [activeTab, setActiveTab] = useState<"script" | "prometheus" | "cron">("script");
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  useEffect(() => {
    if (serverUrl) setTargetServerUrl(serverUrl);
    else if (typeof window !== "undefined") setTargetServerUrl(window.location.origin);
  }, [serverUrl]);

  const copyStep = async (stepId: string, text: string) => {
    await copyToClipboard(text);
    setCopiedStep(stepId);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  if (!isOpen) return null;

  const serverPlaceholder = targetServerUrl || "http://<SREVOX_DASHBOARD_SERVER_URL:PORT>";
  const displayToken = machineToken || "YOUR_SREVOX_MACHINE_TOKEN";
  const scriptSetupUrl = process.env.NEXT_PUBLIC_SREVOX_SETUP_SCRIPT_URL || "https://raw.githubusercontent.com/Akshatsainiaks/srevox-setup/main/srevox-machine-agent.sh";

  const installCmd = `curl -fsSL ${scriptSetupUrl} | bash -s -- \\
  --server "${serverPlaceholder}" \\
  --token "${displayToken}"`;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-xs animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Machine Connection & Setup Guide</h3>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                Connect bare-metal servers, AWS EC2, GCP VMs, or Linux hosts to Srevox
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/10 shrink-0 select-none p-1">
          {[
            { id: "script", label: "1-Click Agent Setup", desc: "Outbound-only daemon (Recommended)" },
            { id: "prometheus", label: "Node Exporter / Prometheus", desc: "For hosts with existing Prometheus" },
            { id: "cron", label: "Cron One-Liner", desc: "Zero background RAM daemon" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 border ${
                activeTab === t.id
                  ? "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
              }`}
            >
              <span className="text-xs font-bold">{t.label}</span>
              <span className="text-[9px] font-normal opacity-70 hidden sm:inline">{t.desc}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
          
          {/* TAB 1: 1-Click Script */}
          {activeTab === "script" && (
            <div className="space-y-5">
              <div className="bg-emerald-500/[0.03] border border-dashed border-emerald-500/20 rounded-2xl p-4 flex gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-gray-800 dark:text-slate-200">Outbound-Only Host Agent</span>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                    Runs non-root in the background as a systemd service (`srevox-machine-agent.service`). It collects system metrics from `/proc` and pushes outbound HTTPS payloads to Srevox. No open firewall ports or SSH access needed on your machine.
                  </p>
                </div>
              </div>

              {/* Step 1 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">Step 1: Execute One-Line Install Command on Server</span>
                  <button
                    onClick={() => copyStep("s1", installCmd)}
                    className="text-[10px] text-emerald-500 hover:text-emerald-600 font-bold flex items-center gap-1 shrink-0"
                  >
                    {copiedStep === "s1" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Command
                  </button>
                </div>
                <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-3.5 font-mono text-gray-800 dark:text-white text-[11px] leading-relaxed overflow-x-auto select-all">
                  {installCmd}
                </pre>
              </div>

              {/* Step 2 */}
              <div className="space-y-1.5 border-t border-gray-100 dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">Step 2: Confirm Systemd Status</span>
                  <button
                    onClick={() => copyStep("s2", "systemctl status srevox-machine-agent")}
                    className="text-[10px] text-emerald-500 hover:text-emerald-600 font-bold flex items-center gap-1"
                  >
                    {copiedStep === "s2" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Command
                  </button>
                </div>
                <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-3.5 font-mono text-gray-800 dark:text-white text-[11px] leading-relaxed overflow-x-auto select-all">
                  systemctl status srevox-machine-agent
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: Prometheus / Node Exporter */}
          {activeTab === "prometheus" && (
            <div className="space-y-5">
              <div className="bg-blue-500/[0.03] border border-dashed border-blue-500/20 rounded-2xl p-4 flex gap-3">
                <Cpu className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-gray-800 dark:text-slate-200">Prometheus Node Exporter Scrape</span>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                    If your machine is already running standard CNCF `node_exporter` on port 9100, Srevox can directly ingest its metrics.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-[11px] text-gray-600 dark:text-slate-350">
                <p><strong>1. Verify `node_exporter` is running:</strong></p>
                <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-3 font-mono select-all">
                  curl http://localhost:9100/metrics | grep node_cpu_seconds_total
                </pre>
                <p className="mt-2"><strong>2. Enter Agent Token in headers:</strong></p>
                <p className="text-gray-400">Pass header <code className="font-mono text-emerald-400">Authorization: Bearer {displayToken}</code> during metric POST requests.</p>
              </div>
            </div>
          )}

          {/* TAB 3: Cron One-Liner */}
          {activeTab === "cron" && (
            <div className="space-y-5">
              <div className="bg-purple-500/[0.03] border border-dashed border-purple-500/20 rounded-2xl p-4 flex gap-3">
                <HardDrive className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-gray-800 dark:text-slate-200">Zero Background RAM Cron Job</span>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                    Runs once a minute via `/etc/cron.d/srevox-metrics`, executes for ~100ms to report host CPU/Mem/Disk telemetry, and immediately exits. Uses 0 background RAM!
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">Add to `/etc/cron.d/srevox-metrics`:</span>
                  <button
                    onClick={() => copyStep("c1", `* * * * * root curl -s -X POST "${serverPlaceholder}/api/machines/ingest" -H "Authorization: Bearer ${displayToken}"`)}
                    className="text-[10px] text-emerald-500 hover:text-emerald-600 font-bold flex items-center gap-1"
                  >
                    {copiedStep === "c1" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Cron Line
                  </button>
                </div>
                <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-3.5 font-mono text-gray-800 dark:text-white text-[11px] leading-relaxed overflow-x-auto select-all">
                  * * * * * root curl -s -X POST "{serverPlaceholder}/api/machines/ingest" -H "Authorization: Bearer {displayToken}" -H "Content-Type: application/json" -d '$(curl -fsSL {scriptSetupUrl} | bash -s -- --token {displayToken} --once)'
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
