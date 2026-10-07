"use client";

import type { ReactNode } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Modal } from "./ui";

export default function ConfirmDialog({
  id,
  title,
  children,
  confirmLabel,
  busyLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  id: string;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal titleId={`${id}-title`} title={title} onClose={onCancel} busy={busy} role="alertdialog">
      <div className="p-6 space-y-4">
        <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
          <TriangleAlert className="h-6 w-6" />
        </div>
        <div className="text-center text-sm text-slate-400 leading-relaxed">{children}</div>
        {error && (
          <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            {error}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-50 transition-colors"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
