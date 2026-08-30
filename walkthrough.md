# Walkthrough - Rust Activity Audit Service & Page View Auditing

We have built and integrated the new Rust activity tracing service, securing it behind password prompts, RBAC permissions, and adding view/modify hooks.

## Changes Made

### 1. Created Rust Activity Service (`apps/activity-service`)
- **Cargo Config**: Added [Cargo.toml](file:///Users/akshatkumarsaini/Downloads/srevox/apps/activity-service/Cargo.toml) defining dependencies (Axum, sqlx postgres, jsonwebtoken, serde).
- **Core Server**: Built [main.rs](file:///Users/akshatkumarsaini/Downloads/srevox/apps/activity-service/src/main.rs) with:
  - `POST /api/activities`: Stores new logs in the shared `activity_log` table.
  - `GET /api/activities`: Queries logs using filters (user, group, time duration, search keyword) and validates JWT token signature. Added dynamic support to filter by individual `activity_id` query parameter for detail pages.
  - `DELETE /api/activities`: Supports bulk deleting selected logs or clearing the entire organization's ledger (`clear_all: true`).
  - JWT Claims extraction verifying that `scope: "sudo"` is active (requiring a password unlock).
  - Exclusively reads individual `POSTGRES_` environment connection parameters from `.env` to connect to Postgres, matching the setup used by the Node API and alert worker.
  - Listen port is bound dynamically via `ACTIVITY_PORT` (defaulting to `5005` to avoid port `5000` AirPlay conflicts on macOS Monterey and later).
  - Automatically filters out self-access views (`action != 'view_audit_logs_settings'`) from queries. This prevents the view table from being cluttered with redundant log accesses or loops on page refresh/reload.
- **Structured Activity IDs**:
  - Implemented an LCG-based random character string generator prefixing IDs with `act` (e.g. `actjk4bnhrb`). These are explicitly passed during insert statements, overriding the database-wide generic UUID default.
- **Environment Separation**:
  - Created a local [apps/activity-service/.env](file:///Users/akshatkumarsaini/Downloads/srevox/apps/activity-service/.env) file prepopulated with the exact DB and secret configurations matching the Node API (`apps/api/.env`), resolving connection details on custom IPs (e.g. `16.16.75.48`).
  - Added parent/neighboring `/apps/api/.env` checks fallback to prevent any database connection configuration drift.
- **Docker Integration**:
  - Created [apps/activity-service/Dockerfile](file:///Users/akshatkumarsaini/Downloads/srevox/apps/activity-service/Dockerfile) using a multi-stage compilation flow to compile the release binary in `rust:1-slim` (to support dependencies utilizing the latest stable Rust compiler versions like 1.88+) and run in a minimal `debian:bookworm-slim` container.
  - Created [apps/activity-service/.dockerignore](file:///Users/akshatkumarsaini/Downloads/srevox/apps/activity-service/.dockerignore) to optimize build contexts.

### 2. Updated API Backend & Schema (`apps/api` & Database)
- **Password Verification**: Added a `POST /api/auth/verify-password` route inside [auth.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/api/src/routes/auth.ts) returning a 15-minute token with `"scope": "sudo"` on success.
- **Log Propagation**: Modified [activity.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/api/src/services/activity.ts) so that backend-originated modifications (such as editing service owners) are mirrored to the Rust service asynchronously.
- **Retention Database Tables**:
  - Registered `retention_policies` table inside [apps/api/src/index.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/api/src/index.ts) migrations and the local docker postgres [init.sql](file:///Users/akshatkumarsaini/infra/docker/postgres/init.sql) schema definition.
  - Registered `retention_runs` table inside [apps/api/src/index.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/api/src/index.ts) database migrations to record the history, completed timestamps, and purged items counts for background daemon sweeps.
- **Retention Settings Endpoints**:
  - Added `GET /api/preferences/retention` and `PUT /api/preferences/retention` (admin-only) inside [preferences.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/api/src/routes/preferences.ts) to retrieve and update log retention configurations organization-wide, returning the sweeper execution history logs as part of the payload.
- **Optimized Centralized Activity Logging**:
  - Updated the logging controller [activity.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/api/src/services/activity.ts) inside the API backend to delegate log creation directly to the Rust microservice rather than performing a duplicate local SQL write. This resolves double-creation issues and ensures all logs have the standard, unified `act` prefixed ID structure.

### 3. Integrated Frontend Dashboard & UI (`apps/frontend`)
- **Settings Sidebar Layout Re-organization**:
  - Added "Audit Logs" navigation item with custom permission checking inside [layout.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/settings/layout.tsx).
  - Added **More Settings** navigation item pointing to `/settings/more-settings` (restricted to administrators) at the bottom of the settings panel sidebar inside [layout.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/settings/layout.tsx), as its own separate group block separated by a horizontal line divider.
  - Moved **Organization** configuration from Workspace Management into the **Advanced Settings** group block in the sidebar.
  - Moved **Platform Update** configuration below the Retention tabs inside `/settings/more-settings` sub-sidebar block layout.
- **Reduced Sidebar Section Spacing**:
  - Decreased layout vertical gaps inside [layout.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/settings/layout.tsx) sidebar flex container to `gap-3.5` (from `gap-5`) and optimized line divider margins to `mt-[-8px] mb-1.5` to make navigation spacing more compact.
- **Dynamic Sidebar Stacking for More Settings**:
  - Updated [layout.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/settings/layout.tsx) to detect the `/settings/more-settings` route.
  - When active, the standard Settings Sidebar is completely replaced with a custom **More Settings Sidebar** containing links for **Audit Logs Retention** & **Incident Retention** (grouped under *Data Retention Policies*), **Platform Update** (grouped under *System*), and **API Documentation** (grouped under *Developer Resources*), separated by horizontal divider lines.
  - Cleanly removed any exit links from this sidebar to allow seamless, native sidebar options presentation.
- **Auto Default Selected Tab**:
  - Standardized search param checks so that visiting `/settings/more-settings` without parameters automatically selects and highlights the first sub-tab `"Audit Logs Retention"` inside the left sidebar, ensuring navigation states stay synchronized.
- **Top Right Navigation Redirect**:
  - Programmed the layout's header control button dynamically inside [layout.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/settings/layout.tsx).
  - When visiting `/settings/more-settings`, the generic "Back to Dashboard" is replaced with an elegant **Back to Settings** button linking back to `/settings/profile`.
- **Security Check UI**: Implemented [page.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/settings/activity/page.tsx) that blocks rendering and requests user password via a verification prompt.
- **Password Session Sudo Mode Persistence**:
  - Programmed the verification prompter inside [page.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/settings/activity/page.tsx) to write token credentials into `sessionStorage`. This allows active sudo sessions to survive manual page reloads and refreshes without requiring the user to re-enter their password immediately.
- **5-Minute Inactivity Idle Auto-Lock**:
  - Installed window event hooks inside [page.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/settings/activity/page.tsx) capturing movements (`mousemove`, `mousedown`, `keypress`, `scroll`, `touchstart`). If no user interactions occur for 5 consecutive minutes (300,000ms), the token is wiped, the session locks, and the password prompter modal re-triggers automatically.
- **Manual Logs & Dashboard Reload Toast Notification**:
  - Added support inside [page.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/settings/activity/page.tsx) to show a success toast confirmation message ("Audit logs reloaded - The activity ledger was successfully updated.") when clicking the "Reload logs" header action.
  - Added support inside [page.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/dashboard/page.tsx) to show a success toast confirmation message ("Dashboard refreshed - Your overview widgets were updated successfully.") when manually clicking the "Refresh" button in the dashboard page.
- **Polished User-Facing Errors**:
  - Replaced technical connection failure error messages ("Failed to communicate with Rust audit service.") with friendly, non-technical text: "Failed to retrieve audit activity logs. Please try again later."
- **Permission RBAC Matrix**: Registered `viewActivityLog` permission inside [auth.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/lib/auth.ts) and the management checklists.
- **Page-View Audit Traces**:
  - Wired page load triggers inside services lists page, service details page, **Overview Dashboard page**, and **Incidents table list page** to post audit trails.
- **Infinite Rendering Loop Prevention**: Changed the auditing hook dependency array to `[]` in the Next.js code to ensure a page view is logged exactly once on mount, rather than triggering on every re-render.
- **Human-Friendly Logging Details & Badges**:
  - Formatted raw action IDs into friendly pill-badges (e.g. `Service Registered`, `Service Config Updated`, `Owner Assigned/Unassigned`, `Alert Dispatched`).
  - Designed metadata display formatting that translates raw JSON objects into explicit summaries (diffs for updates, named labels for targets, paths for views, and key-value pills).
  - Resolved and translated raw User IDs in metadata changes and properties into fully legible displays like `"Full Name (email@srevox.local)"` rather than displaying raw IDs.
- **Bulk Delete Options & Password Dialog Verification**:
  - Implemented checkboxes with **Select All** header control.
  - Added **Delete Selected** (active when items are checked) and **Clear All Logs** buttons.
  - Intercepted delete actions to show a warning modal requiring password verification to ensure authorization.
- **Interactive Sliding Detail Drawer & Inspect Link**:
  - Enabled row clicks to slide open an inspector drawer on the right showing comprehensive log details, formatted meta diffs, and raw JSON.
  - Styled the drawer's header close button with standardized border and hover colors to perfectly align layout visuals with the application's other slide-over sidebars.
  - Added dynamic **Split Action Option Buttons** inside the drawer footer:
    - **Inspect Location**: Navigates the admin directly to the relevant dashboard/services page.
    - **View Full Details**: Routes the user to a dedicated detailed page for that particular activity log.
  - Aligned all dark-mode border opacity styles with standard Tailwind configuration values (`dark:border-slate-800/80` and `dark:border-slate-800/50`), fully removing the white outline on the Target Resource card box.
  - Added click-outside-to-close behavior so clicking anywhere on the backdrop outside the drawer instantly dismisses it.
- **Dedicated Activity Detail Page**:
  - Created a dynamic details page at `/settings/activity/[id]` ([page.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/settings/activity/[id]/page.tsx)) that fetches details for the individual log using `activity_id` query parameters.
  - Displays user identity metadata card, client IP address context, timeline information, property/diff logs, and raw copyable JSON payload.
  - Rendered using a **full-width structure** (`w-full`) to match the width configuration of all settings tabs.
  - Added the **Active Development Notice Alert Banner** to the top of the detail page context to keep users informed that this is under beta testing and scheduled for future layout improvements.
- **Cleaned redundant header controls**:
  - Removed the duplicate "Advanced Settings" button link pointing to `/settings/more-settings` from the header of the Audit Logs list page, keeping the header clean.
- **Active Development Banner Alert**:
  - Rendered a premium warning alert banner underneath the header, notifying administrators that the Audit Activity feature is currently in active development (Beta) and that further stability optimizations and fixes are scheduled in upcoming updates.
- **More Settings Page (`/settings/more-settings`)**:
  - Created a dedicated page at [page.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/app/settings/more-settings/page.tsx) with **full-width cards** styled identically to other settings views.
  - Dynamically loads tab views based on URL parameter (`?tab=`) queried from the left settings panel sidebar:
    - **Audit Logs Retention**: Option to configure logs retention with custom numeric days input.
    - **Incident Retention**: Option to configure incidents retention with custom numeric days input.
    - **Platform Update**: Dynamic section querying the latest deployment version, showing a code-copy terminal button for self-hosted updates.
    - **API Documentation**: Comprehensive Srevox API Reference guide detailing request models, parameters, methods, and response payloads. Includes a custom notice banner explaining that this is a partial release and that additional endpoints will be documented in later updates.
  - Implemented a **Sweep Execution Status Panel** showing key statistics for logs/incidents and a **Cleanup Logs History Table** showing the chronological record of completed background sweeper runs and success indicators.
- **Portal Dom Rendering (Stacking Context Fixes)**:
  - Bound both the password authorization dialog modal and the sliding activity detail drawer inside React `createPortal` targeting `document.body`. This guarantees they render cleanly at the root level, bypassing any parent container layout restriction, overflow clips, or page-header alignment squeezing.
- **Update Announcement Links Fix**:
  - Updated both layout references inside [UpdateAnnouncement.tsx](file:///Users/akshatkumarsaini/components/UpdateAnnouncement.tsx) from `/settings/update` to target the new `/settings/more-settings?tab=update` route, preventing a 404 route error when clicking the notification button triggers.
- **Alert Channel Form Validation**:
  - Added rigorous client-side format validation to the SMTP/Email channel fields inside both [AddModal.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/components/channels/AddModal.tsx) and [EditModal.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/components/channels/EditModal.tsx) to catch configuration errors (such as invalid recipient emails like `no`) before they are submitted.
- **Improved Alert Channel Form Configuration Flow**:
  - Configured [EditModal.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/components/channels/EditModal.tsx) to hide the static `Recipient Emails` field when editing an existing Mail alert channel, since by default crash notifications use the Service Owners' emails dynamically configured on the Service details page.
  - Added an informative info alert block explaining Srevox's default routing behavior inside the channel edit form.
- **Synchronized Service Forms**:
  - Updated the service creation modal [AddModal.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/components/services/AddModal.tsx) to feature the exact same **Email Routing Settings** fields (Sender Channel, CC Recipients, and BCC Recipients) as the edit service modal [EditModal.tsx](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/src/components/services/EditModal.tsx), ensuring consistency.

### 4. Background Purge Task Scheduler (`apps/alert-worker`)
- **Automated Sweep Daemon**:
  - Created a daily purge daemon inside the background server [index.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/alert-worker/src/index.ts) that checks and clears expired activity logs and incidents matching retention configurations (runs on boot and every 4 hours automatically).
  - Records every execution run, its target configuration, and purged row counts into `retention_runs` database table logs.
- **Robust Mail Alert Handlers**:
  - Configured `rejectUnauthorized: false` TLS settings inside [email.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/alert-worker/src/senders/email.ts) and [channels.ts](file:///Users/akshatkumarsaini/Downloads/srevox/apps/alert-worker/src/senders/channels.ts) to handle internal self-signed corporate SMTP servers cleanly without certificate chain exceptions.

### 5. Release, Build, & Deployment Configuration
- **Docker Compose**: Registered `activity` service in [docker-compose.yml](file:///Users/akshatkumarsaini/Downloads/srevox/docker-compose.yml) under the `akshatsaini08/srevox-activity:latest` image and wired it to `frontend` with environment configurations.
- **Release Version Bump Script**: Modified [bump-version.js](file:///Users/akshatkumarsaini/Downloads/srevox/bump-version.js) to automate search & replacement of package version inside `apps/activity-service/Cargo.toml` in tandem with Node services.
- **GitHub Actions Integration**: Added the `Build & Push Activity Service` build step to the tag release workflow [.github/workflows/docker.yml](file:///Users/akshatkumarsaini/Downloads/srevox/.github/workflows/docker.yml) to automatically compile and distribute the Rust service to GHCR and Docker Hub.
- **Git Ignore Optimizations**: Added `**/target/` and `**/Cargo.lock` patterns to [.gitignore](file:///Users/akshatkumarsaini/Downloads/srevox/.gitignore) and cleanly removed 6,570+ previously committed build object files from git tracking cache, keeping the git status commands instantaneous.
- **Next.js Standalone Runtime Proxy Support**:
  - Configured build arguments and variables (`ACTIVITY_SERVICE_URL=http://activity:5005`) inside [Dockerfile](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/Dockerfile).
  - Modified [entrypoint.sh](file:///Users/akshatkumarsaini/Downloads/srevox/apps/frontend/entrypoint.sh) to substitute build-time `http://activity:5005` endpoints with runtime values on container startup, eliminating localhost resolution bugs in Next.js standalone container environments.

### 6. Mail-Alert Routing System & Channel Management
- **SMTP Channel Types & Management**:
  - Implemented standard and `Service Owner` channel types to secure email settings.
  - Redesigned the channel creation modal to follow a dynamic selection workflow: no channel type is pre-selected. Selecting a type like Email or WhatsApp triggers secondary sub-options (Normal vs Service Owner for Email, Twilio vs Meta for WhatsApp). The credentials form renders dynamically underneath only once a sub-option is selected. Removed the "Set as Global Default" checkbox from channel creation/edit modals.
  - Added pausing/activation mechanisms for mail channels with warning banners on pausing dependent services.
  - Set up fallback CC and BCC fields inside the Organization configuration page. The default sender channel configuration now shows exclusively `Service Owner`-type email channels. If no channels exist, it displays a button to redirect to the channels page. If exactly one channel exists, it auto-selects and displays it as static text (hiding the "None" option) with an "Add" button linking to `/settings/channels`. If multiple channels exist, it renders a dropdown select (without "None") and an "Add" button linking to `/settings/channels`. All channel creation is performed on the channels page.
- **Service Owners Dynamic Routing**:
  - Added fields for Sender Channel, CC, and BCC lists to service assignments page. The Sender Channel selection uses a conditional layout based on the number of configured `Service Owner` email channels (0 channels redirects to channels page, 1 channel displays static name text, 2+ channels displays select dropdown without "None"), ensuring a fallback to channels configuration redirect for all creations.
  - Built an expandable CC/BCC Quick-Insert dropdown for Teams, RBAC Groups, Users, and raw email addresses.
  - Designed an interactive, responsive **Live Routing Preview** panel directly in the configuration drawer.
- **De-duplicating Recipient Expansion**:
  - Added server-side recursion and email extraction algorithms inside the alert worker, expanding custom notification groups and RBAC group members into distinct emails.
  - Suppressed duplicate emails at send time, supporting clean SMTP mail routing.
- **Global Settings Fallback Prefilling**:
  - Updated the service creation and editing configuration flow so that if Global Default CC or BCC settings are configured, they are dynamically prefilled into the Service Owner's `alert_cc` and `alert_bcc` input fields upon creation or when editing a service that does not override them, ensuring smooth defaults behavior.

## Verification Results

- **Rust Microservice**: Compiles successfully with `cargo check`.
- **Node API**: Compiles successfully with `npx tsc --noEmit`.
- **Frontend Workspace**: Compiles successfully with `npm run type-check`.
- **Alert Worker Workspace**: Compiles successfully with `npx tsc --noEmit`.
