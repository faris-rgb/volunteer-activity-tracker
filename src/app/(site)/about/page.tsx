import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, Eye, HeartHandshake, Target, Users } from "lucide-react";
import PageHero from "@/components/site/PageHero";
import { WAYS_TO_VOLUNTEER } from "@/lib/siteContent";

export const metadata: Metadata = {
  title: "About us",
  description: "Who we are: a membership-based volunteering association in Martil & Tetouan, founded in 2017 by and for volunteers.",
};

const VALUES = [
  { title: "Two-way learning", text: "Volunteers and local communities learn from each other — volunteers live and work with the community." },
  { title: "Made to measure", text: "After a first meeting we match each volunteer with activities that fit their interests and learning goals." },
  { title: "Open to everyone", text: "We make volunteering accessible to young people with fewer opportunities, minorities and women." },
  { title: "Community first", text: "Everything we do starts with the needs of the people and organisations of Martil and Tetouan." },
] as const;

export default function AboutPage() {
  return (
    <>
      <PageHero id="about-title" eyebrow="About us" title="Volunteering by and for young people">
        Volunteer in Morocco is a membership-based non-profit association, founded in 2017 by and for volunteers in
        Martil &amp; Tetouan. Our members proudly call themselves <strong className="text-white">Vimians</strong>.
      </PageHero>

      <section aria-labelledby="mission-title" className="bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-20 sm:px-6 md:grid-cols-2">
          <h2 id="mission-title" className="sr-only">
            Mission and vision
          </h2>
          <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <Target className="h-8 w-8 text-brand-red" aria-hidden="true" />
            <h3 className="mt-4 text-2xl font-bold text-slate-900">Our mission</h3>
            <p className="mt-3 leading-relaxed text-slate-600">
              To provide life-enriching volunteering experiences for young people, so they can reach their potential —
              for their own benefit and for that of their communities.
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <Eye className="h-8 w-8 text-brand-red" aria-hidden="true" />
            <h3 className="mt-4 text-2xl font-bold text-slate-900">Our vision</h3>
            <p className="mt-3 leading-relaxed text-slate-600">
              To be the leading Moroccan membership-based non-profit organisation for life-enriching volunteering
              experiences for young people.
            </p>
          </article>
        </div>
      </section>

      <section aria-labelledby="values-title" className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-red">What we stand for</p>
          <h2 id="values-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Our values
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((value) => (
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
          <p className="text-xs font-bold uppercase tracking-widest text-brand-red">What we offer</p>
          <h2 id="offer-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Four ways to volunteer
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {WAYS_TO_VOLUNTEER.map((way) => (
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
              European Solidarity Corps Quality Label
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              We hold the European Solidarity Corps (ESC) Quality Label as both a <strong>hosting</strong> and a{" "}
              <strong>supporting</strong> organisation. That means we can welcome international volunteers in Martil and
              Tetouan, and support young Moroccans who want to volunteer abroad.
            </p>
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Our partners</h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              We work together with organisations in Morocco and Europe — including{" "}
              <strong>Stichting Cultined</strong> in the Netherlands, with whom we run European Solidarity Corps team
              projects such as Malabis Share — and with local schools, care homes and associations.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex items-center gap-2 font-semibold text-brand-red hover:underline"
            >
              Want to partner with us? Get in touch
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
