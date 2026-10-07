import { SignIn } from "@clerk/nextjs";
import BrandMark from "@/components/BrandMark";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-zellige opacity-[0.06]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.18),transparent_60%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-red via-emerald-500 to-brand-red" aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <BrandMark className="h-16 w-16 drop-shadow-[0_8px_24px_rgba(16,185,129,0.4)]" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-sand/80">Martil · Tetouan</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Volunteer in <span className="brand-gradient-text">Morocco</span>
        </h1>
        <p className="text-sm text-slate-400">Sign in to manage volunteers, projects, activities and stays.</p>
      </div>
      <div className="relative">
        <SignIn path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
      </div>
    </div>
  );
}
