import { redirect, unstable_rethrow } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import { AlertTriangle, Clock, LogOut, ShieldAlert } from "lucide-react";
import { getDisplayName, getOrCreateAppUser } from "@/lib/auth";
import { getAppUserByClerkId, type AppUserData } from "@/lib/appUsers";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { APP_ROLES, ROLE_LABELS } from "@/lib/roles";
import PendingRoleRefresher from "./PendingRoleRefresher";

async function checkRoleAssignedAction(): Promise<ActionResult<{ hasRole: boolean }>> {
  "use server";
  try {
    const { userId } = await auth();
    if (!userId) {
      return actionError(null, "Your session has ended. Sign out and sign in again.");
    }
    const appUser = await getAppUserByClerkId(userId);
    return actionOk({ hasRole: Boolean(appUser?.role) });
  } catch (error) {
    console.error("Failed to check role assignment:", error);
    return actionError(null, "Couldn't check your role right now.");
  }
}

function SignOutControls() {
  return (
    <div className="mt-8 flex items-center justify-center gap-4 border-t border-slate-800 pt-6">
      <UserButton />
      <SignOutButton redirectUrl="/sign-in">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-900 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </SignOutButton>
    </div>
  );
}

export default async function PendingRolePage() {
  let appUser: AppUserData | null = null;
  let loadFailed = false;
  try {
    appUser = await getOrCreateAppUser();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Failed to load the pending account:", error);
    loadFailed = true;
  }

  if (!loadFailed && !appUser) {
    redirect("/sign-in");
  }

  if (appUser?.role) {
    redirect("/");
  }

  if (!appUser) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950/60 p-8 text-center shadow-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10">
            <AlertTriangle className="h-8 w-8 text-rose-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">We couldn&apos;t load your account</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            This is usually temporary. We&apos;ll keep trying automatically, or you can check again
            now.
          </p>
          <div className="mt-8">
            <PendingRoleRefresher checkRoleAction={checkRoleAssignedAction} refreshOnCheck />
          </div>
          <SignOutControls />
        </div>
      </div>
    );
  }

  const displayName = getDisplayName(appUser);
  const roleList = APP_ROLES.map((role) => ROLE_LABELS[role]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950/60 p-8 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
          <Clock className="h-8 w-8 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Role Assignment Pending</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Welcome, <span className="font-medium text-slate-200">{displayName}</span>. Your account
          has been created and is waiting for an owner or administrator to assign your role before
          you can access the portal.
        </p>
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-left">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="text-xs text-slate-400">
            <p>You will be given one of the following roles:</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {roleList.map((label) => (
                <li
                  key={label}
                  className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 font-medium text-slate-300"
                >
                  {label}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              This page checks for updates automatically and redirects you as soon as your role
              has been assigned.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <PendingRoleRefresher checkRoleAction={checkRoleAssignedAction} />
        </div>

        <SignOutControls />
      </div>
    </div>
  );
}
