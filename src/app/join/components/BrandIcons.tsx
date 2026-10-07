import type { SVGProps } from "react";

// lucide-react v1 no longer ships brand icons, so the two we need are inlined here (ISC-licensed
// lucide 0.x outlines) and styled like the other lucide icons.

function IconBase({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </IconBase>
  );
}

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </IconBase>
  );
}

/** Decorative eight-point star lattice (zellige) used behind the hero. */
export function ZelligePattern({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
          <path
            d="M18 18h20v20H18z M28 13.86L42.14 28 28 42.14 13.86 28z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <circle cx="0" cy="0" r="2" fill="currentColor" />
          <circle cx="56" cy="0" r="2" fill="currentColor" />
          <circle cx="0" cy="56" r="2" fill="currentColor" />
          <circle cx="56" cy="56" r="2" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
