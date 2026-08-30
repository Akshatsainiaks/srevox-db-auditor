"use client";
import { Suspense } from "react";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Eye, EyeOff } from "lucide-react";
import { SrevoxLogo } from "@/components/Logo";

import { api } from "@/lib/api";
import { setToken, setUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function AcceptInviteForm() {
  const params  = useSearchParams();
  const router  = useRouter();
  const token   = params.get("token") || "";
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [done,     setDone]     = useState(false);

  const submit = async () => {
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true); setError("");
    try {
      const res = await api.post("/api/users/accept-invite", {
        token, password, full_name: fullName,
      });
      setToken(res.data.access_token);
      if (res.data.user) setUser(res.data.user);
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to accept invitation");
    } finally { setLoading(false); }
  };

  if (!token) return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d0f17] flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-600 font-medium">Invalid invitation link</p>
        <Link href="/login" className="text-indigo-600 text-sm mt-2 block hover:underline">Go to login</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white dark:from-[#0d0f17] dark:to-[#151823] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <SrevoxLogo size={52} />
            <div>
              <div className="font-bold text-gray-900 dark:text-white text-xl">Srevox</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">You've been invited to join</div>
            </div>
          </Link>
        </div>

        {done ? (
          <div className="card p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-bold text-gray-900 dark:text-white text-lg">Welcome to Srevox!</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Redirecting to dashboard...</p>
          </div>
        ) : (
          <div className="card p-6 shadow-sm">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Accept invitation</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">Set up your account to get started.</p>
            <div className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input className="input" placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label">Create password</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} className="input pr-10" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-sm text-red-600">{error}</div>}
              <button onClick={submit} disabled={loading || !password} className="btn-primary w-full justify-center py-2.5">
                {loading ? "Setting up..." : "Accept & join team"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#0d0f17] flex items-center justify-center text-gray-400">Loading...</div>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
