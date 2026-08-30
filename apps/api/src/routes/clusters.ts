import { FastifyInstance } from "fastify";
import { genId } from "../utils/id.js";
import sql from "../db/sql.js";
import redis, { invalidateCache } from "../db/redis.js";
import { getUser, requirePermission } from "../middleware/rbac.js";

export default async function clusterRoutes(app: FastifyInstance) {

  // GET /api/clusters — all roles
  app.get("/", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);
    const clusters = await sql`
      SELECT c.cluster_id, c.name, c.connection_type, c.cloud_provider, c.k8s_version,
             c.status, c.last_seen_at, c.error_message, c.created_at,
             c.master_nodes_ready, c.master_nodes_total, c.worker_nodes_ready, c.worker_nodes_total,
             c.master_alerts_enabled, c.worker_alerts_enabled, c.node_cpu_threshold, c.node_memory_threshold,
             c.metrics_status, c.metrics_error,
             ((c.connection_type != 'agent' AND (c.api_server_url IS NOT NULL OR c.kubeconfig_encrypted IS NOT NULL)) OR c.connection_type = 'token' OR c.connection_type = 'kubeconfig' OR c.connection_type = 'self_hosted') AS metrics_configured,
             (SELECT COUNT(*)::int FROM incidents WHERE cluster_id = c.cluster_id AND status != 'resolved') AS open_incidents_count
      FROM clusters c
      WHERE c.org_id = ${org_id}
      ORDER BY c.created_at DESC
    `;
    const formatted = clusters.map(c => ({
      ...c,
      open_incidents_count: Number(c.open_incidents_count || 0)
    }));
    return { clusters: formatted };
  });

  // GET /api/clusters/:id
  app.get("/:id", { onRequest: [(app as any).authenticate] }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const [cluster] = await sql`
      SELECT c.*,
             ((c.connection_type != 'agent' AND (c.api_server_url IS NOT NULL OR c.kubeconfig_encrypted IS NOT NULL)) OR c.connection_type = 'token' OR c.connection_type = 'kubeconfig' OR c.connection_type = 'self_hosted') AS metrics_configured
      FROM clusters c
      WHERE c.cluster_id = ${id} AND c.org_id = ${org_id}
    `;
    if (!cluster) return reply.status(404).send({ detail: "Not found" });

    // Mask sensitive fields
    if (cluster.sa_token) {
      cluster.sa_token = "••••••••••••••••";
    }
    if (cluster.kubeconfig_encrypted) {
      cluster.kubeconfig_encrypted = "••••••••••••••••";
    }
    
    // Ensure agent_token is valid and never contains SA JWT token
    if (!cluster.agent_token || !cluster.agent_token.startsWith("agt")) {
      const fixedAgentToken = genId("agt");
      await sql`UPDATE clusters SET agent_token = ${fixedAgentToken} WHERE cluster_id = ${id}`;
      cluster.agent_token = fixedAgentToken;
    }
    
    return cluster;
  });

  // POST /api/clusters — admin only
  app.post("/", {
    onRequest: [(app as any).authenticate, requirePermission("addCluster")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { name, connection_type, kubeconfig, api_server_url, cloud_provider, k8s_version } =
      req.body as any;

    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      return reply.status(400).send({ detail: "Cluster name is required." });
    }

    const [existing] = await sql`
      SELECT cluster_id FROM clusters 
      WHERE org_id = ${org_id} AND LOWER(name) = LOWER(${trimmedName})
      LIMIT 1
    `;
    if (existing) {
      return reply.status(400).send({ detail: `A cluster with name '${trimmedName}' already exists.` });
    }

    const clusterId   = genId("cls");
    const agent_token = genId("agt");

    const initialMetricsStatus = connection_type === "agent" ? "disabled" : "pending";
    await sql`
      INSERT INTO clusters
        (cluster_id, org_id, name, connection_type, agent_token, api_server_url,
         cloud_provider, k8s_version, status, metrics_status)
      VALUES
        (${clusterId}, ${org_id}, ${trimmedName}, ${connection_type}, ${agent_token},
         ${api_server_url || null}, ${cloud_provider || "other"},
         ${k8s_version || null}, 'pending', ${initialMetricsStatus})
    `;

    await invalidateCache(`clusters:${org_id}`);
    return {
      cluster_id: clusterId, name: trimmedName, connection_type, agent_token, status: "pending",
      install_command: agent_token
        ? `kubectl apply -f https://app.srevox.io/agent.yaml?token=${agent_token}`
        : null,
    };
  });

  // PATCH /api/clusters/:id — admin only
  app.patch("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("addCluster")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const {
      name,
      cloud_provider,
      k8s_version,
      master_alerts_enabled,
      worker_alerts_enabled,
      node_cpu_threshold,
      node_memory_threshold,
    } = req.body as any;

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return reply.status(400).send({ detail: "Cluster name is required." });
      }
      const [existing] = await sql`
        SELECT cluster_id FROM clusters 
        WHERE org_id = ${org_id} AND cluster_id != ${id} AND LOWER(name) = LOWER(${trimmedName})
        LIMIT 1
      `;
      if (existing) {
        return reply.status(400).send({ detail: `A cluster with name '${trimmedName}' already exists.` });
      }
      await sql`UPDATE clusters SET name = ${trimmedName} WHERE cluster_id = ${id} AND org_id = ${org_id}`;
    }
    if (cloud_provider !== undefined) await sql`UPDATE clusters SET cloud_provider = ${cloud_provider} WHERE cluster_id = ${id} AND org_id = ${org_id}`;
    if (k8s_version !== undefined)    await sql`UPDATE clusters SET k8s_version = ${k8s_version} WHERE cluster_id = ${id} AND org_id = ${org_id}`;
    if (master_alerts_enabled !== undefined) await sql`UPDATE clusters SET master_alerts_enabled = ${master_alerts_enabled} WHERE cluster_id = ${id} AND org_id = ${org_id}`;
    if (worker_alerts_enabled !== undefined) await sql`UPDATE clusters SET worker_alerts_enabled = ${worker_alerts_enabled} WHERE cluster_id = ${id} AND org_id = ${org_id}`;
    if (node_cpu_threshold !== undefined)    await sql`UPDATE clusters SET node_cpu_threshold = ${node_cpu_threshold} WHERE cluster_id = ${id} AND org_id = ${org_id}`;
    if (node_memory_threshold !== undefined) await sql`UPDATE clusters SET node_memory_threshold = ${node_memory_threshold} WHERE cluster_id = ${id} AND org_id = ${org_id}`;

    await invalidateCache(`clusters:${org_id}`);
    return { message: "Updated" };
  });

  // PATCH & POST /api/clusters/:id/heartbeat — agent calls this (no auth)
  const heartbeatHandler = async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const { status, k8s_version, error_message, agent_token, api_server_url, token, ca_cert } = req.body as any;

    // Verify agent token: match either current agent_token in DB or incoming service account token
    const [cluster] = await sql`
      SELECT cluster_id, org_id, name, status, error_message, agent_token, api_server_url
      FROM clusters 
      WHERE cluster_id = ${id} AND (agent_token = ${agent_token || ""} OR agent_token = ${token || ""})
    `;
    if (!cluster) return reply.status(401).send({ detail: "Invalid token" });

    const newStatus = status || "connected";
    const statusChanged = cluster.status !== newStatus;
    const errorChanged = cluster.error_message !== (error_message || null);

    // Invalidate clients cache if agent credentials changed
    const credentialsChanged =
      (api_server_url && cluster.api_server_url !== api_server_url) ||
      (token && cluster.agent_token !== token);

    if (credentialsChanged) {
      const { invalidateK8sClient } = await import("../services/k8s.js");
      invalidateK8sClient(id);
    }

    // Don't overwrite existing agent_token or api_server_url if set via service account settings
    await sql`
      UPDATE clusters
      SET status = ${newStatus},
          last_seen_at = now(),
          k8s_version = COALESCE(${k8s_version || null}, k8s_version),
          error_message = ${error_message || null}
      WHERE cluster_id = ${id}
    `;

    // Publish alert if status changed or new error is reported
    if (statusChanged || errorChanged) {
      let eventType = "cluster_connected";
      let details = `Cluster '${cluster.name}' is connected and reporting healthy.`;
      
      if (newStatus === "error" || error_message) {
        eventType = "cluster_error";
        details = `Cluster '${cluster.name}' reported an error: ${error_message || "Unknown error"}`;
      } else if (newStatus === "disconnected") {
        eventType = "cluster_disconnected";
        details = `Cluster '${cluster.name}' went offline.`;
      }

      const cooldownKey = `cooldown:alert:${eventType}:${id}`;
      const activeCooldown = await redis.get(cooldownKey);
      if (!activeCooldown) {
        await redis.setex(cooldownKey, 900, "1"); // 15 mins cooldown
        await redis.publish(
          "srevox:system_alerts",
          JSON.stringify({
            event_type: eventType,
            org_id: cluster.org_id,
            cluster_id: id,
            cluster_name: cluster.name,
            details,
          })
        );
      }
    }

    return { message: "Heartbeat recorded" };
  };

  app.patch("/:id/heartbeat", heartbeatHandler);
  app.post("/:id/heartbeat", heartbeatHandler);

  // POST /api/clusters/:id/metrics-connection — save and test metrics connection
  app.post("/:id/metrics-connection", {
    onRequest: [(app as any).authenticate, requirePermission("addCluster")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const { method, api_server_url, sa_token, agent_token: legacyToken, skip_tls_verify, kubeconfig } = req.body as any;
    const incomingSaToken = sa_token || legacyToken;

    const [cluster] = await sql`
      SELECT cluster_id, agent_token, sa_token, kubeconfig_encrypted, status, error_message 
      FROM clusters 
      WHERE cluster_id = ${id} AND org_id = ${org_id}
    `;
    if (!cluster) return reply.status(404).send({ detail: "Cluster not found" });

    // Ensure agent_token is valid and intact
    if (!cluster.agent_token || !cluster.agent_token.startsWith("agt")) {
      const fixedAgentToken = genId("agt");
      await sql`UPDATE clusters SET agent_token = ${fixedAgentToken} WHERE cluster_id = ${id}`;
    }

    // Update connection credentials based on method selected
    if (method === "agent_only") {
      await sql`
        UPDATE clusters
        SET api_server_url = NULL,
            kubeconfig_encrypted = NULL,
            sa_token = NULL,
            skip_tls_verify = FALSE,
            status = 'connected',
            metrics_status = 'disabled',
            metrics_error = NULL,
            master_nodes_ready = 0,
            master_nodes_total = 0,
            worker_nodes_ready = 0,
            worker_nodes_total = 0,
            connection_type = 'agent'
        WHERE cluster_id = ${id}
      `;
    } else if (method === "token") {
      const finalSaToken = (incomingSaToken === "••••••••••••••••") ? cluster.sa_token : (incomingSaToken || null);
      await sql`
        UPDATE clusters
        SET api_server_url = ${api_server_url || null},
            sa_token = ${finalSaToken},
            kubeconfig_encrypted = NULL,
            skip_tls_verify = ${skip_tls_verify === true},
            connection_type = 'token'
        WHERE cluster_id = ${id}
      `;
    } else if (method === "kubeconfig") {
      const finalKubeconfig = (kubeconfig === "••••••••••••••••") ? cluster.kubeconfig_encrypted : (kubeconfig || null);
      await sql`
        UPDATE clusters
        SET api_server_url = NULL,
            sa_token = NULL,
            kubeconfig_encrypted = ${finalKubeconfig},
            skip_tls_verify = FALSE,
            connection_type = 'kubeconfig'
        WHERE cluster_id = ${id}
      `;
    }

    // Invalidate K8s client cache
    const { invalidateK8sClient, getK8sClient } = await import("../services/k8s.js");
    invalidateK8sClient(id);

    // Test connection if not agent_only
    if (method !== "agent_only") {
      try {
        const { core, metrics } = await getK8sClient(id);
        const nodesRes = await core.listNode();
        const nodeCount = nodesRes.items?.length || 0;

        let metricsHealthy = false;
        try {
          const mRes = await metrics.getNodeMetrics();
          if (mRes && mRes.items && mRes.items.length > 0) {
            metricsHealthy = true;
          }
        } catch {}

        const nextMetricsStatus = metricsHealthy ? 'connected' : 'error';

        await sql`
          UPDATE clusters
          SET status = 'connected',
              metrics_status = ${nextMetricsStatus},
              error_message = null,
              metrics_error = ${metricsHealthy ? null : 'Metrics Server not installed or reporting'}
          WHERE cluster_id = ${id}
        `;

        await invalidateCache(`clusters:${org_id}`);

        if (!metricsHealthy) {
          return reply.status(400).send({
            success: false,
            detail: `Connected to API Server successfully, but Metrics Server is NOT installed or reporting in this cluster.`
          });
        }

        return { success: true, message: `Connected successfully — ${nodeCount} node(s) visible with Metrics Server active`, nodeCount };
      } catch (err: any) {
        console.error("[metrics-connection] Test connection failed:", err.message);
        
        await sql`
          UPDATE clusters
          SET status = 'error',
              metrics_status = 'error',
              error_message = ${err.message || 'Connection failed'},
              metrics_error = ${err.message || 'Connection failed'}
          WHERE cluster_id = ${id}
        `;

        await invalidateCache(`clusters:${org_id}`);
        return reply.status(400).send({
          success: false,
          detail: `Connection test failed: ${err.message || 'Unknown error'}`
        });
      }
    }

    await invalidateCache(`clusters:${org_id}`);
    return { success: true, message: "Metrics connection saved successfully" };
  });

  // POST /api/clusters/:id/refresh-metrics — clear client cache and trigger nodes evaluator
  app.post("/:id/refresh-metrics", {
    onRequest: [(app as any).authenticate],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };

    const [cluster] = await sql`
      SELECT cluster_id 
      FROM clusters 
      WHERE cluster_id = ${id} AND org_id = ${org_id}
    `;
    if (!cluster) return reply.status(404).send({ detail: "Cluster not found" });

    const { invalidateK8sClient } = await import("../services/k8s.js");
    invalidateK8sClient(id);

    try {
      const { checkClusterNodesAndMetrics } = await import("../services/infraEvaluator.js");
      checkClusterNodesAndMetrics().catch(err => console.error("[refresh-metrics] re-eval check error:", err));
      return { success: true, message: "Metrics refreshed successfully" };
    } catch (err: any) {
      return reply.status(500).send({ detail: `Failed to refresh: ${err.message}` });
    }
  });

  // POST /api/clusters/:id/regenerate-agent-token — admin only (regenerates ONLY agent token)
  app.post("/:id/regenerate-agent-token", {
    onRequest: [(app as any).authenticate, requirePermission("addCluster")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };

    const [cluster] = await sql`
      SELECT cluster_id, name 
      FROM clusters 
      WHERE cluster_id = ${id} AND org_id = ${org_id}
    `;
    if (!cluster) return reply.status(404).send({ detail: "Cluster not found" });

    const newAgentToken = genId("agt");
    await sql`
      UPDATE clusters
      SET agent_token = ${newAgentToken}
      WHERE cluster_id = ${id} AND org_id = ${org_id}
    `;

    await invalidateCache(`clusters:${org_id}`);
    return {
      success: true,
      cluster_id: id,
      name: cluster.name,
      agent_token: newAgentToken,
      update_command: `kubectl set env deployment/srevox-agent -n kube-system AGENT_TOKEN="${newAgentToken}"`,
      instructions: "Run the command below in your Kubernetes cluster to update your srevox-agent deployment with the new Agent Token."
    };
  });

  // POST /api/clusters/:id/regenerate-cluster-id — admin only (regenerates ONLY cluster ID)
  app.post("/:id/regenerate-cluster-id", {
    onRequest: [(app as any).authenticate, requirePermission("addCluster")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };

    const [cluster] = await sql`
      SELECT cluster_id, name, agent_token 
      FROM clusters 
      WHERE cluster_id = ${id} AND org_id = ${org_id}
    `;
    if (!cluster) return reply.status(404).send({ detail: "Cluster not found" });

    const newClusterId = genId("cls");

    await sql`UPDATE alert_rules SET cluster_id = ${newClusterId} WHERE cluster_id = ${id}`;
    await sql`UPDATE incidents SET cluster_id = ${newClusterId} WHERE cluster_id = ${id}`;
    await sql`UPDATE resource_alerts SET cluster_id = ${newClusterId} WHERE cluster_id = ${id}`;
    await sql`UPDATE cluster_nodes SET cluster_id = ${newClusterId} WHERE cluster_id = ${id}`;
    await sql`UPDATE cluster_nodes_history SET cluster_id = ${newClusterId} WHERE cluster_id = ${id}`;
    await sql`UPDATE cluster_pods SET cluster_id = ${newClusterId} WHERE cluster_id = ${id}`;
    await sql`UPDATE clusters SET cluster_id = ${newClusterId} WHERE cluster_id = ${id} AND org_id = ${org_id}`;

    await invalidateCache(`clusters:${org_id}`);
    return {
      success: true,
      old_cluster_id: id,
      new_cluster_id: newClusterId,
      name: cluster.name,
      agent_token: cluster.agent_token,
      update_command: `kubectl set env deployment/srevox-agent -n kube-system CLUSTER_ID="${newClusterId}"`,
      instructions: "Run the command below in your Kubernetes cluster to update your srevox-agent deployment with the new Cluster ID."
    };
  });

  // DELETE /api/clusters/:id — admin only
  app.delete("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("deleteCluster")],
  }, async (req) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };

    const [cluster] = await sql`
      SELECT name, org_id 
      FROM clusters 
      WHERE cluster_id = ${id} AND org_id = ${org_id}
    `;
    if (cluster) {
      await redis.publish(
        "srevox:system_alerts",
        JSON.stringify({
          event_type: "cluster_deleted",
          org_id: cluster.org_id,
          cluster_id: id,
          cluster_name: cluster.name,
          details: `Cluster '${cluster.name}' was permanently deleted by an administrator.`,
        })
      );
    }

    await sql`UPDATE incidents SET cluster_id = NULL, rule_id = NULL WHERE cluster_id = ${id}`;
    await sql`DELETE FROM alert_rules WHERE cluster_id = ${id}`;
    await sql`DELETE FROM clusters WHERE cluster_id = ${id} AND org_id = ${org_id}`;
    await invalidateCache(`clusters:${org_id}`);
    return { message: "Removed" };
  });
}