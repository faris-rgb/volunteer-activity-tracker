"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { DEFAULT_LOCATIONS, type Room } from "@/lib/domain";
import { createRoomAction, updateRoomAction, type RoomInput } from "@/app/actions/rooms";
import { FormField, Modal, callAction, inputClassName } from "./ui";

const MAX_BEDS = 50;

interface RoomForm {
  name: string;
  location: string;
  beds: string;
  notes: string;
}

type RoomErrors = Partial<Record<keyof RoomForm, string>>;

export default function RoomModal({
  room,
  rooms,
  locations,
  onClose,
  onSaved,
}: {
  room: Room | null;
  rooms: Room[];
  locations: string[];
  onClose: () => void;
  onSaved: (room: Room, created: boolean) => void;
}) {
  const [form, setForm] = useState<RoomForm>(() => ({
    name: room?.name ?? "",
    location: room?.location ?? locations[0] ?? DEFAULT_LOCATIONS[0],
    beds: String(room?.beds ?? 2),
    notes: room?.notes ?? "",
  }));
  const [errors, setErrors] = useState<RoomErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof RoomForm>(key: K, value: RoomForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const next: RoomErrors = {};
    const name = form.name.trim();
    if (!name) next.name = "Room name is required.";
    else if (rooms.some((item) => item._id !== room?._id && item.name.toLowerCase() === name.toLowerCase())) {
      next.name = "Another room already has this name.";
    }
    const beds = Number(form.beds);
    if (!Number.isInteger(beds) || beds < 1 || beds > MAX_BEDS) next.beds = `Enter a whole number from 1 to ${MAX_BEDS}.`;
    if (form.notes.length > 1000) next.notes = "Notes must be at most 1000 characters.";
    setErrors(next);
    const firstInvalid = (["name", "beds", "notes"] as const).find((key) => next[key]);
    if (firstInvalid) {
      document.getElementById(`room-${firstInvalid}`)?.focus();
      return;
    }

    const payload: RoomInput = {
      name,
      location: form.location.trim() || undefined,
      beds,
      notes: form.notes.trim() || undefined,
    };
    setFormError(null);
    setSaving(true);
    const result = await callAction(() => (room ? updateRoomAction(room._id, payload) : createRoomAction(payload)));
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    onSaved(result.data, !room);
  };

  const locationOptions = Array.from(new Set([...locations, ...(form.location ? [form.location] : [])]));

  return (
    <Modal titleId="room-form-title" title={room ? "Edit room" : "Add room"} onClose={onClose} busy={saving}>
      <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 overflow-y-auto">
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
            {formError}
          </div>
        )}
        <FormField id="room-name" label="Room name *" error={errors.name}>
          <input
            id="room-name"
            type="text"
            autoFocus
            maxLength={80}
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="e.g. Volunteer house – room 1"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "room-name-error" : undefined}
            className={inputClassName(errors.name)}
          />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField id="room-location" label="Location">
            <select
              id="room-location"
              value={form.location}
              onChange={(event) => update("location", event.target.value)}
              className={inputClassName()}
            >
              <option value="">Not set</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="room-beds" label="Beds *" error={errors.beds}>
            <input
              id="room-beds"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_BEDS}
              step={1}
              value={form.beds}
              onChange={(event) => update("beds", event.target.value)}
              aria-invalid={!!errors.beds}
              aria-describedby={errors.beds ? "room-beds-error" : undefined}
              className={inputClassName(errors.beds)}
            />
          </FormField>
        </div>
        <FormField id="room-notes" label="Notes" error={errors.notes} hint="e.g. women only, ground floor, shared bathroom">
          <textarea
            id="room-notes"
            rows={3}
            maxLength={1000}
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            className={`${inputClassName(errors.notes)} resize-none`}
          />
        </FormField>
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : room ? "Save changes" : "Add room"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
