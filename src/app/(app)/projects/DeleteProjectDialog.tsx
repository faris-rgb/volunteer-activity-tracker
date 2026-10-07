"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Ban, CircleX, LoaderCircle, TriangleAlert } from "lucide-react";
import {
  deleteProjectAction,
  setProjectStatusAction,
  type ProjectLinks,
  type ProjectWithStats,
} from "@/app/actions/projects";
import { Modal, NETWORK_ERROR, SECONDARY_BUTTON, pluralize } from "./ui";

interface DeleteProjectDialogProps {
  project: ProjectWithStats;
  onClose: () => void;
  onDeleted: (projectId: string) => void;
  onCancelled: (project: ProjectWithStats) => void;
  onNotFound: (projectId: string, message: string) => void;
  onResync: () => void;
}

function describeLinks({ activities, stays, applicants, other }: ProjectLinks): string {
  const parts: string[] = [];
  if (activities > 0) parts.push(pluralize(activities, "activity", "activities"));
  if (stays > 0) parts.push(pluralize(stays, "volunteer stay"));
  if (applicants > 0) parts.push(pluralize(applicants, "applicant"));
  if (other > 0) parts.push(pluralize(other, "other record"));
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Confirms a project delete. Projects with linked activities or stays can't be deleted; the dialog
 * explains why and offers to mark the project as cancelled instead.
 */
export default function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
  onCancelled,
  onNotFound,
  onResync,
}: DeleteProjectDialogProps) {
  const [links, setLinks] = useState<ProjectLinks | null>(() =>
    project.activityCount > 0 || project.participantCount > 0
      ? { activities: project.activityCount, stays: project.participantCount, applicants: 0, other: 0 }
      : null
  );
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = deleting || cancelling;
  const encodedId = encodeURIComponent(project._id);

  const handleDelete = async () => {
    if (busy) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteProjectAction(project._id);
      if (!result.ok) {
        if (result.notFound) {
          onNotFound(project._id, result.error);
          return;
        }
        if (result.projectLinks) {
          setLinks(result.projectLinks);
          onResync();
          return;
        }
        setError(result.error);
        onResync();
        return;
      }
      onDeleted(project._id);
    } catch (caught) {
      console.error(caught);
      setError(NETWORK_ERROR);
    } finally {
      setDeleting(false);
    }
  };

  const handleMarkCancelled = async () => {
    if (busy) return;
    setCancelling(true);
    setError(null);
    try {
      const result = await setProjectStatusAction(project._id, "cancelled");
      if (!result.ok) {
        if (result.notFound) {
          onNotFound(project._id, result.error);
          return;
        }
        setError(result.error);
        onResync();
        return;
      }
      onCancelled(result.data);
    } catch (caught) {
      console.error(caught);
      setError(NETWORK_ERROR);
    } finally {
      setCancelling(false);
    }
  };

  const title = links ? "This project can't be deleted" : "Delete project";

  return (
    <Modal
      title={title}
      onClose={onClose}
      busy={busy}
      size="md"
      role="alertdialog"
      describedBy="delete-project-description"
      bare
    >
      <div className="p-6 space-y-4 overflow-y-auto">
        <div
          className={`h-12 w-12 rounded-xl border flex items-center justify-center mx-auto ${
            links ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}
        >
          <TriangleAlert className="h-6 w-6" />
        </div>

        <div className="text-center space-y-2">
          <p className="text-lg font-bold text-white" aria-hidden="true">
            {title}
          </p>
          {links ? (
            <p id="delete-project-description" className="text-xs text-slate-400 leading-relaxed">
              <span className="font-semibold text-white">{project.name}</span> has {describeLinks(links)} linked to it.
              Deleting it would break their history.{" "}
              {project.status === "cancelled"
                ? "It is already marked as cancelled."
                : "Mark it as cancelled instead to keep everything on record."}
            </p>
          ) : (
            <p id="delete-project-description" className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-white">{project.name}</span>? This
              cannot be undone.
            </p>
          )}
        </div>

        {links && (links.activities > 0 || links.stays > 0) && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {links.activities > 0 && (
              <Link
                href={`/activities?project=${encodedId}`}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                View activities
              </Link>
            )}
            {links.stays > 0 && (
              <Link
                href={`/stays?project=${encodedId}`}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                View stays
              </Link>
            )}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl px-4 py-3 text-xs"
          >
            <CircleX className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BUTTON} autoFocus>
            {links ? "Close" : "Cancel"}
          </button>
          {links ? (
            project.status !== "cancelled" && (
              <button
                type="button"
                onClick={handleMarkCancelled}
                disabled={busy}
                className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {cancelling ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                {cancelling ? "Updating..." : "Mark as Cancelled"}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-50 transition-colors"
            >
              {deleting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {deleting ? "Deleting..." : "Delete Project"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
