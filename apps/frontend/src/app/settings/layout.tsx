"use client";
import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  User, Key, Server, Bell, SlidersHorizontal, Trash2,
  Palette, Compass, Sparkles, MessageSquare, ArrowLeft,
  Users, Shield, Users2, LogOut, TerminalSquare, FileText,
  ChevronLeft, ChevronRight, ArrowUpCircle, Activity, Settings, Database, BookOpen, Loader2, Lock,
} from "lucide-react";
import { getUser, hasPermission, startRoleSync, removeToken } from "@/lib/auth";
import { apiLogout } from "@/lib/api";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Navbar from "@/components/navbar/Navbar";
import AuthGuard from "@/components/AuthGuard";
import UpdateAnnouncement from "@/components/UpdateAnnouncement";
import PageTutorial from "@/components/PageTutorial";
import { useConfirm } from "@/components/ConfirmModal";
import DefaultCredentialsWarning from "@/components/DefaultCredentialsWarning";

function applySettingsTheme() {
  try {
    const t = localStorage.getItem("sv_dashboard_theme");
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else if (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch { }
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Suspense fallback={
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0d0f17]">
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        </div>
      }>
        <SettingsLayoutContent children={children} />
      </Suspense>
    </AuthGuard>
  );
}

function SettingsLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMoreSettings = pathname === "/settings/more-settings";
  const activeTab = searchParams.get("tab") || (isMoreSettings ? "security" : "general");
  const user = getUser();
  const isAdmin = user?.role === "admin";
  const canViewTeam = hasPermission(user, "viewTeam");
  const canViewActivity = hasPermission(user, "viewActivityLog");
  const canViewMoreSettings = hasPermission(user, "changeSudoLock") || hasPermission(user, "changeRetention") || hasPermission(user, "viewApiDocs") || hasPermission(user, "systemAlerts");
  const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL || "https://srevox-website.vercel.app";

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    applySettingsTheme();
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("srevox_settings_sidebar_collapsed");
      if (stored === "true") setCollapsed(true);
    }
  }, []);

  useEffect(() => startRoleSync(), []);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("srevox_settings_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  interface SettingsNavItem {
    href: string;
    label: string;
    icon: any;
    permission?: boolean;
    target?: string;
  }

  interface SettingsNavGroup {
    group: string;
    items: SettingsNavItem[];
  }

  const SETTINGS_NAV: SettingsNavGroup[] = [
    {
      group: "Personal", items: [
        { href: "/settings/profile", label: "Profile Settings", icon: User },
        { href: "/settings/preferences", label: "Alert Preferences", icon: Bell },
        { href: "/settings/appearance", label: "Theme & Appearance", icon: Palette },
      ]
    },
    {
      group: "Workspace Management", items: [
        { href: "/settings/channels", label: "Alert Channels", icon: Bell },
        { href: "/settings/team", label: "Team Members", icon: Users, permission: canViewTeam },
        { href: "/settings/permissions", label: "User Permissions", icon: Shield, permission: isAdmin },
        { href: "/settings/groups", label: "User Groups", icon: Users2, permission: isAdmin },
      ]
    },
    {
      group: "Advanced Settings", items: [
        { href: "/settings/org", label: "Organization", icon: Server, permission: isAdmin },
        { href: "/settings/ai", label: "AI Assistant", icon: Sparkles },
        { href: "/settings/activity", label: "Audit Logs", icon: Activity, permission: canViewActivity },
        { href: "/settings/demo", label: "Demo Sandbox", icon: Compass },
      ]
    },
    {
      group: "Resources", items: [
        { href: "/settings/engineering", label: "Engineering Console", icon: TerminalSquare },
        { href: "/settings/feedback", label: "Share Feedback", icon: MessageSquare },
        { href: `${websiteUrl}/docs`, label: "Documentation", icon: FileText, target: "_blank" }
      ]
    },
    {
      group: "More Settings", items: [
        { href: "/settings/more-settings", label: "More Settings", icon: Settings, permission: canViewMoreSettings }
      ]
    }
  ];

  const navList: SettingsNavGroup[] = isMoreSettings ? [
    {
      group: "Data Retention Policies", items: [
        { href: "/settings/more-settings?tab=logs", label: "Audit Logs Retention", icon: FileText, permission: hasPermission(user, "changeRetention") },
        { href: "/settings/more-settings?tab=incidents", label: "Incident Retention", icon: Activity, permission: hasPermission(user, "changeRetention") },
      ]
    },
    {
      group: "System & Alerts", items: [
        { href: "/settings/more-settings?tab=system-alerts", label: "System Alerts", icon: Bell, permission: hasPermission(user, "systemAlerts") },
        { href: "/settings/more-settings?tab=update", label: "Platform Update", icon: ArrowUpCircle, permission: hasPermission(user, "viewApiDocs") },
      ]
    },
    {
      group: "Developer Resources", items: [
        { href: "/settings/more-settings?tab=api-docs", label: "API Documentation", icon: BookOpen, permission: hasPermission(user, "viewApiDocs") },
      ]
    }
  ] : SETTINGS_NAV;


  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0d0f17]">
      <div className="shrink-0">
        <Navbar />
        <DefaultCredentialsWarning />
      </div>
      {/* <UpdateAnnouncement /> */}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Settings Sidebar */}
        <aside className={cn(
          "bg-white dark:bg-[#11131a] border-r border-gray-150 dark:border-slate-800/80 shrink-0 flex flex-col justify-between select-none relative transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}>
          {/* Scrollable Menu Items */}
          <div className={cn("flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-3.5 transition-all duration-300", collapsed ? "p-2" : "p-4")}>
            <div className={cn(
              "border-b border-gray-100 dark:border-slate-800/60 pb-3 flex items-center gap-1.5",
              collapsed ? "px-0 justify-center" : "px-2"
            )}>
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <h2 className={cn(
                "text-xs font-bold text-gray-900 dark:text-white transition-all duration-300 whitespace-nowrap truncate",
                collapsed ? "opacity-0 max-w-0 overflow-hidden" : "opacity-100 max-w-[200px]"
              )}>
                {isMoreSettings ? "More Settings" : "Settings Panel"}
              </h2>
            </div>

            {navList.map((grp, grpIdx) => {
              const visibleItems = grp.items.filter(item => item.permission !== false);
              if (visibleItems.length === 0) return null;
              return (
                <div key={grp.group} className="space-y-1">
                  {((grp.group === "More Settings") || (isMoreSettings && grpIdx > 0)) && (
                    <div className="border-t border-gray-150 dark:border-slate-800/60 pt-1.5 mt-[-8px] mb-1.5 mx-1" />
                  )}
                  <h3 className={cn(
                    "px-2 text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider transition-all duration-300 whitespace-nowrap truncate",
                    collapsed ? "opacity-0 max-w-0 overflow-hidden h-0 my-0 py-0" : "opacity-100 max-w-[200px] h-auto"
                  )}>
                    {grp.group}
                  </h3>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const active = isMoreSettings
                        ? item.href.includes("?tab=") && item.href.endsWith("?tab=" + activeTab)
                        : pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          target={(item as any).target}
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            "flex items-center gap-2 rounded-xl text-xs font-semibold transition-all duration-300",
                            collapsed ? "justify-center p-2.5" : "px-2.5 py-2",
                            active
                              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400"
                              : "text-gray-500 dark:text-slate-400 hover:bg-gray-55 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                          )}
                        >
                          <Icon className={cn(
                            "w-[18px] h-[18px] shrink-0 transition-all duration-300",
                            item.href === "/settings/demo"
                              ? "text-indigo-650 dark:text-indigo-400 animate-pulse scale-105"
                              : active
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-gray-400 dark:text-slate-500"
                          )} />
                          <span className={cn(
                            "transition-all duration-300 whitespace-nowrap truncate",
                            collapsed ? "opacity-0 max-w-0 overflow-hidden" : "opacity-100 max-w-[200px]"
                          )}>
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Collapse Toggle Button */}
          <button
            onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute top-6 -right-3.5 w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center shadow-md hover:shadow-lg hover:bg-gray-55 dark:hover:bg-slate-700 transition-all z-10 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white"
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </aside>

        {/* Main Content Pane wrapper */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Main Content Pane */}
          <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-[#0b0c10]/40 p-6 pt-16 relative">
            {/* Back to Dashboard / Back to Settings */}
            <div className="absolute top-4 right-6 z-20">
              {isMoreSettings ? (
                <Link
                  href="/settings/profile"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-indigo-650 dark:text-slate-400 dark:hover:text-indigo-400 border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#13151f] hover:bg-gray-50 dark:hover:bg-slate-800/40 shadow-sm transition-all group select-none"
                >
                  <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-indigo-500" />
                  Back to Settings
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-indigo-650 dark:text-slate-400 dark:hover:text-indigo-400 border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#13151f] hover:bg-gray-50 dark:hover:bg-slate-800/40 shadow-sm transition-all group select-none"
                >
                  <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-indigo-500" />
                  Back to Dashboard
                </Link>
              )}
            </div>

            <div className="w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
      <PageTutorial />
    </div>
  );
}
