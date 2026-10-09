import type { Metadata } from "next";
import PageHero from "@/components/site/PageHero";
import { DEFAULT_CONTACT } from "@/lib/siteContent";
import { getSiteDictionary } from "@/i18n/site";
import { rich } from "@/i18n/rich";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSiteDictionary();
  return {
    alternates: { canonical: "/privacy" },
    title: t.privacy.meta.title,
    description: t.privacy.meta.description,
  };
}

export default async function PrivacyPage() {
  const { t } = await getSiteDictionary();
  const privacy = t.privacy;
  return (
    <>
      <PageHero id="privacy-title" eyebrow={privacy.hero.eyebrow} title={privacy.hero.title}>
        {privacy.hero.text}
      </PageHero>
      <section className="bg-white">
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-20 sm:px-6">
          {privacy.sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
              <p className="mt-2 leading-relaxed text-slate-600">{section.text}</p>
            </div>
          ))}
          <div>
            <h2 className="text-xl font-bold text-slate-900">{privacy.contact.title}</h2>
            <p className="mt-2 leading-relaxed text-slate-600">
              {rich(privacy.contact.text, {
                email: (
                  <a href={`mailto:${DEFAULT_CONTACT.email}`} className="font-semibold text-brand-red hover:underline">
                    {DEFAULT_CONTACT.email}
                  </a>
                ),
              })}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
