import "server-only";
import nodemailer from "nodemailer";

// Outgoing email via SMTP (e.g. Google Workspace: smtp.gmail.com, port 465, an app password).
// Configure in .env.local: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, optional MAIL_FROM.

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export interface MailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export async function sendMail({
  to,
  subject,
  text,
  attachments = [],
  replyTo,
}: {
  to: string;
  subject: string;
  text: string;
  attachments?: MailAttachment[];
  replyTo?: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error("Email is not configured (SMTP_HOST, SMTP_USER and SMTP_PASS are required).");
  }
  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    replyTo,
    subject,
    text,
    attachments: attachments.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content),
      contentType: attachment.contentType,
    })),
  });
}
