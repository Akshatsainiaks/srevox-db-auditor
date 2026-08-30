"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken } from "@/lib/auth";
import { SrevoxLogo } from "@/components/Logo";

const PUBLIC_PATHS = ["/", "/login"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready,  setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p);
    if (!token && !isPublic) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [pathname, router]);

  if (!ready && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0d0f17] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-pulse">
            <SrevoxLogo size={48} />
          </div>
          <span className="text-sm text-gray-400">Loading Srevox...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
