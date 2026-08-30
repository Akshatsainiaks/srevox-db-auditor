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
    console.log("Creating table cluster_nodes_history...");
    
    await sql`
      CREATE TABLE IF NOT EXISTS cluster_nodes_history (
        history_id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
        created_at           TIMESTAMPTZ DEFAULT now()
      )
    `;

    console.log("Deleting old historical telemetry data for cluster:", CLUSTER_ID);
    await sql`DELETE FROM cluster_nodes_history WHERE cluster_id = ${CLUSTER_ID}`;

    console.log("Generating 24 hours of historical telemetry (10-min intervals)...");
    const baseNodes = [
      { name: "node-master-0", role: "master", status: "Ready", cpu_cores: 8, memory_gb: 32, base_cpu: 40, base_mem: 65, pods_running: 15, pods_capacity: 110, age: "124d" },
      { name: "node-worker-0", role: "worker", status: "Ready", cpu_cores: 16, memory_gb: 64, base_cpu: 70, base_mem: 80, pods_running: 48, pods_capacity: 110, age: "124d" },
      { name: "node-worker-1", role: "worker", status: "Ready", cpu_cores: 16, memory_gb: 64, base_cpu: 30, base_mem: 35, pods_running: 22, pods_capacity: 110, age: "98d" }
    ];

    const now = new Date();
    const rows = [];

    // 24 hours * 6 intervals = 144 intervals
    for (let i = 144; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 10 * 60 * 1000);
      
      // Calculate a diurnal cycle variation (sine wave over 24 hours)
      const hourOfDay = timestamp.getHours();
      const cycleFactor = Math.sin((hourOfDay / 24) * 2 * Math.PI); // Range [-1, 1]

      for (const bn of baseNodes) {
        // Add cycle variation and a bit of random noise
        const randomNoiseCpu = (Math.random() - 0.5) * 8;
        const randomNoiseMem = (Math.random() - 0.5) * 4;

        const cpu_usage_pct = Math.min(100, Math.max(5, Math.round(bn.base_cpu + (cycleFactor * 15) + randomNoiseCpu)));
        const memory_usage_pct = Math.min(100, Math.max(10, Math.round(bn.base_mem + (cycleFactor * 8) + randomNoiseMem)));
        
        rows.push({
          cluster_id: CLUSTER_ID,
          name: bn.name,
          role: bn.role,
          status: bn.status,
          cpu_cores: bn.cpu_cores,
          memory_gb: bn.memory_gb,
          cpu_usage_pct,
          memory_usage_pct,
          pods_running: bn.pods_running,
          pods_capacity: bn.pods_capacity,
          age: bn.age,
          created_at: timestamp
        });
      }
    }

    console.log(`Inserting ${rows.length} rows of node history...`);
    
    // Batch insert using single sql transaction
    await sql.begin(async (tx) => {
      for (const row of rows) {
        await tx`
          INSERT INTO cluster_nodes_history (
            cluster_id, name, role, status, cpu_cores, memory_gb, 
            cpu_usage_pct, memory_usage_pct, pods_running, pods_capacity, age, created_at
          ) VALUES (
            ${row.cluster_id}, ${row.name}, ${row.role}, ${row.status}, ${row.cpu_cores}, ${row.memory_gb}, 
            ${row.cpu_usage_pct}, ${row.memory_usage_pct}, ${row.pods_running}, ${row.pods_capacity}, ${row.age}, ${row.created_at}
          )
        `;
      }
    });

    console.log("DB HISTORICAL SEEDING SUCCESSFUL!");
  } catch (err) {
    console.error("DB HISTORICAL SEEDING ERROR:", err);
  }
  process.exit(0);
}
run();
