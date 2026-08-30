import axios from "axios";
import type { CrashEvent } from "../types.js";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "attention",
  warning:  "warning",
  info:     "accent",
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

// ── Microsoft Teams ───────────────────────────────────────────────────────────
export async function sendTeams(
  config: Record<string, string>,
  event: CrashEvent,
  incidentId: string,
  severity: string,
  clusterName: string
): Promise<void> {
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/incidents/${incidentId}`;
  const webhookUrl = config.webhook_url || "";
  const isAdaptiveCard = webhookUrl.includes("logic.azure.com");

  let payload: any;

  if (isAdaptiveCard) {
    const color       = SEVERITY_COLORS[severity] || "warning";
    const rawCard = {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.4",
      body: [
        {
          type: "TextBlock",
          text: config.message_template
            ? formatTemplate(config.message_template, event, incidentId, severity, clusterName, dashboardUrl)
            : `🔔 Srevox [${clusterName}] — Pod Crash (${severity.toUpperCase()})`,
          weight: "Bolder",
          size: "Medium",
          color,
          wrap: true,
        },
        {
          type: "FactSet",
          facts: [
            { title: "Cluster",   value: clusterName },
            { title: "Pod",       value: event.pod_name },
            { title: "Namespace", value: event.namespace },
            { title: "Container", value: event.container_name || "—" },
            { title: "Reason",    value: event.crash_reason },
            { title: "Restarts",  value: String(event.restart_count) },
            { title: "Detected",  value: new Date(event.detected_at).toUTCString() },
          ],
        },
      ],
      actions: [{
        type: "Action.OpenUrl",
        title: "View Incident & AI Diagnosis",
        url: dashboardUrl,
      }],
    };

    payload = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: rawCard,
        },
      ],
    };
  } else {
    const hexColors: Record<string, string> = {
      critical: "d93838",
      warning:  "f0ad4e",
      info:     "337ab7",
    };
    const themeColor = hexColors[severity] || "f0ad4e";
    const cardTitle = config.message_template
      ? formatTemplate(config.message_template, event, incidentId, severity, clusterName, dashboardUrl)
      : `🔔 Srevox [${clusterName}] — Pod Crash (${severity.toUpperCase()})`;
    payload = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": themeColor,
      "summary": cardTitle,
      "title": cardTitle,
      "sections": [
        {
          "activityTitle": `Pod crash event details`,
          "facts": [
            { "name": "Cluster",   "value": clusterName },
            { "name": "Pod",       "value": event.pod_name },
            { "name": "Namespace", "value": event.namespace },
            { "name": "Container", "value": event.container_name || "—" },
            { "name": "Reason",    "value": event.crash_reason },
            { "name": "Restarts",  "value": String(event.restart_count) },
            { "name": "Detected",  "value": new Date(event.detected_at).toUTCString() },
          ],
          "markdown": true
        }
      ],
      "potentialAction": [
        {
          "@type": "OpenUri",
          "name": "View Incident & AI Diagnosis",
          "targets": [
            { "os": "default", "uri": dashboardUrl }
          ]
        }
      ]
    };
  }

  await axios.post(webhookUrl, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 10000,
  });
  console.log(`[teams] ${isAdaptiveCard ? "Adaptive card" : "MessageCard"} sent`);
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────
export async function sendWhatsApp(
  config: Record<string, string>,
  event: CrashEvent,
  incidentId: string,
  severity: string,
  clusterName: string
): Promise<void> {
  const emoji = severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "🔵";
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/incidents/${incidentId}`;

  const message = config.message_template
    ? formatTemplate(config.message_template, event, incidentId, severity, clusterName, dashboardUrl)
    : [
        `${emoji} *Srevox Alert [${clusterName}] — ${severity.toUpperCase()}*`,
        ``,
        `*Cluster:* ${clusterName}`,
        `*Pod:* ${event.pod_name}`,
        `*Namespace:* ${event.namespace}`,
        `*Reason:* ${event.crash_reason}`,
        `*Restarts:* ${event.restart_count}`,
        ``,
        `View incident: ${dashboardUrl}`,
      ].join("\n");

  if (config.provider === "meta") {
    await sendViaMetaWhatsApp(config, message);
  } else {
    await sendViaTwilio(config, message);
  }
}

async function sendViaTwilio(config: Record<string, string>, message: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}/Messages.json`;
  const recipients = config.to.split(",").map((t) => t.trim());

  for (const to of recipients) {
    const params = new URLSearchParams({
      From: config.from.startsWith("whatsapp:") ? config.from : `whatsapp:${config.from}`,
      To:   to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
      Body: message,
    });
    await axios.post(url, params.toString(), {
      auth: { username: config.account_sid, password: config.auth_token },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10000,
    });
    console.log(`[whatsapp/twilio] Sent to ${to}`);
  }
}

async function sendViaMetaWhatsApp(config: Record<string, string>, message: string): Promise<void> {
  const url = `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`;
  const recipients = config.to.split(",").map((t) => t.trim());

  for (const to of recipients) {
    await axios.post(url, {
      messaging_product: "whatsapp",
      to: to.replace("+", ""),
      type: "text",
      text: { body: message },
    }, {
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      timeout: 10000,
    });
    console.log(`[whatsapp/meta] Sent to ${to}`);
  }
}

// ── Generic Webhook (Slack, PagerDuty, etc.) ──────────────────────────────────
export async function sendWebhook(
  config: Record<string, string>,
  event: CrashEvent,
  incidentId: string,
  severity: string,
  clusterName: string
): Promise<void> {
  const import_crypto = await import("crypto");
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/incidents/${incidentId}`;

  const url = config.url || "";
  const isSlack = url.includes("hooks.slack.com");
  let payload: any;

  if (isSlack) {
    const emoji = severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "🔵";
    const text = config.message_template
      ? formatTemplate(config.message_template, event, incidentId, severity, clusterName, dashboardUrl)
      : `*${emoji} Srevox Alert [${clusterName}] — ${severity.toUpperCase()}*\n\n` +
        `*Pod:* \`${event.pod_name}\`\n` +
        `*Namespace:* \`${event.namespace}\`\n` +
        `*Reason:* \`${event.crash_reason}\`\n` +
        `*Restarts:* \`${event.restart_count}\`\n\n` +
        `<${dashboardUrl}|View Incident & AI Diagnosis>`;
    payload = { text };
  } else {
    payload = {
      source:       "srevox",
      incident_id:  incidentId,
      severity,
      cluster_id:   event.cluster_id,
      cluster_name: clusterName,
      pod_name:     event.pod_name,
      namespace:    event.namespace,
      container:    event.container_name,
      crash_reason: event.crash_reason,
      restarts:     event.restart_count,
      detected_at:  event.detected_at,
      dashboard_url: dashboardUrl,
      text: config.message_template
        ? formatTemplate(config.message_template, event, incidentId, severity, clusterName, dashboardUrl)
        : `⚠️ Srevox Alert: ${event.crash_reason} on pod ${event.pod_name} (namespace: ${event.namespace}, cluster: ${clusterName})`,
    };

    if (config.message_template) {
      payload.message = formatTemplate(config.message_template, event, incidentId, severity, clusterName, dashboardUrl);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent":   "Srevox/1.0",
  };

  if (config.secret && !isSlack) {
    const sig = import_crypto.createHmac("sha256", config.secret)
      .update(JSON.stringify(payload)).digest("hex");
    headers["X-Srevox-Signature"] = `sha256=${sig}`;
  }

  await axios.post(url, payload, { headers, timeout: 10000 });
  console.log(`[webhook] Sent to ${url} (slack: ${isSlack})`);
}

export async function sendClusterAlert(
  channel: { type: string; config: Record<string, string> },
  alert: {
    event_type: string;
    title: string;
    cluster_name: string;
    details?: string;
  }
): Promise<void> {
  if (channel.type === "teams") {
    const webhookUrl = channel.config.webhook_url || "";
    const isAdaptiveCard = webhookUrl.includes("logic.azure.com");
    let payload: any;

    if (isAdaptiveCard) {
      const isError = alert.event_type.includes("error") || alert.event_type.includes("disconnect") || alert.event_type.includes("deleted");
      const color = isError ? "attention" : "good";
      const rawCard = {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body: [
          {
            type: "TextBlock",
            text: `⚠️ Srevox Cluster Alert: ${alert.title}`,
            weight: "Bolder",
            size: "Medium",
            color,
          },
          {
            type: "FactSet",
            facts: [
              { title: "Cluster", value: alert.cluster_name },
              { title: "Event",   value: alert.event_type.toUpperCase() },
              { title: "Details", value: alert.details || "No details provided" },
            ],
          },
        ],
      };
      payload = {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: rawCard,
          },
        ],
      };
    } else {
      const isError = alert.event_type.includes("error") || alert.event_type.includes("disconnect") || alert.event_type.includes("deleted");
      const themeColor = isError ? "d93838" : "28a745";
      payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": themeColor,
        "summary": `⚠️ Srevox Cluster Alert: ${alert.title}`,
        "title": `⚠️ Srevox Cluster Alert: ${alert.title}`,
        "sections": [
          {
            "activityTitle": `Cluster event details`,
            "facts": [
              { "name": "Cluster", "value": alert.cluster_name },
              { "name": "Event",   "value": alert.event_type.toUpperCase() },
              { "name": "Details", "value": alert.details || "No details provided" },
            ],
            "markdown": true
          }
        ]
      };
    }
    await axios.post(webhookUrl, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });
    console.log(`[teams-cluster-alert] ${isAdaptiveCard ? "Adaptive card" : "MessageCard"} sent`);
  } else if (channel.type === "whatsapp") {
    const emoji = alert.event_type.includes("error") || alert.event_type.includes("disconnect") || alert.event_type.includes("deleted") ? "🔴" : "🟢";
    const message = [
      `${emoji} *Srevox Cluster Alert — ${alert.title}*`,
      ``,
      `*Cluster:* ${alert.cluster_name}`,
      `*Event:* ${alert.event_type.toUpperCase()}`,
      `*Details:* ${alert.details || "No details"}`,
    ].join("\n");
    if (channel.config.provider === "meta") {
      await sendViaMetaWhatsApp(channel.config, message);
    } else {
      await sendViaTwilio(channel.config, message);
    }
  } else if (channel.type === "webhook" || channel.type === "slack") {
    const url = channel.config.url || channel.config.webhook_url || "";
    const isSlack = url.includes("hooks.slack.com");
    let payload: any;

    if (isSlack) {
      const isError = alert.event_type.includes("error") || alert.event_type.includes("disconnect") || alert.event_type.includes("deleted");
      const emoji = isError ? "🔴" : "🟢";
      payload = {
        text: `*${emoji} Srevox Cluster Alert: ${alert.title}*\n\n` +
              `*Cluster:* \`${alert.cluster_name}\`\n` +
              `*Event:* \`${alert.event_type.toUpperCase()}\`\n` +
              `*Details:* ${alert.details || "No details provided"}`
      };
    } else {
      payload = {
        source: "srevox",
        event_type: "cluster_alert",
        alert_type: alert.event_type,
        title: alert.title,
        cluster_name: alert.cluster_name,
        details: alert.details || "",
        timestamp: new Date().toISOString(),
        text: `⚠️ Srevox Cluster Alert: ${alert.title} — ${alert.cluster_name}`,
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent":   "Srevox/1.0",
    };
    if (channel.config.secret && !isSlack) {
      const import_crypto = await import("crypto");
      const sig = import_crypto.createHmac("sha256", channel.config.secret)
        .update(JSON.stringify(payload)).digest("hex");
      headers["X-Srevox-Signature"] = `sha256=${sig}`;
    }
    await axios.post(url, payload, { headers, timeout: 10000 });
    console.log(`[webhook-cluster-alert] Sent to ${url} (slack: ${isSlack})`);
  } else if (channel.type === "email") {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host:   channel.config.smtp_host || "smtp.gmail.com",
      port:   Number(channel.config.smtp_port || 587),
      secure: channel.config.smtp_port === "465",
      auth:   { user: channel.config.smtp_user, pass: channel.config.smtp_pass },
      tls:    { rejectUnauthorized: false }
    });
    const isError = alert.event_type.includes("error") || alert.event_type.includes("disconnect") || alert.event_type.includes("deleted");
    const color = isError ? "#DC2626" : "#10B981";
    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:600px;margin:40px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08); border-top: 4px solid ${color};">
        <div style="padding:28px;">
          <h2 style="color:${color}; margin-top:0;">⚠️ Srevox Cluster Alert</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px 0;color:#64748b;font-size:13px;width:100px;">Event</td>
              <td style="padding:10px 0;color:#0f172a;font-size:13px;font-weight:600;">${alert.title}</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px 0;color:#64748b;font-size:13px;width:100px;">Cluster</td>
              <td style="padding:10px 0;color:#0f172a;font-size:13px;font-weight:600;">${alert.cluster_name}</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px 0;color:#64748b;font-size:13px;width:100px;">Details</td>
              <td style="padding:10px 0;color:#0f172a;font-size:13px;font-weight:600;">${alert.details || "No details provided"}</td>
            </tr>
          </table>
        </div>
      </div>
    </body>
    </html>`;
    const recipients = (channel.config.to || channel.config.smtp_user).split(",").map((e) => e.trim());
    await transporter.sendMail({
      from:    `"Srevox Alerts" <${channel.config.from || channel.config.smtp_user}>`,
      to:      recipients.join(", "),
      subject: `[Srevox Cluster Alert] ${alert.title} — ${alert.cluster_name}`,
      html,
    });
    console.log(`[email-cluster-alert] Sent to ${recipients.join(", ")}`);
  }
}
