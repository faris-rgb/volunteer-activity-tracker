"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  HeartHandshake,
  MessagesSquare,
  Sparkles,
  Sprout,
  TriangleAlert,
} from "lucide-react";
import type { PublicJoinData } from "./joinShared";
import ApplicationForm from "./components/ApplicationForm";
import ProjectCard from "./components/ProjectCard";
import ThankYou from "./components/ThankYou";
import { ZelligePattern } from "./components/BrandIcons";

interface JoinClientProps {
  data: PublicJoinData;
  /** YYYY-MM-DD in Morocco, from the server (keeps server and browser output identical). */
  today: string;
  formToken: string;
  initialProjectId: string;
}

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
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-colors hover:bg-[#a51f24] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-red-300 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300";

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
    <div id="top" className="relative min-h-screen overflow-x-clip bg-white text-slate-800">
      {submittedName === null && (
        <a
          href="#apply"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand-red focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          Skip to the application form
        </a>
      )}


      <main>
        {submittedName !== null ? (
          <ThankYou firstName={submittedName} org={org} onBack={backToPage} headingRef={thankYouHeadingRef} />
        ) : (
          <>
            {/* ---------- Banner ---------- */}
            <section aria-labelledby="join-hero-title" className="relative isolate overflow-hidden">
              <div
                className="absolute inset-0 -z-20 bg-[linear-gradient(135deg,#7a0f14_0%,#C1272D_45%,#d6267a_100%)]"
                aria-hidden="true"
              />
              <ZelligePattern
                id="join-hero-zellige"
                className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-white/[0.08]"
              />
              <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/80">Join us</p>
                <h1 id="join-hero-title" className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
                  Become a volunteer
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
                  Choose an open project or send a general application. It takes about 10 minutes — no experience
                  needed, just motivation and a smile.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={goToApply}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-brand-red shadow-xl shadow-black/20 transition-colors hover:bg-red-50"
                  >
                    Go to the form
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {openProjects.length > 0 && (
                    <button
                      type="button"
                      onClick={() => scrollToSection("projects", "projects-title")}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      {`See ${openProjects.length} open project${openProjects.length === 1 ? "" : "s"}`}
                    </button>
                  )}
                </div>
                {selectedProject && (
                  <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/90">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    You&apos;re applying for <span className="font-semibold">{selectedProject.name}</span>
                  </p>
                )}
              </div>
            </section>

            {/* ---------- Projects ---------- */}
            <section
              id="projects"
              aria-labelledby="projects-title"
              className="scroll-mt-20 border-b border-slate-200"
            >
              <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-red">Projects</p>
                    <h2
                      id="projects-title"
                      tabIndex={-1}
                      className="mt-2 text-2xl font-bold tracking-tight text-slate-900 focus:outline-none sm:text-3xl"
                    >
                      {projects.length > 0 ? "Projects you can join" : "Upcoming projects"}
                    </h2>
                  </div>
                  {projects.length > 0 && (
                    <p className="text-sm text-slate-600">Can&apos;t find the right one? Send a general application.</p>
                  )}
                </div>

                {projectsUnavailable && (
                  <p
                    role="status"
                    className="mt-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
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
                    <article className="flex flex-col justify-between rounded-2xl border border-dashed border-red-200 bg-red-50/60 p-5 sm:p-6">
                      <div>
                        <HeartHandshake className="h-7 w-7 text-brand-red" aria-hidden="true" />
                        <h3 className="mt-3 text-lg font-bold text-slate-900">Not sure which project?</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
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
                    <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-200 bg-red-50">
                        <Sprout className="h-7 w-7 text-brand-red" aria-hidden="true" />
                      </span>
                      <h3 className="mt-4 text-lg font-bold text-slate-900">New projects are on their way</h3>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
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
            <section id="apply" aria-labelledby="apply-title" className="scroll-mt-20 border-b border-slate-200">
              <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
                <div className="lg:sticky lg:top-24 lg:self-start">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-red">Apply</p>
                  <h2
                    id="apply-title"
                    tabIndex={-1}
                    className="mt-2 text-2xl font-bold tracking-tight text-slate-900 focus:outline-none sm:text-3xl"
                  >
                    Apply to volunteer
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    No experience needed — just motivation and a smile. Here&apos;s what happens after you apply:
                  </p>
                  <ol className="mt-6 space-y-4">
                    {STEPS.map(({ icon: Icon, title, text }, index) => (
                      <li key={title} className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50">
                          <Icon className="h-4 w-4 text-brand-red" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">
                            <span className="sr-only">Step {index + 1}: </span>
                            {title}
                          </span>
                          <span className="mt-0.5 block text-sm text-slate-600">{text}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-200/80 sm:p-8">
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

          </>
        )}
      </main>

      {/* ---------- Footer ---------- */}
    </div>
  );
}
