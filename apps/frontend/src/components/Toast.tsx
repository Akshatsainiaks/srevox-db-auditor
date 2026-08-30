"use client";
import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { CheckCircle, AlertTriangle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";
interface Toast { id: string; type: ToastType; title: string; message?: React.ReactNode; duration?: number; }
interface ToastCtx { success: (t: string, m?: React.ReactNode) => void; error: (t: string, m?: React.ReactNode) => void; warning: (t: string, m?: React.ReactNode) => void; info: (t: string, m?: React.ReactNode) => void; }

const ToastContext = createContext<ToastCtx>({ success:()=>{}, error:()=>{}, warning:()=>{}, info:()=>{} });
export const useToast = () => useContext(ToastContext);

const STYLES = {
  success: { icon: CheckCircle, bar: "bg-green-500", ring: "ring-green-100 dark:ring-green-500/20", ic: "text-green-500" },
  error:   { icon: XCircle,     bar: "bg-red-500",   ring: "ring-red-100 dark:ring-red-500/20",     ic: "text-red-500" },
  warning: { icon: AlertTriangle,bar:"bg-amber-500", ring: "ring-amber-100 dark:ring-amber-500/20", ic: "text-amber-500" },
  info:    { icon: Info,         bar: "bg-indigo-500",ring: "ring-indigo-100 dark:ring-indigo-500/20",ic:"text-indigo-500" },
};

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
  const s = STYLES[t.type];
  const dur = t.duration || 4000;
  return (
    <div className={`relative flex items-start gap-3 bg-white dark:bg-slate-800 ring-1 ${s.ring} rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/40 px-4 py-3.5 min-w-[300px] max-w-sm animate-in slide-in-from-bottom-2 duration-300`}>
      <s.icon className={`w-5 h-5 shrink-0 mt-0.5 ${s.ic}`} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">{t.title}</p>
        {t.message && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{t.message}</p>}
      </div>
      <button onClick={() => onDismiss(t.id)} className="text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-300 transition-colors mt-0.5">
        <X className="w-4 h-4" />
      </button>
      {/* Progress bar */}
      <div className={`absolute bottom-0 left-0 h-0.5 ${s.bar} rounded-b-2xl`}
        style={{ width: "100%", animation: `shrink ${dur}ms linear forwards` }} />
      <style>{`@keyframes shrink { from { width: 100% } to { width: 0% } }`}</style>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => setToasts(p => p.filter(t => t.id !== id)), []);

  const add = useCallback((type: ToastType, title: string, message?: React.ReactNode, duration = 4000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p, { id, type, title, message, duration }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const success = useCallback((t: string, m?: React.ReactNode) => add("success", t, m), [add]);
  const error = useCallback((t: string, m?: React.ReactNode) => add("error", t, m, 6000), [add]);
  const warning = useCallback((t: string, m?: React.ReactNode) => add("warning", t, m), [add]);
  const info = useCallback((t: string, m?: React.ReactNode) => add("info", t, m), [add]);

  const contextValue = useMemo(() => ({ success, error, warning, info }), [success, error, warning, info]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-2.5 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem t={t} onDismiss={dismiss} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}