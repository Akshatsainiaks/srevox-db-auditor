"use client";
import { useEffect, useState } from "react";
import { Bell, CheckCircle, Loader2, Trash2, Plus, Info } from "lucide-react";
import { api, apiUpdateMe } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";

type ChannelType = "email" | "teams" | "whatsapp" | "webhook";

const CHANNEL_LABELS: Record<ChannelType, string> = {
  email: "Email (SMTP / Gmail)", teams: "Microsoft Teams",
  whatsapp: "WhatsApp", webhook: "Webhook / Slack",
};

const CHANNEL_FIELDS: Record<ChannelType, Array<{ key: string; label: string; placeholder: string; secret?: boolean; required?: boolean }>> = {
  email: [
    { key: "smtp_host", label: "SMTP host",      placeholder: "smtp.gmail.com", required: true },
    { key: "smtp_port", label: "SMTP port",      placeholder: "587", required: true },
    { key: "smtp_user", label: "SMTP user",      placeholder: "you@gmail.com", required: true },
    { key: "smtp_pass", label: "App password",   placeholder: "••••••••", secret: true, required: true },
    { key: "to",        label: "Send alerts to", placeholder: "you@gmail.com", required: true },
  ],
  teams:    [{ key: "webhook_url", label: "Teams webhook URL", placeholder: "https://company.webhook.office.com/...", required: true }],
  whatsapp: [
    { key: "provider",    label: "Provider",    placeholder: "twilio", required: true },
    { key: "account_sid", label: "Account SID", placeholder: "ACxxxxxxxx", required: true },
    { key: "auth_token",  label: "Auth token",  placeholder: "••••••••", secret: true, required: true },
    { key: "from",        label: "From number", placeholder: "+14155238886", required: true },
    { key: "phone_number_id", label: "Phone Number ID", placeholder: "10987654321", required: true },
    { key: "token",       label: "Meta Access Token", placeholder: "••••••••", secret: true, required: true },
    { key: "to",          label: "Your number", placeholder: "+919876543210", required: true },
  ],
  webhook: [
    { key: "url",    label: "Webhook URL",           placeholder: "https://hooks.slack.com/...", required: true },
    { key: "secret", label: "HMAC secret (optional)", placeholder: "my-secret", required: false },
  ],
};

export default function PersonalAlertsPage() {
  const localUser = getUser();
  const { success, error } = useToast();
  const { confirm } = useConfirm();

  const [existingCh, setExistingCh] = useState<{ id: string; type: string } | null>(null);
  const [showChForm, setShowChForm] = useState(false);
  const [chType, setChType] = useState<ChannelType>("email");
  const [chConfig, setChConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/api/auth/account/personal-channel")
      .then((res) => {
        setExistingCh(res.data.channel);
      })
      .catch(console.error);
  }, []);

  const setChCfg = (k: string, v: string) => setChConfig((p) => ({ ...p, [k]: v }));

  const isPersonalChannelValid = () => {
    const displayedFields = CHANNEL_FIELDS[chType].filter((f) => {
      if (chType !== "whatsapp") return true;
      const prov = chConfig.provider || "twilio";
      if (f.key === "provider" || f.key === "to") return true;
      if (prov === "meta") {
        return f.key === "phone_number_id" || f.key === "token";
      } else {
        return f.key === "account_sid" || f.key === "auth_token" || f.key === "from";
      }
    });

    for (const f of displayedFields) {
      if (f.required) {
        if (f.key === "provider") continue;
        const val = chConfig[f.key];
        if (!val || !val.trim()) return false;
      }
    }
    return true;
  };

  const savePersonalChannel = async () => {
    if (!isPersonalChannelValid()) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await apiUpdateMe({
        personal_channel: {
          type: chType,
          name: `${localUser?.full_name || localUser?.email}'s personal channel`,
          config: chConfig,
        },
      });
      setExistingCh({ id: res.personal_channel_id, type: chType });
      setShowChForm(false);
      setChConfig({});
      success("Personal alert channel saved");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      error("Failed to save personal channel");
    } finally {
      setSaving(false);
    }
  };

  const removePersonalChannel = async () => {
    const { confirmed } = await confirm({
      title: "Remove channel?",
      message: "Are you sure you want to remove your personal alert channel?",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await apiUpdateMe({ personal_channel: null });
      setExistingCh(null);
      success("Personal channel removed");
    } catch {
      error("Failed to remove channel");
    }
  };

  return (
    <div className="card p-6 space-y-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm animate-modal-slide-up" style={{ animationDuration: "0.2s" }}>
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/60">
        <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
          <Bell className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">Personal Alert Channel</h2>
          <p className="text-xs text-gray-550 dark:text-slate-400">Receive direct alerts for Kubernetes crashes on namespaces you own</p>
        </div>
        {saved && (
          <span className="text-[10px] font-bold text-green-600 dark:text-green-400 flex items-center gap-1 bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 px-2 py-1 rounded-md">
            <CheckCircle className="w-3.5 h-3.5" /> Saved!
          </span>
        )}
      </div>

      {existingCh && !showChForm ? (
        <div className="flex items-center gap-4 p-4 bg-green-50/50 dark:bg-green-500/[0.04] rounded-2xl border border-green-100 dark:border-green-500/20">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-450 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-green-800 dark:text-green-300 text-sm capitalize">{existingCh.type} channel active</div>
            <div className="text-xs text-green-600 dark:text-green-500/80 mt-0.5">Crash alerts will dispatch to this channel immediately.</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowChForm(true)} className="btn-secondary text-xs py-2 px-3 rounded-xl">Change</button>
            <button onClick={removePersonalChannel} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border border-gray-200 dark:border-slate-800/80">
              <Trash2 className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      ) : !showChForm ? (
        <button onClick={() => setShowChForm(true)} className="btn-secondary w-full justify-center py-3 rounded-2xl hover:scale-[1.005] transition-transform">
          <Plus className="w-4.5 h-4.5" /> Set up personal alert channel
        </button>
      ) : (
        <div className="space-y-4 p-5 bg-gray-50 dark:bg-slate-900/30 rounded-2xl border border-gray-150 dark:border-slate-800/60 animate-modal-slide-up">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Channel Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CHANNEL_LABELS) as ChannelType[]).map((t) => (
                <button key={t} type="button" onClick={() => { setChType(t); setChConfig(t === "whatsapp" ? { provider: "twilio" } : {}); }}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all tracking-wide ${chType === t
                    ? "border-indigo-500 bg-indigo-55/50 dark:bg-indigo-500/[0.06] text-indigo-600 dark:text-indigo-400"
                    : "border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/50"}`}>
                  {CHANNEL_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {chType === "teams" && (
            <div className="bg-amber-50/50 dark:bg-amber-500/[0.03] border border-amber-150 dark:border-amber-500/20 p-4 rounded-2xl flex items-start gap-3 select-none">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Microsoft Teams Workflows Setup Guide</p>
                <p className="text-[11px] text-amber-700/90 dark:text-amber-400/80 leading-relaxed">
                  Microsoft has retired legacy Incoming Webhooks. Instead, use Microsoft Teams Workflows (Power Automate) to create your webhook connection:
                </p>
                <ol className="list-decimal list-inside text-[11px] text-amber-700/80 dark:text-amber-400/70 space-y-1 pl-1 leading-relaxed">
                  <li>In Microsoft Teams, open the <strong>Workflows</strong> app.</li>
                  <li>Search for and select the template: <strong>"Post to a channel when a webhook request is received"</strong>.</li>
                  <li>Verify connections, pick your target <strong>Team</strong> and <strong>Channel</strong>, and create the workflow.</li>
                  <li>Copy the generated <strong>HTTP POST URL</strong> and paste it into the input field below.</li>
                </ol>
              </div>
            </div>
          )}

          {CHANNEL_FIELDS[chType].filter((f) => {
            if (chType !== "whatsapp") return true;
            const prov = chConfig.provider || "twilio";
            if (f.key === "provider" || f.key === "to") return true;
            if (prov === "meta") {
              return f.key === "phone_number_id" || f.key === "token";
            } else {
              return f.key === "account_sid" || f.key === "auth_token" || f.key === "from";
            }
          }).map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                {f.label} {f.required && <span className="text-red-500 font-bold">*</span>}
              </label>
              {f.key === "provider" ? (
                <div className="grid grid-cols-2 gap-2 mt-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-150 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setChCfg("provider", "twilio")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold tracking-wide transition-all ${
                      (chConfig.provider || "twilio") === "twilio"
                        ? "bg-gray-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-150 dark:border-slate-800"
                        : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                    }`}
                  >
                    Twilio API
                  </button>
                  <button
                    type="button"
                    onClick={() => setChCfg("provider", "meta")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold tracking-wide transition-all ${
                      chConfig.provider === "meta"
                        ? "bg-gray-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-150 dark:border-slate-800"
                        : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                    }`}
                  >
                    Meta Cloud API
                  </button>
                </div>
              ) : (
                <input type={f.secret ? "password" : "text"} className="input w-full"
                  placeholder={f.placeholder} value={chConfig[f.key] || ""}
                  onChange={(e) => setChCfg(f.key, e.target.value)} />
              )}
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowChForm(false); setChConfig({}); }} className="btn-secondary flex-1 py-2.5">Cancel</button>
            <button onClick={savePersonalChannel} disabled={saving || !isPersonalChannelValid()} className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Channel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
