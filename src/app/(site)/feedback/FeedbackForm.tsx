"use client";

import { useRef, useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, MessageCircleHeart, Send, TriangleAlert } from "lucide-react";
import { submitFeedbackAction } from "@/app/actions/feedback";
import {
  FEEDBACK_LIMITS,
  emptyFeedback,
  validateFeedback,
  type FeedbackErrors,
  type FeedbackField,
  type FeedbackInput,
} from "@/lib/feedbackShared";

const INPUT =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-red-100";
const LABEL = "block text-sm font-semibold text-slate-800";
const OPTIONAL = <span className="font-normal text-slate-400"> (optional)</span>;

export default function FeedbackForm({ formToken }: { formToken: string }) {
  const [values, setValues] = useState<FeedbackInput>(() => emptyFeedback(formToken));
  const [errors, setErrors] = useState<FeedbackErrors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const sendingRef = useRef(false);

  const update = <K extends keyof FeedbackInput>(key: K, value: FeedbackInput[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as FeedbackField] && !current.form) return current;
      const next = { ...current };
      delete next[key as FeedbackField];
      delete next.form;
      return next;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendingRef.current) return;
    const check = validateFeedback(values);
    if (!check.data) {
      setErrors(check.errors);
      return;
    }
    sendingRef.current = true;
    setSending(true);
    try {
      const result = await submitFeedbackAction(values);
      if (result.ok) {
        setSent(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if ("formToken" in result && result.formToken) setValues((current) => ({ ...current, formToken: result.formToken! }));
      setErrors({ ...(("fieldErrors" in result && result.fieldErrors) || {}), form: result.error });
    } catch {
      setErrors({ form: "We couldn't reach our server. Check your internet connection and try again." });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-bold text-slate-900">Thank you for your feedback!</h2>
        <p className="mt-2 text-slate-600">
          We read every message. If you&apos;d like to talk about it, you&apos;re always welcome to speak to one of our
          coaches.
        </p>
      </div>
    );
  }

  const textArea = (key: "liked" | "disliked" | "improve" | "problems", label: string, placeholder: string) => (
    <div className="space-y-2">
      <label htmlFor={`fb-${key}`} className={LABEL}>
        {label}
        {OPTIONAL}
      </label>
      <textarea
        id={`fb-${key}`}
        rows={4}
        maxLength={FEEDBACK_LIMITS.text}
        value={values[key]}
        onChange={(event) => update(key, event.target.value)}
        placeholder={placeholder}
        aria-invalid={errors[key] ? true : undefined}
        disabled={sending}
        className={`${INPUT} resize-y leading-relaxed`}
      />
      {errors[key] && <p className="text-sm text-rose-600">{errors[key]}</p>}
    </div>
  );

  return (
    <form noValidate onSubmit={submit} className="space-y-8">
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
        <MessageCircleHeart className="mt-0.5 h-6 w-6 shrink-0 text-brand-red" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-slate-700">
          <strong className="text-slate-900">Everything on this page is optional.</strong> Would you rather talk? Feel
          free to speak to one of our coaches at any time — we&apos;re happy to listen.
        </p>
      </div>

      {/* Honeypot: hidden from people; bots that fill it are ignored. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="fb-website">Website</label>
        <input id="fb-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => update("website", event.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="fb-name" className={LABEL}>
            Your name{OPTIONAL}
          </label>
          <input
            id="fb-name"
            value={values.name}
            maxLength={FEEDBACK_LIMITS.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Leave empty to stay anonymous"
            autoComplete="name"
            disabled={sending}
            className={INPUT}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="fb-about" className={LABEL}>
            Project or activity{OPTIONAL}
          </label>
          <input
            id="fb-about"
            value={values.about}
            maxLength={FEEDBACK_LIMITS.about}
            onChange={(event) => update("about", event.target.value)}
            placeholder="e.g. Malabis Share, beach clean-up"
            disabled={sending}
            className={INPUT}
          />
        </div>
      </div>

      {textArea("liked", "What was fun?", "What did you enjoy the most?")}
      {textArea("disliked", "What was not fun?", "What didn't you like?")}
      {textArea("improve", "What could be better?", "Your ideas and tips for us")}

      <fieldset className="space-y-3">
        <legend className={LABEL}>
          Were there any problems?{OPTIONAL}
        </legend>
        <div className="flex gap-3">
          {(["yes", "no"] as const).map((answer) => (
            <label
              key={answer}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold ${
                values.hadProblems === answer ? "border-brand-red bg-red-50 text-brand-red" : "border-slate-300 text-slate-700 hover:border-slate-400"
              }`}
            >
              <input
                type="radio"
                name="hadProblems"
                value={answer}
                checked={values.hadProblems === answer}
                onChange={() => update("hadProblems", answer)}
                disabled={sending}
                className="accent-[#C1272D]"
              />
              {answer === "yes" ? "Yes" : "No"}
            </label>
          ))}
          {values.hadProblems && (
            <button type="button" onClick={() => update("hadProblems", "")} className="text-sm text-slate-500 underline">
              Clear
            </button>
          )}
        </div>
      </fieldset>

      {values.hadProblems === "yes" &&
        textArea("problems", "Which problems?", "Tell us what happened — we treat this confidentially.")}

      <div className="space-y-3 border-t border-slate-200 pt-6">
        {errors.form && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {errors.form}
          </p>
        )}
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-red-500/25 transition-colors hover:bg-[#a51f24] disabled:opacity-70"
        >
          {sending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          {sending ? "Sending…" : "Send feedback"}
        </button>
      </div>
    </form>
  );
}
