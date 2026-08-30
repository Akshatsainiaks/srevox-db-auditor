import { FastifyRequest, FastifyReply } from "fastify";
import sql from "../db/sql.js";

export interface JWTPayload {
  sub:    string;
  org_id: string;
  role:   string;
  email:  string;
}

// Extract JWT payload from request
export function getUser(req: FastifyRequest): JWTPayload {
  return req.user as JWTPayload;
}

// Role hierarchy
const ROLE_RANK: Record<string, number> = {
  viewer: 1,
  member: 2,
  admin:  3,
};

// Require minimum role — use as onRequest hook
export function requireRole(minRole: "viewer" | "member" | "admin") {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as JWTPayload;
    if (!user) return reply.status(401).send({ detail: "Unauthorized" });
    const userRank = ROLE_RANK[user.role] ?? 0;
    const minRank  = ROLE_RANK[minRole]  ?? 99;
    if (userRank < minRank) {
      return reply.status(403).send({
        detail: `Requires ${minRole} role. Your role: ${user.role}`,
      });
    }
  };
}

// Permission matrix
export const CAN = {
  // Incidents
  viewIncidents:      ["viewer", "member", "admin"],
  acknowledgeIncident:["member", "admin"],
  resolveIncident:    ["member", "admin"],
  runDiagnosis:       ["member", "admin"],
  deleteIncident:     ["admin"],

  // Clusters
  viewClusters:   ["viewer", "member", "admin"],
  addCluster:     ["admin"],
  deleteCluster:  ["admin"],

  // Channels
  viewChannels:   ["viewer", "member", "admin"],
  addChannel:     ["admin"],
  deleteChannel:  ["admin"],
  testChannel:    ["member", "admin"],

  // Alert Rules
  viewRules:      ["viewer", "member", "admin"],
  addRule:        ["admin"],
  deleteRule:     ["admin"],
  toggleRule:     ["member", "admin"],

  // Team / Users
  viewTeam:       ["member", "admin"],
  inviteUser:     ["admin"],
  removeUser:     ["admin"],
  changeRole:     ["admin"],

  // Service Owners
  viewServiceOwners:   ["viewer", "member", "admin"],
  addServiceOwner:     ["admin"],
  deleteServiceOwner:  ["admin"],

  // Analytics
  viewAnalytics:  ["admin"],
  viewActivityLog: ["admin"],

  // Machines & Host Nodes
  viewMachines:   ["viewer", "member", "admin"],
  addMachine:     ["admin"],
  deleteMachine:  ["admin"],

  // More Settings
  changeSudoLock: ["admin"],
  changeRetention: ["admin"],
  systemAlerts: ["admin"],
  viewApiDocs: ["viewer", "member", "admin"],
};

export const PERMISSION_IDS: Record<string, { categoryId: string; id: string }> = {
  // Incidents (Category: "inci3hbr43hb")
  viewIncidents:       { categoryId: "inci3hbr43hb", id: "vie3jrhb4r" },
  acknowledgeIncident: { categoryId: "inci3hbr43hb", id: "ack4rnf4jbf" },
  resolveIncident:     { categoryId: "inci3hbr43hb", id: "res34f4hfb" },
  runDiagnosis:        { categoryId: "inci3hbr43hb", id: "run45g4hfb" },
  deleteIncident:      { categoryId: "inci3hbr43hb", id: "del56h4hfb" },

  // Clusters (Category: "clu4rhbrhb")
  viewClusters:        { categoryId: "clu4rhbrhb", id: "vie45g4hfb" },
  addCluster:          { categoryId: "clu4rhbrhb", id: "add56h4hfb" },
  deleteCluster:       { categoryId: "clu4rhbrhb", id: "del67i4hfb" },

  // Machines (Category: "mac90l4hfb")
  viewMachines:        { categoryId: "mac90l4hfb", id: "vie01mac" },
  addMachine:          { categoryId: "mac90l4hfb", id: "add02mac" },
  deleteMachine:       { categoryId: "mac90l4hfb", id: "del03mac" },

  // Channels (Category: "cha56h4hfb")
  viewChannels:        { categoryId: "cha56h4hfb", id: "vie56h4hfb" },
  addChannel:          { categoryId: "cha56h4hfb", id: "add67i4hfb" },
  deleteChannel:       { categoryId: "cha56h4hfb", id: "del78j4hfb" },
  testChannel:         { categoryId: "cha56h4hfb", id: "tes89k4hfb" },

  // Alert Rules (Category: "rul67i4hfb")
  viewRules:           { categoryId: "rul67i4hfb", id: "vie67i4hfb" },
  addRule:             { categoryId: "rul67i4hfb", id: "add78j4hfb" },
  deleteRule:          { categoryId: "rul67i4hfb", id: "del89k4hfb" },
  toggleRule:          { categoryId: "rul67i4hfb", id: "tog90l4hfb" },

  // Team / Access Control (Category: "tea78j4hfb")
  viewTeam:            { categoryId: "tea78j4hfb", id: "vie78j4hfb" },
  inviteUser:          { categoryId: "tea78j4hfb", id: "inv89k4hfb" },
  removeUser:          { categoryId: "tea78j4hfb", id: "rem90l4hfb" },
  changeRole:          { categoryId: "tea78j4hfb", id: "cha01m4hfb" },
  changeSudoLock:      { categoryId: "tea78j4hfb", id: "sud90l4hfb" },
  viewApiDocs:         { categoryId: "tea78j4hfb", id: "api90l4hfb" },

  // Service Owners (Category: "own89k4hfb")
  viewServiceOwners:   { categoryId: "own89k4hfb", id: "vie02n4hfb" },
  addServiceOwner:     { categoryId: "own89k4hfb", id: "add03o4hfb" },
  deleteServiceOwner:  { categoryId: "own89k4hfb", id: "del04p4hfb" },

  // Analytics (Category: "ana89k4hfb")
  viewAnalytics:       { categoryId: "ana89k4hfb", id: "vie89k4hfb" },
  viewActivityLog:     { categoryId: "ana89k4hfb", id: "vie90l4hfb" },
  changeRetention:     { categoryId: "ana89k4hfb", id: "ret90l4hfb" },
  systemAlerts:        { categoryId: "ana89k4hfb", id: "sys90l4hfb" },
};

export function hasPermission(role: string, action: keyof typeof CAN): boolean {
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
    // If no specific resourceId is passed, check if the user has the global permission OR any specific resource true
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

  return params.id || params.cluster_id || params.channel_id || params.rule_id ||
         query.cluster_id || query.channel_id || query.rule_id ||
         body.cluster_id || body.channel_id || body.rule_id;
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

// Require permission — check DB custom overrides, fallback to role defaults
export function requirePermission(action: keyof typeof CAN) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as JWTPayload;
    if (!user) return reply.status(401).send({ detail: "Unauthorized" });

    try {
      const [dbUser] = await sql`
        SELECT role, permissions FROM users WHERE user_id = ${user.sub} AND is_active = true
      `;
      if (!dbUser) {
        return reply.status(401).send({ detail: "User session is invalid or inactive — please log in again" });
      }

      // Fetch group permissions
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