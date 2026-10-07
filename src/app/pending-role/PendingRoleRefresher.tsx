"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ActionResult } from "@/lib/actionResult";

const POLL_INTERVAL_MS = 10_000;

interface PendingRoleRefresherProps {
  checkRoleAction: () => Promise<ActionResult<{ hasRole: boolean }>>;
  /** Re-render the page after a successful check, e.g. when the account could not be loaded before. */
  refreshOnCheck?: boolean;
}

export default function PendingRoleRefresher({
  checkRoleAction,
  refreshOnCheck = false,
}: PendingRoleRefresherProps) {
  const router = useRouter();
  const [isChecking, startTransition] = useTransition();
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const checkNow = useCallback(() => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    startTransition(async () => {
      try {
        const result = await checkRoleAction();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        setLastChecked(new Date());
        if (result.data.hasRole) {
          router.replace("/dashboard");
        } else if (refreshOnCheck) {
          router.refresh();
        }
      } catch {
        setError("Couldn't reach the server to check your role.");
      } finally {
        inFlight.current = false;
      }
    });
  }, [checkRoleAction, refreshOnCheck, router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        checkNow();
      }
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkNow();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkNow]);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={checkNow}
        disabled={isChecking}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-all duration-200 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
        {isChecking ? "Checking..." : "Check again"}
      </button>
      <div aria-live="polite" className="text-center">
        {error ? (
          <p className="flex items-center justify-center gap-1.5 text-xs text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {`${error} Retrying every 10 seconds.`}
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            {lastChecked
              ? `Last checked at ${lastChecked.toLocaleTimeString()}. Checking every 10 seconds.`
              : "Checking automatically every 10 seconds."}
          </p>
        )}
      </div>
    </div>
  );
}
