import postgres from "postgres";
import "dotenv/config";

const sql = postgres({
  host:     process.env.POSTGRES_HOST     || "localhost",
  port:     Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB       || "srevox",
  username: process.env.POSTGRES_USER     || "srevox",
  password: process.env.POSTGRES_PASSWORD || "srevox_dev",
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: () => {}, // Suppress verbose postgres notices in console logs
  transform: {
    undefined: null
  }
});

export default sql;
