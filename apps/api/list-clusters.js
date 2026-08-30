import postgres from "postgres";
import "dotenv/config";

const sql = postgres({
  host:     process.env.POSTGRES_HOST     || "localhost",
  port:     Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB       || "srevox",
  username: process.env.POSTGRES_USER     || "srevox",
  password: process.env.POSTGRES_PASSWORD || "srevox_dev",
});

async function run() {
  try {
    const orgs = await sql`SELECT * FROM organizations`;
    console.log("ORGANIZATIONS:", orgs);

    const clusters = await sql`SELECT cluster_id, name, connection_type, status FROM clusters`;
    console.log("CLUSTERS IN DB:", clusters);
  } catch (err) {
    console.error("ERROR:", err);
  }
  process.exit(0);
}
run();
