import postgres from "postgres";
import Redis from "ioredis";
import "dotenv/config";

const sql = postgres({
  host:     process.env.POSTGRES_HOST     || "localhost",
  port:     Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB       || "srevox",
  username: process.env.POSTGRES_USER     || "srevox",
  password: process.env.POSTGRES_PASSWORD || "srevox_dev",
});

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

async function main() {
  try {
    // 1. Get first organization and cluster
    const [cluster] = await sql`
      SELECT cluster_id, org_id, name FROM clusters LIMIT 1
    `;
    if (!cluster) {
      console.error("No cluster found in database.");
      process.exit(1);
    }
    console.log(`Using Cluster: ${cluster.name} (${cluster.cluster_id})`);

    // 2. Get active users in this org
    const users = await sql`
      SELECT user_id FROM users WHERE org_id = ${cluster.org_id} AND is_active = true
    `;
    if (users.length === 0) {
      console.error("No active users found for this organization.");
      process.exit(1);
    }
    console.log(`Found ${users.length} active users to notify.`);

    // 3. Create dummy incident
    const podName = `test-service-${Math.floor(Math.random() * 10000)}-pod`;
    const [incident] = await sql`
      INSERT INTO incidents (
        org_id, cluster_id, pod_name, namespace, container_name, 
        crash_reason, restart_count, severity, status
      ) VALUES (
        ${cluster.org_id}, ${cluster.cluster_id}, ${podName}, 'default', 'main', 
        'CrashLoopBackOff', 5, 'critical', 'open'
      ) RETURNING incident_id
    `;
    const incidentId = incident.incident_id;
    console.log(`\u2705 Created Dummy Incident ID: ${incidentId}`);

    // 4. Create crash notifications for all active users
    for (const u of users) {
      const title = `${podName} crashed`;
      const sub = `CrashLoopBackOff \u00b7 default \u00b7 5 restarts`;
      
      const [notif] = await sql`
        INSERT INTO user_notifications (
          org_id, user_id, incident_id, cluster_id, title, sub, severity, type
        ) VALUES (
          ${cluster.org_id}, ${u.user_id}, ${incidentId}, ${cluster.cluster_id}, 
          ${title}, ${sub}, 'critical', 'crash'
        ) RETURNING notification_id, created_at
      `;

      // Publish to Redis for live SSE sync
      const payload = {
        id: notif.notification_id,
        incident_id: incidentId,
        cluster_id: cluster.cluster_id,
        title,
        sub,
        severity: 'critical',
        type: 'crash',
        read: false,
        time: notif.created_at
      };
      await redis.publish(`srevox:notifications:${u.user_id}`, JSON.stringify({ type: "notification", notification: payload }));
    }
    console.log(`\u2705 Created & Broadcasted crash notifications for incident.`);

    // 5. Create a dummy system notification for Cluster Disconnected
    const sysTitle = `Cluster '${cluster.name}' Disconnected`;
    const sysSub = `No heartbeat received since ${new Date().toLocaleString()} \u00b7 System Alert`;
    for (const u of users) {
      const [notif] = await sql`
        INSERT INTO user_notifications (
          org_id, user_id, cluster_id, title, sub, severity, type
        ) VALUES (
          ${cluster.org_id}, ${u.user_id}, ${cluster.cluster_id}, 
          ${sysTitle}, ${sysSub}, 'warning', 'system'
        ) RETURNING notification_id, created_at
      `;

      const payload = {
        id: notif.notification_id,
        incident_id: null,
        cluster_id: cluster.cluster_id,
        title: sysTitle,
        sub: sysSub,
        severity: 'warning',
        type: 'system',
        read: false,
        time: notif.created_at
      };
      await redis.publish(`srevox:notifications:${u.user_id}`, JSON.stringify({ type: "notification", notification: payload }));
    }
    console.log(`\u2705 Created & Broadcasted system notifications for cluster.`);

    console.log("\n\ud83c\udf89 Seed complete! Go check your Srevox UI notifications now!");
  } catch (err) {
    console.error("Error running script:", err);
  } finally {
    await sql.end();
    redis.disconnect();
  }
}

main();
