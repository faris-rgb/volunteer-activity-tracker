"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CalendarDays,
  ClipboardList,
  Globe,
  HeartHandshake,
  LogIn,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Plane,
  Sparkles,
  Sprout,
  TriangleAlert,
  Users,
} from "lucide-react";
import { ESC_RULES, whatsappLink } from "@/lib/domain";
import type { PublicJoinData } from "./joinShared";
import ApplicationForm from "./components/ApplicationForm";
import ProjectCard from "./components/ProjectCard";
import ThankYou from "./components/ThankYou";
import { FacebookIcon, InstagramIcon, ZelligePattern } from "./components/BrandIcons";

interface JoinClientProps {
  data: PublicJoinData;
  /** YYYY-MM-DD in Morocco, from the server (keeps server and browser output identical). */
  today: string;
  formToken: string;
  initialProjectId: string;
}

const WAYS_TO_VOLUNTEER = [
  {
    icon: Sprout,
    title: "Community projects",
    text: "Hands-on work all year round: sorting and sharing clothes at the Malabis Share clothing bank, Project Yatra, Soccer4All and beach clean-ups along the Martil coast.",
  },
  {
    icon: Plane,
    title: "ESC volunteering",
    text: `Aged ${ESC_RULES.minAge}–${ESC_RULES.maxAge}? Join us through the European Solidarity Corps. We hold the ESC Quality Label, work with partners such as Stichting Cultined (NL) and welcome you at Tangier or Tetouan airport.`,
  },
  {
    icon: Users,
    title: "Local volunteering",
    text: "Live in Martil, Tetouan or elsewhere in Morocco? Join activities in your free time, practise languages with international volunteers and become a member of the association.",
  },
] as const;

const STEPS = [
  { icon: ClipboardList, title: "Apply online", text: "Fill in the form below. It takes about 5 minutes." },
  { icon: MessagesSquare, title: "Get to know us", text: "We contact you on WhatsApp or by email for a short chat." },
  {
    icon: Sparkles,
    title: "Start volunteering",
    text: "We agree on a project and dates — and welcome you to the team.",
  },
] as const;

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-emerald-500/40 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToSection(id: string, focusId?: string) {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}

export default function JoinClient({ data, today, formToken, initialProjectId }: JoinClientProps) {
  const { org, presets, projectsUnavailable } = data;
  const projects = data.projects;
  const openProjects = projects.filter((project) => project.acceptingApplications);
  const [projectId, setProjectId] = useState(initialProjectId);
  const selectedProject = openProjects.find((project) => project.id === projectId) ?? null;
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  const thankYouHeadingRef = useRef<HTMLHeadingElement>(null);

  const whatsapp = whatsappLink(
    org.contactPhone,
    `Hi! I'd like to know more about volunteering with ${org.organizationName}.`,
  );
  const hasContact = Boolean(org.contactEmail || whatsapp || org.instagramUrl || org.facebookUrl);
  const year = today.slice(0, 4);

  // After a successful application, show the thank-you screen from the top and move focus to it.
  useEffect(() => {
    if (submittedName === null) return;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    thankYouHeadingRef.current?.focus({ preventScroll: true });
  }, [submittedName]);

  const applyFor = (id: string) => {
    setProjectId(id);
    scrollToSection("apply", "apply-title");
  };

  const goToApply = () => scrollToSection("apply", "apply-title");

  const backToPage = () => {
    setSubmittedName(null);
    setProjectId("");
    window.requestAnimationFrame(() => scrollToSection("projects", "projects-title"));
  };

  return (
    <div id="top" className="relative min-h-screen overflow-x-clip bg-slate-950 text-slate-100">
      {submittedName === null && (
        <a
          href="#apply"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-emerald-500 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-slate-950"
        >
          Skip to the application form
        </a>
      )}

      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a
            href="#top"
            className="flex min-w-0 items-center gap-2.5"
            aria-label={`${org.organizationName} — back to top`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <HeartHandshake className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            </span>
            <span className="truncate text-sm font-bold tracking-tight text-white sm:text-base">
              {org.organizationName}
            </span>
          </a>
          {submittedName === null && (
            <nav aria-label="Page sections" className="hidden items-center gap-1 text-sm md:flex">
              <a
                href="#about"
                className="rounded-lg px-3 py-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-white"
              >
                Ways to help
              </a>
              <a
                href="#projects"
                className="rounded-lg px-3 py-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-white"
              >
                Projects
              </a>
              <a
                href="#contact"
                className="rounded-lg px-3 py-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-white"
              >
                Contact
              </a>
            </nav>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/sign-in"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition-colors hover:bg-slate-900 hover:text-white sm:inline-flex"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Staff sign in
            </Link>
            {submittedName === null && (
              <button type="button" onClick={goToApply} className={`${PRIMARY_BUTTON} px-4 py-2`}>
                Apply now
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {submittedName !== null ? (
          <ThankYou firstName={submittedName} org={org} onBack={backToPage} headingRef={thankYouHeadingRef} />
        ) : (
          <>
            {/* ---------- Hero ---------- */}
            <section
              aria-labelledby="join-hero-title"
              className="relative isolate overflow-hidden border-b border-slate-800/80"
            >
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.18),transparent_60%)]" />
              <div className="pointer-events-none absolute -right-32 top-24 -z-10 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
              <ZelligePattern
                id="join-hero-zellige"
                className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-emerald-400/[0.07] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
              />
              <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <Award className="h-3.5 w-3.5" aria-hidden="true" />
                  ESC Quality Label · Membership association
                </p>
                <h1
                  id="join-hero-title"
                  className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl"
                >
                  Volunteer in Morocco
                  <span className="sr-only"> — </span>
                  <span className="mt-2 block bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent">
                    Martil &amp; Tetouan
                  </span>
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                  Join local and international volunteers on Morocco&apos;s Mediterranean coast. Share clothes with
                  families in need, coach kids on the football pitch, clean up the beaches — or come for a longer stay
                  with the European Solidarity Corps.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={goToApply} className={PRIMARY_BUTTON}>
                    Apply to volunteer
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("projects", "projects-title")}
                    className={SECONDARY_BUTTON}
                  >
                    {openProjects.length > 0
                      ? `See ${openProjects.length} open project${openProjects.length === 1 ? "" : "s"}`
                      : "See our projects"}
                  </button>
                </div>
                {selectedProject && (
                  <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-300">
                    <Sparkles className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    You&apos;re applying for <span className="font-semibold text-white">{selectedProject.name}</span>
                    <button
                      type="button"
                      onClick={goToApply}
                      className="font-semibold text-emerald-400 underline-offset-4 transition-colors hover:text-emerald-300 hover:underline"
                    >
                      Continue to the form
                    </button>
                  </p>
                )}
                <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    Martil &amp; Tetouan, northern Morocco
                  </li>
                  <li className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    Local &amp; international volunteers
                  </li>
                  <li className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    Short activities to long-term stays
                  </li>
                </ul>
              </div>
            </section>

            {/* ---------- Ways to volunteer ---------- */}
            <section id="about" aria-labelledby="about-title" className="scroll-mt-20 border-b border-slate-800/80">
              <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Ways to volunteer</p>
                <h2
                  id="about-title"
                  className="mt-2 max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl"
                >
                  Find the way of helping that fits you
                </h2>
                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {WAYS_TO_VOLUNTEER.map(({ icon: Icon, title, text }) => (
                    <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                        <Icon className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                      </span>
                      <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            {/* ---------- Projects ---------- */}
            <section
              id="projects"
              aria-labelledby="projects-title"
              className="scroll-mt-20 border-b border-slate-800/80"
            >
              <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Projects</p>
                    <h2
                      id="projects-title"
                      tabIndex={-1}
                      className="mt-2 text-2xl font-bold tracking-tight text-white focus:outline-none sm:text-3xl"
                    >
                      {projects.length > 0 ? "Projects you can join" : "Upcoming projects"}
                    </h2>
                  </div>
                  {projects.length > 0 && (
                    <p className="text-sm text-slate-400">Can&apos;t find the right one? Send a general application.</p>
                  )}
                </div>

                {projectsUnavailable && (
                  <p
                    role="status"
                    className="mt-6 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
                  >
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    We couldn&apos;t load the project list right now. You can still send a general application below.
                  </p>
                )}

                {projects.length > 0 ? (
                  <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        today={today}
                        selected={project.id === projectId}
                        onApply={applyFor}
                      />
                    ))}
                    <article className="flex flex-col justify-between rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-5 sm:p-6">
                      <div>
                        <HeartHandshake className="h-7 w-7 text-emerald-400" aria-hidden="true" />
                        <h3 className="mt-3 text-lg font-bold text-white">Not sure which project?</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                          Tell us about yourself and what you enjoy doing. We&apos;ll suggest an activity or project
                          that fits your skills and dates.
                        </p>
                      </div>
                      <button type="button" onClick={() => applyFor("")} className={`${SECONDARY_BUTTON} mt-5 w-full`}>
                        Send a general application
                      </button>
                    </article>
                  </div>
                ) : (
                  !projectsUnavailable && (
                    <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                        <Sprout className="h-7 w-7 text-emerald-400" aria-hidden="true" />
                      </span>
                      <h3 className="mt-4 text-lg font-bold text-white">New projects are on their way</h3>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                        There are no projects open for applications right now, but we welcome volunteers all year round.
                        Send a general application and we&apos;ll match you with an activity.
                      </p>
                      <button type="button" onClick={() => applyFor("")} className={`${PRIMARY_BUTTON} mt-6`}>
                        Send a general application
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )
                )}
              </div>
            </section>

            {/* ---------- Apply ---------- */}
            <section id="apply" aria-labelledby="apply-title" className="scroll-mt-20 border-b border-slate-800/80">
              <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
                <div className="lg:sticky lg:top-24 lg:self-start">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Apply</p>
                  <h2
                    id="apply-title"
                    tabIndex={-1}
                    className="mt-2 text-2xl font-bold tracking-tight text-white focus:outline-none sm:text-3xl"
                  >
                    Apply to volunteer
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                    No experience needed — just motivation and a smile. Here&apos;s what happens after you apply:
                  </p>
                  <ol className="mt-6 space-y-4">
                    {STEPS.map(({ icon: Icon, title, text }, index) => (
                      <li key={title} className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                          <Icon className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-white">
                            <span className="sr-only">Step {index + 1}: </span>
                            {title}
                          </span>
                          <span className="mt-0.5 block text-sm text-slate-400">{text}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/30 sm:p-8">
                  <ApplicationForm
                    orgName={org.organizationName}
                    projects={openProjects}
                    presets={presets}
                    today={today}
                    formToken={formToken}
                    projectId={projectId}
                    onProjectChange={setProjectId}
                    onSubmitted={setSubmittedName}
                  />
                </div>
              </div>
            </section>

            {/* ---------- Contact ---------- */}
            <section id="contact" aria-labelledby="contact-title" className="scroll-mt-20">
              <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Contact</p>
                <h2 id="contact-title" className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Questions? Say hello
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
                  {hasContact
                    ? "We're a small team based in Martil. Instagram and WhatsApp are the quickest ways to reach us."
                    : "We're a small team based in Martil. The quickest way to reach us is the application form above — we reply on WhatsApp or by email."}
                </p>
                {hasContact && (
                  <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {org.instagramUrl && (
                      <ContactCard
                        href={org.instagramUrl}
                        external
                        icon={<InstagramIcon className="h-5 w-5 text-emerald-400" />}
                        title="Instagram"
                        detail="Follow our projects"
                      />
                    )}
                    {whatsapp && (
                      <ContactCard
                        href={whatsapp}
                        external
                        icon={<MessageCircle className="h-5 w-5 text-emerald-400" aria-hidden="true" />}
                        title="WhatsApp"
                        detail={org.contactPhone ?? ""}
                      />
                    )}
                    {org.contactEmail && (
                      <ContactCard
                        href={`mailto:${org.contactEmail}`}
                        icon={<Mail className="h-5 w-5 text-emerald-400" aria-hidden="true" />}
                        title="Email"
                        detail={org.contactEmail}
                      />
                    )}
                    {org.facebookUrl && (
                      <ContactCard
                        href={org.facebookUrl}
                        external
                        icon={<FacebookIcon className="h-5 w-5 text-emerald-400" />}
                        title="Facebook"
                        detail="Find us on Facebook"
                      />
                    )}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-slate-800/80 bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-semibold text-slate-300">{org.organizationName}</p>
            <p className="mt-0.5 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Martil &amp; Tetouan, Morocco · © {year}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {org.instagramUrl && (
              <a
                href={org.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram (opens in a new tab)"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-white"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
            )}
            {org.facebookUrl && (
              <a
                href={org.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook (opens in a new tab)"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-white"
              >
                <FacebookIcon className="h-4 w-4" />
              </a>
            )}
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-slate-700 hover:text-white"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Staff sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ContactCard({
  href,
  icon,
  title,
  detail,
  external,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
  external?: boolean;
}) {
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="flex h-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-emerald-500/40 hover:bg-slate-900"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">
            {title}
            {external && <span className="sr-only"> (opens in a new tab)</span>}
          </span>
          <span className="block truncate text-xs text-slate-400">{detail}</span>
        </span>
      </a>
    </li>
  );
}
