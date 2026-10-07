import { SignUp } from "@clerk/nextjs";
import { BrandLogo } from "@/components/BrandMark";

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-zellige opacity-[0.06]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.18),transparent_60%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 brand-rainbow" aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <BrandLogo className="w-36" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-sand/80">Martil · Tetouan</p>
        <h1 className="sr-only">Volunteer in Morocco</h1>
        <p className="max-w-sm text-sm text-slate-400">
          Create your account. An administrator will assign your role before you can access the portal.
        </p>
      </div>
      <div className="relative">
        <SignUp path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />
      </div>
    </div>
  );
}
