import sql from "../db/sql.js";
import redis from "../db/redis.js";
import { getK8sClient } from "./k8s.js";

function parseMemoryBytes(memStr: string | undefined): number {
  if (!memStr) return 0;
  const s = memStr.trim();
  if (s.endsWith("Ki")) return parseFloat(s) * 1024;
  if (s.endsWith("Mi")) return parseFloat(s) * 1024 * 1024;
  if (s.endsWith("Gi")) return parseFloat(s) * 1024 * 1024 * 1024;
  if (s.endsWith("Ti")) return parseFloat(s) * 1024 * 1024 * 1024 * 1024;
  if (s.endsWith("k"))  return parseFloat(s) * 1000;
  if (s.endsWith("M"))  return parseFloat(s) * 1000 * 1000;
  if (s.endsWith("G"))  return parseFloat(s) * 1000 * 1000 * 1000;
  return parseFloat(s) || 0;
}

function parseQuantity(q: string | undefined): number {
  if (!q) return 0;
  const s = String(q).trim();
  if (s.endsWith("n")) return parseFloat(s) / 1000000000;
  if (s.endsWith("u")) return parseFloat(s) / 1000000;
  if (s.endsWith("m")) return parseFloat(s) / 1000;
  if (s.endsWith("Ki")) return parseFloat(s) / 1024;
  if (s.endsWith("Mi")) return parseFloat(s);
  if (s.endsWith("Gi")) return parseFloat(s) * 1024;
  if (s.endsWith("Ti")) return parseFloat(s) * 1024 * 1024;
  const num = parseFloat(s) || 0;
  if (num > 1000000) return num / (1024 * 1024);
  return num;
}

function parseChannelIds(input: any): string[] {
  if (!input) return [];
  let current = input;
  while (typeof current === "string") {
    try {
      const parsed = JSON.parse(current);
      if (parsed === current) break;
      current = parsed;
    } catch {
      break;
    }
  }
  if (Array.isArray(current)) {
    return current.map(id => String(id).trim()).filter(Boolean);
  }
  if (typeof current === "string" && current.trim()) {
    return [current.trim()];
  }
  return [];
}

export async function checkClusterNodesAndMetrics() {
  const clusters = await sql`
    SELECT cluster_id, name, org_id, node_cpu_threshold, node_memory_threshold,
           master_alerts_enabled, worker_alerts_enabled, status, error_message,
           api_server_url, kubeconfig_encrypted, connection_type
    FROM clusters
    WHERE status IN ('connected', 'error')
  `;

  for (const cluster of clusters) {
    const metricsConfigured = (cluster.connection_type !== "agent" || !!cluster.kubeconfig_encrypted) && 
      (!!cluster.api_server_url || !!cluster.kubeconfig_encrypted || cluster.connection_type === "self_hosted" || cluster.connection_type === "token" || cluster.connection_type === "kubeconfig");
    if (!metricsConfigured) {
      await sql`
        UPDATE clusters 
        SET metrics_status = 'disabled', 
            metrics_error = NULL,
            master_nodes_ready = 0,
            master_nodes_total = 0,
            worker_nodes_ready = 0,
            worker_nodes_total = 0
        WHERE cluster_id = ${cluster.cluster_id}
      `;
      continue;
    }
    try {
      const resourceRules = await sql`
        SELECT resource_alert_id, resource_type, threshold_pct, target, target_name, channel_ids, mute_until, repeat_interval_mins, repeat_enabled
        FROM resource_alerts
        WHERE cluster_id = ${cluster.cluster_id} AND enabled = true
      `;
      const { core, metrics } = await getK8sClient(cluster.cluster_id);
      let nodesRes;
      let nodeMetricsRes = { items: [] } as any;
      let metricsHealthy = false;

      try {
        nodesRes = await core.listNode();
        const mRes = await metrics.getNodeMetrics();
        if (mRes && mRes.items && mRes.items.length > 0) {
          nodeMetricsRes = mRes;
          metricsHealthy = true;
        }
      } catch (err: any) {
        console.warn(`[infra-eval] Metrics API call failed for cluster ${cluster.name}:`, err.message);
        if (!nodesRes) {
          nodesRes = await core.listNode();
        }
      }

      const metricsMap = new Map(
        nodeMetricsRes.items.map((m: any) => [m.metadata?.name?.toLowerCase(), m.usage])
      );

      let masterReady = 0;
      let masterTotal = 0;
      let workerReady = 0;
      let workerTotal = 0;

      for (const node of nodesRes.items) {
        const nodeName = node.metadata?.name || "unknown";
        const role = node.metadata?.labels?.["node-role.kubernetes.io/control-plane"] !== undefined ||
                     node.metadata?.labels?.["node-role.kubernetes.io/master"] !== undefined
          ? "master" : "worker";

        // 1. Ready Check
        const readyCond = node.status?.conditions?.find((c: any) => c.type === "Ready");
        const isReady = readyCond?.status === "True";

        if (role === "master") {
          masterTotal++;
          if (isReady) masterReady++;
        } else {
          workerTotal++;
          if (isReady) workerReady++;
        }

        const offlineAlertsEnabled = role === "master" ? (cluster.master_alerts_enabled ?? true) : (cluster.worker_alerts_enabled ?? true);

        if (!isReady && offlineAlertsEnabled) {
          const cooldownKey = `cooldown:node-alert:${cluster.cluster_id}:${nodeName}:not_ready`;
          const activeCooldown = await redis.get(cooldownKey);
          if (!activeCooldown) {
            await redis.publish(
              "srevox:system_alerts",
              JSON.stringify({
                event_type: "cluster_error",
                org_id: cluster.org_id,
                cluster_id: cluster.cluster_id,
                cluster_name: cluster.name,
                details: `${role.toUpperCase()} Node '${nodeName}' is offline / NotReady!`,
              })
            );
            await redis.setex(cooldownKey, 900, "1"); // 15 mins cooldown
          }
        }

        // 2. Condition checks
        const conditions = node.status?.conditions || [];
        for (const cond of conditions) {
          // Warning conditions (MemoryPressure, DiskPressure, PIDPressure, NetworkUnavailable)
          if (cond.type !== "Ready" && cond.status === "True" && offlineAlertsEnabled) {
            const cooldownKey = `cooldown:node-alert:${cluster.cluster_id}:${nodeName}:${cond.type}`;
            const activeCooldown = await redis.get(cooldownKey);
            if (!activeCooldown) {
              await redis.publish(
                "srevox:system_alerts",
                JSON.stringify({
                  event_type: "cluster_error",
                  org_id: cluster.org_id,
                  cluster_id: cluster.cluster_id,
                  cluster_name: cluster.name,
                  details: `Node '${nodeName}' reports condition warning: ${cond.type}! Details: ${cond.message || ""}`,
                })
              );
              await redis.setex(cooldownKey, 900, "1"); // 15 mins cooldown
            }
          }
        }

        // 3. CPU, Memory, and Disk/Storage Checks (using Service Account metrics & Node conditions)
        const usage = metricsMap.get(nodeName.toLowerCase()) as any;
        const hasDiskPressure = node.status?.conditions?.some((c: any) => c.type === "DiskPressure" && c.status === "True");

        if (usage || hasDiskPressure) {
          const cpuCores = parseFloat(node.status?.capacity?.cpu || "0") || 1;
          const totalBytes = parseMemoryBytes(node.status?.capacity?.memory);
          const memGiB = totalBytes / (1024 * 1024 * 1024);
          const cpuUsed = parseQuantity(usage?.cpu);
          const memUsedMi = parseQuantity(usage?.memory);
          const memTotalMi = totalBytes / (1024 * 1024);

          // Node Storage (ephemeral-storage / Disk)
          const totalDiskBytes = parseMemoryBytes(node.status?.capacity?.["ephemeral-storage"] || node.status?.allocatable?.["ephemeral-storage"]);
          const diskUsedBytes = parseMemoryBytes(usage?.["ephemeral-storage"] || usage?.storage || usage?.disk);
          const diskTotalMi = totalDiskBytes / (1024 * 1024);
          const diskUsedMi = diskUsedBytes / (1024 * 1024);

          const cpuUsagePct = Math.min(Math.round((cpuUsed / cpuCores) * 100), 100);
          const memUsagePct = memTotalMi > 0 ? Math.min(Math.round((memUsedMi / memTotalMi) * 100), 100) : 0;
          let diskUsagePct = diskTotalMi > 0 && diskUsedMi > 0 ? Math.min(Math.round((diskUsedMi / diskTotalMi) * 100), 100) : 0;
          if (hasDiskPressure && diskUsagePct === 0) {
            diskUsagePct = 95;
          }

          for (const rule of resourceRules) {
            const isMuted = rule.mute_until && new Date(rule.mute_until) > new Date();
            if (isMuted) continue;

            const resType = (rule.resource_type || "").toLowerCase().trim();
            const ruleTarget = (rule.target || "node").toLowerCase().trim();
            const targetName = (rule.target_name || "").toLowerCase().trim();

            const parsedChannels = parseChannelIds(rule.channel_ids);

            if (ruleTarget === "node") {
              const matchesTarget = !targetName || targetName === "all" || targetName === nodeName.toLowerCase();
              if (!matchesTarget) continue;

              let triggered = false;
              let detailMsg = "";

              const cpuUsedCores = Math.round(cpuUsed * 100) / 100;
              const memUsedGiB = Math.round((memUsedMi / 1024) * 100) / 100;
              const memTotalGiB = Math.round(memGiB * 100) / 100;

              if (resType === "cpu" && cpuUsagePct >= rule.threshold_pct) {
                triggered = true;
                detailMsg = `Node '${nodeName}' CPU utilization high: ${cpuUsagePct}% (${cpuUsedCores} of ${cpuCores} cores used). Rule threshold: > ${rule.threshold_pct}%.`;
              } else if (resType === "memory" && memUsagePct >= rule.threshold_pct) {
                triggered = true;
                detailMsg = `Node '${nodeName}' Memory utilization high: ${memUsagePct}% (${memUsedGiB} GB of ${memTotalGiB} GB used). Rule threshold: > ${rule.threshold_pct}%.`;
              } else if ((resType === "disk" || resType === "storage") && (diskUsagePct >= rule.threshold_pct || hasDiskPressure)) {
                triggered = true;
                detailMsg = `Node '${nodeName}' Storage/Disk utilization high: ${diskUsagePct}% ${hasDiskPressure ? "(DiskPressure active)" : ""}. Rule threshold: > ${rule.threshold_pct}%.`;
              }

              if (triggered) {
                const cooldownKey = `cooldown:custom-node-alert:${rule.resource_alert_id}:${nodeName}`;
                const activeCooldown = await redis.get(cooldownKey);
                if (!activeCooldown) {
                  const currentPct = resType === "cpu" ? cpuUsagePct : resType === "disk" || resType === "storage" ? diskUsagePct : memUsagePct;
                  const alertPayload: any = {
                    event_type: "resource_threshold_exceeded",
                    title: `Node '${nodeName}' ${resType.toUpperCase()} Exceeded (${currentPct}%)`,
                    org_id: cluster.org_id,
                    cluster_id: cluster.cluster_id,
                    cluster_name: cluster.name,
                    details: detailMsg,
                    channel_ids: parsedChannels,
                  };

                  await redis.publish("srevox:system_alerts", JSON.stringify(alertPayload));
                  const isRepeatEnabled = rule.repeat_enabled !== false;
                  const repeatMins = Number(rule.repeat_interval_mins) || 15;
                  const cooldownTtlSec = isRepeatEnabled ? repeatMins * 60 : 86400; // 24 hours if disabled (once only)
                  await redis.setex(cooldownKey, cooldownTtlSec, "1");
                }
              }
            }
          }
        }
      }

      // Pod & Namespace Level Resource Rules & Restart Checks
      try {
        const podListRes = await core.listPodForAllNamespaces().catch(() => ({ items: [] }));
        const podsList = podListRes.items || [];

        const pmRes = await metrics.getPodMetrics().catch(() => ({ items: [] }));
        const podMetricsMap = new Map();
        if (pmRes && pmRes.items) {
          for (const item of pmRes.items) {
            const podName = item.metadata?.name;
            const ns = item.metadata?.namespace;
            const key = `${ns}:${podName}`.toLowerCase();
            podMetricsMap.set(key, item.containers || []);
          }
        }

        for (const pod of podsList) {
          const podNameRaw = pod.metadata?.name || "unknown";
          const podName = podNameRaw.toLowerCase();
          const namespaceRaw = pod.metadata?.namespace || "default";
          const namespace = namespaceRaw.toLowerCase();
          const containerStatuses = pod.status?.containerStatuses || [];
          const totalRestarts = containerStatuses.reduce((acc: number, c: any) => acc + (c.restartCount || 0), 0);

          const metricsKey = `${namespace}:${podName}`;
          const containersUsage = podMetricsMap.get(metricsKey) || [];
          let podCpuCores = 0;
          let podMemMi = 0;
          for (const c of containersUsage) {
            podCpuCores += parseQuantity(c.usage?.cpu);
            podMemMi += parseQuantity(c.usage?.memory);
          }
          const podMemGiB = podMemMi / 1024;

          // Parse container limits from pod.spec
          let podLimitCpuCores = 0;
          let podLimitMemMi = 0;
          for (const container of pod.spec?.containers || []) {
            if (container.resources?.limits?.cpu) {
              podLimitCpuCores += parseQuantity(container.resources.limits.cpu);
            }
            if (container.resources?.limits?.memory) {
              podLimitMemMi += parseMemoryBytes(container.resources.limits.memory) / (1024 * 1024);
            }
          }
          const podLimitMemGiB = podLimitMemMi / 1024;
          const cpuPctOfLimit = podLimitCpuCores > 0 ? Math.round((podCpuCores / podLimitCpuCores) * 100) : null;
          const memPctOfLimit = podLimitMemGiB > 0 ? Math.round((podMemGiB / podLimitMemGiB) * 100) : null;

          for (const rule of resourceRules) {
            const isMuted = rule.mute_until && new Date(rule.mute_until) > new Date();
            if (isMuted) continue;

            const resType = (rule.resource_type || "").toLowerCase().trim();
            const ruleTarget = (rule.target || "pod").toLowerCase().trim();
            const targetName = (rule.target_name || "").toLowerCase().trim();

            const parsedChannels = parseChannelIds(rule.channel_ids);

            let triggered = false;
            let detailMsg = "";

            const cpuLimitStr = podLimitCpuCores > 0 ? ` (${cpuPctOfLimit}% of ${podLimitCpuCores.toFixed(2)} Core limit)` : " (No Pod CPU limit set)";
            const memLimitStr = podLimitMemGiB > 0 ? ` (${memPctOfLimit}% of ${podLimitMemGiB.toFixed(2)} GB limit)` : " (No Pod Memory limit set)";

            if (ruleTarget === "pod") {
              const matchesPod = !targetName || targetName === "all" || targetName === podName;
              if (matchesPod) {
                if ((resType === "pod_restarts" || resType === "restarts") && totalRestarts >= rule.threshold_pct && totalRestarts > 0) {
                  triggered = true;
                  detailMsg = `Pod '${podNameRaw}' (${namespaceRaw}) restart count is ${totalRestarts} (rule threshold: ${rule.threshold_pct} restarts)`;
                } else if (resType === "cpu") {
                  if (rule.threshold_pct > 10) {
                    if (cpuPctOfLimit !== null && cpuPctOfLimit >= rule.threshold_pct) {
                      triggered = true;
                      detailMsg = `Pod '${podNameRaw}' (${namespaceRaw}) CPU usage is ${cpuPctOfLimit}% of limit (${podCpuCores.toFixed(2)} of ${podLimitCpuCores.toFixed(2)} Cores). Rule threshold: > ${rule.threshold_pct}%`;
                    } else if (podLimitCpuCores === 0 && podCpuCores >= (rule.threshold_pct / 100)) {
                      triggered = true;
                      detailMsg = `Pod '${podNameRaw}' (${namespaceRaw}) CPU usage is ${podCpuCores.toFixed(2)} Cores (No Pod CPU limit set in K8s spec). Rule threshold: > ${rule.threshold_pct}%`;
                    }
                  } else if (podCpuCores >= rule.threshold_pct) {
                    triggered = true;
                    detailMsg = `Pod '${podNameRaw}' (${namespaceRaw}) CPU usage is ${podCpuCores.toFixed(2)} Cores${cpuLimitStr}. Rule threshold: > ${rule.threshold_pct} Cores`;
                  }
                } else if (resType === "memory") {
                  if (rule.threshold_pct > 10) {
                    if (memPctOfLimit !== null && memPctOfLimit >= rule.threshold_pct) {
                      triggered = true;
                      detailMsg = `Pod '${podNameRaw}' (${namespaceRaw}) Memory usage is ${memPctOfLimit}% of limit (${podMemGiB.toFixed(2)} GB of ${podLimitMemGiB.toFixed(2)} GB limit). Rule threshold: > ${rule.threshold_pct}%`;
                    } else if (podLimitMemGiB === 0 && podMemGiB >= (rule.threshold_pct / 100) * 4) {
                      triggered = true;
                      detailMsg = `Pod '${podNameRaw}' (${namespaceRaw}) Memory usage is ${podMemGiB.toFixed(2)} GB (No Pod Memory limit set in K8s spec). Rule threshold: > ${rule.threshold_pct}%`;
                    }
                  } else if (podMemGiB >= rule.threshold_pct) {
                    triggered = true;
                    detailMsg = `Pod '${podNameRaw}' (${namespaceRaw}) Memory usage is ${podMemGiB.toFixed(2)} GB${memLimitStr}. Rule threshold: > ${rule.threshold_pct} GB`;
                  }
                } else if (resType === "cpu_memory" || resType === "cpu+memory") {
                  const cpuThresh = Number(rule.threshold_pct) || 0;
                  const memThresh = Number(rule.memory_threshold_pct || rule.threshold_pct) || 0;
                  let cpuTrig = false;
                  let memTrig = false;

                  if (cpuThresh > 10) {
                    if (cpuPctOfLimit !== null && cpuPctOfLimit >= cpuThresh) cpuTrig = true;
                    else if (podLimitCpuCores === 0 && podCpuCores >= (cpuThresh / 100)) cpuTrig = true;
                  } else if (podCpuCores >= cpuThresh && cpuThresh > 0) {
                    cpuTrig = true;
                  }

                  if (memThresh > 10) {
                    if (memPctOfLimit !== null && memPctOfLimit >= memThresh) memTrig = true;
                    else if (podLimitMemGiB === 0 && podMemGiB >= (memThresh / 100) * 4) memTrig = true;
                  } else if (podMemGiB >= memThresh && memThresh > 0) {
                    memTrig = true;
                  }

                  if (cpuTrig || memTrig) {
                    triggered = true;
                    const parts: string[] = [];
                    if (cpuTrig) parts.push(`CPU is ${podCpuCores.toFixed(2)} Cores${cpuLimitStr} (threshold: > ${cpuThresh}${cpuThresh > 10 ? "%" : " Cores"})`);
                    if (memTrig) parts.push(`Memory is ${podMemGiB.toFixed(2)} GB${memLimitStr} (threshold: > ${memThresh}${memThresh > 10 ? "%" : " GB"})`);
                    detailMsg = `Pod '${podNameRaw}' (${namespaceRaw}) exceeded threshold: ${parts.join(" | ")}`;
                  }
                }
              }
            } else if (ruleTarget === "namespace") {
              const matchesNs = !targetName || targetName === "all" || targetName === namespace;
              if (matchesNs) {
                if ((resType === "pod_restarts" || resType === "restarts") && totalRestarts >= rule.threshold_pct && totalRestarts > 0) {
                  triggered = true;
                  detailMsg = `Namespace '${namespaceRaw}' pod '${podNameRaw}' restart count is ${totalRestarts} (rule threshold: ${rule.threshold_pct} restarts)`;
                } else if (resType === "cpu") {
                  if (rule.threshold_pct > 10) {
                    if (cpuPctOfLimit !== null && cpuPctOfLimit >= rule.threshold_pct) {
                      triggered = true;
                      detailMsg = `Namespace '${namespaceRaw}' pod '${podNameRaw}' CPU usage is ${cpuPctOfLimit}% of limit (${podCpuCores.toFixed(2)} of ${podLimitCpuCores.toFixed(2)} Cores). Rule threshold: > ${rule.threshold_pct}%`;
                    } else if (podLimitCpuCores === 0 && podCpuCores >= (rule.threshold_pct / 100)) {
                      triggered = true;
                      detailMsg = `Namespace '${namespaceRaw}' pod '${podNameRaw}' CPU usage is ${podCpuCores.toFixed(2)} Cores (No Pod CPU limit set in K8s spec). Rule threshold: > ${rule.threshold_pct}%`;
                    }
                  } else if (podCpuCores >= rule.threshold_pct) {
                    triggered = true;
                    detailMsg = `Namespace '${namespaceRaw}' pod '${podNameRaw}' CPU usage is ${podCpuCores.toFixed(2)} Cores${cpuLimitStr}. Rule threshold: > ${rule.threshold_pct} Cores`;
                  }
                } else if (resType === "memory") {
                  if (rule.threshold_pct > 10) {
                    if (memPctOfLimit !== null && memPctOfLimit >= rule.threshold_pct) {
                      triggered = true;
                      detailMsg = `Namespace '${namespaceRaw}' pod '${podNameRaw}' Memory usage is ${memPctOfLimit}% of limit (${podMemGiB.toFixed(2)} GB of ${podLimitMemGiB.toFixed(2)} GB limit). Rule threshold: > ${rule.threshold_pct}%`;
                    } else if (podLimitMemGiB === 0 && podMemGiB >= (rule.threshold_pct / 100) * 4) {
                      triggered = true;
                      detailMsg = `Namespace '${namespaceRaw}' pod '${podNameRaw}' Memory usage is ${podMemGiB.toFixed(2)} GB (No Pod Memory limit set in K8s spec). Rule threshold: > ${rule.threshold_pct}%`;
                    }
                  } else if (podMemGiB >= rule.threshold_pct) {
                    triggered = true;
                    detailMsg = `Namespace '${namespaceRaw}' pod '${podNameRaw}' Memory usage is ${podMemGiB.toFixed(2)} GB${memLimitStr}. Rule threshold: > ${rule.threshold_pct} GB`;
                  }
                } else if (resType === "cpu_memory" || resType === "cpu+memory") {
                  const cpuThresh = Number(rule.threshold_pct) || 0;
                  const memThresh = Number(rule.memory_threshold_pct || rule.threshold_pct) || 0;
                  let cpuTrig = false;
                  let memTrig = false;

                  if (cpuThresh > 10) {
                    if (cpuPctOfLimit !== null && cpuPctOfLimit >= cpuThresh) cpuTrig = true;
                    else if (podLimitCpuCores === 0 && podCpuCores >= (cpuThresh / 100)) cpuTrig = true;
                  } else if (podCpuCores >= cpuThresh && cpuThresh > 0) {
                    cpuTrig = true;
                  }

                  if (memThresh > 10) {
                    if (memPctOfLimit !== null && memPctOfLimit >= memThresh) memTrig = true;
                    else if (podLimitMemGiB === 0 && podMemGiB >= (memThresh / 100) * 4) memTrig = true;
                  } else if (podMemGiB >= memThresh && memThresh > 0) {
                    memTrig = true;
                  }

                  if (cpuTrig || memTrig) {
                    triggered = true;
                    const parts: string[] = [];
                    if (cpuTrig) parts.push(`CPU is ${podCpuCores.toFixed(2)} Cores${cpuLimitStr} (threshold: > ${cpuThresh}${cpuThresh > 10 ? "%" : " Cores"})`);
                    if (memTrig) parts.push(`Memory is ${podMemGiB.toFixed(2)} GB${memLimitStr} (threshold: > ${memThresh}${memThresh > 10 ? "%" : " GB"})`);
                    detailMsg = `Namespace '${namespaceRaw}' pod '${podNameRaw}' exceeded threshold: ${parts.join(" | ")}`;
                  }
                }
              }
            }

            if (triggered) {
              const cooldownKey = `cooldown:pod-alert:${rule.resource_alert_id}:${podNameRaw}`;
              const activeCooldown = await redis.get(cooldownKey);
              if (!activeCooldown) {
                let alertTitle = "";
                if (resType === "pod_restarts" || resType === "restarts") {
                  alertTitle = `Pod '${podNameRaw}' Restarts Exceeded (${totalRestarts})`;
                } else if (resType === "cpu") {
                  alertTitle = `Pod '${podNameRaw}' CPU Exceeded (${podCpuCores.toFixed(2)} Cores)`;
                } else if (resType === "memory") {
                  alertTitle = `Pod '${podNameRaw}' MEMORY Exceeded (${podMemGiB.toFixed(2)} GB)`;
                }

                const alertPayload: any = {
                  event_type: "resource_threshold_exceeded",
                  title: alertTitle,
                  org_id: cluster.org_id,
                  cluster_id: cluster.cluster_id,
                  cluster_name: cluster.name,
                  details: detailMsg,
                  channel_ids: parsedChannels,
                };

                await redis.publish("srevox:system_alerts", JSON.stringify(alertPayload));
                const isRepeatEnabled = rule.repeat_enabled !== false;
                const repeatMins = Number(rule.repeat_interval_mins) || 15;
                const cooldownTtlSec = isRepeatEnabled ? repeatMins * 60 : 86400; // 24 hours if disabled (once only)
                await redis.setex(cooldownKey, cooldownTtlSec, "1");
              }
            }
          }
        }
      } catch (podErr: any) {
        console.warn(`[infra-eval] Pod rules evaluation error for ${cluster.name}:`, podErr.message);
      }

      // Update node counts and check recovery state
      const wasError = cluster.status === "error";
      await sql`
        UPDATE clusters
        SET status = 'connected',
            metrics_status = ${metricsHealthy ? 'connected' : 'error'},
            error_message = null,
            metrics_error = ${metricsHealthy ? null : 'Metrics Server not installed or reporting'},
            master_nodes_ready = ${masterReady},
            master_nodes_total = ${masterTotal},
            worker_nodes_ready = ${workerReady},
            worker_nodes_total = ${workerTotal}
        WHERE cluster_id = ${cluster.cluster_id}
      `;

      if (wasError) {
        await redis.publish(
          "srevox:system_alerts",
          JSON.stringify({
            event_type: "cluster_connected",
            org_id: cluster.org_id,
            cluster_id: cluster.cluster_id,
            cluster_name: cluster.name,
            details: `Cluster '${cluster.name}' connection has recovered.`,
          })
        );
      }
    } catch (err: any) {
      console.warn(`[infra-checks] Failed to check nodes for cluster ${cluster.name}:`, err.message);

      await sql`
        UPDATE clusters
        SET status = 'error',
            metrics_status = 'error',
            error_message = ${err.message || 'Unknown connection error'},
            metrics_error = ${err.message || 'Unknown connection error'}
        WHERE cluster_id = ${cluster.cluster_id}
      `;
    }
  }
}

export async function evaluateMachineAlerts(machineId: string, metrics: {
  machine_name: string;
  hostname: string;
  cpu_usage_pct: number;
  memory_usage_pct: number;
  disk_usage_pct: number;
  load_avg_1m?: number;
  cpu_cores: number;
  total_memory_bytes: number;
  memory_used_bytes: number;
  total_disk_bytes: number;
  disk_used_bytes: number;
  org_id?: string;
}) {
  try {
    let orgId = metrics.org_id;
    if (!orgId) {
      const [mRec] = await sql`SELECT org_id FROM machines WHERE machine_id = ${machineId}`;
      orgId = mRec?.org_id;
    }
    if (!orgId) {
      const [defaultOrg] = await sql`SELECT org_id FROM organizations LIMIT 1`;
      orgId = defaultOrg?.org_id;
    }

    const safeOrgId = orgId || null;
    const mNameLower = (metrics.machine_name || "").toLowerCase();
    const hNameLower = (metrics.hostname || "").toLowerCase();

    const rules = await sql`
      SELECT * FROM machine_alert_rules
      WHERE enabled = true 
        AND (machine_id = '*' OR machine_id = ${machineId} OR LOWER(machine_id) = ${mNameLower} OR LOWER(machine_id) = ${hNameLower})
        AND (org_id IS NULL OR ${safeOrgId}::text IS NULL OR org_id = ${safeOrgId}::text)
    `;

    for (const rule of rules) {
      const ruleOrgId = rule.org_id || orgId;
      let triggered = false;
      let val = 0;
      let detailMsg = "";

      const metricType = (rule.metric || "").toLowerCase().trim();

      if (metricType === "cpu") {
        val = metrics.cpu_usage_pct;
        if (val >= Number(rule.threshold_pct)) {
          triggered = true;
          const usedCores = ((val / 100) * metrics.cpu_cores).toFixed(2);
          detailMsg = `Host '${metrics.machine_name}' CPU utilization high: ${val.toFixed(1)}% (${usedCores} of ${metrics.cpu_cores} cores used). Rule threshold: > ${rule.threshold_pct}%.`;
        }
      } else if (metricType === "memory") {
        val = metrics.memory_usage_pct;
        if (val >= Number(rule.threshold_pct)) {
          triggered = true;
          const usedGb = (metrics.memory_used_bytes / (1024 * 1024 * 1024)).toFixed(2);
          const totalGb = (metrics.total_memory_bytes / (1024 * 1024 * 1024)).toFixed(2);
          detailMsg = `Host '${metrics.machine_name}' Memory utilization high: ${val.toFixed(1)}% (${usedGb} GB of ${totalGb} GB used). Rule threshold: > ${rule.threshold_pct}%.`;
        }
      } else if (metricType === "disk") {
        val = metrics.disk_usage_pct;
        if (val >= Number(rule.threshold_pct)) {
          triggered = true;
          const usedGb = (metrics.disk_used_bytes / (1024 * 1024 * 1024)).toFixed(2);
          const totalGb = (metrics.total_disk_bytes / (1024 * 1024 * 1024)).toFixed(2);
          detailMsg = `Host '${metrics.machine_name}' Disk utilization high: ${val.toFixed(1)}% (${usedGb} GB of ${totalGb} GB used). Rule threshold: > ${rule.threshold_pct}%.`;
        }
      } else if (metricType === "load") {
        val = metrics.load_avg_1m || 0;
        if (val >= Number(rule.threshold_pct)) {
          triggered = true;
          detailMsg = `Host '${metrics.machine_name}' 1-min Load Average high: ${val.toFixed(2)} cores. Rule threshold: > ${rule.threshold_pct} cores.`;
        }
      }

      if (triggered) {
        const cooldownKey = `cooldown:machine-alert:${rule.rule_id}:${machineId}`;
        const inCooldown = await redis.get(cooldownKey);

        if (!inCooldown) {
          const parsedChannels = parseChannelIds(rule.channel_ids);
          const alertPayload = {
            event_type: "resource_threshold_exceeded",
            title: `⚠️ ${rule.metric.toUpperCase()} Alert: Host '${metrics.machine_name}' (${val.toFixed(0)}${metricType === "load" ? " cores" : "%"})`,
            cluster_name: metrics.machine_name || metrics.hostname || machineId,
            org_id: ruleOrgId,
            details: detailMsg,
            channel_ids: parsedChannels,
            severity: rule.severity || "warning",
          };

          await redis.publish("srevox:system_alerts", JSON.stringify(alertPayload));

          const isRepeatEnabled = rule.repeat_enabled !== false;
          const repeatMins = Number(rule.repeat_interval_mins) || 15;
          const cooldownTtlSec = isRepeatEnabled ? repeatMins * 60 : 86400;
          await redis.setex(cooldownKey, cooldownTtlSec, "1");
        }
      }
    }
  } catch (err: any) {
    console.error(`[infra-eval] evaluateMachineAlerts error for ${machineId}:`, err.message);
  }
}

