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
      title: "Incidents",
      rules: [
        { key: "viewIncidents", desc: "Read and list open/resolved incident crash events." },
        { key: "acknowledgeIncident", desc: "Claim ownership of active incidents to notify team." },
        { key: "resolveIncident", desc: "Mark incident crashes as resolved when fixed." },
        { key: "runDiagnosis", desc: "View pod logs and trigger AI assistant diagnostic analysis." },
        { key: "deleteIncident", desc: "Permanently delete incident history from the database." }
      ]
    },
    {
      title: "Clusters",
      rules: [
        { key: "viewClusters", desc: "List Kubernetes clusters and inspect node/pod health status." },
        { key: "addCluster", desc: "Register new Kubernetes clusters or edit connection credentials." },
        { key: "deleteCluster", desc: "Permanently remove cluster configurations." }
      ]
    },
    {
      title: "Channels",
      rules: [
        { key: "viewChannels", desc: "List Slack, Email, and webhook notification delivery channels." },
        { key: "addChannel", desc: "Create new channels or edit webhook endpoints." },
        { key: "deleteChannel", desc: "Permanently delete alert integration channels." },
        { key: "testChannel", desc: "Trigger test alert notifications to verify integrations." }
      ]
    },
    {
      title: "Alert Rules",
      rules: [
        { key: "viewRules", desc: "View cluster alerting policies." },
        { key: "addRule", desc: "Create, edit, or mute/unmute alert rules." },
        { key: "deleteRule", desc: "Permanently delete alert rules." },
        { key: "toggleRule", desc: "Quickly enable or disable specific alert rules." }
      ]
    },
    {
      title: "Team & Access Control",
      rules: [
        { key: "viewTeam", desc: "View list of organization team members." },
        { key: "inviteUser", desc: "Send organization invites to new users." },
        { key: "removeUser", desc: "Revoke organization access from members." },
        { key: "changeRole", desc: "Update user roles and configure custom permissions overrides." },
        { key: "changeSudoLock", desc: "Modify the organization-wide Sudo Security Lock passcode." },
        { key: "viewApiDocs", desc: "Access API credentials, REST endpoints, and developer documentation." }
      ]
    },
    {
      title: "Service Routing",
      rules: [
        { key: "viewServiceOwners", desc: "Read and list service owner routing rules." },
        { key: "addServiceOwner", desc: "Create, assign, or edit service routing settings." },
        { key: "deleteServiceOwner", desc: "Remove service owner routing assignments." }
      ]
    },
    {
      title: "Machines & Host Nodes",
      rules: [
        { key: "viewMachines", desc: "Read and list Linux machine telemetry and system metrics." },
        { key: "addMachine", desc: "Generate agent installation tokens and connect host nodes." },
        { key: "deleteMachine", desc: "Remove machine monitors and disconnect agent telemetry." }
      ]
    },
    {
      title: "Analytics & System",
      rules: [
        { key: "viewAnalytics", desc: "Access high-level crash reports and historical metrics charts." },
        { key: "viewActivityLog", desc: "Access platform-wide security audit logs and event traces." },
        { key: "changeRetention", desc: "Manage database retention purge intervals for audit ledgers and crash logs." },
        { key: "systemAlerts", desc: "Configure organization-wide system alert routing and event triggers." }
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
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Permissions & Precedence Guide</h3>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Rules, priorities, and capabilities reference catalog for Srevox</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-400 hover:text-gray-655 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs Selector */}
        <div className="flex border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/10 shrink-0 select-none p-1">
          {[
            { id: "precedence", label: "Resolution Precedence", desc: "How Srevox merges user overrides and group permissions." },
            { id: "scenarios", label: "Example Scenarios", desc: "Interactive examples of additive permissions evaluation." },
            { id: "catalog", label: "Permissions Catalog", desc: "Explanation of what each custom permission key allows." }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 border ${
                activeTab === tab.id
                  ? "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-indigo-655 dark:text-indigo-400"
                  : "border-transparent text-gray-400 dark:text-slate-550 hover:text-gray-650 dark:hover:text-slate-355"
              }`}
            >
              <span className="text-xs font-bold">{tab.label}</span>
              <span className="text-[9px] font-normal opacity-70 hidden sm:inline">{tab.desc}</span>
            </button>
          ))}
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
          
          {/* TAB 1: RESOLUTION PRECEDENCE */}
          {activeTab === "precedence" && (
            <div className="space-y-5 leading-relaxed">
              <div className="bg-indigo-500/[0.02] border border-dashed border-indigo-500/15 rounded-2xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-gray-800 dark:text-slate-200">Precedence Rule: Additive (Logical OR) Model</span>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500">
                    Srevox evaluates permissions by taking the union of direct user overrides and all associated group permissions. User custom overrides do not block group-inherited permissions, nor do groups override direct user configurations.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-150 dark:border-slate-800/80 p-4 rounded-2xl space-y-2.5">
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-indigo-500" />
                    How Overrides Merge
                  </h4>
                  <p className="text-gray-550 dark:text-slate-400 text-[11px]">
                    Direct User custom overrides and User Group permissions are combined together using a <strong>logical OR</strong> model. If a permission is enabled anywhere (either at user level OR group level), it is granted:
                  </p>
                  <pre className="bg-gray-50 dark:bg-slate-900 p-3 rounded-lg font-mono text-[10px] text-indigo-600 dark:text-indigo-400 border border-gray-100 dark:border-slate-800/60 leading-normal">
                    Effective = User Override OR Group 1 OR Group 2...
                  </pre>
                  <p className="text-gray-550 dark:text-slate-500 text-[10px] leading-normal">
                    Srevox does not have negative deny capabilities. Permissions are strictly additive.
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
                    <li><strong>Member:</strong> Access to view infrastructure, read metrics, and acknowledge incidents.</li>
                    <li><strong>Viewer:</strong> Strictly read-only access to cluster/service telemetry status.</li>
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
                      <div>Group A: <span className="text-emerald-500 font-bold">deleteIncident = TRUE</span></div>
                      <div>Group B: <span className="text-gray-400">deleteIncident = FALSE</span></div>
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
                      <div>Group A: <span className="text-gray-400">resolveIncident = FALSE</span></div>
                      <div>Group B: <span className="text-gray-400">resolveIncident = FALSE</span></div>
                      <div>User Override: <span className="text-emerald-500 font-bold">resolveIncident = TRUE</span></div>
                    </div>
                    <div className="bg-indigo-50/40 dark:bg-indigo-950/10 p-3 rounded-xl border border-indigo-100/40 dark:border-indigo-900/20 space-y-1">
                      <span className="font-bold text-indigo-650 dark:text-indigo-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        Granted: TRUE
                      </span>
                      <p className="text-gray-550 dark:text-slate-500 text-[10px] leading-normal">Even though no group grants resolveIncident, the direct User custom override explicitly enables it.</p>
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
