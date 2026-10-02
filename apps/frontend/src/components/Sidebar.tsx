"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Database,
  Zap,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchDbAuditConnectors } from "@/lib/api";

const NAV = [
  { href: "/dashboard",            label: "Dashboard",       icon: LayoutDashboard },
  { href: "/dashboard/connectors", label: "Databases",       icon: Database,        tag: "Sources" },
];

let memoryCachedConnectors: any[] | null = null;

function getInitialConnectors(): any[] {
  if (memoryCachedConnectors) return memoryCachedConnectors;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("srevox_cached_connectors");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryCachedConnectors = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return [];
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const path = usePathname();
  const router = useRouter();
  const [connectorsList, setConnectorsList] = useState<any[]>(getInitialConnectors);
  const [connectorsExpanded, setConnectorsExpanded] = useState(() => path.startsWith("/dashboard/connectors"));

  // Keep expanded state in sync with current route without re-fetching
  useEffect(() => {
    if (path.startsWith("/dashboard/connectors")) {
      setConnectorsExpanded(true);
    }
  }, [path]);

  // Fetch once on mount & keep in memory + localStorage cache
  useEffect(() => {
    let isMounted = true;
    const loadConnectors = async () => {
      try {
        const res = await fetchDbAuditConnectors();
        const conns = Array.isArray(res) ? res : res?.connectors || [];
        if (isMounted) {
          setConnectorsList(conns);
          memoryCachedConnectors = conns;
          try {
            localStorage.setItem("srevox_cached_connectors", JSON.stringify(conns));
          } catch {}
        }
      } catch (err) {
        console.error("Sidebar load error:", err);
      }
    };

    loadConnectors();

    const handleUpdate = () => {
      if (isMounted) loadConnectors();
    };
    window.addEventListener("sv_connectors_updated", handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("sv_connectors_updated", handleUpdate);
    };
  }, []);

  return (
    <aside
      className={cn(
        "relative h-full bg-white dark:bg-[#0d0f17]",
        "border-r border-gray-100 dark:border-slate-800/80",
        "flex flex-col shrink-0",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[64px]" : "w-[220px]"
      )}
    >
      {/* Navigation */}
      <nav
        className={cn(
          "flex-1 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden",
          collapsed ? "px-2" : "px-3"
        )}
      >
        {NAV.map(({ href, label, icon: Icon, tag }) => {
          const basePath = href.split("?")[0];
          const active =
            basePath === "/dashboard"
              ? path === "/dashboard"
              : path.startsWith(basePath);

          if (href === "/dashboard/connectors") {
            return (
              <div key={href} className="space-y-0.5">
                <div
                  className={cn(
                    "relative flex items-center gap-2 rounded-xl text-sm font-medium transition-all group min-w-0 cursor-pointer select-none",
                    collapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-2.5",
                    active
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold"
                      : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                  )}
                  onClick={() => {
                    if (collapsed) {
                      router.push("/dashboard/connectors");
                    } else {
                      setConnectorsExpanded(!connectorsExpanded);
                    }
                  }}
                >
                  <Icon
                    className={cn(
                      "w-[18px] h-[18px] shrink-0",
                      active
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-gray-400 dark:text-slate-500 group-hover:text-gray-700 dark:group-hover:text-slate-200"
                    )}
                  />
                  {!collapsed && (
                    <>
                      <Link
                        href="/dashboard/connectors"
                        onClick={(e) => e.stopPropagation()}
                        className="truncate flex-1 text-xs font-semibold hover:underline"
                      >
                        {label}
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConnectorsExpanded(!connectorsExpanded);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-md transition-colors"
                      >
                        {connectorsExpanded ? (
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

                {/* Sub-menu Connector List like Srevox Clusters */}
                {!collapsed && connectorsExpanded && (
                  <div className="pl-3.5 space-y-0.5 border-l border-gray-200 dark:border-slate-800 ml-4 my-1">
                    <Link
                      href="/dashboard/connectors"
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                        path === "/dashboard/connectors"
                          ? "bg-indigo-50/70 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold"
                          : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      <span>All Databases</span>
                    </Link>

                    {connectorsList.map((c: any) => {
                      const id = c.connector_id || c.id;
                      const isItemActive = path === `/dashboard/connectors/${id}` || path.startsWith(`/dashboard/connectors/${id}/`);
                      const isOnline =
                        c.status === "active" ||
                        c.status === "connected" ||
                        c.status === "online" ||
                        c.status === "HEALTHY" ||
                        c.status === "healthy" ||
                        !c.status;
                      return (
                        <Link
                          key={id || c.name}
                          href={`/dashboard/connectors/${id}`}
                          className={cn(
                            "flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all group",
                            isItemActive
                              ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold"
                              : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-white"
                          )}
                          title={c.name}
                        >
                          <div className="flex items-center gap-2 min-w-0 truncate">
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                isOnline ? "bg-emerald-500" : "bg-red-400"
                              )}
                            />
                            <span className="truncate">{c.name}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "relative flex items-center gap-2.5 rounded-xl text-sm font-medium transition-all group min-w-0",
                collapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-2.5",
                active
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold"
                  : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "w-[18px] h-[18px] shrink-0",
                  active
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-gray-400 dark:text-slate-500 group-hover:text-gray-700 dark:group-hover:text-slate-200"
                )}
              />
              {!collapsed && (
                <>
                  <span className="truncate flex-1 text-xs font-semibold">{label}</span>
                  {tag && (
                    <span
                      className={cn(
                        "text-[7.5px] font-black px-1.5 py-0.5 rounded-full text-white shadow-2xs uppercase tracking-tight shrink-0 ml-auto",
                        tag === "Live"
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : "bg-gradient-to-r from-indigo-500 to-violet-500"
                      )}
                    >
                      {tag}
                    </span>
                  )}
                  {active && !tag && (
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-500 shrink-0" />
                  )}
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
      <div
        className={cn(
          "shrink-0 border-t border-gray-100 dark:border-slate-800/80 py-3",
          collapsed ? "px-2" : "px-3"
        )}
      >
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all group",
            path.startsWith("/settings")
              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold"
              : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-slate-200",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          )}
        >
          <SlidersHorizontal
            className={cn(
              "w-[18px] h-[18px] shrink-0",
              path.startsWith("/settings")
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-400 dark:text-slate-500"
            )}
          />
          {!collapsed && <span className="flex-1 text-xs">Settings</span>}
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
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
}
