import type { Metadata } from "next";
import { connection } from "next/server";
import PageHero from "@/components/site/PageHero";
import { issueFormToken } from "@/lib/publicJoin";
import FeedbackForm from "./FeedbackForm";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Volunteered with us? Tell us what was fun, what wasn't and what we can do better.",
  alternates: { canonical: "/feedback" },
};

export default async function FeedbackPage() {
  // The form token records when the form was rendered, so render per request.
  await connection();
  return (
    <>
      <PageHero id="feedback-title" eyebrow="Feedback" title="How was your time with us?">
        Your experience helps us make volunteering better for everyone. All questions are optional — answer as many
        as you like.
      </PageHero>
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <FeedbackForm formToken={issueFormToken()} />
        </div>
      </section>
    </>
  );
}
