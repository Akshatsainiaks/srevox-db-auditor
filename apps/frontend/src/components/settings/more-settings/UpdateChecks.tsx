"use client";
import React, { useState, useEffect } from "react";
import { ArrowUpCircle, Loader2, Terminal, Copy, Check, ShieldAlert, Cpu, BookOpen } from "lucide-react";
import { fetchLatestVersion } from "@/lib/api";
import pkg from "../../../../package.json";

export default function UpdateChecks() {
  const [currentVersion, setCurrentVersion] = useState(`v${pkg.version}`);
  const [latestVersion, setLatestVersion] = useState(`v${pkg.version}`);
  const [loadingVersion, setLoadingVersion] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchLatestVersion()
      .then((data) => {
        if (data) {
          if (data.version) setLatestVersion(data.version);
          if (data.installed_version) setCurrentVersion(data.installed_version);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoadingVersion(false);
      });
  }, []);

  const isUpToDate = currentVersion === latestVersion;
  const updateCommand = "curl -fsSL https://raw.githubusercontent.com/Akshatsainiaks/srevox-setup/main/setup.sh | bash";

  const handleCopy = () => {
    navigator.clipboard.writeText(updateCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
          <ArrowUpCircle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            Platform Updates
          </h2>
          <p className="text-[11px] text-gray-550 dark:text-slate-400 mt-0.5">
            Check the active Srevox version release and run deployment updates scripts.
          </p>
        </div>
      </div>

      {/* Grid boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-50 dark:bg-slate-900/35 border border-gray-100 dark:border-slate-800/60 p-4 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Installed Version</span>
          <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{currentVersion}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/35 border border-gray-100 dark:border-slate-800/60 p-4 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Available Release</span>
          <div className="flex items-center gap-2 mt-0.5">
            {loadingVersion ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
            ) : (
              <>
                <span>{latestVersion}</span>
                {isUpToDate ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-500/20">
                    Latest version
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                    Update ready
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Update Steps */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-800 dark:text-slate-200">How to Update Self-Hosted Instance</h3>
        
        <div className="p-4 border border-indigo-100/60 dark:border-indigo-500/20 bg-indigo-55/[0.01] dark:bg-indigo-500/[0.01] rounded-2xl space-y-3">
          <p className="text-xs text-gray-555 dark:text-slate-400 leading-relaxed">
            To update Srevox components (API, Workers, and Dashboard interface), run this single setup command on your deployment server terminal:
          </p>

          {/* Terminal Command box */}
          <div className="relative group bg-[#090b11] text-[#b3b9d1] font-mono text-xs p-4 rounded-xl border border-slate-900 select-all flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 overflow-x-auto whitespace-nowrap scrollbar-thin">
              <Terminal className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-[11px] text-slate-300 select-all">{updateCommand}</span>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="p-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-lg hover:text-white transition shadow-md focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0"
              title="Copy Update Command"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="flex flex-col gap-2 pt-2 text-[10px] text-gray-400 dark:text-slate-500">
            <div className="flex items-start gap-1.5 leading-normal">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <span>Running the script pulls latest docker containers and applies database migrations automatically.</span>
            </div>
            <div className="flex items-start gap-1.5 leading-normal">
              <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <span>Existing volumes, environment settings, and credentials will not be altered during update.</span>
            </div>
          </div>
        </div>

        {/* Kubernetes Helm Chart Section */}
        <div className="p-4 border border-indigo-100/60 dark:border-indigo-500/20 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" />
            <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">Kubernetes Helm Chart Deployment & Rollback</h4>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400">
            For Kubernetes clusters (EKS, GKE, AKS, minikube, k3s), add the official Srevox Helm repository and install with 1 command:
          </p>

          <div className="space-y-2 font-mono text-[11px]">
            <div className="bg-[#090b11] p-3 rounded-xl border border-slate-800 text-slate-300">
              <span className="text-indigo-400 font-bold block mb-1"># 1. Add Helm Repository & Install (No clone needed):</span>
              <code>helm repo add srevox https://raw.githubusercontent.com/Akshatsainiaks/srevox-setup/main/charts && helm repo update && helm install srevox srevox/srevox --namespace srevox --create-namespace --set postgres.password="MySecurePassword123"</code>
            </div>

            <div className="bg-[#090b11] p-3 rounded-xl border border-slate-800 text-slate-300">
              <span className="text-emerald-400 font-bold block mb-1"># 2. Zero-Downtime Upgrade:</span>
              <code>helm upgrade srevox srevox/srevox --namespace srevox --reuse-values</code>
            </div>

            <div className="bg-[#090b11] p-3 rounded-xl border border-slate-800 text-slate-300">
              <span className="text-amber-400 font-bold block mb-1"># 3. 1-Click Rollback:</span>
              <code>helm rollback srevox 1 --namespace srevox</code>
            </div>
          </div>
        </div>
      </div>

      {/* Documentation links */}
      <div className="flex gap-4 items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800/60 flex-wrap">
        <div className="text-[10px] text-gray-400 dark:text-slate-500">
          For advanced cluster/agent updates, refer to the official documentation guides.
        </div>
        <a
          href="https://github.com/Akshatsainiaks/srevox-setup"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-655 dark:text-indigo-450 hover:underline"
        >
          <BookOpen className="w-4 h-4" />
          <span>Read Deployment Docs</span>
        </a>
      </div>
    </div>
  );
}
