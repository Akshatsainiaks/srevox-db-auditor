"use client";
import { useLayoutEffect } from "react";
import Link from "next/link";
import { ArrowRight, Zap, Shield, Sparkles, Server } from "lucide-react";
import { SrevoxLogo } from "@/components/Logo";

export default function IndexPage() {
  // Always force light mode on the welcome/landing page
  useLayoutEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.backgroundColor = "#f8fafc";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 flex flex-col justify-between text-gray-900 font-sans p-6">
      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <SrevoxLogo size={40} />
          <div className="flex flex-col">
            <span className="font-bold text-gray-900 text-xl tracking-tight leading-none">Srevox</span>
            <span className="text-[9px] text-indigo-600 mt-1 uppercase font-bold tracking-widest">Self-Hosted</span>
          </div>
        </div>
        <Link 
          href="/login" 
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2 transition-all shadow-sm"
        >
          Sign In
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto my-auto py-12 flex flex-col items-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold mb-6">
          <Zap className="w-3.5 h-3.5 fill-indigo-100" />
          <span>Kubernetes Crash Alerting</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight max-w-2xl">
          Catch crashes before your users do.
        </h1>

        {/* Description */}
        <p className="mt-6 text-base md:text-lg text-gray-500 max-w-xl leading-relaxed">
          A simple, self-hosted alerting engine that monitors Kubernetes clusters, captures container crashes, and provides fast troubleshooting advice.
        </p>

        {/* Action Button */}
        <div className="mt-10">
          <Link 
            href="/login" 
            className="inline-flex items-center gap-2.5 px-7 py-4 rounded-2xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Quick Features Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Real-time Monitoring</h3>
            <p className="text-gray-500 text-xs leading-relaxed">
              Detects container failures and crashes instantly from your cluster API socket with zero delay.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">AI Troubleshooting</h3>
            <p className="text-gray-500 text-xs leading-relaxed">
              Finds root causes and suggests quick fixes using your preferred AI models like OpenAI or local Ollama.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">100% Private</h3>
            <p className="text-gray-500 text-xs leading-relaxed">
              Runs completely inside your own local network. Your cluster logs and data never leave your server.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto text-center py-6 border-t border-gray-200/60 text-[11px] text-gray-400 font-semibold select-none">
       Self-Hosted Instance
      </footer>
    </div>
  );
}
