import nodemailer from "nodemailer";
import type { CrashEvent } from "../types.js";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#DC2626",
  warning:  "#D97706",
  info:     "#2563EB",
};

export function formatTemplate(
  template: string,
  event: CrashEvent,
  incidentId: string,
  severity: string,
  clusterName: string,
  dashboardUrl: string
): string {
  return template
    .replace(/\{\{cluster_name\}\}/g, clusterName)
    .replace(/\{\{cluster\}\}/g, clusterName)
    .replace(/\{\{pod_name\}\}/g, event.pod_name)
    .replace(/\{\{pod\}\}/g, event.pod_name)
    .replace(/\{\{namespace\}\}/g, event.namespace)
    .replace(/\{\{container_name\}\}/g, event.container_name || "—")
    .replace(/\{\{container\}\}/g, event.container_name || "—")
    .replace(/\{\{crash_reason\}\}/g, event.crash_reason)
    .replace(/\{\{reason\}\}/g, event.crash_reason)
    .replace(/\{\{restart_count\}\}/g, String(event.restart_count))
    .replace(/\{\{restarts\}\}/g, String(event.restart_count))
    .replace(/\{\{detected_at\}\}/g, new Date(event.detected_at).toUTCString())
    .replace(/\{\{detected\}\}/g, new Date(event.detected_at).toUTCString())
    .replace(/\{\{severity\}\}/g, severity.toUpperCase())
    .replace(/\{\{incident_id\}\}/g, incidentId)
    .replace(/\{\{dashboard_url\}\}/g, dashboardUrl);
}

export async function sendEmail(
  config: Record<string, string>,
  event: CrashEvent,
  incidentId: string,
  severity: string,
  clusterName: string
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host:   config.smtp_host || "smtp.gmail.com",
    port:   Number(config.smtp_port || 587),
    secure: config.smtp_port === "465",
    auth:   { user: config.smtp_user, pass: config.smtp_pass },
    tls:    { rejectUnauthorized: false }
  });

  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.warning;
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/incidents/${incidentId}`;
  const recipients = (config.to || config.smtp_user).split(",").map((e) => e.trim());

  const subject = config.subject_template
    ? formatTemplate(config.subject_template, event, incidentId, severity, clusterName, dashboardUrl)
    : `[Srevox ${severity.toUpperCase()}] ${event.pod_name} crashed on cluster ${clusterName} — ${event.crash_reason}`;

  const headingText = config.message_template
    ? formatTemplate(config.message_template, event, incidentId, severity, clusterName, dashboardUrl)
    : `Pod Crash Detected — ${severity.toUpperCase()}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:${color};padding:24px 28px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">🔔</div>
        <div>
          <div style="color:rgba(255,255,255,0.85);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Srevox Alert</div>
          <div style="color:white;font-size:18px;font-weight:700;margin-top:2px;">${headingText}</div>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;">
        ${[
          ["Cluster",    clusterName],
          ["Pod",        event.pod_name],
          ["Namespace",  event.namespace],
          ["Container",  event.container_name || "—"],
          ["Reason",     event.crash_reason],
          ["Restarts",   event.restart_count],
          ["Detected",   new Date(event.detected_at).toUTCString()],
        ].map(([k, v]) => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:10px 0;color:#64748b;font-size:13px;width:100px;">${k}</td>
            <td style="padding:10px 0;color:#0f172a;font-size:13px;font-weight:600;">
              ${k === "Reason"
                ? `<span style="background:${color}15;color:${color};padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700;">${v}</span>`
                : v
              }
            </td>
          </tr>`).join("")}
      </table>

      <div style="margin-top:24px;text-align:center;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background:${color};color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
          View Incident & AI Diagnosis →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        <strong style="color:#6366f1;">Srevox</strong> — Catch crashes before your users do.
        <br>Incident ID: <code style="font-size:11px;">${incidentId}</code>
      </p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from:    `"Srevox Alerts" <${config.from || config.smtp_user}>`,
    to:      recipients.join(", "),
    cc:      config.cc || undefined,
    bcc:     config.bcc || undefined,
    subject,
    html,
  });

  console.log(`[email] Sent to ${recipients.join(", ")}${config.cc ? ' (CC: ' + config.cc + ')' : ''}${config.bcc ? ' (BCC: ' + config.bcc + ')' : ''}`);
}
