import Image from "next/image";

/** The Volunteer in Morocco petal mark on a white tile (the logo is made for a light background). */
export default function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm ${className}`}>
      <Image src="/brand/vim-mark.png" alt="" width={256} height={256} className="h-full w-full object-contain" priority />
    </span>
  );
}

/** The full Volunteer in Morocco logo (petals + wordmark) on a white card. */
export function BrandLogo({ className = "w-40" }: { className?: string }) {
  return (
    <span className={`inline-block overflow-hidden rounded-3xl bg-white p-2 shadow-xl shadow-black/30 ${className}`}>
      <Image
        src="/brand/vim-logo.jpg"
        alt="Volunteer in Morocco"
        width={720}
        height={720}
        className="h-auto w-full"
        priority
      />
    </span>
  );
}
