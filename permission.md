# Srevox Permissions Architecture: IDs, Keys, and Structure

This document explains the design, database schema, mapping mechanisms, and implementation flow of the custom permissions system in Srevox.

---

## 1. The Core Schema: Structure and JSON Shape

Custom user permissions are stored as overrides in a single `permissions` JSONB column in the `users` table. Instead of using human-readable developer keys directly (which are prone to renaming and leak internal semantics to the client), the system represents capabilities using static **Category IDs** and static **Permission IDs**.

### JSON Payload Example
```json
{
  "inci3hbr43hb": [
    { "id": "vie3jrhb4r", "value": true },
    { "id": "ack4rnf4jbf", "value": true }
  ],
  "rul67i4hfb": [
    {
      "id": "vie67i4hfb",
      "value": true,
      "resources": [
        { "id": "vie4h44hbvr", "value": false },
        { "id": "perm3rjhb32fb", "value": true }
      ]
    }
  ]
}
```

### Key Elements of the JSON Schema:
1. **Top-Level Keys (`Category IDs`)**: e.g., `"inci3hbr43hb"` (Incidents category) or `"rul67i4hfb"` (Alert Rules category).
2. **Category Arrays**: Each category ID maps to an array of permission capability items.
3. **Permission Items (`id` and `value`)**: Each item in the array has an `id` matching a specific capability (e.g. `"vie3jrhb4r"` for View Incidents) and a boolean `value` representing the global override state.
4. **Resource Overrides (`resources`)**: An optional nested array under a permission item. Each entry specifies a specific resource instance ID (e.g. a specific alert rule ID `"perm3rjhb32fb"`) and a boolean `value` override for just that instance.

---

## 2. Static ID-to-Key Mapping Table

To make the system developer-friendly, the code uses human-readable actions (e.g. `viewIncidents`, `toggleRule`) inside source code, but translates them to and from static IDs when communicating with the API or reading/writing to the database.

This mapping is defined in the `PERMISSION_IDS` dictionary:

```typescript
export const PERMISSION_IDS = {
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

  // Service Owners (Category: "own89k4hfb")
  manageServiceOwners: { categoryId: "own89k4hfb", id: "man01m4hfb" },

  // Analytics (Category: "ana89k4hfb")
  viewAnalytics:       { categoryId: "ana89k4hfb", id: "vie89k4hfb" },
};
```

---

## 3. How Verification and Authorization Work

### Backend RBAC Middleware ([rbac.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/api/src/middleware/rbac.ts))
When a route is protected (e.g. `requirePermission("viewRules")`):
1. **Role Defaults Fallback**: If the user's `permissions` record is an empty object `{}`, the middleware defaults to checking the user's base role rank against standard role permissions matrix (`CAN`).
2. **Custom Mapping Resolution**: If custom overrides exist, the middleware looks up `viewRules` in `PERMISSION_IDS` to retrieve category ID `rul67i4hfb` and permission ID `vie67i4hfb`.
3. **Array Retrieval**: It extracts the list of permission items under key `rul67i4hfb` from the user's permissions JSON object.
4. **Capability Matching**:
   - If the endpoint targets a specific resource (e.g., alert rule ID `perm3rjhb32fb`), the checker looks inside the `resources` array of `vie67i4hfb`. If a matching resource ID is found, its `value` is returned. If not found, it checks for a wildcard `*` override.
   - If no specific resource ID is passed, it returns `true` if either the global `value` is `true` OR if there is at least one resource override that evaluates to `true` (enabling page navigation/visibility).

### Frontend Authorization Utility ([auth.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/lib/auth.ts))
Client-side view permissions check (`hasPermission(user, "viewRules", ruleId)`) executes the identical resolution logic on the user context stored in `localStorage` to show or hide UI components and pages dynamically.

---

## 4. UI State Management and Saving Changes

Inside the Permissions Editor Drawer ([page.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/dashboard/permissions/page.tsx)):
- **Checkbox Checked State**:
  A capability checkbox is rendered as checked if:
  `drawerPermissions[categoryId]` has a permission item matching the target ID whose global `value === true` OR has any entry in its `resources` array where `value === true`.
- **Toggling On / Checking**:
  Sets the global `value: true` on the permission item inside its category array, and clears redundant `resources` overrides (since global true encompasses all rules).
- **Toggling Off / Unchecking**:
  Sets the global `value: false`. It loops through any existing resource overrides under `resources` and sets their values to `false` as well, preserving the specific IDs while deactivating them.
- **Saving**:
  Sends the updated JSON structure to `/api/users/:id/permissions` which validates the layout (ensuring only legitimate category and permission IDs are present) and updates the column.

---

## 5. Startup Data Normalization Migration

When Srevox starts up, it automatically executes migration scripts inside [index.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/api/src/index.ts). If an active user record contains legacy format data, it transforms the record into the Category/ID structure:
- Parses legacy action-key strings (e.g. `"viewTeam": true`).
- Performs resolution against the static mapping dictionary.
- Deconstructs nested resource maps into resource arrays.
- Saves the normalized object back to Postgres.
