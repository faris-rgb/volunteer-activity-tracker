import type { Metadata } from "next";
import PageHero from "@/components/site/PageHero";
import { DEFAULT_CONTACT } from "@/lib/siteContent";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  title: "Privacy",
  description: "How Volunteer in Morocco handles the personal data you share in our application form.",
};

const SECTIONS = [
  {
    title: "Which data we collect",
    text: "When you apply, we ask for your name, contact details, date of birth, nationality, place of residence, languages, skills, your motivation and — if you choose to share it — practical information such as diet, health notes, emergency contact and availability.",
  },
  {
    title: "Why we use it",
    text: "We use your data only to process your application, contact you about volunteering, prepare your stay and activities, and meet the reporting requirements of programmes such as the European Solidarity Corps.",
  },
  {
    title: "Who we share it with",
    text: "Your application is shared with our partner organisation Stichting Cultined and with the organisers of the project you apply for. We never sell your data and never share it for marketing.",
  },
  {
    title: "How long we keep it",
    text: "We keep your data for as long as needed for your application and volunteering, and for the period required by the programmes that fund our projects. After that we delete it.",
  },
  {
    title: "Your rights",
    text: "You can ask us at any time to see, correct or delete your data, or withdraw your consent. Contact us and we will help you.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <>
      <PageHero id="privacy-title" eyebrow="Privacy" title="Your data, handled with care">
        This page explains how Volunteer in Morocco uses the information you share with us.
      </PageHero>
      <section className="bg-white">
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-20 sm:px-6">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
              <p className="mt-2 leading-relaxed text-slate-600">{section.text}</p>
            </div>
          ))}
          <div>
            <h2 className="text-xl font-bold text-slate-900">Contact</h2>
            <p className="mt-2 leading-relaxed text-slate-600">
              Questions about your data? Email{" "}
              <a href={`mailto:${DEFAULT_CONTACT.email}`} className="font-semibold text-brand-red hover:underline">
                {DEFAULT_CONTACT.email}
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
