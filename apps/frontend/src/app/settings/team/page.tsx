"use client";
import { useEffect, useState, useRef } from "react";
import { Users, Plus, Trash2, Crown, Shield, Eye, RefreshCw, Pencil, Upload, AlertTriangle, Search, X, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { getUser, hasPermission } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import CreateUserModal from "@/components/team/CreateUserModal";
import BulkImportModal from "@/components/team/BulkImportModal";
import EditUserModal from "@/components/team/EditUserModal";

interface Member { user_id: string; email: string; full_name?: string; role: string; is_active: boolean; created_at: string; last_login_at?: string; }

const ROLE_ICONS: Record<string,React.ElementType> = { admin: Crown, member: Shield, viewer: Eye };
const ROLE_COLORS: Record<string,string> = {
  admin:  "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
  member: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
  viewer: "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600",
};

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editing, setEditing] = useState<Member|null>(null);
  const me = getUser();
  const { success, error } = useToast();
  const { confirm } = useConfirm();
  const [authorized, setAuthorized] = useState(true);
  const toastShownRef = useRef(false);

  const load = () => {
    setLoading(true);
    api.get("/api/users")
      .then(r => {
        setMembers(r.data.users || []);
        setAuthorized(true);
      })
      .catch((err: any) => {
        console.error(err);
        if (err.response?.status === 403) {
          setAuthorized(false);
          if (!toastShownRef.current) {
            error("Access restricted: You do not have permission to view team settings.");
            toastShownRef.current = true;
          }
        }
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const user = getUser();
    if (!hasPermission(user, "viewTeam")) {
      setAuthorized(false);
      setLoading(false);
      if (!toastShownRef.current) {
        error("Access restricted: You do not have permission to view team settings.");
        toastShownRef.current = true;
      }
      return;
    }
    load();
  }, []);

  const remove = async (m: Member) => {
    if (m.user_id === me?.user_id) { error("Cannot remove yourself"); return; }
    const { confirmed } = await confirm({
      title: `Remove ${m.full_name||m.email}?`,
      message: "They will lose access to the dashboard immediately. This cannot be undone.",
      confirmLabel: "Remove member",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/api/users/${m.user_id}`);
      success("Member removed", m.email);
      load();
    } catch { error("Failed to remove member"); }
  };



  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`viewTeam`) to view team members.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Manage your organization members and roles</p>
        </div>
        {me?.role === "admin" && (
          <div className="flex gap-2">
            <button onClick={()=>setShowBulkImport(true)} className="btn-secondary flex items-center gap-1.5"><Upload className="w-4 h-4"/>Bulk import</button>
            <button id="team-create-member-btn" onClick={()=>setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4"/>Create member</button>
          </div>
        )}
      </div>

      {showCreate && <CreateUserModal onClose={()=>setShowCreate(false)} onCreated={load}/>}
      {showBulkImport && <BulkImportModal onClose={()=>setShowBulkImport(false)} onImported={load}/>}
      {editing && <EditUserModal userId={editing.user_id} onClose={()=>setEditing(null)} onSaved={load}/>}

      {/* Role permissions */}
      <div id="team-roles-guide" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { role:"Admin",  Icon:Crown,  color:"text-purple-600 dark:text-purple-400", bg:"bg-purple-50 dark:bg-purple-500/10",  perms:["Full access","Manage users","Add/remove clusters","Configure channels"] },
          { role:"Member", Icon:Shield, color:"text-blue-600 dark:text-blue-400",     bg:"bg-blue-50 dark:bg-blue-500/10",      perms:["View everything","Acknowledge incidents","Resolve incidents","Run AI diagnosis"] },
          { role:"Viewer", Icon:Eye,    color:"text-gray-600 dark:text-slate-400",    bg:"bg-gray-50 dark:bg-slate-800",       perms:["View dashboard","View incidents","View clusters","Read-only access"] },
        ].map(({role,Icon,color,bg,perms})=>(
          <div key={role} className="card p-4">
            <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl ${bg} mb-3`}>
              <Icon className={`w-4 h-4 ${color}`}/><span className={`text-sm font-bold ${color}`}>{role}</span>
            </div>
            <ul className="space-y-1">
              {perms.map(p=><li key={p} className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5"><span className="text-indigo-400">·</span>{p}</li>)}
            </ul>
          </div>
        ))}
      </div>

      {/* Members list */}
      <div id="team-members-list" className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500"/>
            <span className="font-semibold text-gray-900 dark:text-white">Members</span>
            <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">({members.length})</span>
          </div>
          <div className="relative max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
            </div>
            <input 
              id="team-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="input pl-8 pr-7 py-1 text-xs w-full bg-gray-50/50 dark:bg-slate-900/30 border border-gray-150 dark:border-slate-800/80"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-655 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {[...Array(3)].map((_,i)=><div key={i} className="px-5 py-4 animate-pulse bg-gray-100 dark:bg-slate-800 h-14"/>)}
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {(() => {
              const filteredMembers = members.filter(m => 
                (m.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.email.toLowerCase().includes(searchQuery.toLowerCase())
              );

              if (filteredMembers.length === 0) {
                return (
                  <div className="px-5 py-12 text-center text-xs text-gray-450 dark:text-slate-550">
                    No members found matching your search.
                  </div>
                );
              }

              return filteredMembers.map(m=>{
                const Icon = ROLE_ICONS[m.role]||Shield;
                return (
                  <div key={m.user_id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                      {(m.full_name||m.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800 dark:text-slate-200 text-sm">{m.full_name||m.email}</span>
                        {m.user_id===me?.user_id&&<span className="text-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md font-medium">You</span>}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{m.email}</span>
                        {m.last_login_at&&<span>· Last login {timeAgo(m.last_login_at)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`badge text-xs ${ROLE_COLORS[m.role]}`}><Icon className="w-3 h-3 mr-1"/>{m.role}</span>
                      {me?.role==="admin"&&m.user_id!==me?.user_id&&(
                        <>
                          <button onClick={()=>setEditing(m)} title="Edit member" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 dark:text-slate-600 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                          <button onClick={()=>remove(m)} title="Remove member" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}