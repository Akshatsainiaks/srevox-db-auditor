"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchCluster } from "@/lib/api";
import { type Cluster } from "@/lib/utils";
import { Loader2, AlertTriangle } from "lucide-react";
import ClusterAlerts from "@/components/clusters/ClusterAlerts";

export default function ClusterAlertsPage() {
  const { id } = useParams() as { id: string };
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await fetchCluster(id);
        setCluster(data);
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

  if (!cluster) {
    return (
      <div className="card py-16 text-center max-w-md mx-auto mt-12 bg-white dark:bg-[#13151f] border rounded-3xl">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cluster Not Found</h2>
        <p className="text-xs text-gray-450 dark:text-slate-500 mt-2">
          The cluster you are looking for does not exist or has been deleted.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <ClusterAlerts clusterId={id} clusterName={cluster.name} />
    </div>
  );
}
