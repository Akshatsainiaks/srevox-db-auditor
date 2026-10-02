"use client";

import { useState } from "react";
import { Loader2, X, Info, Mail, MessageSquare, Phone, Webhook, Settings } from "lucide-react";
import { createChannel } from "@/lib/api";
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
    { key: "from", label: "From Email Address", placeholder: "alerts@company.com", required: true },
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

export default function AddModal({
  onClose,
  onAdded
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType | null>(null);
  const [whatsappProvider, setWhatsappProvider] = useState<"twilio" | "meta" | null>(null);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const set = (k: string, v: string) => setCfg((p) => ({ ...p, [k]: v }));

  const isFormValid = () => {
    if (!name.trim()) return false;
    if (!type) return false;
    if (type === "whatsapp" && !whatsappProvider) return false;

    const displayedFields = FIELDS[type].filter((f) => {
      if (type !== "whatsapp") return true;
      if (f.key === "provider" || f.key === "to") return true;
      if (whatsappProvider === "meta") {
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
    if (!isFormValid() || !type) return;

    setLoading(true);
    try {
      const finalConfig = { ...cfg };
      if (type === "whatsapp") {
        finalConfig.provider = whatsappProvider || "twilio";
      }

      await createChannel({
        name: name.trim(),
        type,
        config: finalConfig,
        channel_type: "normal",
        is_global_default: false,
      });

      success("Channel created", `Alert channel "${name}" has been configured.`);
      onAdded();
      onClose();
    } catch (err: any) {
      error("Failed to add channel", err.response?.data?.detail || err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-modal-fade-in">
      {modalStyles}
      <div 
        className="w-full max-w-lg bg-white dark:bg-[#11131a] border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-modal-slide-up"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800/60 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">Add Alert Channel</h3>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Route system alerts and notifications</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Channel Name */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              Channel Name <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              className="input w-full"
              placeholder="e.g. Production Alerts, Database Monitoring"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Primary Type Selection Grid */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              Channel Platform <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  id: "email",
                  label: "Email (SMTP)",
                  description: "Direct email alerts via SMTP",
                  icon: Mail,
                  colorClass: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                },
                {
                  id: "teams",
                  label: "Microsoft Teams",
                  description: "Incoming Webhook integration",
                  icon: MessageSquare,
                  colorClass: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                },
                {
                  id: "whatsapp",
                  label: "WhatsApp",
                  description: "Twilio or Meta Cloud API",
                  icon: Phone,
                  colorClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                },
                {
                  id: "webhook",
                  label: "Custom Webhook",
                  description: "HTTP POST payloads",
                  icon: Webhook,
                  colorClass: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
                }
              ].map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setType(item.id as ChannelType);
                      setCfg({});
                      setWhatsappProvider(null);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-start gap-3 select-none relative group ${
                      type === item.id
                        ? "border-indigo-500 bg-indigo-500/[0.03] dark:bg-indigo-500/10 ring-1 ring-indigo-500 shadow-sm"
                        : "border-gray-200 dark:border-slate-800/80 bg-white dark:bg-[#151724]/30 hover:border-gray-300 dark:hover:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-900/40"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl shrink-0 ${item.colorClass}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.label}</h4>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-tight line-clamp-2">{item.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* WhatsApp provider selection */}
          {type === "whatsapp" && (
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800/60 animate-modal-fade-in">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                WhatsApp Provider
              </label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                {[
                  {
                    id: "twilio",
                    label: "Twilio API",
                    description: "Connect using Twilio credentials",
                    icon: Settings,
                    colorClass: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                  },
                  {
                    id: "meta",
                    label: "Meta Cloud API",
                    description: "Direct connection to Meta Cloud",
                    icon: Webhook,
                    colorClass: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                  }
                ].map((prov) => {
                  const ProvIcon = prov.icon;
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => setWhatsappProvider(prov.id as any)}
                      className={`p-3 rounded-2xl border text-left transition-all duration-200 flex items-start gap-3 select-none relative group ${
                        whatsappProvider === prov.id
                          ? "border-indigo-500 bg-indigo-500/[0.02] dark:bg-indigo-500/5 ring-1 ring-indigo-500 shadow-sm"
                          : "border-gray-200 dark:border-slate-800/80 bg-white dark:bg-[#151724]/30 hover:border-gray-300 dark:hover:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-900/40"
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${prov.colorClass}`}>
                        <ProvIcon className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h5 className="text-[11px] font-bold text-gray-900 dark:text-white">{prov.label}</h5>
                        <p className="text-[9px] text-gray-500 dark:text-slate-400 leading-tight">{prov.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dynamic Fields */}
          {type && (type !== "whatsapp" || whatsappProvider !== null) && (
            <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-slate-800/60 animate-modal-fade-in">
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
              {FIELDS[type].filter((f) => {
                if (type !== "whatsapp") return true;
                if (f.key === "provider" || f.key === "to") return true;
                if (whatsappProvider === "meta") {
                  return f.key === "phone_number_id" || f.key === "token";
                } else {
                  return f.key === "account_sid" || f.key === "auth_token" || f.key === "from";
                }
              }).map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                    {f.label} {f.required && <span className="text-red-500 font-bold">*</span>}
                  </label>
                  {f.key === "provider" ? null : (
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
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800/60 bg-gray-50/50 dark:bg-[#13151f] flex gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancel</button>
          <button
            onClick={submit}
            disabled={!isFormValid() || loading}
            className="btn-primary flex-1 justify-center py-2.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Channel"}
          </button>
        </div>
      </div>
    </div>
  );
}
