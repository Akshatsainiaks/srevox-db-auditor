"use client";
import { useEffect, useState } from "react";
import { User, Key, CheckCircle, Loader2, LogOut } from "lucide-react";
import { apiUpdateMe, apiGetMe, apiLogout } from "@/lib/api";
import { getUser, setUser, removeToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { useRouter } from "next/navigation";

export default function ProfileSettingsPage() {
  const localUser = getUser();
  const { success, error } = useToast();
  const { confirm } = useConfirm();
  const router = useRouter();

  const handleSignOut = async () => {
    const { confirmed } = await confirm({
      title: "Sign out of Srevox?",
      message: "Are you sure you want to log out of your session? You will need to log back in to access the workspace.",
      confirmLabel: "Sign Out",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await apiLogout();
    } catch {}
    removeToken();
    router.push("/login");
  };

  const [fullName, setFullName] = useState(localUser?.full_name || "");
  const [initialFullName, setInitialFullName] = useState(localUser?.full_name || "");
  const [email, setEmail] = useState(localUser?.email || "");
  const [initialEmail, setInitialEmail] = useState(localUser?.email || "");
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [updatedPassword, setUpdatedPassword] = useState(false);

  useEffect(() => {
    apiGetMe()
      .then((data) => {
        setFullName(data.full_name || "");
        setInitialFullName(data.full_name || "");
        setEmail(data.email || "");
        setInitialEmail(data.email || "");
      })
      .catch(console.error);
  }, []);

  const saveProfile = async () => {
    if (!fullName.trim()) {
      error("Full name cannot be empty");
      return;
    }
    if (!email.trim()) {
      error("Email address cannot be empty");
      return;
    }
    setSavingProfile(true);
    setSavedProfile(false);
    try {
      await apiUpdateMe({ full_name: fullName, email: email });
      if (localUser) {
        setUser({ ...localUser, full_name: fullName, email: email });
      }
      setInitialFullName(fullName);
      setInitialEmail(email);
      success("Profile updated successfully");
      setSavedProfile(true);
      setIsEditing(false);
      setTimeout(() => setSavedProfile(false), 3000);
    } catch (err: any) {
      error(err?.response?.data?.detail || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancel = () => {
    setFullName(initialFullName);
    setEmail(initialEmail);
    setIsEditing(false);
  };

  const savePassword = async () => {
    if (!curPass || !newPass) return;
    if (newPass.length < 8) {
      error("New password must be at least 8 characters");
      return;
    }
    setUpdatingPassword(true);
    setUpdatedPassword(false);
    try {
      await apiUpdateMe({ current_password: curPass, new_password: newPass });
      setCurPass("");
      setNewPass("");
      success("Password updated successfully");
      setUpdatedPassword(true);
      setTimeout(() => setUpdatedPassword(false), 3000);
    } catch (err: any) {
      error(err?.response?.data?.detail || "Failed to update password");
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6 animate-modal-slide-up" style={{ animationDuration: "0.2s" }}>
      {/* Profile Card */}
      <div id="settings-profile" className="card p-6 space-y-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/60">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <User className="w-4 h-4 text-indigo-650 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Personal Profile</h2>
            <p className="text-xs text-gray-550 dark:text-slate-400">View and update your personal information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Full Name</label>
            <input className="input w-full disabled:opacity-75 disabled:cursor-not-allowed" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" disabled={!isEditing || savingProfile} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Email Address</label>
            <input 
              className="input w-full disabled:opacity-75 disabled:cursor-not-allowed" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="your@email.com" 
              disabled={!isEditing || savingProfile || localUser?.role !== "admin"} 
            />
            {localUser?.role === "admin" ? (
              <p className="text-[10px] text-gray-450 dark:text-slate-500 pl-0.5">Email address can only be changed once every 30 days</p>
            ) : (
              <p className="text-[10px] text-amber-600 dark:text-amber-500 pl-0.5 font-medium">Email address can only be changed by workspace administrators</p>
            )}
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Role</label>
            <input className="input w-full opacity-60 cursor-not-allowed capitalize bg-gray-50 dark:bg-slate-900" value={localUser?.role || ""} disabled />
          </div>
        </div>

        <div className="pt-2 flex items-center gap-2">
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)} 
              className="btn-primary min-w-[150px] justify-center py-2.5"
            >
              Edit Profile
            </button>
          ) : (
            <>
              <button 
                onClick={saveProfile} 
                disabled={savingProfile || !fullName || !email || (fullName === initialFullName && email === initialEmail)} 
                className="btn-primary min-w-[150px] justify-center py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savedProfile ? <><CheckCircle className="w-4 h-4" /> Saved!</>
                  : savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  : "Save Profile"}
              </button>
              <button 
                onClick={handleCancel} 
                disabled={savingProfile} 
                className="py-2.5 px-5 rounded-xl text-xs font-bold border border-gray-300 dark:border-slate-700/80 text-gray-750 dark:text-slate-200 bg-gray-55/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-850 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-40"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Password Card */}
      <div id="settings-password" className="card p-6 space-y-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/60">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
            <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Security & Password</h2>
            <p className="text-xs text-gray-550 dark:text-slate-400">Update your credentials to secure your account</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Current Password</label>
            <input type="password" className="input w-full" value={curPass} onChange={(e) => setCurPass(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">New Password</label>
            <input type="password" className="input w-full" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Min. 8 characters" />
          </div>
        </div>

        <div className="pt-2">
          <button onClick={savePassword} disabled={!curPass || !newPass || updatingPassword} className="btn-primary min-w-[150px] justify-center py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">
            {updatedPassword ? <><CheckCircle className="w-4 h-4" /> Updated!</>
              : updatingPassword ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
              : "Update Password"}
          </button>
        </div>
      </div>

      {/* Sign Out Card */}
      <div id="settings-session" className="card p-6 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Session Management</h2>
            <p className="text-xs text-gray-550 dark:text-slate-400">Log out of your current session on this device</p>
          </div>
        </div>
        <div className="pt-2">
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors active:scale-[0.99]"
          >
            <LogOut className="w-4 h-4" />
            Sign Out of Account
          </button>
        </div>
      </div>
    </div>
  );
}
