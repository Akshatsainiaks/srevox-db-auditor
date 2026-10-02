"use client";

import { useState } from "react";
import {
  BookOpen, X, Shield, Users, CheckCircle, Info
} from "lucide-react";

interface PermissionsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PermissionsGuideModal({
  isOpen,
  onClose
}: PermissionsGuideModalProps) {
  const [activeTab, setActiveTab] = useState<"precedence" | "scenarios" | "catalog">("precedence");

  if (!isOpen) return null;

  const catalog = [
    {
      title: "Database Connectors & CDC Streams",
      rules: [
        { key: "viewConnectors", desc: "List connected database clusters, replication slots, and health status." },
        { key: "addConnector", desc: "Register new database connections or update connection credentials." },
        { key: "deleteConnector", desc: "Remove database connectors and terminate WAL replication stream." },
        { key: "testConnector", desc: "Send ping tests to database endpoints and inspect replication latency." },
        { key: "viewStream", desc: "Access real-time WAL event feeds, SSE streams, and change ledgers." }
      ]
    },
    {
      title: "Audit Ledgers & Row Diffs",
      rules: [
        { key: "viewRowDiff", desc: "Compare column before/after diffs across database tables." },
        { key: "viewPii", desc: "Inspect unmasked values for SSN, credit cards, and secrets." },
        { key: "exportAudit", desc: "Download signed audit reports in CSV and JSON formats." },
        { key: "purgeAudit", desc: "Trigger immediate manual purge of historical audit records." }
      ]
    },
    {
      title: "Data Retention & Storage",
      rules: [
        { key: "changeRetention", desc: "Configure automated purge windows for CDC mutation ledgers and logs." },
        { key: "clearRetentionHistory", desc: "Clear purge execution run history logs." }
      ]
    },
    {
      title: "Masking & Compliance Rules",
      rules: [
        { key: "viewMaskingRules", desc: "Inspect active in-memory PII redaction and column masking rules." },
        { key: "manageMaskingRules", desc: "Create, edit, or delete sensitive column regex masking triggers." }
      ]
    },
    {
      title: "Notification Channels & Alerts",
      rules: [
        { key: "viewChannels", desc: "List Slack, Teams, Email, and Webhook notification channels." },
        { key: "addChannel", desc: "Register new notification channels or update webhook endpoints." },
        { key: "deleteChannel", desc: "Permanently delete configured notification channels." },
        { key: "testChannel", desc: "Send simulated audit alert payloads through integrations." }
      ]
    },
    {
      title: "Team & Access Control",
      rules: [
        { key: "viewTeam", desc: "View organization members and assigned role permissions." },
        { key: "inviteUser", desc: "Send organization invites with assigned access roles." },
        { key: "removeUser", desc: "Revoke organization access from members." },
        { key: "changeRole", desc: "Update user roles and granular custom permissions." },
        { key: "changeSudoLock", desc: "Modify organization-wide Sudo Security Lock passcode." }
      ]
    },
    {
      title: "Analytics & System Logs",
      rules: [
        { key: "viewAnalytics", desc: "Access high-level mutation frequency and audit metrics." },
        { key: "viewActivityLog", desc: "Access platform security audit traces and admin logs." }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800/80 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs animate-fade-in">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">RBAC Permissions & Evaluation Guide</h3>
              <p className="text-gray-400 dark:text-slate-500 text-xs">Understand how granular permissions evaluate and interact with roles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-gray-200 dark:border-slate-800 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Subnav */}
        <div className="flex border-b border-gray-150 dark:border-slate-800 px-6 shrink-0 bg-gray-55/50 dark:bg-slate-900/20">
          <button
            onClick={() => setActiveTab("precedence")}
            className={`py-3 px-4 font-bold border-b-2 transition-all ${
              activeTab === "precedence"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
            }`}
          >
            1. Evaluation Precedence
          </button>
          <button
            onClick={() => setActiveTab("scenarios")}
            className={`py-3 px-4 font-bold border-b-2 transition-all ${
              activeTab === "scenarios"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
            }`}
          >
            2. Additive Logic & Scenarios
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`py-3 px-4 font-bold border-b-2 transition-all ${
              activeTab === "catalog"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
            }`}
          >
            3. Full Rule Catalog
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: EVALUATION PRECEDENCE */}
          {activeTab === "precedence" && (
            <div className="space-y-4">
              <div className="bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-gray-900 dark:text-white text-xs">Hierarchy of Permission Evaluation</span>
                  <p className="text-gray-550 dark:text-slate-400 leading-relaxed text-[11px]">
                    Srevox DB Auditor uses an additive 3-tier precedence engine to determine whether an action is allowed for any user.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/10 p-4 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 font-bold text-[10px] uppercase">
                      Tier 1 · Top Priority
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-indigo-500" />
                    User Overrides
                  </h4>
                  <p className="text-gray-550 dark:text-slate-400 text-[11px] leading-relaxed">
                    Granular permissions explicitly toggled on the individual user's profile take absolute priority over group policies and role defaults.
                  </p>
                </div>

                <div className="border border-gray-150 dark:border-slate-800/80 p-4 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 font-bold text-[10px] uppercase">
                      Tier 2 · Additive
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Group Memberships
                  </h4>
                  <p className="text-gray-550 dark:text-slate-400 text-[11px] leading-relaxed">
                    Permissions configured across all groups the user belongs to are merged together using an **additive OR model** (granting in one group grants access).
                  </p>
                </div>

                <div className="border border-gray-150 dark:border-slate-800/80 p-4 rounded-2xl space-y-2.5">
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Role Default Fallback
                  </h4>
                  <p className="text-gray-550 dark:text-slate-400 text-[11px]">
                    If a user has **no custom overrides** (meaning both their user-level custom permissions and all group-level permissions are empty/null):
                  </p>
                  <ul className="space-y-1.5 text-[10.5px] text-gray-500 dark:text-slate-400 pl-4 list-disc leading-normal">
                    <li><strong>Admin:</strong> Inherits root/unlocked access to all platform features.</li>
                    <li><strong>Member:</strong> Access to view audit streams, inspect column diffs, and export reports.</li>
                    <li><strong>Viewer:</strong> Strictly read-only access to mutation ledgers and metrics.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXAMPLE SCENARIOS */}
          {activeTab === "scenarios" && (
            <div className="space-y-4">
              <div className="border border-gray-150 dark:border-slate-800/80 rounded-2xl overflow-hidden">
                <div className="bg-gray-55/40 dark:bg-slate-900/35 border-b border-gray-100 dark:border-slate-800 p-4">
                  <span className="font-bold text-gray-900 dark:text-white">Additive Evaluation Scenarios</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-800/60 text-[11px] leading-relaxed">
                  
                  {/* Scenario 1 */}
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <span className="font-bold text-gray-800 dark:text-white">Scenario 1</span>
                      <p className="text-gray-400 dark:text-slate-500 text-[10.5px]">User belongs to multiple groups with conflicting rules.</p>
                    </div>
                    <div className="space-y-1 text-gray-650 dark:text-slate-405 font-mono">
                      <div>Group A: <span className="text-emerald-500 font-bold">exportAudit = TRUE</span></div>
                      <div>Group B: <span className="text-gray-400">exportAudit = FALSE</span></div>
                      <div>User Override: <span className="text-gray-400">No Override</span></div>
                    </div>
                    <div className="bg-indigo-50/40 dark:bg-indigo-950/10 p-3 rounded-xl border border-indigo-100/40 dark:border-indigo-900/20 space-y-1">
                      <span className="font-bold text-indigo-650 dark:text-indigo-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        Granted: TRUE
                      </span>
                      <p className="text-gray-500 dark:text-slate-500 text-[10px] leading-normal">Since Group A grants the permission, the effective result is TRUE (additive OR logic).</p>
                    </div>
                  </div>

                  {/* Scenario 2 */}
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <span className="font-bold text-gray-800 dark:text-white">Scenario 2</span>
                      <p className="text-gray-400 dark:text-slate-500 text-[10.5px]">User override overrides group restrictions.</p>
                    </div>
                    <div className="space-y-1 text-gray-655 dark:text-slate-405 font-mono">
                      <div>Group A: <span className="text-gray-400">purgeAudit = FALSE</span></div>
                      <div>Group B: <span className="text-gray-400">purgeAudit = FALSE</span></div>
                      <div>User Override: <span className="text-emerald-500 font-bold">purgeAudit = TRUE</span></div>
                    </div>
                    <div className="bg-indigo-50/40 dark:bg-indigo-950/10 p-3 rounded-xl border border-indigo-100/40 dark:border-indigo-900/20 space-y-1">
                      <span className="font-bold text-indigo-650 dark:text-indigo-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        Granted: TRUE
                      </span>
                      <p className="text-gray-550 dark:text-slate-500 text-[10px] leading-normal">Even though no group grants purgeAudit, the direct User custom override explicitly enables it.</p>
                    </div>
                  </div>

                  {/* Scenario 3 */}
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <span className="font-bold text-gray-800 dark:text-white">Scenario 3</span>
                      <p className="text-gray-400 dark:text-slate-500 text-[10.5px]">Standard fallback defaults.</p>
                    </div>
                    <div className="space-y-1 text-gray-655 dark:text-slate-405 font-mono">
                      <div>Group Memberships: <span className="text-gray-400">None</span></div>
                      <div>User Override: <span className="text-gray-400">None</span></div>
                      <div>User Default Role: <span className="text-indigo-550 dark:text-indigo-400 font-bold">member</span></div>
                    </div>
                    <div className="bg-indigo-50/40 dark:bg-indigo-950/10 p-3 rounded-xl border border-indigo-100/40 dark:border-indigo-900/20 space-y-1">
                      <span className="font-bold text-indigo-655 dark:text-indigo-450 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        Role Defaults Apply
                      </span>
                      <p className="text-gray-550 dark:text-slate-500 text-[10px] leading-normal">With zero custom override settings, Srevox falls back directly to the user's role capabilities (Member).</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PERMISSIONS CATALOG */}
          {activeTab === "catalog" && (
            <div className="space-y-4">
              {catalog.map((cat, idx) => (
                <div key={idx} className="border border-gray-150 dark:border-slate-800/85 rounded-2xl overflow-hidden animate-fade-in">
                  <div className="bg-gray-55/40 dark:bg-slate-900/35 border-b border-gray-100 dark:border-slate-800 p-3 font-bold text-gray-900 dark:text-white">
                    {cat.title}
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cat.rules.map((rule, rIdx) => (
                      <div key={rIdx} className="bg-slate-50 dark:bg-[#0c0d12]/30 border border-gray-100 dark:border-slate-800/60 p-3 rounded-xl space-y-1">
                        <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 block">{rule.key}</span>
                        <p className="text-[10px] text-gray-500 dark:text-slate-500 leading-normal">{rule.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-55/40 dark:bg-slate-900/10 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="btn-primary text-xs py-2 px-5 font-semibold"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
}
