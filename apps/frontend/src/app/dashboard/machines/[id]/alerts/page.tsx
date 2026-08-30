"use client";

import { useEffect, useState, use } from "react";
import { fetchMachine } from "@/lib/api";
import { Loader2, AlertTriangle } from "lucide-react";
import MachineAlerts from "@/components/machines/MachineAlerts";

export default function MachineAlertsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [machine, setMachine] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const res = await fetchMachine(id);
        setMachine(res.machine);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="card py-16 text-center max-w-md mx-auto mt-12 bg-white dark:bg-[#13151f] border rounded-3xl">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Machine Not Found</h2>
        <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
          The host machine you are looking for does not exist or has been removed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <MachineAlerts machineId={id} machineName={machine.name} />
    </div>
  );
}
