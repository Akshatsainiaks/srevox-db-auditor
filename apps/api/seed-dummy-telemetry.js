import postgres from "postgres";
import "dotenv/config";

const sql = postgres({
  host:     process.env.POSTGRES_HOST     || "localhost",
  port:     Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB       || "srevox",
  username: process.env.POSTGRES_USER     || "srevox",
  password: process.env.POSTGRES_PASSWORD || "loopzen_dev",
});

const CLUSTER_ID = "cls_e88ql5eu";

async function run() {
  try {
    console.log("Creating tables cluster_nodes & cluster_pods...");
    
    await sql`
      CREATE TABLE IF NOT EXISTS cluster_nodes (
        cluster_id           TEXT NOT NULL,
        name                 TEXT NOT NULL,
        role                 TEXT NOT NULL,
        status               TEXT NOT NULL,
        cpu_cores            NUMERIC NOT NULL,
        memory_gb            NUMERIC NOT NULL,
        cpu_usage_pct        INTEGER NOT NULL,
        memory_usage_pct     INTEGER NOT NULL,
        pods_running         INTEGER NOT NULL,
        pods_capacity        INTEGER NOT NULL,
        age                  TEXT NOT NULL,
        PRIMARY KEY (cluster_id, name)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS cluster_pods (
        cluster_id           TEXT NOT NULL,
        name                 TEXT NOT NULL,
        namespace            TEXT NOT NULL,
        node                 TEXT NOT NULL,
        status               TEXT NOT NULL,
        cpu_usage_m          INTEGER NOT NULL,
        memory_usage_mi      INTEGER NOT NULL,
        restarts             INTEGER NOT NULL,
        age                  TEXT NOT NULL,
        PRIMARY KEY (cluster_id, namespace, name)
      )
    `;

    console.log("Deleting old telemetry data for cluster:", CLUSTER_ID);
    await sql`DELETE FROM cluster_nodes WHERE cluster_id = ${CLUSTER_ID}`;
    await sql`DELETE FROM cluster_pods WHERE cluster_id = ${CLUSTER_ID}`;

    console.log("Inserting dummy nodes...");
    const nodes = [
      { name: "node-master-0", role: "master", status: "Ready", cpu_cores: 8, memory_gb: 32, cpu_usage_pct: 42, memory_usage_pct: 68, pods_running: 15, pods_capacity: 110, age: "124d" },
      { name: "node-worker-0", role: "worker", status: "Ready", cpu_cores: 16, memory_gb: 64, cpu_usage_pct: 75, memory_usage_pct: 82, pods_running: 48, pods_capacity: 110, age: "124d" },
      { name: "node-worker-1", role: "worker", status: "Ready", cpu_cores: 16, memory_gb: 64, cpu_usage_pct: 35, memory_usage_pct: 40, pods_running: 22, pods_capacity: 110, age: "98d" }
    ];

    for (const n of nodes) {
      await sql`
        INSERT INTO cluster_nodes (cluster_id, name, role, status, cpu_cores, memory_gb, cpu_usage_pct, memory_usage_pct, pods_running, pods_capacity, age)
        VALUES (${CLUSTER_ID}, ${n.name}, ${n.role}, ${n.status}, ${n.cpu_cores}, ${n.memory_gb}, ${n.cpu_usage_pct}, ${n.memory_usage_pct}, ${n.pods_running}, ${n.pods_capacity}, ${n.age})
      `;
    }

    console.log("Inserting dummy pods...");
    const pods = [
      { name: "frontend-deployment-78dfb", namespace: "production", node: "node-worker-0", status: "Running", cpu_usage_m: 150, memory_usage_mi: 256, restarts: 0, age: "12d" },
      { name: "backend-service-56c84", namespace: "production", node: "node-worker-1", status: "Running", cpu_usage_m: 350, memory_usage_mi: 512, restarts: 1, age: "12d" },
      { name: "database-postgresql-0", namespace: "production", node: "node-worker-0", status: "Running", cpu_usage_m: 800, memory_usage_mi: 2048, restarts: 0, age: "34d" },
      { name: "redis-cache-c694f", namespace: "production", node: "node-worker-1", status: "Running", cpu_usage_m: 100, memory_usage_mi: 128, restarts: 0, age: "12d" },
      { name: "prometheus-server-0", namespace: "monitoring", node: "node-worker-0", status: "Running", cpu_usage_m: 400, memory_usage_mi: 4096, restarts: 3, age: "54d" },
      { name: "grafana-dashboard-7d8b", namespace: "monitoring", node: "node-worker-1", status: "Running", cpu_usage_m: 50, memory_usage_mi: 128, restarts: 0, age: "54d" },
      { name: "srevox-agent-68df", namespace: "kube-system", node: "node-worker-0", status: "Running", cpu_usage_m: 80, memory_usage_mi: 90, restarts: 0, age: "82d" },
      { name: "kube-apiserver-node-master-0", namespace: "kube-system", node: "node-master-0", status: "Running", cpu_usage_m: 250, memory_usage_mi: 512, restarts: 0, age: "124d" },
      { name: "coredns-58d7c", namespace: "kube-system", node: "node-master-0", status: "Running", cpu_usage_m: 20, memory_usage_mi: 64, restarts: 0, age: "124d" },
      { name: "failing-logger-pod-99c8", namespace: "production", node: "node-worker-1", status: "CrashLoopBackOff", cpu_usage_m: 400, memory_usage_mi: 600, restarts: 25, age: "2d" }
    ];

    for (const p of pods) {
      await sql`
        INSERT INTO cluster_pods (cluster_id, name, namespace, node, status, cpu_usage_m, memory_usage_mi, restarts, age)
        VALUES (${CLUSTER_ID}, ${p.name}, ${p.namespace}, ${p.node}, ${p.status}, ${p.cpu_usage_m}, ${p.memory_usage_mi}, ${p.restarts}, ${p.age})
      `;
    }

    console.log("Updating cluster metadata in database...");
    await sql`
      UPDATE clusters
      SET status = 'connected',
          master_nodes_ready = 1,
          master_nodes_total = 1,
          worker_nodes_ready = 2,
          worker_nodes_total = 2,
          last_seen_at = now()
      WHERE cluster_id = ${CLUSTER_ID}
    `;

    console.log("DB SEEDING SUCCESSFUL!");
  } catch (err) {
    console.error("DB SEEDING ERROR:", err);
  }
  process.exit(0);
}
run();
