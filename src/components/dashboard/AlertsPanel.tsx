import Link from "next/link";
import { BellRing, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import { CARD_CLASS, CardHeading } from "./DashboardCard";
import type { AlertSeverity, AlertsResult, DashboardAlert } from "./dashboardData";

const VISIBLE_ALERTS = 5;

const SEVERITY_STYLES: Record<AlertSeverity, { row: string; icon: string; label: string; Icon: typeof Info }> = {
  danger: { row: "border-rose-500/25 bg-rose-500/5", icon: "text-rose-400", label: "Urgent", Icon: OctagonAlert },
  warning: { row: "border-amber-500/25 bg-amber-500/5", icon: "text-amber-400", label: "Warning", Icon: TriangleAlert },
  info: { row: "border-sky-500/20 bg-sky-500/5", icon: "text-sky-300", label: "Heads-up", Icon: Info },
};

function AlertItem({ alert }: { alert: DashboardAlert }) {
  const style = SEVERITY_STYLES[alert.severity];
  const Icon = style.Icon;
  return (
    <li className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${style.row}`}>
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${style.icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-white break-words">
          <span className="sr-only">{style.label}: </span>
          {alert.title}
        </p>
        {alert.detail && <p className="text-xs text-slate-400 break-words">{alert.detail}</p>}
      </div>
      {alert.href && alert.linkLabel && (
        <Link
          href={alert.href}
          aria-label={`${alert.linkLabel}: ${alert.title}`}
          className="shrink-0 self-center inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-slate-900/80 transition-colors"
        >
          <span className="hidden sm:inline">{alert.linkLabel}</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </li>
  );
}

/** Operational alerts for managers: visa days, documents, rooms, ESC label, memberships and deadlines. */
export default function AlertsPanel({ result }: { result: AlertsResult }) {
  const { alerts, unavailable } = result;
  const visible = alerts.slice(0, VISIBLE_ALERTS);
  const hidden = alerts.slice(VISIBLE_ALERTS);
  const urgent = alerts.filter((alert) => alert.severity === "danger").length;

  return (
    <section aria-labelledby="alerts-heading" className={`${CARD_CLASS} flex flex-col gap-4`}>
      <div className="flex items-center justify-between gap-3">
        <CardHeading
          id="alerts-heading"
          icon={BellRing}
          title="Alerts"
          count={alerts.length}
          iconClassName={urgent > 0 ? "text-rose-400" : alerts.length > 0 ? "text-amber-400" : "text-emerald-400"}
        />
        {urgent > 0 && (
          <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border text-rose-300 bg-rose-500/10 border-rose-500/30">
            {urgent} urgent
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-3">
          <CircleCheck className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white">All clear</p>
            <p className="text-xs text-slate-400">
              {unavailable.length > 0
                ? "Nothing to follow up in the checks that ran."
                : "No visa-day, document, room, ESC label, membership or deadline issues right now."}
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </ul>
      )}

      {hidden.length > 0 && (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            <span className="group-open:hidden">Show {hidden.length} more</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className="mt-2 space-y-2">
            {hidden.map((alert) => (
              <AlertItem key={alert.id} alert={alert} />
            ))}
          </ul>
        </details>
      )}

      {unavailable.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-slate-500">
          <CircleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-rose-400" aria-hidden="true" />
          <span>Could not check {unavailable.join(", ")} because some data failed to load.</span>
        </p>
      )}
    </section>
  );
}
