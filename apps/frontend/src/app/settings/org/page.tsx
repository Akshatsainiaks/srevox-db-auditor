"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Database,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  Copy,
  Check,
  Shield,
  Layers,
  Zap,
  Lock,
  EyeOff
} from "lucide-react";
import { apiUpdateMe, apiGetMe, api } from "@/lib/api";
import { getUser, setUser } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { cn, copyToClipboard } from "@/lib/utils";
import SecurityLock from "@/components/settings/SecurityLock";

export default function OrgSettingsPage() {
  const { success, error } = useToast();

  const [orgName, setOrgName] = useState("");
  const [initialOrgName, setInitialOrgName] = useState("");
  const [showOrgOnDashboard, setShowOrgOnDashboard] = useState(true);
  const [initialShowOrgOnDashboard, setInitialShowOrgOnDashboard] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [copiedOrgId, setCopiedOrgId] = useState(false);

  // Danger Zone purge states - tailored for DB Auditor
  const [purgeAction, setPurgeAction] = useState<"events" | "connectors" | "all" | null>(null);
  const [purgePassword, setPurgePassword] = useState("");
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeError, setPurgeError] = useState("");
  const [purgeSuccess, setPurgeSuccess] = useState("");

  useEffect(() => {
    apiGetMe()
      .then((data) => {
        setOrgName(data.org?.name || "");
        setInitialOrgName(data.org?.name || "");
      })
      .catch(console.error);

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("sv_show_org_dashboard");
      if (stored !== null) {
        setShowOrgOnDashboard(stored === "true");
        setInitialShowOrgOnDashboard(stored === "true");
      }
    }
  }, []);

  const saveOrg = async () => {
    if (!orgName.trim()) {
      error("Organization name cannot be empty");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await apiUpdateMe({ org_name: orgName });
      setInitialOrgName(orgName);
      
      const localUser = getUser();
      if (localUser) {
        setUser({
          ...localUser,
          org: localUser.org 
            ? { ...localUser.org, name: orgName } 
            : { org_id: localUser.org_id || "", name: orgName, slug: "" }
        });
      }

      localStorage.setItem("sv_show_org_dashboard", String(showOrgOnDashboard));
      setInitialShowOrgOnDashboard(showOrgOnDashboard);
      
      success("Organization updated successfully");
      setSaved(true);
      setIsEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      error(err?.response?.data?.detail || "Failed to save organization");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setOrgName(initialOrgName);
    setShowOrgOnDashboard(initialShowOrgOnDashboard);
    setIsEditing(false);
  };

  const handleCopyOrgId = async (orgId: string) => {
    await copyToClipboard(orgId);
    setCopiedOrgId(true);
    success("Copied Workspace ID", "Organization identifier copied to clipboard");
    setTimeout(() => setCopiedOrgId(false), 2000);
  };

  const handlePurge = async () => {
    if (!purgePassword) {
      setPurgeError("Please enter your password to confirm.");
      return;
    }
    setPurgeLoading(true);
    setPurgeError("");
    setPurgeSuccess("");
    try {
      await api.post("/api/auth/purge-data", {
        password: purgePassword,
        action: purgeAction,
      });
      success("Data purged successfully");
      setPurgeSuccess("Data purged successfully. This page will now reload.");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setPurgeError(err.response?.data?.detail || "Failed to purge data. Please verify your password.");
      error("Purge authorization failed");
    } finally {
      setPurgeLoading(false);
    }
  };

  const user = getUser();
  const isAdmin = user?.role === "admin";
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center w-full">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`changeSudoLock`) to view organization profile settings.
        </p>
      </div>
    );
  }

  const orgId = user?.org_id || "org_default";

  return (
    <div className="space-y-6 animate-modal-slide-up" style={{ animationDuration: "0.2s" }}>
      {/* Organization Info Card */}
      <div className="card p-6 space-y-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800/60 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shadow-2xs">
              <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">DB Auditor Workspace Profile</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">Manage database audit domain, workspace identity, and dashboard branding</p>
            </div>
          </div>

          {/* Org Identifier Pill */}
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-gray-200/60 dark:border-slate-700/60 text-xs">
            <span className="text-gray-400 text-[11px] font-semibold uppercase">ID:</span>
            <span className="font-mono font-medium text-gray-700 dark:text-slate-300 text-xs">{orgId}</span>
            <button
              onClick={() => handleCopyOrgId(orgId)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Copy Organization ID"
            >
              {copiedOrgId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Organization Name</label>
          <input 
            className="input w-full disabled:opacity-70 disabled:cursor-not-allowed" 
            value={orgName} 
            onChange={(e) => setOrgName(e.target.value)} 
            placeholder="Your organization" 
            disabled={!isEditing || saving}
          />
        </div>

        {/* Show Org Name on Dashboard Preference Toggle */}
        <div className={cn(
          "flex items-center justify-between p-4 bg-gray-50/50 dark:bg-slate-900/30 rounded-2xl border border-gray-150 dark:border-slate-800/60 select-none transition-opacity duration-200",
          (!isEditing || saving) && "opacity-75"
        )}>
          <div>
            <div className="text-xs font-bold text-gray-800 dark:text-slate-200">Show Org on Dashboard</div>
            <div className="text-[10px] text-gray-400 dark:text-slate-550 mt-0.5">Display your organization name badge in the audit overview welcome header</div>
          </div>
          <button
            type="button"
            disabled={!isEditing || saving}
            onClick={() => {
              setShowOrgOnDashboard(!showOrgOnDashboard);
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
              showOrgOnDashboard ? "bg-indigo-600 dark:bg-indigo-500" : "bg-gray-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                showOrgOnDashboard ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="pt-2 flex items-center gap-2">
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)} 
              className="btn-primary min-w-[150px] justify-center py-2.5 cursor-pointer"
            >
              Edit Organization
            </button>
          ) : (
            <>
              <button 
                onClick={saveOrg} 
                disabled={saving || !orgName || (orgName === initialOrgName && showOrgOnDashboard === initialShowOrgOnDashboard)} 
                className="btn-primary min-w-[150px] justify-center py-2.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</>
                  : saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  : "Save Organization"}
              </button>
              <button 
                onClick={handleCancel} 
                disabled={saving} 
                className="py-2.5 px-5 rounded-xl text-xs font-bold border border-gray-300 dark:border-slate-700/80 text-gray-750 dark:text-slate-200 bg-gray-55/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-850 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-40 cursor-pointer"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Active In-Memory Data Redaction Policies (Masking & Security Rules) */}
      <div className="card p-6 space-y-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-slate-800/60">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <EyeOff className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">
              Active In-Memory Data Redaction Policies (Masking & Security Rules)
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Columns matching security patterns below are automatically masked before storing to ClickHouse ledger.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] dark:bg-purple-500/[0.06] space-y-2.5">
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <span>🔒</span> Government & National ID
            </span>
            <p className="text-xs text-gray-600 dark:text-slate-300">
              Target Fields: <code className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded text-[11px]">ssn</code>, <code className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded text-[11px]">tax_id</code>, <code className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded text-[11px]">passport_no</code>
            </p>
            <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-bold block bg-purple-500/10 dark:bg-purple-500/15 p-2 rounded-xl border border-purple-500/20">
              Mask: ***-**-****
            </span>
          </div>

          <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] dark:bg-purple-500/[0.06] space-y-2.5">
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <span>💳</span> Payment Credentials
            </span>
            <p className="text-xs text-gray-600 dark:text-slate-300">
              Target Fields: <code className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded text-[11px]">credit_card</code>, <code className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded text-[11px]">cvv</code>, <code className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded text-[11px]">iban</code>
            </p>
            <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-bold block bg-purple-500/10 dark:bg-purple-500/15 p-2 rounded-xl border border-purple-500/20">
              Mask: ****-****-****-4242
            </span>
          </div>

          <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] dark:bg-purple-500/[0.06] space-y-2.5">
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <span>🔑</span> Security Secrets & Tokens
            </span>
            <p className="text-xs text-gray-600 dark:text-slate-300">
              Target Fields: <code className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded text-[11px]">password_hash</code>, <code className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded text-[11px]">api_token</code>, <code className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded text-[11px]">secret</code>
            </p>
            <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-bold block bg-purple-500/10 dark:bg-purple-500/15 p-2 rounded-xl border border-purple-500/20">
              Mask: [REDACTED]
            </span>
          </div>
        </div>
      </div>

      {/* CDC Architecture Topology */}
      <div className="card p-6 space-y-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-slate-800/60">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">
              Srevox Database Audit CDC Flow & Architecture Topology
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              End-to-end zero-overhead transaction change streaming pipeline architecture.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 space-y-2">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Step 1: Production DB</span>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">Transaction WAL / Binlog</h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              PostgreSQL Logical Decoding & MySQL Binlog stream continuously without locking tables or degrading performance.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 space-y-2">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Step 2: Stream Engine</span>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">Rust CDC Processor</h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              High-performance Rust daemon decodes binary changes and generates SHA-256 record hashes in microseconds.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 space-y-2">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Step 3: Security Layer</span>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">In-Memory PII Masking</h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              Sensitive fields (SSN, Cards, Passwords, Tokens) are redacted in-memory before reaching permanent storage.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 space-y-2">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Step 4: Audit Store</span>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">ClickHouse Ledger</h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              Tamper-proof, immutable ClickHouse audit store provides instant queries, Merkle validation, and field diffs.
            </p>
          </div>
        </div>
      </div>

      {/* DB Auditor Security & Compliance Domain Info */}
      <div className="card p-6 space-y-4 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-slate-800/60">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">CDC Compliance & Security Policies</h3>
            <p className="text-xs text-gray-400 dark:text-slate-500">Operational safeguards and cryptographic assurances</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-slate-200">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Read-Only CDC</span>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-snug">
              Zero database write queries, table alterations, or schema locks.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Merkle Proofs</span>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-snug">
              All audit mutation ledgers cryptographically anchored with SHA-256.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-slate-200">
              <Lock className="w-3.5 h-3.5 text-indigo-500" />
              <span>PII Data Masking</span>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-snug">
              Passwords, secret tokens, and sensitive columns automatically masked.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-slate-200">
              <Database className="w-3.5 h-3.5 text-blue-500" />
              <span>Multi-Engine CDC</span>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-snug">
              PostgreSQL (WAL), MySQL (binlog), Redis, TiDB, ClickHouse supported.
            </p>
          </div>
        </div>
      </div>

      {/* Sudo Security Lock Password Settings */}
      <div id="sudo-security-lock">
        <SecurityLock isAdmin={user?.role === "admin"} />
      </div>

      {/* Danger Zone warning banner */}
      <div className="bg-red-50/50 dark:bg-red-500/[0.03] border border-red-150 dark:border-red-500/25 p-5 rounded-2xl space-y-2 mt-6">
        <h3 className="text-sm font-bold text-red-650 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
          ⚠️ Administrative Danger Zone
        </h3>
        <p className="text-xs text-red-600/90 dark:text-red-400/80 leading-relaxed">
          These actions permanently wipe database change audit records, disconnect active CDC replication slots, or reset all organization ledger data. Please execute them with caution. You will be required to input your account password to authorize any of these actions.
        </p>
      </div>

      {/* Action 1: Purge Audit Events */}
      <div className="card p-6 space-y-4 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Purge All CDC Audit Mutation Records</h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-normal max-w-xl">
              Permanently wipes all historical and live database mutation event logs, row diff snapshots, and WAL change ledgers. Your connected database sources will remain connected and will continue capturing new transactions.
            </p>
          </div>
          <button
            onClick={() => setPurgeAction("events")}
            className="btn-danger text-xs font-semibold py-2.5 px-4 rounded-xl shrink-0 cursor-pointer"
          >
            Purge Audit Records
          </button>
        </div>
      </div>

      {/* Action 2: Disconnect Database Connectors */}
      <div className="card p-6 space-y-4 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Disconnect All Database Connectors</h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-normal max-w-xl">
              Permanently removes all registered database connectors (PostgreSQL, MySQL, Redis, ClickHouse, etc.). This terminates live CDC replication streams, active WAL replication slots, and table schema monitors.
            </p>
          </div>
          <button
            onClick={() => setPurgeAction("connectors")}
            className="btn-danger text-xs font-semibold py-2.5 px-4 rounded-xl shrink-0 cursor-pointer"
          >
            Disconnect Databases
          </button>
        </div>
      </div>

      {/* Action 3: Reset Entire Workspace */}
      <div className="card p-6 space-y-4 bg-white dark:bg-[#13151f] border border-red-250 dark:border-red-500/20 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-650" />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
              Reset Entire DB Auditor Workspace
            </h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-normal max-w-xl">
              Performs a complete wipe of all database connectors, CDC event ledgers, retention policies, notification channels, and audit histories. Your admin account will remain active, but all workspaces will be reset to a clean state.
            </p>
          </div>
          <button
            onClick={() => setPurgeAction("all")}
            className="btn-danger bg-red-600 hover:bg-red-700 text-white border-red-650 hover:border-red-700 text-xs font-bold py-2.5 px-4 rounded-xl shrink-0 cursor-pointer"
          >
            Reset Workspace Data
          </button>
        </div>
      </div>

      {/* Confirmation Purge Modal Overlay */}
      {purgeAction && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/80 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 animate-modal-slide-up" style={{ animationDuration: "0.25s" }}>
            <div className="flex items-center gap-3 text-red-650 dark:text-red-400 pb-2 border-b border-gray-100 dark:border-slate-800/60">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide">Confirm Data Purge</h3>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Authorized Personnel Only</p>
              </div>
            </div>

            <div className="bg-red-50/50 dark:bg-red-500/[0.03] border border-red-100 dark:border-red-500/20 p-3.5 rounded-xl text-xs text-red-700 dark:text-red-400 leading-normal font-semibold">
              {purgeAction === "events" && (
                <><strong>Warning:</strong> You are about to permanently delete all CDC change events and row diff ledgers from your organization. The mutation stream feed will be wiped completely.</>
              )}
              {purgeAction === "connectors" && (
                <><strong>Warning:</strong> You are about to disconnect all database sources. All active WAL replication slots, CDC workers, and schema monitors will be terminated.</>
              )}
              {purgeAction === "all" && (
                <><strong>CRITICAL WARNING:</strong> You are about to reset all organization data. This will purge all database connectors, audit mutation logs, retention rules, and notification channels, returning the workspace to its default blank state.</>
              )}
            </div>

            {purgeError && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-150 dark:border-red-500/20 p-3 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400">
                {purgeError}
              </div>
            )}

            {purgeSuccess && (
              <div className="bg-green-50 dark:bg-green-500/10 border border-green-150 dark:border-green-500/25 p-3 rounded-xl text-xs font-semibold text-green-600 dark:text-green-400">
                {purgeSuccess}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                Enter your password to authorize:
              </label>
              <input
                type="password"
                className="input w-full"
                value={purgePassword}
                onChange={(e) => setPurgePassword(e.target.value)}
                placeholder="••••••••"
                disabled={purgeLoading || !!purgeSuccess}
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPurgeAction(null);
                  setPurgePassword("");
                  setPurgeError("");
                  setPurgeSuccess("");
                }}
                disabled={purgeLoading}
                className="py-2.5 px-5 rounded-xl text-xs font-bold border border-gray-300 dark:border-slate-700/80 text-gray-750 dark:text-slate-200 bg-gray-55/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-850 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-40 flex-1 justify-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurge}
                disabled={purgeLoading || !purgePassword || !!purgeSuccess}
                className="btn-danger bg-red-600 hover:bg-red-700 border-red-650 hover:border-red-700 text-white flex-1 justify-center py-2.5 rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                {purgeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
