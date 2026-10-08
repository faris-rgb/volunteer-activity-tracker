"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Lock, Shield, UserCog, Users, X } from "lucide-react";
import { assignUserRoleAction } from "@/app/actions/users";
import { APP_ROLES, ROLE_LABELS, type AppRole } from "@/lib/roles";
import type { AppUserData } from "@/lib/appUsers";
import type { RoleUser } from "@/lib/auth";

interface AssignRolesClientProps {
  users: AppUserData[];
  currentUser: RoleUser;
}

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  owner: "Full access to the portal.",
  admin: "Full access to the portal — the same rights as an owner.",
  staff: "Manage volunteers, activities and attendance records.",
  volunteer: "View the dashboard, activities and attendance.",
};

const ROLE_BADGE_STYLES: Record<AppRole, string> = {
  owner: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  admin: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  staff: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  volunteer: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
};

const utcDateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const nameCollator = new Intl.Collator("en", { sensitivity: "base" });

const subscribeToNothing = () => () => {};

function getUserName(user: AppUserData): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Unnamed user";
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/** Renders in UTC on the server and during hydration, then in the viewer's own time zone. */
function JoinedDate({ createdAt }: { createdAt?: string }) {
  const isHydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const date = createdAt ? new Date(createdAt) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return <>Joined recently</>;
  }
  const label = isHydrated
    ? date.toLocaleDateString("en-US", { dateStyle: "medium" })
    : utcDateFormatter.format(date);
  return (
    <>
      Joined <time dateTime={createdAt}>{label}</time>
    </>
  );
}

function compareTeamMembers(a: AppUserData, b: AppUserData): number {
  const rankA = a.role ? APP_ROLES.indexOf(a.role) : APP_ROLES.length;
  const rankB = b.role ? APP_ROLES.indexOf(b.role) : APP_ROLES.length;
  return (
    rankA - rankB ||
    nameCollator.compare(getUserName(a), getUserName(b)) ||
    (a._id ?? a.clerkUserId).localeCompare(b._id ?? b.clerkUserId, "en")
  );
}

function RoleBadge({ role }: { role: AppRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE_STYLES[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

interface UserRoleRowProps {
  user: AppUserData;
  isSelf: boolean;
  lockReason: string | null;
  roleOptions: AppRole[];
  onAssigned: (user: AppUserData) => void;
}

function UserRoleRow({ user, isSelf, lockReason, roleOptions, onAssigned }: UserRoleRowProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState<AppRole | "">(user.role ?? "");
  const [syncedRole, setSyncedRole] = useState(user.role);
  const [error, setError] = useState<string | null>(null);

  if (user.role !== syncedRole) {
    setSyncedRole(user.role);
    setSelectedRole(user.role ?? "");
  }

  const name = getUserName(user);
  const isLocked = lockReason !== null;
  const isUnchanged = selectedRole === (user.role ?? "");
  const actionLabel = user.role ? "Update" : "Assign";
  const selectId = `role-${user._id ?? user.clerkUserId}`;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userId = user._id;
    if (isLocked || !userId) {
      return;
    }
    if (!selectedRole) {
      setError("Select a role first.");
      return;
    }
    if (
      selectedRole === "owner" &&
      !window.confirm(
        `Make ${name} an owner? Owners have full access, including changing other owners' roles.`
      )
    ) {
      return;
    }

    const role = selectedRole;
    setError(null);
    startTransition(async () => {
      try {
        const result = await assignUserRoleAction(userId, role);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onAssigned(result.data);
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
    });
  };

  return (
    <li
      className={`rounded-2xl border p-5 transition-colors ${
        isSelf ? "border-emerald-500/20 bg-emerald-500/5" : "border-slate-900 bg-slate-950/40"
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-sm font-bold text-slate-200">
            {getInitials(name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-bold text-white">{name}</h3>
              {isSelf && (
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                  You
                </span>
              )}
              {user.role && <RoleBadge role={user.role} />}
            </div>
            {user.email && user.email !== name && (
              <p className="truncate text-sm text-slate-400">{user.email}</p>
            )}
            <p className="mt-0.5 text-xs text-slate-500">
              <JoinedDate createdAt={user.createdAt} />
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center md:shrink-0"
        >
          <label htmlFor={selectId} className="sr-only">
            Role for {name}
          </label>
          <select
            id={selectId}
            value={selectedRole}
            disabled={isLocked || isPending}
            onChange={(event) => {
              setSelectedRole(event.target.value as AppRole | "");
              setError(null);
            }}
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!user.role && <option value="">Select role</option>}
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isLocked || isPending || !selectedRole || isUnchanged}
            className="min-w-[6.5rem] rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-all duration-200 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-500"
          >
            {isPending ? "Saving..." : actionLabel}
          </button>
        </form>
      </div>

      {lockReason && (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          {lockReason}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
        >
          {error}
        </p>
      )}
    </li>
  );
}

interface SectionProps {
  title: string;
  description: string;
  icon: ReactNode;
  count: number;
  children: ReactNode;
}

function Section({ title, description, icon, count, children }: SectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            {icon}
            {title}
            <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-xs font-semibold text-slate-400">
              {count}
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
        {icon}
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export default function AssignRolesClient({ users: initialUsers, currentUser }: AssignRolesClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [syncedUsers, setSyncedUsers] = useState(initialUsers);
  const [notice, setNotice] = useState<string | null>(null);

  if (initialUsers !== syncedUsers) {
    setSyncedUsers(initialUsers);
    setUsers(initialUsers);
  }

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const pendingUsers = users.filter((user) => !user.role);
  const teamMembers = users.filter((user) => user.role).sort(compareTeamMembers);

  const handleAssigned = (updated: AppUserData) => {
    setUsers((current) =>
      current.map((user) =>
        user._id === updated._id ||
        (updated.clerkUserId !== "" && user.clerkUserId === updated.clerkUserId)
          ? { ...user, ...updated }
          : user
      )
    );
    setNotice(
      `${getUserName(updated)} is now ${updated.role ? ROLE_LABELS[updated.role] : "pending"}.`
    );
    router.refresh();
  };

  const renderRow = (user: AppUserData) => {
    const isSelf = user.clerkUserId === currentUser.clerkUserId;
    let lockReason: string | null = null;
    if (isSelf) {
      lockReason = "You can't change your own role. Ask another owner or admin.";
    } else if (!user._id) {
      lockReason = "This account record is incomplete and can't be updated.";
    }
    const roleOptions = [...APP_ROLES];

    return (
      <UserRoleRow
        key={user._id ?? user.clerkUserId}
        user={user}
        isSelf={isSelf}
        lockReason={lockReason}
        roleOptions={roleOptions}
        onAssigned={handleAssigned}
      />
    );
  };

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <UserCog className="h-8 w-8 text-emerald-400" />
            Assign User Roles
          </h1>
          <p className="text-slate-400 mt-1">
            Review new sign-ins and manage access for your team.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-amber-300">
            <span className="font-bold">{pendingUsers.length}</span> pending
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-slate-300">
            <span className="font-bold">{teamMembers.length}</span> members
          </div>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded-lg p-1 text-emerald-300/70 transition-colors hover:bg-emerald-500/10 hover:text-emerald-200"
            aria-label="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {APP_ROLES.map((role) => (
          <div key={role} className="rounded-xl border border-slate-900 bg-slate-950/40 p-4">
            <RoleBadge role={role} />
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      <Section
        title="Pending"
        description="People who signed in and are waiting for access."
        icon={<Clock className="h-5 w-5 text-amber-400" />}
        count={pendingUsers.length}
      >
        {pendingUsers.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6 text-emerald-400" />}
            title="All caught up"
            description="No one is waiting for a role. New sign-ups will appear here."
          />
        ) : (
          <ul className="space-y-3">{pendingUsers.map(renderRow)}</ul>
        )}
      </Section>

      <Section
        title="Team members"
        description="Owners and admins can change anyone's role. There is always at least one owner."
        icon={<Users className="h-5 w-5 text-emerald-400" />}
        count={teamMembers.length}
      >
        {teamMembers.length === 0 ? (
          <EmptyState
            icon={<Shield className="h-6 w-6 text-slate-500" />}
            title="No team members yet"
            description="Assign a role to a pending user to add them to your team."
          />
        ) : (
          <ul className="space-y-3">{teamMembers.map(renderRow)}</ul>
        )}
      </Section>
    </div>
  );
}
