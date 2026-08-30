"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Info } from "lucide-react";
import { fetchChannel, updateChannel } from "@/lib/api";
import { useToast } from "@/components/Toast";

type ChannelType = "email" | "teams" | "whatsapp" | "webhook";

interface FieldConfig {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
  hint?: string;
  required?: boolean;
}

const FIELDS: Record<ChannelType, FieldConfig[]> = {
  email: [
    { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.gmail.com", required: true },
    { key: "smtp_port", label: "SMTP Port", placeholder: "587", required: true },
    { key: "smtp_user", label: "SMTP Username", placeholder: "you@gmail.com", required: true },
    { key: "smtp_pass", label: "SMTP App Password", placeholder: "••••••••", secret: true, hint: "Use Gmail App Password", required: true },
    { key: "from", label: "From Email Address", placeholder: "you@gmail.com", required: false, hint: "For Outlook/Office365, this must match SMTP Username. Defaults to SMTP Username if empty." },
    { key: "to", label: "Recipient To Email(s) (comma-separated)", placeholder: "eng@company.com, admin@company.com", required: true },
    { key: "cc", label: "Recipient CC Email(s) (comma-separated)", placeholder: "dev-cc@company.com", required: false },
    { key: "bcc", label: "Recipient BCC Email(s) (comma-separated)", placeholder: "archive@company.com", required: false },
  ],
  teams: [
    { key: "webhook_url", label: "Teams Incoming Webhook URL", placeholder: "https://company.webhook.office.com/...", required: true }
  ],
  whatsapp: [
    { key: "provider", label: "Provider Service", placeholder: "twilio", required: true },
    { key: "account_sid", label: "Twilio Account SID", placeholder: "ACxxxxxxxx", required: true },
    { key: "auth_token", label: "Twilio Auth Token", placeholder: "••••••••", secret: true, required: true },
    { key: "from", label: "WhatsApp Sender Number", placeholder: "+14155238886", required: true },
    { key: "phone_number_id", label: "Meta Phone Number ID", placeholder: "10987654321", required: true },
    { key: "token", label: "Meta Access Token", placeholder: "••••••••", secret: true, required: true },
    { key: "to", label: "Recipient Phone Numbers (comma-separated)", placeholder: "+919876543210, +19876543210", required: true },
  ],
  webhook: [
    { key: "url", label: "Webhook URL Endpoint", placeholder: "https://hooks.slack.com/services/...", required: true },
    { key: "secret", label: "Webhook Signing Secret (optional)", placeholder: "my-webhook-secret", secret: true, required: false },
  ],
};

const modalStyles = (
  <style>{`
    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes modalSlideUp {
      from { transform: translateY(16px) scale(0.97); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    .animate-modal-fade-in { animation: modalFadeIn 0.2s ease-out forwards; }
    .animate-modal-slide-up { animation: modalSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  `}</style>
);

const CHANNEL_LABELS: Record<ChannelType, string> = {
  email: "Email (SMTP)",
  teams: "Microsoft Teams",
  whatsapp: "WhatsApp Message",
  webhook: "Custom Webhook"
};

export default function EditModal({
  channelId,
  onClose,
  onSaved
}: {
  channelId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>("email");
  const [channelType, setChannelType] = useState<"normal" | "service_owner">("normal");
  const [isGlobalDefault, setIsGlobalDefault] = useState(false);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    fetchChannel(channelId)
      .then((res) => {
        setName(res.name);
        setType(res.type);
        setChannelType(res.channel_type || "normal");
        setIsGlobalDefault(res.is_global_default || false);
        setCfg({ provider: "twilio", ...(res.config || {}) });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [channelId]);

  const set = (k: string, v: string) => setCfg((p) => ({ ...p, [k]: v }));

  const isFormValid = () => {
    if (!name.trim()) return false;

    const displayedFields = FIELDS[type].filter((f) => {
      if (type === "email") {
        if (channelType === "service_owner" && (f.key === "to" || f.key === "cc" || f.key === "bcc")) {
          return false;
        }
      }
      if (type !== "whatsapp") return true;
      const prov = cfg.provider || "twilio";
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
        const val = cfg[f.key];
        if (!val || !val.trim()) return false;
      }
    }
    return true;
  };

  const submit = async () => {
    if (!isFormValid()) return;

    if (type === "email" && channelType === "normal") {
      const smtpUser = cfg.smtp_user || "";
      const fromEmail = cfg.from || "";
      const recipientList = cfg.to || "";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(smtpUser.trim())) {
        error("Validation Error", "SMTP Username must be a valid email address.");
        return;
      }
      if (fromEmail.trim() && !emailRegex.test(fromEmail.trim())) {
        error("Validation Error", "From Email Address must be a valid email address.");
        return;
      }

      const recipients = recipientList.split(",").map(r => r.trim()).filter(Boolean);
      if (recipients.length === 0) {
        error("Validation Error", "Please provide at least one recipient email address.");
        return;
      }
      for (const rec of recipients) {
        if (!emailRegex.test(rec)) {
          error("Validation Error", `"${rec}" is not a valid recipient email address.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      await updateChannel(channelId, {
        name,
        config: cfg,
        channel_type: type === "email" ? channelType : "normal",
        is_global_default: type === "email" && channelType === "service_owner" ? isGlobalDefault : false
      });
      success("Channel Updated", `Successfully updated settings for ${name}`);
      onSaved();
      onClose();
    } catch (e: any) {
      console.error(e);
      error("Failed to Save Changes", e?.response?.data?.detail || "An error occurred while updating channel settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#07080d]/75 backdrop-blur-[6px] flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-[#13151f] rounded-3xl p-8 border border-gray-100 dark:border-slate-800/80 shadow-2xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#07080d]/75 backdrop-blur-[6px] flex items-center justify-center z-50 p-4 animate-modal-fade-in">
      {modalStyles}
      <div className="bg-white dark:bg-[#13151f] rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800/80 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-modal-slide-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-150 dark:border-slate-800/60 flex items-center justify-between bg-white dark:bg-[#13151f] shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-base">Edit Alert Channel</h2>
            <p className="text-xs text-gray-450 dark:text-slate-500 mt-0.5">Modify settings and credentials for this channel</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800/60 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              Channel Name <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              className="input w-full"
              placeholder="e.g. Engineering On-Call Alerts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Channel Type</label>
            <div className="px-4 py-3 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 text-xs font-semibold text-gray-550 dark:text-slate-400 flex items-center gap-2 capitalize">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              {CHANNEL_LABELS[type]} (Type cannot be modified)
            </div>
          </div>

          {/* Mail Channel Type Selector (Normal vs Service Owner) */}
          {type === "email" && (
            <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-slate-800/60">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                Mail Routing Configuration
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1 bg-gray-50 dark:bg-slate-800/40 p-1 rounded-xl border border-gray-150 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setChannelType("normal")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold tracking-wide transition-all ${
                    channelType === "normal"
                      ? "bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-150 dark:border-slate-800"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                  }`}
                >
                  Normal (Static Recipients)
                </button>
                <button
                  type="button"
                  onClick={() => setChannelType("service_owner")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold tracking-wide transition-all ${
                    channelType === "service_owner"
                      ? "bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-150 dark:border-slate-800"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                  }`}
                >
                  Service Owner Creds
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Fields - Renders immediately */}
          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-slate-800/60">
            {type === "teams" && (
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
            {type === "email" && channelType === "service_owner" && (
              <div className="bg-indigo-50/50 dark:bg-indigo-500/[0.03] border border-indigo-150 dark:border-indigo-500/20 p-4 rounded-2xl flex items-start gap-3 select-none">
                <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <p className="text-xs font-bold text-indigo-800 dark:text-indigo-400">Dynamic Service Owners Routing Active</p>
                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/70 leading-relaxed">
                    By configuring this as a Service Owner channel, alert emails will route dynamically to the matched owners and CC/BCC settings of each individual service on the Service Owners registry.
                  </p>
                </div>
              </div>
            )}
            {FIELDS[type].filter((f) => {
              if (type === "email") {
                if (channelType === "service_owner" && (f.key === "to" || f.key === "cc" || f.key === "bcc")) {
                  return false;
                }
              }
              if (type !== "whatsapp") return true;
              const prov = cfg.provider || "twilio";
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
                  <div className="grid grid-cols-2 gap-2 mt-1 bg-gray-50 dark:bg-slate-800/40 p-1 rounded-xl border border-gray-150 dark:border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => set("provider", "twilio")}
                      className={`py-2 px-3 rounded-lg text-xs font-bold tracking-wide transition-all ${
                        (cfg.provider || "twilio") === "twilio"
                          ? "bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-150 dark:border-slate-800"
                          : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                      }`}
                    >
                      Twilio API
                    </button>
                    <button
                      type="button"
                      onClick={() => set("provider", "meta")}
                      className={`py-2 px-3 rounded-lg text-xs font-bold tracking-wide transition-all ${
                        cfg.provider === "meta"
                          ? "bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-150 dark:border-slate-800"
                          : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                      }`}
                    >
                      Meta Cloud API
                    </button>
                  </div>
                ) : (
                  <input
                    type={f.secret ? "password" : "text"}
                    className="input w-full"
                    placeholder={f.placeholder}
                    value={cfg[f.key] || ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
                {f.hint && <p className="text-[10px] text-gray-450 dark:text-slate-500 mt-1 pl-1">{f.hint}</p>}
              </div>
            ))}


          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800/60 bg-gray-50/50 dark:bg-[#13151f] flex gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancel</button>
          <button
            onClick={submit}
            disabled={!isFormValid() || saving}
            className="btn-primary flex-1 justify-center py-2.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
