import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageHero from "@/components/site/PageHero";
import { PROGRAMMES } from "@/lib/siteContent";

export const metadata: Metadata = {
  alternates: { canonical: "/programmes" },
  title: "What we do",
  description:
    "Our projects in Martil & Tetouan: Malabis Share clothing bank, Project Yatra, Soccer4All, beach clean-ups, Language Café and more.",
};

export default function ProgrammesPage() {
  return (
    <>
      <PageHero id="programmes-title" eyebrow="What we do" title="Projects that create positive change">
        From a dignified clothing bank to football, beach clean-ups and language exchange — this is how our volunteers
        make a difference in Martil and Tetouan.
      </PageHero>

      <section aria-label="Our projects" className="bg-white">
        <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 py-20 sm:px-6 md:grid-cols-2">
          {PROGRAMMES.map((programme, index) => (
            <li
              key={programme.slug}
              id={programme.slug}
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
          ))}
        </ul>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Want to help with one of these?</h2>
            <p className="mt-2 text-slate-600">Apply for an open project, or send a general application and we&apos;ll find a match.</p>
          </div>
          <Link
            href="/join"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-red-500/25 transition-colors hover:bg-[#a51f24]"
          >
            Join us
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
