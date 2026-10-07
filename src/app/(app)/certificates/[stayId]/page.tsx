import type { ReactNode } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import PrintButton from "./PrintButton";
import { getStayCertificateAction } from "@/app/actions/stays";
import { getPortalSettingsAction, type PortalSettings } from "@/app/actions/settings";
import { requireRole } from "@/lib/auth";
import { MANAGER_ROLES } from "@/lib/roles";
import { formatDateKey, formatDateLabel } from "@/lib/dates";
import { diffDays } from "../../stays/components/stayUtils";

export const revalidate = 0;

const DEFAULT_ORGANIZATION = "Volunteer in Morocco";
const DEFAULT_PLACE = "Martil";

// Printing: hide everything except the certificate (the app layout and sidebar are not ours to change),
// collapse its ancestors to plain blocks and fit the sheet on one A4 landscape page.
const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  html, body { background: #ffffff !important; color: #0f172a !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
  body *:not(:has(.vim-certificate)):not(.vim-certificate):not(.vim-certificate *) { display: none !important; }
  body *:has(.vim-certificate) {
    display: block !important; position: static !important; overflow: visible !important;
    height: auto !important; min-height: 0 !important; max-width: none !important;
    margin: 0 !important; padding: 0 !important; background: #ffffff !important;
    border: 0 !important; box-shadow: none !important;
  }
  .vim-certificate {
    width: 100% !important; height: 189mm !important; max-width: none !important; margin: 0 !important;
    box-shadow: none !important; overflow: hidden !important; break-inside: avoid; page-break-inside: avoid;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
}
`;

function longDate(date: string | undefined): string {
  return formatDateLabel(date, { day: "numeric", month: "long", year: "numeric" }, "—", "en-GB");
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

async function loadSettings(): Promise<PortalSettings | null> {
  try {
    return await getPortalSettingsAction();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Failed to load portal settings for the certificate:", error);
    return null;
  }
}

function Toolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="print:hidden max-w-[1100px] mx-auto flex flex-wrap items-center justify-between gap-3 mb-4">
      <Link
        href="/stays?tab=all"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to stays
      </Link>
      {children}
    </div>
  );
}

export default async function CertificatePage({ params }: { params: Promise<{ stayId: string }> }) {
  const [, { stayId }] = await Promise.all([requireRole(MANAGER_ROLES), params]);
  const [result, settings] = await Promise.all([getStayCertificateAction(stayId), loadSettings()]);

  if (!result.ok) {
    return (
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-100 text-slate-900 p-4 sm:p-8">
        <Toolbar />
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <TriangleAlert className="h-8 w-8 text-amber-500 mx-auto" />
          <h1 className="mt-4 text-lg font-bold">Certificate unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{result.error}</p>
        </div>
      </div>
    );
  }

  const data = result.data;
  const { stay, volunteer, project } = data;
  const organizationName = settings?.organizationName?.trim() || DEFAULT_ORGANIZATION;
  const place = project?.location || settings?.locations?.[0] || DEFAULT_PLACE;
  const start = stay.arrivalDate ?? project?.startDate;
  const end = stay.departureDate ?? project?.endDate;
  const days = start && end && end > start ? diffDays(start, end) : null;
  const fullName = volunteer ? `${volunteer.firstName} ${volunteer.lastName}`.trim() : "";
  const today = formatDateKey(new Date());
  const remaining = Math.max(0, data.activitiesAttended - data.activityTitles.length);

  const notes: string[] = [];
  if (!volunteer) notes.push("The volunteer linked to this stay no longer exists.");
  if (stay.status === "cancelled") notes.push("This stay is cancelled.");
  else if (stay.status !== "completed" && (!end || end > today)) {
    notes.push("This stay is not completed yet — hours and activities may still change.");
  }
  if (data.activitiesAttended > 0 && data.totalHours === 0) {
    notes.push("No attendance hours are recorded for this period yet. Add hours on the Attendance page to show them here.");
  }
  if (data.activitiesAttended === 0) {
    notes.push("No attended activities are recorded within the stay dates.");
  }

  const reference = [
    settings?.escPic ? `PIC ${settings.escPic}` : null,
    settings?.escOid ? `OID ${settings.escOid}` : null,
    project?.escProjectCode ? `Project ${project.escProjectCode}` : null,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-200 text-slate-900 p-3 sm:p-8">
      <style>{PRINT_CSS}</style>

      <Toolbar>
        <PrintButton />
      </Toolbar>

      {notes.length > 0 && (
        <div className="print:hidden max-w-[1100px] mx-auto mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
          {notes.map((note) => (
            <p key={note} className="flex items-start gap-2">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
              {note}
            </p>
          ))}
        </div>
      )}

      <article
        className="vim-certificate mx-auto max-w-[1100px] bg-white shadow-xl p-3 sm:p-5 flex flex-col lg:aspect-[297/210]"
        aria-label={`Certificate of participation for ${fullName || "volunteer"}`}
      >
        <div className="flex-1 border-[3px] border-double border-emerald-700 p-5 sm:p-10 flex flex-col">
          <header className="text-center">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-emerald-800">{organizationName}</p>
            <h1 className="mt-3 font-serif text-3xl sm:text-5xl text-slate-900">Certificate of Participation</h1>
            <div className="mx-auto mt-4 h-px w-40 bg-emerald-700/40" />
          </header>

          <section className="mt-6 sm:mt-8 text-center">
            <p className="text-sm sm:text-base text-slate-600">This is to certify that</p>
            <p className="mt-2 font-serif text-3xl sm:text-4xl font-semibold text-slate-900">{fullName || "—"}</p>
            <p className="mt-4 text-sm sm:text-base text-slate-700 leading-relaxed max-w-3xl mx-auto">
              {volunteer?.nationality ? `from ${volunteer.nationality} ` : ""}took part in{" "}
              {project ? <strong className="font-semibold text-slate-900">{project.name}</strong> : "a volunteering placement"} with{" "}
              {organizationName} in {place}, Morocco
              {start && end ? (
                <>
                  , from <strong className="font-semibold text-slate-900">{longDate(start)}</strong> to{" "}
                  <strong className="font-semibold text-slate-900">{longDate(end)}</strong>
                </>
              ) : start ? (
                <>
                  , starting <strong className="font-semibold text-slate-900">{longDate(start)}</strong>
                </>
              ) : null}
              .
            </p>
          </section>

          <dl className="mt-6 sm:mt-8 grid grid-cols-3 gap-2 sm:gap-6 max-w-2xl w-full mx-auto text-center">
            <div className="rounded-lg border border-slate-200 px-2 py-3">
              <dt className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-500">Volunteering hours</dt>
              <dd className="mt-1 text-xl sm:text-2xl font-bold text-emerald-800">{formatHours(data.totalHours)}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 px-2 py-3">
              <dt className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-500">Activities attended</dt>
              <dd className="mt-1 text-xl sm:text-2xl font-bold text-emerald-800">{data.activitiesAttended}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 px-2 py-3">
              <dt className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-500">Days in Morocco</dt>
              <dd className="mt-1 text-xl sm:text-2xl font-bold text-emerald-800">{days ?? "—"}</dd>
            </div>
          </dl>

          {data.activityTitles.length > 0 && (
            <section className="mt-5 sm:mt-6 max-w-3xl w-full mx-auto">
              <h2 className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">
                Activities included
              </h2>
              <ul className="mt-2 columns-1 sm:columns-2 gap-8 text-xs sm:text-sm text-slate-700 list-disc pl-5">
                {data.activityTitles.map((title, index) => (
                  <li key={`${title}-${index}`} className="break-inside-avoid">
                    {title}
                  </li>
                ))}
              </ul>
              {remaining > 0 && <p className="mt-1 text-xs text-slate-500 text-center">and {remaining} more</p>}
            </section>
          )}

          <footer className="mt-auto pt-8 sm:pt-10 grid grid-cols-1 sm:grid-cols-2 gap-8 items-end">
            <div>
              <div className="h-12 border-b border-slate-400" />
              <p className="mt-2 text-xs sm:text-sm text-slate-700">For {organizationName}</p>
              <p className="text-[11px] text-slate-500">Name, role, signature and stamp</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs sm:text-sm text-slate-700">
                {place}, {longDate(today)}
              </p>
              {reference.length > 0 && (
                <p className="mt-1 text-[11px] text-slate-500">European Solidarity Corps · {reference.join(" · ")}</p>
              )}
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}
