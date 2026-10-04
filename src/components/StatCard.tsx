import type { LucideIcon } from "lucide-react";

const BADGE_TONE = {
  positive: "text-emerald-400 bg-emerald-500/10",
  warning: "text-amber-400 bg-amber-500/10",
  neutral: "text-slate-400 bg-slate-800",
};

export type StatBadgeTone = keyof typeof BADGE_TONE;

export interface StatCardProps {
  title: string;
  value: string;
  badge: string;
  badgeTone: StatBadgeTone;
  caption: string;
  icon: LucideIcon;
  color: string;
}

export default function StatCard({ title, value, badge, badgeTone, caption, icon: Icon, color }: StatCardProps) {
  return (
    <div className="bg-slate-950/40 border border-slate-900 hover:border-slate-800/80 rounded-2xl p-6 transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        <div className={`p-2.5 rounded-xl bg-gradient-to-br border ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE_TONE[badgeTone]}`}>{badge}</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">{caption}</p>
      </div>
    </div>
  );
}
