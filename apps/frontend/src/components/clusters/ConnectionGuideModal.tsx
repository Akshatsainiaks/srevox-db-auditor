"use client";

import { useState } from "react";
import {
  BookOpen, X, Activity, Check, Copy, Radio, Server
} from "lucide-react";
import { type Cluster, copyToClipboard } from "@/lib/utils";

interface ConnectionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  cluster: Cluster | null;
}

export default function ConnectionGuideModal({
  isOpen,
  onClose,
  cluster
}: ConnectionGuideModalProps) {
  const [activeGuideTab, setActiveGuideTab] = useState<"agent" | "token" | "kubeconfig">("agent");
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  const copyStepText = async (stepId: string, text: string) => {
    await copyToClipboard(text);
    setCopiedStep(stepId);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Cluster Connection Guide</h3>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Instructions and manifests to hook your cluster into Srevox</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-400 hover:text-gray-655 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs Selector */}
        <div className="flex border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/10 shrink-0 select-none p-1">
          {[
            { id: "agent", label: "Agent (On-Prem)", desc: "Tiny outbound-only pod inside your cluster." },
            { id: "token", label: "Service Account Token", desc: "For real-time CPU & memory metrics." },
            { id: "kubeconfig", label: "Kubeconfig File", desc: "Remote API server connection." }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveGuideTab(tab.id as any);
                setCopiedStep(null);
              }}
              className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 border ${
                activeGuideTab === tab.id
                  ? "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-indigo-655 dark:text-indigo-400"
                  : "border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-650 dark:hover:text-slate-355"
              }`}
            >
              <span className="text-xs font-bold">{tab.label}</span>
              <span className="text-[9px] font-normal opacity-70 hidden sm:inline">{tab.desc}</span>
            </button>
          ))}
        </div>

        {/* Modal Body Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
          
          {/* TAB 1: WATCHER AGENT */}
          {activeGuideTab === "agent" && (
            <div className="space-y-5">
              <div className="bg-indigo-500/[0.02] border border-dashed border-indigo-500/15 rounded-2xl p-4 flex gap-3">
                <Activity className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-gray-800 dark:text-slate-200">Go Event Watcher Agent (Outbound Only)</span>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                    Srevox Agent will watch Kubernetes API Server events, detect warning states (e.g. CrashLoopBackOff, FailedScheduling, OutOfDisk), and report them instantly to Srevox backend. It does not require any inbound public access or open ports.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] text-gray-405 uppercase tracking-wider">Step 1: Deploy Watcher Agent Pod</span>
                    <button
                      onClick={() => copyStepText("agent-1", "kubectl apply -f https://raw.githubusercontent.com/Akshatsainiaks/srevox-setup/main/srevox-agent.yml")}
                      className="text-[10px] text-indigo-500 hover:text-indigo-655 transition-colors flex items-center gap-1 font-bold"
                    >
                      {copiedStep === "agent-1" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Command
                    </button>
                  </div>
                  <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 rounded-xl p-3.5 font-mono text-gray-800 dark:text-white overflow-x-auto text-[11px] leading-relaxed select-all">
                    kubectl apply -f https://raw.githubusercontent.com/Akshatsainiaks/srevox-setup/main/srevox-agent.yml
                  </pre>
                </div>

                {/* Step 2 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] text-gray-405 uppercase tracking-wider">Step 2: Inject Srevox Credentials Environment</span>
                    <button
                      onClick={() => copyStepText("agent-2", `kubectl set env deployment/srevox-agent -n kube-system \\\n  REDIS_URL="redis://YOUR_SREVOX_REDIS_IP:6379" \\\n  CLUSTER_ID="YOUR_CLUSTER_ID" \\\n  CLUSTER_NAME="YOUR_CLUSTER_NAME" \\\n  AGENT_TOKEN="YOUR_AGENT_TOKEN"`)}
                      className="text-[10px] text-indigo-500 hover:text-indigo-655 transition-colors flex items-center gap-1 font-bold"
                    >
                      {copiedStep === "agent-2" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Command Template
                    </button>
                  </div>
                  <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 rounded-xl p-3.5 font-mono text-gray-800 dark:text-white overflow-x-auto text-[11px] leading-relaxed select-all">
                    kubectl set env deployment/srevox-agent -n kube-system \{"\n"}
                    {"  "}REDIS_URL="redis://YOUR_SREVOX_REDIS_IP:6379" \{"\n"}
                    {"  "}CLUSTER_ID="YOUR_CLUSTER_ID" \{"\n"}
                    {"  "}CLUSTER_NAME="YOUR_CLUSTER_NAME" \{"\n"}
                    {"  "}AGENT_TOKEN="YOUR_AGENT_TOKEN"
                  </pre>

                  <p className="text-[10px] text-amber-500 dark:text-amber-400 font-semibold leading-relaxed mt-1">
                    ⚠️ Replace YOUR_SREVOX_REDIS_IP, YOUR_CLUSTER_ID, YOUR_CLUSTER_NAME, and YOUR_AGENT_TOKEN with your cluster environment values.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] text-gray-405 uppercase tracking-wider">Step 3: Confirm Watcher Status</span>
                    <button
                      onClick={() => copyStepText("agent-3", "kubectl logs -n kube-system deployment/srevox-agent -f")}
                      className="text-[10px] text-indigo-500 hover:text-indigo-655 transition-colors flex items-center gap-1 font-bold"
                    >
                      {copiedStep === "agent-3" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Command
                    </button>
                  </div>
                  <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 rounded-xl p-3.5 font-mono text-gray-800 dark:text-white overflow-x-auto text-[11px] leading-relaxed select-all">
                    kubectl logs -n kube-system deployment/srevox-agent -f
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SERVICE ACCOUNT */}
          {activeGuideTab === "token" && (
            <div className="space-y-6">
              <div className="bg-emerald-500/[0.02] border border-dashed border-emerald-500/15 rounded-2xl p-4 flex gap-3">
                <Radio className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-gray-800 dark:text-slate-200">Srevox Metrics Connection — Setup & Troubleshooting Guide</span>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                    This guide configures a Kubernetes Service Account (`srevox-metrics` in `kube-system`) so Srevox can query node/pod CPU & memory metrics via Service Account Token authentication, and fixes 403 RBAC / metrics-server issues.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Step 1: Prerequisites */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] text-gray-405 uppercase tracking-wider">Step 1: Prerequisites Check (metrics-server)</span>
                    <button
                      onClick={() => copyStepText("token-1", "kubectl get pods -n kube-system | grep metrics-server\nkubectl get apiservice v1beta1.metrics.k8s.io\nkubectl top nodes")}
                      className="text-[10px] text-indigo-500 hover:text-indigo-655 transition-colors flex items-center gap-1 font-bold"
                    >
                      {copiedStep === "token-1" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Check Commands
                    </button>
                  </div>
                  <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 rounded-xl p-3 font-mono text-gray-800 dark:text-white overflow-x-auto text-[11px] leading-relaxed select-all">
                    kubectl get pods -n kube-system | grep metrics-server{"\n"}
                    kubectl get apiservice v1beta1.metrics.k8s.io{"\n"}
                    kubectl top nodes
                  </pre>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1">
                    If <code className="text-amber-500 font-mono">kubectl top nodes</code> fails:
                  </p>
                  <div className="space-y-2 pl-2 border-l-2 border-amber-500/30">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">If metrics-server is missing:</span>
                      <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 rounded-lg p-2 font-mono text-[10px] select-all">
                        kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">If installed on self-signed clusters (k3s, RKE2, bare-metal):</span>
                      <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 rounded-lg p-2 font-mono text-[10px] select-all">
                        kubectl patch deployment metrics-server -n kube-system --type='json' -p='[{"{"}"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"{"}"}]'
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Step 2: Create Service Account */}
                <div className="space-y-1.5 border-t border-gray-100 dark:border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] text-gray-405 uppercase tracking-wider">Step 2: Create Service Account</span>
                    <button
                      onClick={() => copyStepText("token-2", "kubectl create serviceaccount srevox-metrics -n kube-system")}
                      className="text-[10px] text-indigo-500 hover:text-indigo-655 transition-colors flex items-center gap-1 font-bold"
                    >
                      {copiedStep === "token-2" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Command
                    </button>
                  </div>
                  <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 rounded-xl p-3 font-mono text-gray-800 dark:text-white overflow-x-auto text-[11px] leading-relaxed select-all">
                    kubectl create serviceaccount srevox-metrics -n kube-system
                  </pre>
                </div>

                {/* Step 3: ClusterRole with Both metrics.k8s.io and Core API */}
                <div className="space-y-1.5 border-t border-gray-100 dark:border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] text-gray-405 uppercase tracking-wider">Step 3: Create ClusterRole (metrics.k8s.io & Core API)</span>
                    <button
                      onClick={() => copyStepText("token-3", `cat <<EOF | kubectl apply -f -\napiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRole\nmetadata:\n  name: srevox-metrics-role\nrules:\n- apiGroups: ["metrics.k8s.io"]\n  resources: ["pods", "nodes"]\n  verbs: ["get", "list"]\n- apiGroups: [""]\n  resources: ["nodes", "pods"]\n  verbs: ["get", "list", "watch"]\nEOF`)}
                      className="text-[10px] text-indigo-500 hover:text-indigo-655 transition-colors flex items-center gap-1 font-bold"
                    >
                      {copiedStep === "token-3" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Manifest
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400">
                    ⚠️ Srevox needs <strong>both</strong> <code className="font-mono text-indigo-400">metrics.k8s.io</code> (for CPU/mem) and core <code className="font-mono text-indigo-400">""</code> API (for node metadata). Missing core API causes 403 forbidden errors.
                  </p>
                  <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 rounded-xl p-3 font-mono text-gray-800 dark:text-white overflow-x-auto text-[11px] leading-relaxed select-all">
                    cat &lt;&lt;EOF | kubectl apply -f -{"\n"}
                    apiVersion: rbac.authorization.k8s.io/v1{"\n"}
                    kind: ClusterRole{"\n"}
                    metadata:{"\n"}
                    {"  "}name: srevox-metrics-role{"\n"}
                    rules:{"\n"}
                    - apiGroups: ["metrics.k8s.io"]{"\n"}
                    {"  "}resources: ["pods", "nodes"]{"\n"}
                    {"  "}verbs: ["get", "list"]{"\n"}
                    - apiGroups: [""]{"\n"}
                    {"  "}resources: ["nodes", "pods"]{"\n"}
                    {"  "}verbs: ["get", "list", "watch"]{"\n"}
                    EOF
                  </pre>
                </div>

                {/* Step 4: ClusterRoleBinding */}
                <div className="space-y-1.5 border-t border-gray-100 dark:border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] text-gray-405 uppercase tracking-wider">Step 4: Bind Role to Service Account</span>
                    <button
                      onClick={() => copyStepText("token-4", `cat <<EOF | kubectl apply -f -\napiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRoleBinding\nmetadata:\n  name: srevox-metrics-binding\nroleRef:\n  apiGroup: rbac.authorization.k8s.io\n  kind: ClusterRole\n  name: srevox-metrics-role\nsubjects:\n- kind: ServiceAccount\n  name: srevox-metrics\n  namespace: kube-system\nEOF`)}
                      className="text-[10px] text-indigo-500 hover:text-indigo-655 transition-colors flex items-center gap-1 font-bold"
                    >
                      {copiedStep === "token-4" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Binding Manifest
                    </button>
                  </div>
                  <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 rounded-xl p-3 font-mono text-gray-800 dark:text-white overflow-x-auto text-[11px] leading-relaxed select-all">
                    cat &lt;&lt;EOF | kubectl apply -f -{"\n"}
                    apiVersion: rbac.authorization.k8s.io/v1{"\n"}
                    kind: ClusterRoleBinding{"\n"}
                    metadata:{"\n"}
                    {"  "}name: srevox-metrics-binding{"\n"}
                    roleRef:{"\n"}
                    {"  "}apiGroup: rbac.authorization.k8s.io{"\n"}
                    {"  "}kind: ClusterRole{"\n"}
                    {"  "}name: srevox-metrics-role{"\n"}
                    subjects:{"\n"}
                    - kind: ServiceAccount{"\n"}
                    {"  "}name: srevox-metrics{"\n"}
                    {"  "}namespace: kube-system{"\n"}
                    EOF
                  </pre>
                </div>

                {/* Step 5: Verification Commands */}
                <div className="space-y-1.5 border-t border-gray-100 dark:border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] text-gray-405 uppercase tracking-wider">Step 5: Verify Permissions (kubectl auth can-i)</span>
                    <button
                      onClick={() => copyStepText("token-5", "kubectl auth can-i get pods.metrics.k8s.io --as=system:serviceaccount:kube-system:srevox-metrics\nkubectl auth can-i get nodes.metrics.k8s.io --as=system:serviceaccount:kube-system:srevox-metrics\nkubectl auth can-i list nodes --as=system:serviceaccount:kube-system:srevox-metrics\nkubectl auth can-i list pods --all-namespaces --as=system:serviceaccount:kube-system:srevox-metrics")}
                      className="text-[10px] text-indigo-500 hover:text-indigo-655 transition-colors flex items-center gap-1 font-bold"
                    >
                      {copiedStep === "token-5" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Verification Commands
                    </button>
                  </div>
                  <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 rounded-xl p-3 font-mono text-gray-800 dark:text-white overflow-x-auto text-[11px] leading-relaxed select-all">
                    kubectl auth can-i get pods.metrics.k8s.io   --as=system:serviceaccount:kube-system:srevox-metrics{"\n"}
                    kubectl auth can-i get nodes.metrics.k8s.io  --as=system:serviceaccount:kube-system:srevox-metrics{"\n"}
                    kubectl auth can-i list nodes                --as=system:serviceaccount:kube-system:srevox-metrics{"\n"}
                    kubectl auth can-i list pods --all-namespaces --as=system:serviceaccount:kube-system:srevox-metrics
                  </pre>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✅ All four must return "yes".
                  </p>
                </div>

                {/* Step 6: Token Generation */}
                <div className="space-y-1.5 border-t border-gray-100 dark:border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] text-gray-405 uppercase tracking-wider">Step 6: Generate Token (1-Year Duration)</span>
                    <button
                      onClick={() => copyStepText("token-6", "kubectl create token srevox-metrics -n kube-system --duration=8760h")}
                      className="text-[10px] text-indigo-500 hover:text-indigo-655 transition-colors flex items-center gap-1 font-bold"
                    >
                      {copiedStep === "token-6" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Command
                    </button>
                  </div>
                  <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 rounded-xl p-3 font-mono text-gray-800 dark:text-white overflow-x-auto text-[11px] leading-relaxed select-all">
                    kubectl create token srevox-metrics -n kube-system --duration=8760h
                  </pre>
                </div>

                {/* Step 7 & 8: Troubleshooting 403 */}
                <div className="space-y-2 border-t border-gray-100 dark:border-slate-800/80 pt-3">
                  <span className="font-bold text-[10px] text-gray-405 uppercase tracking-wider">Step 7 & 8: Troubleshooting 403 Forbidden Errors</span>
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2 text-[11px]">
                    <p className="text-amber-700 dark:text-amber-300 font-semibold">
                      If Srevox reports a 403 Forbidden error, read the exact missing resource/apiGroup in the message field:
                    </p>
                    <pre className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 rounded-lg p-2 font-mono text-[10px] text-gray-800 dark:text-slate-200 select-all">
                      # To grant namespaces, events, or apps access if requested:{"\n"}
                      - apiGroups: [""]{"\n"}
                      {"  "}resources: ["namespaces", "events"]{"\n"}
                      {"  "}verbs: ["get", "list", "watch"]{"\n"}
                      - apiGroups: ["apps"]{"\n"}
                      {"  "}resources: ["deployments", "replicasets", "statefulsets", "daemonsets"]{"\n"}
                      {"  "}verbs: ["get", "list", "watch"]
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: KUBECONFIG */}
          {activeGuideTab === "kubeconfig" && (
            <div className="space-y-5">
              <div className="bg-blue-500/[0.02] border border-dashed border-blue-500/15 rounded-2xl p-4 flex gap-3">
                <Server className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-gray-800 dark:text-slate-200">Remote API Access via Kubeconfig File</span>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                    Alternatively, upload your cluster's Kubeconfig YAML descriptor (contains context server IPs, API ports, certificates, and credentials) to let Srevox API client hook remotely.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="font-bold text-[10px] text-gray-405 uppercase tracking-wider">Step 1: Retrieve Kubeconfig File</span>
                  <p className="text-gray-550 dark:text-slate-450 leading-relaxed text-[11px]">
                    Find your configuration file locally. On macOS and Linux systems, this file is normally stored in your home directory path:
                    <code className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800/85 px-1.5 py-0.5 rounded mx-1 text-red-555 font-mono text-[10px]">~/.kube/config</code>.
                  </p>
                </div>

                <div className="space-y-1.5 border-t border-gray-100 dark:border-slate-800/80 pt-3">
                  <span className="font-bold text-[10px] text-gray-405 uppercase tracking-wider">Step 2: Submit YAML in Settings</span>
                  <p className="text-gray-550 dark:text-slate-455 leading-relaxed text-[11px]">
                    Copy the contents of that config file and paste it in the **Metrics Connection** section on this settings page. Choose **Kubeconfig** tab, paste the YAML, and click **Save & Test Connection**.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
