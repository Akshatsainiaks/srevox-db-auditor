"use client";
import { useEffect, useState, useRef } from "react";
import { 
  Shield, Lock, Check, RotateCcw, AlertTriangle, Crown, 
  Eye, User, Settings, Info, X, ChevronRight, CheckCircle2, RefreshCw,
  Plus, Trash2, Users, Search, BookOpen, ShieldCheck
} from "lucide-react";
import { api } from "@/lib/api";
import { getUser, hasPermission, refreshUser, CAN, PERMISSION_IDS } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { createPortal } from "react-dom";
import PermissionsGuideModal from "@/components/settings/PermissionsGuideModal";

interface Member {
  user_id: string;
  email: string;
  full_name?: string;
  role: string;
  permissions?: any;
  effective_permissions?: any;
  groups?: { group_id: string; name: string }[];
  is_active: boolean;
  created_at: string;
}

interface Group {
  group_id: string;
  name: string;
  description: string;
  permissions: any;
  created_at: string;
  member_count: number;
  members: {
    user_id: string;
    email: string;
    full_name?: string;
    role: string;
  }[];
}

const CATEGORIES = [
  {
    title: "Database Connectors & CDC Streams",
    permissions: [
      { key: "viewConnectors", label: "View Databases & Connectors", desc: "List connected database clusters, replication slots, and health status" },
      { key: "addConnector", label: "Connect & Edit Databases", desc: "Register new database connections or update connection credentials" },
      { key: "deleteConnector", label: "Disconnect Databases", desc: "Remove database connectors and terminate WAL replication stream" },
      { key: "testConnector", label: "Test Connection Health", desc: "Send ping tests to database endpoints and inspect replication latency" },
      { key: "viewStream", label: "View Live CDC Stream", desc: "Access real-time WAL event feeds, SSE streams, and change ledgers" },
    ]
  },
  {
    title: "Audit Ledgers & Row Diffs",
    permissions: [
      { key: "viewRowDiff", label: "Inspect Row Mutations", desc: "Compare column before/after diffs across database tables" },
      { key: "viewPii", label: "View Sensitive PII Fields", desc: "Inspect unmasked values for SSN, credit cards, and secrets" },
      { key: "exportAudit", label: "Export Compliance Ledgers", desc: "Download signed audit reports in CSV and JSON formats" },
      { key: "purgeAudit", label: "Manual Database Purge", desc: "Trigger immediate manual purge of historical audit records" },
    ]
  },
  {
    title: "Data Retention & Storage",
    permissions: [
      { key: "changeRetention", label: "Data Retention Policies", desc: "Configure automated purge windows for CDC mutation ledgers and logs" },
      { key: "clearRetentionHistory", label: "Clear Run History", desc: "Clear purge execution run history logs" },
    ]
  },
  {
    title: "Masking & Compliance Rules",
    permissions: [
      { key: "viewMaskingRules", label: "View Masking Policies", desc: "Inspect active in-memory PII redaction and column masking rules" },
      { key: "manageMaskingRules", label: "Configure Masking Rules", desc: "Create, edit, or delete sensitive column regex masking triggers" },
    ]
  },
  {
    title: "Notification Channels & Alerts",
    permissions: [
      { key: "viewChannels", label: "View Alert Channels", desc: "List Slack, Teams, Email, and Webhook notification channels" },
      { key: "addChannel", label: "Add & Edit Channels", desc: "Register new notification channels or update webhook endpoints" },
      { key: "deleteChannel", label: "Delete Alert Channels", desc: "Permanently delete configured notification channels" },
      { key: "testChannel", label: "Test Channel Delivery", desc: "Send simulated audit alert payloads through integrations" },
    ]
  },
  {
    title: "Team & Access Control",
    permissions: [
      { key: "viewTeam", label: "View Team Directory", desc: "View organization members and assigned role permissions" },
      { key: "inviteUser", label: "Invite Team Members", desc: "Send organization invites with assigned access roles" },
      { key: "removeUser", label: "Remove Members", desc: "Revoke organization access from members" },
      { key: "changeRole", label: "Modify Roles & Overrides", desc: "Update user roles and granular custom permissions" },
      { key: "changeSudoLock", label: "Sudo Security Passcode", desc: "Modify organization-wide Sudo Security Lock passcode" },
      { key: "viewApiDocs", label: "API Credentials & Docs", desc: "Access CDC ingestion credentials, endpoints, and docs" },
    ]
  },
  {
    title: "Analytics & System Logs",
    permissions: [
      { key: "viewAnalytics", label: "View Analytics & Metrics", desc: "Access high-level mutation frequency and audit metrics" },
      { key: "viewActivityLog", label: "View System Activity Logs", desc: "Access platform security audit traces and admin logs" },
          ]
  }
];

export default function GroupsPage() {
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<Member[]>([]);
  const [showGuideModal, setShowGuideModal] = useState(false);
  
  // Groups States
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  
  // Group Drawer local States
  const [groupDrawerTab, setGroupDrawerTab] = useState<"permissions" | "members">("permissions");
  const [groupPermissions, setGroupPermissions] = useState<Record<string, any>>({});
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupSearchMember, setGroupSearchMember] = useState("");
  const [savingGroupSettings, setSavingGroupSettings] = useState(false);
  
  // Create Group Modal State
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const me = getUser();
  const { success, error } = useToast();
  const [authorized, setAuthorized] = useState(true);
  const toastShownRef = useRef(false);

  const loadUsers = () => {
    api.get("/api/users")
      .then(r => {
        setUsers(r.data.users || []);
      })
      .catch(err => {
        console.error(err);
      });
  };

  const loadGroups = (quiet = false) => {
    if (!quiet) setLoadingGroups(true);
    api.get("/api/groups")
      .then(r => {
        setGroups(r.data.groups || []);
        setAuthorized(true);
      })
      .catch(err => {
        console.error(err);
        if (err.response?.status === 403) {
          setAuthorized(false);
          if (!toastShownRef.current) {
            error("Access restricted: Only administrators can configure user roles and permissions.");
            toastShownRef.current = true;
          }
        } else {
          error("Failed to load user groups");
        }
      })
      .finally(() => {
        if (!quiet) setLoadingGroups(false);
      });
  };

  useEffect(() => {
    setMounted(true);
    const me = getUser();
    if (!hasPermission(me, "changeRole")) {
      setAuthorized(false);
      setLoadingGroups(false);
      if (!toastShownRef.current) {
        error("Permission Required: You do not have permission to configure user groups.");
        toastShownRef.current = true;
      }
      return;
    }
    loadGroups(false);
    loadUsers();
  }, []);

  // Sync group drawer state
  useEffect(() => {
    if (selectedGroup) {
      setGroupPermissions({ ...selectedGroup.permissions });
      setGroupMembers((selectedGroup.members || []).map(m => m.user_id));
      setGroupSearchMember("");
    }
  }, [selectedGroup]);

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`changeRole`) to configure user groups.
        </p>
      </div>
    );
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      error("Group name is required");
      return;
    }
    const dup = groups.find(g => g.name.trim().toLowerCase() === newGroupName.trim().toLowerCase());
    if (dup) {
      error("A group with this name already exists");
      return;
    }
    setCreatingGroup(true);
    try {
      await api.post("/api/groups", { name: newGroupName, description: newGroupDesc });
      success("Group created successfully");
      setNewGroupName("");
      setNewGroupDesc("");
      setShowCreateGroupModal(false);
      loadGroups();
    } catch (err: any) {
      error(err.response?.data?.detail || "Failed to create group");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleSaveGroupSettings = async () => {
    if (!selectedGroup) return;
    setSavingGroupSettings(true);
    try {
      // Save group permissions
      await api.patch(`/api/groups/${selectedGroup.group_id}`, {
        name: selectedGroup.name,
        description: selectedGroup.description,
        permissions: groupPermissions
      });
      
      // Save group members
      await api.post(`/api/groups/${selectedGroup.group_id}/members`, {
        user_ids: groupMembers
      });

      success("Group settings updated successfully");
      setSelectedGroup(null);
      loadGroups();
      await refreshUser();
    } catch (err: any) {
      error(err.response?.data?.detail || "Failed to update group settings");
    } finally {
      setSavingGroupSettings(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await api.delete(`/api/groups/${groupId}`);
      success("Group deleted successfully");
      loadGroups();
    } catch (err: any) {
      error(err.response?.data?.detail || "Failed to delete group");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 p-5 rounded-2xl shadow-sm flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            User Groups Manager
          </h1>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Manage workspace user groups and configure shared permissions to simplify access control for multiple team members at once.
          </p>
        </div>
        <div className="flex items-center gap-2 select-none">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="btn-secondary flex items-center gap-1.5 text-[10px] py-1.5 px-3 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 hover:bg-gray-50 dark:hover:bg-slate-900/20 text-gray-600 dark:text-slate-350 transition-colors font-bold shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
            Permission Guide
          </button>
          <button
            onClick={() => {
              loadGroups(false);
              loadUsers();
            }}
            className="btn-secondary py-1.5 px-3.5 text-xs font-semibold gap-1.5 inline-flex items-center shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-md w-full select-none">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-gray-400" />
        </div>
        <input
          id="groups-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search groups by name or description..."
          className="input pl-9 pr-8 w-full py-2 text-xs"
        />
        {searchQuery && (
          <button 
            type="button" 
            onClick={() => setSearchQuery("")} 
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-655 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* User Groups View */}
      <div id="groups-list" className="space-y-4">
        <div className="flex items-center justify-between select-none">
          <p className="text-xs text-gray-550 dark:text-slate-400 leading-normal max-w-2xl">
            Create and manage User Groups to simplify team access configurations. Users added to a group inherit its permissions overrides automatically.
          </p>
          <button
            id="create-group-btn"
            onClick={() => setShowCreateGroupModal(true)}
            className="btn-primary py-1.5 px-4 text-xs font-bold flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create User Group
          </button>
        </div>

        {loadingGroups ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-100 dark:bg-slate-800/10 border border-gray-150 dark:border-slate-800/50 h-[70px] rounded-2xl" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="border border-dashed border-gray-250 dark:border-slate-800 rounded-3xl py-12 px-4 text-center select-none">
            <Shield className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="font-semibold text-gray-900 dark:text-white text-sm">No User Groups Configured</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              Group together users to grant access to multiple teammates simultaneously.
            </p>
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="btn-primary py-1.5 px-4 text-xs font-bold mt-4 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Create First Group
            </button>
          </div>
        ) : (() => {
          const filteredGroups = groups.filter(g => 
            g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (g.description || "").toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (filteredGroups.length === 0) {
            return (
              <div className="border border-dashed border-gray-250 dark:border-slate-800 rounded-3xl py-12 px-4 text-center select-none">
                <Shield className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="font-semibold text-gray-950 dark:text-white text-sm">No Matching Groups Found</p>
                <p className="text-xs text-gray-450 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                  Try adjusting your search terms or clear the filter.
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {filteredGroups.map((g) => (
                <div 
                  key={g.group_id}
                  className="bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm hover:border-indigo-500/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-100/40 dark:border-indigo-500/10 mt-0.5">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">
                        {g.name}
                      </h3>
                      <p className="text-xs text-gray-400 dark:text-slate-500 leading-normal truncate max-w-xl">
                        {g.description || "No description provided."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-start gap-6 shrink-0 border-t sm:border-t-0 border-gray-100 dark:border-slate-800/80 pt-3 sm:pt-0">
                    {/* Members stack */}
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5 overflow-hidden">
                        {(g.members || []).slice(0, 3).map((m) => (
                          <div 
                            key={m.user_id} 
                            className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-[#13151f] bg-indigo-150 dark:bg-indigo-505/20 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center"
                            title={m.full_name || m.email}
                          >
                            {(m.full_name || m.email)[0].toUpperCase()}
                          </div>
                        ))}
                        {(g.members || []).length > 3 && (
                          <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-[#13151f] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-350 text-[9px] font-bold flex items-center justify-center">
                            +{(g.members || []).length - 3}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 tracking-wide uppercase">
                        {(g.members || []).length} {(g.members || []).length === 1 ? "member" : "members"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedGroup(g)}
                        className="btn-secondary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Configure
                      </button>
                      <button
                        onClick={() => setDeleteGroupId(g.group_id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-955/20 transition-all"
                        title="Delete User Group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm transition-opacity" onClick={() => setShowCreateGroupModal(false)} />
          <div className="bg-white dark:bg-[#11131a] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xl max-w-md w-full relative z-10 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Create User Group</h3>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Define a new group to simplify access controls across multiple teammates.</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Group Name</label>
                <input
                  type="text"
                  placeholder="e.g. Incident Response Team"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="input text-xs w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="e.g. Responsible for incident management overrides..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  rows={3}
                  className="input text-xs w-full py-2 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-150 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={creatingGroup}
                className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
              >
                {creatingGroup && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Slide-Over Drawer */}
      {mounted && selectedGroup && createPortal((() => {
        const g = selectedGroup;

        return (
          <div className="fixed inset-0 overflow-hidden z-50">
            <div className="absolute inset-0 overflow-hidden">
              <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
                onClick={() => setSelectedGroup(null)} 
              />
              
              <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
                <div className="w-screen max-w-xl bg-white dark:bg-[#11131a] border-l border-gray-150 dark:border-slate-800/85 shadow-2xl flex flex-col h-full transform transition-transform duration-300 slide-in-from-right">
                  
                  <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 flex items-center justify-center font-bold text-base shrink-0 border border-indigo-100/40 dark:border-indigo-500/10">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="font-bold text-gray-900 dark:text-white text-base">
                          Configure {g.name}
                        </h2>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Manage permissions and membership list for this group.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedGroup(null)}
                      className="p-1.5 rounded-lg border border-gray-150 dark:border-slate-800 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Group Drawer Tab Selector */}
                  <div className="flex border-b border-gray-150 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/10 shrink-0 select-none">
                    <button
                      onClick={() => setGroupDrawerTab("permissions")}
                      className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                        groupDrawerTab === "permissions"
                          ? "border-indigo-500 text-indigo-650 dark:text-indigo-400 bg-white dark:bg-slate-900/30"
                          : "border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-655 dark:hover:text-slate-355"
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Group Permissions
                    </button>
                    <button
                      onClick={() => setGroupDrawerTab("members")}
                      className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                        groupDrawerTab === "members"
                          ? "border-indigo-500 text-indigo-650 dark:text-indigo-400 bg-white dark:bg-slate-900/30"
                          : "border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-655 dark:hover:text-slate-355"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      Group Members ({groupMembers.length})
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Permissions tab content */}
                    {groupDrawerTab === "permissions" && (
                      <div className="space-y-6">
                        <div className="space-y-6">
                          {CATEGORIES.map(cat => (
                            <div key={cat.title} className="space-y-2.5">
                              <h3 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider border-b border-gray-100 dark:border-slate-800/80 pb-1.5">
                                {cat.title}
                              </h3>
                              <div className="space-y-2">
                                {cat.permissions.map(perm => {
                                  const map = (PERMISSION_IDS as any)[perm.key];
                                  const categoryArray = groupPermissions[map?.categoryId] || [];
                                  const permItem = categoryArray.find((item: any) => item.id === map?.id);
                                  const isChecked = !!(permItem && (permItem.value === true || (permItem.resources && permItem.resources.some((r: any) => r.value === true))));

                                  return (
                                    <label
                                      key={perm.key}
                                      className="flex items-start gap-3 p-3 rounded-xl border border-gray-150 dark:border-slate-800/60 hover:bg-gray-55 dark:hover:bg-slate-800/30 hover:border-gray-250 cursor-pointer transition-all"
                                    >
                                      <div className="relative flex items-center mt-0.5">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            if (!map) return;
                                            setGroupPermissions(prev => {
                                              const next = { ...prev };
                                              const categoryId = map.categoryId;
                                              const permId = map.id;
                                              const arr = next[categoryId] ? [...next[categoryId]] : [];
                                              const index = arr.findIndex((item: any) => item.id === permId);
                                              
                                              if (isChecked) {
                                                if (index !== -1) {
                                                  const existing = arr[index];
                                                  arr[index] = {
                                                    ...existing,
                                                    value: false,
                                                    resources: existing.resources 
                                                      ? existing.resources.map((r: any) => ({ ...r, value: false })) 
                                                      : undefined
                                                  };
                                                } else {
                                                  arr.push({ id: permId, value: false });
                                                }
                                              } else {
                                                if (index !== -1) {
                                                  arr[index] = { id: permId, value: true, resources: undefined };
                                                } else {
                                                  arr.push({ id: permId, value: true });
                                                }
                                              }
                                              next[categoryId] = arr;
                                              return next;
                                            });
                                          }}
                                          className="rounded border-gray-305 dark:border-slate-700 text-indigo-650 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                        />
                                      </div>
                                      <div className="space-y-0.5">
                                        <span className="text-xs font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                                          {perm.label}
                                          {isChecked && (
                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                          )}
                                        </span>
                                        <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-normal">
                                          {perm.desc}
                                        </p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Members tab content */}
                    {groupDrawerTab === "members" && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Group Members</h3>
                          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                            Select which users belong to this group. Members will automatically inherit this group's custom permissions.
                          </p>
                        </div>
                        
                        {/* Search Input */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search users to add..."
                            value={groupSearchMember}
                            onChange={(e) => setGroupSearchMember(e.target.value)}
                            className="input text-xs w-full pl-3"
                          />
                          {groupSearchMember && (
                            <button
                              onClick={() => setGroupSearchMember("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-655"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="border border-gray-150 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-gray-50 dark:divide-slate-800/60 max-h-[300px] overflow-y-auto scrollbar-thin bg-gray-50/20 dark:bg-slate-900/5">
                          {users
                            .filter(u => !groupSearchMember || (u.full_name || "").toLowerCase().includes(groupSearchMember.toLowerCase()) || u.email.toLowerCase().includes(groupSearchMember.toLowerCase()))
                            .map(u => {
                              const isMember = groupMembers.includes(u.user_id);
                              return (
                                <label
                                  key={u.user_id}
                                  className="flex items-center justify-between p-3 text-xs hover:bg-gray-50/50 dark:hover:bg-slate-800/30 cursor-pointer select-none"
                                >
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="font-semibold text-gray-900 dark:text-white truncate">
                                      {u.full_name || "Invited User"}
                                    </span>
                                    <span className="text-[10px] text-gray-400 dark:text-slate-500">
                                      {u.email}
                                    </span>
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={isMember}
                                    onChange={() => {
                                      setGroupMembers(prev =>
                                        prev.includes(u.user_id)
                                          ? prev.filter(uid => uid !== u.user_id)
                                          : [...prev, u.user_id]
                                      );
                                    }}
                                    className="w-4 h-4 text-indigo-600 border-gray-250 dark:border-slate-700 rounded focus:ring-indigo-500 cursor-pointer"
                                  />
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}

                  </div>

                  <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-[#0c0d12]/45 flex items-center justify-end gap-3 shrink-0">
                    <button
                      onClick={() => setSelectedGroup(null)}
                      className="btn-secondary text-xs py-2 px-4 font-semibold"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleSaveGroupSettings}
                      disabled={savingGroupSettings}
                      className="btn-primary text-xs py-2 px-5 font-semibold flex items-center gap-1.5"
                    >
                      {savingGroupSettings ? "Saving..." : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>

                </div>
              </div>

            </div>
          </div>
        );
      })(), document.body)}

      {/* Custom Delete Confirmation Modal */}
      {deleteGroupId && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setDeleteGroupId(null)} />
          <div className="bg-white dark:bg-[#11131a] border border-gray-150 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xl max-w-sm w-full relative z-10 space-y-4 text-center">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Delete User Group?</h3>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                Are you sure you want to delete this group? All group memberships will be revoked and members will lose group permissions overrides.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteGroupId(null)}
                className="btn-secondary py-1.5 px-4 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteGroupId;
                  setDeleteGroupId(null);
                  await handleDeleteGroup(id);
                }}
                className="btn-primary bg-red-650 hover:bg-red-700 text-white py-1.5 px-4 text-xs font-semibold border-transparent"
              >
                Delete Group
              </button>
            </div>
          </div>
        </div>
      )}

      <PermissionsGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />

    </div>
  );
}
