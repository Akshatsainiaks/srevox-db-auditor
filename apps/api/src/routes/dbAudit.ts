import { FastifyInstance } from "fastify";
import net from "net";
import mysql from "mysql2/promise";
import postgres from "postgres";
import redis from "../db/redis.js";
import { genId } from "../utils/id.js";
import sql from "../db/sql.js";

const AUTOMATED_ROUTINE_COLUMNS = new Set([
  "last_heartbeat_at",
  "last_seen_at",
  "last_seen",
  "heartbeat",
  "heartbeat_at",
  "ping_at",
  "last_ping",
  "last_ping_at",
  "top_cpu_processes",
  "top_mem_processes",
  "cpu_usage",
  "memory_usage",
  "disk_usage",
  "system_metrics",
  "health_check_at",
  "uptime",
  "uptime_seconds"
]);

function isAutomatedHeartbeatUpdate(changedFields: string[]): boolean {
  if (!changedFields || changedFields.length === 0) return true;
  const nonRoutineFields = changedFields.filter(f => {
    const lower = String(f).toLowerCase().trim();
    if (AUTOMATED_ROUTINE_COLUMNS.has(lower)) return false;
    if (lower === "updated_at" && changedFields.some(c => AUTOMATED_ROUTINE_COLUMNS.has(String(c).toLowerCase().trim()))) {
      return false;
    }
    return true;
  });
  return nonRoutineFields.length === 0;
}

const SREVOX_INTERNAL_TABLES = new Set([
  "db_audit_events",
  "db_audit_connectors",
  "schema_migrations",
  "schema_version"
]);

const PII_PATTERNS = ["password", "ssn", "tax_id", "credit_card", "cvv", "api_token", "secret", "access_token", "private_key", "hashed_password", "token", "card_hash"];

// Robust serializer to safely handle BigInt, Date, Buffer, null, nested objects/arrays
function safeSerialize(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val === "bigint") return val.toString();
  if (val instanceof Date) return val.toISOString();
  if (Buffer.isBuffer(val)) return val.toString("hex");
  if (typeof val === "object") {
    if (Array.isArray(val)) {
      return val.map(safeSerialize);
    }
    const out: Record<string, any> = {};
    for (const k of Object.keys(val).sort()) {
      out[k] = safeSerialize(val[k]);
    }
    return out;
  }
  return val;
}

// Deep value comparison across all database column types
function areValuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  try {
    return JSON.stringify(safeSerialize(a)) === JSON.stringify(safeSerialize(b));
  } catch {
    return String(a) === String(b);
  }
}

// Ensure field list is always returned as a clean string[]
function parseFieldArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
      if (parsed !== null && parsed !== undefined) return [String(parsed)];
    } catch {
      return val.includes(",") ? val.split(",").map(s => s.trim()) : [val];
    }
  }
  if (typeof val === "object") return Object.keys(val);
  return [String(val)];
}

function tryParseJson(val: any): any {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

export default async function dbAuditRoutes(app: FastifyInstance) {
  
  // ── SSE REAL-TIME CLIENT BROADCASTER ─────────────────────────────────────────
  const sseClients = new Set<(event: any) => void>();

  const broadcastEvent = (evt: any) => {
    for (const client of sseClients) {
      try {
        client(evt);
      } catch {}
    }
    try {
      redis.publish("db_audit:events", JSON.stringify(evt)).catch(() => {});
    } catch {}
  };

  // ── IN-MEMORY SCHEMA & DATA SNAPSHOT ENGINE ─────────────────────────────────
  const tableSchemaSnapshots = new Map<string, { columns: string[]; types: Record<string, string>; pks: string[] }>();
  const rowSnapshots = new Map<string, Map<string, Record<string, any>>>();


  // ── POSTGRESQL EXTERNAL CDC SCANNER ──────────────────────────────────────────
  const scanPostgresConnector = async (conn: any) => {
    try {
      const targetPort = Number(conn.port) || 5432;
      const configuredDb = (conn.database_name || "").trim();
      const isWildcard = !configuredDb || configuredDb === "*" || configuredDb.toLowerCase() === "all" || configuredDb.toLowerCase() === "all_databases";

      // 1. Enumerate target databases
      const targetDbs: string[] = [];
      if (isWildcard) {
        let enumClient: any = null;
        try {
          enumClient = postgres({
            host: conn.host,
            port: targetPort,
            database: "postgres",
            username: conn.username || "postgres",
            password: conn.password || "",
            connect_timeout: 4,
            max: 1,
            idle_timeout: 4
          });
          const rows = await enumClient`
            SELECT datname FROM pg_database 
            WHERE datistemplate = false 
              AND datname NOT IN ('postgres', 'template0', 'template1')
          `;
          for (const r of rows) {
            if (r.datname) targetDbs.push(r.datname);
          }
        } catch {
          // If connecting to 'postgres' db fails, try connecting to 'srevox' or default db
          try {
            if (enumClient) await enumClient.end({ timeout: 1 }).catch(() => {});
            enumClient = postgres({
              host: conn.host,
              port: targetPort,
              database: "srevox",
              username: conn.username || "postgres",
              password: conn.password || "",
              connect_timeout: 4,
              max: 1,
              idle_timeout: 4
            });
            const rows = await enumClient`
              SELECT datname FROM pg_database 
              WHERE datistemplate = false 
                AND datname NOT IN ('postgres', 'template0', 'template1')
            `;
            for (const r of rows) {
              if (r.datname && !targetDbs.includes(r.datname)) targetDbs.push(r.datname);
            }
          } catch {}
        } finally {
          if (enumClient) await enumClient.end({ timeout: 1 }).catch(() => {});
        }

        if (targetDbs.length === 0) {
          targetDbs.push(conn.username || "srevox");
        }
      } else {
        targetDbs.push(configuredDb);
      }

      // Update connector status to connected
      await sql`
        UPDATE db_audit_connectors 
        SET status = 'connected', last_sync_at = NOW() 
        WHERE id = ${conn.id} OR connector_id = ${conn.connector_id}
      `.catch(() => {});

      // User target tables filter if custom scope
      const allowedTables = (conn.audit_scope === "custom" && conn.target_tables)
        ? new Set(conn.target_tables.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean))
        : null;

      for (const db of targetDbs) {
        let dbClient: any = null;
        try {
          dbClient = postgres({
            host: conn.host,
            port: targetPort,
            database: db,
            username: conn.username || "postgres",
            password: conn.password || "",
            connect_timeout: 5,
            max: 1,
            idle_timeout: 5
          });

          // Fetch all user tables in public schema
          const tableRows = await dbClient`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
          `;

          const tables: string[] = [];
          for (const r of tableRows) {
            const tbl = r.table_name;
            if (typeof tbl === "string" && !tbl.startsWith("_") && !SREVOX_INTERNAL_TABLES.has(tbl.toLowerCase())) {
              if (!allowedTables || allowedTables.has(tbl.toLowerCase())) {
                tables.push(tbl);
              }
            }
          }

          // Persist discovered table count for dashboard telemetry
          if (tables.length > 0) {
            await sql`UPDATE db_audit_connectors SET table_count = ${tables.length}, monitored_tables = ${tables.join(',')}, status = 'connected', last_sync_at = NOW() WHERE id = ${conn.id} OR connector_id = ${conn.connector_id}`.catch(() => {});
          }

          const scanTables = tables.slice(0, 40);

          for (const tbl of scanTables) {
            const snapshotKey = `postgres:${conn.connector_id || conn.id}:${db}:${tbl}`;

            // 1. Column / Schema Drift Check (DDL)
            try {
              const colRows = await dbClient`
                SELECT column_name, data_type, is_nullable, column_default 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = ${tbl}
                ORDER BY ordinal_position
              `;

              const pkRows = await dbClient`
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = 'public'
                  AND tc.table_name = ${tbl}
              `;

              const currentCols: string[] = [];
              const currentTypes: Record<string, string> = {};
              let priKey = pkRows[0]?.column_name || "id";

              for (const c of colRows) {
                const colName = c.column_name;
                currentCols.push(colName);
                currentTypes[colName] = c.data_type;
                if (!pkRows[0] && (colName === "id" || colName === `${tbl}_id` || colName.endsWith("_id"))) {
                  priKey = colName;
                }
              }

              if (tableSchemaSnapshots.has(snapshotKey)) {
                const prevSchema = tableSchemaSnapshots.get(snapshotKey)!;
                const prevCols = prevSchema.columns;
                const prevTypes = prevSchema.types;

                const added = currentCols.filter(x => !prevCols.includes(x));
                const dropped = prevCols.filter(x => !currentCols.includes(x));
                const modified = currentCols.filter(x => prevCols.includes(x) && prevTypes[x] !== currentTypes[x]);

                if (added.length > 0 || dropped.length > 0 || modified.length > 0) {
                  const changedColsList = [
                    ...added.map(c => `ADD ${c} (${currentTypes[c]})`),
                    ...dropped.map(c => `DROP ${c}`),
                    ...modified.map(c => `ALTER ${c} (${prevTypes[c]} -> ${currentTypes[c]})`)
                  ];

                  const eventId = genId("evt");
                  const [newEvent] = await sql`
                    INSERT INTO db_audit_events (
                      id, event_id, org_id, connector_id, database_name, schema_name, table_name, operation,
                      primary_key, column_types, actor, client_ip,
                      before_state, after_state, changed_fields, masked_fields,
                      record_hash, capture_mode, commit_timestamp
                    ) VALUES (
                      ${eventId}, ${eventId}, ${conn.org_id || null}, ${conn.connector_id || conn.id},
                      ${db}, 'public', ${tbl}, 'DDL_CHANGE',
                      ${sql.json({ primary_key: priKey })},
                      ${sql.json(currentTypes)},
                      ${conn.username || "postgres"}, ${conn.host},
                      ${sql.json(safeSerialize(prevSchema))},
                      ${sql.json(safeSerialize({ columns: currentCols, types: currentTypes }))},
                      ${sql.json(changedColsList)},
                      ${sql.json([])},
                      ${genId("sha")}, 'schema_drift', now()
                    )
                    RETURNING *
                  `.catch(() => [null]);

                  if (newEvent) {
                    broadcastEvent({
                      id: newEvent.event_id,
                      event_id: newEvent.event_id,
                      connector_id: conn.connector_id || conn.id,
                      database: db,
                      schema: 'public',
                      table: tbl,
                      operation: 'DDL_CHANGE',
                      primary_key: newEvent.primary_key,
                      actor: conn.username || "postgres",
                      client_ip: conn.host,
                      column_types: currentTypes,
                      before: newEvent.before_state,
                      after: newEvent.after_state,
                      changed_fields: changedColsList,
                      masked_fields: [],
                      commit_timestamp: newEvent.commit_timestamp,
                      capture_mode: 'schema_drift'
                    });
                  }
                }
              }

              tableSchemaSnapshots.set(snapshotKey, {
                columns: currentCols,
                types: currentTypes,
                pks: [priKey]
              });
            } catch {}

            // 2. Data Mutation Check (INSERT, UPDATE, DELETE)
            try {
              const rows = await dbClient`SELECT * FROM ${dbClient(tbl)} LIMIT 100`;
              const currentMap = new Map<string, Record<string, any>>();
              const colTypeMap = tableSchemaSnapshots.get(snapshotKey)?.types || {};
              const priKey = tableSchemaSnapshots.get(snapshotKey)?.pks[0] || "id";

              for (const row of rows) {
                const pkVal = String(row[priKey] ?? row.id ?? row[`${tbl}_id`] ?? JSON.stringify(row));
                currentMap.set(pkVal, safeSerialize(row));
              }

              if (!rowSnapshots.has(snapshotKey)) {
                rowSnapshots.set(snapshotKey, currentMap);
                continue;
              }

              const prevMap = rowSnapshots.get(snapshotKey)!;

              // Detect DELETEs
              for (const [pk, prevRow] of prevMap.entries()) {
                if (!currentMap.has(pk)) {
                  const eventId = genId("evt");
                  const allKeys = Object.keys(prevRow);
                  const maskedFields = conn.enable_pii_masking ? allKeys.filter(k => PII_PATTERNS.some(p => k.toLowerCase().includes(p))) : [];

                  const [newEvent] = await sql`
                    INSERT INTO db_audit_events (
                      id, event_id, org_id, connector_id, database_name, schema_name, table_name, operation,
                      primary_key, before_state, after_state, changed_fields, masked_fields,
                      column_types, actor, client_ip,
                      commit_timestamp, capture_mode, record_hash
                    ) VALUES (
                      ${eventId}, ${eventId}, ${conn.org_id || null}, ${conn.connector_id || conn.id},
                      ${db}, 'public', ${tbl}, 'DELETE',
                      ${sql.json({ [priKey]: pk })},
                      ${sql.json(safeSerialize(prevRow))},
                      ${sql.json({})},
                      ${sql.json(allKeys)},
                      ${sql.json(maskedFields)},
                      ${sql.json(colTypeMap)},
                      ${conn.username || "postgres"}, ${conn.host},
                      now(), ${conn.capture_mode || 'log_based'}, ${genId("sha")}
                    )
                    RETURNING *
                  `.catch(() => [null]);

                  if (newEvent) {
                    broadcastEvent({
                      id: newEvent.event_id,
                      event_id: newEvent.event_id,
                      connector_id: conn.connector_id || conn.id,
                      database: db,
                      schema: 'public',
                      table: tbl,
                      operation: 'DELETE',
                      primary_key: newEvent.primary_key,
                      actor: conn.username || "postgres",
                      client_ip: conn.host,
                      column_types: colTypeMap,
                      before: newEvent.before_state,
                      after: newEvent.after_state,
                      changed_fields: allKeys,
                      masked_fields: maskedFields,
                      commit_timestamp: newEvent.commit_timestamp,
                      capture_mode: conn.capture_mode || 'log_based'
                    });
                  }
                }
              }

              // Detect UPDATEs
              for (const [pk, currRow] of currentMap.entries()) {
                if (prevMap.has(pk)) {
                  const prevRow = prevMap.get(pk)!;
                  const changedFields: string[] = [];
                  const maskedFields: string[] = [];
                  const allKeys = Array.from(new Set([...Object.keys(prevRow), ...Object.keys(currRow)]));

                  for (const key of allKeys) {
                    if (!areValuesEqual(prevRow[key], currRow[key])) {
                      changedFields.push(key);
                    }
                    if (conn.enable_pii_masking && PII_PATTERNS.some(p => key.toLowerCase().includes(p))) {
                      maskedFields.push(key);
                    }
                  }

                  if (changedFields.length > 0) {
                    // In manual_only mode, skip routine automated heartbeat & telemetry updates
                    if (conn.capture_mode === "manual_only" && isAutomatedHeartbeatUpdate(changedFields)) {
                      continue;
                    }

                    const eventId = genId("evt");
                    const [newEvent] = await sql`
                      INSERT INTO db_audit_events (
                        id, event_id, org_id, connector_id, database_name, schema_name, table_name, operation,
                        primary_key, before_state, after_state, changed_fields, masked_fields,
                        column_types, actor, client_ip,
                        commit_timestamp, capture_mode, record_hash
                      ) VALUES (
                        ${eventId}, ${eventId}, ${conn.org_id || null}, ${conn.connector_id || conn.id},
                        ${db}, 'public', ${tbl}, 'UPDATE',
                        ${sql.json({ [priKey]: pk })},
                        ${sql.json(safeSerialize(prevRow))},
                        ${sql.json(safeSerialize(currRow))},
                        ${sql.json(changedFields)},
                        ${sql.json(maskedFields)},
                        ${sql.json(colTypeMap)},
                        ${conn.username || "postgres"}, ${conn.host},
                        now(), ${conn.capture_mode || 'log_based'}, ${genId("sha")}
                      )
                      RETURNING *
                    `.catch(() => [null]);

                    if (newEvent) {
                      broadcastEvent({
                        id: newEvent.event_id,
                        event_id: newEvent.event_id,
                        connector_id: conn.connector_id || conn.id,
                        database: db,
                        schema: 'public',
                        table: tbl,
                        operation: 'UPDATE',
                        primary_key: newEvent.primary_key,
                        actor: conn.username || "postgres",
                        client_ip: conn.host,
                        column_types: colTypeMap,
                        before: newEvent.before_state,
                        after: newEvent.after_state,
                        changed_fields: changedFields,
                        masked_fields: maskedFields,
                        commit_timestamp: newEvent.commit_timestamp,
                        capture_mode: conn.capture_mode || 'log_based'
                      });
                    }
                  }
                } else {
                  // Detect INSERTs
                  const eventId = genId("evt");
                  const allKeys = Object.keys(currRow);
                  const maskedFields = conn.enable_pii_masking ? allKeys.filter(k => PII_PATTERNS.some(p => k.toLowerCase().includes(p))) : [];

                  const [newEvent] = await sql`
                    INSERT INTO db_audit_events (
                      id, event_id, org_id, connector_id, database_name, schema_name, table_name, operation,
                      primary_key, before_state, after_state, changed_fields, masked_fields,
                      column_types, actor, client_ip,
                      commit_timestamp, capture_mode, record_hash
                    ) VALUES (
                      ${eventId}, ${eventId}, ${conn.org_id || null}, ${conn.connector_id || conn.id},
                      ${db}, 'public', ${tbl}, 'INSERT',
                      ${sql.json({ [priKey]: pk })},
                      ${sql.json({})},
                      ${sql.json(safeSerialize(currRow))},
                      ${sql.json(allKeys)},
                      ${sql.json(maskedFields)},
                      ${sql.json(colTypeMap)},
                      ${conn.username || "postgres"}, ${conn.host},
                      now(), ${conn.capture_mode || 'log_based'}, ${genId("sha")}
                    )
                    RETURNING *
                  `.catch(() => [null]);

                  if (newEvent) {
                    broadcastEvent({
                      id: newEvent.event_id,
                      event_id: newEvent.event_id,
                      connector_id: conn.connector_id || conn.id,
                      database: db,
                      schema: 'public',
                      table: tbl,
                      operation: 'INSERT',
                      primary_key: newEvent.primary_key,
                      actor: conn.username || "postgres",
                      client_ip: conn.host,
                      column_types: colTypeMap,
                      before: newEvent.before_state,
                      after: newEvent.after_state,
                      changed_fields: allKeys,
                      masked_fields: maskedFields,
                      commit_timestamp: newEvent.commit_timestamp,
                      capture_mode: conn.capture_mode || 'log_based'
                    });
                  }
                }
              }

              // Update snapshot
              rowSnapshots.set(snapshotKey, currentMap);
            } catch {}
          }
        } catch {
          continue;
        } finally {
          if (dbClient) {
            await dbClient.end({ timeout: 1 }).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      console.warn(`[db-audit] PostgreSQL connector scan error (${conn.name}):`, err.message);
      await sql`UPDATE db_audit_connectors SET status = 'error' WHERE id = ${conn.id} OR connector_id = ${conn.connector_id}`.catch(() => {});
    }
  };

  // ── TIDB / MYSQL / MARIADB EXTERNAL SCANNER ─────────────────────────────────
  const scanMysqlConnector = async (conn: any) => {
    let connection: any = null;
    try {
      connection = await mysql.createConnection({
        host: conn.host,
        port: Number(conn.port) || 3306,
        user: conn.username || "root",
        password: conn.password || "",
        connectTimeout: 5000,
        dateStrings: true
      });

      // Update status to connected
      await sql`
        UPDATE db_audit_connectors 
        SET status = 'connected', last_sync_at = NOW() 
        WHERE id = ${conn.id} OR connector_id = ${conn.connector_id}
      `.catch(() => {});

      const targetDbs: string[] = [];
      const configuredDb = (conn.database_name || "").trim();

      if (!configuredDb || configuredDb === "*" || configuredDb.toLowerCase() === "all" || configuredDb.toLowerCase() === "all_databases") {
        const [dbRows]: any = await connection.query("SHOW DATABASES");
        const systemDbs = new Set(["information_schema", "mysql", "performance_schema", "sys", "metrics_schema", "test"]);
        for (const row of dbRows) {
          const name = row.Database || row.database;
          if (name && !systemDbs.has(name.toLowerCase())) {
            targetDbs.push(name);
          }
        }
      } else {
        targetDbs.push(configuredDb);
      }

      // User target tables filter if custom scope
      const allowedTables = (conn.audit_scope === "custom" && conn.target_tables)
        ? new Set(conn.target_tables.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean))
        : null;

      for (const db of targetDbs) {
        let tables: string[] = [];
        try {
          const [tableRows]: any = await connection.query(`SHOW TABLES FROM \`${db}\``);
          for (const r of tableRows) {
            const tbl = Object.values(r)[0];
            if (typeof tbl === "string" && !tbl.startsWith("_") && !SREVOX_INTERNAL_TABLES.has(tbl.toLowerCase())) {
              if (!allowedTables || allowedTables.has(tbl.toLowerCase())) {
                tables.push(tbl);
              }
            }
          }

          if (tables.length > 0) {
            await sql`UPDATE db_audit_connectors SET table_count = ${tables.length}, monitored_tables = ${tables.join(',')}, status = 'connected', last_sync_at = NOW() WHERE id = ${conn.id} OR connector_id = ${conn.connector_id}`.catch(() => {});
          }
        } catch {
          continue;
        }

        const scanTables = tables.slice(0, 30);

        for (const tbl of scanTables) {
          const snapshotKey = `mysql:${conn.connector_id || conn.id}:${db}:${tbl}`;

          // 1. Column / Schema Drift Check (DDL)
          try {
            const [colRows]: any = await connection.query(`SHOW FULL COLUMNS FROM \`${db}\`.\`${tbl}\``);
            const currentCols: string[] = [];
            const currentTypes: Record<string, string> = {};
            let priKey = "id";

            for (const c of colRows) {
              const colName = c.Field;
              currentCols.push(colName);
              currentTypes[colName] = c.Type;
              if (c.Key === "PRI") {
                priKey = colName;
              }
            }

            if (tableSchemaSnapshots.has(snapshotKey)) {
              const prevSchema = tableSchemaSnapshots.get(snapshotKey)!;
              const prevCols = prevSchema.columns;
              const prevTypes = prevSchema.types;

              const added = currentCols.filter(x => !prevCols.includes(x));
              const dropped = prevCols.filter(x => !currentCols.includes(x));
              const modified = currentCols.filter(x => prevCols.includes(x) && prevTypes[x] !== currentTypes[x]);

              if (added.length > 0 || dropped.length > 0 || modified.length > 0) {
                const changedColsList = [
                  ...added.map(c => `ADD ${c} (${currentTypes[c]})`),
                  ...dropped.map(c => `DROP ${c}`),
                  ...modified.map(c => `ALTER ${c} (${prevTypes[c]} -> ${currentTypes[c]})`)
                ];

                const eventId = genId("evt");
                const [newEvent] = await sql`
                  INSERT INTO db_audit_events (
                    id, event_id, org_id, connector_id, database_name, schema_name, table_name, operation,
                    primary_key, column_types, actor, client_ip,
                    before_state, after_state, changed_fields, masked_fields,
                    record_hash, capture_mode, commit_timestamp
                  ) VALUES (
                    ${eventId}, ${eventId}, ${conn.org_id || null}, ${conn.connector_id || conn.id},
                    ${db}, 'default', ${tbl}, 'DDL_CHANGE',
                    ${sql.json({ primary_key: priKey })},
                    ${sql.json(currentTypes)},
                    ${conn.username || "admin"}, ${conn.host},
                    ${sql.json(safeSerialize(prevSchema))},
                    ${sql.json(safeSerialize({ columns: currentCols, types: currentTypes }))},
                    ${sql.json(changedColsList)},
                    ${sql.json([])},
                    ${genId("sha")}, 'schema_drift', now()
                  )
                  RETURNING *
                `.catch(() => [null]);

                if (newEvent) {
                  broadcastEvent({
                    id: newEvent.event_id,
                    event_id: newEvent.event_id,
                    connector_id: conn.connector_id || conn.id,
                    database: db,
                    schema: db,
                    table: tbl,
                    operation: 'DDL_CHANGE',
                    primary_key: newEvent.primary_key,
                    actor: conn.username || "admin",
                    client_ip: conn.host,
                    column_types: currentTypes,
                    before: newEvent.before_state,
                    after: newEvent.after_state,
                    changed_fields: changedColsList,
                    masked_fields: [],
                    commit_timestamp: newEvent.commit_timestamp,
                    capture_mode: 'schema_drift'
                  });
                }
              }
            }

            tableSchemaSnapshots.set(snapshotKey, {
              columns: currentCols,
              types: currentTypes,
              pks: [priKey]
            });
          } catch {}

          // 2. Data Mutation Check (INSERT, UPDATE, DELETE)
          try {
            const [rows]: any = await connection.query(`SELECT * FROM \`${db}\`.\`${tbl}\` LIMIT 100`);
            const currentMap = new Map<string, Record<string, any>>();
            const colTypeMap = tableSchemaSnapshots.get(snapshotKey)?.types || {};
            const priKey = tableSchemaSnapshots.get(snapshotKey)?.pks[0] || "id";

            for (const row of rows) {
              const pkVal = String(row[priKey] ?? row.id ?? JSON.stringify(row));
              currentMap.set(pkVal, row);
            }

            if (!rowSnapshots.has(snapshotKey)) {
              rowSnapshots.set(snapshotKey, currentMap);
              continue;
            }

            const prevMap = rowSnapshots.get(snapshotKey)!;

            // Detect DELETEs
            for (const [pk, prevRow] of prevMap.entries()) {
              if (!currentMap.has(pk)) {
                const eventId = genId("evt");
                const allKeys = Object.keys(prevRow);
                const maskedFields = conn.enable_pii_masking ? allKeys.filter(k => PII_PATTERNS.some(p => k.toLowerCase().includes(p))) : [];

                const [newEvent] = await sql`
                  INSERT INTO db_audit_events (
                    id, event_id, org_id, connector_id, database_name, schema_name, table_name, operation,
                    primary_key, before_state, after_state, changed_fields, masked_fields,
                    column_types, actor, client_ip,
                    commit_timestamp, capture_mode, record_hash
                  ) VALUES (
                    ${eventId}, ${eventId}, ${conn.org_id || null}, ${conn.connector_id || conn.id},
                    ${db}, 'default', ${tbl}, 'DELETE',
                    ${sql.json({ [priKey]: pk })},
                    ${sql.json(safeSerialize(prevRow))},
                    ${sql.json({})},
                    ${sql.json(allKeys)},
                    ${sql.json(maskedFields)},
                    ${sql.json(colTypeMap)},
                    ${conn.username || "admin"}, ${conn.host},
                    now(), ${conn.capture_mode || 'log_based'}, ${genId("sha")}
                  )
                  RETURNING *
                `.catch(() => [null]);

                if (newEvent) {
                  broadcastEvent({
                    id: newEvent.event_id,
                    event_id: newEvent.event_id,
                    connector_id: conn.connector_id || conn.id,
                    database: db,
                    schema: db,
                    table: tbl,
                    operation: 'DELETE',
                    primary_key: newEvent.primary_key,
                    actor: conn.username || "admin",
                    client_ip: conn.host,
                    column_types: colTypeMap,
                    before: newEvent.before_state,
                    after: newEvent.after_state,
                    changed_fields: allKeys,
                    masked_fields: maskedFields,
                    commit_timestamp: newEvent.commit_timestamp,
                    capture_mode: conn.capture_mode || 'log_based'
                  });
                }
              }
            }

            // Detect UPDATEs
            for (const [pk, currRow] of currentMap.entries()) {
              if (prevMap.has(pk)) {
                const prevRow = prevMap.get(pk)!;
                const changedFields: string[] = [];
                const maskedFields: string[] = [];
                const allKeys = Array.from(new Set([...Object.keys(prevRow), ...Object.keys(currRow)]));

                for (const key of allKeys) {
                  if (!areValuesEqual(prevRow[key], currRow[key])) {
                    changedFields.push(key);
                  }
                  if (conn.enable_pii_masking && PII_PATTERNS.some(p => key.toLowerCase().includes(p))) {
                    maskedFields.push(key);
                  }
                }

                if (changedFields.length > 0) {
                  const eventId = genId("evt");
                  const [newEvent] = await sql`
                    INSERT INTO db_audit_events (
                      id, event_id, org_id, connector_id, database_name, schema_name, table_name, operation,
                      primary_key, before_state, after_state, changed_fields, masked_fields,
                      column_types, actor, client_ip,
                      commit_timestamp, capture_mode, record_hash
                    ) VALUES (
                      ${eventId}, ${eventId}, ${conn.org_id || null}, ${conn.connector_id || conn.id},
                      ${db}, 'default', ${tbl}, 'UPDATE',
                      ${sql.json({ [priKey]: pk })},
                      ${sql.json(safeSerialize(prevRow))},
                      ${sql.json(safeSerialize(currRow))},
                      ${sql.json(changedFields)},
                      ${sql.json(maskedFields)},
                      ${sql.json(colTypeMap)},
                      ${conn.username || "admin"}, ${conn.host},
                      now(), ${conn.capture_mode || 'log_based'}, ${genId("sha")}
                    )
                    RETURNING *
                  `.catch(() => [null]);

                  if (newEvent) {
                    broadcastEvent({
                      id: newEvent.event_id,
                      event_id: newEvent.event_id,
                      connector_id: conn.connector_id || conn.id,
                      database: db,
                      schema: db,
                      table: tbl,
                      operation: 'UPDATE',
                      primary_key: newEvent.primary_key,
                      actor: conn.username || "admin",
                      client_ip: conn.host,
                      column_types: colTypeMap,
                      before: newEvent.before_state,
                      after: newEvent.after_state,
                      changed_fields: changedFields,
                      masked_fields: maskedFields,
                      commit_timestamp: newEvent.commit_timestamp,
                      capture_mode: conn.capture_mode || 'log_based'
                    });
                  }
                }
              } else {
                // Detect INSERTs
                const eventId = genId("evt");
                const allKeys = Object.keys(currRow);
                const maskedFields = conn.enable_pii_masking ? allKeys.filter(k => PII_PATTERNS.some(p => k.toLowerCase().includes(p))) : [];

                const [newEvent] = await sql`
                  INSERT INTO db_audit_events (
                    id, event_id, org_id, connector_id, database_name, schema_name, table_name, operation,
                    primary_key, before_state, after_state, changed_fields, masked_fields,
                    column_types, actor, client_ip,
                    commit_timestamp, capture_mode, record_hash
                  ) VALUES (
                    ${eventId}, ${eventId}, ${conn.org_id || null}, ${conn.connector_id || conn.id},
                    ${db}, 'default', ${tbl}, 'INSERT',
                    ${sql.json({ [priKey]: pk })},
                    ${sql.json({})},
                    ${sql.json(safeSerialize(currRow))},
                    ${sql.json(allKeys)},
                    ${sql.json(maskedFields)},
                    ${sql.json(colTypeMap)},
                    ${conn.username || "admin"}, ${conn.host},
                    now(), ${conn.capture_mode || 'log_based'}, ${genId("sha")}
                  )
                  RETURNING *
                `.catch(() => [null]);

                if (newEvent) {
                  broadcastEvent({
                    id: newEvent.event_id,
                    event_id: newEvent.event_id,
                    connector_id: conn.connector_id || conn.id,
                    database: db,
                    schema: db,
                    table: tbl,
                    operation: 'INSERT',
                    primary_key: newEvent.primary_key,
                    actor: conn.username || "admin",
                    client_ip: conn.host,
                    column_types: colTypeMap,
                    before: newEvent.before_state,
                    after: newEvent.after_state,
                    changed_fields: allKeys,
                    masked_fields: maskedFields,
                    commit_timestamp: newEvent.commit_timestamp,
                    capture_mode: conn.capture_mode || 'log_based'
                  });
                }
              }
            }

            rowSnapshots.set(snapshotKey, currentMap);
          } catch {}
        }
      }
    } catch (err: any) {
      console.warn(`[db-audit] TiDB/MySQL connector scan error (${conn.name}):`, err.message);
      await sql`UPDATE db_audit_connectors SET status = 'error' WHERE id = ${conn.id} OR connector_id = ${conn.connector_id}`.catch(() => {});
    } finally {
      if (connection) {
        try {
          await connection.end();
        } catch {}
      }
    }
  };

  // ── AUDIT SWEEP DAEMON (Runs every 3 seconds) ──────────────────────────────
  let isScanning = false;
  setInterval(async () => {
    if (isScanning) return;
    isScanning = true;
    try {
      const connectors = await sql`
        SELECT * FROM db_audit_connectors 
        WHERE status != 'disabled'
      `.catch(() => []);

      // If no connectors exist, do NOT scan anything and do NOT create any dummy events!
      if (!connectors || connectors.length === 0) {
        return;
      }

      await Promise.allSettled(connectors.map(async (conn) => {
        const type = (conn.db_type || "").toLowerCase();
        if (["postgresql", "postgres", "neon", "supabase", "cockroachdb", "timescaledb"].includes(type)) {
          await scanPostgresConnector(conn);
        } else if (["tidb", "mysql", "mariadb", "oceanbase", "planetscale", "singlestore"].includes(type)) {
          await scanMysqlConnector(conn);
        }
      }));
    } catch (err: any) {
      console.warn("[db-audit] sweep error:", err.message);
    } finally {
      isScanning = false;
    }
  }, 3000);

  // ── ROUTE: GET /api/db-audit/schema — Introspect full database schema ────────
  app.get("/schema", async (req, reply) => {
    try {
      const orgId = extractOrgId(req);
      const connectors = await sql`
        SELECT connector_id, database_name, table_count, monitored_tables
        FROM db_audit_connectors
        WHERE status != 'disabled'
          ${orgId ? sql`AND (org_id = ${orgId} OR org_id IS NULL)` : sql``}
      `.catch(() => []);

      const tablesMap: Record<string, any> = {};

      for (const c of connectors) {
        if (c.monitored_tables) {
          const tblList = c.monitored_tables.split(",").map((t: string) => t.trim()).filter(Boolean);
          for (const tbl of tblList) {
            tablesMap[tbl] = {
              columns: [],
              rows_estimate: 0,
              connector_id: c.connector_id
            };
          }
        }
      }

      const totalTables = Object.keys(tablesMap).length;

      return reply.send({
        success: true,
        database: connectors[0]?.database_name || "all",
        total_tables: totalTables,
        tables: tablesMap
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  const extractOrgId = (req: any): string | null => {
    if (req.user?.org_id) return req.user.org_id;
    try {
      const auth = req.headers?.authorization;
      if (auth && auth.startsWith("Bearer ")) {
        const decoded: any = (app as any).jwt?.decode?.(auth.slice(7));
        if (decoded?.org_id) return decoded.org_id;
      }
    } catch {}
    return null;
  };

  // ── ROUTE: GET /api/db-audit/connectors — List all connectors ────────────────
  app.get("/connectors", async (req, reply) => {
    try {
      const orgId = extractOrgId(req);

      const connectors = await sql`
        SELECT 
          connector_id, org_id, name, db_type, capture_mode, host, port, 
          database_name, username, status, audit_scope, target_tables, 
          enable_pii_masking, table_count, monitored_tables, last_sync_at, created_at
        FROM db_audit_connectors 
        WHERE 1=1 ${orgId ? sql`AND (org_id = ${orgId} OR org_id IS NULL)` : sql``}
        ORDER BY created_at DESC
      `;

      return reply.send({ connectors });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── ROUTE: GET /api/db-audit/connectors/:id — Get single connector ──────────
  app.get("/connectors/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const orgId = extractOrgId(req);

      const [conn] = await sql`
        SELECT 
          connector_id, org_id, name, db_type, capture_mode, host, port, 
          database_name, username, status, audit_scope, target_tables, 
          enable_pii_masking, last_sync_at, created_at
        FROM db_audit_connectors 
        WHERE (id = ${id} OR connector_id = ${id}) 
          ${orgId ? sql`AND (org_id = ${orgId} OR org_id IS NULL)` : sql``}
        LIMIT 1
      `;

      if (!conn) {
        return reply.status(404).send({ error: "Database connector not found" });
      }

      return reply.send({ connector: conn });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── ROUTE: PATCH /api/db-audit/connectors/:id — Update connector ────────────
  app.patch("/connectors/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const orgId = extractOrgId(req);
      const body = req.body as any;

      const {
        name,
        host,
        port,
        database_name,
        username,
        capture_mode,
        audit_scope,
        target_tables,
        enable_pii_masking
      } = body;

      const [updated] = await sql`
        UPDATE db_audit_connectors
        SET 
          name = COALESCE(${name}, name),
          host = COALESCE(${host}, host),
          port = COALESCE(${port ? Number(port) : null}, port),
          database_name = COALESCE(${database_name}, database_name),
          username = COALESCE(${username}, username),
          capture_mode = COALESCE(${capture_mode}, capture_mode),
          audit_scope = COALESCE(${audit_scope}, audit_scope),
          target_tables = COALESCE(${target_tables}, target_tables),
          enable_pii_masking = COALESCE(${enable_pii_masking !== undefined ? Boolean(enable_pii_masking) : null}, enable_pii_masking),
          last_sync_at = NOW()
        WHERE (id = ${id} OR connector_id = ${id})
          ${orgId ? sql`AND (org_id = ${orgId} OR org_id IS NULL)` : sql``}
        RETURNING connector_id, org_id, name, db_type, capture_mode, host, port, database_name, username, status, audit_scope, target_tables, enable_pii_masking, last_sync_at, created_at
      `;

      return reply.send({ success: true, connector: updated });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── ROUTE: POST /api/db-audit/connectors — Create connector ─────────────────
  app.post("/connectors", async (req, reply) => {
    try {
      const user = (req as any).user;
      const orgId = user?.org_id;
      const body = req.body as any;

      const {
        name,
        db_type = "postgresql",
        capture_mode = "log_based",
        host,
        port = 5432,
        database_name = "*",
        username,
        password,
        audit_scope = "all",
        target_tables,
        enable_pii_masking = true
      } = body;

      if (!name || !host) {
        return reply.status(400).send({ error: "Missing required fields: name, host" });
      }

      const connectorId = genId("dbconn");
      const finalDbName = database_name && database_name.trim() !== "" ? database_name.trim() : "*";

      const [newConn] = await sql`
        INSERT INTO db_audit_connectors (
          id, connector_id, org_id, name, db_type, capture_mode, host, port,
          database_name, username, password, status, audit_scope, target_tables,
          enable_pii_masking, last_sync_at
        ) VALUES (
          ${connectorId}, ${connectorId}, ${orgId}, ${name}, ${db_type}, ${capture_mode}, ${host}, ${Number(port)},
          ${finalDbName}, ${username}, ${password}, 'connected', ${audit_scope}, ${target_tables},
          ${Boolean(enable_pii_masking)}, NOW()
        )
        RETURNING connector_id, org_id, name, db_type, capture_mode, host, port, database_name, username, status, audit_scope, target_tables, enable_pii_masking, last_sync_at, created_at
      `;

      // Trigger immediate scan for this connector
      const connWithSecret = { ...newConn, password };
      const normalizedType = (db_type || "").toLowerCase();
      try {
        if (["postgresql", "postgres", "neon", "supabase", "cockroachdb", "timescaledb"].includes(normalizedType)) {
          await scanPostgresConnector(connWithSecret);
        } else if (["tidb", "mysql", "mariadb", "oceanbase", "planetscale", "singlestore"].includes(normalizedType)) {
          await scanMysqlConnector(connWithSecret);
        }
      } catch (scanErr: any) {
        console.warn("[db-audit] Initial table discovery scan warning:", scanErr.message);
      }

      // Fetch the updated connector with table_count and monitored_tables
      const [finalConn] = await sql`
        SELECT connector_id, org_id, name, db_type, capture_mode, host, port, database_name, username, status, audit_scope, target_tables, enable_pii_masking, table_count, monitored_tables, last_sync_at, created_at
        FROM db_audit_connectors
        WHERE id = ${newConn.id || connectorId} OR connector_id = ${connectorId}
        LIMIT 1
      `.catch(() => [newConn]);

      // Publish to Redis channel for Go/Rust CDC consumers
      redis.publish("cdc:connectors", JSON.stringify({ action: "upsert", connector: finalConn || newConn })).catch(() => {});
      redis.set(`cdc:connectors:${connectorId}`, JSON.stringify(finalConn || newConn)).catch(() => {});

      return reply.send({ success: true, connector: finalConn || newConn });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── ROUTE: DELETE /api/db-audit/connectors/:id — Delete connector ──────────
  app.delete("/connectors/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const user = (req as any).user;
      const orgId = user?.org_id;

      await sql`
        DELETE FROM db_audit_connectors 
        WHERE (id = ${id} OR connector_id = ${id}) 
          AND (org_id = ${orgId} OR org_id IS NULL)
      `;

      return reply.send({ success: true, message: "Connector disconnected successfully" });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── ROUTE: POST /api/db-audit/connectors/test — Test connectivity ────────────
  app.post("/connectors/test", async (req, reply) => {
    const body = req.body as any;
    const { host, port, db_type, username, database_name } = body;
    let password = body.password;

    // If password not provided in test payload, lookup saved password for existing connector
    if (!password && (body.connector_id || body.id)) {
      const connId = body.connector_id || body.id;
      const [saved] = await sql`
        SELECT password FROM db_audit_connectors 
        WHERE id = ${connId} OR connector_id = ${connId} 
        LIMIT 1
      `.catch(() => [null]);
      if (saved?.password) {
        password = saved.password;
      }
    }

    if (!host || !port) {
      return reply.status(400).send({ success: false, message: "Missing host or port for connection test" });
    }

    const targetPort = Number(port);
    const dbType = (db_type || "mysql").toLowerCase();
    const startTime = Date.now();

    // If PostgreSQL family: test real handshake using postgres.js
    if (["postgresql", "postgres", "neon", "supabase", "cockroachdb", "timescaledb"].includes(dbType)) {
      try {
        const testPg = postgres({
          host,
          port: targetPort,
          username: username || "postgres",
          password: password || "",
          database: (database_name && database_name !== "*") ? database_name : (username || "postgres"),
          connect_timeout: 4,
          max: 1
        });
        await testPg`SELECT 1`;
        await testPg.end({ timeout: 1 }).catch(() => {});
        const latencyMs = Date.now() - startTime;
        return reply.send({
          success: true,
          message: `Successfully connected & authenticated with ${dbType.toUpperCase()} on ${host}:${targetPort}`,
          latencyMs
        });
      } catch (err: any) {
        return reply.send({
          success: false,
          message: `Connection failed to ${host}:${targetPort} — ${err.message}`,
          latencyMs: Date.now() - startTime
        });
      }
    }

    // If TiDB, MySQL, or MariaDB: test real handshake using mysql2
    if (["tidb", "mysql", "mariadb", "oceanbase", "planetscale", "singlestore"].includes(dbType)) {
      try {
        const testConn = await mysql.createConnection({
          host,
          port: targetPort,
          user: username || "root",
          password: password || "",
          database: (database_name && database_name !== "*") ? database_name : undefined,
          connectTimeout: 4000
        });
        await testConn.query("SELECT 1");
        await testConn.end();
        const latencyMs = Date.now() - startTime;
        return reply.send({
          success: true,
          message: `Successfully connected & authenticated with ${dbType.toUpperCase()} on ${host}:${targetPort}`,
          latencyMs
        });
      } catch (err: any) {
        return reply.send({
          success: false,
          message: `Connection failed to ${host}:${targetPort} — ${err.message}`,
          latencyMs: Date.now() - startTime
        });
      }
    }

    // Default socket check fallback
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(3000);

      socket.connect(targetPort, host, () => {
        const latencyMs = Date.now() - startTime;
        socket.destroy();
        resolve(reply.send({
          success: true,
          message: `Successfully reached ${dbType.toUpperCase()} service on ${host}:${targetPort}`,
          latencyMs
        }));
      });

      socket.on("error", (err) => {
        socket.destroy();
        resolve(reply.send({
          success: false,
          message: `Network error reaching ${host}:${targetPort}: ${err.message}`,
          latencyMs: Date.now() - startTime
        }));
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve(reply.send({
          success: false,
          message: `Connection timed out reaching ${host}:${targetPort}`,
          latencyMs: 3000
        }));
      });
    });
  });

  // ── ROUTE: GET /api/db-audit/stream — SSE Stream ────────────────────────────
  app.get("/stream", (req, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.write("retry: 3000\n\n");

    const sendEvent = (evt: any) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
      } catch {}
    };

    sseClients.add(sendEvent);

    req.raw.on("close", () => {
      sseClients.delete(sendEvent);
    });
  });

  // ── ROUTE: GET /api/db-audit/analytics/velocity — Real-time CDC Mutation Velocity & DML Breakdown ─────────
  app.get("/analytics/velocity", async (req, reply) => {
    try {
      const user = (req as any).user;
      const orgId = user?.org_id;

      // 1. DML breakdown counts (excluding internal tables)
      const counts = await sql`
        SELECT 
          UPPER(operation) AS op,
          count(*)::int AS count
        FROM db_audit_events
        WHERE (org_id = ${orgId} OR org_id IS NULL)
          AND table_name != ALL(${Array.from(SREVOX_INTERNAL_TABLES)})
        GROUP BY UPPER(operation)
      `;

      let inserts = 0;
      let updates = 0;
      let deletes = 0;
      let ddl = 0;

      for (const row of counts) {
        const op = row.op;
        if (op === "INSERT") inserts += row.count;
        else if (op === "UPDATE") updates += row.count;
        else if (op === "DELETE") deletes += row.count;
        else ddl += row.count;
      }

      const total = inserts + updates + deletes + ddl;

      // Compute percentages
      const insertPct = total > 0 ? Math.round((inserts / total) * 1000) / 10 : 0;
      const updatePct = total > 0 ? Math.round((updates / total) * 1000) / 10 : 0;
      const deletePct = total > 0 ? Math.round((deletes / total) * 1000) / 10 : 0;
      const ddlPct = total > 0 ? Math.round((ddl / total) * 1000) / 10 : 0;

      // 2. Mutations in last 60 minutes
      const lastHourRows = await sql`
        SELECT count(*)::int AS count
        FROM db_audit_events
        WHERE (org_id = ${orgId} OR org_id IS NULL)
          AND table_name != ALL(${Array.from(SREVOX_INTERNAL_TABLES)})
          AND commit_timestamp >= NOW() - INTERVAL '1 hour'
      `;
      const lastHourCount = lastHourRows[0]?.count || 0;

      // 3. Mutations in last 5 minutes
      const last5mRows = await sql`
        SELECT count(*)::int AS count
        FROM db_audit_events
        WHERE (org_id = ${orgId} OR org_id IS NULL)
          AND table_name != ALL(${Array.from(SREVOX_INTERNAL_TABLES)})
          AND commit_timestamp >= NOW() - INTERVAL '5 minutes'
      `;
      const last5mCount = last5mRows[0]?.count || 0;

      // 4. Sparkline timeline (last 1 hour buckets)
      const bucketRows = await sql`
        SELECT 
          to_char(date_trunc('minute', commit_timestamp), 'HH24:MI') as time,
          count(*)::int as count,
          count(*) FILTER (WHERE UPPER(operation) = 'INSERT')::int as inserts,
          count(*) FILTER (WHERE UPPER(operation) = 'UPDATE')::int as updates,
          count(*) FILTER (WHERE UPPER(operation) = 'DELETE')::int as deletes
        FROM db_audit_events
        WHERE (org_id = ${orgId} OR org_id IS NULL)
          AND table_name != ALL(${Array.from(SREVOX_INTERNAL_TABLES)})
          AND commit_timestamp >= NOW() - INTERVAL '1 hour'
        GROUP BY 1
        ORDER BY 1 ASC
        LIMIT 10
      `;

      const baseVelocity = lastHourCount > 0 ? (lastHourCount / 3600) : 0;
      const currentVelocityPerSec = last5mCount > 0 
        ? Math.round((last5mCount / 300) * 100) / 100 
        : (baseVelocity > 0 ? Math.round(baseVelocity * 100) / 100 : 0);

      const netRowGrowth = inserts - deletes;

      // Top mutated table
      const topTableRows = await sql`
        SELECT schema_name || '.' || table_name AS full_table, count(*)::int AS count
        FROM db_audit_events
        WHERE (org_id = ${orgId} OR org_id IS NULL)
          AND table_name != ALL(${Array.from(SREVOX_INTERNAL_TABLES)})
        GROUP BY schema_name, table_name
        ORDER BY count DESC
        LIMIT 1
      `;
      const topTable = topTableRows[0]?.full_table || "none";

      return reply.send({
        success: true,
        data: {
          totalMutations: total,
          lastHourCount,
          last5mCount,
          currentVelocityPerSec,
          currentVelocityPerMin: Math.round(currentVelocityPerSec * 60),
          netRowGrowth,
          topActiveTable: topTable,
          spikeDetected: false,
          spikeSeverity: "normal",
          breakdown: {
            inserts: { count: inserts, percentage: insertPct },
            updates: { count: updates, percentage: updatePct },
            deletes: { count: deletes, percentage: deletePct },
            ddl: { count: ddl, percentage: ddlPct }
          },
          buckets: bucketRows
        }
      });
    } catch (err: any) {
      console.error("[db-audit] Failed to calculate mutation velocity:", err);
      return reply.status(500).send({ error: err.message || "Failed to calculate velocity" });
    }
  });

  // ── ROUTE: GET /api/db-audit/events — Get recent audit change events ─────────
  app.get("/events", async (req, reply) => {
    try {
      const orgId = extractOrgId(req);
      const { limit = "500", database, operation, table, connector_id } = (req.query || {}) as Record<string, string>;
      const internalList = Array.from(SREVOX_INTERNAL_TABLES);

      const events = await sql`
        SELECT 
          event_id AS id,
          event_id,
          org_id,
          connector_id,
          database_name AS database,
          schema_name AS schema,
          table_name AS table,
          operation,
          actor,
          client_ip,
          column_types,
          primary_key,
          before_state AS before,
          after_state AS after,
          changed_fields,
          masked_fields,
          record_hash,
          capture_mode,
          commit_timestamp,
          created_at
        FROM db_audit_events 
        WHERE 1=1
          ${orgId ? sql`AND (org_id = ${orgId} OR org_id IS NULL)` : sql``}
          ${connector_id && connector_id !== "all" ? sql`AND (
            connector_id = ${connector_id} 
            OR connector_id = (SELECT connector_id FROM db_audit_connectors WHERE connector_id = ${connector_id} OR id = ${connector_id} LIMIT 1)
          )` : sql``}
          ${database && database !== "all" && database !== "*" ? sql`AND database_name = ${database}` : sql``}
          ${operation && operation !== "all" ? sql`AND operation = ${operation}` : sql``}
          ${table && table !== "all" ? sql`AND table_name = ${table}` : sql``}
          AND table_name != ALL(${internalList})
          ${(req.query as any)?.capture_mode === 'manual_only' ? sql`AND NOT (changed_fields ?| ARRAY['last_heartbeat_at', 'last_seen_at', 'top_cpu_processes', 'top_mem_processes'])` : sql``}
        ORDER BY commit_timestamp DESC 
        LIMIT ${Math.min(Number(limit) || 500, 2000)}
      `;

      const normalized = events.map(ev => ({
        ...ev,
        actor: ev.actor || "srevox",
        client_ip: ev.client_ip || null,
        column_types: typeof ev.column_types === "string" ? tryParseJson(ev.column_types) : (ev.column_types || {}),
        changed_fields: parseFieldArray(ev.changed_fields),
        masked_fields: parseFieldArray(ev.masked_fields),
        primary_key: typeof ev.primary_key === "string" ? tryParseJson(ev.primary_key) : ev.primary_key,
        before: typeof ev.before === "string" ? tryParseJson(ev.before) : ev.before,
        after: typeof ev.after === "string" ? tryParseJson(ev.after) : ev.after,
      }));

      return reply.send({ events: normalized });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── ROUTE: POST /api/db-audit/events — Push manual or external event ────────
  app.post("/events", async (req, reply) => {
    try {
      const user = (req as any).user;
      const orgId = user?.org_id || null;
      const body = req.body as any;

      const dbName = body.database_name || body.database || "production_db";
      const schemaName = body.schema_name || body.schema || "public";
      const tableName = body.table_name || body.table;
      const operation = body.operation || "UPDATE";
      const primaryKey = body.primary_key || { id: 1 };
      const beforeState = body.before_state || body.before || {};
      const afterState = body.after_state || body.after || {};
      const changedFields = parseFieldArray(body.changed_fields || []);
      const maskedFields = parseFieldArray(body.masked_fields || []);
      const columnTypes = body.column_types || {};
      const actor = body.actor || user?.email || user?.name || "srevox";
      const clientIp = body.client_ip || (req.socket?.remoteAddress ? String(req.socket.remoteAddress) : "127.0.0.1");
      const recordHash = body.record_hash || genId("sha");
      const captureMode = body.capture_mode || "cdc_audit";
      const connectorId = body.connector_id || null;

      if (!tableName) {
        return reply.status(400).send({ error: "Missing required field: table or table_name" });
      }

      const eventId = genId("evt");

      const [newEvent] = await sql`
        INSERT INTO db_audit_events (
          id, event_id, org_id, connector_id, database_name, schema_name, table_name, operation,
          actor, client_ip, primary_key, column_types, before_state, after_state,
          changed_fields, masked_fields, record_hash, capture_mode, commit_timestamp
        ) VALUES (
          ${eventId}, ${eventId}, ${orgId}, ${connectorId}, ${dbName}, ${schemaName}, ${tableName}, ${operation},
          ${actor}, ${clientIp},
          ${sql.json(typeof primaryKey === "string" ? tryParseJson(primaryKey) : primaryKey)},
          ${sql.json(columnTypes)},
          ${sql.json(safeSerialize(typeof beforeState === "string" ? tryParseJson(beforeState) : beforeState))},
          ${sql.json(safeSerialize(typeof afterState === "string" ? tryParseJson(afterState) : afterState))},
          ${sql.json(changedFields)},
          ${sql.json(maskedFields)},
          ${recordHash}, ${captureMode}, now()
        )
        RETURNING *
      `;

      const formattedEvt = {
        id: newEvent.event_id,
        event_id: newEvent.event_id,
        org_id: newEvent.org_id,
        connector_id: newEvent.connector_id,
        database: newEvent.database_name,
        schema: newEvent.schema_name,
        table: newEvent.table_name,
        operation: newEvent.operation,
        actor: newEvent.actor || actor,
        client_ip: newEvent.client_ip || clientIp,
        column_types: columnTypes,
        primary_key: newEvent.primary_key,
        before: newEvent.before_state,
        after: newEvent.after_state,
        changed_fields: changedFields,
        masked_fields: maskedFields,
        commit_timestamp: newEvent.commit_timestamp,
        record_hash: newEvent.record_hash,
        capture_mode: newEvent.capture_mode
      };

      broadcastEvent(formattedEvt);

      return reply.send({ success: true, event: formattedEvt });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── ROUTE: DELETE /api/db-audit/events/:id — Delete single audit event ──────
  app.delete("/events/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const user = (req as any).user;
      const orgId = user?.org_id;

      await sql`
        DELETE FROM db_audit_events 
        WHERE (event_id = ${id} OR id = ${id}) 
          AND (org_id = ${orgId} OR org_id IS NULL)
      `;

      return reply.send({ success: true, message: `Audit event ${id} deleted successfully` });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── ROUTE: POST /api/db-audit/events/bulk-delete ────────────────────────────
  app.post("/events/bulk-delete", async (req, reply) => {
    try {
      const user = (req as any).user;
      const orgId = user?.org_id;
      const { ids } = (req.body || {}) as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({ error: "ids array required" });
      }

      await sql`
        DELETE FROM db_audit_events 
        WHERE (event_id IN ${sql(ids)} OR id IN ${sql(ids)})
          AND (org_id = ${orgId} OR org_id IS NULL)
      `;
      return reply.send({ success: true, count: ids.length });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── ROUTE: DELETE /api/db-audit/events — Clear audit events stream ──────────
  app.delete("/events", async (req, reply) => {
    try {
      const user = (req as any).user;
      const orgId = user?.org_id;
      const { database, table, connector_id } = req.query as { database?: string; table?: string; connector_id?: string };

      if (connector_id) {
        await sql`
          DELETE FROM db_audit_events 
          WHERE (
            connector_id = ${connector_id}
            OR connector_id = (SELECT connector_id FROM db_audit_connectors WHERE connector_id = ${connector_id} OR id = ${connector_id} LIMIT 1)
          )
          AND (org_id = ${orgId} OR org_id IS NULL)
        `;
      } else if (database && table) {
        await sql`
          DELETE FROM db_audit_events 
          WHERE database_name = ${database} AND table_name = ${table}
            AND (org_id = ${orgId} OR org_id IS NULL)
        `;
      } else if (database) {
        await sql`
          DELETE FROM db_audit_events 
          WHERE database_name = ${database}
            AND (org_id = ${orgId} OR org_id IS NULL)
        `;
      } else {
        await sql`
          DELETE FROM db_audit_events 
          WHERE (org_id = ${orgId} OR org_id IS NULL)
        `;
      }

      return reply.send({ success: true, message: "Audit stream events cleared successfully" });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
