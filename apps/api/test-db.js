import sql from "./src/db/sql.js";
async function check() {
  try {
    const id = "inc_test_" + Math.floor(Math.random() * 10000);
    await sql`
      INSERT INTO incidents
        (incident_id, org_id, cluster_id, rule_id, pod_name, namespace, container_name,
         crash_reason, restart_count, exit_code, pod_labels, raw_event, severity)
      VALUES
        (${id}, 'orgjncj44t4hb4',
         null, null,
         'simulated-redis-connector-1234', 'default', 'redis-client',
         'CrashLoopBackOff', 5, 1,
         '{}', '{}', 'critical')
    `;
    console.log("INSERT SUCCESS!");
  } catch (err) {
    console.error("INSERT ERROR:", err);
  }
  process.exit(0);
}
check();
