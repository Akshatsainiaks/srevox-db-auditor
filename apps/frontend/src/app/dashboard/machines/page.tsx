"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  HardDrive, Plus, RefreshCw, Cpu, Activity, AlertTriangle, 
  Wifi, ShieldCheck, BookOpen, Trash2, ExternalLink, Zap, X, Bell, Copy, Check, CheckCircle, Server, Pencil, Sparkles, Layers, Terminal,
  ChevronDown, ChevronUp, Settings
} from "lucide-react";
import { 
  fetchMachines, createMachine, updateMachine, deleteMachine, 
  fetchMachineAlertRules, createMachineAlertRule, deleteMachineAlertRule, testMachineAlert,
  fetchChannels
} from "@/lib/api";
import { timeAgo, copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import MachineConnectionGuideModal from "@/components/machines/MachineConnectionGuideModal";
import MachineEditModal from "@/components/machines/MachineEditModal";
import { getUser, hasPermission } from "@/lib/auth";

function UsageBar({ pct, warn = 70, crit = 90 }: { pct: number; warn?: number; crit?: number }) {
  const color = pct >= crit ? "bg-red-500" : pct >= warn ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full bg-gray-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function MachinesPage() {
  const router = useRouter();
  const me = getUser();
  const canView = hasPermission(me, "viewClusters");
  const canAdd = hasPermission(me, "addCluster");
  const canDelete = hasPermission(me, "deleteCluster");

  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState<any | null>(null);

  const [showUpcomingOpen, setShowUpcomingOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [copiedMachineId, setCopiedMachineId] = useState<string | null>(null);

  const { success, error } = useToast();
  const { confirm } = useConfirm();

  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const copyAgentToken = async (token: string, name: string) => {
    if (!token) return;
    await copyToClipboard(token);
    setCopiedTokenId(token);
    success(`Copied Agent Token for "${name}"`);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const loadData = async (quiet = false, manual = false) => {
    if (manual) setRefreshing(true);
    else if (!quiet) setLoading(true);
    try {
      const res = await fetchMachines();
      setMachines(res.machines || []);
    } catch (err: any) {
      console.error(err);
      error("Failed to load host machines");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toastShownRef = useRef(false);

  useEffect(() => {
    if (!canView) {
      if (!toastShownRef.current) {
        error("Permission Required: You do not have permission to view host machines.");
        toastShownRef.current = true;
      }
      setLoading(false);
      return;
    }
    loadData();
    const timer = setInterval(() => loadData(true), 30000);
    return () => clearInterval(timer);
  }, [canView]);

  const handleRemoveMachine = async (e: React.MouseEvent, m: any) => {
    e.stopPropagation();
    const { confirmed } = await confirm({
      title: `Delete Machine "${m.name}"?`,
      message: "This will permanently delete this machine and stop metric ingestion.",
      confirmLabel: "Delete Machine",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await deleteMachine(m.machine_id);
      success("Machine deleted", m.name);
      loadData(true);
    } catch {
      error("Failed to delete machine");
    }
  };

  const totalMachines = machines.length;
  const onlineMachines = machines.filter(m => m.status === "online").length;
  const avgCpu = totalMachines > 0 
    ? (machines.reduce((acc, m) => acc + Number(m.cpu_usage_pct || 0), 0) / totalMachines).toFixed(1)
    : "0.0";
  const avgMem = totalMachines > 0
    ? (machines.reduce((acc, m) => acc + Number(m.memory_usage_pct || 0), 0) / totalMachines).toFixed(1)
    : "0.0";

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`viewMachines`) to view host machines & telemetry.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-emerald-500" /> Standalone Machines & VMs
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Monitor physical servers, AWS EC2, GCP Compute, & virtual machines
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="btn-secondary flex items-center gap-1.5 text-xs py-2.5 px-3.5 border border-gray-200 dark:border-slate-800"
            title="View Setup Guide"
          >
            <BookOpen className="w-4 h-4 text-indigo-500" /> Setup Guide
          </button>
          <button
            onClick={() => loadData(true, true)}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-1.5 text-xs py-2.5 px-3.5"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          {canAdd && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-1.5 text-xs py-2.5 px-3.5"
            >
              <Plus className="w-4 h-4" /> Add Machine
            </button>
          )}
        </div>
      </div>

      {/* Green Security Banner */}
      <div className="bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">Outbound-Only Host Telemetry Protection</p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 leading-relaxed">
              Srevox host collector (`srevox-collector`) streams metrics outbound over HTTPS only. It never opens inbound listening ports or accepts incoming remote connections.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowGuideModal(true)}
          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 hidden md:block"
        >
          View Setup Guide &rarr;
        </button>
      </div>

      {/* Summary Cards */}
      {machines.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Total Machines</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalMachines}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>

          <div className="card p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Active Online</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{onlineMachines}</p>
                <p className="text-xs text-gray-400">/ {totalMachines}</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-500">
              <Wifi className="w-5 h-5" />
            </div>
          </div>

          <div className="card p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Avg Fleet CPU Load</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{avgCpu}%</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Cpu className="w-5 h-5" />
            </div>
          </div>

          <div className="card p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Avg Fleet Memory</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{avgMem}%</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}



      {/* Machines List */}
      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="card p-5 animate-pulse bg-gray-100 dark:bg-slate-800 h-20" />)}</div>
      ) : machines.length === 0 ? (
        <div className="card py-20 text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <HardDrive className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="font-bold text-gray-800 dark:text-white mb-1">No host machines connected yet</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mb-6">Connect your Linux/Windows servers or cloud VMs to monitor real-time CPU, Memory, Disk & Load</p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Your First Machine
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {machines.map((m) => {
            const status = m.status;
            const isOnline = status === "online" || status === "active" || status === "connected";
            const isOffline = status === "offline" || status === "error";

            return (
              <div
                key={m.machine_id}
                onClick={() => router.push(`/dashboard/machines/${m.machine_id}`)}
                className={`card p-6 flex flex-col gap-4 border-l-4 hover:shadow-lg dark:hover:shadow-slate-900/40 transition-all text-left block cursor-pointer ${
                  isOnline
                    ? "border-l-green-500"
                    : isOffline
                    ? "border-l-red-500 animate-pulse-slow"
                    : "border-l-amber-500"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Column 1: Info */}
                  <div className="flex items-start gap-4 min-w-0 lg:w-80 shrink-0">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center shrink-0">
                      <HardDrive className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 dark:text-white text-base truncate block" title={m.name}>
                          {m.name}
                        </span>
                        {(m.hostname || m.ip_address) && (
                          <span className="text-[11px] font-mono text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800/90 px-2 py-0.5 rounded-md border border-gray-200/70 dark:border-slate-700/70 flex items-center gap-1 shrink-0" title={`Hostname: ${m.hostname || m.ip_address}`}>
                            <Terminal className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                            <span>{m.hostname || m.ip_address}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                          {m.os || "Agent"}
                        </span>
                        {m.arch ? (
                          <span className="badge text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20">
                            {m.arch}
                          </span>
                        ) : (
                          <span className="badge text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                            OTHER
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-slate-500 mt-1.5 flex items-center gap-2 whitespace-nowrap">
                        <span>Added {timeAgo(m.created_at)}</span>
                        <span className="text-gray-300 dark:text-slate-700 select-none">•</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-gray-300 dark:text-slate-600" title={m.agent_token || m.machine_id}>
                            {m.agent_token ? (m.agent_token.length > 14 ? `${m.agent_token.slice(0, 14)}...` : m.agent_token) : m.machine_id.slice(0, 8)}
                          </span>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyAgentToken(m.agent_token || m.machine_id, m.name); }}
                            className="p-1 bg-white dark:bg-slate-800 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 rounded transition-all shadow-sm"
                            title="Copy Agent Bearer Token"
                          >
                            {copiedTokenId === (m.agent_token || m.machine_id) ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Middle Telemetry or Dashed Connecting Line */}
                  <div className="flex-1 min-w-0">
                    {isOnline ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <div className="flex justify-between text-[10px] text-gray-400 font-semibold mb-1">
                            <span>CPU Utilization</span>
                            <span>{Number(m.cpu_usage_pct || 0).toFixed(2)}%</span>
                          </div>
                          <UsageBar pct={Number(m.cpu_usage_pct || 0)} />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-gray-400 font-semibold mb-1">
                            <span>Memory Usage</span>
                            <span>{Number(m.memory_usage_pct || 0).toFixed(2)}%</span>
                          </div>
                          <UsageBar pct={Number(m.memory_usage_pct || 0)} />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-gray-400 font-semibold mb-1">
                            <span>Disk Usage</span>
                            <span>{Number(m.disk_usage_pct || 0).toFixed(2)}%</span>
                          </div>
                          <UsageBar pct={Number(m.disk_usage_pct || 0)} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-gray-400 dark:text-slate-500 font-medium text-center">
                        Click card to view details & metrics
                      </div>
                    )}
                  </div>

                  {/* Column 3: Single Status Indicator (No Agent/Metrics labels, No Incidents button) */}
                  <div className="flex items-center justify-end gap-4 shrink-0 select-none">
                    <div className="flex items-center gap-2 bg-gray-50/50 dark:bg-slate-900/10 border border-gray-200/45 dark:border-slate-800/60 rounded-xl px-3 py-1.5 text-xs">
                      <span className="relative flex h-2 w-2 shrink-0">
                        {isOnline ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        )}
                      </span>
                      <span className={`font-bold capitalize ${isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}



      {/* Add Machine Modal */}
      {showAddModal && (
        <AddMachineModal
          onClose={() => setShowAddModal(false)}
          onAdded={(token) => {
            setShowAddModal(false);
            setSelectedToken(token);
            setShowGuideModal(true);
            loadData(true);
          }}
        />
      )}

      {/* Edit Machine Modal */}
      {editingMachine && (
        <MachineEditModal
          machineId={editingMachine.machine_id}
          onClose={() => setEditingMachine(null)}
          onSaved={() => {
            setEditingMachine(null);
            loadData(true);
          }}
        />
      )}

      {/* Guide Modal */}
      {showGuideModal && (
        <MachineConnectionGuideModal
          isOpen={showGuideModal}
          onClose={() => setShowGuideModal(false)}
          machineToken={selectedToken || "YOUR_MACHINE_AGENT_TOKEN"}
          serverUrl={typeof window !== "undefined" ? window.location.origin : "http://localhost:4000"}
        />
      )}
    </div>
  );
}

function AddMachineModal({ onClose, onAdded }: { onClose: () => void; onAdded: (token: string) => void }) {
  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [os, setOs] = useState("Linux");
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const submit = async () => {
    if (!name.trim()) return error("Machine name is required");
    setLoading(true);
    try {
      const res = await createMachine({ name, hostname, os });
      success("Machine created", res.machine.name);
      onAdded(res.token);
    } catch {
      error("Failed to create machine");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white text-base">Add New Host Machine / VM</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-gray-700 dark:text-slate-300 block mb-1">Machine Name *</label>
            <input
              type="text"
              placeholder="e.g. prod-db-server-01"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 dark:text-slate-300 block mb-1">Hostname (Optional)</label>
            <input
              type="text"
              placeholder="e.g. db-01.internal.domain"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 dark:text-slate-300 block mb-1">Operating System</label>
            <select 
              value={os} 
              onChange={(e) => setOs(e.target.value)} 
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-pointer"
            >
              <option value="Linux" className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">Linux (Ubuntu/RHEL/Debian/CentOS)</option>
              <option value="Windows" className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">Windows Server</option>
              <option value="macOS" className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">macOS</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button onClick={submit} disabled={loading} className="btn-primary text-xs">
            {loading ? "Generating Token..." : "Generate Machine Token & Setup"}
          </button>
        </div>
      </div>
    </div>
  );
}

