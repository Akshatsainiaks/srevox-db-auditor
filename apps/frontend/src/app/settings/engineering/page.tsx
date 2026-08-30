"use client";

import { useState, useRef, useEffect } from "react";

const techStack = [
  { name: "Next.js", url: "https://nextjs.org" },
  { name: "Fastify", url: "https://fastify.dev" },
  { name: "Node.js", url: "https://nodejs.org" },
  { name: "Go", url: "https://go.dev" },
  { name: "Rust", url: "https://www.rust-lang.org" },
  { name: "Redis", url: "https://redis.io" },
  { name: "PostgreSQL", url: "https://www.postgresql.org" },
  { name: "Docker", url: "https://www.docker.com" },
  { name: "Kubernetes", url: "https://kubernetes.io" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com" },
];

const platformFeatures = [
  "Self Hosted",
  "Kubernetes Native",
  "Real-Time Alerting",
  "Infrastructure Monitoring",
];

// Helper to calculate smooth curves between nodes
const getBezierPath = (startX: number, startY: number, endX: number, endY: number) => {
  const controlOffset = Math.max(80, Math.abs(endX - startX) * 0.4);
  const cp1x = startX + controlOffset;
  const cp1y = startY;
  const cp2x = endX - controlOffset;
  const cp2y = endY;
  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
};

export default function DeveloperPage() {
  const [nodes, setNodes] = useState([
    {
      id: "kubernetes",
      icon: "☸️",
      label: "Kubernetes",
      title: "Go Watch Agent",
      desc: "Watches pod events via the Kubernetes Watch API with sub-5s crash detection.",
      border: "border-blue-200 dark:border-blue-900/60",
      iconBg: "bg-blue-500/10 text-blue-500",
      x: 30,
      y: 220,
      width: 190,
      height: 120,
    },
    {
      id: "queue",
      icon: "🔴",
      label: "Queue Layer",
      title: "Redis Pub/Sub",
      desc: "Publishes crash events across the infrastructure alert pipeline.",
      border: "border-red-200 dark:border-red-900/60",
      iconBg: "bg-red-500/10 text-red-500",
      x: 310,
      y: 220,
      width: 190,
      height: 120,
    },
    {
      id: "processing",
      icon: "⚡",
      label: "Processing",
      title: "Alert Worker",
      desc: "Applies alert rules, cooldowns, routing, and incident generation.",
      border: "border-indigo-200 dark:border-indigo-900/60",
      iconBg: "bg-indigo-500/10 text-indigo-500",
      x: 590,
      y: 220,
      width: 190,
      height: 120,
    },
    {
      id: "ai",
      icon: "🤖",
      label: "AI Layer",
      title: "AI Diagnosis",
      desc: "Root cause analysis and infrastructure fix recommendations.",
      border: "border-emerald-200 dark:border-emerald-900/60",
      iconBg: "bg-emerald-500/10 text-emerald-500",
      x: 870,
      y: 40,
      width: 190,
      height: 120,
    },
    {
      id: "notifications",
      icon: "🔔",
      label: "Notifications",
      title: "Alert Channels",
      desc: "Sends to Slack, Teams, Email, WhatsApp, and Webhooks.",
      border: "border-orange-200 dark:border-orange-900/60",
      iconBg: "bg-orange-500/10 text-orange-500",
      x: 870,
      y: 220,
      width: 190,
      height: 120,
    },
    {
      id: "activity",
      icon: "🦀",
      label: "Audit Ledger",
      title: "Rust Activity Service",
      desc: "Ingests and structures organization-wide administrative actions and pipeline audit logs.",
      border: "border-pink-200 dark:border-pink-900/60",
      iconBg: "bg-pink-500/10 text-pink-500",
      x: 870,
      y: 400,
      width: 190,
      height: 120,
    },
  ]);

  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    setDraggedNodeId(id);
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      setDragOffset({
        x: (e.clientX - containerRect.left) - node.x,
        y: (e.clientY - containerRect.top) - node.y,
      });
    }
  };

  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    setDraggedNodeId(id);
    if (containerRef.current && e.touches[0]) {
      const containerRect = containerRef.current.getBoundingClientRect();
      setDragOffset({
        x: (e.touches[0].clientX - containerRect.left) - node.x,
        y: (e.touches[0].clientY - containerRect.top) - node.y,
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggedNodeId || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = (e.clientX - containerRect.left) - dragOffset.x;
    const newY = (e.clientY - containerRect.top) - dragOffset.y;
    const node = nodes.find(n => n.id === draggedNodeId);
    if (!node) return;
    const boundedX = Math.max(0, Math.min(1100 - node.width, newX));
    const boundedY = Math.max(0, Math.min(600 - node.height, newY));
    setNodes(prev =>
      prev.map(n =>
        n.id === draggedNodeId ? { ...n, x: boundedX, y: boundedY } : n
      )
    );
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!draggedNodeId || !containerRef.current || !e.touches[0]) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = (e.touches[0].clientX - containerRect.left) - dragOffset.x;
    const newY = (e.touches[0].clientY - containerRect.top) - dragOffset.y;
    const node = nodes.find(n => n.id === draggedNodeId);
    if (!node) return;
    const boundedX = Math.max(0, Math.min(1100 - node.width, newX));
    const boundedY = Math.max(0, Math.min(600 - node.height, newY));
    setNodes(prev =>
      prev.map(n =>
        n.id === draggedNodeId ? { ...n, x: boundedX, y: boundedY } : n
      )
    );
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
  };

  useEffect(() => {
    if (draggedNodeId) {
      const onMouseMove = (e: MouseEvent) => handleMouseMove(e);
      const onMouseUp = () => handleMouseUp();
      const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
      const onTouchEnd = () => handleMouseUp();

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd);

      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
      };
    }
  }, [draggedNodeId, dragOffset]);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">

        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
           Engineering Workspace
          </h1>

          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Explore the infrastructure, architecture, workflows, and technologies powering Srevox.
          </p>
        </div>

      </div>

      {/* Main Card */}
      <div className="card relative overflow-hidden p-8 lg:p-10 border border-gray-200 dark:border-slate-800">

        {/* Subtle Glow */}
        <div className="absolute top-0 right-0 w-[320px] h-[320px] bg-indigo-500/10 dark:bg-indigo-500/5 blur-3xl rounded-full" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left Side */}
          <div>

            {/* Badge */}
            <div className="section-tag">
              Backend & DevOps Engineer
            </div>

            {/* Name */}
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mt-5 leading-tight">
              Akshat Saini
            </h2>

            {/* Description */}
            <p className="mt-6 leading-8 text-lg max-w-2xl text-gray-600 dark:text-slate-400">
              Built Srevox, a self-hosted Kubernetes observability and incident
              management platform focused on real-time crash detection,
              intelligent alerting, and infrastructure reliability.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap gap-4 mt-8">

              <a
                href="https://github.com/Akshatsainiaks"
                target="_blank"
                className="btn-primary rounded-2xl px-5 py-3"
              >
                Developer GitHub
              </a>

              <a
                href="https://github.com/Akshatsainiaks/srevox"
                target="_blank"
                className="btn-secondary rounded-2xl px-5 py-3"
              >
                Srevox Repository
              </a>

            </div>

            {/* Contact */}
            <div className="mt-10">

              <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-slate-500 mb-3">
                Connect With Developer
              </p>

              <a
                href="mailto:contact@srevox.io"
                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 dark:hover:text-indigo-300 transition text-lg font-medium"
              >
                akshatsaini336@gmail.com
              </a>

            </div>

            {/* Platform Features */}
            <div className="flex flex-wrap gap-3 mt-10">

              {platformFeatures.map((item) => (
                <div
                  key={item}
                  className="px-3 py-1.5 text-sm rounded-xl border border-indigo-200 dark:border-slate-700 bg-indigo-50 dark:bg-[#111827] text-indigo-700 dark:text-slate-300"
                >
                  {item}
                </div>
              ))}

            </div>

          </div>

          {/* Right Side */}
          <div className="flex justify-center">

            <div className="relative flex items-center justify-center">

              {/* Glow */}
              <div className="absolute w-[280px] h-[280px] bg-indigo-500/10 dark:bg-indigo-500/5 blur-3xl rounded-full" />

              {/* Developer Illustration */}
              <img
                src="/animations/developer.svg"
                alt="Developer Illustration"
                className="relative z-10 w-[260px] md:w-[360px] opacity-95"
              />

              {/* Floating Logo */}
              <div className="absolute bottom-4 right-4 z-20 animate-srevoxFloat">

                <div className="relative">

                  {/* Small Glow */}
                  <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-500/10 blur-2xl rounded-2xl animate-pulse" />

                  {/* Logo Card */}
                  <div className="relative w-20 h-20 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-[#151823]/90 backdrop-blur-xl flex items-center justify-center shadow-xl">

                    <img
                      src="/favicon.svg"
                      alt="Srevox Logo"
                      className="w-11 h-11 drop-shadow-[0_0_20px_rgba(59,130,246,0.45)]"
                    />

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Tech Stack */}
      <div className="card p-8 border border-gray-200 dark:border-slate-800">

        <div className="mb-7">

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tech Stack
          </h2>

          <p className="mt-2 text-gray-500 dark:text-slate-400">
            Core technologies powering Srevox.
          </p>

        </div>

        <div className="flex flex-wrap gap-3">

          {techStack.map((tech) => (
            <a
              key={tech.name}
              href={tech.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium rounded-xl border border-indigo-200 dark:border-slate-700 bg-indigo-50 dark:bg-[#111827] text-indigo-700 dark:text-slate-200 hover:bg-indigo-100 dark:hover:bg-slate-800 hover:text-indigo-800 dark:hover:text-white transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5"
            >
              {tech.name}
              <span className="text-[10px] opacity-60">↗</span>
            </a>
          ))}

        </div>

      </div>

{/* Architecture Workflow */}
<div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 p-8">

  {/* Grid background */}
  <div
    className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none"
    style={{
      backgroundImage: "radial-gradient(circle, #64748b 1px, transparent 1px)",
      backgroundSize: "24px 24px",
    }}
  />

  {/* Glow */}
  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />

  <div className="relative z-10">

    {/* Header */}
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">
        Pipeline
      </p>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Srevox Architecture Workflow
      </h2>
      <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-400">
        Real-time Kubernetes crash detection and AI-powered alert pipeline.
      </p>
    </div>

    {/* Interactive Canvas Wrapper */}
    <div className="w-full overflow-x-auto pb-4">
      <div
        ref={containerRef}
        className="relative w-[1100px] h-[600px] rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#090D16]/40 overflow-hidden select-none"
      >
        {/* Subtle grid on canvas */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: "radial-gradient(circle, #64748b 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* SVG for connections */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full">
          <defs>
            <linearGradient id="grad-k8s-redis" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <linearGradient id="grad-redis-worker" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            <linearGradient id="grad-worker-ai" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id="grad-worker-notifications" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
            <linearGradient id="grad-worker-activity" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <style>{`
            @keyframes flowDash {
              to {
                stroke-dashoffset: -20;
              }
            }
            .animate-flow-dash {
              stroke-dasharray: 6 6;
              animation: flowDash 1.2s linear infinite;
            }
          `}</style>

          {/* Connection paths */}
          {(() => {
            const getCoord = (id: string) => {
              const n = nodes.find(node => node.id === id);
              return n ? { x: n.x, y: n.y, w: n.width, h: n.height } : { x: 0, y: 0, w: 224, h: 140 };
            };

            const k8s = getCoord("kubernetes");
            const queue = getCoord("queue");
            const proc = getCoord("processing");
            const ai = getCoord("ai");
            const notif = getCoord("notifications");
            const activity = getCoord("activity");

            const k8sOut = { x: k8s.x + k8s.w, y: k8s.y + k8s.h / 2 };
            const queueIn = { x: queue.x, y: queue.y + queue.h / 2 };
            const queueOut = { x: queue.x + queue.w, y: queue.y + queue.h / 2 };
            const procIn = { x: proc.x, y: proc.y + proc.h / 2 };
            const procOut = { x: proc.x + proc.w, y: proc.y + proc.h / 2 };
            const aiIn = { x: ai.x, y: ai.y + ai.h / 2 };
            const notifIn = { x: notif.x, y: notif.y + notif.h / 2 };
            const activityIn = { x: activity.x, y: activity.y + activity.h / 2 };

            return (
              <>
                {/* K8s -> Queue */}
                <path
                  d={getBezierPath(k8sOut.x, k8sOut.y, queueIn.x, queueIn.y)}
                  stroke="url(#grad-k8s-redis)"
                  strokeWidth="2.5"
                  fill="none"
                  opacity="0.85"
                />
                <path
                  d={getBezierPath(k8sOut.x, k8sOut.y, queueIn.x, queueIn.y)}
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  fill="none"
                  className="animate-flow-dash"
                  opacity="0.45"
                />

                {/* Queue -> Processing */}
                <path
                  d={getBezierPath(queueOut.x, queueOut.y, procIn.x, procIn.y)}
                  stroke="url(#grad-redis-worker)"
                  strokeWidth="2.5"
                  fill="none"
                  opacity="0.85"
                />
                <path
                  d={getBezierPath(queueOut.x, queueOut.y, procIn.x, procIn.y)}
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  fill="none"
                  className="animate-flow-dash"
                  opacity="0.45"
                />

                {/* Processing -> AI */}
                <path
                  d={getBezierPath(procOut.x, procOut.y, aiIn.x, aiIn.y)}
                  stroke="url(#grad-worker-ai)"
                  strokeWidth="2.5"
                  fill="none"
                  opacity="0.85"
                />
                <path
                  d={getBezierPath(procOut.x, procOut.y, aiIn.x, aiIn.y)}
                  stroke="#10b981"
                  strokeWidth="2.5"
                  fill="none"
                  className="animate-flow-dash"
                  opacity="0.45"
                />

                {/* Processing -> Notifications */}
                <path
                  d={getBezierPath(procOut.x, procOut.y, notifIn.x, notifIn.y)}
                  stroke="url(#grad-worker-notifications)"
                  strokeWidth="2.5"
                  fill="none"
                  opacity="0.85"
                />
                <path
                  d={getBezierPath(procOut.x, procOut.y, notifIn.x, notifIn.y)}
                  stroke="#f97316"
                  strokeWidth="2.5"
                  fill="none"
                  className="animate-flow-dash"
                  opacity="0.45"
                />

                {/* Processing -> Activity */}
                <path
                  d={getBezierPath(procOut.x, procOut.y, activityIn.x, activityIn.y)}
                  stroke="url(#grad-worker-activity)"
                  strokeWidth="2.5"
                  fill="none"
                  opacity="0.85"
                />
                <path
                  d={getBezierPath(procOut.x, procOut.y, activityIn.x, activityIn.y)}
                  stroke="#ec4899"
                  strokeWidth="2.5"
                  fill="none"
                  className="animate-flow-dash"
                  opacity="0.45"
                />
              </>
            );
          })()}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => (
          <div
            key={node.id}
            style={{
              left: `${node.x}px`,
              top: `${node.y}px`,
              width: `${node.width}px`,
              height: `${node.height}px`,
            }}
            className={`absolute rounded-xl border ${node.border} bg-white/95 dark:bg-[#111827]/95 p-3.5 shadow-sm hover:shadow-md transition-shadow duration-150 cursor-grab active:cursor-grabbing select-none backdrop-blur-sm flex flex-col justify-between`}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onTouchStart={(e) => handleTouchStart(e, node.id)}
          >
            {/* Visual Drag Indicator Handle */}
            <div className="absolute top-2 right-2.5 flex gap-0.5 opacity-20 hover:opacity-60 transition-opacity">
              <div className="flex flex-col gap-0.5">
                <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" />
                <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" />
                <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" />
                <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" />
                <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-7 h-7 rounded-lg ${node.iconBg} flex items-center justify-center text-sm shrink-0`}>
                  {node.icon}
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">{node.label}</p>
                  <h3 className="text-[11px] font-bold text-gray-900 dark:text-white leading-tight">{node.title}</h3>
                </div>
              </div>
              <p className="text-[9px] leading-relaxed text-gray-500 dark:text-slate-400 select-none pointer-events-none">
                {node.desc}
              </p>
            </div>
          </div>
        ))}

        {/* Reset button inside canvas */}
        <button
          onClick={() => setNodes([
            {
              id: "kubernetes",
              icon: "☸️",
              label: "Kubernetes",
              title: "Go Watch Agent",
              desc: "Watches pod events via the Kubernetes Watch API with sub-5s crash detection.",
              border: "border-blue-200 dark:border-blue-900/60",
              iconBg: "bg-blue-500/10 text-blue-500",
              x: 30,
              y: 220,
              width: 190,
              height: 120,
            },
            {
              id: "queue",
              icon: "🔴",
              label: "Queue Layer",
              title: "Redis Pub/Sub",
              desc: "Publishes crash events across the infrastructure alert pipeline.",
              border: "border-red-200 dark:border-red-900/60",
              iconBg: "bg-red-500/10 text-red-500",
              x: 310,
              y: 220,
              width: 190,
              height: 120,
            },
            {
              id: "processing",
              icon: "⚡",
              label: "Processing",
              title: "Alert Worker",
              desc: "Applies alert rules, cooldowns, routing, and incident generation.",
              border: "border-indigo-200 dark:border-indigo-900/60",
              iconBg: "bg-indigo-500/10 text-indigo-500",
              x: 590,
              y: 220,
              width: 190,
              height: 120,
            },
            {
              id: "ai",
              icon: "🤖",
              label: "AI Layer",
              title: "AI Diagnosis",
              desc: "Root cause analysis and infrastructure fix recommendations.",
              border: "border-emerald-200 dark:border-emerald-900/60",
              iconBg: "bg-emerald-500/10 text-emerald-500",
              x: 870,
              y: 40,
              width: 190,
              height: 120,
            },
            {
              id: "notifications",
              icon: "🔔",
              label: "Notifications",
              title: "Alert Channels",
              desc: "Sends to Slack, Teams, Email, WhatsApp, and Webhooks.",
              border: "border-orange-200 dark:border-orange-900/60",
              iconBg: "bg-orange-500/10 text-orange-500",
              x: 870,
              y: 220,
              width: 190,
              height: 120,
            },
            {
              id: "activity",
              icon: "🦀",
              label: "Audit Ledger",
              title: "Rust Activity Service",
              desc: "Ingests and structures organization-wide administrative actions and pipeline audit logs.",
              border: "border-pink-200 dark:border-pink-900/60",
              iconBg: "bg-pink-500/10 text-pink-500",
              x: 870,
              y: 400,
              width: 190,
              height: 120,
            },
          ])}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-sm backdrop-blur-sm"
          title="Reset node positions"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          Refresh Layout
        </button>
      </div>
    </div>
  </div>
</div>
    </div>

    
  );
}