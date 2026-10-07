import type { ReactNode } from "react";
import { ZelligePattern } from "@/app/join/components/BrandIcons";

/** Red banner at the top of each public page, in the style of the original website. */
export default function PageHero({
  eyebrow,
  title,
  children,
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  id: string;
}) {
  return (
    <section aria-labelledby={id} className="relative isolate overflow-hidden">
      <div
        className="absolute inset-0 -z-20 bg-[linear-gradient(135deg,#7a0f14_0%,#C1272D_45%,#d6267a_100%)]"
        aria-hidden="true"
      />
      <ZelligePattern id={`${id}-zellige`} className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-white/[0.08]" />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/80">{eyebrow}</p>
        <h1 id={id} className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
          {title}
        </h1>
        {children && <div className="mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">{children}</div>}
      </div>
    </section>
  );
}
