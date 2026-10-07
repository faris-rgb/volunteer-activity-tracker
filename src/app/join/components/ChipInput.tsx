"use client";

import { useState, type KeyboardEvent } from "react";
import { Check, Plus, X } from "lucide-react";

interface ChipInputProps {
  id: string;
  /** Plural noun used in labels and messages, e.g. "languages". */
  noun: string;
  presets: string[];
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
  maxLength: number;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

function hasItem(list: string[], item: string) {
  const key = item.toLowerCase();
  return list.some((entry) => entry.toLowerCase() === key);
}

/** Toggleable preset chips plus free entry (Enter, comma or the Add button). */
export default function ChipInput({
  id,
  noun,
  presets,
  value,
  onChange,
  max,
  maxLength,
  placeholder,
  invalid,
  describedBy,
  disabled,
}: ChipInputProps) {
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const custom = value.filter((item) => !hasItem(presets, item));
  const hintId = `${id}-hint`;

  const add = (raw: string) => {
    const items = raw
      .split(",")
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (items.length === 0) {
      setDraft("");
      return;
    }
    if (items.some((item) => item.length > maxLength)) {
      setHint(`Each entry can be at most ${maxLength} characters.`);
      return;
    }
    const next = [...value];
    let message: string | null = null;
    for (const item of items) {
      if (hasItem(next, item)) continue;
      if (next.length >= max) {
        message = `You can add at most ${max} ${noun}.`;
        break;
      }
      // Reuse the preset spelling when the typed value matches one.
      next.push(presets.find((preset) => preset.toLowerCase() === item.toLowerCase()) ?? item);
    }
    setDraft("");
    setHint(message);
    if (next.length !== value.length) onChange(next);
  };

  const toggle = (item: string) => {
    if (hasItem(value, item)) {
      onChange(value.filter((entry) => entry.toLowerCase() !== item.toLowerCase()));
      setHint(null);
    } else if (value.length >= max) {
      setHint(`You can add at most ${max} ${noun}.`);
    } else {
      onChange([...value, item]);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && custom.length > 0) {
      onChange(value.filter((entry) => entry !== custom[custom.length - 1]));
    }
  };

  const describedByIds = [describedBy, hint ? hintId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2.5">
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Common ${noun}`}>
          {presets.map((preset) => {
            const selected = hasItem(value, preset);
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => toggle(preset)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                  selected
                    ? "border-red-300 bg-red-50 text-brand-red"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {selected ? (
                  <Check className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Plus className="h-3 w-3" aria-hidden="true" />
                )}
                {preset}
              </button>
            );
          })}
        </div>
      )}

      {custom.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Other ${noun} you added`}>
          {custom.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 py-1 pl-3 pr-1 text-xs font-medium text-brand-red"
            >
              {item}
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggle(item)}
                aria-label={`Remove ${item}`}
                className="rounded-full p-1 transition-colors hover:bg-emerald-500/20 hover:text-slate-900"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={draft}
          disabled={disabled}
          maxLength={maxLength * 3}
          onChange={(event) => {
            setDraft(event.target.value);
            if (hint) setHint(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) add(draft);
          }}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedByIds}
          className={`min-w-0 flex-1 rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:outline-none disabled:opacity-60 ${
            invalid ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-brand-red"
          }`}
        />
        <button
          type="button"
          disabled={disabled || !draft.trim()}
          onClick={() => add(draft)}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-red-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add
        </button>
      </div>
      {hint && (
        <p id={hintId} role="status" className="text-xs text-amber-700">
          {hint}
        </p>
      )}
    </div>
  );
}
