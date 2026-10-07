import { BadgeCheck, Cake, CircleAlert, Clock, TriangleAlert } from "lucide-react";
import {
  PIPELINE_STAGE_LABELS,
  VOLUNTEER_TYPE_LABELS,
  type Membership,
  type PipelineStage,
  type VolunteerType,
} from "@/lib/domain";
import { formatDateLabel } from "@/lib/dates";
import {
  PIPELINE_STAGE_STYLES,
  VOLUNTEER_TYPE_SHORT_LABELS,
  VOLUNTEER_TYPE_STYLES,
  getAge,
  getMembershipState,
  isOutsideEscAge,
} from "./volunteerUtils";

const BADGE = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap";

export function TypeBadge({ type }: { type?: VolunteerType }) {
  if (!type) return null;
  return (
    <span className={`${BADGE} ${VOLUNTEER_TYPE_STYLES[type]}`} title={VOLUNTEER_TYPE_LABELS[type]}>
      {VOLUNTEER_TYPE_SHORT_LABELS[type]}
    </span>
  );
}

export function StageBadge({ stage }: { stage?: PipelineStage }) {
  if (!stage) {
    return <span className={`${BADGE} text-slate-500 bg-slate-900 border-slate-800`}>No stage</span>;
  }
  const style = PIPELINE_STAGE_STYLES[stage];
  return (
    <span className={`${BADGE} ${style.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {PIPELINE_STAGE_LABELS[stage]}
    </span>
  );
}

/** Age from date of birth; flags incoming ESC volunteers outside the 18-30 range. */
export function AgeBadge({
  dateOfBirth,
  volunteerType,
  today,
}: {
  dateOfBirth?: string;
  volunteerType?: VolunteerType;
  today: string;
}) {
  const age = getAge(dateOfBirth, today);
  if (age === null) return null;
  const warn = volunteerType === "incoming_esc" && isOutsideEscAge(age);
  return (
    <span
      className={`${BADGE} ${
        warn ? "text-amber-300 bg-amber-500/10 border-amber-500/30" : "text-slate-300 bg-slate-900 border-slate-800"
      }`}
      title={warn ? "Outside the ESC age range of 18-30" : `Born ${formatDateLabel(dateOfBirth, { dateStyle: "medium" })}`}
    >
      {warn ? <TriangleAlert className="h-3 w-3" aria-hidden="true" /> : <Cake className="h-3 w-3" aria-hidden="true" />}
      {age} yrs
      {warn && <span className="sr-only"> (outside ESC age 18-30)</span>}
    </span>
  );
}

export function MembershipBadge({
  membership,
  today,
  showNone = false,
}: {
  membership?: Membership;
  today: string;
  showNone?: boolean;
}) {
  const state = getMembershipState(membership, today);
  const paidUntil = membership?.paidUntil
    ? formatDateLabel(membership.paidUntil, { day: "numeric", month: "short", year: "numeric" })
    : "";

  if (state === "none") {
    return showNone ? <span className="text-slate-600 text-sm">—</span> : null;
  }
  if (state === "active") {
    return (
      <span className={`${BADGE} text-emerald-300 bg-emerald-500/10 border-emerald-500/20`} title={`Paid until ${paidUntil}`}>
        <BadgeCheck className="h-3 w-3" aria-hidden="true" />
        Member · until {paidUntil}
      </span>
    );
  }
  if (state === "expired") {
    return (
      <span className={`${BADGE} text-rose-300 bg-rose-500/10 border-rose-500/20`} title={`Expired on ${paidUntil}`}>
        <Clock className="h-3 w-3" aria-hidden="true" />
        Expired {paidUntil}
      </span>
    );
  }
  return (
    <span className={`${BADGE} text-amber-300 bg-amber-500/10 border-amber-500/20`} title="Member without a recorded payment">
      <CircleAlert className="h-3 w-3" aria-hidden="true" />
      Member · unpaid
    </span>
  );
}
