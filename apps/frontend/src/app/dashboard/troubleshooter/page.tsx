"use client";

import { useState, useEffect } from "react";
import {
  LifeBuoy,
  AlertTriangle,
  Terminal,
  Check,
  Copy,
  Cpu,
  Network,
  RefreshCw,
  Play,
  Sparkles,
  Bot,
  Zap,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Settings,
  Shield,
  Loader2,
} from "lucide-react";
import Link from "next/link";

export default function TroubleshooterPage() {
  const [pulse, setPulse] = useState(true);
  const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL || "https://srevox-website.vercel.app";

  // Dynamic progress loop simulation for the Coming Soon screen
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6 min-h-[calc(100vh-140px)] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <LifeBuoy className="w-6 h-6 text-indigo-500" />
              Troubleshooter
            </h1>
            <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-500/20 uppercase tracking-wide">
              Feature Preview
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Srevox automated setup and Kubernetes cluster diagnostic bot.
          </p>
        </div>
        <Link href={`${websiteUrl}/docs`} target="_blank" rel="noopener noreferrer" className="btn-secondary gap-1.5 text-xs">
          <BookOpen className="w-3.5 h-3.5" /> Documentation
        </Link>
      </div>

      {/* Futuristic "Coming Soon" Animation Layout */}
      <div className="flex-1 flex items-center justify-center py-10 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] bg-indigo-500/10 dark:bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] bg-indigo-500/10 dark:bg-indigo-600/5 blur-[40px] rounded-full pointer-events-none animate-pulse" />

        <div className="card coming-soon-card max-w-lg w-full p-8 lg:p-10 border border-gray-100 dark:border-slate-800/80 bg-white/90 dark:bg-[#0d0f18]/60 backdrop-blur-xl text-center space-y-6 relative overflow-hidden select-none">
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes pulseBorder {
              0% { border-color: rgba(99,102,241,0.15); box-shadow: 0 0 0 0 rgba(99,102,241,0.05); }
              50% { border-color: rgba(99,102,241,0.4); box-shadow: 0 0 20px 2px rgba(99,102,241,0.08); }
              100% { border-color: rgba(99,102,241,0.15); box-shadow: 0 0 0 0 rgba(99,102,241,0.05); }
            }
            .coming-soon-card {
              animation: pulseBorder 4s infinite ease-in-out;
            }
            @keyframes floatBot {
              0% { transform: translateY(0px) rotate(0deg); }
              50% { transform: translateY(-8px) rotate(-1deg); }
              100% { transform: translateY(0px) rotate(0deg); }
            }
            .floating-bot {
              animation: floatBot 3.5s infinite ease-in-out;
            }
            @keyframes spinOuter {
              to { transform: rotate(360deg); }
            }
            .spinning-ring {
              animation: spinOuter 20s linear infinite;
            }
          `}} />

          {/* Glowing Ring Loader & Bot Icon */}
          <div className="relative w-24 h-24 mx-auto flex items-center justify-center floating-bot">
            {/* Spinning background tracks */}
            <div className="absolute inset-0 rounded-full border border-dashed border-indigo-500/20 spinning-ring" />
            <div className="absolute -inset-1 rounded-full border border-indigo-500/10 dark:border-indigo-500/5 animate-pulse" />

            {/* Glowing Bot Box */}
            <div className="relative w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-500/20 flex items-center justify-center shadow-lg shadow-indigo-500/5">
              <Bot className="w-8 h-8 text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
              {/* Eye pulse indicator */}
              <span className="absolute top-4.5 right-4.5 w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
              <span className="absolute top-4.5 right-4.5 w-1.5 h-1.5 rounded-full bg-green-500" />
            </div>
          </div>

          {/* Text Summary */}
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-xs font-semibold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" /> Coming Soon
            </span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-3">
              AI troubleshooter is under assembly
            </h2>
            <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
              We are compiling signature rules for self-hosted Kubernetes permissions, webhook decryptions, and cluster offline recovery. Check back in the next version.
            </p>
          </div>

          {/* Teaser status console logs */}
          <div className="p-4 rounded-xl border border-gray-55 dark:border-slate-850/60 bg-slate-50/50 dark:bg-[#080a11]/40 font-mono text-[10px] text-left max-w-xs mx-auto space-y-1.5 text-gray-400 dark:text-slate-500">
            <div className="flex justify-between">
              <span>Offline Database</span>
              <span className="text-green-500 font-bold">READY</span>
            </div>
            <div className="flex justify-between">
              <span>Signature Parser</span>
              <span className="text-green-500 font-bold">READY</span>
            </div>
            <div className="flex justify-between">
              <span>Resolution Manifests</span>
              <span className="text-green-500 font-bold">READY</span>
            </div>
            <div className="flex justify-between">
              <span>Troubleshooter Bot</span>
              <span className="text-indigo-500 font-bold flex items-center gap-1">
                COMPILING{dots}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Teaser Footer link */}
      <div className="py-4 border-t border-gray-100 dark:border-slate-800/80 text-center text-[11px] text-gray-400 dark:text-slate-500 font-semibold select-none">
        Srevox Observability Suite
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ─── Commented Bot Implementation Code ────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
/*
interface ErrorRule {
  id: string;
  name: string;
  category: string;
  pattern: RegExp;
  title: string;
  description: string;
  symptoms: string[];
  fix: string;
  commands?: { label: string; cmd: string }[];
  yaml?: { filename: string; content: string };
}

const ERROR_KB: ErrorRule[] = [
  {
    id: "k8s-rbac",
    name: "K8s RBAC stream forbidden",
    category: "Kubernetes Agent",
    pattern: /forbidden|cannot watch resource|User .* cannot watch/i,
    title: "Kubernetes Agent RBAC Permission Forbidden",
    description: "The Srevox Agent is running inside the cluster but lacks permission to get, list, and watch resources like pods, events, and nodes.",
    symptoms: [
      "Agent logs show stream error (ns=\"\"): pods is forbidden",
      "No incidents are reporting in the Srevox dashboard",
      "Agent stays in 'disconnected' state",
    ],
    fix: "Apply a ClusterRole and a ClusterRoleBinding to grant the srevox-agent ServiceAccount read-only permissions across the cluster scope.",
    commands: [
      { label: "Verify permissions", cmd: "kubectl auth can-i watch pods --as=system:serviceaccount:kube-system:srevox-agent -n default" },
      { label: "Restart deployment", cmd: "kubectl rollout restart deployment/srevox-agent -n kube-system" },
    ],
    yaml: {
      filename: "srevox-agent-rbac.yaml",
      content: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: srevox-agent
rules:
  - apiGroups: [""]
    resources: ["pods", "nodes", "namespaces", "services", "endpoints", "persistentvolumes", "persistentvolumeclaims", "events"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets", "statefulsets", "daemonsets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: srevox-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: srevox-agent
subjects:
  - kind: ServiceAccount
    name: srevox-agent
    namespace: kube-system`,
    },
  },
  {
    id: "dns-resolution",
    name: "Agent DNS / API Service Unreachable",
    category: "Kubernetes Agent",
    pattern: /lookup srevox-api|no such host|dial tcp: lookup|connection refused.*srevox-api/i,
    title: "Agent DNS Resolution / API Service Unreachable",
    description: "The agent is attempting to report metrics back to the Srevox API at http://srevox-api:4000 but cannot resolve the DNS name or connect to the host.",
    symptoms: [
      "Agent logs show 'Heartbeat failed: dial tcp: lookup srevox-api: no such host'",
      "Agent fails to connect to API on port 4000",
      "Cluster showing 'disconnected' status in frontend dashboard",
    ],
    fix: "Expose the Srevox API via a Kubernetes Service if the agent runs in-cluster. Alternatively, update the API_URL environment variable on the agent's deployment to point to your public-facing API address.",
    commands: [
      { label: "Check API services", cmd: "kubectl get svc -n kube-system" },
      { label: "Check agent env vars", cmd: "kubectl describe deployment/srevox-agent -n kube-system | grep -E 'REDIS_URL|CLUSTER_ID|AGENT_TOKEN'" },
    ],
  },
  {
    id: "decryption-mismatch",
    name: "Decryption / Webhook Invalid URL error",
    category: "Alerting Pipeline",
    pattern: /TypeError \\[ERR_INVALID_URL\\]: Invalid URL|Invalid encrypted value|decipher\\.final|decryption failed/i,
    title: "Alert Channel Encryption Key Mismatch",
    description: "The Alert Worker is attempting to decrypt your alert channel credentials (e.g. Webhook URL) from the database, but decryption failed, yielding empty configs and causing invalid URL errors.",
    symptoms: [
      "Alert worker logs throw TypeError [ERR_INVALID_URL]: Invalid URL",
      "Test channel alerts succeed from settings but live alerts fail",
      "Channel state updates with decryption errors",
    ],
    fix: "Verify that the ENCRYPTION_KEY environment variable in your alert-worker .env file is exactly 32 characters long and matches the ENCRYPTION_KEY configured in your API server's .env.",
    commands: [
      { label: "Verify key length", cmd: "echo -n $ENCRYPTION_KEY | wc -c" },
    ],
  },
  {
    id: "ai-schema-mismatch",
    name: "AI Postgres column ID mismatch",
    category: "AI Service",
    pattern: /PostgresError: column "id" does not exist|column .* does not exist.*incidents/i,
    title: "AI Service Database Schema ID Mismatch",
    description: "The Python AI service is attempting to query the incidents table using the column 'id', which does not exist in the schema (the actual primary key column name is 'incident_id').",
    symptoms: [
      "AI Diagnosis fails with a red popup alert",
      "Python logs show PostgresError: column 'id' does not exist",
    ],
    fix: "Update the database queries in ai_service.py (located in apps/backend/ai_service.py) to filter and update using 'incident_id' instead of 'id'.",
    commands: [
      { label: "Search ID in AI code", cmd: "grep -n \"id =\" apps/backend/ai_service.py" },
    ],
  },
  {
    id: "uuid-mismatch",
    name: "Postgres UUID syntax mismatch",
    category: "Database & API",
    pattern: /invalid input syntax for type uuid|type uuid.*clsj/i,
    title: "Postgres Resource Alerts UUID Mismatch",
    description: "The resource_alerts table's cluster_id column was defined as UUID, but Srevox cluster identifiers are custom text string hashes (e.g. clsjx...).",
    symptoms: [
      "Requests to /api/resource-alerts return 500 Internal Server Error",
      "Database logs show invalid input syntax for type uuid: 'clsjx...'",
    ],
    fix: "Convert the column type of cluster_id from UUID to TEXT so it matches the string format used throughout the Srevox platform.",
    commands: [
      { label: "Apply DB Alter", cmd: "psql -U srevox -d srevox -c \"ALTER TABLE resource_alerts ALTER COLUMN cluster_id TYPE TEXT USING cluster_id::text;\"" },
    ],
  },
  {
    id: "smtp-auth-failed",
    name: "SMTP Auth or Connection Failure",
    category: "Alerting Pipeline",
    pattern: /SMTP.*Authentication|smtp.*failed|Mail.*auth|greeting never received/i,
    title: "SMTP Authentication or Connection Failed",
    description: "The SMTP server rejected the username/password combination or the connection timed out.",
    symptoms: [
      "Email notifications fail to send",
      "Worker logs show SMTP login failed or connection timed out",
    ],
    fix: "If you are using Gmail, make sure you have generated and are using a Google App Password instead of your master email password. Also verify port configurations (587 for TLS, 465 for SSL) in your .env.",
  },
  {
    id: "redis-conn-refused",
    name: "Redis connection refused",
    category: "Infrastructure",
    pattern: /ECONNREFUSED.*6379|Redis connection.*failed/i,
    title: "Redis Connection Refused",
    description: "The application is unable to connect to the Redis instance at port 6379.",
    symptoms: [
      "API or alert worker crashed on startup",
      "Worker logs show ECONNREFUSED redis",
    ],
    fix: "Verify that the Redis service container is running or launch it manually using docker compose.",
    commands: [
      { label: "Check running containers", cmd: "docker compose ps" },
      { label: "Start Redis container", cmd: "docker compose up -d redis" },
    ],
  },
];
*/
