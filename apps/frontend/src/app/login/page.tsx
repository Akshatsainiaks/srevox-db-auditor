"use client";
import { useState, useLayoutEffect, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { apiLogin } from "@/lib/api";
import { setToken, setUser } from "@/lib/auth";
import { SrevoxLogo } from "@/components/Logo";
import { applyDashboardTheme } from "@/components/ThemeProvider";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      if (emailParam) setEmail(emailParam);
    }
  }, []);

  // Always force white background on login — runs before browser paint
  useLayoutEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.backgroundColor = "#f8fafc";
  }, []);

  const submit = async () => {
    if (!email || !password) return;
    setLoading(true); setError("");
    try {
      const data = await apiLogin(email, password);
      setToken(data.access_token);
      if (data.user) setUser(data.user);
      // Re-apply user's dashboard theme before navigating
      applyDashboardTheme();
      router.push("/dashboard");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally { setLoading(false); }
  };

  const inp = "block w-full rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <SrevoxLogo size={52} />
            <div>
              <div className="font-bold text-gray-900 text-2xl tracking-tight">Srevox</div>
              <div className="text-sm text-gray-400 mt-0.5">Catch crashes before your users do.</div>
            </div>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-7">
          <h1 className="text-lg font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-6">Sign in to your account to continue</p>

          <form onSubmit={e => { e.preventDefault(); submit(); }} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email</label>
              <input type="email" className={inp} value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="new-password"
                autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} className={`${inp} pr-11`}
                   value={password} onChange={e => setPassword(e.target.value)}
                   placeholder="••••••••"
                   autoComplete="new-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                   className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3 text-sm text-red-600">
                <span className="shrink-0">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-sm shadow-indigo-200">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</>
                : "Sign in →"
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}