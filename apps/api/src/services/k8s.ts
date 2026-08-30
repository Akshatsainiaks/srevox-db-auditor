import * as k8s from "@kubernetes/client-node";
import sql from "../db/sql.js";

const clients = new Map<string, { kc: k8s.KubeConfig; core: k8s.CoreV1Api; metrics: k8s.Metrics }>();

export async function getK8sClient(clusterId: string) {
  if (clients.has(clusterId)) return clients.get(clusterId)!;

  const [cluster] = await sql`
    SELECT connection_type, kubeconfig_encrypted, api_server_url, agent_token, sa_token, agent_ca_cert, skip_tls_verify 
    FROM clusters 
    WHERE cluster_id = ${clusterId}
  `;
  if (!cluster) throw new Error("Cluster not found");

  const kc = new k8s.KubeConfig();
  if (cluster.connection_type === "agent") {
    if (cluster.kubeconfig_encrypted) {
      kc.loadFromString(cluster.kubeconfig_encrypted);
    } else {
      throw new Error("Metrics connection is not configured for agent-based clusters");
    }
  } else if (cluster.kubeconfig_encrypted) {
    kc.loadFromString(cluster.kubeconfig_encrypted);
  } else if (cluster.api_server_url) {
    const tokenToUse = cluster.sa_token || cluster.agent_token;
    if (!tokenToUse) {
      throw new Error("Service Account Token is required for metrics connection");
    }
    // Base64 encode the CA cert if it is in raw PEM format
    let caData = cluster.agent_ca_cert || undefined;
    if (caData && !caData.startsWith("LS0t")) {
      caData = Buffer.from(caData).toString("base64");
    }

    const kubeconfigJson = {
      apiVersion: "v1",
      kind: "Config",
      clusters: [
        {
          name: `cluster-${clusterId}`,
          cluster: {
            server: cluster.api_server_url,
            "certificate-authority-data": caData,
            "insecure-skip-tls-verify": cluster.skip_tls_verify === true || !caData,
          },
        },
      ],
      users: [
        {
          name: `user-${clusterId}`,
          user: {
            token: tokenToUse,
          },
        },
      ],
      contexts: [
        {
          name: `context-${clusterId}`,
          context: {
            cluster: `cluster-${clusterId}`,
            user: `user-${clusterId}`,
          },
        },
      ],
      "current-context": `context-${clusterId}`,
    };
    kc.loadFromString(JSON.stringify(kubeconfigJson));
  } else {
    throw new Error("Direct K8s metrics connection is not configured for this cluster. Use Kubeconfig or Service Account.");
  }

  // Auto-enable skipTLSVerify for all unencrypted HTTP server URLs to bypass @kubernetes/client-node restriction
  for (const c of kc.clusters) {
    if (c.server && c.server.startsWith("http:")) {
      (c as any).skipTLSVerify = true;
    }
    if (cluster.skip_tls_verify === true || !cluster.agent_ca_cert || (c as any)["insecure-skip-tls-verify"] === true) {
      (c as any).skipTLSVerify = true;
    }
  }

  const client = {
    kc,
    core: kc.makeApiClient(k8s.CoreV1Api),
    metrics: new k8s.Metrics(kc),
  };
  clients.set(clusterId, client);
  return client;
}

export function invalidateK8sClient(clusterId: string) {
  clients.delete(clusterId);
}
