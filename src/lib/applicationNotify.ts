import "server-only";
import { renderApplicationPdf } from "@/lib/applicationPdf";
import { isMailConfigured, sendMail } from "@/lib/mailer";
import { loadPublicSettings } from "@/lib/publicJoin";
import type { ParsedApplication } from "@/app/join/joinShared";

/** Recipient of new Join-form applications. Override with APPLICATION_NOTIFY_TO (comma-separated). */
const DEFAULT_NOTIFY_TO = "info@cultined.org";

function fileSafe(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "aanmelding"
  );
}

/**
 * Emails the application as a PDF to the partner organisation. Called only after the application
 * passed validation and was stored. Returns false (and logs) instead of throwing, so a mail problem
 * never fails the applicant's submission.
 */
export async function notifyApplication(application: ParsedApplication, projectName?: string): Promise<boolean> {
  if (!isMailConfigured()) {
    console.warn("Join page: email not configured; application stored but no PDF was emailed.");
    return false;
  }
  try {
    const { org } = await loadPublicSettings();
    const submittedAt = new Date();
    const pdf = await renderApplicationPdf(application, {
      orgName: org.organizationName,
      projectName,
      submittedAt,
    });
    const fullName = `${application.firstName} ${application.lastName}`;
    const projectLabel = projectName ?? "algemene aanmelding (nog geen project gekozen)";
    await sendMail({
      to: process.env.APPLICATION_NOTIFY_TO || DEFAULT_NOTIFY_TO,
      replyTo: application.email,
      subject: `Nieuwe aanmelding via de app: ${projectName ?? "algemene aanmelding"} – ${fullName}`,
      text: [
        "Hallo,",
        "",
        `Iemand heeft zich via de app aangemeld voor het project: ${projectLabel}.`,
        "",
        `Naam: ${fullName}`,
        `E-mail: ${application.email}`,
        `Telefoon (WhatsApp): ${application.phone}`,
        "",
        "Het volledige aanmeldformulier zit als PDF in de bijlage.",
        "",
        `Met vriendelijke groet,`,
        `${org.organizationName} – ServeTrack`,
      ].join("\n"),
      attachments: [
        {
          filename: `aanmelding-${fileSafe(projectName ?? "algemeen")}-${fileSafe(fullName)}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });
    return true;
  } catch (error) {
    console.error("Join page: could not email the application PDF:", error);
    return false;
  }
}
