import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, Eye, HeartHandshake, Target, Users } from "lucide-react";
import PageHero from "@/components/site/PageHero";
import { getSiteDictionary } from "@/i18n/site";
import { rich } from "@/i18n/rich";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSiteDictionary();
  return {
    alternates: { canonical: "/about" },
    title: t.about.meta.title,
    description: t.about.meta.description,
  };
}

export default async function AboutPage() {
  const { t } = await getSiteDictionary();
  const about = t.about;
  return (
    <>
      <PageHero id="about-title" eyebrow={about.hero.eyebrow} title={about.hero.title}>
        {rich(about.hero.text, {}, "text-white")}
      </PageHero>

      <section aria-labelledby="mission-title" className="bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-20 sm:px-6 md:grid-cols-2">
          <h2 id="mission-title" className="sr-only">
            {about.missionAndVision}
          </h2>
          <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <Target className="h-8 w-8 text-brand-red" aria-hidden="true" />
            <h3 className="mt-4 text-2xl font-bold text-slate-900">{about.mission.title}</h3>
            <p className="mt-3 leading-relaxed text-slate-600">{about.mission.text}</p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <Eye className="h-8 w-8 text-brand-red" aria-hidden="true" />
            <h3 className="mt-4 text-2xl font-bold text-slate-900">{about.vision.title}</h3>
            <p className="mt-3 leading-relaxed text-slate-600">{about.vision.text}</p>
          </article>
        </div>
      </section>

      <section aria-labelledby="values-title" className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-red">{about.values.eyebrow}</p>
          <h2 id="values-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {about.values.title}
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {about.values.items.map((value) => (
              <li key={value.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <HeartHandshake className="h-6 w-6 text-brand-red" aria-hidden="true" />
                <h3 className="mt-3 text-lg font-bold text-slate-900">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{value.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="offer-title" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-red">{about.offer.eyebrow}</p>
          <h2 id="offer-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {about.offer.title}
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {t.ways.map((way) => (
              <li key={way.title} className="flex gap-4 rounded-2xl border border-slate-200 p-6">
                <Users className="mt-1 h-6 w-6 shrink-0 text-brand-red" aria-hidden="true" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{way.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{way.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="esc-title" className="bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <Award className="h-10 w-10 text-brand-red" aria-hidden="true" />
            <h2 id="esc-title" className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              {about.esc.title}
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600">{rich(about.esc.text)}</p>
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">{about.partners.title}</h2>
            <p className="mt-4 leading-relaxed text-slate-600">{rich(about.partners.text)}</p>
            <Link
              href="/contact"
              className="mt-6 inline-flex items-center gap-2 font-semibold text-brand-red hover:underline"
            >
              {about.partners.cta}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
