"use client";
import React, { useState, useEffect } from "react";
import { Zap, CheckCircle, Loader2, Key, Edit, Trash2, X, ShieldAlert, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";

const AI_PROVIDERS = [
  { value: "groq",      label: "Groq",      desc: "Free, fast inference",     models: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "mixtral-8x7b-32768"] },
  { value: "openai",    label: "OpenAI",    desc: "GPT-4o, GPT-4o-mini",      models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"] },
  { value: "anthropic", label: "Anthropic", desc: "Claude models",            models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-5", "claude-opus-4"] },
  { value: "ollama",    label: "Ollama",    desc: "Local / air-gapped",       models: ["llama3", "llama3.2:1b", "tinyllama", "mistral"] },
];

export default function AiSettingsPage() {
  const { success, error } = useToast();

  const [activeProvider, setActiveProvider] = useState("groq");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [models, setModels] = useState({
    groq: "llama-3.1-8b-instant",
    openai: "gpt-4o-mini",
    anthropic: "claude-sonnet-4-5",
    ollama: "llama3"
  });
  const [keysConfigured, setKeysConfigured] = useState({
    groq: false,
    openai: false,
    anthropic: false
  });

  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState("");
  const [inputModel, setInputModel] = useState("");
  const [inputOllamaUrl, setInputOllamaUrl] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadSettings = () => {
    api.get("/api/ai-settings").then(r => {
      setActiveProvider(r.data.provider || "groq");
      setOllamaUrl(r.data.ollama_url || "http://localhost:11434");
      setModels(r.data.models || {
        groq: "llama-3.1-8b-instant",
        openai: "gpt-4o-mini",
        anthropic: "claude-sonnet-4-5",
        ollama: "llama3"
      });
      setKeysConfigured(r.data.keys_configured || { groq: false, openai: false, anthropic: false });
    }).catch(() => {});
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const setDefaultProvider = async (providerName: string) => {
    try {
      await api.post("/api/ai-settings", {
        provider: providerName,
        model: models[providerName as keyof typeof models]
      });
      success(`${providerName === "anthropic" ? "Claude" : providerName.toUpperCase()} set as default active provider`);
      loadSettings();
    } catch {
      error("Failed to update active provider");
    }
  };

  const startEditing = (providerId: string) => {
    setEditingProvider(providerId);
    setInputKey("");
    setInputModel(models[providerId as keyof typeof models]);
    setInputOllamaUrl(ollamaUrl);
  };

  const saveProviderConfig = async (providerId: string) => {
    setSavingId(providerId);
    try {
      const payload: Record<string, string> = {
        provider: activeProvider
      };
      
      if (providerId === "groq") {
        payload.model_groq = inputModel;
        if (inputKey.trim()) payload.api_key_groq = inputKey;
      } else if (providerId === "openai") {
        payload.model_openai = inputModel;
        if (inputKey.trim()) payload.api_key_openai = inputKey;
      } else if (providerId === "anthropic") {
        payload.model_anthropic = inputModel;
        if (inputKey.trim()) payload.api_key_anthropic = inputKey;
      } else if (providerId === "ollama") {
        payload.model_ollama = inputModel;
        payload.ollama_url = inputOllamaUrl;
      }

      await api.post("/api/ai-settings", payload);
      success(`${providerId === "anthropic" ? "Claude" : providerId.toUpperCase()} configuration updated`);
      setEditingProvider(null);
      loadSettings();
    } catch {
      error("Failed to save configuration");
    } finally {
      setSavingId(null);
    }
  };

  const removeKey = async (providerId: string) => {
    try {
      const payload: Record<string, string> = {
        provider: activeProvider
      };
      if (providerId === "groq") payload.api_key_groq = "REMOVE";
      else if (providerId === "openai") payload.api_key_openai = "REMOVE";
      else if (providerId === "anthropic") payload.api_key_anthropic = "REMOVE";

      await api.post("/api/ai-settings", payload);
      success(`${providerId === "anthropic" ? "Claude" : providerId.toUpperCase()} API Key removed`);
      loadSettings();
    } catch {
      error("Failed to remove key");
    }
  };

  return (
    <div className="space-y-6 animate-modal-slide-up" style={{ animationDuration: "0.2s" }}>
      <section id="settings-ai" className="card p-6 space-y-5 bg-white dark:bg-[#13151f] border border-gray-150 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/60">
          <div className="w-9 h-9 rounded-xl bg-purple-55/10 dark:bg-purple-500/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">AI Provider Integrations</h2>
            <p className="text-xs text-gray-550 dark:text-slate-400">Configure and manage AI engines to diagnose pod crash telemetry</p>
          </div>
        </div>

        <div className="space-y-4">
          {AI_PROVIDERS.map(p => {
            const isActive = activeProvider === p.value;
            const modelVal = models[p.value as keyof typeof models];
            const isKeyBased = p.value !== "ollama";
            const isConfigured = isKeyBased 
              ? keysConfigured[p.value as keyof typeof keysConfigured] 
              : !!ollamaUrl;

            return (
              <div key={p.value} className={`p-4 border rounded-2xl transition-all ${
                isActive 
                  ? "border-indigo-500 bg-indigo-55/[0.02] dark:bg-indigo-500/[0.02] shadow-sm"
                  : "border-gray-150 dark:border-slate-800/50 bg-gray-50/40 dark:bg-slate-900/10"
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-150/40 dark:border-slate-800/40">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800 dark:text-slate-200">{p.label}</span>
                      {isActive && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                          <Check className="w-2.5 h-2.5" /> Default Active
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 leading-normal">{p.desc}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                    {isKeyBased ? (
                      isConfigured ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-500/20">
                          <CheckCircle className="w-3.5 h-3.5 text-green-550" /> Key Configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Missing Key
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-500/20">
                        <CheckCircle className="w-3.5 h-3.5 text-green-550" /> Endpoint Configured
                      </span>
                    )}

                    {editingProvider !== p.value && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEditing(p.value)}
                          className="px-2.5 py-1.5 text-[10px] font-bold text-gray-750 dark:text-slate-200 border border-gray-200 dark:border-slate-800 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" /> Configure
                        </button>
                        
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => setDefaultProvider(p.value)}
                            className="px-2.5 py-1.5 text-[10px] font-bold text-indigo-650 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                          >
                            Set Active
                          </button>
                        )}

                        {isKeyBased && isConfigured && (
                          <button
                            type="button"
                            onClick={() => removeKey(p.value)}
                            className="px-2.5 py-1.5 text-[10px] font-bold text-red-650 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Remove Key
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Form */}
                {editingProvider === p.value && (
                  <div className="mt-3 pt-3 border-t border-gray-150/40 dark:border-slate-800/40 space-y-3 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Model Select */}
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Model</label>
                        <select 
                          className="input w-full py-1.5 text-xs" 
                          value={inputModel} 
                          onChange={e => setInputModel(e.target.value)}
                        >
                          {p.models.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      {/* API Key or Ollama URL Input */}
                      {isKeyBased ? (
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                            API Key {isConfigured && "(Leave blank to keep current)"}
                          </label>
                          <input
                            type="password"
                            className="input w-full py-1.5 text-xs"
                            placeholder="sk-••••••••••••••••••••"
                            value={inputKey}
                            onChange={e => setInputKey(e.target.value)}
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Ollama URL</label>
                          <input
                            type="text"
                            className="input w-full py-1.5 text-xs"
                            placeholder="http://localhost:11434"
                            value={inputOllamaUrl}
                            onChange={e => setInputOllamaUrl(e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => saveProviderConfig(p.value)}
                        disabled={savingId !== null}
                        className="btn-primary py-2 px-3.5 rounded-xl text-xs font-bold justify-center min-w-[100px]"
                      >
                        {savingId === p.value ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                        <span>Save Changes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingProvider(null)}
                        disabled={savingId !== null}
                        className="py-2 px-3.5 rounded-xl text-xs font-bold border border-gray-300 dark:border-slate-700/80 text-gray-750 dark:text-slate-200 bg-gray-50 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800/80 transition-all flex items-center justify-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Show Current Settings Info when NOT editing */}
                {editingProvider !== p.value && (
                  <div className="flex items-center gap-6 mt-2.5 text-[10px] text-gray-400 dark:text-slate-500 font-mono pl-1">
                    <div>Model: <span className="text-gray-650 dark:text-slate-300 font-semibold">{modelVal}</span></div>
                    {!isKeyBased && (
                      <div>URL: <span className="text-gray-650 dark:text-slate-300 font-semibold">{ollamaUrl}</span></div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
