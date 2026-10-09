import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageHero from "@/components/site/PageHero";
import { PROGRAMME_SLUGS } from "@/lib/siteContent";
import { getSiteDictionary } from "@/i18n/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSiteDictionary();
  return {
    alternates: { canonical: "/programmes" },
    title: t.programmes.meta.title,
    description: t.programmes.meta.description,
  };
}

export default async function ProgrammesPage() {
  const { t } = await getSiteDictionary();
  const programmes = t.programmes;
  return (
    <>
      <PageHero id="programmes-title" eyebrow={programmes.hero.eyebrow} title={programmes.hero.title}>
        {programmes.hero.text}
      </PageHero>

      <section aria-label={programmes.listLabel} className="bg-white">
        <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 py-20 sm:px-6 md:grid-cols-2">
          {PROGRAMME_SLUGS.map((slug, index) => {
            const programme = programmes.items[slug];
            return (
              <li
                key={slug}
                id={slug}
                className="scroll-mt-24 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="h-2 brand-rainbow" aria-hidden="true" />
                <div className="flex gap-5 p-7">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-lg font-extrabold text-brand-red">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{programme.tag}</p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-900">{programme.title}</h2>
                    <p className="mt-3 leading-relaxed text-slate-600">{programme.text}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{programmes.cta.title}</h2>
            <p className="mt-2 text-slate-600">{programmes.cta.text}</p>
          </div>
          <Link
            href="/join"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-red-500/25 transition-colors hover:bg-[#a51f24]"
          >
            {programmes.cta.joinUs}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
