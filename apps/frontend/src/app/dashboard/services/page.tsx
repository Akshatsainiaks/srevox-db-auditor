"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Plus, Trash2, RefreshCw, Pencil, AlertTriangle, Search, Cpu, Mail, SlidersHorizontal, BellOff, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { getUser, hasPermission } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import AddModal from "@/components/services/AddModal";
import EditModal from "@/components/services/EditModal";
import ImportModal from "@/components/services/ImportModal";



interface ServiceOwner {
  service_owner_id: string; 
  cluster_id: string; 
  cluster_name: string;
  namespace?: string; 
  pod_prefix?: string;
  user_id: string; 
  user_ids?: string[];
  group_ids?: string[];
  owner_name: string; 
  owner_email: string;
  channel_ids: string[]; 
  channel_id?: string;
  created_at: string;
  muted?: boolean;
  muted_ttl?: number | null;
  owners?: any[];
  groups?: any[];
}
interface Cluster { cluster_id: string; name: string; }

export default function ServicesPage() {
  const [owners, setOwners] = useState<ServiceOwner[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  
  const me = getUser();
  const { success, error } = useToast();
  const { confirm } = useConfirm();
  const [authorized, setAuthorized] = useState(true);
  const toastShownRef = useRef(false);

  const load = async (quiet = false) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [so, c] = await Promise.all([
        api.get("/api/service-owners"),
        api.get("/api/clusters"),
      ]);
      setOwners(so.data.service_owners || []);
      setClusters(c.data.clusters || []);
      setAuthorized(true);
    } catch (e: any) {
      console.error(e);
      if (e.response?.status === 403) {
        setAuthorized(false);
        if (!toastShownRef.current) {
          error("Access restricted: You do not have permission to view services.");
          toastShownRef.current = true;
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const user = getUser();
    if (!hasPermission(user, "viewServiceOwners")) {
      setAuthorized(false);
      setLoading(false);
      if (!toastShownRef.current) {
        error("Permission Required: You do not have permission to view services.");
        toastShownRef.current = true;
      }
      return;
    }
    load();

    // Audit page view
    if (me) {
      fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: me.org_id || "default",
          user_id: me.user_id,
          action: "view_services_list",
          resource: "registry_page",
          resource_id: "services",
          metadata: { path: window.location.pathname }
        })
      }).catch(() => {});
    }
  }, []);

  const remove = async (owner: ServiceOwner) => {
    const { confirmed } = await confirm({
      title: "Remove Service?",
      message: `Are you sure you want to remove the service "${owner.pod_prefix || "*"}"? This action cannot be undone.`,
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/api/service-owners/${owner.service_owner_id}`);
      success("Service removed", owner.pod_prefix || "*");
      load(true);
    } catch {
      error("Failed to remove service");
    }
  };

  const filteredServices = owners.filter(s =>
    !search ||
    (s.pod_prefix || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.namespace || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.cluster_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.owner_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.owner_email || "").toLowerCase().includes(search.toLowerCase())
  );

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`viewServiceOwners`) to view services & ownership routing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Services</h1>
          <p className="text-sm text-gray-550 dark:text-slate-400 mt-0.5">
            Register and monitor platform application services and namespace environments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className="btn-secondary flex items-center gap-1.5 text-xs py-2.5 px-3.5">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          {hasPermission(me, "addServiceOwner") && (
            <>
              <button id="add-service-btn" onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add service
              </button>
              <button onClick={() => setShowImport(true)} className="btn-secondary text-xs py-2.5 px-4 font-semibold rounded-xl flex items-center gap-1.5">
                Import services
              </button>
              <Link href="/dashboard/services/features" className="btn-secondary text-xs py-2.5 px-4 font-semibold rounded-xl flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4" /> Service Feature Settings
              </Link>
            </>
          )}
        </div>
      </div>

      {showAdd && (
        <AddModal
          clusters={clusters}
          onClose={() => setShowAdd(false)}
          onAdded={() => load(true)}
        />
      )}

      {showImport && (
        <ImportModal
          clusters={clusters}
          onClose={() => setShowImport(false)}
          onAdded={() => load(true)}
        />
      )}

      {editingId && (
        <EditModal
          ownerId={editingId}
          clusters={clusters}
          onClose={() => setEditingId(null)}
          onSaved={() => load(true)}
        />
      )}

      {/* Services List Container */}
      <div className="card overflow-hidden w-full">
        <div className="px-5 py-4 border-b border-gray-150 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50 dark:bg-slate-800/20">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Registry ({filteredServices.length})</h2>
          </div>
          
          {/* Search filter */}
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search services..."
              className="input pl-10 py-1.5 text-xs rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="px-5 py-5 animate-pulse bg-gray-100 dark:bg-slate-800 h-16" />
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="py-20 text-center">
            <Cpu className="w-12 h-12 text-gray-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="font-medium text-gray-500 dark:text-slate-400">No services found</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              {search ? "Try adjusting your search criteria" : "Register your microservices to configure granular routing rules and crash owners"}
            </p>
            {!search && hasPermission(me, "addServiceOwner") && (
              <button onClick={() => setShowAdd(true)} className="btn-primary mt-5 text-xs font-semibold py-2 px-4 rounded-xl">
                <Plus className="w-3.5 h-3.5" /> Add first service
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-800/80">
            {filteredServices.map((owner) => (
              <div 
                key={owner.service_owner_id} 
                className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50/70 dark:hover:bg-slate-800/30 transition-all"
              >
                <Link href={`/dashboard/services/${owner.service_owner_id}`} className="flex items-start gap-3.5 min-w-0 flex-1 cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100/50 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        {owner.pod_prefix || "*"}
                      </span>
                      {owner.muted && (
                        <span className="badge bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 text-[10px] py-0.5 px-2 flex items-center gap-1">
                          <BellOff className="w-3 h-3" /> Muted {owner.muted_ttl ? `(${Math.ceil(owner.muted_ttl / 60)}m)` : ""}
                        </span>
                      )}
                      <span className="badge bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-100/30 text-[10px] py-0.5 px-2">
                        {owner.cluster_name}
                      </span>
                      {owner.namespace && (
                        <span className="badge bg-slate-100 dark:bg-slate-800 text-gray-600 dark:text-slate-200 border-gray-200/50 dark:border-slate-700 text-[10px] py-0.5 px-2">
                          ns: {owner.namespace}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-slate-500 flex items-center gap-2 flex-wrap">
                      {((owner.user_ids && owner.user_ids.length > 0) || (owner.group_ids && owner.group_ids.length > 0)) ? (
                        <span className="text-green-700 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-500/5 px-1.5 py-0.5 rounded flex items-center gap-1 flex-wrap">
                          Assigned to:
                          {owner.user_ids && owner.user_ids.length > 0 && (
                            <span>
                              {owner.owners && owner.owners.length > 0
                                ? owner.owners.map(u => u.full_name || u.email).join(", ")
                                : (owner.owner_name || owner.owner_email || owner.user_ids.join(", "))}
                            </span>
                          )}
                          {owner.user_ids && owner.user_ids.length > 0 && owner.group_ids && owner.group_ids.length > 0 && <span>&</span>}
                          {owner.group_ids && owner.group_ids.length > 0 && (
                            <span>
                              {owner.groups && owner.groups.length > 0
                                ? owner.groups.map(g => g.name).join(", ")
                                : (owner.group_ids.length === 1 ? "1 group" : `${owner.group_ids.length} groups`)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-500/5 px-1.5 py-0.5 rounded">
                          Unassigned
                        </span>
                      )}
                      <span>·</span>
                      <span>Registered {timeAgo(owner.created_at)}</span>
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-2.5 shrink-0">
                  {owner.muted && (
                    <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 shrink-0">
                      🔕 {owner.muted_ttl ? `${Math.ceil(owner.muted_ttl / 60)}m left` : "Muted"}
                    </span>
                  )}

                  {hasPermission(me, "addServiceOwner") && (
                    <button
                      onClick={() => setEditingId(owner.service_owner_id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-slate-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                      title="Edit Service"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {hasPermission(me, "deleteServiceOwner") && (
                    <button
                      onClick={() => remove(owner)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Delete Service"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


    </div>
  );
}