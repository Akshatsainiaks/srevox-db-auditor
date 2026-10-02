import { FastifyRequest, FastifyReply } from "fastify";
import sql from "../db/sql.js";

export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  org_id: string;
  type?: string;
}

export function getUser(req: FastifyRequest): JWTPayload {
  return (req.user as JWTPayload) || { sub: "", email: "", role: "viewer", org_id: "" };
}

export function requireRole(allowedRoles: string | string[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(req);
    if (!user || !user.role) {
      return reply.status(401).send({ detail: "Unauthorized" });
    }
    if (user.role?.toLowerCase() === "admin") return; // Admin bypass
    if (!roles.includes(user.role)) {
      return reply.status(403).send({ detail: "Forbidden: insufficient permissions" });
    }
  };
}

// Permission matrix aligning with DB Auditor capabilities
export const CAN = {
  // Database Connectors & CDC Streams
  viewConnectors:      ["viewer", "member", "auditor", "admin"],
  addConnector:        ["admin"],
  deleteConnector:     ["admin"],
  testConnector:       ["member", "auditor", "admin"],
  viewStream:          ["viewer", "member", "auditor", "admin"],

  // Audit Ledgers & Row Diffs
  viewRowDiff:         ["member", "auditor", "admin"],
  viewPii:             ["auditor", "admin"],
  exportAudit:         ["auditor", "admin"],
  purgeAudit:          ["admin"],

  // Data Retention & Storage
  changeRetention:     ["admin"],
  clearRetentionHistory:["admin"],

  // Masking & Compliance Rules
  viewMaskingRules:    ["viewer", "member", "auditor", "admin"],
  manageMaskingRules:  ["admin"],

  // Notification Channels & Alert Preferences
  viewChannels:        ["viewer", "member", "auditor", "admin"],
  addChannel:          ["admin"],
  deleteChannel:       ["admin"],
  testChannel:         ["member", "auditor", "admin"],

  // Team / Access Control
  viewTeam:            ["member", "auditor", "admin"],
  inviteUser:          ["admin"],
  removeUser:          ["admin"],
  changeRole:          ["admin"],
  changeSudoLock:      ["admin"],
  viewApiDocs:         ["viewer", "member", "auditor", "admin"],

  // Analytics & Activity Logs
  viewAnalytics:       ["auditor", "admin"],
  viewActivityLog:     ["auditor", "admin"],

  // Backward-compatible aliases
  viewIncidents:       ["viewer", "member", "auditor", "admin"],
  acknowledgeIncident: ["member", "auditor", "admin"],
  resolveIncident:     ["member", "auditor", "admin"],
  runDiagnosis:        ["member", "auditor", "admin"],
  deleteIncident:      ["admin"],
  viewClusters:        ["viewer", "member", "auditor", "admin"],
  addCluster:          ["admin"],
  deleteCluster:       ["admin"],
  viewRules:           ["viewer", "member", "auditor", "admin"],
  addRule:             ["admin"],
  deleteRule:          ["admin"],
  toggleRule:          ["member", "auditor", "admin"],
  viewServiceOwners:   ["viewer", "member", "auditor", "admin"],
  addServiceOwner:     ["admin"],
  deleteServiceOwner:  ["admin"],
  viewMachines:        ["viewer", "member", "auditor", "admin"],
  addMachine:          ["admin"],
  deleteMachine:       ["admin"],
};

export const PERMISSION_IDS: Record<string, { categoryId: string; id: string }> = {
  // Database Connectors (Category: "cat_connectors")
  viewConnectors:       { categoryId: "cat_connectors", id: "dbc_view" },
  addConnector:         { categoryId: "cat_connectors", id: "dbc_add" },
  deleteConnector:      { categoryId: "cat_connectors", id: "dbc_del" },
  testConnector:        { categoryId: "cat_connectors", id: "dbc_test" },
  viewStream:           { categoryId: "cat_connectors", id: "dbc_stream" },

  // Audit Ledgers & Row Diffs (Category: "cat_audit")
  viewRowDiff:          { categoryId: "cat_audit", id: "aud_diff" },
  viewPii:              { categoryId: "cat_audit", id: "aud_pii" },
  exportAudit:          { categoryId: "cat_audit", id: "aud_export" },
  purgeAudit:           { categoryId: "cat_audit", id: "aud_purge" },

  // Data Retention & Storage (Category: "cat_retention")
  changeRetention:      { categoryId: "cat_retention", id: "ret_change" },
  clearRetentionHistory:{ categoryId: "cat_retention", id: "ret_clear" },

  // Masking & Compliance Rules (Category: "cat_masking")
  viewMaskingRules:     { categoryId: "cat_masking", id: "msk_view" },
  manageMaskingRules:   { categoryId: "cat_masking", id: "msk_edit" },

  // Channels (Category: "cat_channels")
  viewChannels:         { categoryId: "cat_channels", id: "cha_view" },
  addChannel:           { categoryId: "cat_channels", id: "cha_add" },
  deleteChannel:        { categoryId: "cat_channels", id: "cha_del" },
  testChannel:          { categoryId: "cat_channels", id: "cha_test" },

  // Team / Access Control (Category: "cat_team")
  viewTeam:             { categoryId: "cat_team", id: "tea_view" },
  inviteUser:           { categoryId: "cat_team", id: "tea_invite" },
  removeUser:           { categoryId: "cat_team", id: "tea_remove" },
  changeRole:           { categoryId: "cat_team", id: "tea_role" },
  changeSudoLock:       { categoryId: "cat_team", id: "tea_sudo" },
  viewApiDocs:          { categoryId: "cat_team", id: "tea_api" },

  // Analytics & Activity (Category: "cat_analytics")
  viewAnalytics:        { categoryId: "cat_analytics", id: "ana_view" },
  viewActivityLog:      { categoryId: "cat_analytics", id: "ana_logs" },
};

export function hasPermission(role: string, action: keyof typeof CAN): boolean {
  if (role === "admin") return true;
  return CAN[action]?.includes(role) ?? false;
}

export function checkPermissionsObject(permissions: any, action: string, resourceId?: string): boolean {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    return false;
  }

  const map = PERMISSION_IDS[action];
  if (!map) return false;

  const categoryArray = permissions[map.categoryId];
  if (!Array.isArray(categoryArray)) return false;

  const permObj = categoryArray.find((p: any) => p && typeof p === "object" && p.id === map.id);
  if (!permObj) return false;

  if (resourceId) {
    if (permObj.resources && Array.isArray(permObj.resources)) {
      const specificResource = permObj.resources.find((r: any) => r && r.id === resourceId);
      if (specificResource !== undefined) {
        return specificResource.value === true;
      }
      const wildcardResource = permObj.resources.find((r: any) => r && r.id === "*");
      if (wildcardResource !== undefined) {
        return wildcardResource.value === true;
      }
    }
  } else {
    if (permObj.value === true) return true;
    if (permObj.resources && Array.isArray(permObj.resources)) {
      if (permObj.resources.some((r: any) => r && r.value === true)) {
        return true;
      }
    }
    return false;
  }

  return permObj.value === true;
}

function getResourceId(req: FastifyRequest): string | undefined {
  const params = (req.params || {}) as Record<string, string>;
  const query = (req.query || {}) as Record<string, string>;
  const body = (req.body || {}) as Record<string, any>;

  return params.id || params.connector_id || params.channel_id ||
         query.connector_id || query.channel_id ||
         body.connector_id || body.channel_id;
}

export function mergePermissions(userPerms: any, groupsPerms: any[]): any {
  const merged: any = {};

  const mergeSingle = (perms: any) => {
    if (!perms || typeof perms !== "object" || Array.isArray(perms)) return;
    for (const [catId, arr] of Object.entries(perms)) {
      if (!Array.isArray(arr)) continue;
      if (!merged[catId]) merged[catId] = [];
      const mergedArr = merged[catId];
      for (const item of arr) {
        if (!item || typeof item !== "object" || !item.id) continue;
        let existing = mergedArr.find((p: any) => p && p.id === item.id);
        if (!existing) {
          existing = { id: item.id, value: false };
          mergedArr.push(existing);
        }
        if (item.value === true) {
          existing.value = true;
        }
        if (item.resources && Array.isArray(item.resources)) {
          if (!existing.resources) existing.resources = [];
          for (const res of item.resources) {
            if (!res || typeof res !== "object" || !res.id) continue;
            let existingRes = existing.resources.find((r: any) => r && r.id === res.id);
            if (!existingRes) {
              existingRes = { id: res.id, value: false };
              existing.resources.push(existingRes);
            }
            if (res.value === true) {
              existingRes.value = true;
            }
          }
        }
      }
    }
  };

  mergeSingle(userPerms);
  for (const gp of groupsPerms) {
    mergeSingle(gp);
  }
  return merged;
}

export function requirePermission(action: keyof typeof CAN) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as JWTPayload;
    if (!user) return reply.status(401).send({ detail: "Unauthorized" });

    // Universal Admin Bypass
    if (user.role === "admin") return;

    try {
      const [dbUser] = await sql`
        SELECT role, permissions FROM users WHERE user_id = ${user.sub} AND is_active = true
      `;
      if (!dbUser) {
        return reply.status(401).send({ detail: "User session is invalid or inactive — please log in again" });
      }

      if (dbUser.role?.toLowerCase() === "admin") return;

      const groupPermsList = await sql`
        SELECT g.permissions
        FROM groups g
        JOIN group_members gm ON g.group_id = gm.group_id
        WHERE gm.user_id = ${user.sub} AND g.org_id = ${user.org_id}
      `;

      const role = dbUser.role;
      const permissions = mergePermissions(dbUser.permissions, groupPermsList.map(g => g.permissions));

      const hasCustom = permissions && typeof permissions === "object" && !Array.isArray(permissions) && Object.keys(permissions).length > 0;

      if (hasCustom) {
        const resourceId = getResourceId(req);
        if (!checkPermissionsObject(permissions, action, resourceId)) {
          return reply.status(403).send({
            detail: `Permission denied. User does not have capability: ${action}${resourceId ? ` for resource ${resourceId}` : ""}`,
          });
        }
      } else {
        const allowedRoles = CAN[action] || [];
        if (!allowedRoles.includes(role)) {
          return reply.status(403).send({
            detail: `Permission denied. Role ${role} does not have capability: ${action}`,
          });
        }
      }
    } catch (err: any) {
      return reply.status(500).send({ detail: `Authorization error: ${err.message || err}` });
    }
  };
}
