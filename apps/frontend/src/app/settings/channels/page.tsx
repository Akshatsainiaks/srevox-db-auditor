"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { 
  Bell, Plus, Trash2, Mail, MessageSquare, Webhook, Users, 
  CheckCircle, AlertCircle, Loader2, Pencil, X, ExternalLink,
  Layers, Radio, Activity, ShieldAlert, Copy, Check, RefreshCw,
  AlertTriangle, ShieldCheck
} from "lucide-react";
import { fetchChannels, deleteChannel, toggleChannel, testChannel } from "@/lib/api";
import type { Channel } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import { getUser, hasPermission } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import AddModal from "@/components/channels/AddModal";
import EditModal from "@/components/channels/EditModal";

type ChannelType = "email" | "teams" | "whatsapp" | "webhook";
const CHANNEL_ICONS: Record<ChannelType, React.ElementType> = { email: Mail, teams: Users, whatsapp: MessageSquare, webhook: Webhook };
const CHANNEL_COLORS: Record<ChannelType, string> = {
  email: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
  teams: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
  whatsapp: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  webhook: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
};
const CHANNEL_LABELS: Record<ChannelType, string> = { email: "Email (SMTP)", teams: "Microsoft Teams", whatsapp: "WhatsApp Message", webhook: "Custom Webhook" };


export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, "ok" | "fail">>({});
  const [emailTestModalOpen, setEmailTestModalOpen] = useState(false);
  const [testChannelId, setTestChannelId] = useState<string | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const me = getUser();
  const { success, error, info } = useToast();
  const { confirm } = useConfirm();

  const [authorized, setAuthorized] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toastShownRef = useRef(false);

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const d = await fetchChannels();
      setChannels(d.channels || []);
      setAuthorized(true);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 403) {
        setAuthorized(false);
        if (!toastShownRef.current) {
          error("Access restricted: You do not have permission to view alert channels.");
          toastShownRef.current = true;
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [error]);

  useEffect(() => {
    const user = getUser();
    if (!hasPermission(user, "viewChannels")) {
      setAuthorized(false);
      setLoading(false);
      if (!toastShownRef.current) {
        error("Access restricted: You do not have permission to view alert channels.");
        toastShownRef.current = true;
      }
      return;
    }
    load();
  }, [load]);

  const remove = async (id: string, name: string, serviceCount = 0) => {
    let message = `Are you sure you want to delete "${name}"? Alerts will no longer be dispatched to this destination.`;
    if (serviceCount > 0) {
      message = `Warning: Deleting this channel will stop alerts for ${serviceCount} service(s) using it. Are you sure you want to delete "${name}"?`;
    }
    const { confirmed } = await confirm({
      title: "Delete Alert Channel?",
      message,
      confirmLabel: "Delete Channel",
      variant: "danger"
    });
    if (!confirmed) return;

    try {
      await deleteChannel(id);
      success("Channel Deleted", `Successfully removed alert channel "${name}"`);
      load(true);
    } catch (e: any) {
      error("Delete Failed", e?.response?.data?.detail || "An error occurred while deleting the channel");
    }
  };

  const toggle = async (id: string, name: string, isEnabled: boolean, serviceCount = 0) => {
    if (isEnabled && serviceCount > 0) {
      const { confirmed } = await confirm({
        title: "Pause Alert Channel?",
        message: `Warning: Pausing this channel will stop alerts for ${serviceCount} service(s) using it. Are you sure you want to pause "${name}"?`,
        confirmLabel: "Pause Channel",
        variant: "danger"
      });
      if (!confirmed) return;
    }

    try {
      await toggleChannel(id);
      load(true);
    } catch (e: any) {
      error("Toggle Failed", e?.response?.data?.detail || "An error occurred");
    }
  };

  const test = async (id: string, name: string) => {
    const ch = channels.find(c => c.channel_id === id);
    if (ch && ch.type === "email" && (ch as any).channel_type === "service_owner") {
      setTestChannelId(id);
      setTestEmailAddress("");
      setEmailTestModalOpen(true);
      return;
    }
    await executeTest(id, name);
  };

  const executeEmailTest = async (id: string, emailAddr: string) => {
    const ch = channels.find(c => c.channel_id === id);
    const name = ch ? ch.name : "Email Channel";
    await executeTest(id, name, emailAddr);
  };

  const executeTest = async (id: string, name: string, testEmail?: string) => {
    setTesting(id);
    info("Testing Integration", `Sending test payload to ${name}...`);
    try {
      await testChannel(id, testEmail ? { test_email: testEmail } : undefined);
      setTestResult((p) => ({ ...p, [id]: "ok" }));
      success("Test Successful", `Verified channel connection for ${name}. Test message successfully dispatched.`);
      load(true);
    } catch (err: any) {
      setTestResult((p) => ({ ...p, [id]: "fail" }));
      const msg = err.response?.data?.detail || err.message || "Failed to deliver payload";
      error("Test Failed", `Integration test for ${name} failed: ${msg}`);
    } finally {
      setTesting(null);
      setTimeout(() => setTestResult((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      }), 6000);
    }
  };

  // Stats calculation
  const totalChannels = channels.length;
  const activeChannels = channels.filter(c => c.enabled).length;
  const failingChannels = channels.filter(c => c.enabled && c.last_error).length;

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Permission Required</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md">
          You do not have the required permission (`viewChannels`) to view alert routing channels.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Alert Channels</h1>
          <p className="text-xs text-gray-450 dark:text-slate-500 mt-0.5">Configure where cluster pod crash alerts are dispatched</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className="btn-secondary flex items-center gap-1.5 text-xs py-2.5 px-3.5">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          {hasPermission(me, "addChannel") && (
            <button id="add-channel-btn" onClick={() => setShowAdd(true)} className="btn-primary gap-1.5 py-2.5 px-4 text-xs font-semibold rounded-xl hover:scale-[1.01] transition-transform">
              <Plus className="w-4 h-4" /> Add Channel
            </button>
          )}
        </div>
      </div>

      {/* Metrics Summary Bar */}
      {!loading && channels.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-gray-150/40 dark:border-slate-800/40 rounded-2xl flex items-center gap-4 hover:shadow-sm transition-all duration-200">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-white leading-none">{totalChannels}</div>
              <div className="text-[10px] font-medium text-gray-400 dark:text-slate-500 mt-1 uppercase tracking-wider">Total Channels</div>
            </div>
          </div>

          <div className="card p-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-gray-150/40 dark:border-slate-800/40 rounded-2xl flex items-center gap-4 hover:shadow-sm transition-all duration-200">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-white leading-none">{activeChannels}</div>
              <div className="text-[10px] font-medium text-gray-400 dark:text-slate-500 mt-1 uppercase tracking-wider">Active Deliveries</div>
            </div>
          </div>

          <div className="card p-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-gray-150/40 dark:border-slate-800/40 rounded-2xl flex items-center gap-4 hover:shadow-sm transition-all duration-200">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${
              failingChannels > 0
                ? "bg-red-50 dark:bg-red-500/10 text-red-655 dark:text-red-400 animate-pulse"
                : "bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400"
            }`}>
              {failingChannels > 0 ? <ShieldAlert className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
            </div>
            <div>
              <div className={`text-sm font-bold leading-none ${failingChannels > 0 ? "text-red-600 dark:text-red-400" : "text-teal-600 dark:text-teal-400"}`}>
                {failingChannels > 0 ? "Issues Detected" : "100% Healthy"}
              </div>
              <div className="text-[10px] font-medium text-gray-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
                {failingChannels > 0 ? `${failingChannels} failing endpoints` : "All configurations active"}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdded={load} />}
      {editingId && <EditModal channelId={editingId} onClose={() => setEditingId(null)} onSaved={load} />}

      {/* Main List Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse bg-gray-150 dark:bg-slate-800/40 h-32 rounded-2xl" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="card py-20 text-center max-w-xl mx-auto mt-6 bg-white dark:bg-[#13151f] border border-gray-100 dark:border-slate-800/80 rounded-3xl shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Bell className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
          </div>
          <p className="font-bold text-gray-800 dark:text-white mb-1.5 text-base">No Alert Channels configured yet</p>
          <p className="text-xs text-gray-450 dark:text-slate-500 mb-6 max-w-sm mx-auto">Add Email, Teams, WhatsApp, or custom Webhook endpoints to start routing cluster alerts.</p>
          {hasPermission(me, "addChannel") && (
            <button onClick={() => setShowAdd(true)} className="btn-primary gap-1.5 text-xs font-semibold py-2.5 px-4 rounded-xl shadow-sm hover:scale-[1.01] transition-transform">
              <Plus className="w-4 h-4" /> Add your first Channel
            </button>
          )}
        </div>
      ) : (
        <div id="channels-list" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {channels.map((ch) => {
            const Icon = CHANNEL_ICONS[ch.type as ChannelType] || Bell;
            const testRes = testResult[ch.channel_id];
            const serviceCount = (ch as any).service_count || 0;
            
            const designPreset = {
              email: {
                border: "border-t-2 border-t-blue-500/80 dark:border-t-blue-500/60 hover:border-blue-500/35",
                glow: "from-blue-500/5 to-transparent",
                iconContainer: "bg-blue-50/70 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-500/20"
              },
              teams: {
                border: "border-t-2 border-t-purple-500/80 dark:border-t-purple-500/60 hover:border-purple-500/35",
                glow: "from-purple-500/5 to-transparent",
                iconContainer: "bg-purple-50/70 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100/50 dark:border-purple-500/20"
              },
              whatsapp: {
                border: "border-t-2 border-t-emerald-500/80 dark:border-t-emerald-500/60 hover:border-emerald-500/35",
                glow: "from-emerald-500/5 to-transparent",
                iconContainer: "bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-500/20"
              },
              webhook: {
                border: "border-t-2 border-t-indigo-500/80 dark:border-t-indigo-500/60 hover:border-indigo-500/35",
                glow: "from-indigo-500/5 to-transparent",
                iconContainer: "bg-indigo-50/70 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-500/20"
              }
            }[ch.type as ChannelType] || {
              border: "border-t-2 border-t-slate-400 hover:border-slate-500/30",
              glow: "from-slate-400/5 to-transparent",
              iconContainer: "bg-slate-50 text-slate-650"
            };

            return (
              <div 
                key={ch.channel_id} 
                className={`group relative overflow-hidden card p-6 bg-white/70 dark:bg-[#121420]/75 backdrop-blur-md border border-gray-150/70 dark:border-slate-800/80 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 ${designPreset.border}`}
              >
                <div className={`absolute -right-4 -top-4 w-28 h-28 bg-gradient-to-br ${designPreset.glow} blur-2xl rounded-full opacity-60 group-hover:scale-110 transition-transform duration-300 pointer-events-none`} />

                <div>
                  <div className="flex items-center justify-between gap-4 mb-4 relative z-10">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${designPreset.iconContainer}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    {hasPermission(me, "testChannel") && (
                      <button
                        onClick={() => toggle(ch.channel_id, ch.name, ch.enabled, serviceCount)}
                        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                          ch.enabled ? "bg-indigo-600 shadow-sm shadow-indigo-600/30" : "bg-gray-200 dark:bg-slate-800"
                        }`}
                      >
                        <span
                          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform"
                          style={{
                            backgroundColor: "#ffffff",
                            transform: ch.enabled ? "translateX(16px)" : "translateX(0px)"
                          }}
                        />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 relative z-10">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-white text-base truncate max-w-[200px]" title={ch.name}>
                        {ch.name}
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-gray-50 dark:bg-slate-900 text-gray-400 dark:text-slate-500 border border-gray-150 dark:border-slate-800 uppercase tracking-wide">
                        {CHANNEL_LABELS[ch.type as ChannelType] || ch.type}
                      </span>

                      {!ch.enabled && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 uppercase tracking-wide">
                          paused
                        </span>
                      )}
                    </div>
                    

                    
                    <div className="text-[10px] text-gray-450 dark:text-slate-500">
                      Configured {timeAgo(ch.created_at)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-gray-100/70 dark:border-slate-800/60 flex items-center justify-between gap-4 relative z-10">
                  <div className="min-w-0 flex-1 flex items-center gap-1.5 text-[10px] font-medium leading-tight">
                    {ch.last_success_at ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5 truncate" title={`Last active: ${new Date(ch.last_success_at).toLocaleString()}`}>
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        Sent {timeAgo(ch.last_success_at)}
                      </span>
                    ) : ch.last_error ? (
                      <span className="text-red-550 dark:text-red-400 flex items-center gap-1.5 truncate" title={ch.last_error}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                        Error: {ch.last_error}
                      </span>
                    ) : (
                      <span className="text-gray-450 dark:text-slate-500 flex items-center gap-1.5 select-none">
                        <Bell className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        No alerts sent yet
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasPermission(me, "testChannel") && (
                      <button
                        onClick={() => test(ch.channel_id, ch.name)}
                        disabled={testing === ch.channel_id}
                        className="btn-secondary text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center justify-center min-w-[50px] transition-all shrink-0 hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-[0.98]"
                        title="Send a test alert through this channel"
                      >
                        {testing === ch.channel_id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                        ) : testRes === "ok" ? (
                          <Check className="w-3.5 h-3.5 text-green-500 font-bold" />
                        ) : testRes === "fail" ? (
                          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          "Test"
                        )}
                      </button>
                    )}
                    {(hasPermission(me, "addChannel") || hasPermission(me, "deleteChannel")) && (
                      <>
                        {hasPermission(me, "addChannel") && (
                          <button
                            onClick={() => setEditingId(ch.channel_id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 dark:text-slate-650 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors shrink-0"
                            title="Edit channel settings"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {hasPermission(me, "deleteChannel") && (
                          <button
                            onClick={() => remove(ch.channel_id, ch.name, 0)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 dark:text-slate-650 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                            title="Delete alert channel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {emailTestModalOpen && (
        <div className="fixed inset-0 overflow-hidden z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#11131a] border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Test Email Channel</h3>
              <p className="text-xs text-gray-500 dark:text-slate-450 mt-1 leading-normal">
                Enter the email address you want to send the test alert to.
              </p>
            </div>

            <input
              type="email"
              value={testEmailAddress}
              onChange={e => setTestEmailAddress(e.target.value)}
              placeholder="developer@example.com"
              className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-slate-800 rounded-xl bg-transparent text-gray-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
            />

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  setEmailTestModalOpen(false);
                  setTestChannelId(null);
                }}
                className="btn-secondary text-[11px] font-bold py-2.5 px-4.5 rounded-xl border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (testChannelId) {
                    executeEmailTest(testChannelId, testEmailAddress);
                  }
                  setEmailTestModalOpen(false);
                  setTestChannelId(null);
                }}
                className="btn-primary text-[11px] font-bold py-2.5 px-4.5 rounded-xl text-white bg-indigo-650 hover:bg-indigo-700"
              >
                Send Test Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
