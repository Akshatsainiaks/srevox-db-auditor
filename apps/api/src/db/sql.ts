import postgres from "postgres";
import "dotenv/config";

const connectionUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const sql = connectionUrl
  ? postgres(connectionUrl, {
      max: 20,
      idle_timeout: 30,
      connect_timeout: 15,
      ssl: connectionUrl.includes("sslmode=require") || process.env.POSTGRES_SSL === "true" || process.env.POSTGRES_SSL === "require" ? "require" : undefined,
      onnotice: () => {},
      transform: {
        undefined: null,
      },
    })
  : postgres({
      host:     process.env.POSTGRES_HOST     || "localhost",
      port:     Number(process.env.POSTGRES_PORT || 5432),
      database: process.env.POSTGRES_DB       || "srevox",
      username: process.env.POSTGRES_USER     || "srevox",
      password: process.env.POSTGRES_PASSWORD || "srevox_dev",
      ssl:      process.env.POSTGRES_SSL === "true" || process.env.POSTGRES_SSL === "require" ? "require" : undefined,
      max: 20,
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: () => {},
      transform: {
        undefined: null,
      },
    });

export default sql;
