"use client";

import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { ListRestart, Plus, X } from "lucide-react";
import { SETTINGS_LIMITS } from "@/sanity/schemas/settings";

interface TagListEditorProps {
  id: string;
  title: string;
  description: string;
  placeholder: string;
  tags: string[];
  defaults: readonly string[];
  draft: string;
  error?: string;
  onChange: (tags: string[]) => void;
  onDraftChange: (draft: string) => void;
}

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag, index) => tag === b[index]);
}

/** Editable list of preset values (chips with remove buttons, an input to add more, restore defaults). */
export default function TagListEditor({
  id,
  title,
  description,
  placeholder,
  tags,
  defaults,
  draft,
  error,
  onChange,
  onDraftChange,
}: TagListEditorProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const shownError = localError ?? error;
  const isFull = tags.length >= SETTINGS_LIMITS.tagsPerList;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  /** Adds comma/newline separated values, skipping duplicates. */
  const addValues = (raw: string) => {
    const candidates = raw
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (candidates.length === 0) {
      setLocalError(null);
      onDraftChange("");
      return;
    }

    const next = [...tags];
    const existing = new Set(tags.map((tag) => tag.toLocaleLowerCase()));
    const duplicates: string[] = [];
    for (const value of candidates) {
      if (value.length > SETTINGS_LIMITS.tagLength) {
        setLocalError(
          `"${value.slice(0, 24)}${value.length > 24 ? "..." : ""}" is longer than ${SETTINGS_LIMITS.tagLength} characters.`
        );
        return;
      }
      if (existing.has(value.toLocaleLowerCase())) {
        duplicates.push(value);
        continue;
      }
      if (next.length >= SETTINGS_LIMITS.tagsPerList) {
        setLocalError(`You can add up to ${SETTINGS_LIMITS.tagsPerList} entries.`);
        onChange(next);
        // The input is disabled once the list is full, so a leftover draft could never be cleared
        // (and would block saving).
        onDraftChange("");
        return;
      }
      existing.add(value.toLocaleLowerCase());
      next.push(value);
    }

    if (next.length !== tags.length) {
      onChange(next);
    }
    onDraftChange("");
    setLocalError(duplicates.length ? `Already in the list: ${duplicates.join(", ")}.` : null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      // Enter would otherwise submit the whole settings form.
      event.preventDefault();
      addValues(draft);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (/[,\n]/.test(text)) {
      event.preventDefault();
      addValues(`${draft}${text}`);
    }
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, tagIndex) => tagIndex !== index));
    setLocalError(null);
  };

  const restoreDefaults = () => {
    onChange([...defaults]);
    onDraftChange("");
    setLocalError(null);
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-900 bg-slate-900/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <label htmlFor={id} className="text-sm font-semibold text-white block">
            {title}
          </label>
          <p id={hintId} className="text-xs text-slate-500">
            {description}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-slate-500 tabular-nums">
          {tags.length} / {SETTINGS_LIMITS.tagsPerList}
        </span>
      </div>

      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={`${title} entries`}>
          {tags.map((tag, index) => (
            <li
              key={tag}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 py-1 pl-3 pr-1 text-xs font-semibold text-emerald-300"
            >
              <span className="truncate">{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(index)}
                aria-label={`Remove ${tag}`}
                className="shrink-0 rounded-full p-0.5 text-emerald-400/70 hover:bg-emerald-500/20 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-800 px-3 py-2 text-xs text-slate-500">
          No entries yet. Add at least one below, or restore the defaults.
        </p>
      )}

      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={draft}
          disabled={isFull}
          maxLength={SETTINGS_LIMITS.tagLength * 4}
          placeholder={isFull ? "List is full" : placeholder}
          onChange={(event) => {
            onDraftChange(event.target.value);
            if (localError) {
              setLocalError(null);
            }
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          aria-invalid={!!shownError}
          aria-describedby={shownError ? `${errorId} ${hintId}` : hintId}
          className={`min-w-0 flex-1 bg-slate-900/60 border rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-60 ${
            shownError ? "border-rose-500/60" : "border-slate-800"
          }`}
        />
        <button
          type="button"
          onClick={() => addValues(draft)}
          disabled={!draft.trim() || isFull}
          aria-label={`Add to ${title.toLowerCase()}`}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {shownError ? (
          <p id={errorId} className="text-xs text-rose-400">
            {shownError}
          </p>
        ) : (
          <p className="text-[11px] text-slate-600">Press Enter to add. Separate several entries with commas.</p>
        )}
        <button
          type="button"
          onClick={restoreDefaults}
          disabled={sameTags(tags, defaults) && !draft}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ListRestart className="h-3.5 w-3.5" />
          Restore defaults
        </button>
      </div>
    </div>
  );
}
