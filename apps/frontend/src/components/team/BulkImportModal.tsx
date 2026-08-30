"use client";

import { useState } from "react";
import { CheckCircle, Copy, RefreshCw, Upload, Crown, Shield, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { copyToClipboard } from "@/lib/utils";
import * as XLSX from "xlsx";

function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  admin: Crown,
  member: Shield,
  viewer: Eye,
};

export default function BulkImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [defaultRole, setDefaultRole] = useState("member");
  const [defaultPassword, setDefaultPassword] = useState(generatePassword());
  const [notifyUsers, setNotifyUsers] = useState(true);
  const [parsedUsers, setParsedUsers] = useState<{ full_name: string; email: string }[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<{ email: string; status: string; detail?: string }[]>([]);
  const { success, error } = useToast();

  const copyPass = async () => {
    await copyToClipboard(defaultPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const regen = () => setDefaultPassword(generatePassword());

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsingError(null);
    setParsedUsers([]);

    try {
      const extension = f.name.split('.').pop()?.toLowerCase();
      if (extension === 'csv') {
        const text = await f.text();
        const users = parseCSV(text);
        if (users.length === 0) {
          setParsingError("No valid records found in the CSV. Ensure the headers are exactly 'name' and 'email'.");
        } else {
          setParsedUsers(users);
        }
      } else if (extension === 'xlsx' || extension === 'xls') {
        const buffer = await f.arrayBuffer();
        const users = parseExcel(buffer);
        if (users.length === 0) {
          setParsingError("No valid records found in the Excel sheet. Ensure the headers are exactly 'name' and 'email'.");
        } else {
          setParsedUsers(users);
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
    let nameIndex = headers.indexOf('name');
    let emailIndex = headers.indexOf('email');

    if (nameIndex === -1 && emailIndex === -1) {
      nameIndex = 0;
      emailIndex = 1;
    }

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
      const name = cols[nameIndex] || '';
      const email = cols[emailIndex] || '';
      if (email && email.includes('@')) {
        parsed.push({ full_name: name, email });
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
    let nameIndex = headers.indexOf('name');
    let emailIndex = headers.indexOf('email');

    if (nameIndex === -1 && emailIndex === -1) {
      nameIndex = 0;
      emailIndex = 1;
    }

    const parsed = [];
    for (let i = 1; i < json.length; i++) {
      const row = json[i];
      if (!row || row.length === 0) continue;
      const name = String(row[nameIndex] || '').trim();
      const email = String(row[emailIndex] || '').trim();
      if (email && email.includes('@')) {
        parsed.push({ full_name: name, email });
      }
    }
    return parsed;
  };

  const submit = async () => {
    if (parsedUsers.length === 0 || !defaultPassword) return;
    setLoading(true);
    try {
      const res = await api.post("/api/users/bulk-create", {
        users: parsedUsers,
        default_password: defaultPassword,
        default_role: defaultRole,
        send_welcome_email: notifyUsers
      });
      setResults(res.data.results || []);
      success("Bulk import complete!", `Processed ${parsedUsers.length} users`);
      onImported();
      setDone(true);
    } catch (err: any) {
      error("Failed to import users", err?.response?.data?.detail || "Please try again");
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    created: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/10",
    reactivated: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10",
    skipped: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10",
    error: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10",
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2130] rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Bulk import members</h2>
            <p className="text-xs text-gray-550 dark:text-slate-400 mt-0.5">Create multiple members at once via CSV or Excel</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {done ? (
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-100 dark:border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">Import completed successfully!</p>
                <p className="text-xs text-green-600 dark:text-green-450 mt-0.5">
                  Created/Reactivated: {results.filter(r => r.status === 'created' || r.status === 'reactivated').length} | Skipped: {results.filter(r => r.status === 'skipped').length} | Errors: {results.filter(r => r.status === 'error').length}
                </p>
              </div>
            </div>

            <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-gray-50 dark:divide-slate-800 max-h-60 overflow-y-auto">
              {results.map((r, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 text-xs">
                  <span className="font-medium text-gray-700 dark:text-slate-300 truncate max-w-[70%]">{r.email}</span>
                  <span className={`px-2 py-0.5 rounded-full capitalize font-semibold ${statusColors[r.status]}`}>
                    {r.status === 'error' ? r.detail || 'error' : r.status}
                  </span>
                </div>
              ))}
            </div>

            <button onClick={onClose} className="btn-primary w-full justify-center">Done</button>
          </div>
        ) : (
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-500/10 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300">CSV / Excel File Format Rules:</p>
              <ul className="text-[11px] text-indigo-700 dark:text-indigo-400 space-y-1 list-disc pl-4">
                <li>First row must contain columns named <strong>name</strong> and <strong>email</strong>.</li>
                <li>Example row: <code className="font-mono bg-indigo-100/50 dark:bg-indigo-500/10 px-1 py-0.5 rounded">Akshat Saini, akshatsaini@gmail.com</code></li>
              </ul>
            </div>

            <div>
              <label className="label">Select CSV or Excel file</label>
              <div className="relative border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer transition-colors">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-655 dark:text-slate-300">
                  {file ? file.name : "Drag & drop or click to upload file"}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Supports CSV, XLSX, XLS up to 5MB</p>
              </div>
              {parsingError && <p className="text-xs text-red-500 mt-1.5">{parsingError}</p>}
              {parsedUsers.length > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 font-medium">
                  ✓ Successfully parsed {parsedUsers.length} members.
                </p>
              )}
            </div>

            <div>
              <label className="label">Default Role for all users</label>
              <div className="grid grid-cols-3 gap-2">
                {(["admin", "member", "viewer"] as const).map((r) => {
                  const Icon = ROLE_ICONS[r];
                  return (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setDefaultRole(r)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all capitalize ${
                        defaultRole === r
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
              <label className="label">Default Password for all users</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  className="input pr-20 font-mono"
                  value={defaultPassword}
                  onChange={(e) => setDefaultPassword(e.target.value)}
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
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Required to be at least 8 characters.</p>
            </div>

            <div className="flex items-center gap-2 select-none pt-1">
              <input
                type="checkbox"
                id="notify-users-checkbox"
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                checked={notifyUsers}
                onChange={(e) => setNotifyUsers(e.target.checked)}
              />
              <label htmlFor="notify-users-checkbox" className="text-xs font-semibold text-gray-700 dark:text-slate-300 cursor-pointer">
                Notify users via email
              </label>
            </div>

            <div className="flex gap-3 pt-2 shrink-0">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button
                type="button"
                onClick={submit}
                disabled={parsedUsers.length === 0 || !defaultPassword || defaultPassword.length < 8 || loading}
                className="btn-primary flex-1 justify-center"
              >
                {loading ? "Importing..." : `Import ${parsedUsers.length} members`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
