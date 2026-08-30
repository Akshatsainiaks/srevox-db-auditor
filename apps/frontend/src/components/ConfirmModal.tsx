"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  requirePassword?: boolean;
}

interface ConfirmContextType {
  confirm: (opts: ConfirmOptions) => Promise<{ confirmed: boolean; password?: string }>;
}

const ConfirmContext = createContext<ConfirmContextType>({ confirm: async () => ({ confirmed: false }) });
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    opts: ConfirmOptions;
    resolve: (v: { confirmed: boolean; password?: string }) => void;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<{ confirmed: boolean; password?: string }>((resolve) => {
      setPassword("");
      setState({ open: true, opts, resolve });
    });
  }, []);

  const handleConfirm = async () => {
    if (!state) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 150));
    state.resolve({ confirmed: true, password: password || undefined });
    setState(null);
    setLoading(false);
  };

  const handleCancel = () => {
    if (!state) return;
    state.resolve({ confirmed: false });
    setState(null);
  };

  const variantStyles = {
    danger:  { icon: Trash2,        iconBg: "bg-red-100 dark:bg-red-500/10",    iconColor: "text-red-600 dark:text-red-400",    btn: "bg-red-600 hover:bg-red-500 text-white" },
    warning: { icon: AlertTriangle, iconBg: "bg-amber-100 dark:bg-amber-500/10",iconColor: "text-amber-600 dark:text-amber-400",btn: "bg-amber-600 hover:bg-amber-500 text-white" },
    info:    { icon: AlertTriangle, iconBg: "bg-indigo-100 dark:bg-indigo-500/10",iconColor:"text-indigo-600 dark:text-indigo-400",btn:"bg-indigo-600 hover:bg-indigo-500 text-white"},
  };

  if (!state?.open) return <ConfirmContext.Provider value={{ confirm }}>{children}</ConfirmContext.Provider>;

  const s = variantStyles[state.opts.variant || "danger"];
  const Icon = s.icon;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1e2130] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-md overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${s.iconBg}`}>
                <Icon className={`w-6 h-6 ${s.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">{state.opts.title}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">{state.opts.message}</p>
              </div>
              <button onClick={handleCancel} className="text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-300 transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {state.opts.requirePassword && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  Enter your password to confirm
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="Your current password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleConfirm()}
                />
              </div>
            )}
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button onClick={handleCancel} className="btn-secondary flex-1 justify-center">
              {state.opts.cancelLabel || "Cancel"}
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || (state.opts.requirePassword && !password)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${s.btn}`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {state.opts.confirmLabel || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </ConfirmContext.Provider>
  );
}