"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Crown, Shield, Eye, User, SlidersHorizontal, ExternalLink, Sun, Moon, LogOut } from "lucide-react";
import { getUser, removeToken, AuthUser } from "@/lib/auth";
import { apiLogout } from "@/lib/api";
import { useTheme } from "../ThemeProvider";
import { useConfirm } from "@/components/ConfirmModal";

const ROLE_ICONS: Record<string, React.ElementType> = { admin: Crown, member: Shield, viewer: Eye };
const ROLE_COLORS: Record<string, string> = {
  admin: "text-purple-500 dark:text-purple-400",
  member: "text-blue-500 dark:text-blue-400",
  viewer: "text-gray-500 dark:text-slate-400",
};

export default function NavbarProfile() {
  const router = useRouter();
  const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL || "https://srevox-website.vercel.app";
  const { theme, setTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUserState] = useState<AuthUser | null>(getUser());
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleUserUpdate = (e: any) => setUserState(e.detail);
    window.addEventListener("sv_user_updated", handleUserUpdate);
    return () => window.removeEventListener("sv_user_updated", handleUserUpdate);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const { confirm } = useConfirm();

  const logout = async () => {
    const { confirmed } = await confirm({
      title: "Sign out of Srevox?",
      message: "Are you sure you want to log out of your session? You will need to log back in to access the workspace.",
      confirmLabel: "Sign Out",
      variant: "danger",
    });
    if (!confirmed) return;
    try { await apiLogout(); } catch {}
    removeToken();
    router.push("/login");
  };

  const RoleIcon = ROLE_ICONS[user?.role || "viewer"] || Shield;

  return (
    <div ref={profileRef} className="relative">
      <button onClick={() => setProfileOpen(o => !o)}
        className="flex items-center gap-2.5 pl-1 pr-2 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
          {user?.email?.[0]?.toUpperCase()}
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-xs font-semibold text-gray-800 dark:text-slate-200 leading-tight max-w-[120px] truncate">
            {(user?.full_name || user?.email?.split("@")[0] || "").split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
          </div>
          <div className={`text-[11px] flex items-center gap-1 leading-tight ${ROLE_COLORS[user?.role || "viewer"]}`}>
            <RoleIcon className="w-2.5 h-2.5" />
            <span className="capitalize">{user?.role}</span>
          </div>
        </div>
      </button>

      {profileOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#1e2130] border border-gray-100 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden z-50">
          <div className="px-4 py-4 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-500/5 dark:to-violet-500/5 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
                {user?.email?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-gray-900 dark:text-white text-sm truncate">
                  {(user?.full_name || "—").split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{user?.email}</div>
                <div className={`text-xs flex items-center gap-1 mt-0.5 font-medium ${ROLE_COLORS[user?.role || "viewer"]}`}>
                  <RoleIcon className="w-2.5 h-2.5" />
                  <span className="capitalize">{user?.role}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-2 space-y-0.5">
            {[
              { href: "/settings/profile", icon: User, label: "Profile & Settings", sub: "Account, password" },
              { href: `${websiteUrl}/docs`, icon: ExternalLink, label: "Documentation", sub: "Opens in new tab", target: "_blank" },
            ].map(item => (
              <Link key={item.href} href={item.href} target={(item as any).target} onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                  <item.icon className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                </div>
                <div>
                  <div className="font-medium text-gray-800 dark:text-slate-200 text-sm leading-tight">{item.label}</div>
                  <div className="text-xs text-gray-400 dark:text-slate-500">{item.sub}</div>
                </div>
              </Link>
            ))}

            {/* Theme */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                {theme === "dark" ? <Moon className="w-3.5 h-3.5 text-slate-400" /> : <Sun className="w-3.5 h-3.5 text-gray-500" />}
              </div>
              <span className="font-medium text-gray-800 dark:text-slate-200 text-sm flex-1">Theme</span>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
                <button onClick={() => setTheme("light")} className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${theme === "light" ? "bg-white shadow-sm text-gray-800" : "text-gray-400 dark:text-slate-500"}`}>
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setTheme("dark")} className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${theme === "dark" ? "bg-slate-600 shadow-sm text-white" : "text-gray-400 dark:text-slate-500"}`}>
                  <Moon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-700 my-1" />
            <button onClick={() => { setProfileOpen(false); logout(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                <LogOut className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
              </div>
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
