"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { assertActionRole } from "@/lib/auth";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { OPERATIONS_ROLES } from "@/lib/roles";
import { isSanityConfigured, sanityClient, sanityWriteClient } from "@/lib/sanity";
import { checkFormToken, clientIpFromHeaders, countAttempt, issueReadyFormToken, reserveFeedbackSlot } from "@/lib/publicJoin";
import { validateFeedback, type FeedbackEntry, type FeedbackErrors } from "@/lib/feedbackShared";

// submitFeedbackAction is public (volunteers don't need an account), so it is hardened like the join
// form: honeypot, signed minimum-fill-time token, rate limits and strict validation. The other actions
// are for admins and staff only.

export type SubmitFeedbackResult =
  | ActionResult<{ received: true }>
  | { ok: false; error: string; fieldErrors?: FeedbackErrors; formToken?: string };

let mockFeedback: FeedbackEntry[] = [];

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export async function submitFeedbackAction(input: unknown): Promise<SubmitFeedbackResult> {
  try {
    const ip = clientIpFromHeaders(await headers());
    if (!countAttempt(ip)) {
      return { ok: false, error: "Too many attempts. Please try again later." };
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return { ok: false, error: "Your feedback could not be read. Please reload the page." };
    }
    const raw = input as Record<string, unknown>;
    if (raw.website) {
      return actionOk({ received: true }); // bot: pretend success, store nothing
    }
    const token = checkFormToken(raw.formToken);
    if (token === "too_fast") return { ok: false, error: "That was quick! Please check your answers and press Send again." };
    if (token !== "ok") {
      return { ok: false, error: "Your form session expired. Please press Send again.", formToken: issueReadyFormToken() };
    }

    const { data, errors } = validateFeedback(raw);
    if (!data) {
      return { ok: false, error: errors.form ?? "Please check the highlighted answers.", fieldErrors: errors };
    }
    if (!reserveFeedbackSlot(ip)) {
      return { ok: false, error: "We've received a lot of feedback from your connection. Please try again later." };
    }

    const doc = { _type: "feedback" as const, ...data, handled: false, createdAt: new Date().toISOString() };
    if (!isSanityConfigured()) {
      mockFeedback = [{ ...doc, _id: `feedback-${Date.now()}` }, ...mockFeedback];
    } else {
      await sanityWriteClient.create(doc);
    }
    revalidatePath("/volunteer-feedback");
    return actionOk({ received: true });
  } catch (error) {
    console.error("Feedback: could not store feedback:", error);
    return { ok: false, error: "We couldn't send your feedback right now. Please try again in a few minutes." };
  }
}

export async function getFeedbackAction(): Promise<FeedbackEntry[]> {
  await assertActionRole(OPERATIONS_ROLES);
  if (!isSanityConfigured()) return mockFeedback;
  return sanityClient.fetch<FeedbackEntry[]>(
    `*[_type == "feedback" && !(_id in path("drafts.**"))] | order(createdAt desc)[0...500]{
      _id, name, about, liked, disliked, improve, hadProblems, problems,
      "handled": coalesce(handled, false),
      "createdAt": coalesce(createdAt, _createdAt)
    }`
  );
}

export async function setFeedbackHandledAction(id: string, handled: boolean): Promise<ActionResult<{ id: string; handled: boolean }>> {
  try {
    await assertActionRole(OPERATIONS_ROLES);
    if (typeof id !== "string" || !ID_PATTERN.test(id) || typeof handled !== "boolean") {
      throw new Error("Invalid request.");
    }
    if (!isSanityConfigured()) {
      mockFeedback = mockFeedback.map((entry) => (entry._id === id ? { ...entry, handled } : entry));
    } else {
      const type = await sanityClient.fetch<string | null>(`*[_id == $id][0]._type`, { id });
      if (type !== "feedback") throw new Error("Feedback not found.");
      await sanityWriteClient.patch(id).set({ handled }).commit();
    }
    revalidatePath("/volunteer-feedback");
    return actionOk({ id, handled });
  } catch (error) {
    return actionError(error, "Could not update the feedback.");
  }
}
