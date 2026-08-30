"use client";
import { useState, useRef } from "react";
import { CheckCircle, Upload, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import * as XLSX from "xlsx";

interface Cluster {
  cluster_id: string;
  name: string;
}

interface ParsedService {
  service_name: string;
  namespace?: string;
  status: "ready" | "warning";
  errorMsg?: string;
}

interface ImportResult {
  service_name: string;
  namespace?: string;
  status: "created" | "skipped" | "error";
  detail?: string;
}

export default function ImportModal({
  clusters,
  onClose,
  onAdded,
}: {
  clusters: Cluster[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [clusterId, setClusterId] = useState(clusters[0]?.cluster_id || "");
  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedService[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const { success, error } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsingError(null);
    setParsedItems([]);

    try {
      const extension = f.name.split('.').pop()?.toLowerCase();
      if (extension === 'csv') {
        const text = await f.text();
        const items = parseCSV(text);
        if (items.length === 0) {
          setParsingError("No valid records found in the CSV. Ensure the headers are 'service name' and optionally 'namespace'.");
        } else {
          setParsedItems(items);
        }
      } else if (extension === 'xlsx' || extension === 'xls') {
        const buffer = await f.arrayBuffer();
        const items = parseExcel(buffer);
        if (items.length === 0) {
          setParsingError("No valid records found in the Excel sheet. Ensure the headers are 'service name' and optionally 'namespace'.");
        } else {
          setParsedItems(items);
        }
      } else {
        setParsingError("Unsupported file format. Please upload a .csv, .xlsx, or .xls file.");
      }
    } catch (err: any) {
      setParsingError("Error reading file: " + (err.message || err));
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    let serviceIndex = headers.indexOf('service name');
    let namespaceIndex = headers.indexOf('namespace');

    if (serviceIndex === -1 && namespaceIndex === -1) {
      serviceIndex = 0;
      namespaceIndex = 1;
    }

    const parsed: ParsedService[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
      const serviceName = cols[serviceIndex] || '';
      const namespace = namespaceIndex !== -1 ? cols[namespaceIndex] || '' : '';

      if (serviceName) {
        parsed.push({
          service_name: serviceName,
          namespace: namespace || undefined,
          status: "ready"
        });
      }
    }
    return parsed;
  };

  const parseExcel = (arrayBuffer: ArrayBuffer) => {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (json.length === 0) return [];
    const headers = json[0].map((h: any) => String(h || '').trim().toLowerCase());
    let serviceIndex = headers.indexOf('service name');
    let namespaceIndex = headers.indexOf('namespace');

    if (serviceIndex === -1 && namespaceIndex === -1) {
      serviceIndex = 0;
      namespaceIndex = 1;
    }

    const parsed: ParsedService[] = [];
    for (let i = 1; i < json.length; i++) {
      const row = json[i];
      if (!row || row.length === 0) continue;
      const serviceName = String(row[serviceIndex] || '').trim();
      const namespace = namespaceIndex !== -1 ? String(row[namespaceIndex] || '').trim() : '';

      if (serviceName) {
        parsed.push({
          service_name: serviceName,
          namespace: namespace || undefined,
          status: "ready"
        });
      }
    }
    return parsed;
  };

  const submit = async () => {
    if (parsedItems.length === 0 || !clusterId) return;
    setLoading(true);
    try {
      const res = await api.post("/api/service-owners/bulk-create", {
        cluster_id: clusterId,
        services: parsedItems.map(item => ({
          service_name: item.service_name,
          namespace: item.namespace
        }))
      });
      setResults(res.data.results || []);
      success("Bulk import complete!", `Processed ${parsedItems.length} services`);
      onAdded();
      setDone(true);
    } catch (err: any) {
      error("Failed to import services", err?.response?.data?.detail || "Please try again");
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    created: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/10",
    skipped: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10",
    error: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10",
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2130] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Bulk import services</h2>
            <p className="text-xs text-gray-550 dark:text-slate-400 mt-0.5">Register multiple services at once via CSV or Excel</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {/* File Upload Content */}
        {done ? (
          <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-100 dark:border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">Import completed successfully!</p>
                <p className="text-xs text-green-600 dark:text-green-455 mt-0.5">
                  Created: {results.filter(r => r.status === 'created').length} | Skipped: {results.filter(r => r.status === 'skipped').length} | Errors: {results.filter(r => r.status === 'error').length}
                </p>
              </div>
            </div>

            <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-gray-50 dark:divide-slate-800 max-h-60 overflow-y-auto scrollbar-thin">
              {results.map((r, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 text-xs">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-medium text-gray-700 dark:text-slate-300 truncate">{r.service_name}</span>
                    {r.namespace && (
                      <span className="text-[10px] text-gray-400 dark:text-slate-550 mt-0.5">namespace: {r.namespace}</span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full capitalize font-semibold shrink-0 ${statusColors[r.status]}`}>
                    {r.status === 'error' ? r.detail || 'error' : r.status}
                  </span>
                </div>
              ))}
            </div>

            <button onClick={onClose} className="btn-primary w-full justify-center">Done</button>
          </div>
        ) : (
          <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-500/10 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300">CSV / Excel File Format Rules:</p>
              <ul className="text-[11px] text-indigo-700 dark:text-indigo-400 space-y-1 list-disc pl-4">
                <li>First row must contain columns named <strong>service name</strong> and optionally <strong>namespace</strong>.</li>
                <li>Example row: <code className="font-mono bg-indigo-100/50 dark:bg-indigo-500/10 px-1 py-0.5 rounded">auth-java, default</code></li>
              </ul>
            </div>

            <div>
              <label className="label">Target Kubernetes Cluster</label>
              <select
                className="input"
                value={clusterId}
                onChange={(e) => setClusterId(e.target.value)}
              >
                {clusters.map((c) => (
                  <option key={c.cluster_id} value={c.cluster_id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Select CSV or Excel file</label>
              <div className="relative border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-555 dark:text-slate-350">
                  {file ? file.name : "Drag & drop or click to upload file"}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Supports CSV, XLSX, XLS up to 5MB</p>
              </div>
              {parsingError && <p className="text-xs text-red-500 mt-1.5">{parsingError}</p>}
              {parsedItems.length > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 font-medium flex items-center gap-1.5">
                  ✓ Successfully parsed {parsedItems.length} services.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2 shrink-0">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button
                type="button"
                onClick={submit}
                disabled={parsedItems.length === 0 || !clusterId || loading}
                className="btn-primary flex-1 justify-center flex items-center gap-1.5"
              >
                {loading ? "Importing..." : `Import ${parsedItems.length} services`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
