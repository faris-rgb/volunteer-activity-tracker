"use server";

import { headers } from "next/headers";
import { actionOk, type ActionResult } from "@/lib/actionResult";
import {
  checkFormToken,
  clientIpFromHeaders,
  countAttempt,
  findApplicableProject,
  issueFormToken,
  issueReadyFormToken,
  reserveApplicationSlot,
  storeApplication,
} from "@/lib/publicJoin";
import { moroccoToday, validateApplication, type ApplicationFieldErrors } from "@/app/join/joinShared";
import { notifyApplication } from "@/lib/applicationNotify";

// Public endpoint used by the /join page. It is deliberately NOT role-guarded (applicants have no
// account), so it is hardened instead: strict validation and length limits, a honeypot field, a signed
// minimum-fill-time token, in-memory rate limits per IP / email, and a check that the chosen project is
// public and open. It never reveals whether an email address is already known.

export interface ApplicationReceipt {
  received: true;
}

/** ActionResult plus optional field errors and a replacement form token on failure. */
export type SubmitApplicationResult =
  | ActionResult<ApplicationReceipt>
  | { ok: false; error: string; fieldErrors?: ApplicationFieldErrors; formToken?: string };

const RECEIPT: ApplicationReceipt = { received: true };

const MESSAGES = {
  unreadable: "Your application could not be read. Please reload the page and try again.",
  tooManyAttempts: "Too many attempts from your connection. Please wait a while and try again, or contact us directly.",
  tooManyApplications:
    "We've already received several applications from you in the last hour. Please try again later or contact us directly.",
  tooFast: "That was quick! Please check your answers, then press Send again.",
  invalidToken: "Your form session has expired. Please wait a few seconds and press Send again.",
  expiredToken: "This page was open for a long time, so we refreshed your form. Please press Send again.",
  fixFields: "Please check the highlighted fields.",
  projectClosed: "This project is no longer taking applications. Choose another project or send a general application.",
  unavailable: "We couldn't send your application right now. Please try again in a few minutes.",
} as const;

export async function submitApplicationAction(input: unknown): Promise<SubmitApplicationResult> {
  try {
    const ip = clientIpFromHeaders(await headers());
    if (!countAttempt(ip)) {
      return { ok: false, error: MESSAGES.tooManyAttempts };
    }

    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return { ok: false, error: MESSAGES.unreadable };
    }
    const raw = input as Record<string, unknown>;

    // Honeypot: people never see this field. Bots that fill it get a normal-looking success, but
    // nothing is stored.
    if (raw.website !== undefined && raw.website !== null && raw.website !== "") {
      return actionOk(RECEIPT);
    }

    const token = checkFormToken(raw.formToken);
    if (token === "invalid") {
      return { ok: false, error: MESSAGES.invalidToken, formToken: issueFormToken() };
    }
    if (token === "expired") {
      return { ok: false, error: MESSAGES.expiredToken, formToken: issueReadyFormToken() };
    }
    if (token === "too_fast") {
      return { ok: false, error: MESSAGES.tooFast };
    }

    const today = moroccoToday();
    const { data, errors } = validateApplication(raw, today);
    if (!data) {
      return { ok: false, error: MESSAGES.fixFields, fieldErrors: errors };
    }

    let projectName: string | undefined;
    if (data.projectId) {
      const project = await findApplicableProject(data.projectId, today);
      if (!project) {
        return { ok: false, error: MESSAGES.projectClosed, fieldErrors: { projectId: MESSAGES.projectClosed } };
      }
      projectName = project.name;
    }

    const slot = reserveApplicationSlot({ ip, email: data.email });
    if (!slot.ok) {
      return { ok: false, error: MESSAGES.tooManyApplications };
    }

    try {
      await storeApplication(data, { today, projectName });
    } catch (error) {
      slot.release();
      throw error;
    }
    // Only a complete, validated and stored application is emailed (as PDF) to the partner.
    await notifyApplication(data, projectName);
    return actionOk(RECEIPT);
  } catch (error) {
    console.error("Join page: could not store application:", error);
    return { ok: false, error: MESSAGES.unavailable };
  }
}
