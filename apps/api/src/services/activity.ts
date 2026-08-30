import { AsyncLocalStorage } from "async_hooks";
import sql from "../db/sql.js";
import { genId } from "../utils/id.js";

export const requestContainer = new AsyncLocalStorage<any>();

export interface CreateActivityParams {
  org_id: string;
  user_id: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  metadata?: Record<string, any>;
}

/**
 * Logs a new activity event to the centralized activity_log table.
 */
export async function logActivity({
  org_id,
  user_id,
  action,
  resource,
  resource_id,
  metadata = {}
}: CreateActivityParams) {
  // Extract request context (IP and User-Agent) from AsyncLocalStorage if available
  const req = requestContainer.getStore();
  if (req) {
    if (!metadata.ip) {
      const headers = req.headers || {};
      const isLoopbackIp = (ip: string) => {
        const clean = ip.replace(/^::ffff:/, "").trim();
        return clean === "127.0.0.1" || clean === "::1" || clean === "localhost" || clean === "0.0.0.0";
      };

      let realIp = "";
      const cfIp = headers["cf-connecting-ip"];
      const xRealIp = headers["x-real-ip"];
      const xForwardedFor = headers["x-forwarded-for"];

      if (cfIp && typeof cfIp === "string" && cfIp.trim() && !isLoopbackIp(cfIp.trim())) {
        realIp = cfIp.trim();
      } else if (xRealIp && typeof xRealIp === "string" && xRealIp.trim() && !isLoopbackIp(xRealIp.trim())) {
        realIp = xRealIp.trim();
      } else if (xForwardedFor && typeof xForwardedFor === "string") {
        const ips = xForwardedFor.split(",").map((i: string) => i.trim()).filter(Boolean);
        const nonLoopback = ips.find((ip: string) => !isLoopbackIp(ip));
        if (nonLoopback) realIp = nonLoopback;
        else if (ips.length > 0) realIp = ips[0];
      }

      if (!realIp && req.ip && typeof req.ip === "string" && !isLoopbackIp(req.ip)) {
        realIp = req.ip.replace(/^::ffff:/, "");
      }

      if (!realIp) {
        const hostHeader = headers["x-forwarded-host"] || headers["host"];
        if (hostHeader && typeof hostHeader === "string") {
          const cleanHost = hostHeader.split(":")[0].trim();
          if (cleanHost && !isLoopbackIp(cleanHost)) {
            realIp = cleanHost;
          }
        }
      }

      metadata.ip = realIp || (req.ip || "127.0.0.1").replace(/^::ffff:/, "");
    }
    if (!metadata.user_agent) {
      metadata.user_agent = req.headers ? (req.headers["user-agent"] || "Srevox Client") : "Srevox Client";
    }
  } else {
    if (!metadata.ip) metadata.ip = "127.0.0.1";
    if (!metadata.user_agent) metadata.user_agent = "Srevox Client";
  }

  // Forward to Rust activity microservice (main logger)
  const serviceUrl = process.env.ACTIVITY_SERVICE_URL || "http://localhost:5005";
  try {
    const res = await fetch(`${serviceUrl}/api/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id,
        user_id,
        action,
        resource,
        resource_id,
        metadata
      })
    });
    if (res.ok) {
      const data: any = await res.json();
      return {
        activity_log_id: data.activity_log_id,
        created_at: new Date().toISOString()
      };
    }
  } catch (err: any) {
    console.warn("[logActivity] Failed to forward activity to Rust service, using fallback local insert:", err.message || err);
  }

  // Fallback to local insert if Rust service is offline (to avoid losing logs)
  const fallbackId = genId("act");
  const [log] = await sql`
    INSERT INTO activity_log (activity_log_id, org_id, user_id, action, resource, resource_id, metadata)
    VALUES (${fallbackId}, ${org_id}, ${user_id}, ${action}, ${resource || null}, ${resource_id || null}, ${JSON.stringify(metadata)})
    RETURNING activity_log_id, created_at
  `;

  return log;
}

/**
 * Fetches activity logs matching the organization and optional resource filters.
 */
export async function fetchActivities(org_id: string, filters: {
  resource?: string | null;
  resource_id?: string | null;
  action?: string | null;
  limit?: number;
  offset?: number;
} = {}) {
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  return await sql`
    SELECT 
      al.activity_log_id,
      al.org_id,
      al.user_id,
      al.action,
      al.resource,
      al.resource_id,
      al.metadata,
      al.created_at,
      u.full_name as user_name,
      u.email      as user_email
    FROM activity_log al
    LEFT JOIN users u ON al.user_id = u.user_id
    WHERE al.org_id = ${org_id}
      AND (${filters.resource ?? null}::text IS NULL OR al.resource = ${filters.resource ?? null})
      AND (${filters.resource_id ?? null}::text IS NULL OR al.resource_id = ${filters.resource_id ?? null})
      AND (${filters.action ?? null}::text IS NULL OR al.action = ${filters.action ?? null})
    ORDER BY al.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}
