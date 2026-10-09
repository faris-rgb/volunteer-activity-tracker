import type { Metadata } from "next";
import { connection } from "next/server";
import PageHero from "@/components/site/PageHero";
import { issueFormToken } from "@/lib/publicJoin";
import { getSiteDictionary } from "@/i18n/site";
import FeedbackForm from "./FeedbackForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSiteDictionary();
  return {
    title: t.feedback.meta.title,
    description: t.feedback.meta.description,
    alternates: { canonical: "/feedback" },
  };
}

export default async function FeedbackPage() {
  // The form token records when the form was rendered, so render per request.
  await connection();
  const { t } = await getSiteDictionary();
  return (
    <>
      <PageHero id="feedback-title" eyebrow={t.feedback.hero.eyebrow} title={t.feedback.hero.title}>
        {t.feedback.hero.text}
      </PageHero>
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <FeedbackForm formToken={issueFormToken()} t={t.feedback} />
        </div>
      </section>
    </>
  );
}
