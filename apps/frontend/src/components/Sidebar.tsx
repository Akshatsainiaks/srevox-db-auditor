"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  AlertTriangle,
  Server,
  Bell,
  BookOpen,
  FileText,
  Users,
  Shield,
  Boxes,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  TerminalSquare,
  BarChart3,
  HardDrive,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUser, hasPermission } from "@/lib/auth";
import { fetchMachines, fetchClusters } from "@/lib/api";

const NAV = [
  { href: "/dashboard",             label: "Dashboard",      icon: LayoutDashboard },
  { href: "/dashboard/incidents",   label: "Incidents",      icon: AlertTriangle },
  { href: "/dashboard/clusters",    label: "Clusters",       icon: Server },
  { href: "/dashboard/machines",    label: "Machines & VMs", icon: HardDrive },
  { href: "/dashboard/data-audit",  label: "Data Audit",     icon: Database },
  { href: "/dashboard/rules",       label: "Alert Rules",    icon: BookOpen },
  { href: "/dashboard/services",    label: "Service Owners", icon: Boxes },
  { href: "/dashboard/analytics",   label: "Analytics",      icon: BarChart3 },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const path = usePathname();
  const router = useRouter();
  const [machinesList, setMachinesList] = useState<any[]>([]);
  const [machinesExpanded, setMachinesExpanded] = useState(false);

  const [clustersList, setClustersList] = useState<any[]>([]);
  const [clustersExpanded, setClustersExpanded] = useState(false);

  useEffect(() => {
    if (path.startsWith("/dashboard/machines")) {
      setMachinesExpanded(true);
    }
    if (path.startsWith("/dashboard/clusters") || path.startsWith("/cluster")) {
      setClustersExpanded(true);
    }
    fetchMachines()
      .then(res => setMachinesList(res?.machines || []))
      .catch(() => {});
    fetchClusters()
      .then(res => setClustersList(res?.clusters || []))
      .catch(() => {});
  }, [path]);

  return (
    <aside className={cn(
      "relative h-full bg-white dark:bg-[#0d0f17]",
      "border-r border-gray-100 dark:border-slate-800/80",
      "flex flex-col shrink-0",
      "transition-[width] duration-300 ease-in-out",
      collapsed ? "w-[64px]" : "w-[220px]"
    )}>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden",
        collapsed ? "px-2" : "px-3"
      )}>
        {NAV.filter(item => {
          const user = getUser();
          if (item.href === "/dashboard/incidents") {
            return hasPermission(user, "viewIncidents");
          }
          if (item.href === "/dashboard/clusters") {
            return hasPermission(user, "viewClusters");
          }
          if (item.href === "/dashboard/machines") {
            return hasPermission(user, "viewMachines");
          }
          if (item.href === "/dashboard/rules") {
            return hasPermission(user, "viewRules");
          }
          if (item.href === "/dashboard/services") {
            return hasPermission(user, "viewServiceOwners");
          }
          if (item.href === "/dashboard/analytics") {
            return hasPermission(user, "viewAnalytics");
          }
          return true;
        }).map(({ href, label, icon: Icon, tag }: any) => {
          const active = href === "/dashboard"
            ? path === "/dashboard"
            : href === "/dashboard/clusters"
            ? (path.startsWith(href) || path.startsWith("/cluster"))
            : path.startsWith(href);

          if (href === "/dashboard/clusters") {
            return (
              <div key={href} className="space-y-0.5">
                <div
                  className={cn(
                    "relative flex items-center gap-2 rounded-xl text-sm font-medium transition-all group min-w-0 cursor-pointer select-none",
                    collapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-2.5",
                    active
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                      : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                  )}
                  onClick={() => {
                    if (collapsed) {
                      router.push("/dashboard/clusters");
                    } else {
                      setClustersExpanded(!clustersExpanded);
                    }
                  }}
                >
                  <Icon className={cn(
                    "w-[18px] h-[18px] shrink-0",
                    active
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-gray-400 dark:text-slate-500 group-hover:text-gray-700 dark:group-hover:text-slate-200"
                  )} />
                  {!collapsed && (
                    <>
                      <Link
                        href="/dashboard/clusters"
                        onClick={(e) => e.stopPropagation()}
                        className="truncate flex-1 text-xs font-semibold hover:underline"
                      >
                        {label}
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setClustersExpanded(!clustersExpanded);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-md transition-colors"
                      >
                        {clustersExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </>
                  )}
                  {collapsed && (
                    <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-lg transition-opacity">
                      {label}
                    </span>
                  )}
                </div>

                {/* Sub-menu Cluster List */}
                {!collapsed && clustersExpanded && (
                  <div className="pl-4 space-y-0.5 border-l border-gray-200 dark:border-slate-800 ml-4 my-1">
                    <Link
                      href="/dashboard/clusters"
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                        path === "/dashboard/clusters"
                          ? "bg-indigo-50/70 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold"
                          : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      <span>All Clusters</span>
                    </Link>

                    {clustersList.map((cl: any) => {
                      const isClusterActive = path === `/cluster/${cl.cluster_id}` || path === `/dashboard/clusters/${cl.cluster_id}`;
                      const isConnected = cl.status === "connected";
                      return (
                        <Link
                          key={cl.cluster_id}
                          href={`/cluster/${cl.cluster_id}`}
                          className={cn(
                            "flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all group",
                            isClusterActive
                              ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold"
                              : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-white"
                          )}
                          title={cl.name}
                        >
                          <div className="flex items-center gap-2 min-w-0 truncate">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConnected ? "bg-emerald-500" : "bg-amber-400"}`} />
                            <span className="truncate">{cl.name}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Machines & VMs Sub-menu Item
          if (href === "/dashboard/machines") {
            return (
              <div key={href} className="space-y-0.5">
                <div
                  className={cn(
                    "relative flex items-center gap-2 rounded-xl text-sm font-medium transition-all group min-w-0 cursor-pointer select-none",
                    collapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-2.5",
                    active
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                      : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                  )}
                  onClick={() => {
                    if (collapsed) {
                      router.push("/dashboard/machines");
                    } else {
                      setMachinesExpanded(!machinesExpanded);
                    }
                  }}
                >
                  <Icon className={cn(
                    "w-[18px] h-[18px] shrink-0",
                    active
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-gray-400 dark:text-slate-500 group-hover:text-gray-700 dark:group-hover:text-slate-200"
                  )} />
                  {!collapsed && (
                    <>
                      <Link
                        href="/dashboard/machines"
                        onClick={(e) => e.stopPropagation()}
                        className="truncate flex-1 text-xs font-semibold hover:underline"
                      >
                        {label}
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMachinesExpanded(!machinesExpanded);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-md transition-colors"
                      >
                        {machinesExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </>
                  )}
                  {collapsed && (
                    <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-lg transition-opacity">
                      {label}
                    </span>
                  )}
                </div>

                {/* Sub-menu Machine List */}
                {!collapsed && machinesExpanded && (
                  <div className="pl-4 space-y-0.5 border-l border-gray-200 dark:border-slate-800 ml-4 my-1">
                    <Link
                      href="/dashboard/machines"
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                        path === "/dashboard/machines"
                          ? "bg-indigo-50/70 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold"
                          : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      <span>All Machines</span>
                    </Link>

                    {machinesList.map((m: any) => {
                      const isMachineActive = path === `/dashboard/machines/${m.machine_id}`;
                      const isOnline = m.status === "online";
                      return (
                        <Link
                          key={m.machine_id}
                          href={`/dashboard/machines/${m.machine_id}`}
                          className={cn(
                            "flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all group",
                            isMachineActive
                              ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold"
                              : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-white"
                          )}
                          title={m.name}
                        >
                          <div className="flex items-center gap-2 min-w-0 truncate">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? "bg-emerald-500" : "bg-red-400"}`} />
                            <span className="truncate">{m.name}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Standard Nav Links
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "relative flex items-center gap-2 rounded-xl text-sm font-medium transition-all group min-w-0",
                collapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-2.5",
                active
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                  : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <Icon className={cn(
                "w-[18px] h-[18px] shrink-0",
                active
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-gray-400 dark:text-slate-500 group-hover:text-gray-700 dark:group-hover:text-slate-200"
              )} />
              {!collapsed && (
                <>
                  <span className="truncate flex-1 text-xs font-semibold">{label}</span>
                  {tag && (
                    <span className="text-[7.5px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xs uppercase tracking-tight shrink-0 ml-auto">
                      {tag}
                    </span>
                  )}
                  {active && !tag && <ChevronRight className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-500 shrink-0" />}
                </>
              )}
              {collapsed && (
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-lg transition-opacity">
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className={cn(
        "shrink-0 border-t border-gray-100 dark:border-slate-800/80 py-3",
        collapsed ? "px-2" : "px-3"
      )}>
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all group",
            path.startsWith("/settings")
              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
              : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-slate-200",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          )}
        >
          <SlidersHorizontal className={cn(
            "w-[18px] h-[18px] shrink-0",
            path.startsWith("/settings") ? "text-indigo-650 dark:text-indigo-400" : "text-gray-400 dark:text-slate-500"
          )} />
          {!collapsed && <span className="flex-1">Settings</span>}
          {collapsed && (
            <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-lg transition-opacity">
              Settings
            </span>
          )}
        </Link>
      </div>

      {/* Floating pill collapse button on right edge */}
      <button
        onClick={onToggle}
        title={collapsed ? "Expand" : "Collapse"}
        className="absolute top-6 -right-3.5 w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center shadow-md hover:shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-all z-10 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white"
      >
        {collapsed
          ? <ChevronRight className="w-3.5 h-3.5" />
          : <ChevronLeft  className="w-3.5 h-3.5" />
        }
      </button>

    </aside>
  );
}
