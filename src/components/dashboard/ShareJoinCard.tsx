"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Check,
  CircleCheck,
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  MessageCircle,
  Share2,
  TriangleAlert,
  X,
} from "lucide-react";

const TOAST_MS = 4000;
const COPIED_MS = 2500;

const ACTION_BUTTON =
  "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white disabled:opacity-50 transition-colors";

function subscribeToNothing() {
  return () => {};
}

function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** Fallback for browsers without the async clipboard API (or when it is blocked). */
function legacyCopy(input: HTMLInputElement | null): boolean {
  if (!input) return false;
  input.focus();
  input.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

/** Absolute link to the public /join page with copy, open, WhatsApp and native share actions. */
export default function ShareJoinCard({
  joinUrl,
  organizationName,
  publicProjects,
  canManage,
}: {
  joinUrl: string;
  organizationName: string;
  /** Projects listed on the join page; null when projects failed to load. */
  publicProjects: number | null;
  canManage: boolean;
}) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"copy" | "share" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const nativeShare = useSyncExternalStore(subscribeToNothing, canNativeShare, () => false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const shareText = `Volunteer with ${organizationName} in Martil & Tetouan. Apply here: ${joinUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  async function handleCopy() {
    if (pending) return;
    setPending("copy");
    setError(null);
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(joinUrl);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      ok = legacyCopy(inputRef.current);
    }
    setPending(null);
    if (ok) {
      setCopied(true);
      setToast(
        canManage
          ? "Join page link copied. Paste it in your Instagram bio or story."
          : "Join page link copied. Send it to a friend who wants to volunteer."
      );
    } else {
      setError("Your browser blocked copying. Select the link above and copy it manually.");
      inputRef.current?.select();
    }
  }

  async function handleShare() {
    if (pending) return;
    setPending("share");
    setError(null);
    try {
      await navigator.share({
        title: `Join ${organizationName}`,
        text: `Volunteer with ${organizationName} in Martil & Tetouan.`,
        url: joinUrl,
      });
      setToast("Join page link shared.");
    } catch (shareError) {
      // Closing the share sheet is not an error.
      if (!(shareError instanceof DOMException && shareError.name === "AbortError")) {
        setError("Sharing did not work on this device. Copy the link instead.");
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="share-join-heading" className="bg-gradient-to-br from-emerald-500/10 via-slate-950/40 to-slate-950/40 border border-emerald-500/20 rounded-2xl p-5 flex flex-col gap-4">
      <div className="space-y-1">
        <h2 id="share-join-heading" className="flex items-center gap-2 text-base font-bold text-white">
          <Link2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
          {canManage ? "Share the Join Page" : "Invite a Friend"}
        </h2>
        <p className="text-xs text-slate-400">
          {canManage
            ? "Put this link in your Instagram bio and stories. New applications arrive in the pipeline as “Applied”."
            : "Know someone who would like to volunteer with us? Send them this link to apply."}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor={inputId} className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
          Join page link
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            ref={inputRef}
            type="url"
            readOnly
            value={joinUrl}
            onFocus={(event) => event.currentTarget.select()}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            className="min-w-0 flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500/50"
          />
          <button
            type="button"
            onClick={handleCopy}
            disabled={pending !== null}
            aria-label={copied ? "Link copied" : "Copy join page link"}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 disabled:opacity-60 transition-colors"
          >
            {pending === "copy" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{pending === "copy" ? "Copying…" : copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
        {error && (
          <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs text-rose-300">
            <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/join" target="_blank" rel="noopener noreferrer" className={ACTION_BUTTON}>
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open
          <span className="sr-only">(opens in a new tab)</span>
        </Link>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={ACTION_BUTTON}>
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          WhatsApp
          <span className="sr-only">(share the link, opens in a new tab)</span>
        </a>
        {nativeShare && (
          <button type="button" onClick={handleShare} disabled={pending !== null} className={ACTION_BUTTON}>
            {pending === "share" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Share2 className="h-4 w-4" aria-hidden="true" />
            )}
            {pending === "share" ? "Sharing…" : "Share…"}
          </button>
        )}
      </div>

      {canManage && publicProjects !== null && (
        <p className="text-[11px] text-slate-500 border-t border-slate-900/60 pt-3">
          {publicProjects === 0 ? (
            <>
              No projects are listed yet, so people can only apply in general.{" "}
              <Link href="/projects" className="font-semibold text-emerald-400 hover:text-emerald-300 hover:underline">
                Make a project public
              </Link>
            </>
          ) : (
            `${publicProjects} ${publicProjects === 1 ? "project is" : "projects are"} listed on the join page.`
          )}
        </p>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-[60] sm:max-w-sm flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-slate-900/95 px-4 py-3 text-sm text-emerald-300 shadow-2xl backdrop-blur"
        >
          <CircleCheck className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
