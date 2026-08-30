"use client";
import React, { useState } from "react";
import { BookOpen, Check, Copy, Info } from "lucide-react";

export default function ApiDocs() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-8 animate-fade-in text-gray-800 dark:text-slate-200 max-h-[80vh] overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="flex items-start gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/60">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            API Reference Guide
          </h2>
          <p className="text-[11px] text-gray-555 dark:text-slate-400 mt-0.5">
            Comprehensive REST API specifications detailing request bodies, query schemas, and database responses.
          </p>
        </div>
      </div>

      {/* Info notice banner */}
      <div className="bg-emerald-50/20 dark:bg-emerald-500/5 border border-emerald-250/30 dark:border-emerald-500/15 rounded-2xl p-4 flex gap-3 items-center">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-500 shrink-0">
          <Check className="w-4.5 h-4.5" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-gray-900 dark:text-white">API Reference Configured</h4>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-normal">
            Below is the full REST API documentation covering authentication, cluster telemetry, monitored services, alert channels, and data retention policies.
          </p>
        </div>
      </div>

      {/* Authentication Guide */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          1. General Authentication
        </h3>
        <p className="text-xs text-gray-555 dark:text-slate-400 leading-relaxed">
          All platform API routes require Bearer JWT token header verification:
        </p>
        <div className="relative bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 flex items-center justify-between gap-4 select-all">
          <span className="text-slate-300">Authorization: Bearer &lt;YOUR_API_JWT_TOKEN&gt;</span>
          <button
            onClick={() => handleCopyText("Authorization: Bearer <YOUR_API_JWT_TOKEN>", "auth-header")}
            className="p-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-lg hover:text-white transition"
          >
            {copiedId === "auth-header" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Authentication & Profile API */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          2. Authentication & Profile API
        </h3>

        {/* POST /api/auth/login */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-100/40">
              POST
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/auth/login</span>
            <span className="text-xs text-gray-550 dark:text-slate-400">— Login user to retrieve JWT access token</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px] flex items-center justify-between">
                <span>Request Payload:</span>
                <button
                  onClick={() => handleCopyText(`{\n  "email": "admin@srevox.io",\n  "password": "secure_password"\n}`, "post-login")}
                  className="text-indigo-655 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold lowercase tracking-normal text-[10px]"
                >
                  {copiedId === "post-login" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  copy JSON
                </button>
              </div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "email": "admin@srevox.io",
  "password": "secure_password"
}`}
              </pre>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data model (200 OK):</div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "user": {
    "user_id": "usr-189db4c8",
    "email": "admin@srevox.io",
    "full_name": "Admin User",
    "role": "admin"
  }
}`}
              </pre>
            </div>
          </div>
        </div>

        {/* GET /api/auth/profile */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/auth/profile</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— Retrieve current user profile details</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "user_id": "usr-189db4c8",
  "email": "admin@srevox.io",
  "full_name": "Admin User",
  "role": "admin",
  "org_id": "org-51db8f"
}`}
          </pre>
        </div>
      </div>

      {/* 3. Monitored Services API */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          3. Monitored Services API
        </h3>
        
        {/* GET /api/services */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/services</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— List all microservices registered in current organization</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Structure:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`[
  {
    "service_id": "srv-9f4a8b2c",
    "name": "Auth Middleware",
    "description": "Authenticates incoming application requests",
    "status": "healthy",
    "owner_group_id": "grp-189db4",
    "created_at": "2026-07-14T14:49:41Z"
  }
]`}
          </pre>
        </div>

        {/* POST /api/services */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-100/40">
              POST
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/services</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— Register a new monitored microservice</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px] flex items-center justify-between">
                <span>Request Payload Model:</span>
                <button
                  onClick={() => handleCopyText(`{\n  "name": "Metrics Processor",\n  "description": "Aggregates and formats cluster logs",\n  "owner_group_id": "grp-5a3d21"\n}`, "post-service")}
                  className="text-indigo-650 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold lowercase tracking-normal text-[10px]"
                >
                  {copiedId === "post-service" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  copy JSON
                </button>
              </div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "name": "Metrics Processor",
  "description": "Aggregates and formats cluster logs",
  "owner_group_id": "grp-5a3d21"
}`}
              </pre>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data model (201 Created):</div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "message": "Service registered successfully",
  "service_id": "srv-8c2f1a5b"
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Service Owners & Fallback Defaults API */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          4. Service Owners & Fallback Routing API
        </h3>

        {/* GET /api/service-owners */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/service-owners</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— List service mapping ownership configurations</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`[
  {
    "service_owner_id": "so-9f4a8b2c",
    "cluster_id": "cls-91db2c",
    "namespace": "production",
    "pod_prefix": "auth-api",
    "user_ids": ["usr-189db4c8"],
    "group_ids": [],
    "channel_ids": ["chn-5a3d21"]
  }
]`}
          </pre>
        </div>

        {/* POST /api/service-owners */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-100/40">
              POST
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/service-owners</span>
            <span className="text-xs text-gray-555 dark:text-slate-400">— Map workload properties to specific owners</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px] flex items-center justify-between">
                <span>Request Payload Model:</span>
                <button
                  onClick={() => handleCopyText(`{\n  "cluster_id": "cls-91db2c",\n  "namespace": "production",\n  "pod_prefix": "auth-api",\n  "user_ids": ["usr-189db4c8"],\n  "channel_ids": ["chn-5a3d21"]\n}`, "post-service-owner")}
                  className="text-indigo-650 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold lowercase tracking-normal text-[10px]"
                >
                  {copiedId === "post-service-owner" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  copy JSON
                </button>
              </div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "cluster_id": "cls-91db2c",
  "namespace": "production",
  "pod_prefix": "auth-api",
  "user_ids": ["usr-189db4c8"],
  "channel_ids": ["chn-5a3d21"]
}`}
              </pre>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data model (201 Created):</div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "message": "Service owner mapping created successfully",
  "service_owner_id": "so-8c2f1a5b"
}`}
              </pre>
            </div>
          </div>
        </div>

        {/* GET /api/service-owners/routing-defaults */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/service-owners/routing-defaults</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— Retrieve organization-wide fallback routing channels</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "default_alert_source_channel_id": "chnb810w9f71ff",
  "default_alert_cc": "lead-devs@company.com",
  "default_alert_bcc": "security-audit@company.com"
}`}
          </pre>
        </div>
      </div>

      {/* 5. Kubernetes Clusters API */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          5. Kubernetes Clusters API
        </h3>

        {/* GET /api/clusters */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/clusters</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— List all registered Kubernetes clusters</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`[
  {
    "cluster_id": "cls-prod-01",
    "name": "US East Production",
    "connection_type": "agent",
    "status": "connected",
    "k8s_version": "v1.28.2",
    "metrics_status": "connected",
    "last_seen_at": "2026-07-22T16:04:12Z"
  }
]`}
          </pre>
        </div>

        {/* POST /api/clusters */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-100/40">
              POST
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/clusters</span>
            <span className="text-xs text-gray-555 dark:text-slate-400">— Register a new Kubernetes cluster</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px] flex items-center justify-between">
                <span>Request Payload:</span>
                <button
                  onClick={() => handleCopyText(`{\n  "name": "Dev Sandbox Cluster",\n  "connection_type": "agent",\n  "cloud_provider": "gcp"\n}`, "post-cluster")}
                  className="text-indigo-655 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold lowercase tracking-normal text-[10px]"
                >
                  {copiedId === "post-cluster" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  copy JSON
                </button>
              </div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "name": "Dev Sandbox Cluster",
  "connection_type": "agent",
  "cloud_provider": "gcp"
}`}
              </pre>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data model (201 Created):</div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "cluster_id": "cls-dev-05",
  "name": "Dev Sandbox Cluster",
  "connection_type": "agent",
  "agent_token": "agt-7fb48c1a92",
  "install_command": "kubectl apply -f https://app.srevox.io/agent.yaml?token=agt-7fb48c1a92"
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Notification Channels & Groups API */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          6. Notification Channels & Alert Groups API
        </h3>

        {/* GET /api/channels */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/channels</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— List alert routing delivery channels</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`[
  {
    "channel_id": "chnu12gxzn3mz",
    "name": "Production Slack Alerts",
    "type": "webhook",
    "enabled": true,
    "channel_type": "normal",
    "service_count": 4
  }
]`}
          </pre>
        </div>

        {/* POST /api/channels */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-100/40">
              POST
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/channels</span>
            <span className="text-xs text-gray-555 dark:text-slate-400">— Register an incoming alert destination channel</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px] flex items-center justify-between">
                <span>Request Payload:</span>
                <button
                  onClick={() => handleCopyText(`{\n  "name": "Dev Slack Channel",\n  "type": "webhook",\n  "config": {\n    "url": "https://hooks.slack.com/services/..."\n  },\n  "channel_type": "normal"\n}`, "post-channel")}
                  className="text-indigo-650 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold lowercase tracking-normal text-[10px]"
                >
                  {copiedId === "post-channel" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  copy JSON
                </button>
              </div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "name": "Dev Slack Channel",
  "type": "webhook",
  "config": {
    "url": "https://hooks.slack.com/services/..."
  },
  "channel_type": "normal"
}`}
              </pre>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data model (201 Created):</div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "channel_id": "chnu12gxzn3mz",
  "name": "Dev Slack Channel",
  "type": "webhook",
  "enabled": true,
  "channel_type": "normal",
  "is_global_default": false
}`}
              </pre>
            </div>
          </div>
        </div>

        {/* GET /api/notification-groups */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/notification-groups</span>
            <span className="text-xs text-gray-555 dark:text-slate-400">— List organization notification destination email groups</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "notification_groups": [
    {
      "group_id": "ngp-prod-core",
      "name": "Core Dev Team",
      "emails": ["lead@company.com", "oncall@company.com"]
    }
  ]
}`}
          </pre>
        </div>
      </div>

      {/* 7. Incident Management & Notifications API */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          7. Incident Management & Notifications API
        </h3>

        {/* GET /api/incidents */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/incidents</span>
            <span className="text-xs text-gray-555 dark:text-slate-400">— Retrieve platform crash incidents log</span>
          </div>
          
          <div className="text-xs text-gray-555 dark:text-slate-400">
            <strong>Query Options:</strong> <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono text-[11px]">status</code> (open, acknowledged, resolved) | <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono text-[11px]">cluster_id</code> (string) | <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono text-[11px]">limit</code> (number)
          </div>

          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "incidents": [
    {
      "incident_id": "inc-4b2a7d1e",
      "cluster_id": "clsijfiyfqwbb",
      "cluster_name": "Development_Cluster",
      "pod_name": "logi-auction-767567594b-dc21",
      "namespace": "hoicko-system",
      "crash_reason": "ImagePullBackOff",
      "status": "open",
      "first_seen_at": "2026-07-22T16:04:12Z"
    }
  ],
  "total": 30
}`}
          </pre>
        </div>

        {/* POST /api/incidents/:id/resolve */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-100/40">
              POST
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/incidents/:incident_id/resolve</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— Transition incident status to resolved</span>
          </div>
          
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "message": "Incident marked resolved successfully",
  "resolved_at": "2026-07-14T15:49:41Z"
}`}
          </pre>
        </div>

        {/* GET /api/notifications */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/notifications</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— Fetch system notifications feed for the current user</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "notifications": [
    {
      "notification_id": "not-12d9f1",
      "title": "logi-auction-767567594b-dc21 crashed",
      "sub": "CrashLoopBackOff · hoicko-system",
      "severity": "critical",
      "is_read": false,
      "created_at": "2026-07-22T16:04:12Z"
    }
  ]
}`}
          </pre>
        </div>
      </div>

      {/* 8. Cluster Infrastructure API */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          8. Cluster Infrastructure API
        </h3>

        {/* GET /api/infrastructure/:clusterId/nodes */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/infrastructure/:clusterId/nodes</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— Query node capacities, status and active pods counters</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "nodes": [
    {
      "name": "kube-worker-3",
      "role": "worker",
      "status": "Ready",
      "cpu_cores": 12,
      "memory_gb": 68.2,
      "cpu_usage_cores": 3.48,
      "memory_usage_gb": 39.5,
      "pods_running": 54,
      "pods_capacity": 110,
      "age": "453d"
    }
  ]
}`}
          </pre>
        </div>

        {/* GET /api/infrastructure/:clusterId/pods */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/infrastructure/:clusterId/pods</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— Retrieve live pods metrics lists</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "pods": [
    {
      "name": "logi-auction-767567594b-vm8n8",
      "namespace": "hoicko-system",
      "node": "kube-worker-3",
      "status": "Running",
      "cpu_usage_m": 12,
      "memory_usage_mi": 134,
      "restarts": 4,
      "age": "23d"
    }
  ]
}`}
          </pre>
        </div>
      </div>

      {/* 9. Alert Rules & Thresholds API */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-950 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          9. Alert Rules & Thresholds API
        </h3>

        {/* GET /api/alert-rules */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/alert-rules</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— List crash alert matching rules</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`[
  {
    "rule_id": "rul-prod-01",
    "name": "Production Workloads Crashes",
    "target_namespace": "production",
    "severity": "critical",
    "enabled": true
  }
]`}
          </pre>
        </div>

        {/* GET /api/resource-alerts */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/resource-alerts</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— List cluster node capacity/resource thresholds alerts</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`[
  {
    "resource_alert_id": "ral-cpu-warning",
    "resource_type": "cpu",
    "threshold_pct": 85,
    "target": "node",
    "target_name": "all"
  }
]`}
          </pre>
        </div>
      </div>

      {/* 10. User Management, RBAC Groups & Roles API */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          10. User Management, RBAC Groups & Roles API
        </h3>

        {/* GET /api/users */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/users</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— List active users inside the current organization</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "users": [
    {
      "user_id": "usr-189db4c8",
      "email": "developer@company.com",
      "full_name": "Bharat Mali",
      "role": "admin"
    }
  ]
}`}
          </pre>
        </div>

        {/* GET /api/groups */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/groups</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— List team membership groups for alert grouping</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "groups": [
    {
      "group_id": "grp-core-devs",
      "name": "Core Backend Developers",
      "description": "Handles API and auth clusters"
    }
  ]
}`}
          </pre>
        </div>

        {/* GET /api/auth/roles */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/auth/roles</span>
            <span className="text-xs text-gray-555 dark:text-slate-400">— Query available security permissions roles (owner, admin, member, guest)</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`[
  {
    "name": "admin",
    "permissions": ["viewClusters", "addCluster", "deleteCluster", "viewServiceOwners", "addServiceOwner"]
  }
]`}
          </pre>
        </div>
      </div>

      {/* 11. System Alerts & AI Settings API */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          11. System Alerts & AI Settings API
        </h3>

        {/* GET /api/system-alerts/settings */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/system-alerts/settings</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— Retrieve system event routing configs</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "enabled": true,
  "enabled_events": ["cluster_error", "agent_offline"],
  "channel_ids": ["chnu12gxzn3mz"]
}`}
          </pre>
        </div>

        {/* GET /api/ai-settings */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/ai-settings</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— Retrieve LLM agent system prompts configs for diagnostics</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data Model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "system_prompt": "You are a Kubernetes operations expert. Diagnose the following pod crash incident...",
  "model_name": "gemini-1.5-pro",
  "temperature": 0.2
}`}
          </pre>
        </div>
      </div>

      {/* 12. Audit Logs Ledger API */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          12. Audit logs Ledger API (Rust Activity Microservice)
        </h3>

        {/* GET /api/activities */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/activities</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— Query administrative audit logs</span>
          </div>
          
          <div className="text-xs text-gray-555 dark:text-slate-400">
            <strong>Query Options:</strong> <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono text-[11px]">user_id</code> | <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono text-[11px]">action</code> | <code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-mono text-[11px]">search</code> | <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono text-[11px]">limit</code>
          </div>

          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`[
  {
    "activity_id": "actjk4bnhrb",
    "user_id": "usr-189db4c8",
    "action": "service_owner_assigned",
    "target_resource": "Auth Middleware",
    "metadata": {
      "assigned_group": "security-devs",
      "ip_address": "127.0.0.1"
    },
    "created_at": "2026-07-14T14:49:41Z"
  }
]`}
          </pre>
        </div>

        {/* POST /api/activities */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-100/40">
              POST
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/activities</span>
            <span className="text-xs text-gray-555 dark:text-slate-400">— Ingest custom administrative activity log</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px] flex items-center justify-between">
                <span>Request Payload Model:</span>
                <button
                  onClick={() => handleCopyText(`{\n  "action": "custom_deployment_sweep",\n  "target_resource": "k8s-pod-cluster",\n  "metadata": {\n    "environment": "production",\n    "agent": "deploy-script-cli"\n  }\n}`, "post-activity")}
                  className="text-indigo-650 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold lowercase tracking-normal text-[10px]"
                >
                  {copiedId === "post-activity" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  copy JSON
                </button>
              </div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "action": "custom_deployment_sweep",
  "target_resource": "k8s-pod-cluster",
  "metadata": {
    "environment": "production",
    "agent": "deploy-script-cli"
  }
}`}
              </pre>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data model (201 Created):</div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "status": "success",
  "activity_id": "actz18f2kd9"
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* 13. Data Retention Preferences API */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          13. Data Retention Preferences API
        </h3>

        {/* GET /api/preferences/retention */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/40">
              GET
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/preferences/retention</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">— Retrieve current organization logs and incident retention policies</span>
          </div>
          <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data model:</div>
          <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "policy": {
    "activity_days": 30,
    "incident_days": 90
  },
  "runs": [
    {
      "run_type": "logs",
      "items_purged": 12,
      "completed_at": "2026-07-14T14:49:41Z"
    }
  ]
}`}
          </pre>
        </div>

        {/* PUT /api/preferences/retention */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-100/40">
              PUT
            </span>
            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">/api/preferences/retention</span>
            <span className="text-xs text-gray-555 dark:text-slate-400">— Update organization data retention schedules (Admin only)</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px] flex items-center justify-between">
                <span>Request Payload Model:</span>
                <button
                  onClick={() => handleCopyText(`{\n  "activity_days": 45,\n  "incident_days": 180\n}`, "put-retention")}
                  className="text-indigo-650 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold lowercase tracking-normal text-[10px]"
                >
                  {copiedId === "put-retention" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  copy JSON
                </button>
              </div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "activity_days": 45,
  "incident_days": 180
}`}
              </pre>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">Response Data model:</div>
              <pre className="bg-[#090b11] text-[#b3b9d1] font-mono text-[11px] p-4 rounded-xl border border-slate-900 overflow-x-auto">
{`{
  "message": "Retention policy saved successfully"
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Footer notice */}
      <div className="flex gap-2 items-start pt-4 border-t border-gray-100 dark:border-slate-800/60 text-[10px] text-gray-400 dark:text-slate-500">
        <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
        <span>Use Srevox API JWT token values only inside backend processes. Never expose authorization bearer credentials on client browsers.</span>
      </div>
    </div>
  );
}
