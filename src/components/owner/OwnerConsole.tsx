import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  Code2,
  Database,
  ExternalLink,
  GitBranch,
  Globe,
  KeyRound,
  Mail,
  Rocket,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { getAppUsersAction } from "@/app/actions/users";
import { getDisplayName, type RoleUser } from "@/lib/auth";
import { isMailConfigured } from "@/lib/mailer";
import { APP_ROLES, ROLE_LABELS, type AppRole } from "@/lib/roles";
import { isSanityConfigured, sanityClient } from "@/lib/sanity";
import { SITE_URL } from "@/lib/siteUrl";

const REPO_URL = "https://github.com/faris-rgb/volunteer-activity-tracker";
const VERCEL_URL = "https://vercel.com/dashboard";
const CARD = "rounded-2xl border border-slate-800 bg-slate-950/50 p-5";

type Check = { label: string; ok: boolean; detail: string };

async function databaseStatus(): Promise<Check & { records: number | null }> {
  if (!isSanityConfigured()) {
    return { label: "Database (Sanity)", ok: false, detail: "Not configured", records: null };
  }
  try {
    const records = await sanityClient.fetch<number>(
      `count(*[_type in ["volunteer","activity","attendance","project","partner","stay","room","appUser"] && !(_id in path("drafts.**"))])`
    );
    return { label: "Database (Sanity)", ok: true, detail: `Connected · ${records} records`, records };
  } catch {
    return { label: "Database (Sanity)", ok: false, detail: "Connection failed", records: null };
  }
}

function clerkStatus(): Check {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  if (!key) return { label: "Sign-in (Clerk)", ok: false, detail: "No keys set" };
  return key.startsWith("pk_live_")
    ? { label: "Sign-in (Clerk)", ok: true, detail: "Production keys" }
    : { label: "Sign-in (Clerk)", ok: true, detail: "Development keys (shows a 'Development mode' label)" };
}

function mailStatus(): Check {
  return isMailConfigured()
    ? { label: "Email (application PDFs)", ok: true, detail: `Sends to ${process.env.APPLICATION_NOTIFY_TO || "info@cultined.org"}` }
    : { label: "Email (application PDFs)", ok: false, detail: "Not set up yet — applications are saved but not emailed" };
}

/** The owner's technical dashboard: site, code, hosting and access — no volunteer data. */
export default async function OwnerConsole({ user }: { user: RoleUser }) {
  const [database, users] = await Promise.all([databaseStatus(), getAppUsersAction().catch(() => null)]);
  const checks: Check[] = [database, clerkStatus(), mailStatus()];

  const roleCounts = APP_ROLES.map((role: AppRole) => ({
    role,
    count: users?.filter((member) => member.role === role).length ?? 0,
  }));
  const pending = users?.filter((member) => !member.role).length ?? 0;

  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const commitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0];
  const environment = process.env.VERCEL_ENV ?? "local";
  const siteUrl = SITE_URL;

  const todo = [
    !isMailConfigured() && "Set up the email account so application PDFs reach Cultined (SMTP_PASS).",
    !(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_live_") &&
      "Switch Clerk to production keys (together with the volunteerinmorocco.com domain).",
    !siteUrl.includes("volunteerinmorocco.com") && "Connect volunteerinmorocco.com to the website.",
  ].filter(Boolean) as string[];

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Code2 className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-400" />
            Owner console
          </h1>
          <p className="text-slate-400 mt-1">
            Hi {user.firstName?.trim() || getDisplayName(user)} — the technical side of the website: code, hosting,
            access and health.
          </p>
        </div>
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300"
        >
          <Globe className="h-4 w-4" />
          Open website
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className={CARD} aria-labelledby="deploy-title">
          <h2 id="deploy-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <Rocket className="h-4 w-4 text-emerald-400" /> Live version
          </h2>
          <p className="mt-3 text-2xl font-extrabold text-white">{environment === "production" ? "Online" : environment}</p>
          <p className="mt-1 break-all text-sm text-slate-400">{siteUrl.replace("https://", "")}</p>
          {commit && (
            <p className="mt-3 text-xs text-slate-500">
              Version <span className="font-mono text-slate-300">{commit}</span>
              {commitMessage ? ` — ${commitMessage}` : ""}
            </p>
          )}
        </section>

        <section className={CARD} aria-labelledby="code-title">
          <h2 id="code-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <GitBranch className="h-4 w-4 text-emerald-400" /> Code &amp; hosting
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-2.5 text-slate-200 hover:border-emerald-500/40">
                Code on GitHub <ExternalLink className="h-4 w-4 text-slate-500" />
              </a>
            </li>
            <li>
              <a href={VERCEL_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-2.5 text-slate-200 hover:border-emerald-500/40">
                Hosting on Vercel <ExternalLink className="h-4 w-4 text-slate-500" />
              </a>
            </li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">Only you have access to the code. Every change saved to GitHub goes live automatically.</p>
        </section>

        <section className={CARD} aria-labelledby="access-title">
          <h2 id="access-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <UserCog className="h-4 w-4 text-emerald-400" /> Access
          </h2>
          {users ? (
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {roleCounts.map(({ role, count }) => (
                <li key={role} className="rounded-xl border border-slate-800 px-3 py-2">
                  <span className="block text-xl font-bold text-white">{count}</span>
                  <span className="text-slate-400">{ROLE_LABELS[role]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-rose-300">Could not load the team.</p>
          )}
          <Link href="/admin/assign-roles" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 hover:underline">
            Manage roles{pending > 0 ? ` · ${pending} waiting` : ""}
          </Link>
        </section>
      </div>

      <section className={CARD} aria-labelledby="health-title">
        <h2 id="health-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" /> System health
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {checks.map((check) => (
            <li key={check.label} className="flex items-start gap-3 rounded-xl border border-slate-800 p-3">
              {check.ok ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-label="OK" />
              ) : (
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-label="Needs attention" />
              )}
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  {check.label === "Database (Sanity)" ? <Database className="h-3.5 w-3.5" /> : check.label.startsWith("Email") ? <Mail className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                  {check.label}
                </span>
                <span className="text-xs text-slate-400">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {todo.length > 0 && (
        <section className={CARD} aria-labelledby="todo-title">
          <h2 id="todo-title" className="text-sm font-bold uppercase tracking-wider text-slate-400">Technical to-do</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
            {todo.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
