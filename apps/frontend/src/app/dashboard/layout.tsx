"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar   from "@/components/Sidebar";
import Navbar    from "@/components/navbar/Navbar";
import AuthGuard from "@/components/AuthGuard";
import UpdateAnnouncement from "@/components/UpdateAnnouncement";
import PageTutorial from "@/components/PageTutorial";
import DefaultCredentialsWarning from "@/components/DefaultCredentialsWarning";
import { startRoleSync } from "@/lib/auth";

function applyDashboardTheme() {
  try {
    const t = localStorage.getItem("sv_dashboard_theme");
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else if (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch {}
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const [hideSidebar, setHideSidebar] = useState(false);

  useEffect(() => {
    applyDashboardTheme();
    
    // Load sidebar collapsed state
    try {
      const saved = localStorage.getItem("sv_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  useEffect(() => startRoleSync(), []); // polls /api/auth/account every 30s — no re-login needed after role change

  useEffect(() => {
    setHideSidebar(pathname === "/dashboard/notifications" || pathname === "/dashboard/engineering");
  }, [pathname]);

  return (
    <AuthGuard>
      <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0d0f17]">
        <div className="shrink-0">
          <Navbar />
          <DefaultCredentialsWarning />
        </div>
        {/* <UpdateAnnouncement /> */}
        <div className="flex flex-1 overflow-hidden">
          {!hideSidebar && (
            <Sidebar
              collapsed={collapsed}
              onToggle={() => {
                const next = !collapsed;
                setCollapsed(next);
                try {
                  localStorage.setItem("sv_sidebar_collapsed", String(next));
                } catch {}
              }}
            />
          )}
          <main className="flex-1 overflow-y-auto min-w-0 bg-slate-50 dark:bg-[#0d0f17]">
            <div className="w-full px-6 py-6">
              {children}
            </div>
          </main>
        </div>
        <PageTutorial />
      </div>
    </AuthGuard>
  );
}