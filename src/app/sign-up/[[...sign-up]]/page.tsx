import { SignUp } from "@clerk/nextjs";
import { HeartHandshake } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_60%)]" />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <HeartHandshake className="h-8 w-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Join ServeTrack</h1>
        <p className="max-w-sm text-sm text-slate-400">
          Create your account. An administrator will assign your role before you can access the portal.
        </p>
      </div>
      <div className="relative">
        <SignUp path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/" />
      </div>
    </div>
  );
}
