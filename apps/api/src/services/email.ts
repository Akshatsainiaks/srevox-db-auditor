import nodemailer from "nodemailer";

let testAccount: nodemailer.TestAccount | null = null;

async function getTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback to ethereal for testing
  if (!testAccount) {
    console.log("[Email] Creating ethereal test account for local development...");
    testAccount = await nodemailer.createTestAccount();
  }
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

export async function sendEmail(
  to: string, 
  subject: string, 
  text: string, 
  html?: string,
  cc?: string,
  bcc?: string
): Promise<string | boolean> {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Srevox Team" <noreply@srevox.com>',
      to,
      cc,
      bcc,
      subject,
      text,
      html: html || text.replace(/\n/g, "<br>"),
    });

    console.log(`[Email] Sent to ${to}. Message ID: ${info.messageId}`);
    
    // Log preview URL if using ethereal
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[Email] ✉️  Preview your email here: ${previewUrl}`);
      return previewUrl as string;
    }
    return true;
  } catch (error) {
    console.error("[Email] Failed to send email:", error);
    return false;
  }
}
