"use client";

import type { Ref } from "react";
import { ArrowLeft, CircleCheckBig, Mail, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/domain";
import type { PublicOrgInfo } from "../joinShared";
import { InstagramIcon } from "./BrandIcons";

const NEXT_STEPS = [
  { title: "We read your application", text: "Someone from our team in Martil looks at it personally." },
  { title: "We get in touch", text: "Expect a WhatsApp message or an email to plan a short get-to-know-you chat." },
  { title: "We plan together", text: "We pick the project, dates and tasks that suit you best." },
];

export default function ThankYou({
  firstName,
  org,
  onBack,
  headingRef,
}: {
  firstName: string;
  org: PublicOrgInfo;
  onBack: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const whatsapp = whatsappLink(org.contactPhone);

  return (
    <section aria-labelledby="join-thank-you-title" className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="rounded-3xl border border-red-200 bg-slate-900/80 p-6 text-center shadow-2xl shadow-emerald-500/5 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50">
          <CircleCheckBig className="h-8 w-8 text-brand-red" aria-hidden="true" />
        </div>
        <h1
          id="join-thank-you-title"
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-2xl font-bold tracking-tight text-slate-900 focus:outline-none sm:text-3xl"
        >
          Thank you{firstName ? `, ${firstName}` : ""}!
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          Your application has reached {org.organizationName}. We&apos;ll contact you on WhatsApp or by email within a
          few days.
        </p>

        <ol className="mt-8 space-y-3 text-left">
          {NEXT_STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-red text-xs font-bold text-white"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">{step.title}</span>
                <span className="mt-0.5 block text-sm text-slate-600">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>

        {(org.instagramUrl || org.contactEmail || whatsapp) && (
          <div className="mt-8 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap">
            {org.instagramUrl && (
              <a
                href={org.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:border-red-300 hover:bg-slate-100"
              >
                <InstagramIcon className="h-4 w-4" />
                Follow us on Instagram
              </a>
            )}
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:border-red-300 hover:bg-slate-100"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                WhatsApp us
              </a>
            )}
            {org.contactEmail && (
              <a
                href={`mailto:${org.contactEmail}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:border-red-300 hover:bg-slate-100"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email us
              </a>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand-red transition-colors hover:text-[#a51f24]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the projects
        </button>
      </div>
    </section>
  );
}
