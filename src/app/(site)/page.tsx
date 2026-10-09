import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, CalendarDays, Globe, HeartHandshake, MapPin, Users } from "lucide-react";
import { BrandLogo } from "@/components/BrandMark";
import { ZelligePattern } from "@/app/join/components/BrandIcons";
import { formatDateRange, moroccoToday, type PublicProject } from "@/app/join/joinShared";
import { getPublicJoinData } from "@/lib/publicJoin";
import { JOURNEY, PROGRAMMES, WAYS_TO_VOLUNTEER } from "@/lib/siteContent";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  title: { absolute: "Volunteer in Morocco — Be the change in Martil & Tetouan" },
  description:
    "Volunteer in Morocco is a youth volunteering association in Martil & Tetouan. Join local projects, ESC volunteering and community activities.",
};

export const dynamic = "force-dynamic";

const PRIMARY = "inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-red-500/25 transition-colors hover:bg-[#a51f24]";
const OUTLINE = "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-7 py-3.5 text-sm font-semibold text-slate-800 transition-colors hover:border-brand-red hover:text-brand-red";

export default async function HomePage() {
  let projects: PublicProject[] = [];
  try {
    projects = (await getPublicJoinData(moroccoToday())).projects.filter((project) => project.acceptingApplications);
  } catch (error) {
    console.error("Home: could not load projects:", error);
  }

  return (
    <>
      {/* Hero — as on the original volunteerinmorocco.com */}
      <section aria-labelledby="home-title" className="relative isolate overflow-hidden">
        <div
          className="absolute inset-0 -z-20 bg-[linear-gradient(135deg,#7a0f14_0%,#C1272D_45%,#d6267a_100%)]"
          aria-hidden="true"
        />
        <ZelligePattern id="home-zellige" className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-white/[0.08]" />
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              ESC Quality Label · Since 2017
            </p>
            <h1 id="home-title" className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-7xl">
              Be the Change
              <span className="mt-3 block text-2xl font-semibold text-white/90 sm:text-4xl">Start Volunteering Today!</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
              We empower young people to reach their potential and create positive change in the communities of Martil,
              Tetouan and beyond.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/join"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-brand-red shadow-xl shadow-black/20 transition-colors hover:bg-red-50"
              >
                Join us
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/programmes"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                What we do
              </Link>
            </div>
          </div>
          <div className="hidden justify-center lg:flex">
            <BrandLogo className="w-72 rotate-[-2deg] rounded-[2rem] p-4" />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 brand-rainbow" aria-hidden="true" />
      </section>

      {/* Quick facts */}
      <section aria-label="At a glance" className="border-b border-slate-200 bg-white">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 text-center sm:px-6 md:grid-cols-4">
          {[
            { icon: CalendarDays, value: "2017", label: "Founded by and for volunteers" },
            { icon: MapPin, value: "Martil & Tetouan", label: "Northern Morocco" },
            { icon: Award, value: "ESC", label: "Quality Label until 2027" },
            { icon: Globe, value: "4 ways", label: "To volunteer with us" },
          ].map(({ icon: Icon, value, label }) => (
            <li key={label} className="flex flex-col items-center">
              <Icon className="h-6 w-6 text-brand-red" aria-hidden="true" />
              <span className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">{value}</span>
              <span className="mt-1 text-sm text-slate-500">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Introducing */}
      <section aria-labelledby="intro-title" className="bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-red">Empowering positive change</p>
            <h2 id="intro-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Introducing Volunteer in Morocco
            </h2>
            <Link href="/about" className="mt-6 inline-flex items-center gap-2 font-semibold text-brand-red hover:underline">
              More about us
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="space-y-4 text-base leading-relaxed text-slate-700">
            <p>
              At Volunteer in Morocco, positive change starts with individual actions. We work closely with local
              communities in Tetouan and the surrounding area to provide meaningful volunteering opportunities that
              benefit both volunteers and the communities they serve.
            </p>
            <p>
              We bring together young people and organisations from different countries and are committed to making
              volunteering accessible to everyone — including young people with fewer opportunities.
            </p>
          </div>
        </div>
      </section>

      {/* Local languages: French & Arabic (helps people in Morocco find us) */}
      <section aria-label="Français et العربية" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 md:grid-cols-2">
          <div lang="fr">
            <h2 className="text-xl font-bold text-slate-900">Bénévolat au Maroc — Martil &amp; Tétouan</h2>
            <p className="mt-2 leading-relaxed text-slate-600">
              Volunteer in Morocco est une association de jeunes bénévoles fondée en 2017 à Martil. Nous proposons des
              projets de bénévolat local, l&apos;accueil de volontaires internationaux (Corps européen de solidarité) et
              des activités pour la communauté de Martil et Tétouan.
            </p>
            <Link href="/join" className="mt-3 inline-flex items-center gap-2 font-semibold text-brand-red hover:underline">
              Devenir bénévole
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div lang="ar" dir="rtl">
            <h2 className="text-xl font-bold text-slate-900">التطوع في المغرب — مرتيل وتطوان</h2>
            <p className="mt-2 leading-relaxed text-slate-600">
              جمعية Volunteer in Morocco هي جمعية شبابية للتطوع تأسست سنة 2017 في مرتيل. نقدم مشاريع تطوعية محلية، ونستقبل
              متطوعين دوليين في إطار الفيلق الأوروبي للتضامن، وننظم أنشطة لفائدة ساكنة مرتيل وتطوان.
            </p>
            <Link href="/join" className="mt-3 inline-flex items-center gap-2 font-semibold text-brand-red hover:underline">
              انضم إلينا كمتطوع
            </Link>
          </div>
        </div>
      </section>

      {/* Ways to volunteer */}
      <section aria-labelledby="ways-title" className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-red">Get involved</p>
          <h2 id="ways-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Four ways to volunteer with us
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WAYS_TO_VOLUNTEER.map((way, index) => (
              <li key={way.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-brand-red">
                  {[<Users key="a" className="h-5 w-5" />, <Globe key="b" className="h-5 w-5" />, <MapPin key="c" className="h-5 w-5" />, <HeartHandshake key="d" className="h-5 w-5" />][index]}
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{way.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{way.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Programmes teaser */}
      <section aria-labelledby="programmes-title" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-red">What we do</p>
              <h2 id="programmes-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Our projects
              </h2>
            </div>
            <Link href="/programmes" className="inline-flex items-center gap-2 font-semibold text-brand-red hover:underline">
              All projects
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {PROGRAMMES.slice(0, 3).map((programme) => (
              <li key={programme.slug} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="h-2 brand-rainbow" aria-hidden="true" />
                <div className="p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{programme.tag}</p>
                  <h3 className="mt-2 text-xl font-bold text-slate-900">{programme.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{programme.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Open projects from the portal */}
      {projects.length > 0 && (
        <section aria-labelledby="open-title" className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-red">Now open</p>
            <h2 id="open-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Projects you can apply for
            </h2>
            <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 6).map((project) => (
                <li key={project.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900">{project.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDateRange(project.startDate, project.endDate)}
                    {project.location ? ` · ${project.location}` : ""}
                  </p>
                  {project.description && (
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{project.description}</p>
                  )}
                  <Link href={`/join?project=${encodeURIComponent(project.id)}#apply`} className={`${PRIMARY} mt-5 self-start px-5 py-2.5`}>
                    Apply
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Join, Journey, Joy */}
      <section aria-labelledby="journey-title" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-red">Join, Journey, Joy</p>
          <h2 id="journey-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Exploring the volunteer experience
          </h2>
          <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-red text-sm font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Call to action */}
      <section className="relative isolate overflow-hidden bg-slate-900">
        <ZelligePattern id="home-cta-zellige" className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-white/[0.06]" />
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-300">See the world with your own eyes</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Embrace the call of adventure — embark on your volunteer journey.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/join" className={PRIMARY}>
              Join now
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/contact" className={`${OUTLINE} border-white/30 text-white hover:border-white hover:text-white`}>
              Ask a question
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
