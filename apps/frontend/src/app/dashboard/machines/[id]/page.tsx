"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  HardDrive, Cpu, Activity, ArrowLeft, RefreshCw, Clock, 
  ShieldCheck, Wifi, Server, Zap, Check, Copy, BookOpen, Bell, Plus, Pencil, Settings,
  ChevronDown, ChevronUp, Terminal
} from "lucide-react";
import { fetchMachine, fetchMachineTelemetry, regenerateMachineToken } from "@/lib/api";
import { timeAgo, copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import MachineConnectionGuideModal from "@/components/machines/MachineConnectionGuideModal";
import MachineConfigureAlertsModal from "@/components/machines/MachineConfigureAlertsModal";
import MachineEditModal from "@/components/machines/MachineEditModal";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip } from "recharts";

import { getUser, hasPermission } from "@/lib/auth";

export default function MachineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const me = getUser();
  const canView = hasPermission(me, "viewMachines");

  const [machine, setMachine] = useState<any>(null);
  const [cpuTelemetry, setCpuTelemetry] = useState<any[]>([]);
  const [memTelemetry, setMemTelemetry] = useState<any[]>([]);
  const [diskTelemetry, setDiskTelemetry] = useState<any[]>([]);
  const [loadTelemetry, setLoadTelemetry] = useState<any[]>([]);

  const [cpuRange, setCpuRange] = useState("5m");
  const [memRange, setMemRange] = useState("5m");
  const [diskRange, setDiskRange] = useState("5m");
  const [loadRange, setLoadRange] = useState("5m");

  const [cpuAutoRefreshSec, setCpuAutoRefreshSec] = useState<number>(0);
  const [memAutoRefreshSec, setMemAutoRefreshSec] = useState<number>(0);
  const [diskAutoRefreshSec, setDiskAutoRefreshSec] = useState<number>(0);
  const [loadAutoRefreshSec, setLoadAutoRefreshSec] = useState<number>(0);

  const [cpuCollapsed, setCpuCollapsed] = useState(false);
  const [memCollapsed, setMemCollapsed] = useState(false);
  const [diskCollapsed, setDiskCollapsed] = useState(false);
  const [loadCollapsed, setLoadCollapsed] = useState(false);
  const [topCpuCollapsed, setTopCpuCollapsed] = useState(false);
  const [topMemCollapsed, setTopMemCollapsed] = useState(false);

  // Load persisted card collapse state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`srevox_machine_collapsed_${id}`);
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.cpu === "boolean") setCpuCollapsed(p.cpu);
        if (typeof p.mem === "boolean") setMemCollapsed(p.mem);
        if (typeof p.disk === "boolean") setDiskCollapsed(p.disk);
        if (typeof p.load === "boolean") setLoadCollapsed(p.load);
        if (typeof p.topCpu === "boolean") setTopCpuCollapsed(p.topCpu);
        if (typeof p.topMem === "boolean") setTopMemCollapsed(p.topMem);
      }
    } catch {}
  }, [id]);

  const toggleCardCollapse = (key: "cpu" | "mem" | "disk" | "load" | "topCpu" | "topMem") => {
    let nextCpu = cpuCollapsed;
    let nextMem = memCollapsed;
    let nextDisk = diskCollapsed;
    let nextLoad = loadCollapsed;
    let nextTopCpu = topCpuCollapsed;
    let nextTopMem = topMemCollapsed;

    if (key === "cpu") { nextCpu = !cpuCollapsed; setCpuCollapsed(nextCpu); }
    else if (key === "mem") { nextMem = !memCollapsed; setMemCollapsed(nextMem); }
    else if (key === "disk") { nextDisk = !diskCollapsed; setDiskCollapsed(nextDisk); }
    else if (key === "load") { nextLoad = !loadCollapsed; setLoadCollapsed(nextLoad); }
    else if (key === "topCpu") { nextTopCpu = !topCpuCollapsed; setTopCpuCollapsed(nextTopCpu); }
    else if (key === "topMem") { nextTopMem = !topMemCollapsed; setTopMemCollapsed(nextTopMem); }

    try {
      localStorage.setItem(`srevox_machine_collapsed_${id}`, JSON.stringify({
        cpu: nextCpu,
        mem: nextMem,
        disk: nextDisk,
        load: nextLoad,
        topCpu: nextTopCpu,
        topMem: nextTopMem,
      }));
    } catch {}
  };

  const setAllRanges = (newRange: string) => {
    setCpuRange(newRange);
    setMemRange(newRange);
    setDiskRange(newRange);
    setLoadRange(newRange);
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(0);

  const setAllAutoRefresh = (sec: number) => {
    setAutoRefreshSec(sec);
    setCpuAutoRefreshSec(sec);
    setMemAutoRefreshSec(sec);
    setDiskAutoRefreshSec(sec);
    setLoadAutoRefreshSec(sec);
  };

  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [regeneratingToken, setRegeneratingToken] = useState(false);
  const { success, error } = useToast();
  const { confirm } = useConfirm();

  const handleCopyId = async () => {
    if (machine?.machine_id) {
      await copyToClipboard(machine.machine_id);
      setCopiedId(true);
      success("Machine ID copied to clipboard!");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const [refreshingCpu, setRefreshingCpu] = useState(false);
  const [refreshingMem, setRefreshingMem] = useState(false);
  const [refreshingDisk, setRefreshingDisk] = useState(false);
  const [refreshingLoad, setRefreshingLoad] = useState(false);
  const [refreshingTopCpu, setRefreshingTopCpu] = useState(false);
  const [refreshingTopMem, setRefreshingTopMem] = useState(false);

  const [topCpuAutoRefreshSec, setTopCpuAutoRefreshSec] = useState<number>(0);
  const [topMemAutoRefreshSec, setTopMemAutoRefreshSec] = useState<number>(0);

  const refreshCpu = async () => {
    setRefreshingCpu(true);
    try {
      const res = await fetchMachineTelemetry(id, cpuRange);
      setCpuTelemetry(res.telemetry || []);
    } catch (err: any) {
      error("Failed to refresh CPU telemetry");
    } finally {
      setRefreshingCpu(false);
    }
  };

  const refreshMem = async () => {
    setRefreshingMem(true);
    try {
      const res = await fetchMachineTelemetry(id, memRange);
      setMemTelemetry(res.telemetry || []);
    } catch (err: any) {
      error("Failed to refresh Memory telemetry");
    } finally {
      setRefreshingMem(false);
    }
  };

  const refreshDisk = async () => {
    setRefreshingDisk(true);
    try {
      const res = await fetchMachineTelemetry(id, diskRange);
      setDiskTelemetry(res.telemetry || []);
    } catch (err: any) {
      error("Failed to refresh Disk telemetry");
    } finally {
      setRefreshingDisk(false);
    }
  };

  const refreshLoad = async () => {
    setRefreshingLoad(true);
    try {
      const res = await fetchMachineTelemetry(id, loadRange);
      setLoadTelemetry(res.telemetry || []);
    } catch (err: any) {
      error("Failed to refresh Load telemetry");
    } finally {
      setRefreshingLoad(false);
    }
  };

  const refreshTopCpu = async () => {
    setRefreshingTopCpu(true);
    try {
      const res = await fetchMachine(id);
      setMachine(res.machine);
    } catch (err: any) {
      error("Failed to refresh Top CPU processes");
    } finally {
      setRefreshingTopCpu(false);
    }
  };

  const refreshTopMem = async () => {
    setRefreshingTopMem(true);
    try {
      const res = await fetchMachine(id);
      setMachine(res.machine);
    } catch (err: any) {
      error("Failed to refresh Top Memory processes");
    } finally {
      setRefreshingTopMem(false);
    }
  };

  const loadMachineData = async (quiet = false, manual = false) => {
    if (manual) setRefreshing(true);
    else if (!quiet) setLoading(true);
    try {
      const [mRes, cpuRes, memRes, diskRes, loadRes] = await Promise.all([
        fetchMachine(id),
        fetchMachineTelemetry(id, cpuRange),
        fetchMachineTelemetry(id, memRange),
        fetchMachineTelemetry(id, diskRange),
        fetchMachineTelemetry(id, loadRange),
      ]);
      setMachine(mRes.machine);
      setCpuTelemetry(cpuRes.telemetry || []);
      setMemTelemetry(memRes.telemetry || []);
      setDiskTelemetry(diskRes.telemetry || []);
      setLoadTelemetry(loadRes.telemetry || []);
    } catch (err: any) {
      console.error(err);
      error("Failed to load machine telemetry");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toastShownRef = useRef(false);

  // Initial Load on mount only
  useEffect(() => {
    if (!canView) {
      if (!toastShownRef.current) {
        error("Permission Required: You do not have permission to view machine telemetry details.");
        toastShownRef.current = true;
      }
      setLoading(false);
      return;
    }
    loadMachineData();
  }, [id, canView]);

  // Independent CPU Range Change Effect
  useEffect(() => {
    if (!canView) return;
    let isMounted = true;
    fetchMachineTelemetry(id, cpuRange).then(res => {
      if (isMounted) setCpuTelemetry(res.telemetry || []);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [id, cpuRange, canView]);

  // Independent Memory Range Change Effect
  useEffect(() => {
    if (!canView) return;
    let isMounted = true;
    fetchMachineTelemetry(id, memRange).then(res => {
      if (isMounted) setMemTelemetry(res.telemetry || []);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [id, memRange, canView]);

  // Independent Disk Range Change Effect
  useEffect(() => {
    if (!canView) return;
    let isMounted = true;
    fetchMachineTelemetry(id, diskRange).then(res => {
      if (isMounted) setDiskTelemetry(res.telemetry || []);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [id, diskRange, canView]);

  // Independent Load Range Change Effect
  useEffect(() => {
    if (!canView) return;
    let isMounted = true;
    fetchMachineTelemetry(id, loadRange).then(res => {
      if (isMounted) setLoadTelemetry(res.telemetry || []);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [id, loadRange, canView]);

  // CPU Card Auto-Refresh Timer
  useEffect(() => {
    if (!canView || cpuAutoRefreshSec <= 0) return;
    const timer = setInterval(async () => {
      try {
        const cpuRes = await fetchMachineTelemetry(id, cpuRange);
        setCpuTelemetry(cpuRes.telemetry || []);
      } catch {}
    }, cpuAutoRefreshSec * 1000);
    return () => clearInterval(timer);
  }, [id, cpuRange, cpuAutoRefreshSec, canView]);

  // Memory Card Auto-Refresh Timer
  useEffect(() => {
    if (!canView || memAutoRefreshSec <= 0) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetchMachineTelemetry(id, memRange);
        setMemTelemetry(res.telemetry || []);
      } catch {}
    }, memAutoRefreshSec * 1000);
    return () => clearInterval(timer);
  }, [id, memRange, memAutoRefreshSec, canView]);

  // Disk Card Auto-Refresh Timer
  useEffect(() => {
    if (!canView || diskAutoRefreshSec <= 0) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetchMachineTelemetry(id, diskRange);
        setDiskTelemetry(res.telemetry || []);
      } catch {}
    }, diskAutoRefreshSec * 1000);
    return () => clearInterval(timer);
  }, [id, diskRange, diskAutoRefreshSec, canView]);

  // System Load Card Auto-Refresh Timer
  useEffect(() => {
    if (!canView || loadAutoRefreshSec <= 0) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetchMachineTelemetry(id, loadRange);
        setLoadTelemetry(res.telemetry || []);
      } catch {}
    }, loadAutoRefreshSec * 1000);
    return () => clearInterval(timer);
  }, [id, loadRange, loadAutoRefreshSec, canView]);

  // Top CPU Processes Auto-Refresh Timer
  useEffect(() => {
    if (!canView || topCpuAutoRefreshSec <= 0) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetchMachine(id);
        setMachine(res.machine);
      } catch {}
    }, topCpuAutoRefreshSec * 1000);
    return () => clearInterval(timer);
  }, [id, topCpuAutoRefreshSec, canView]);

  // Top Memory Processes Auto-Refresh Timer
  useEffect(() => {
    if (!canView || topMemAutoRefreshSec <= 0) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetchMachine(id);
        setMachine(res.machine);
      } catch {}
    }, topMemAutoRefreshSec * 1000);
    return () => clearInterval(timer);
  }, [id, topMemAutoRefreshSec, canView]);

  const copyToken = async () => {
    if (machine?.agent_token) {
      await copyToClipboard(machine.agent_token);
      setCopiedToken(true);
      success("Agent token copied to clipboard");
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleRegenerateToken = async () => {
    const { confirmed } = await confirm({
      title: `Regenerate Machine Agent Token?`,
      message: "Regenerating the agent token will immediately invalidate your current machine token. You MUST update your host collector service with the new token to keep metrics streaming.",
      confirmLabel: "Regenerate Token",
      variant: "warning",
    });
    if (!confirmed) return;

    setRegeneratingToken(true);
    try {
      const res = await regenerateMachineToken(id);
      setMachine((prev: any) => ({ ...prev, agent_token: res.agent_token }));
      success("Agent token regenerated!", "Copy the new token to update your host agent service.");
    } catch (e: any) {
      error("Failed to regenerate token", e.response?.data?.error || e.message);
    } finally {
      setRegeneratingToken(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`viewMachines`) to view machine telemetry details.
        </p>
      </div>
    );
  }

  if (loading && !machine) {
    return (
      <div className="space-y-4 animate-pulse p-6">
        <div className="h-8 bg-gray-200 dark:bg-slate-800 rounded w-1/4" />
        <div className="h-40 bg-gray-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-64 bg-gray-200 dark:bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="p-12 text-center space-y-4">
        <p className="text-lg font-bold text-gray-800 dark:text-white">Machine Not Found</p>
        <Link href="/dashboard/machines" className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Machines
        </Link>
      </div>
    );
  }

  const isConfigured = !!machine?.last_heartbeat_at && machine?.status !== "unconfigured" && machine?.status !== "pending";
  const isOnline = machine?.status === "online";
  const isOffline = machine?.status === "offline";
  const isError = !!machine?.error_message;

  const statusLabel = isConfigured ? (isOnline ? "online" : "offline") : "unconfigured";
  const statusColor = isOnline
    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 border-emerald-200/50"
    : isOffline
    ? "bg-red-50 text-red-600 dark:bg-red-500/10 border-red-200/50"
    : "bg-purple-50 text-purple-600 dark:bg-purple-500/10 border-purple-200/50";

  const memGb = ((machine?.total_memory_bytes || 0) / (1024 * 1024 * 1024)).toFixed(1);
  const diskGb = ((machine?.total_disk_bytes || 0) / (1024 * 1024 * 1024)).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b border-gray-200 dark:border-slate-800/80 pb-5">
        <div className="flex items-center justify-between">
          <Link href="/dashboard/machines" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Machines
          </Link>

          <button
            onClick={() => setShowGuideModal(true)}
            className="btn-secondary flex items-center gap-1.5 text-[10px] py-1 px-2.5 h-[28px] rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-600 dark:text-slate-350 transition-colors font-bold shadow-sm"
          >
            <BookOpen className="w-3 h-3 text-indigo-500" />
            Setup Guide
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center shrink-0">
                <HardDrive className="w-5.5 h-5.5 text-indigo-500" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">{machine.name}</h1>
                  {(machine.hostname || machine.ip_address) && (
                    <span className="text-xs font-mono text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800/90 px-2.5 py-1 rounded-lg border border-gray-200/70 dark:border-slate-700/70 flex items-center gap-1.5 shrink-0" title={`Hostname: ${machine.hostname || machine.ip_address}`}>
                      <Terminal className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                      <span>{machine.hostname || machine.ip_address}</span>
                    </span>
                  )}
                  <span className="badge text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                    {machine.os || "Linux"}
                  </span>
                  {machine.arch && (
                    <span className="badge text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20">
                      {machine.arch}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {machine.agent_token && (
                    <>
                      <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-lg border border-gray-200/40 dark:border-slate-800/60 select-all">
                        Agent Token: {machine.agent_token}
                      </span>
                      <button
                        onClick={copyToken}
                        className="p-1 bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-350 border border-gray-200/40 dark:border-slate-800 rounded-lg transition-all shadow-sm flex items-center justify-center mr-2"
                        title="Copy Agent Token"
                      >
                        {copiedToken ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </>
                  )}

                  {/* Machine Online / Offline Status Badge */}
                  <div 
                    className={`relative group flex items-center gap-1.5 bg-gray-50/50 dark:bg-slate-900/10 border border-gray-200/45 dark:border-slate-800/60 rounded-xl px-2.5 py-1 text-xs transition-all ${!isOnline ? "cursor-help hover:border-red-500/50 dark:hover:border-red-900/40" : ""}`}
                  >
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

                    {!isOnline && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-64 p-3 bg-red-950/95 dark:bg-[#1c0f13] border border-red-500/30 text-red-200 dark:text-red-300 text-[11px] font-medium rounded-xl shadow-xl pointer-events-none opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-100 origin-bottom z-50 text-center leading-relaxed select-none">
                        <span className="font-bold block text-red-400 mb-0.5">Machine Offline Reason</span>
                        {machine.error_message || `Host collector service is stopped or unreachable. Last heartbeat received ${machine.last_heartbeat_at ? timeAgo(machine.last_heartbeat_at) : 'recently'}.`}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-red-950/95 dark:border-t-[#1c0f13]"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 select-none">
            <button
              onClick={() => loadMachineData(true, true)}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3.5 h-[34px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 transition-colors shadow-sm font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <Link
              href={`/dashboard/machines/${id}/settings`}
              className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3.5 h-[34px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-700 dark:text-slate-200 font-bold shadow-sm"
            >
              <Settings className="w-3.5 h-3.5 text-gray-400 dark:text-slate-300" /> Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Machine Error Banner */}
      {isError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-900 dark:text-amber-300">Host Agent Telemetry Error Reported</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
              {machine.error_message}
            </p>
          </div>
        </div>
      )}

      {/* Unconfigured Host Agent Banner */}
      {!isConfigured && !isOffline && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500 shrink-0">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-purple-900 dark:text-purple-300">Host Agent Not Configured</p>
              <p className="text-[11px] text-purple-700 dark:text-purple-400 mt-0.5 leading-relaxed">
                This machine has not sent any agent heartbeats yet. Copy the Bearer Token below and execute the host agent install script on your host server to stream live telemetry.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowGuideModal(true)}
            className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3 shrink-0 self-start sm:self-auto bg-purple-600 hover:bg-purple-700 text-white"
          >
            <BookOpen className="w-4 h-4" /> Setup Host Agent &rarr;
          </button>
        </div>
      )}

      {/* Guide Modal */}
      {showGuideModal && (
        <MachineConnectionGuideModal
          isOpen={showGuideModal}
          onClose={() => setShowGuideModal(false)}
          machineToken={machine.agent_token || "YOUR_MACHINE_AGENT_TOKEN"}
          serverUrl={typeof window !== "undefined" ? window.location.origin : "http://localhost:4000"}
        />
      )}

      {/* Configure Machine Alerts Modal */}
      {showAlertsModal && machine && (
        <MachineConfigureAlertsModal
          isOpen={showAlertsModal}
          onClose={() => setShowAlertsModal(false)}
          machine={machine}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <MachineEditModal
          machineId={id}
          onClose={() => setShowSettingsModal(false)}
          onSaved={() => loadMachineData(true)}
        />
      )}

      {/* Machine Hardware Overview Specs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-400">CPU Specs & Usage</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{Number(machine.cpu_usage_pct || 0).toFixed(2)}%</p>
          <span className="text-xs text-gray-500">{machine.cpu_cores || 1} CPU Cores</span>
        </div>

        <div className="card p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-400">Memory Specs & Usage</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{Number(machine.memory_usage_pct || 0).toFixed(2)}%</p>
          <span className="text-xs text-gray-500">{memGb} GB RAM Total</span>
        </div>

        <div className="card p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-400">Disk Specs & Usage</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{Number(machine.disk_usage_pct || 0).toFixed(2)}%</p>
          <span className="text-xs text-gray-500">{diskGb} GB Storage Total</span>
        </div>

        <div className="card p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-400">System Load Average (1m)</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{Number(machine.load_avg_1m || 0.0).toFixed(2)}</p>
          <span className="text-xs text-gray-500">5m: {machine.load_avg_5m || 0.0} • 15m: {machine.load_avg_15m || 0.0}</span>
        </div>
      </div>

      {/* Telemetry Time-Series Graphs */}
      <div className="space-y-6">
        {/* CPU Chart */}
        <div className="card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 select-none">
              <button
                type="button"
                onClick={() => toggleCardCollapse("cpu")}
                className="p-1 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors shrink-0"
                title={cpuCollapsed ? "Expand card" : "Collapse card"}
              >
                {cpuCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <Cpu className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-gray-900 dark:text-white text-base cursor-pointer" onClick={() => toggleCardCollapse("cpu")}>
                CPU Utilization History (%)
              </h3>
            </div>
            <CardControlsHeader
              range={cpuRange}
              onRangeChange={setCpuRange}
              refreshSec={cpuAutoRefreshSec}
              onRefreshChange={setCpuAutoRefreshSec}
              currentVal={`${Number(machine.cpu_usage_pct || 0).toFixed(2)}% Current`}
              colorClass="text-indigo-500"
              onManualRefresh={refreshCpu}
              isRefreshing={refreshingCpu}
            />
          </div>

          {!cpuCollapsed && (
            <SimpleAreaGraph
              data={cpuTelemetry.map(t => ({ time: new Date(t.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), val: Number(t.cpu_usage_pct || 0) }))}
              color="#6366f1"
              isUnconfigured={!isConfigured}
              isOffline={isOffline}
              isError={isError}
              errorMessage={machine.error_message}
              onSetup={() => setShowGuideModal(true)}
            />
          )}
        </div>

        {/* Memory Chart */}
        <div className="card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 select-none">
              <button
                type="button"
                onClick={() => toggleCardCollapse("mem")}
                className="p-1 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors shrink-0"
                title={memCollapsed ? "Expand card" : "Collapse card"}
              >
                {memCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <Activity className="w-5 h-5 text-purple-500" />
              <h3 className="font-bold text-gray-900 dark:text-white text-base cursor-pointer" onClick={() => toggleCardCollapse("mem")}>
                Memory Usage History (%)
              </h3>
            </div>
            <CardControlsHeader
              range={memRange}
              onRangeChange={setMemRange}
              refreshSec={memAutoRefreshSec}
              onRefreshChange={setMemAutoRefreshSec}
              currentVal={isOffline ? "Offline" : `${machine.memory_usage_pct || 0}% Current`}
              colorClass={isOffline ? "text-red-500" : "text-purple-500"}
              onManualRefresh={refreshMem}
              isRefreshing={refreshingMem}
            />
          </div>

          {!memCollapsed && (
            <SimpleAreaGraph
              data={memTelemetry.map(t => ({ time: new Date(t.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), val: Number(t.memory_usage_pct || 0) }))}
              color="#a855f7"
              isUnconfigured={!isConfigured}
              isOffline={isOffline}
              isError={isError}
              errorMessage={machine.error_message}
              onSetup={() => setShowGuideModal(true)}
            />
          )}
        </div>

        {/* Disk Utilization Chart */}
        <div className="card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 select-none">
              <button
                type="button"
                onClick={() => toggleCardCollapse("disk")}
                className="p-1 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors shrink-0"
                title={diskCollapsed ? "Expand card" : "Collapse card"}
              >
                {diskCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <HardDrive className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-gray-900 dark:text-white text-base cursor-pointer" onClick={() => toggleCardCollapse("disk")}>
                Disk Utilization (%)
              </h3>
            </div>
            <CardControlsHeader
              range={diskRange}
              onRangeChange={setDiskRange}
              refreshSec={diskAutoRefreshSec}
              onRefreshChange={setDiskAutoRefreshSec}
              currentVal={isOffline ? "Offline" : `${machine.disk_usage_pct || 0}%`}
              colorClass={isOffline ? "text-red-500" : "text-emerald-500"}
              onManualRefresh={refreshDisk}
              isRefreshing={refreshingDisk}
            />
          </div>

          {!diskCollapsed && (
            <SimpleAreaGraph
              data={diskTelemetry.map(t => ({ time: new Date(t.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), val: Number(t.disk_usage_pct || 0) }))}
              color="#10b981"
              isUnconfigured={!isConfigured}
              isOffline={isOffline}
              isError={isError}
              errorMessage={machine.error_message}
              onSetup={() => setShowGuideModal(true)}
            />
          )}
        </div>

        {/* System Load Chart */}
        <div className="card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 select-none">
              <button
                type="button"
                onClick={() => toggleCardCollapse("load")}
                className="p-1 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors shrink-0"
                title={loadCollapsed ? "Expand card" : "Collapse card"}
              >
                {loadCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <Server className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-gray-900 dark:text-white text-base cursor-pointer" onClick={() => toggleCardCollapse("load")}>
                System Load Average (1m)
              </h3>
            </div>
            <CardControlsHeader
              range={loadRange}
              onRangeChange={setLoadRange}
              refreshSec={loadAutoRefreshSec}
              onRefreshChange={setLoadAutoRefreshSec}
              currentVal={isOffline ? "Offline" : `${machine.load_avg_1m || 0.0}`}
              colorClass={isOffline ? "text-red-500" : "text-amber-500"}
              onManualRefresh={refreshLoad}
              isRefreshing={refreshingLoad}
            />
          </div>

          {!loadCollapsed && (
            <SimpleAreaGraph
              data={loadTelemetry.map(t => ({ time: new Date(t.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), val: Number(t.load_avg_1m || 0) }))}
              color="#f59e0b"
              isUnconfigured={!isConfigured}
              isOffline={isOffline}
              isError={isError}
              errorMessage={machine.error_message}
              onSetup={() => setShowGuideModal(true)}
            />
          )}
        </div>

        {/* Top Processes by CPU */}
        <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 select-none">
              <button
                type="button"
                onClick={() => toggleCardCollapse("topCpu")}
                className="p-1 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors shrink-0"
                title={topCpuCollapsed ? "Expand card" : "Collapse card"}
              >
                {topCpuCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-500 shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="cursor-pointer" onClick={() => toggleCardCollapse("topCpu")}>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Top Processes by CPU</h3>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Live process snapshot sorted by CPU utilization</p>
              </div>
            </div>

            <ProcessCardControlsHeader
              refreshSec={topCpuAutoRefreshSec}
              onRefreshChange={setTopCpuAutoRefreshSec}
              onManualRefresh={refreshTopCpu}
              isRefreshing={refreshingTopCpu}
            />
          </div>

          {!topCpuCollapsed && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 px-2.5 py-1 rounded-md">
                  Note: CPU% reflects avg since process start (ps)
                </span>
              </div>

              <TopProcessesTable processes={parseProcList(machine?.top_cpu_processes)} type="cpu" />
            </>
          )}
        </div>

        {/* Top Processes by Memory */}
        <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 select-none">
              <button
                type="button"
                onClick={() => toggleCardCollapse("topMem")}
                className="p-1 hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors shrink-0"
                title={topMemCollapsed ? "Expand card" : "Collapse card"}
              >
                {topMemCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div className="cursor-pointer" onClick={() => toggleCardCollapse("topMem")}>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Top Processes by Memory</h3>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Live process snapshot sorted by RAM consumption</p>
              </div>
            </div>

            <ProcessCardControlsHeader
              refreshSec={topMemAutoRefreshSec}
              onRefreshChange={setTopMemAutoRefreshSec}
              onManualRefresh={refreshTopMem}
              isRefreshing={refreshingTopMem}
            />
          </div>

          {!topMemCollapsed && (
            <TopProcessesTable processes={parseProcList(machine?.top_mem_processes)} type="mem" />
          )}
        </div>
      </div>
    </div>
  );
}

function ProcessCardControlsHeader({
  refreshSec,
  onRefreshChange,
  onManualRefresh,
  isRefreshing,
}: {
  refreshSec: number;
  onRefreshChange: (sec: number) => void;
  onManualRefresh: () => void;
  isRefreshing?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0 select-none">
      {/* Auto Refresh Dropdown */}
      <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800/80 px-2 py-1 rounded-lg text-xs font-semibold border border-gray-200/50 dark:border-slate-700/50 shrink-0">
        <select
          value={refreshSec}
          onChange={(e) => onRefreshChange(Number(e.target.value))}
          className="bg-transparent text-gray-700 dark:text-slate-200 focus:outline-none cursor-pointer text-xs font-bold"
        >
          <option value={5} className="dark:bg-slate-900 text-gray-900 dark:text-white">Auto: 5s</option>
          <option value={10} className="dark:bg-slate-900 text-gray-900 dark:text-white">Auto: 10s</option>
          <option value={30} className="dark:bg-slate-900 text-gray-900 dark:text-white">Auto: 30s</option>
          <option value={0} className="dark:bg-slate-900 text-gray-900 dark:text-white">Auto: Off</option>
        </select>
      </div>

      {/* Single Metric Refresh Button */}
      <button
        onClick={onManualRefresh}
        disabled={isRefreshing}
        title="Refresh top processes"
        className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800/80 hover:bg-gray-200 dark:hover:bg-slate-700/80 border border-gray-200/50 dark:border-slate-700/50 text-gray-700 dark:text-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors shrink-0"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-500" : "text-gray-400 dark:text-slate-400"}`} />
        <span>Refresh</span>
      </button>
    </div>
  );
}

function parseProcList(val: any) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val);
      if (Array.isArray(p)) return p;
    } catch {}
  }
  return [];
}

function TopProcessesTable({ processes, type }: { processes: any[]; type: "cpu" | "mem" }) {
  if (!processes || processes.length === 0) {
    return (
      <div className="h-32 flex flex-col items-center justify-center text-center p-3 rounded-xl bg-gray-50/50 dark:bg-slate-900/40 border border-dashed border-gray-200 dark:border-slate-800">
        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500">No process snapshot collected yet</p>
        <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-0.5">Metrics agent streams top process snapshots on each 10s cycle</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-gray-100 dark:border-slate-800 text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500">
            <th className="pb-2 font-bold">Process Name</th>
            <th className="pb-2 font-bold text-right">PID</th>
            <th className="pb-2 font-bold text-right">CPU %</th>
            <th className="pb-2 font-bold text-right">MEM %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-slate-800/40">
          {processes.map((p: any, idx: number) => (
            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
              <td className="py-2 font-semibold text-gray-800 dark:text-slate-200 font-mono text-[11px] truncate max-w-[150px]" title={p.name}>
                {p.name}
              </td>
              <td className="py-2 text-right font-mono text-[11px] text-gray-500 dark:text-slate-400">
                {p.pid}
              </td>
              <td className={`py-2 text-right font-mono text-[11px] font-bold ${type === "cpu" ? "text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-slate-300"}`}>
                {Number(p.cpu_pct || 0).toFixed(1)}%
              </td>
              <td className={`py-2 text-right font-mono text-[11px] font-bold ${type === "mem" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-700 dark:text-slate-300"}`}>
                {Number(p.mem_pct || 0).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardControlsHeader({
  range,
  onRangeChange,
  refreshSec,
  onRefreshChange,
  currentVal,
  colorClass = "text-indigo-500",
  onManualRefresh,
  isRefreshing,
}: {
  range: string;
  onRangeChange: (r: string) => void;
  refreshSec: number;
  onRefreshChange: (sec: number) => void;
  currentVal: string;
  colorClass?: string;
  onManualRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
      {/* Current Metric Value Pill */}
      <span className={`text-xs font-extrabold shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 ${colorClass}`}>
        {currentVal}
      </span>

      {/* Time Range Dropdown */}
      <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800/80 px-2 py-1 rounded-lg text-xs font-semibold select-none border border-gray-200/50 dark:border-slate-700/50 shrink-0">
        <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
        <select
          value={["5m", "15m", "30m", "1h", "3h", "6h", "12h", "24h", "7d"].includes(range) ? range : "custom"}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "custom") {
              const userVal = window.prompt("Enter custom timeframe (e.g. 10m, 45m, 2h, 12h, 3d):", range || "30m");
              if (userVal && userVal.trim()) {
                onRangeChange(userVal.trim());
              }
            } else {
              onRangeChange(val);
            }
          }}
          className="bg-transparent text-gray-700 dark:text-slate-200 focus:outline-none cursor-pointer text-xs font-bold"
        >
          <option value="5m" className="dark:bg-slate-900 text-gray-900 dark:text-white">Last 5 min</option>
          <option value="15m" className="dark:bg-slate-900 text-gray-900 dark:text-white">Last 15 min</option>
          <option value="30m" className="dark:bg-slate-900 text-gray-900 dark:text-white">Last 30 min</option>
          <option value="1h" className="dark:bg-slate-900 text-gray-900 dark:text-white">Last 1 hour</option>
          <option value="3h" className="dark:bg-slate-900 text-gray-900 dark:text-white">Last 3 hours</option>
          <option value="6h" className="dark:bg-slate-900 text-gray-900 dark:text-white">Last 6 hours</option>
          <option value="12h" className="dark:bg-slate-900 text-gray-900 dark:text-white">Last 12 hours</option>
          <option value="24h" className="dark:bg-slate-900 text-gray-900 dark:text-white">Last 24 hours</option>
          <option value="7d" className="dark:bg-slate-900 text-gray-900 dark:text-white">Last 7 days</option>
          <option value="custom" className="dark:bg-slate-900 text-gray-900 dark:text-white">
            Custom... {!["5m", "15m", "30m", "1h", "3h", "6h", "12h", "24h", "7d"].includes(range) ? `(${range})` : ""}
          </option>
        </select>
      </div>

      {/* Auto Refresh Dropdown */}
      <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800/80 px-2 py-1 rounded-lg text-xs font-semibold select-none border border-gray-200/50 dark:border-slate-700/50 shrink-0">
        <select
          value={refreshSec}
          onChange={(e) => onRefreshChange(Number(e.target.value))}
          className="bg-transparent text-gray-700 dark:text-slate-200 focus:outline-none cursor-pointer text-xs font-bold"
        >
          <option value={5} className="dark:bg-slate-900 text-gray-900 dark:text-white">Auto: 5s</option>
          <option value={10} className="dark:bg-slate-900 text-gray-900 dark:text-white">Auto: 10s</option>
          <option value={30} className="dark:bg-slate-900 text-gray-900 dark:text-white">Auto: 30s</option>
          <option value={0} className="dark:bg-slate-900 text-gray-900 dark:text-white">Auto: Off</option>
        </select>
      </div>

      {/* Single Metric Refresh Button */}
      {onManualRefresh && (
        <button
          onClick={onManualRefresh}
          disabled={isRefreshing}
          title="Refresh metric"
          className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800/80 hover:bg-gray-200 dark:hover:bg-slate-700/80 border border-gray-200/50 dark:border-slate-700/50 text-gray-700 dark:text-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-500" : "text-gray-400 dark:text-slate-400"}`} />
          <span>Refresh</span>
        </button>
      )}
    </div>
  );
}

function SimpleAreaGraph({
  data,
  color,
  isUnconfigured,
  isOffline,
  isError,
  errorMessage,
  onSetup,
}: {
  data: { time: string; val: number }[];
  color: string;
  isUnconfigured?: boolean;
  isOffline?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onSetup?: () => void;
}) {
  if (isOffline || isUnconfigured || isError || !data || data.length === 0) {
    const title = isError
      ? "Host Agent Telemetry Error"
      : isOffline
      ? "Host Agent Service Offline"
      : isUnconfigured
      ? "Host Agent Not Connected"
      : "No Telemetry Data Points";

    const desc = isError
      ? (errorMessage || "The machine agent reported an error.")
      : isOffline
      ? "The host collector service (`srevox-collector`) is stopped or unreachable. Start the service on your host server to stream live charts."
      : isUnconfigured
      ? "Run the host agent installer script on your machine to stream live CPU, Memory, Disk & Load metrics."
      : "No telemetry metrics recorded for the selected time range.";

    return (
      <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-xl bg-gray-50/50 dark:bg-slate-900/40 border border-dashed border-gray-200 dark:border-slate-800 space-y-2">
        <Server className={`w-7 h-7 ${isOffline ? "text-red-500 animate-pulse" : isError ? "text-amber-500" : "text-gray-400 dark:text-slate-600"}`} />
        <div>
          <p className={`text-xs font-bold ${isOffline ? "text-red-600 dark:text-red-400" : isError ? "text-amber-600 dark:text-amber-400" : "text-gray-700 dark:text-slate-300"}`}>
            {title}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 max-w-md">
            {desc}
          </p>
        </div>
        {(isUnconfigured || isOffline) && onSetup && (
          <button
            onClick={onSetup}
            className={`text-xs font-bold hover:underline flex items-center gap-1 mt-1 ${isOffline ? "text-red-500" : "text-emerald-500"}`}
          >
            <BookOpen className="w-3.5 h-3.5" /> View Installation & Service Guide &rarr;
          </button>
        )}
      </div>
    );
  }

  const formattedData = data.map((d) => ({
    time: d.time,
    val: Number(d.val) || 0,
  }));

  const gradientId = `grad-${color.replace("#", "")}`;

  return (
    <div className="h-44 w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: "#334155", strokeWidth: 0.5 }}
          />
          <YAxis
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax * 1.15), 10)]}
          />
          <ChartTooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              borderColor: "#334155",
              borderRadius: "0.75rem",
              fontSize: "12px",
              color: "#f8fafc",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
            }}
            formatter={(value: any) => [`${Number(value).toFixed(2)}`, "Value"]}
            labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
          />
          <Area
            type="monotone"
            dataKey="val"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
