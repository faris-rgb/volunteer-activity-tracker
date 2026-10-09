import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { getFeedbackAction } from "@/app/actions/feedback";
import { requireRouteAccess } from "@/lib/auth";
import type { FeedbackEntry } from "@/lib/feedbackShared";
import FeedbackInbox from "./FeedbackInbox";

export const metadata: Metadata = { title: "Volunteer feedback" };

export default async function VolunteerFeedbackPage() {
  await requireRouteAccess("/volunteer-feedback");
  let entries: FeedbackEntry[] = [];
  let loadError = false;
  try {
    entries = await getFeedbackAction();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Could not load feedback:", error);
    loadError = true;
  }
  return <FeedbackInbox initialEntries={entries} loadError={loadError} />;
}
