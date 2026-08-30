import { FastifyInstance } from "fastify";
import crypto from "crypto";
import sql from "../db/sql.js";
import redis from "../db/redis.js";
import { evaluateMachineAlerts } from "../services/infraEvaluator.js";

import { getUser, requirePermission } from "../middleware/rbac.js";

function generateMachineToken(): string {
  return "srvx_mach_" + crypto.randomBytes(16).toString("hex");
}

export default async function machineRoutes(app: FastifyInstance) {
  // GET /api/machines - List all machines
  app.get("/", { onRequest: [(app as any).authenticate, requirePermission("viewMachines")] }, async (req, reply) => {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS machines (
          machine_id VARCHAR(64) PRIMARY KEY,
          org_id VARCHAR(64),
          name VARCHAR(255) NOT NULL,
          hostname VARCHAR(255),
          ip_address VARCHAR(128),
          os VARCHAR(128),
          arch VARCHAR(64),
          agent_token VARCHAR(255) UNIQUE NOT NULL,
          cpu_cores INT DEFAULT 1,
          total_memory_bytes BIGINT DEFAULT 0,
          total_disk_bytes BIGINT DEFAULT 0,
          status VARCHAR(32) DEFAULT 'pending',
          error_message TEXT,
          last_heartbeat_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS org_id VARCHAR(64)`;

      await sql`
        CREATE TABLE IF NOT EXISTS machine_telemetry_history (
          id BIGSERIAL PRIMARY KEY,
          machine_id VARCHAR(64) NOT NULL REFERENCES machines(machine_id) ON DELETE CASCADE,
          cpu_usage_pct NUMERIC(5,2) DEFAULT 0,
          memory_used_bytes BIGINT DEFAULT 0,
          memory_usage_pct NUMERIC(5,2) DEFAULT 0,
          disk_used_bytes BIGINT DEFAULT 0,
          disk_usage_pct NUMERIC(5,2) DEFAULT 0,
          network_rx_bytes_sec BIGINT DEFAULT 0,
          network_tx_bytes_sec BIGINT DEFAULT 0,
          load_avg_1m NUMERIC(6,2) DEFAULT 0,
          load_avg_5m NUMERIC(6,2) DEFAULT 0,
          load_avg_15m NUMERIC(6,2) DEFAULT 0,
          recorded_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      let userOrgId: string | null = null;
      try {
        const u = getUser(req);
        userOrgId = u?.org_id || null;
      } catch {}

      const machines = await sql`
        SELECT 
          m.*,
          th.cpu_usage_pct,
          th.memory_used_bytes,
          th.memory_usage_pct,
          th.disk_used_bytes,
          th.disk_usage_pct,
          th.network_rx_bytes_sec,
          th.network_tx_bytes_sec,
          th.load_avg_1m,
          th.recorded_at AS last_metric_at
        FROM machines m
        LEFT JOIN LATERAL (
          SELECT * FROM machine_telemetry_history
          WHERE machine_id = m.machine_id
          ORDER BY recorded_at DESC
          LIMIT 1
        ) th ON true
        WHERE m.org_id IS NULL OR m.org_id = ${userOrgId}
        ORDER BY m.created_at DESC
      `;

      const now = Date.now();
      const updated = (machines || []).map((m: any) => {
        let status = m.status || "unconfigured";
        if (!m.last_heartbeat_at) {
          status = "unconfigured";
        } else {
          const lastHb = new Date(m.last_heartbeat_at).getTime();
          if (now - lastHb > 2 * 60 * 1000) {
            status = "offline";
          } else {
            status = "online";
          }
        }
        const isConfigured = !!m.last_heartbeat_at;
        return {
          ...m,
          status,
          cpu_usage_pct: isConfigured ? Number(m.cpu_usage_pct || 0) : 0,
          memory_usage_pct: isConfigured ? Number(m.memory_usage_pct || 0) : 0,
          disk_usage_pct: isConfigured ? Number(m.disk_usage_pct || 0) : 0,
          load_avg_1m: isConfigured ? Number(m.load_avg_1m || 0) : 0,
        };
      });

      return { success: true, machines: updated };
    } catch (err: any) {
      console.error("GET /api/machines error:", err);
      reply.status(500);
      return { success: false, error: err.message || "Failed to fetch machines" };
    }
  });

  // POST /api/machines - Register new machine
  app.post("/", { onRequest: [(app as any).authenticate, requirePermission("addMachine")] }, async (req, reply) => {
    try {
      await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS org_id VARCHAR(64)`;
      const { name, hostname, os, arch, cpu_cores, total_memory_bytes, total_disk_bytes } = (req.body as any) || {};
      if (!name) {
        reply.status(400);
        return { success: false, error: "Machine name is required" };
      }

      let userOrgId: string | null = null;
      try {
        const u = getUser(req);
        userOrgId = u?.org_id || null;
      } catch {}

      const machine_id = "mach_" + crypto.randomBytes(8).toString("hex");
      const agent_token = generateMachineToken();

      const [machine] = await sql`
        INSERT INTO machines (
          machine_id, org_id, name, hostname, os, arch, agent_token,
          cpu_cores, total_memory_bytes, total_disk_bytes, status
        ) VALUES (
          ${machine_id}, ${userOrgId}, ${name}, ${hostname || name}, ${os || 'Linux'}, ${arch || 'x86_64'}, ${agent_token},
          ${Number(cpu_cores) || 1}, ${Number(total_memory_bytes) || 0}, ${Number(total_disk_bytes) || 0}, 'unconfigured'
        )
        RETURNING *
      `;

      return { success: true, machine, token: agent_token };
    } catch (err: any) {
      reply.status(500);
      return { success: false, error: err.message };
    }
  });

  // GET /api/machines/:id - Machine details
  app.get("/:id", { onRequest: [(app as any).authenticate, requirePermission("viewMachines")] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const [machine] = await sql`
        SELECT m.*, 
               th.cpu_usage_pct, th.memory_used_bytes, th.memory_usage_pct,
               th.disk_used_bytes, th.disk_usage_pct, th.network_rx_bytes_sec,
               th.network_tx_bytes_sec, th.load_avg_1m, th.load_avg_5m, th.load_avg_15m
        FROM machines m
        LEFT JOIN LATERAL (
          SELECT * FROM machine_telemetry_history
          WHERE machine_id = m.machine_id
          ORDER BY recorded_at DESC
          LIMIT 1
        ) th ON true
        WHERE m.machine_id = ${id}
      `;

      if (!machine) {
        reply.status(404);
        return { success: false, error: "Machine not found" };
      }

      let status = machine.status || "unconfigured";
      if (!machine.last_heartbeat_at) {
        status = "unconfigured";
      } else {
        const lastHb = new Date(machine.last_heartbeat_at).getTime();
        if (Date.now() - lastHb > 2 * 60 * 1000) {
          status = "offline";
        } else {
          status = "online";
        }
      }

      const isConfigured = !!machine.last_heartbeat_at;
      const formatted = {
        ...machine,
        status,
        cpu_usage_pct: isConfigured ? Number(machine.cpu_usage_pct || 0) : 0,
        memory_usage_pct: isConfigured ? Number(machine.memory_usage_pct || 0) : 0,
        disk_usage_pct: isConfigured ? Number(machine.disk_usage_pct || 0) : 0,
        load_avg_1m: isConfigured ? Number(machine.load_avg_1m || 0) : 0,
      };

      return { success: true, machine: formatted };
    } catch (err: any) {
      reply.status(500);
      return { success: false, error: err.message };
    }
  });

  // PUT /api/machines/:id - Update machine details
  app.put("/:id", { onRequest: [(app as any).authenticate, requirePermission("addMachine")] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = (req.body as any) || {};
      const { name, hostname, os, arch, cpu_cores, total_memory_bytes, total_disk_bytes } = body;

      if (!name) {
        reply.status(400);
        return { success: false, error: "Machine name is required" };
      }

      const cleanStr = (val: any) => (val !== undefined && val !== null ? String(val) : null);
      const cleanNum = (val: any) => (val !== undefined && val !== null && !isNaN(Number(val)) ? Number(val) : null);

      const safeName = String(name);
      const safeHostname = cleanStr(hostname);
      const safeOs = cleanStr(os);
      const safeArch = cleanStr(arch);
      const safeCores = cleanNum(cpu_cores);
      const safeMem = cleanNum(total_memory_bytes);
      const safeDisk = cleanNum(total_disk_bytes);

      const [updated] = await sql`
        UPDATE machines SET
          name = ${safeName},
          hostname = COALESCE(${safeHostname}, hostname),
          os = COALESCE(${safeOs}, os),
          arch = COALESCE(${safeArch}, arch),
          cpu_cores = COALESCE(${safeCores}, cpu_cores),
          total_memory_bytes = COALESCE(${safeMem}, total_memory_bytes),
          total_disk_bytes = COALESCE(${safeDisk}, total_disk_bytes)
        WHERE machine_id = ${id}
        RETURNING *
      `;

      if (!updated) {
        reply.status(404);
        return { success: false, error: "Machine not found" };
      }

      return { success: true, machine: updated };
    } catch (err: any) {
      req.log.error(err, "Update machine error");
      reply.status(500);
      return { success: false, error: err.message };
    }
  });

  // POST /api/machines/:id/regenerate-token - Regenerate machine agent token
  app.post("/:id/regenerate-token", { onRequest: [(app as any).authenticate, requirePermission("addMachine")] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const newToken = generateMachineToken();

      const [updated] = await sql`
        UPDATE machines
        SET agent_token = ${newToken}
        WHERE machine_id = ${id}
        RETURNING *
      `;

      if (!updated) {
        reply.status(404);
        return { success: false, error: "Machine not found" };
      }

      return {
        success: true,
        agent_token: newToken,
        message: "Machine agent token regenerated successfully"
      };
    } catch (err: any) {
      reply.status(500);
      return { success: false, error: err.message };
    }
  });

  // DELETE /api/machines/:id - Remove machine
  app.delete("/:id", { onRequest: [(app as any).authenticate, requirePermission("deleteMachine")] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await sql`DELETE FROM machines WHERE machine_id = ${id}`;
      return { success: true, message: "Machine deleted" };
    } catch (err: any) {
      reply.status(500);
      return { success: false, error: err.message };
    }
  });

  // POST /api/machines/ingest - High-throughput Telemetry Ingestion Endpoint
  app.post("/ingest", async (req, reply) => {
    try {
      const authHeader = req.headers.authorization;
      let token = "";
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      } else if ((req.body as any)?.agent_token) {
        token = (req.body as any).agent_token;
      }

      if (!token) {
        reply.status(401);
        return { success: false, error: "Authorization Bearer token required" };
      }

      const [machine] = await sql`SELECT * FROM machines WHERE agent_token = ${token}`;
      if (!machine) {
        reply.status(403);
        return { success: false, error: "Invalid agent token" };
      }

      const body = (req.body as any) || {};
      const {
        hostname, ip_address, os, arch, cpu_cores, total_memory_bytes, total_disk_bytes,
        memory_used_bytes, memory_usage_pct, disk_used_bytes, disk_usage_pct,
        network_rx_bytes_sec, network_tx_bytes_sec, load_avg_1m, load_avg_5m, load_avg_15m,
        collected_at, top_processes, top_cpu_processes, top_mem_processes
      } = body;

      const rawCpu = 
        body.cpu_usage_pct ??
        body.cpu_percent ??
        body.cpu_usage ??
        body.cpu_pct ??
        body.cpu ??
        body.metrics?.cpu_usage_pct ??
        body.metrics?.cpu_percent ??
        body.cpu?.usage_pct ??
        body.cpu?.percent ??
        0;

      const parsedCpu = parseFloat(String(rawCpu));
      const finalCpuUsagePct = isNaN(parsedCpu) ? 0 : Math.min(100, Math.max(0, parsedCpu));

      const recordedAt = collected_at ? new Date(collected_at) : new Date();
      const validRecordedAt = isNaN(recordedAt.getTime()) ? new Date() : recordedAt;

      const parseProcList = (val: any) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === "string") {
          try {
            const p = JSON.parse(val);
            if (Array.isArray(p)) return p;
          } catch {}
        }
        return [];
      };

      const finalTopCpu = parseProcList(top_cpu_processes || top_processes);
      const finalTopMem = parseProcList(top_mem_processes);

      await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS top_cpu_processes JSONB DEFAULT '[]'::jsonb`;
      await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS top_mem_processes JSONB DEFAULT '[]'::jsonb`;

      await sql`
        UPDATE machines SET
          hostname = COALESCE(${hostname ?? null}, hostname),
          ip_address = COALESCE(${ip_address ?? null}, ip_address),
          os = COALESCE(${os ?? null}, os),
          arch = COALESCE(${arch ?? null}, arch),
          cpu_cores = COALESCE(${Number(cpu_cores) || null}, cpu_cores),
          total_memory_bytes = COALESCE(${Number(total_memory_bytes) || null}, total_memory_bytes),
          total_disk_bytes = COALESCE(${Number(total_disk_bytes) || null}, total_disk_bytes),
          top_cpu_processes = ${JSON.stringify(finalTopCpu)}::jsonb,
          top_mem_processes = ${JSON.stringify(finalTopMem)}::jsonb,
          status = 'online',
          error_message = NULL,
          last_heartbeat_at = NOW()
        WHERE machine_id = ${machine.machine_id}
      `;

      const [telemetry] = await sql`
        INSERT INTO machine_telemetry_history (
          machine_id, cpu_usage_pct, memory_used_bytes, memory_usage_pct,
          disk_used_bytes, disk_usage_pct, network_rx_bytes_sec, network_tx_bytes_sec,
          load_avg_1m, load_avg_5m, load_avg_15m, recorded_at
        ) VALUES (
          ${machine.machine_id}, ${finalCpuUsagePct}, ${Number(memory_used_bytes) || 0}, ${Number(memory_usage_pct) || 0},
          ${Number(disk_used_bytes) || 0}, ${Number(disk_usage_pct) || 0}, ${Number(network_rx_bytes_sec) || 0}, ${Number(network_tx_bytes_sec) || 0},
          ${Number(load_avg_1m) || 0}, ${Number(load_avg_5m) || 0}, ${Number(load_avg_15m) || 0}, ${validRecordedAt}
        )
        RETURNING *
      `;

      evaluateMachineAlerts(machine.machine_id, {
        machine_name: machine.name,
        hostname: hostname || machine.hostname,
        cpu_usage_pct: finalCpuUsagePct,
        memory_usage_pct: Number(memory_usage_pct) || 0,
        disk_usage_pct: Number(disk_usage_pct) || 0,
        load_avg_1m: Number(load_avg_1m) || 0,
        cpu_cores: Number(cpu_cores || machine.cpu_cores || 1),
        total_memory_bytes: Number(total_memory_bytes || machine.total_memory_bytes || 0),
        memory_used_bytes: Number(memory_used_bytes) || 0,
        total_disk_bytes: Number(total_disk_bytes || machine.total_disk_bytes || 0),
        disk_used_bytes: Number(disk_used_bytes) || 0,
        org_id: machine.org_id,
      }).catch(err => console.error("evaluateMachineAlerts error:", err));

      return { success: true, message: "Telemetry ingested successfully", telemetry_id: telemetry.id };
    } catch (err: any) {
      req.log.error(err, "Machine telemetry ingestion error");
      reply.status(500);
      return { success: false, error: err.message };
    }
  });

  // GET /api/machines/:id/telemetry - Historical time-series query
  app.get("/:id/telemetry", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { range = "1h" } = (req.query as { range?: string }) || {};

      // Check if machine has ever ingested telemetry heartbeats
      const [mCheck] = await sql`SELECT last_heartbeat_at FROM machines WHERE machine_id = ${id}`;
      if (!mCheck || !mCheck.last_heartbeat_at) {
        return { success: true, telemetry: [] };
      }

      let intervalSql = sql`INTERVAL '1 hour'`;
      if (range === "5m") intervalSql = sql`INTERVAL '5 minutes'`;
      else if (range === "15m") intervalSql = sql`INTERVAL '15 minutes'`;
      else if (range === "6h") intervalSql = sql`INTERVAL '6 hours'`;
      else if (range === "24h") intervalSql = sql`INTERVAL '24 hours'`;
      else if (range === "7d") intervalSql = sql`INTERVAL '7 days'`;

      let history = await sql`
        SELECT 
          recorded_at,
          cpu_usage_pct,
          memory_used_bytes,
          memory_usage_pct,
          disk_used_bytes,
          disk_usage_pct,
          network_rx_bytes_sec,
          network_tx_bytes_sec,
          load_avg_1m,
          load_avg_5m,
          load_avg_15m
        FROM machine_telemetry_history
        WHERE machine_id = ${id}
          AND recorded_at >= NOW() - ${intervalSql}
        ORDER BY recorded_at ASC
      `;

      if (history.length < 2) {
        history = await sql`
          SELECT 
            recorded_at,
            cpu_usage_pct,
            memory_used_bytes,
            memory_usage_pct,
            disk_used_bytes,
            disk_usage_pct,
            network_rx_bytes_sec,
            network_tx_bytes_sec,
            load_avg_1m,
            load_avg_5m,
            load_avg_15m
          FROM (
            SELECT * FROM machine_telemetry_history
            WHERE machine_id = ${id}
            ORDER BY recorded_at DESC
            LIMIT 30
          ) sub
          ORDER BY recorded_at ASC
        `;
      }

      return { success: true, telemetry: history };
    } catch (err: any) {
      req.log.error(err, "Fetch machine telemetry history error");
      reply.status(500);
      return { success: false, error: err.message };
    }
  });

  // GET /api/machines/alerts/rules - List machine alert rules
  app.get("/alerts/rules", async (req, reply) => {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS machine_alert_rules (
          rule_id VARCHAR(64) PRIMARY KEY,
          org_id VARCHAR(64),
          machine_id VARCHAR(64) DEFAULT '*',
          metric VARCHAR(32) NOT NULL,
          operator VARCHAR(8) DEFAULT '>',
          threshold_pct NUMERIC(5,2) NOT NULL,
          severity VARCHAR(32) DEFAULT 'warning',
          repeat_enabled BOOLEAN DEFAULT true,
          repeat_interval_mins INT DEFAULT 15,
          channel_ids JSONB DEFAULT '[]'::jsonb,
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE machine_alert_rules ADD COLUMN IF NOT EXISTS org_id VARCHAR(64)`;

      let userOrgId: string | null = null;
      try {
        const u = getUser(req);
        userOrgId = u?.org_id || null;
      } catch {}

      const rules = await sql`
        SELECT * FROM machine_alert_rules
        WHERE org_id IS NULL OR org_id = ${userOrgId}
        ORDER BY created_at DESC
      `;
      return { success: true, rules };
    } catch (err: any) {
      console.error("GET /alerts/rules error:", err);
      reply.status(500);
      return { success: false, error: err.message || "Failed to fetch rules" };
    }
  });

  // POST /api/machines/alerts/rules - Create alert rule
  app.post("/alerts/rules", async (req, reply) => {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS machine_alert_rules (
          rule_id VARCHAR(64) PRIMARY KEY,
          org_id VARCHAR(64),
          machine_id VARCHAR(64) DEFAULT '*',
          metric VARCHAR(32) NOT NULL,
          operator VARCHAR(8) DEFAULT '>',
          threshold_pct NUMERIC(5,2) NOT NULL,
          severity VARCHAR(32) DEFAULT 'warning',
          repeat_enabled BOOLEAN DEFAULT true,
          repeat_interval_mins INT DEFAULT 15,
          channel_ids JSONB DEFAULT '[]'::jsonb,
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE machine_alert_rules ADD COLUMN IF NOT EXISTS org_id VARCHAR(64)`;

      const { machine_id, metric, operator, threshold_pct, severity, repeat_enabled, repeat_interval_mins, channel_ids } = (req.body as any) || {};
      if (!metric || threshold_pct === undefined) {
        reply.status(400);
        return { success: false, error: "Metric and threshold_pct are required" };
      }

      let userOrgId: string | null = null;
      try {
        const u = getUser(req);
        userOrgId = u?.org_id || null;
      } catch {}

      const rule_id = "mrule_" + crypto.randomBytes(8).toString("hex");

      const [rule] = await sql`
        INSERT INTO machine_alert_rules (
          rule_id, org_id, machine_id, metric, operator, threshold_pct, severity,
          repeat_enabled, repeat_interval_mins, channel_ids, enabled
        ) VALUES (
          ${rule_id}, ${userOrgId}, ${machine_id || '*'}, ${metric}, ${operator || '>'}, ${Number(threshold_pct)}, ${severity || 'warning'},
          ${repeat_enabled !== false}, ${Number(repeat_interval_mins) || 15}, ${JSON.stringify(channel_ids || [])}::jsonb, true
        )
        RETURNING *
      `;

      return { success: true, rule };
    } catch (err: any) {
      reply.status(500);
      return { success: false, error: err.message };
    }
  });

  // DELETE /api/machines/alerts/rules/:id - Delete rule
  app.delete("/alerts/rules/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await sql`DELETE FROM machine_alert_rules WHERE rule_id = ${id}`;
      return { success: true, message: "Rule deleted" };
    } catch (err: any) {
      reply.status(500);
      return { success: false, error: err.message };
    }
  });

  // PATCH /api/machines/alerts/rules/:id - Toggle rule status
  app.patch("/alerts/rules/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { enabled } = (req.body as any) || {};
      const [updated] = await sql`
        UPDATE machine_alert_rules
        SET enabled = ${enabled !== false}
        WHERE rule_id = ${id}
        RETURNING *
      `;
      return { success: true, rule: updated };
    } catch (err: any) {
      reply.status(500);
      return { success: false, error: err.message };
    }
  });

  // POST /api/machines/alerts/test - Test dispatch alert
  app.post("/alerts/test", async (req, reply) => {
    try {
      const { channel_ids, machine_name } = (req.body as any) || {};

      let userOrgId: string | null = null;
      try {
        const u = getUser(req);
        userOrgId = u?.org_id || null;
      } catch {}

      if (!userOrgId) {
        const [defaultOrg] = await sql`SELECT org_id FROM organizations LIMIT 1`;
        userOrgId = defaultOrg?.org_id || null;
      }

      const hostLabel = machine_name || "prod-web-server-01";
      const testPayload = {
        event_type: "resource_threshold_exceeded",
        title: `⚡ TEST ALERT: Host '${hostLabel}' Resource Threshold Warning`,
        cluster_name: hostLabel,
        org_id: userOrgId,
        details: `This is a test notification from Srevox Machine Monitoring for host '${hostLabel}'. CPU utilization simulated at 88.5% (3.54 of 4 cores).`,
        channel_ids: channel_ids || [],
        severity: "warning",
      };

      await redis.publish("srevox:system_alerts", JSON.stringify(testPayload));
      return { success: true, message: "Test alert dispatched to configured notification channels" };
    } catch (err: any) {
      reply.status(500);
      return { success: false, error: err.message };
    }
  });
}
