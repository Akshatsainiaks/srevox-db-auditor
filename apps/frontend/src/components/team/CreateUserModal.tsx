"use client";

import { useState } from "react";
import { CheckCircle, Copy, RefreshCw, Crown, Shield, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { copyToClipboard } from "@/lib/utils";

function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  admin: Crown,
  member: Shield,
  viewer: Eye,
};

export default function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ full_name: "", email: "", role: "member" });
  const [generatedPass, setGeneratedPass] = useState(generatePassword());
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);
  const [notifyUser, setNotifyUser] = useState(true);
  const [successData, setSuccessData] = useState<{ email?: string; previewUrl?: string }>({});
  const { success, error } = useToast();

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const copyPass = async () => {
    await copyToClipboard(generatedPass);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const regen = () => setGeneratedPass(generatePassword());
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

  const submit = async (sendEmail: boolean) => {
    if (!isValidEmail || !generatedPass) return;
    setLoading(true);
    setSentEmail(sendEmail);
    try {
      const res = await api.post("/api/users/create", {
        ...form,
        password: generatedPass,
        send_welcome_email: sendEmail
      });
      setSuccessData({ email: form.email, previewUrl: res.data.preview_url });
      success("User created!", sendEmail ? `Welcome email sent to ${form.email}` : undefined);
      onCreated();
      setDone(true);
    } catch (err: any) {
      error("Failed to create user", err?.response?.data?.detail || "Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2130] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Create team member</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Add a new user to your organization</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-100 dark:border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">User created successfully!</p>
                {sentEmail && <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">Welcome email sent to {successData.email}</p>}
              </div>
            </div>
            <div className="bg-gray-55 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Generated/Specified password:</p>
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm text-gray-800 dark:text-slate-200 flex-1">{generatedPass}</code>
                <button onClick={copyPass} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button onClick={onClose} className="btn-primary w-full justify-center">Done</button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" placeholder="Rahul Sharma" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Email address</label>
              <input type="email" className="input" placeholder="rahul@company.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
              {form.email && !isValidEmail && <p className="text-xs text-red-500 mt-1">Please enter a valid email address.</p>}
            </div>
            <div>
              <label className="label">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(["admin", "member", "viewer"] as const).map((r) => {
                  const Icon = ROLE_ICONS[r];
                  return (
                    <button
                      type="button"
                      key={r}
                      onClick={() => set("role", r)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all capitalize ${
                        form.role === r
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                          : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  className="input pr-20 font-mono"
                  value={generatedPass}
                  onChange={(e) => setGeneratedPass(e.target.value)}
                />
                <div className="absolute right-2.5 flex items-center gap-1.5">
                  <button type="button" onClick={regen} title="Regenerate" className="text-gray-400 hover:text-indigo-500 transition-colors p-1 shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={copyPass} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors p-1 shrink-0">
                    {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Write a custom password or use the generated one.</p>
            </div>
            <div className="flex items-center gap-2 select-none pt-1">
              <input
                type="checkbox"
                id="notify-user-checkbox"
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                checked={notifyUser}
                onChange={(e) => setNotifyUser(e.target.checked)}
              />
              <label htmlFor="notify-user-checkbox" className="text-xs font-semibold text-gray-700 dark:text-slate-300 cursor-pointer">
                Notify user via email
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="button" onClick={() => submit(notifyUser)} disabled={!isValidEmail || !generatedPass || loading} className="btn-primary flex-1 justify-center">
                {loading ? "Creating..." : "Create user"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
