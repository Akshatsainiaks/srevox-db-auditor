// Default Mock Data for Srevox Guided Walkthroughs

export const defaultMockClusters = [
  {
    cluster_id: "mock-prod-cluster",
    name: "srevox-prod-gke",
    connection_type: "agent",
    cloud_provider: "gcp",
    k8s_version: "v1.28.3",
    status: "connected",
    open_incidents_count: 1,
    created_at: "2026-06-15T10:00:00Z",
    last_seen_at: new Date().toISOString(),
    metrics_configured: true,
    metrics_status: "connected",
    api_server_url: "https://34.120.45.12:443",
    skip_tls_verify: true,
    master_nodes_ready: 3,
    master_nodes_total: 3,
    worker_nodes_ready: 21,
    worker_nodes_total: 21,
  },
  {
    cluster_id: "mock-staging-cluster",
    name: "srevox-staging-eks",
    connection_type: "kubeconfig",
    cloud_provider: "aws",
    k8s_version: "v1.27.4",
    status: "connected",
    open_incidents_count: 0,
    created_at: "2026-06-15T11:00:00Z",
    last_seen_at: new Date().toISOString(),
    metrics_configured: true,
    metrics_status: "connected",
    api_server_url: "https://eks-api.eu-west-1.aws.com",
    skip_tls_verify: false,
    master_nodes_ready: 1,
    master_nodes_total: 1,
    worker_nodes_ready: 7,
    worker_nodes_total: 7,
  },
  {
    cluster_id: "mock-dev-cluster",
    name: "srevox-dev-kind",
    connection_type: "agent",
    cloud_provider: "kind",
    k8s_version: "v1.29.0",
    status: "connected",
    open_incidents_count: 2,
    created_at: "2026-06-15T12:00:00Z",
    last_seen_at: new Date().toISOString(),
    metrics_configured: true,
    metrics_status: "connected",
    api_server_url: "https://127.0.0.1:6443",
    skip_tls_verify: true,
    master_nodes_ready: 1,
    master_nodes_total: 1,
    worker_nodes_ready: 0,
    worker_nodes_total: 0,
  }
];

export const defaultMockIncidents = [
  {
    incident_id: "mock-inc-1",
    cluster_id: "mock-dev-cluster",
    cluster_name: "srevox-dev-kind",
    pod_name: "payment-gateway-7f49b9cd4b-6x8pq",
    namespace: "finance",
    container_name: "gateway",
    crash_reason: "OOMKilled",
    restart_count: 8,
    exit_code: 137,
    severity: "critical",
    status: "open",
    first_seen_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    last_seen_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    pod_labels: { app: "payment-gateway", tier: "backend" },
    ai_diagnosed_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    ai_diagnosis: {
      root_cause: "The payment-gateway pod was terminated by the Linux Out-Of-Memory (OOM) killer because its memory usage exceeded the configured limit of 512Mi. The memory profile shows a steady increase in heap size, suggesting a potential memory leak in the transaction routing module during batch card verification processes.",
      severity_assessment: "CRITICAL. The service is unable to start successfully, causing transactions in the finance namespace to fail. Immediate memory threshold adjustments or debugging of transaction memory allocations is required.",
      fix_steps: [
        "Increase the pod memory request and limit in the Deployment configuration to 1Gi.",
        "Inspect payment-gateway transaction logic for unclosed resource sockets or database connections.",
        "Monitor heap profile using a Node.js/Go profiler during transactions."
      ],
      kubectl_commands: [
        "kubectl describe pod payment-gateway-7f49b9cd4b-6x8pq -n finance",
        "kubectl edit deployment payment-gateway -n finance",
        "kubectl logs payment-gateway-7f49b9cd4b-6x8pq -n finance --previous"
      ],
      prevention: "Implement horizontal pod autoscaling (HPA) based on memory utilization, and configure runtime memory limits (e.g. NODE_OPTIONS/GOMEMLIMIT) to trigger garbage collection before the kernel terminates the container.",
      estimated_fix_time: "15 minutes",
      related_docs: "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/"
    }
  },
  {
    incident_id: "mock-inc-2",
    cluster_id: "mock-prod-cluster",
    cluster_name: "srevox-prod-gke",
    pod_name: "auth-service-59bc6594b4-m4nqp",
    namespace: "auth",
    container_name: "server",
    crash_reason: "CrashLoopBackOff",
    restart_count: 14,
    exit_code: 1,
    severity: "critical",
    status: "acknowledged",
    acknowledged_by_name: "Demo Admin",
    first_seen_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    last_seen_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    pod_labels: { app: "auth-service", version: "v2.1" },
    ai_diagnosed_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    ai_diagnosis: {
      root_cause: "Container exited with code 1. Checking previous logs indicates database connection timeout. The auth-service was trying to connect to 'postgres-db.database.svc.cluster.local:5432' but the service was DNS-unresolvable or rejecting connections during database migration.",
      severity_assessment: "HIGH. Auth service is failing to startup. Users will not be able to log in. Service will restart continuously.",
      fix_steps: [
        "Check if postgres-db service is running in database namespace.",
        "Verify the environment variable settings in the deployment spec match the database password and host details.",
        "Check network policies between auth namespace and database namespace."
      ],
      kubectl_commands: [
        "kubectl get pods -n database",
        "kubectl logs auth-service-59bc6594b4-m4nqp -n auth",
        "kubectl exec -it auth-service-59bc6594b4-m4nqp -n auth -- nslookup postgres-db.database"
      ],
      prevention: "Configure a database healthcheck readiness/liveness probe, and use initContainers to block the auth-service pod startup until postgres-db is fully responsive.",
      estimated_fix_time: "10 minutes",
      related_docs: "https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/"
    }
  },
  {
    incident_id: "mock-inc-3",
    cluster_id: "mock-dev-cluster",
    cluster_name: "srevox-dev-kind",
    pod_name: "redis-cache-0",
    namespace: "database",
    node: "dev-kind-control-plane",
    container_name: "redis",
    crash_reason: "Error",
    restart_count: 2,
    exit_code: 139,
    severity: "warning",
    status: "open",
    first_seen_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    last_seen_at: new Date(Date.now() - 1.8 * 3600 * 1000).toISOString(),
    pod_labels: { role: "replica" }
  },
  {
    incident_id: "mock-inc-4",
    cluster_id: "mock-prod-cluster",
    cluster_name: "srevox-prod-gke",
    pod_name: "frontend-nginx-68f44d8cb9-9klst",
    namespace: "default",
    node: "prod-gke-worker-2",
    container_name: "nginx",
    crash_reason: "Completed",
    restart_count: 1,
    exit_code: 0,
    severity: "info",
    status: "resolved",
    resolved_by_name: "System Cleaner",
    resolved_at: new Date(Date.now() - 3.9 * 3600 * 1000).toISOString(),
    first_seen_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    last_seen_at: new Date(Date.now() - 3.9 * 3600 * 1000).toISOString(),
    pod_labels: { app: "nginx-ingress" }
  }
];

export const defaultMockChannels = [
  {
    channel_id: "mock-chan-slack",
    name: "#ops-alerts",
    type: "slack",
    enabled: true,
    created_at: "2026-06-15T10:00:00Z",
    config: { webhook_url: "https://hooks.slack.com/services/T00/B00/X00" }
  },
  {
    channel_id: "mock-chan-email",
    name: "SRE Team Email",
    type: "email",
    enabled: true,
    created_at: "2026-06-15T11:00:00Z",
    config: { email: "sre-alerts@srevox-demo.io" }
  },
  {
    channel_id: "mock-chan-webhook",
    name: "PagerDuty Webhook",
    type: "webhook",
    enabled: false,
    created_at: "2026-06-15T12:00:00Z",
    config: { url: "https://events.pagerduty.com/v2/enqueue" }
  }
];

export const defaultMockRules = [
  {
    rule_id: "mock-rule-oom",
    cluster_id: "mock-prod-cluster",
    cluster_name: "srevox-prod-gke",
    name: "OOMKilled Critical Alert",
    description: "Triggers when any container is OOMKilled in production",
    namespaces: ["*"],
    crash_reasons: ["OOMKilled"],
    min_restarts: 1,
    cooldown_minutes: 5,
    severity: "critical",
    channel_ids: ["mock-chan-slack"],
    enabled: true,
    created_at: "2026-06-15T10:00:00Z"
  },
  {
    rule_id: "mock-rule-crash",
    cluster_id: "mock-staging-cluster",
    cluster_name: "srevox-staging-eks",
    name: "Staging Crash Loop Alert",
    description: "Alert on repetitive CrashLoopBackOffs in staging",
    namespaces: ["finance"],
    crash_reasons: ["CrashLoopBackOff"],
    min_restarts: 5,
    cooldown_minutes: 10,
    severity: "warning",
    channel_ids: ["mock-chan-email"],
    enabled: true,
    created_at: "2026-06-15T11:00:00Z"
  },
  {
    rule_id: "mock-rule-jobs",
    cluster_id: "*",
    cluster_name: "All Clusters",
    name: "Mute Job Completions",
    description: "Do not alert on successful job exits",
    namespaces: ["jobs"],
    crash_reasons: ["Completed"],
    min_restarts: 0,
    cooldown_minutes: 0,
    severity: "info",
    channel_ids: [],
    enabled: false,
    created_at: "2026-06-15T12:00:00Z"
  }
];

export const defaultMockResourceAlerts = [
  {
    resource_alert_id: "mock-res-alert-1",
    cluster_id: "mock-prod-cluster",
    resource_type: "cpu",
    threshold_pct: 85,
    target: "node",
    severity: "warning",
    enabled: true,
    created_at: "2026-07-18T10:00:00.000Z",
    updated_at: "2026-07-18T10:00:00.000Z"
  },
  {
    resource_alert_id: "mock-res-alert-2",
    cluster_id: "mock-dev-cluster",
    resource_type: "memory",
    threshold_pct: 90,
    target: "node",
    target_name: "dev-kind-control-plane",
    severity: "critical",
    enabled: true,
    created_at: "2026-07-18T10:05:00.000Z",
    updated_at: "2026-07-18T10:05:00.000Z"
  }
];

export const defaultMockPreferences = {
  severities: ["critical", "warning", "info"],
  crash_reasons: [],
  namespaces: [],
  quiet_hours_start: null,
  quiet_hours_end: null,
  notify_resolved: false,
  notify_acknowledged: false,
  enabled: true
};

export function getMockNodes(clusterId: string) {
  if (clusterId === "mock-prod-cluster") {
    return [
      {
        name: "prod-gke-master-0",
        role: "master",
        status: "Ready",
        cpu_usage_pct: 45,
        memory_usage_pct: 60,
        cpu_cores: 8,
        memory_gb: 32,
        pods_running: 42,
        pods_capacity: 110,
        age: "45d",
        conditions: [{ type: "Ready", status: "True" }, { type: "NetworkUnavailable", status: "False" }]
      },
      {
        name: "prod-gke-worker-1",
        role: "worker",
        status: "Ready",
        cpu_usage_pct: 68,
        memory_usage_pct: 84,
        cpu_cores: 16,
        memory_gb: 64,
        pods_running: 88,
        pods_capacity: 110,
        age: "45d",
        conditions: [{ type: "Ready", status: "True" }]
      },
      {
        name: "prod-gke-worker-2",
        role: "worker",
        status: "Ready",
        cpu_usage_pct: 72,
        memory_usage_pct: 81,
        cpu_cores: 16,
        memory_gb: 64,
        pods_running: 92,
        pods_capacity: 110,
        age: "45d",
        conditions: [{ type: "Ready", status: "True" }]
      }
    ];
  } else if (clusterId === "mock-staging-cluster") {
    return [
      {
        name: "staging-eks-master-0",
        role: "master",
        status: "Ready",
        cpu_usage_pct: 30,
        memory_usage_pct: 42,
        cpu_cores: 4,
        memory_gb: 16,
        pods_running: 18,
        pods_capacity: 58,
        age: "12d",
        conditions: [{ type: "Ready", status: "True" }]
      },
      {
        name: "staging-eks-worker-1",
        role: "worker",
        status: "Ready",
        cpu_usage_pct: 41,
        memory_usage_pct: 48,
        cpu_cores: 8,
        memory_gb: 32,
        pods_running: 32,
        pods_capacity: 58,
        age: "12d",
        conditions: [{ type: "Ready", status: "True" }]
      }
    ];
  } else {
    return [
      {
        name: "dev-kind-control-plane",
        role: "master",
        status: "Ready",
        cpu_usage_pct: 91,
        memory_usage_pct: 82,
        cpu_cores: 4,
        memory_gb: 8,
        pods_running: 15,
        pods_capacity: 110,
        age: "2d",
        conditions: [{ type: "Ready", status: "True" }, { type: "DiskPressure", status: "True" }]
      }
    ];
  }
}

export function getMockPods(clusterId: string) {
  if (clusterId === "mock-prod-cluster") {
    return [
      {
        name: "auth-service-59bc6594b4-m4nqp",
        namespace: "auth",
        node: "prod-gke-worker-1",
        status: "Running",
        cpu_usage_m: 120,
        memory_usage_mi: 240,
        cpu_limit_m: 500,
        memory_limit_mi: 512,
        restarts: 14,
        age: "3d"
      },
      {
        name: "frontend-nginx-68f44d8cb9-9klst",
        namespace: "default",
        node: "prod-gke-worker-2",
        status: "Running",
        cpu_usage_m: 45,
        memory_usage_mi: 98,
        cpu_limit_m: 200,
        memory_limit_mi: 256,
        restarts: 1,
        age: "12d"
      },
      {
        name: "payment-service-f98b67d5-dkls2",
        namespace: "finance",
        node: "prod-gke-worker-1",
        status: "Running",
        cpu_usage_m: 320,
        memory_usage_mi: 680,
        cpu_limit_m: 1000,
        memory_limit_mi: 1024,
        restarts: 0,
        age: "45d"
      }
    ];
  } else if (clusterId === "mock-staging-cluster") {
    return [
      {
        name: "catalog-api-7db94c9f-jk921",
        namespace: "catalog",
        node: "staging-eks-worker-1",
        status: "Running",
        cpu_usage_m: 85,
        memory_usage_mi: 128,
        cpu_limit_m: 250,
        memory_limit_mi: 256,
        restarts: 0,
        age: "5d"
      },
      {
        name: "user-profile-db-0",
        namespace: "auth",
        node: "staging-eks-worker-1",
        status: "Running",
        cpu_usage_m: 150,
        memory_usage_mi: 512,
        cpu_limit_m: 500,
        memory_limit_mi: 1024,
        restarts: 0,
        age: "12d"
      }
    ];
  } else {
    return [
      {
        name: "payment-gateway-7f49b9cd4b-6x8pq",
        namespace: "finance",
        node: "dev-kind-control-plane",
        status: "CrashLoopBackOff",
        cpu_usage_m: 450,
        memory_usage_mi: 505,
        cpu_limit_m: 500,
        memory_limit_mi: 512,
        restarts: 8,
        age: "2h"
      },
      {
        name: "redis-cache-0",
        namespace: "database",
        node: "dev-kind-control-plane",
        status: "Running",
        cpu_usage_m: 120,
        memory_usage_mi: 198,
        cpu_limit_m: 200,
        memory_limit_mi: 256,
        restarts: 2,
        age: "1d"
      }
    ];
  }
}

export function makeAxiosResponse(data: any, status = 200, config: any): any {
  return {
    data,
    status,
    statusText: status === 200 ? "OK" : status === 201 ? "Created" : "No Content",
    headers: { "content-type": "application/json" },
    config,
    request: {}
  };
}

export const defaultMockUsers = [
  {
    user_id: "usrjncj44t4hb4",
    email: "admin@srevox.local",
    full_name: "Admin User",
    role: "admin",
    permissions: {},
    is_active: true,
    created_at: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
  },
  {
    user_id: "usrjncj44t4hb5",
    email: "member@srevox.local",
    full_name: "Member User",
    role: "member",
    permissions: {
      "tea78j4hfb": [
        { "id": "vie78j4hfb", "value": true }
      ],
      "rul67i4hfb": [
        {
          "id": "vie67i4hfb",
          "value": true,
          "resources": [
            { "id": "perm3rjhb32fb", "value": true },
            { "id": "vie4h44hbvr", "value": false }
          ]
        },
        {
          "id": "tog90l4hfb",
          "value": true,
          "resources": [
            { "id": "t0gjb3mhbf", "value": true }
          ]
        }
      ]
    },
    is_active: true,
    created_at: new Date(Date.now() - 15 * 86400 * 1000).toISOString(),
  },
  {
    user_id: "usrjncj44t4hb6",
    email: "viewer@srevox.local",
    full_name: "Viewer User",
    role: "viewer",
    permissions: {
      "inci3hbr43hb": [
        { "id": "vie3jrhb4r", "value": true }
      ],
      "rul67i4hfb": [
        {
          "id": "vie67i4hfb",
          "value": true,
          "resources": [
            { "id": "perm3rjhb32fb", "value": true },
            { "id": "vie4h44hbvr", "value": false }
          ]
        }
      ]
    },
    is_active: true,
    created_at: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
  }
];

export const defaultMockServiceOwners = [
  {
    service_owner_id: "mock-so-1",
    cluster_id: "mock-prod-cluster",
    cluster_name: "srevox-prod-gke",
    namespace: "auth",
    pod_prefix: "auth-service",
    user_id: "usrjncj44t4hb4",
    owner_name: "Admin User",
    owner_email: "admin@srevox.local",
    channel_ids: ["mock-chan-slack"],
    alert_crash_reasons: [],
    created_at: "2026-06-15T12:00:00Z"
  }
];

export const defaultMockGroups: any[] = [
  {
    group_id: "mock-grp-1",
    org_id: "orgjncj44t4hb4",
    name: "Incident Response Team",
    description: "Responsible for managing and resolving production incidents.",
    permissions: {
      "inci3hbr43hb": [
        { "id": "ack4rnf4jbf", "value": true },
        { "id": "res34f4hfb", "value": true },
        { "id": "run45g4hfb", "value": true }
      ]
    },
    created_at: "2026-06-20T10:00:00Z"
  },
  {
    group_id: "mock-grp-2",
    org_id: "orgjncj44t4hb4",
    name: "Cluster Administrators",
    description: "Manage cluster credentials and connection tokens.",
    permissions: {
      "clu4rhbrhb": [
        { "id": "add56h4hfb", "value": true },
        { "id": "del67i4hfb", "value": true }
      ]
    },
    created_at: "2026-06-20T11:00:00Z"
  }
];

export const defaultMockGroupMembers = [
  { group_id: "mock-grp-1", user_id: "usrjncj44t4hb4" }
];

function mergePermissions(userPerms: any, groupsPerms: any[]): any {
  const merged: any = {};
  const mergeSingle = (perms: any) => {
    if (!perms || typeof perms !== "object" || Array.isArray(perms)) return;
    for (const [catId, arr] of Object.entries(perms)) {
      if (!Array.isArray(arr)) continue;
      if (!merged[catId]) merged[catId] = [];
      const mergedArr = merged[catId];
      for (const item of arr) {
        if (!item || typeof item !== "object" || !item.id) continue;
        let existing = mergedArr.find((p: any) => p && p.id === item.id);
        if (!existing) {
          existing = { id: item.id, value: false };
          mergedArr.push(existing);
        }
        if (item.value === true) {
          existing.value = true;
        }
        if (item.resources && Array.isArray(item.resources)) {
          if (!existing.resources) existing.resources = [];
          for (const res of item.resources) {
            if (!res || typeof res !== "object" || !res.id) continue;
            let existingRes = existing.resources.find((r: any) => r && r.id === res.id);
            if (!existingRes) {
              existingRes = { id: res.id, value: false };
              existing.resources.push(existingRes);
            }
            if (res.value === true) {
              existingRes.value = true;
            }
          }
        }
      }
    }
  };
  mergeSingle(userPerms);
  for (const gp of groupsPerms) {
    mergeSingle(gp);
  }
  return merged;
}

// ── Mock Data System Helpers ──────────────────────────────────────────────────

function getMockData<T>(key: string, defaults: T): T {
  if (typeof window === "undefined") return defaults;
  const raw = localStorage.getItem(key);
  if (!raw || raw === "[object Object]" || raw.startsWith("[object Object]")) {
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return defaults;
  }
}

function saveMockData<T>(key: string, data: T) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

function parseRequestBody(data: any): any {
  if (!data) return {};
  if (typeof data === "object") return data;
  if (typeof data === "string") {
    if (data === "[object Object]" || data.startsWith("[object Object]")) {
      return {};
    }
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return {};
}

export function initializeMockData() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem("sv_mock_initialized")) {
    localStorage.setItem("sv_mock_clusters", JSON.stringify(defaultMockClusters));
    localStorage.setItem("sv_mock_incidents", JSON.stringify(defaultMockIncidents));
    localStorage.setItem("sv_mock_channels", JSON.stringify(defaultMockChannels));
    localStorage.setItem("sv_mock_rules", JSON.stringify(defaultMockRules));
    localStorage.setItem("sv_mock_resource_alerts", JSON.stringify(defaultMockResourceAlerts));
    localStorage.setItem("sv_mock_service_owners", JSON.stringify(defaultMockServiceOwners));
    localStorage.setItem("sv_mock_users", JSON.stringify(defaultMockUsers));
    localStorage.setItem("sv_mock_initialized", "true");
  }
}

// Global initialization of mock data in localStorage
if (typeof window !== "undefined") {
  const isMockActive = localStorage.getItem("sv_autopilot_tour_active") === "true" || localStorage.getItem("sv_auto_tour_active") === "true";
  if (isMockActive && !localStorage.getItem("sv_mock_initialized")) {
    initializeMockData();
  }
}

export async function handleMockRequest(config: any): Promise<any> {
  const urlObj = new URL(config.url || "", typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const path = urlObj.pathname;
  const method = (config.method || "get").toLowerCase();
  
  // Parse params
  const params = {
    ...config.params,
    ...Object.fromEntries(urlObj.searchParams.entries())
  };

  // Auth Mock endpoints
  if (path === "/api/auth/account" && method === "get") {
    let localUser: any = {
      user_id: "usrjncj44t4hb4",
      email: "admin@srevox.local",
      full_name: "Admin User",
      role: "admin",
      permissions: {},
      org_id: "orgjncj44t4hb4",
      org: {
        org_id: "orgjncj44t4hb4",
        name: "My Organization",
        slug: "my-org"
      }
    };
    if (typeof window !== "undefined") {
      const u = localStorage.getItem("lz_user");
      if (u) {
        try { localUser = JSON.parse(u); } catch {}
      }
    }

    const groups = getMockData("sv_mock_groups", defaultMockGroups);
    const memberships = getMockData("sv_mock_group_members", defaultMockGroupMembers);
    const userGroups = memberships.filter((m: any) => m.user_id === localUser.user_id)
      .map((m: any) => groups.find((g: any) => g.group_id === m.group_id))
      .filter(Boolean);
    const effectivePerms = mergePermissions(localUser.permissions || {}, userGroups.map((g: any) => g.permissions));

    return makeAxiosResponse({
      ...localUser,
      groups: userGroups.map((g: any) => ({ group_id: g.group_id, name: g.name })),
      effective_permissions: effectivePerms
    }, 200, config);
  }

  if (path === "/api/auth/account" && method === "patch") {
    const body = parseRequestBody(config.data);
    let localUser: any = {
      user_id: "usrjncj44t4hb4",
      email: "admin@srevox.local",
      full_name: "Admin User",
      role: "admin",
      org_id: "orgjncj44t4hb4",
      org: {
        org_id: "orgjncj44t4hb4",
        name: "My Organization",
        slug: "my-org"
      }
    };
    if (typeof window !== "undefined") {
      const u = localStorage.getItem("lz_user");
      if (u) {
        try { localUser = JSON.parse(u); } catch {}
      }
      const updated = { ...localUser, ...body };
      localStorage.setItem("lz_user", JSON.stringify(updated));
      return makeAxiosResponse(updated, 200, config);
    }
    const updatedStatic = { ...localUser, ...body };
    return makeAxiosResponse(updatedStatic, 200, config);
  }

  if (path === "/api/auth/organizations" && method === "get") {
    return makeAxiosResponse({
      organizations: [
        {
          org_id: "orgjncj44t4hb4",
          name: "My Organization",
          slug: "my-org"
        }
      ]
    }, 200, config);
  }

  if (path === "/api/auth/switch-organization" && method === "post") {
    return makeAxiosResponse({ success: true }, 200, config);
  }

  if (path === "/api/auth/create-organization" && method === "post") {
    const body = parseRequestBody(config.data);
    return makeAxiosResponse({
      org_id: "org-new-" + Date.now(),
      name: body.name || "New Organization",
      slug: "new-organization"
    }, 201, config);
  }

  if (path === "/api/auth/login" && method === "post") {
    return makeAxiosResponse({
      access_token: "mock-token-session",
      token_type: "bearer",
      user: {
        user_id: "usrjncj44t4hb4",
        email: "admin@srevox.local",
        full_name: "Admin User",
        role: "admin",
        org_id: "orgjncj44t4hb4",
        org: {
          org_id: "orgjncj44t4hb4",
          name: "My Organization",
          slug: "my-org"
        }
      }
    }, 200, config);
  }

  if (path === "/api/auth/signup" && method === "post") {
    return makeAxiosResponse({ detail: "Registration is disabled on self-hosted instances." }, 403, config);
  }

  if (path === "/api/auth/logout" && method === "post") {
    return makeAxiosResponse({ message: "Logged out" }, 200, config);
  }

  if (path === "/api/users" && method === "get") {
    const users = getMockData("sv_mock_users", defaultMockUsers);
    const groups = getMockData("sv_mock_groups", defaultMockGroups);
    const memberships = getMockData("sv_mock_group_members", defaultMockGroupMembers);

    const userList = users.map((u: any) => {
      const userGroups = memberships.filter((m: any) => m.user_id === u.user_id)
        .map((m: any) => groups.find((g: any) => g.group_id === m.group_id))
        .filter(Boolean);
      
      const effectivePerms = mergePermissions(u.permissions || {}, userGroups.map((g: any) => g.permissions));
      return {
        ...u,
        groups: userGroups.map((g: any) => ({ group_id: g.group_id, name: g.name })),
        effective_permissions: effectivePerms
      };
    });

    return makeAxiosResponse({ users: userList }, 200, config);
  }

  if (path === "/api/users/bulk-create" && method === "post") {
    const body = parseRequestBody(config.data);
    const users = getMockData("sv_mock_users", defaultMockUsers);
    const results: any[] = [];
    
    (body.users || []).forEach((u: any) => {
      const email = u.email?.trim();
      const full_name = u.full_name?.trim() || "";
      if (!email) return;

      const existing = users.find((x: any) => x.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        results.push({ email, status: "skipped", detail: "User already in organization" });
      } else {
        const newUser = {
          user_id: "usr" + Math.random().toString(36).substr(2, 9),
          email,
          full_name,
          role: body.default_role || "member",
          permissions: {},
          is_active: true,
          created_at: new Date().toISOString()
        };
        users.push(newUser);
        results.push({ email, status: "created" });
      }
    });

    localStorage.setItem("sv_mock_users", JSON.stringify(users));
    return makeAxiosResponse({ results }, 200, config);
  }

  if (path.startsWith("/api/users/") && path.endsWith("/permissions") && method === "patch") {
    const id = path.split("/")[3];
    const body = parseRequestBody(config.data);
    const users = getMockData("sv_mock_users", defaultMockUsers);
    const userIndex = users.findIndex((u: any) => u.user_id === id);
    if (userIndex === -1) {
      return makeAxiosResponse({ detail: "User not found" }, 404, config);
    }
    users[userIndex].permissions = body.permissions || {};
    localStorage.setItem("sv_mock_users", JSON.stringify(users));

    // Update logged in user in localStorage if editing oneself
    const loggedInUser = JSON.parse(localStorage.getItem("lz_user") || "{}");
    if (loggedInUser.user_id === id) {
      loggedInUser.permissions = body.permissions || {};
      localStorage.setItem("lz_user", JSON.stringify(loggedInUser));
      window.dispatchEvent(new CustomEvent("sv_user_updated", { detail: loggedInUser }));
    }

    return makeAxiosResponse({ message: "Permissions updated", user: users[userIndex] }, 200, config);
  }

  if (path.startsWith("/api/users/") && path.endsWith("/role") && method === "patch") {
    const id = path.split("/")[3];
    const body = parseRequestBody(config.data);
    const users = getMockData("sv_mock_users", defaultMockUsers);
    const userIndex = users.findIndex((u: any) => u.user_id === id);
    if (userIndex === -1) {
      return makeAxiosResponse({ detail: "User not found" }, 404, config);
    }
    users[userIndex].role = body.role;
    localStorage.setItem("sv_mock_users", JSON.stringify(users));

    // Update logged in user in localStorage if editing oneself
    const loggedInUser = JSON.parse(localStorage.getItem("lz_user") || "{}");
    if (loggedInUser.user_id === id) {
      loggedInUser.role = body.role;
      localStorage.setItem("lz_user", JSON.stringify(loggedInUser));
      window.dispatchEvent(new CustomEvent("sv_user_updated", { detail: loggedInUser }));
    }

    return makeAxiosResponse({ message: "Role updated", user: users[userIndex] }, 200, config);
  }

  // Groups Mock endpoints
  if (path === "/api/groups" && method === "get") {
    const groups = getMockData("sv_mock_groups", defaultMockGroups);
    const memberships = getMockData("sv_mock_group_members", defaultMockGroupMembers);
    const users = getMockData("sv_mock_users", defaultMockUsers);

    const groupsWithMembers = groups.map((g: any) => {
      const groupMembers = memberships.filter((m: any) => m.group_id === g.group_id)
        .map((m: any) => users.find((u: any) => u.user_id === m.user_id))
        .filter(Boolean);
      return {
        ...g,
        member_count: groupMembers.length,
        members: groupMembers.map((u: any) => ({
          user_id: u.user_id,
          email: u.email,
          full_name: u.full_name,
          role: u.role
        }))
      };
    });
    return makeAxiosResponse({ groups: groupsWithMembers }, 200, config);
  }

  if (path.startsWith("/api/groups/") && method === "get") {
    const id = path.split("/").pop();
    const groups = getMockData("sv_mock_groups", defaultMockGroups);
    const group = groups.find((g: any) => g.group_id === id);
    if (!group) return makeAxiosResponse({ detail: "Group not found" }, 404, config);

    const memberships = getMockData("sv_mock_group_members", defaultMockGroupMembers);
    const users = getMockData("sv_mock_users", defaultMockUsers);
    const members = memberships.filter((m: any) => m.group_id === id)
      .map((m: any) => users.find((u: any) => u.user_id === m.user_id))
      .filter(Boolean)
      .map((u: any) => ({
        user_id: u.user_id,
        email: u.email,
        full_name: u.full_name,
        role: u.role
      }));

    return makeAxiosResponse({ group, members }, 200, config);
  }

  if (path === "/api/groups" && method === "post") {
    const body = parseRequestBody(config.data);
    const groups = getMockData("sv_mock_groups", defaultMockGroups);
    const nameTrimmed = (body.name || "").trim();
    if (!nameTrimmed) return makeAxiosResponse({ detail: "Group name is required" }, 400, config);
    const dup = groups.find((g: any) => g.name.toLowerCase() === nameTrimmed.toLowerCase());
    if (dup) return makeAxiosResponse({ detail: "A group with this name already exists" }, 409, config);

    const newGroup = {
      group_id: "grp_" + Math.random().toString(36).substr(2, 9),
      org_id: "orgjncj44t4hb4",
      name: nameTrimmed,
      description: body.description || "",
      permissions: {},
      created_at: new Date().toISOString()
    };
    groups.push(newGroup);
    saveMockData("sv_mock_groups", groups);
    return makeAxiosResponse({ message: "Group created successfully", group: newGroup }, 200, config);
  }

  if (path.startsWith("/api/groups/") && method === "patch") {
    const id = path.split("/").pop();
    const body = parseRequestBody(config.data);
    const groups = getMockData("sv_mock_groups", defaultMockGroups);
    const index = groups.findIndex((g: any) => g.group_id === id);
    if (index === -1) return makeAxiosResponse({ detail: "Group not found" }, 404, config);

    if (body.name !== undefined) {
      const nameTrimmed = body.name.trim();
      if (!nameTrimmed) return makeAxiosResponse({ detail: "Group name cannot be empty" }, 400, config);
      const dup = groups.find((g: any) => g.group_id !== id && g.name.toLowerCase() === nameTrimmed.toLowerCase());
      if (dup) return makeAxiosResponse({ detail: "A group with this name already exists" }, 409, config);
    }

    const updated = {
      ...groups[index],
      name: body.name !== undefined ? body.name.trim() : groups[index].name,
      description: body.description !== undefined ? body.description.trim() : groups[index].description,
      permissions: body.permissions !== undefined ? body.permissions : groups[index].permissions,
    };
    groups[index] = updated;
    saveMockData("sv_mock_groups", groups);
    return makeAxiosResponse({ message: "Group updated successfully", group: updated }, 200, config);
  }

  if (path.startsWith("/api/groups/") && method === "delete") {
    const id = path.split("/").pop();
    const groups = getMockData("sv_mock_groups", defaultMockGroups);
    const filtered = groups.filter((g: any) => g.group_id !== id);
    saveMockData("sv_mock_groups", filtered);

    const memberships = getMockData("sv_mock_group_members", defaultMockGroupMembers);
    const filteredMemberships = memberships.filter((m: any) => m.group_id !== id);
    saveMockData("sv_mock_group_members", filteredMemberships);

    return makeAxiosResponse({ message: "Group deleted successfully" }, 200, config);
  }

  if (path.startsWith("/api/groups/") && path.includes("/members") && method === "post") {
    const parts = path.split("/");
    const id = parts[parts.indexOf("groups") + 1];
    const body = parseRequestBody(config.data);
    const user_ids = body.user_ids || [];

    const memberships = getMockData("sv_mock_group_members", defaultMockGroupMembers);
    const filtered = memberships.filter((m: any) => m.group_id !== id);

    user_ids.forEach((uid: string) => {
      filtered.push({ group_id: id, user_id: uid });
    });

    saveMockData("sv_mock_group_members", filtered);
    return makeAxiosResponse({ message: "Group memberships updated successfully", member_count: user_ids.length }, 200, config);
  }

  if (path.startsWith("/api/groups/") && path.includes("/members/") && method === "delete") {
    const parts = path.split("/");
    const id = parts[parts.indexOf("groups") + 1];
    const userId = parts[parts.indexOf("members") + 1];

    const memberships = getMockData("sv_mock_group_members", defaultMockGroupMembers);
    const filtered = memberships.filter((m: any) => !(m.group_id === id && m.user_id === userId));
    saveMockData("sv_mock_group_members", filtered);

    return makeAxiosResponse({ message: "Member removed from group successfully" }, 200, config);
  }

  // Service Owners Mock endpoints
  if (path === "/api/service-owners" && method === "get") {
    const owners = getMockData("sv_mock_service_owners", defaultMockServiceOwners);
    const users = getMockData("sv_mock_users", defaultMockUsers);
    const userMap = new Map(users.map((u: any) => [u.user_id, u]));
    const groups = getMockData("sv_mock_groups", []);
    const groupMap = new Map(groups.map((g: any) => [g.group_id, g]));

    const mapped = owners.map((o: any) => {
      const userIds = o.user_ids || (o.user_id ? [o.user_id] : []);
      const assignedUsers = userIds.map((uid: string) => userMap.get(uid)).filter(Boolean);
      const groupIds = o.group_ids || [];
      const assignedGroups = groupIds.map((gid: string) => groupMap.get(gid)).filter(Boolean);
      return {
        ...o,
        user_ids: userIds,
        owners: assignedUsers,
        owner_name: assignedUsers[0]?.full_name || "",
        owner_email: assignedUsers[0]?.email || "",
        group_ids: groupIds,
        groups: assignedGroups,
      };
    });
    return makeAxiosResponse({ service_owners: mapped }, 200, config);
  }

  if (path.startsWith("/api/service-owners/") && method === "get") {
    const id = path.split("/").pop();
    const owners = getMockData("sv_mock_service_owners", defaultMockServiceOwners);
    const owner = owners.find((o: any) => o.service_owner_id === id) as any;
    if (!owner) return makeAxiosResponse({ detail: "Not found" }, 404, config);

    const userIds = owner.user_ids || (owner.user_id ? [owner.user_id] : []);
    const users = getMockData("sv_mock_users", defaultMockUsers);
    const ownersList = userIds.map((uid: string) => users.find((u: any) => u.user_id === uid)).filter(Boolean);

    const incidents = getMockData("sv_mock_incidents", defaultMockIncidents)
      .filter((i: any) => i.cluster_id === owner.cluster_id && (!owner.namespace || i.namespace === owner.namespace) && (!owner.pod_prefix || (i.pod_name && i.pod_name.startsWith(owner.pod_prefix))))
      .slice(0, 20);

    const rules = getMockData("sv_mock_rules", defaultMockRules)
      .filter((r: any) => !r.cluster_id || r.cluster_id === owner.cluster_id);

    let allActivities = getMockData<any[]>("sv_mock_activities", []);
    let activities = allActivities.filter((a: any) => a.resource_id === id);
    if (activities.length === 0) {
      activities = [
        {
          activity_log_id: "act_1",
          org_id: owner.org_id || "orgjncj44t4hb4",
          user_id: "usrjncj44t4hb4",
          user_name: "Admin User",
          user_email: "admin@srevox.local",
          action: "owner_assigned",
          resource: "service",
          resource_id: id,
          metadata: { owner_name: "Priya Sharma" },
          created_at: new Date(Date.now() - 30 * 1000).toISOString()
        },
        {
          activity_log_id: "act_2",
          org_id: owner.org_id || "orgjncj44t4hb4",
          user_id: "usrjncj44t4hb4",
          user_name: "Admin User",
          user_email: "admin@srevox.local",
          action: "service_created",
          resource: "service",
          resource_id: id,
          metadata: { pod_prefix: owner.pod_prefix, namespace: owner.namespace },
          created_at: new Date(Date.now() - 9 * 60 * 1000).toISOString()
        },
        {
          activity_log_id: "act_3",
          org_id: owner.org_id || "orgjncj44t4hb4",
          user_id: null,
          user_name: "System",
          user_email: "",
          action: "alert_sent",
          resource: "service",
          resource_id: id,
          metadata: { severity: "CRITICAL", recipient: "priya@company.com" },
          created_at: new Date(Date.now() - 5 * 1000).toISOString()
        }
      ];
      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      allActivities.push(...activities);
      saveMockData("sv_mock_activities", allActivities);
    }

    const groupIds = owner.group_ids || [];
    const groups = getMockData("sv_mock_groups", []);
    const groupsList = groupIds.map((gid: string) => groups.find((g: any) => g.group_id === gid)).filter(Boolean);

    return makeAxiosResponse({
      ...owner,
      user_ids: userIds,
      owners: ownersList,
      group_ids: groupIds,
      groups: groupsList,
      channel_ids: owner.channel_ids || [],
      alert_source_channel_id: owner.alert_source_channel_id || null,
      alert_recipients: owner.alert_recipients || [],
      alert_cc: owner.alert_cc || "",
      alert_bcc: owner.alert_bcc || "",
      alert_mail_template_id: owner.alert_mail_template_id || "",
      alert_crash_reasons: owner.alert_crash_reasons || [],
      incidents,
      rules,
      activities
    }, 200, config);
  }

  if (path === "/api/service-owners" && method === "post") {
    const body = parseRequestBody(config.data);
    const owners = getMockData("sv_mock_service_owners", defaultMockServiceOwners);
    const newOwner: any = {
      service_owner_id: "srv" + Math.random().toString(36).substr(2, 11),
      cluster_id: body.cluster_id,
      cluster_name: "Mock Cluster",
      namespace: body.namespace || null,
      pod_prefix: body.pod_prefix || null,
      user_id: body.user_id || null,
      user_ids: body.user_ids || [],
      group_ids: body.group_ids || [],
      owner_name: null,
      owner_email: null,
      channel_ids: body.channel_ids || [],
      created_at: new Date().toISOString()
    };
    if (typeof window !== "undefined") {
      try {
        const clusters = JSON.parse(localStorage.getItem("sv_mock_clusters") || "[]");
        const foundC = clusters.find((c: any) => c.cluster_id === body.cluster_id);
        if (foundC) newOwner.cluster_name = foundC.name;

        if (body.user_id) {
          const users = JSON.parse(localStorage.getItem("sv_mock_users") || "[]");
          const foundU = users.find((u: any) => u.user_id === body.user_id);
          if (foundU) {
            newOwner.owner_name = foundU.full_name;
            newOwner.owner_email = foundU.email;
          }
        }
      } catch {}
    }
    owners.push(newOwner);
    saveMockData("sv_mock_service_owners", owners);
    return makeAxiosResponse(newOwner, 201, config);
  }

  if (path === "/api/service-owners/bulk-create" && method === "post") {
    const body = parseRequestBody(config.data);
    const owners = getMockData("sv_mock_service_owners", defaultMockServiceOwners);
    const results: any[] = [];
    const clusterId = body.cluster_id;
    let clusterName = "Mock Cluster";

    if (typeof window !== "undefined") {
      try {
        const clusters = JSON.parse(localStorage.getItem("sv_mock_clusters") || "[]");
        const foundC = clusters.find((c: any) => c.cluster_id === clusterId);
        if (foundC) clusterName = foundC.name;
      } catch {}
    }

    (body.services || []).forEach((item: any) => {
      const serviceName = item.service_name?.trim();
      const namespace = item.namespace?.trim() || null;

      if (!serviceName) {
        results.push({ service_name: "", namespace: namespace || "", status: "error", detail: "Service name is required" });
        return;
      }

      const existing = owners.find((o: any) => 
        o.cluster_id === clusterId &&
        (o.namespace === namespace || (!o.namespace && !namespace)) &&
        (o.pod_prefix === serviceName || (!o.pod_prefix && !serviceName))
      );

      if (existing) {
        results.push({ service_name: serviceName, namespace: namespace || "", status: "skipped", detail: "Service already exists" });
      } else {
        const newOwner: any = {
          service_owner_id: "srv" + Math.random().toString(36).substr(2, 11),
          cluster_id: clusterId,
          cluster_name: clusterName,
          namespace: namespace,
          pod_prefix: serviceName,
          user_id: null,
          user_ids: [],
          group_ids: [],
          owner_name: null,
          owner_email: null,
          channel_ids: [],
          created_at: new Date().toISOString()
        };
        owners.push(newOwner);
        results.push({ service_name: serviceName, namespace: namespace || "", status: "created" });
      }
    });

    saveMockData("sv_mock_service_owners", owners);
    return makeAxiosResponse({ results }, 200, config);
  }

  if (path.startsWith("/api/service-owners/") && method === "patch") {
    const id = path.split("/").pop();
    const body = parseRequestBody(config.data);
    const owners = getMockData("sv_mock_service_owners", defaultMockServiceOwners);
    const idx = owners.findIndex((o: any) => o.service_owner_id === id);
    if (idx === -1) return makeAxiosResponse({ detail: "Not found" }, 404, config);
    
    const existing = owners[idx] as any;
    const updated = { ...existing, ...body };
    if (body.user_ids !== undefined) {
      updated.user_ids = body.user_ids;
      updated.user_id = body.user_ids[0] || null;
    }
    if (body.group_ids !== undefined) {
      updated.group_ids = body.group_ids;
    }
    if (typeof window !== "undefined") {
      try {
        if (body.cluster_id) {
          const clusters = JSON.parse(localStorage.getItem("sv_mock_clusters") || "[]");
          const foundC = clusters.find((c: any) => c.cluster_id === body.cluster_id);
          if (foundC) updated.cluster_name = foundC.name;
        }
        if (updated.user_id) {
          const users = JSON.parse(localStorage.getItem("sv_mock_users") || "[]");
          const foundU = users.find((u: any) => u.user_id === updated.user_id);
          if (foundU) {
            updated.owner_name = foundU.full_name;
            updated.owner_email = foundU.email;
          }
        } else {
          updated.owner_name = null;
          updated.owner_email = null;
        }
      } catch {}
    }
    const prevUserIds = existing.user_ids || (existing.user_id ? [existing.user_id] : []);
    owners[idx] = updated;
    saveMockData("sv_mock_service_owners", owners);

    const allActivities = getMockData<any[]>("sv_mock_activities", []);

    let activeUserId = "usrjncj44t4hb4";
    let activeUserName = "Admin User";
    let activeUserEmail = "admin@srevox.local";
    if (typeof window !== "undefined") {
      try {
        const loggedInUser = JSON.parse(localStorage.getItem("lz_user") || "{}");
        if (loggedInUser.user_id) {
          activeUserId = loggedInUser.user_id;
          activeUserName = loggedInUser.full_name || loggedInUser.email || "Admin User";
          activeUserEmail = loggedInUser.email || "admin@srevox.local";
        }
      } catch {}
    }

    if (body.user_ids !== undefined) {
      const addedIds = body.user_ids.filter((uid: string) => !prevUserIds.includes(uid));
      const removedIds = prevUserIds.filter((uid: string) => !body.user_ids.includes(uid));
      const users = getMockData("sv_mock_users", defaultMockUsers);

      addedIds.forEach((uid: string) => {
        const u = users.find((x: any) => x.user_id === uid);
        const name = u ? (u.full_name?.trim() || u.email || "User") : "User";
        allActivities.unshift({
          activity_log_id: "act_" + Math.random().toString(36).substr(2, 9),
          org_id: "orgjncj44t4hb4",
          user_id: activeUserId,
          user_name: activeUserName,
          user_email: activeUserEmail,
          action: "owner_assigned",
          resource: "service",
          resource_id: id,
          metadata: { owner_name: name },
          created_at: new Date().toISOString()
        });
      });

      removedIds.forEach((uid: string) => {
        const u = users.find((x: any) => x.user_id === uid);
        const name = u ? (u.full_name?.trim() || u.email || "User") : "User";
        allActivities.unshift({
          activity_log_id: "act_" + Math.random().toString(36).substr(2, 9),
          org_id: "orgjncj44t4hb4",
          user_id: activeUserId,
          user_name: activeUserName,
          user_email: activeUserEmail,
          action: "owner_removed",
          resource: "service",
          resource_id: id,
          metadata: { owner_name: name },
          created_at: new Date().toISOString()
        });
      });
    }

    if (body.group_ids !== undefined) {
      const prevGroupIds = existing.group_ids || [];
      const addedIds = body.group_ids.filter((gid: string) => !prevGroupIds.includes(gid));
      const removedIds = prevGroupIds.filter((gid: string) => !body.group_ids.includes(gid));
      const groups = getMockData<any[]>("sv_mock_groups", []);

      addedIds.forEach((gid: string) => {
        const g = groups.find((x: any) => x.group_id === gid);
        const name = g ? g.name : "Group";
        allActivities.unshift({
          activity_log_id: "act_" + Math.random().toString(36).substr(2, 9),
          org_id: "orgjncj44t4hb4",
          user_id: activeUserId,
          user_name: activeUserName,
          user_email: activeUserEmail,
          action: "owner_assigned",
          resource: "service",
          resource_id: id,
          metadata: { owner_name: `Group: ${name}` },
          created_at: new Date().toISOString()
        });
      });

      removedIds.forEach((gid: string) => {
        const g = groups.find((x: any) => x.group_id === gid);
        const name = g ? g.name : "Group";
        allActivities.unshift({
          activity_log_id: "act_" + Math.random().toString(36).substr(2, 9),
          org_id: "orgjncj44t4hb4",
          user_id: activeUserId,
          user_name: activeUserName,
          user_email: activeUserEmail,
          action: "owner_removed",
          resource: "service",
          resource_id: id,
          metadata: { owner_name: `Group: ${name}` },
          created_at: new Date().toISOString()
        });
      });
    }

    const metadataChanges: Record<string, { old: any; new: any }> = {};

    if (body.alert_source_channel_id !== undefined && body.alert_source_channel_id !== existing.alert_source_channel_id) {
      metadataChanges.alert_source_channel_id = { old: existing.alert_source_channel_id || null, new: body.alert_source_channel_id };
    }
    if (body.alert_cc !== undefined && body.alert_cc !== existing.alert_cc) {
      metadataChanges.alert_cc = { old: existing.alert_cc || null, new: body.alert_cc };
    }
    if (body.alert_bcc !== undefined && body.alert_bcc !== existing.alert_bcc) {
      metadataChanges.alert_bcc = { old: existing.alert_bcc || null, new: body.alert_bcc };
    }
    if (body.alert_mail_template_id !== undefined && body.alert_mail_template_id !== existing.alert_mail_template_id) {
      metadataChanges.alert_mail_template_id = { old: existing.alert_mail_template_id || null, new: body.alert_mail_template_id };
    }
    if (body.alert_recipients !== undefined && JSON.stringify(body.alert_recipients) !== JSON.stringify(existing.alert_recipients || [])) {
      metadataChanges.alert_recipients = { old: existing.alert_recipients || [], new: body.alert_recipients };
    }
    if (body.user_ids !== undefined && JSON.stringify(body.user_ids) !== JSON.stringify(existing.user_ids || [])) {
      metadataChanges.user_ids = { old: existing.user_ids || [], new: body.user_ids };
    }
    if (body.alert_crash_reasons !== undefined && JSON.stringify(body.alert_crash_reasons) !== JSON.stringify(existing.alert_crash_reasons || [])) {
      metadataChanges.alert_crash_reasons = { old: existing.alert_crash_reasons || [], new: body.alert_crash_reasons };
    }

    if (Object.keys(metadataChanges).length > 0) {
      const newAct = {
        activity_log_id: "act_" + Math.random().toString(36).substr(2, 9),
        org_id: "orgjncj44t4hb4",
        user_id: activeUserId,
        user_name: activeUserName,
        user_email: activeUserEmail,
        action: "service_updated",
        resource: "service",
        resource_id: id,
        metadata: { changes: metadataChanges },
        created_at: new Date().toISOString()
      };
      allActivities.unshift(newAct);
    }
    saveMockData("sv_mock_activities", allActivities);

    return makeAxiosResponse({ message: "Updated" }, 200, config);
  }

  if (path.startsWith("/api/service-owners/") && path.endsWith("/send-notification") && method === "post") {
    const segments = path.split("/");
    const id = segments[3];
    const body = parseRequestBody(config.data);

    const allActivities = getMockData<any[]>("sv_mock_activities", []);
    let activeUserId = "usrjncj44t4hb4";
    let activeUserName = "Admin User";
    let activeUserEmail = "admin@srevox.local";
    if (typeof window !== "undefined") {
      try {
        const loggedInUser = JSON.parse(localStorage.getItem("lz_user") || "{}");
        if (loggedInUser.user_id) {
          activeUserId = loggedInUser.user_id;
          activeUserName = loggedInUser.full_name || loggedInUser.email || "Admin User";
          activeUserEmail = loggedInUser.email || "admin@srevox.local";
        }
      } catch {}
    }

    const newAct = {
      activity_log_id: "act_" + Math.random().toString(36).substr(2, 9),
      org_id: "orgjncj44t4hb4",
      user_id: activeUserId,
      user_name: activeUserName,
      user_email: activeUserEmail,
      action: "notification_sent",
      resource: "service",
      resource_id: id,
      metadata: {
        channel_type: body.channel_type,
        user_ids: body.user_ids,
        subject: body.subject
      },
      created_at: new Date().toISOString()
    };
    allActivities.unshift(newAct);
    saveMockData("sv_mock_activities", allActivities);

    return makeAxiosResponse({ success: true, message: "Notification sent successfully" }, 200, config);
  }

  if (path.startsWith("/api/service-owners/") && method === "delete") {
    const id = path.split("/").pop();
    let owners = getMockData("sv_mock_service_owners", defaultMockServiceOwners);
    owners = owners.filter((o: any) => o.service_owner_id !== id);
    saveMockData("sv_mock_service_owners", owners);
    return makeAxiosResponse({ message: "Deleted" }, 200, config);
  }

  // Preferences Mock endpoints
  if (path === "/api/preferences" && method === "get") {
    const prefs = getMockData("sv_mock_preferences", defaultMockPreferences);
    return makeAxiosResponse({ preferences: prefs }, 200, config);
  }

  if (path === "/api/preferences" && method === "put") {
    const body = parseRequestBody(config.data);
    saveMockData("sv_mock_preferences", body);
    return makeAxiosResponse({ success: true, preferences: body }, 200, config);
  }

  // 1. GET /api/clusters
  if (path === "/api/clusters" && method === "get") {
    const clusters = getMockData("sv_mock_clusters", defaultMockClusters);
    return makeAxiosResponse({ clusters }, 200, config);
  }

  // GET /api/incidents/analytics/summary
  if (path === "/api/incidents/analytics/summary" && method === "get") {
    const hourly = {
      crashes: Array.from({ length: 24 }).map((_, i) => ({
        period: new Date(Date.now() - (23 - i) * 3600 * 1000).toISOString(),
        count: Math.floor(Math.sin((i / 24) * Math.PI * 2) * 5 + 6) + Math.floor(Math.random() * 3)
      })),
      alerts: Array.from({ length: 24 }).map((_, i) => ({
        period: new Date(Date.now() - (23 - i) * 3600 * 1000).toISOString(),
        count: Math.floor(Math.sin((i / 24) * Math.PI * 2) * 3 + 4) + Math.floor(Math.random() * 2)
      }))
    };

    const daily = {
      crashes: Array.from({ length: 30 }).map((_, i) => ({
        period: new Date(Date.now() - (29 - i) * 24 * 3600 * 1000).toISOString(),
        count: Math.floor(Math.cos((i / 30) * Math.PI * 4) * 8 + 14) + Math.floor(Math.random() * 4)
      })),
      alerts: Array.from({ length: 30 }).map((_, i) => ({
        period: new Date(Date.now() - (29 - i) * 24 * 3600 * 1000).toISOString(),
        count: Math.floor(Math.cos((i / 30) * Math.PI * 4) * 5 + 9) + Math.floor(Math.random() * 3)
      }))
    };

    const monthly = {
      crashes: Array.from({ length: 12 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        return {
          period: d.toISOString(),
          count: Math.floor(Math.sin((i / 12) * Math.PI) * 150 + 200) + Math.floor(Math.random() * 40)
        };
      }),
      alerts: Array.from({ length: 12 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        return {
          period: d.toISOString(),
          count: Math.floor(Math.sin((i / 12) * Math.PI) * 100 + 130) + Math.floor(Math.random() * 30)
        };
      })
    };

    const top_crashed = [
      { pod_name: "payment-gateway-7f49b9cd4b-6x8pq", namespace: "finance", count: 48 },
      { pod_name: "auth-service-59bc6594b4-m4nqp", namespace: "auth", count: 32 },
      { pod_name: "redis-cache-0", namespace: "database", count: 18 },
      { pod_name: "catalog-api-7db94c9f-jk921", namespace: "catalog", count: 12 },
      { pod_name: "user-profile-db-0", namespace: "auth", count: 5 }
    ];

    const top_alerting = [
      { pod_name: "payment-gateway-7f49b9cd4b-6x8pq", namespace: "finance", count: 35 },
      { pod_name: "auth-service-59bc6594b4-m4nqp", namespace: "auth", count: 20 },
      { pod_name: "redis-cache-0", namespace: "database", count: 10 },
      { pod_name: "catalog-api-7db94c9f-jk921", namespace: "catalog", count: 8 }
    ];

    // analytics_view_roles lookup removed

    let custom = null;
    const startStr = params.start_date;
    const endStr = params.end_date;
    if (startStr && endStr) {
      const startDate = new Date(startStr);
      const endDate = new Date(endStr);
      const diffMs = endDate.getTime() - startDate.getTime();
      const diffDays = diffMs / (1000 * 3600 * 24);
      let interval: "hour" | "day" | "month" = "day";
      let countPoints = 30;
      let msStep = 24 * 3600 * 1000;
      if (diffDays <= 2) {
        interval = "hour";
        countPoints = Math.max(1, Math.round(diffMs / (3600 * 1000)));
        msStep = 3600 * 1000;
      } else if (diffDays > 60) {
        interval = "month";
        countPoints = Math.max(1, Math.round(diffDays / 30));
        msStep = 30 * 24 * 3600 * 1000;
      } else {
        interval = "day";
        countPoints = Math.max(1, Math.round(diffDays));
        msStep = 24 * 3600 * 1000;
      }

      const customCrashes = Array.from({ length: countPoints }).map((_, i) => ({
        period: new Date(startDate.getTime() + i * msStep).toISOString(),
        count: Math.floor(Math.random() * 8) + 2
      }));
      const customAlerts = Array.from({ length: countPoints }).map((_, i) => ({
        period: new Date(startDate.getTime() + i * msStep).toISOString(),
        count: Math.floor(Math.random() * 5) + 1
      }));

      custom = {
        crashes: customCrashes,
        alerts: customAlerts,
        interval
      };
    }

    return makeAxiosResponse({
      hourly,
      daily,
      monthly,
      top_crashed,
      top_alerting,
      custom
    }, 200, config);
  }

  // GET /api/incidents/analytics/top-pods
  if (path === "/api/incidents/analytics/top-pods" && method === "get") {
    const mockPods = [
      { pod_name: "payment-gateway-7f49b9cd4b-6x8pq", namespace: "finance", count: 48 },
      { pod_name: "auth-service-59bc6594b4-m4nqp", namespace: "auth", count: 32 },
      { pod_name: "redis-cache-0", namespace: "database", count: 18 },
      { pod_name: "catalog-api-7db94c9f-jk921", namespace: "catalog", count: 12 },
      { pod_name: "user-profile-db-0", namespace: "auth", count: 5 },
      { pod_name: "frontend-web-9a84b5fc-p4q21", namespace: "default", count: 24 },
      { pod_name: "billing-worker-5c6d7e8f-bc123", namespace: "finance", count: 14 },
      { pod_name: "email-sender-7d8e9f0a-de456", namespace: "communications", count: 9 },
      { pod_name: "notification-broker-3a2b1c0d-ef789", namespace: "communications", count: 7 },
      { pod_name: "search-indexer-8f7e6d5c-ab012", namespace: "search", count: 16 },
      { pod_name: "recommendation-engine-2b3c4d5e-cd345", namespace: "recommendation", count: 11 },
      { pod_name: "logging-daemonset-a1b2c", namespace: "kube-system", count: 3 },
      { pod_name: "metrics-server-f4e3d", namespace: "kube-system", count: 2 },
      { pod_name: "ingress-nginx-controller-7x", namespace: "ingress", count: 15 },
      { pod_name: "config-server-8b", namespace: "config", count: 4 }
    ];

    let filtered = [...mockPods];
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(p => p.pod_name.toLowerCase().includes(q) || p.namespace.toLowerCase().includes(q));
    }

    const sortBy = params.sort_by || "count";
    const sortOrder = params.sort_order || "desc";
    filtered.sort((a: any, b: any) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (typeof valA === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    const limit = Number(params.limit || 10);
    const offset = Number(params.offset || 0);
    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);

    return makeAxiosResponse({ items, total }, 200, config);
  }

  // GET /api/incidents/analytics/top-alerts
  if (path === "/api/incidents/analytics/top-alerts" && method === "get") {
    const mockAlerts = [
      { pod_name: "payment-gateway-7f49b9cd4b-6x8pq", namespace: "finance", count: 35 },
      { pod_name: "auth-service-59bc6594b4-m4nqp", namespace: "auth", count: 20 },
      { pod_name: "redis-cache-0", namespace: "database", count: 10 },
      { pod_name: "catalog-api-7db94c9f-jk921", namespace: "catalog", count: 8 },
      { pod_name: "frontend-web-9a84b5fc-p4q21", namespace: "default", count: 15 },
      { pod_name: "billing-worker-5c6d7e8f-bc123", namespace: "finance", count: 11 },
      { pod_name: "email-sender-7d8e9f0a-de456", namespace: "communications", count: 6 },
      { pod_name: "search-indexer-8f7e6d5c-ab012", namespace: "search", count: 12 },
      { pod_name: "ingress-nginx-controller-7x", namespace: "ingress", count: 9 },
      { pod_name: "recommendation-engine-2b3c4d5e-cd345", namespace: "recommendation", count: 5 }
    ];

    let filtered = [...mockAlerts];
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(p => p.pod_name.toLowerCase().includes(q) || p.namespace.toLowerCase().includes(q));
    }

    const sortBy = params.sort_by || "count";
    const sortOrder = params.sort_order || "desc";
    filtered.sort((a: any, b: any) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (typeof valA === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    const limit = Number(params.limit || 10);
    const offset = Number(params.offset || 0);
    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);

    return makeAxiosResponse({ items, total }, 200, config);
  }

  // 2. GET /api/incidents
  if (path === "/api/incidents" && method === "get") {
    const incidents = getMockData("sv_mock_incidents", defaultMockIncidents);
    let filtered = [...incidents];
    if (params.cluster_id) {
      filtered = filtered.filter(i => i.cluster_id === params.cluster_id);
    }
    if (params.status) {
      filtered = filtered.filter(i => i.status === params.status);
    }
    if (params.severity) {
      filtered = filtered.filter(i => i.severity === params.severity);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(i => 
        i.pod_name.toLowerCase().includes(q) || 
        i.namespace.toLowerCase().includes(q) || 
        i.crash_reason.toLowerCase().includes(q)
      );
    }
    filtered.sort((a, b) => new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime());
    if (params.limit) {
      filtered = filtered.slice(0, parseInt(params.limit));
    }
    return makeAxiosResponse({ incidents: filtered }, 200, config);
  }

  // 3. GET /api/incidents/stats/summary
  if (path === "/api/incidents/stats/summary" && method === "get") {
    const incidents = getMockData("sv_mock_incidents", defaultMockIncidents);
    const open = incidents.filter(i => i.status === "open");
    const stats = {
      open_count: open.length,
      acknowledged_count: incidents.filter(i => i.status === "acknowledged").length,
      resolved_count: incidents.filter(i => i.status === "resolved").length,
      critical_open: open.filter(i => i.severity === "critical").length,
      last_24h: incidents.filter(i => new Date(i.first_seen_at).getTime() > Date.now() - 24 * 3600 * 1000).length,
      last_7d: incidents.filter(i => new Date(i.first_seen_at).getTime() > Date.now() - 7 * 24 * 3600 * 1000).length,
      oom_count: incidents.filter(i => i.crash_reason === "OOMKilled").length,
      crash_loop_count: incidents.filter(i => i.crash_reason === "CrashLoopBackOff").length,
    };
    return makeAxiosResponse(stats, 200, config);
  }

  // 4. GET /api/incidents/:id/logs
  if (path.startsWith("/api/incidents/") && path.endsWith("/logs") && method === "get") {
    const parts = path.split("/");
    const id = parts[parts.length - 2];
    const logsObj = {
      "mock-inc-1": `2026-06-18T14:00:01.124Z [info] payment-gateway initialization complete. Listening on port 8080.
2026-06-18T14:01:05.512Z [info] POST /v1/transactions - received transaction requests. Batch size: 1000
2026-06-18T14:02:10.992Z [debug] Processing card transaction auth payloads... Heap memory allocated: 256MB
2026-06-18T14:03:15.302Z [debug] Allocating temporary routing channels. Heap memory: 412MB
2026-06-18T14:04:20.100Z [warning] High memory pressure detected in Node.js runtime. GC overhead limit exceeded.
2026-06-18T14:04:35.001Z [error] JavaScript heap out of memory.
2026-06-18T14:04:35.002Z Fatal error in ../../src/heap/heap.cc, line 105
2026-06-18T14:04:35.002Z API boundary violated: allocation failed - JavaScript heap out of memory
Killed`,
      "mock-inc-2": `2026-06-18T13:45:00.052Z [info] Starting auth-service microservice...
2026-06-18T13:45:01.102Z [info] Database host set to 'postgres-db.database.svc.cluster.local:5432'
2026-06-18T13:45:02.105Z [info] Connecting to database...
2026-06-18T13:45:12.110Z [error] Connection timeout after 10000ms.
2026-06-18T13:45:12.111Z [fatal] Failed to initialize database connection pool. Error: connect ETIMEDOUT 10.96.244.15:5432
2026-06-18T13:45:12.112Z [info] Exiting with status code 1.`,
      "mock-inc-3": `2026-06-18T12:10:00.001Z [info] Redis version=7.0.5, bits=64, commit=00000000, modified=0, pid=1, just started
2026-06-18T12:10:00.002Z [warning] Warning: no config file specified, using the default config.
2026-06-18T12:12:35.105Z [error] SIGSEGV received. Invalid memory address dereference.
2026-06-18T12:12:35.106Z Stack trace: redis-server(logStackTrace+0x2a), redis-server(sigsegvHandler+0x3d), /lib/x86_64-linux-gnu/libpthread.so.0(+0x12730)`,
      "mock-inc-4": `2026-06-18T09:00:00.000Z [info] nginx version: nginx/1.25.1
2026-06-18T09:00:00.001Z [info] start worker process 2
2026-06-18T13:00:00.002Z [info] received SIGQUIT, shutting down gracefully...
2026-06-18T13:00:05.100Z [info] worker process 2 exited with status 0
2026-06-18T13:00:05.101Z [info] nginx main process exited.`
    };
    const logs = logsObj[id as keyof typeof logsObj] || "No logs available for this pod.";
    return makeAxiosResponse({ logs }, 200, config);
  }

  // 5. GET /api/incidents/:id
  if (path.startsWith("/api/incidents/") && method === "get") {
    const id = path.split("/").pop();
    const incidents = getMockData("sv_mock_incidents", defaultMockIncidents);
    const inc = incidents.find(i => i.incident_id === id);
    if (inc) {
      return makeAxiosResponse(inc, 200, config);
    }
    return makeAxiosResponse({ detail: "Incident not found" }, 404, config);
  }

  // 6. PATCH /api/incidents/:id/acknowledge
  if (path.startsWith("/api/incidents/") && path.endsWith("/acknowledge") && method === "patch") {
    const parts = path.split("/");
    const id = parts[parts.length - 2];
    const incidents = getMockData("sv_mock_incidents", defaultMockIncidents);
    const updated = incidents.map(i => i.incident_id === id ? { ...i, status: "acknowledged" as const, acknowledged_by_name: "Demo Admin" } : i);
    saveMockData("sv_mock_incidents", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 7. PATCH /api/incidents/:id/resolve
  if (path.startsWith("/api/incidents/") && path.endsWith("/resolve") && method === "patch") {
    const parts = path.split("/");
    const id = parts[parts.length - 2];
    const incidents = getMockData("sv_mock_incidents", defaultMockIncidents);
    const updated = incidents.map(i => i.incident_id === id ? { ...i, status: "resolved" as const, resolved_by_name: "Demo Admin", resolved_at: new Date().toISOString() } : i);
    saveMockData("sv_mock_incidents", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 8. POST /api/incidents/:id/diagnose
  if (path.startsWith("/api/incidents/") && path.endsWith("/diagnose") && method === "post") {
    const parts = path.split("/");
    const id = parts[parts.length - 2];
    await new Promise(resolve => setTimeout(resolve, 800)); // Aesthetic thinking delay
    const incidents = getMockData("sv_mock_incidents", defaultMockIncidents);
    const incident = incidents.find(i => i.incident_id === id);
    
    let diagObj = {
      root_cause: "Automatic diagnostics generated mock root cause analysis.",
      severity_assessment: "MEDIUM",
      fix_steps: ["Step 1", "Step 2"],
      kubectl_commands: ["kubectl get pods"],
      prevention: "Adjust deployment configurations.",
      estimated_fix_time: "5 minutes"
    };
    
    if (id === "mock-inc-3") {
      diagObj = {
        root_cause: "SIGSEGV segmentation fault. The redis pod crashed due to an invalid memory reference. This is likely due to memory corruption in redis or an incompatible plugin module.",
        severity_assessment: "WARNING. Pod will restart but may continue to crash if specific keys are accessed.",
        fix_steps: [
          "Upgrade Redis to the latest stable version (e.g. 7.2.4).",
          "Disable any custom redis module configs in redis.conf.",
          "Verify host kernel logs for any memory allocation bugs."
        ],
        kubectl_commands: [
          "kubectl describe pod redis-cache-0 -n database",
          "kubectl logs redis-cache-0 -n database"
        ],
        prevention: "Set up memory resource limits and ensure standard official redis images are used.",
        estimated_fix_time: "20 minutes"
      };
    } else if (incident) {
      const reason = (incident.crash_reason || "").toLowerCase();
      const pod = incident.pod_name || "pod";
      const ns = incident.namespace || "default";

      if (reason.includes("image") || reason.includes("pull")) {
        diagObj = {
          root_cause: "The container image could not be pulled from the registry. This usually indicates a typo in the image name/tag, network issues, or a missing imagePullSecrets secret in the namespace.",
          severity_assessment: "CRITICAL. The pod cannot start without the container image, leading to a complete service outage for this replica.",
          fix_steps: [
            `Verify the container image name and tag in the deployment spec: kubectl get pod ${pod} -n ${ns} -o jsonpath='{.spec.containers[*].image}'`,
            `Verify if the image repository requires authentication. If so, check that imagePullSecrets is defined: kubectl get pod ${pod} -n ${ns} -o jsonpath='{.spec.imagePullSecrets}'`,
            `Check the events section of the pod description for the exact image pull error: kubectl describe pod ${pod} -n ${ns}`,
            "If using a private registry, verify that the pull credentials in the secret are valid."
          ],
          kubectl_commands: [
            `kubectl describe pod ${pod} -n ${ns}`,
            `kubectl get secrets -n ${ns}`
          ],
          prevention: "Ensure the image name and tag are correct in your CI/CD pipeline before deploying, and verify registry credentials.",
          estimated_fix_time: "5-10 minutes"
        };
      } else if (reason.includes("oom") || reason.includes("137")) {
        diagObj = {
          root_cause: "The container exceeded its memory limit and was terminated by the system out-of-memory (OOM) killer.",
          severity_assessment: "HIGH. The pod was killed because it tried to consume more memory than allocated, which could point to a memory leak or undersized resource limits.",
          fix_steps: [
            `Check the memory limits currently allocated to the container: kubectl get pod ${pod} -n ${ns} -o jsonpath='{.spec.containers[*].resources.limits.memory}'`,
            `Inspect the memory utilization trend in the dashboard or run: kubectl top pod ${pod} -n ${ns}`,
            "Review the application codebase for memory leaks, unclosed resources, or excessive cache sizes.",
            "Increase the container's memory limit in the deployment spec resources block."
          ],
          kubectl_commands: [
            `kubectl describe pod ${pod} -n ${ns}`,
            `kubectl logs ${pod} -n ${ns} --previous`
          ],
          prevention: "Define realistic memory requests and limits based on load testing, and profile memory usage periodically.",
          estimated_fix_time: "10-15 minutes"
        };
      } else if (reason.includes("crash") || reason.includes("loop") || reason.includes("exit")) {
        diagObj = {
          root_cause: "The application started but exited with an error code, causing Kubernetes to restart it in a loop. This is usually due to misconfiguration, missing dependencies, database connection errors, or runtime exceptions.",
          severity_assessment: "HIGH. The container is crashing repeatedly during startup, preventing the service from serving traffic.",
          fix_steps: [
            `Inspect the log output of the previously crashed container: kubectl logs ${pod} -n ${ns} --previous`,
            "Verify that all required environment variables, configmaps, and secrets are correctly populated and mounted.",
            "Verify network connectivity to external services like databases, message brokers, and downstream microservices.",
            "Check for application initialization exceptions, missing files, or incorrect file permissions."
          ],
          kubectl_commands: [
            `kubectl logs ${pod} -n ${ns} --previous`,
            `kubectl describe pod ${pod} -n ${ns}`
          ],
          prevention: "Ensure environment configurations are validated at startup, and implement robust error checking during application initialization.",
          estimated_fix_time: "15-20 minutes"
        };
      } else {
        diagObj = {
          root_cause: `The pod crashed due to ${incident.crash_reason || "unknown reason"}. Details are unavailable without log context.`,
          severity_assessment: "MEDIUM. Pod has crashed. Further investigation using pod logs and description events is required.",
          fix_steps: [
            `Inspect the pod describe events for any warning or failure indicators: kubectl describe pod ${pod} -n ${ns}`,
            `Fetch the logs from the previous container run to see the exit details: kubectl logs ${pod} -n ${ns} --previous`,
            "Verify resource limits (CPU/Memory) and probe (Liveness/Readiness) settings in the deployment spec."
          ],
          kubectl_commands: [
            `kubectl describe pod ${pod} -n ${ns}`,
            `kubectl logs ${pod} -n ${ns} --previous`
          ],
          prevention: "Enable structured logging and verify container readiness/liveness configuration.",
          estimated_fix_time: "10 minutes"
        };
      }
    }

    const updated = incidents.map(i => i.incident_id === id ? { 
      ...i, 
      ai_diagnosed_at: new Date().toISOString(),
      ai_diagnosis: diagObj
    } : i);
    saveMockData("sv_mock_incidents", updated);
    
    const found = updated.find(i => i.incident_id === id);
    return makeAxiosResponse(found || { success: true }, 200, config);
  }

  // 9. DELETE /api/incidents/:id
  if (path.startsWith("/api/incidents/") && method === "delete") {
    const id = path.split("/").pop();
    const incidents = getMockData("sv_mock_incidents", defaultMockIncidents);
    const updated = incidents.filter(i => i.incident_id !== id);
    saveMockData("sv_mock_incidents", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 10. POST /api/incidents/bulk-acknowledge
  if (path === "/api/incidents/bulk-acknowledge" && method === "post") {
    const { ids } = parseRequestBody(config.data);
    const incidents = getMockData("sv_mock_incidents", defaultMockIncidents);
    const updated = incidents.map(i => ids.includes(i.incident_id) ? { ...i, status: "acknowledged" as const, acknowledged_by_name: "Demo Admin" } : i);
    saveMockData("sv_mock_incidents", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 11. POST /api/incidents/bulk-resolve
  if (path === "/api/incidents/bulk-resolve" && method === "post") {
    const { ids } = parseRequestBody(config.data);
    const incidents = getMockData("sv_mock_incidents", defaultMockIncidents);
    const updated = incidents.map(i => ids.includes(i.incident_id) ? { ...i, status: "resolved" as const, resolved_by_name: "Demo Admin", resolved_at: new Date().toISOString() } : i);
    saveMockData("sv_mock_incidents", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 12. POST /api/incidents/bulk-delete
  if (path === "/api/incidents/bulk-delete" && method === "post") {
    const { ids } = parseRequestBody(config.data);
    const incidents = getMockData("sv_mock_incidents", defaultMockIncidents);
    const updated = incidents.filter(i => !ids.includes(i.incident_id));
    saveMockData("sv_mock_incidents", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 13. GET /api/infrastructure/:clusterId/nodes
  if (path.startsWith("/api/infrastructure/") && path.endsWith("/nodes") && method === "get") {
    const parts = path.split("/");
    const clusterId = parts[parts.length - 2];
    const nodes = getMockNodes(clusterId);
    return makeAxiosResponse({ nodes }, 200, config);
  }

  // 14. GET /api/infrastructure/:clusterId/pods
  if (path.startsWith("/api/infrastructure/") && path.endsWith("/pods") && method === "get") {
    const parts = path.split("/");
    const clusterId = parts[parts.length - 2];
    const pods = getMockPods(clusterId);
    return makeAxiosResponse({ pods }, 200, config);
  }

  // 15. GET /api/resource-alerts
  if (path === "/api/resource-alerts" && method === "get") {
    const alerts = getMockData("sv_mock_resource_alerts", defaultMockResourceAlerts);
    let filtered = [...alerts];
    if (params.cluster_id) {
      filtered = filtered.filter(a => a.cluster_id === params.cluster_id);
    }
    return makeAxiosResponse({ alerts: filtered }, 200, config);
  }

  // 16. POST /api/resource-alerts
  if (path === "/api/resource-alerts" && method === "post") {
    const body = parseRequestBody(config.data);
    const alerts = getMockData("sv_mock_resource_alerts", defaultMockResourceAlerts);
    const newAlert = {
      resource_alert_id: "mock-res-alert-" + Date.now(),
      cluster_id: body.cluster_id || "mock-prod-cluster",
      resource_type: body.resource_type || "cpu",
      threshold_pct: body.threshold_pct || 80,
      target: body.target || "node",
      target_name: body.target_name || undefined,
      severity: body.severity || "warning",
      channel_ids: body.channel_ids || [],
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    alerts.push(newAlert);
    saveMockData("sv_mock_resource_alerts", alerts);
    return makeAxiosResponse(newAlert, 201, config);
  }

  // 16.5. PUT /api/resource-alerts/:id
  if (path.startsWith("/api/resource-alerts/") && method === "put") {
    const id = path.split("/").pop();
    const body = parseRequestBody(config.data);
    const alerts = getMockData("sv_mock_resource_alerts", defaultMockResourceAlerts);
    const idx = alerts.findIndex(a => a.resource_alert_id === id);
    if (idx !== -1) {
      alerts[idx] = {
        ...alerts[idx],
        ...body,
        updated_at: new Date().toISOString()
      };
      saveMockData("sv_mock_resource_alerts", alerts);
      return makeAxiosResponse(alerts[idx], 200, config);
    }
    return makeAxiosResponse({ message: "Not found" }, 404, config);
  }

  // 17. DELETE /api/resource-alerts/:id
  if (path.startsWith("/api/resource-alerts/") && method === "delete") {
    const id = path.split("/").pop();
    const alerts = getMockData("sv_mock_resource_alerts", defaultMockResourceAlerts);
    const updated = alerts.filter(a => a.resource_alert_id !== id);
    saveMockData("sv_mock_resource_alerts", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 18. GET /api/channels
  if (path === "/api/channels" && method === "get") {
    const channels = getMockData("sv_mock_channels", defaultMockChannels);
    return makeAxiosResponse({ channels }, 200, config);
  }

  // 18.5 GET /api/channels/:id
  if (path.startsWith("/api/channels/") && method === "get" && !path.endsWith("/toggle") && !path.endsWith("/test")) {
    const id = path.split("/").pop();
    const channels = getMockData("sv_mock_channels", defaultMockChannels);
    const found = channels.find(c => c.channel_id === id);
    if (!found) return makeAxiosResponse({ detail: "Not found" }, 404, config);
    return makeAxiosResponse(found, 200, config);
  }

  // 19. POST /api/channels
  if (path === "/api/channels" && method === "post") {
    const body = parseRequestBody(config.data);
    const channels = getMockData("sv_mock_channels", defaultMockChannels);
    const newChan = {
      channel_id: "mock-chan-" + Date.now(),
      name: body.name || "Mock Channel",
      type: body.type || "slack",
      enabled: true,
      created_at: new Date().toISOString(),
      config: body.config || {}
    };
    channels.push(newChan);
    saveMockData("sv_mock_channels", channels);
    return makeAxiosResponse(newChan, 201, config);
  }

  // 20. PATCH /api/channels/:id/toggle
  if (path.startsWith("/api/channels/") && path.endsWith("/toggle") && method === "patch") {
    const parts = path.split("/");
    const id = parts[parts.length - 2];
    const channels = getMockData("sv_mock_channels", defaultMockChannels);
    const updated = channels.map(c => c.channel_id === id ? { ...c, enabled: !c.enabled } : c);
    saveMockData("sv_mock_channels", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 21. POST /api/channels/:id/test
  if (path.startsWith("/api/channels/") && path.endsWith("/test") && method === "post") {
    await new Promise(resolve => setTimeout(resolve, 600)); // Testing network lag
    return makeAxiosResponse({ success: true, message: "Channel integration test passed successfully!" }, 200, config);
  }

  // 22. PATCH /api/channels/:id
  if (path.startsWith("/api/channels/") && method === "patch") {
    const id = path.split("/").pop();
    const body = parseRequestBody(config.data);
    const channels = getMockData("sv_mock_channels", defaultMockChannels);
    const updated = channels.map(c => c.channel_id === id ? { ...c, ...body } : c);
    saveMockData("sv_mock_channels", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 23. DELETE /api/channels/:id
  if (path.startsWith("/api/channels/") && method === "delete") {
    const id = path.split("/").pop();
    const channels = getMockData("sv_mock_channels", defaultMockChannels);
    const updated = channels.filter(c => c.channel_id !== id);
    saveMockData("sv_mock_channels", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 24. GET /api/alert-rules
  if (path === "/api/alert-rules" && method === "get") {
    const rules = getMockData("sv_mock_rules", defaultMockRules);
    return makeAxiosResponse({ rules }, 200, config);
  }

  // 24.5 GET /api/alert-rules/:id
  if (path.startsWith("/api/alert-rules/") && !path.endsWith("/toggle") && !path.endsWith("/mute") && !path.endsWith("/unmute") && method === "get") {
    const id = path.split("/").pop();
    const rules = getMockData("sv_mock_rules", defaultMockRules);
    const rule = rules.find((r: any) => r.rule_id === id);
    if (!rule) return makeAxiosResponse({ detail: "Not found" }, 404, config);
    return makeAxiosResponse(rule, 200, config);
  }

  // 25. POST /api/alert-rules
  if (path === "/api/alert-rules" && method === "post") {
    const body = parseRequestBody(config.data);
    const rules = getMockData("sv_mock_rules", defaultMockRules);
    const newRule = {
      rule_id: "mock-rule-" + Date.now(),
      cluster_id: body.cluster_id || "mock-prod-cluster",
      cluster_name: body.cluster_id === "*" ? "All Clusters" : (body.cluster_id === "mock-prod-cluster" ? "srevox-prod-gke" : body.cluster_id === "mock-staging-cluster" ? "srevox-staging-eks" : "srevox-dev-kind"),
      name: body.name || "Mock Rule",
      description: body.description || "",
      namespaces: body.namespaces || ["*"],
      crash_reasons: body.crash_reasons || ["*"],
      min_restarts: body.min_restarts || 0,
      cooldown_minutes: body.cooldown_minutes || 5,
      severity: body.severity || "warning",
      channel_ids: body.channel_ids || [],
      enabled: true,
      created_at: new Date().toISOString()
    };
    rules.push(newRule);
    saveMockData("sv_mock_rules", rules);
    return makeAxiosResponse(newRule, 201, config);
  }

  // 26. PATCH /api/alert-rules/:id/toggle
  if (path.startsWith("/api/alert-rules/") && path.endsWith("/toggle") && method === "patch") {
    const parts = path.split("/");
    const id = parts[parts.length - 2];
    const rules = getMockData("sv_mock_rules", defaultMockRules);
    const updated = rules.map(r => r.rule_id === id ? { ...r, enabled: !r.enabled } : r);
    saveMockData("sv_mock_rules", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 27. PATCH /api/alert-rules/:id
  if (path.startsWith("/api/alert-rules/") && method === "patch") {
    const id = path.split("/").pop();
    const body = parseRequestBody(config.data);
    const rules = getMockData("sv_mock_rules", defaultMockRules);
    const updated = rules.map(r => r.rule_id === id ? { ...r, ...body } : r);
    saveMockData("sv_mock_rules", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 28. DELETE /api/alert-rules/:id
  if (path.startsWith("/api/alert-rules/") && method === "delete") {
    const id = path.split("/").pop();
    const rules = getMockData("sv_mock_rules", defaultMockRules);
    const updated = rules.filter(r => r.rule_id !== id);
    saveMockData("sv_mock_rules", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 29. GET /api/service-owners/routing-defaults
  if (path === "/api/service-owners/routing-defaults" && method === "get") {
    const defaultRouting = {
      default_alert_source_channel_id: null,
      default_alert_cc: "fallback-cc@srevox.com",
      default_alert_bcc: "fallback-bcc@srevox.com"
    };
    const routing = getMockData("sv_mock_service_routing", defaultRouting);
    return makeAxiosResponse(routing, 200, config);
  }

  // 30. PATCH /api/service-owners/routing-defaults
  if (path === "/api/service-owners/routing-defaults" && method === "patch") {
    const body = parseRequestBody(config.data);
    const current = getMockData("sv_mock_service_routing", {});
    const updated = { ...current, ...body };
    saveMockData("sv_mock_service_routing", updated);
    return makeAxiosResponse(updated, 200, config);
  }

  // 31. GET /api/service-owners/mute-status
  if (path === "/api/service-owners/mute-status" && method === "get") {
    const isMuted = getMockData("sv_mock_service_global_muted", false);
    const ttl = getMockData("sv_mock_service_global_muted_ttl", null);
    return makeAxiosResponse({ global_muted: isMuted, global_ttl: ttl }, 200, config);
  }

  // 32. POST /api/service-owners/mute
  if (path === "/api/service-owners/mute" && method === "post") {
    const body = parseRequestBody(config.data);
    saveMockData("sv_mock_service_global_muted", true);
    saveMockData("sv_mock_service_global_muted_ttl", body.minutes > 0 ? body.minutes * 60 : null);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 33. POST /api/service-owners/unmute
  if (path === "/api/service-owners/unmute" && method === "post") {
    saveMockData("sv_mock_service_global_muted", false);
    saveMockData("sv_mock_service_global_muted_ttl", null);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 34. POST /api/service-owners/:id/mute
  if (path.startsWith("/api/service-owners/") && path.endsWith("/mute") && method === "post") {
    const parts = path.split("/");
    const id = parts[parts.length - 2];
    const body = parseRequestBody(config.data);
    const owners = getMockData("sv_mock_service_owners", defaultMockServiceOwners);
    const updated = owners.map((o: any) => o.service_owner_id === id ? { ...o, muted: true, muted_ttl: body.minutes > 0 ? body.minutes * 60 : null } : o);
    saveMockData("sv_mock_service_owners", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 35. POST /api/service-owners/:id/unmute
  if (path.startsWith("/api/service-owners/") && path.endsWith("/unmute") && method === "post") {
    const parts = path.split("/");
    const id = parts[parts.length - 2];
    const owners = getMockData("sv_mock_service_owners", defaultMockServiceOwners);
    const updated = owners.map((o: any) => o.service_owner_id === id ? { ...o, muted: false, muted_ttl: null } : o);
    saveMockData("sv_mock_service_owners", updated);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 36. GET /api/latest-version
  if (path === "/api/latest-version" && method === "get") {
    return makeAxiosResponse({ version: "v0.1.18", latest_version: "v0.1.18" }, 200, config);
  }

  // 37. GET /api/retention/audit-logs
  if (path === "/api/retention/audit-logs" && method === "get") {
    const defaultRetention = {
      activity_days: 90,
      purge_interval_hours: 4
    };
    const retention = getMockData("sv_mock_retention_logs", defaultRetention);
    const defaultMockRuns = [
      { run_id: "run-1", run_type: "logs", status: "completed", items_purged: 154, completed_at: new Date(Date.now() - 3600000).toISOString() }
    ];
    const runs = getMockData("sv_mock_retention_runs", defaultMockRuns);
    return makeAxiosResponse({ policy: retention, runs: runs.filter((r: any) => r.run_type === "logs") }, 200, config);
  }

  // 38. PUT /api/retention/audit-logs
  if (path === "/api/retention/audit-logs" && method === "put") {
    const body = parseRequestBody(config.data);
    saveMockData("sv_mock_retention_logs", body);
    return makeAxiosResponse({ success: true, policy: body }, 200, config);
  }

  // 39. GET /api/retention/incidents
  if (path === "/api/retention/incidents" && method === "get") {
    const defaultRetention = {
      incident_days: 30,
      purge_interval_hours: 4
    };
    const retention = getMockData("sv_mock_retention_incidents", defaultRetention);
    const defaultMockRuns = [
      { run_id: "run-2", run_type: "incidents", status: "completed", items_purged: 42, completed_at: new Date(Date.now() - 7200000).toISOString() }
    ];
    const runs = getMockData("sv_mock_retention_runs", defaultMockRuns);
    return makeAxiosResponse({ policy: retention, runs: runs.filter((r: any) => r.run_type === "incidents") }, 200, config);
  }

  // 40. PUT /api/retention/incidents
  if (path === "/api/retention/incidents" && method === "put") {
    const body = parseRequestBody(config.data);
    saveMockData("sv_mock_retention_incidents", body);
    return makeAxiosResponse({ success: true, policy: body }, 200, config);
  }

  // 41. DELETE /api/retention/runs
  if (path === "/api/retention/runs" && method === "delete") {
    saveMockData("sv_mock_retention_runs", []);
    return makeAxiosResponse({ success: true }, 200, config);
  }

  // 42. GET /api/retention/runs/:id
  if (path.startsWith("/api/retention/runs/") && method === "get") {
    const runId = path.split("/").pop();
    const defaultMockRuns = [
      { run_id: "run-1", run_type: "logs", status: "completed", items_purged: 154, completed_at: new Date(Date.now() - 3600000).toISOString() },
      { run_id: "run-2", run_type: "incidents", status: "completed", items_purged: 42, completed_at: new Date(Date.now() - 7200000).toISOString() }
    ];
    const runs = getMockData("sv_mock_retention_runs", defaultMockRuns);
    const run = runs.find((r: any) => r.run_id === runId) || defaultMockRuns[0];
    return makeAxiosResponse({ ...run, details: [] }, 200, config);
  }

  return null;
}

