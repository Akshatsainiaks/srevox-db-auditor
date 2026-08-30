"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Copy, Key, RefreshCw, Crown, Shield, Eye, Loader2, X } from "lucide-react";
import { api, fetchUser } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { copyToClipboard } from "@/lib/utils";

interface Member {
  user_id: string;
  email: string;
  full_name?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  admin: Crown,
  member: Shield,
  viewer: Eye,
};

export default function EditUserModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [member, setMember] = useState<Member | null>(null);
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState(generatePassword());
  const [notifyUserReset, setNotifyUserReset] = useState(true);
  const [resetDone, setResetDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    fetchUser(userId)
      .then((user) => {
        setMember(user);
        setRole(user.role);
        setEmail(user.email || "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const save = async () => {
    if (!member) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      error("Email address cannot be empty");
      return;
    }
    setSaving(true);
    try {
      if (cleanEmail !== member.email) {
        await api.patch(`/api/users/${member.user_id}/email`, { email: cleanEmail });
      }
      if (role !== member.role) {
        await api.patch(`/api/users/${member.user_id}/role`, { role });
      }
      success("Member updated successfully");
      onSaved();
      onClose();
    } catch (err: any) {
      error(err?.response?.data?.detail || "Failed to update member details");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!member || !newPassword) return;
    setResetting(true);
    try {
      await api.post(`/api/users/${member.user_id}/reset-password`, {
        password: newPassword,
        send_email: notifyUserReset
      });
      setResetDone(true);
      success("Password reset!", `Temporary password generated for ${member.email}`);
    } catch {
      error("Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  const copyPass = async () => {
    if (!newPassword) return;
    await copyToClipboard(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regen = () => setNewPassword(generatePassword());

  if (loading || !member) {
    return (
      <div className="fixed inset-0 bg-[#07080d]/75 backdrop-blur-[6px] flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-[#13151f] rounded-3xl p-8 border border-gray-100 dark:border-slate-800/80 shadow-2xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2130] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-white">Edit team member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-655 text-xl"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* User Info */}
          <div className="space-y-1">
            <label className="label">Email address</label>
            <input 
              className="input w-full" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="user@email.com" 
              disabled={saving}
            />
          </div>

          {/* Change Role Section */}
          <div className="space-y-2">
            <label className="label">Change Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(["admin", "member", "viewer"] as const).map((r) => {
                const Icon = ROLE_ICONS[r];
                return (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold capitalize transition-all ${
                      role === r
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                        : "border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-55 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset Password Section */}
          <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-3">
            <label className="label">Password Management</label>
            {!showReset ? (
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="btn-secondary w-full justify-center text-xs gap-1.5 py-2 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-200 dark:hover:border-amber-500/20"
              >
                <Key className="w-3.5 h-3.5" />
                Reset password
              </button>
            ) : resetDone ? (
              <div className="space-y-2.5">
                <div className="bg-green-50 dark:bg-green-500/10 rounded-xl p-3 border border-green-150 dark:border-green-500/20 text-xs text-green-800 dark:text-green-300 font-semibold">
                  Password reset successfully!
                </div>
                <div className="bg-gray-55 dark:bg-slate-800 rounded-xl p-3 border border-gray-150 dark:border-slate-850">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 mb-1 uppercase tracking-wider">New Password:</p>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm text-gray-800 dark:text-slate-200 flex-1">{newPassword}</code>
                    <button type="button" onClick={copyPass} className="text-gray-400 hover:text-gray-655 dark:hover:text-slate-300 transition-colors">
                      {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    className="input pr-20 font-mono text-xs py-2"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <div className="absolute right-2.5 flex items-center gap-1.5">
                    <button type="button" onClick={regen} title="Regenerate" className="text-gray-400 hover:text-indigo-500 transition-colors p-1 shrink-0">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={copyPass} className="text-gray-400 hover:text-gray-655 dark:hover:text-slate-300 transition-colors p-1 shrink-0">
                      {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    id="notify-user-reset-checkbox"
                    className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    checked={notifyUserReset}
                    onChange={(e) => setNotifyUserReset(e.target.checked)}
                  />
                  <label htmlFor="notify-user-reset-checkbox" className="text-xs font-semibold text-gray-700 dark:text-slate-300 cursor-pointer">
                    Notify user via email
                  </label>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowReset(false)} className="btn-secondary flex-1 py-1.5 text-xs justify-center">Cancel</button>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={resetting || !newPassword}
                    className="btn-primary flex-1 py-1.5 text-xs justify-center"
                  >
                    {resetting ? "Resetting..." : "Confirm Reset"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Save / Cancel Footer */}
          <div className="flex gap-3 border-t border-gray-100 dark:border-slate-800 pt-4">
            {resetDone && role === member.role ? (
              <button
                type="button"
                onClick={onClose}
                className="btn-primary w-full justify-center"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary flex-1"
                >
                  {resetDone ? "Close" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || (role === member.role && email === member.email)}
                  className="btn-primary flex-1 justify-center"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
