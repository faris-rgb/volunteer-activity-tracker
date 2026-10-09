"use client";

import { useState, type KeyboardEvent } from "react";
import { Check, Plus, X } from "lucide-react";

interface ChipPickerProps {
  id: string;
  /** Plural noun used in messages, e.g. "skills". */
  noun: string;
  presets: string[];
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}

function hasItem(list: string[], item: string) {
  const key = item.toLowerCase();
  return list.some((entry) => entry.toLowerCase() === key);
}

/** Toggleable preset chips plus free entry (Enter, comma or the Add button). */
export default function ChipPicker({
  id,
  noun,
  presets,
  value,
  onChange,
  max = 30,
  maxLength = 60,
  placeholder,
  invalid,
  describedBy,
}: ChipPickerProps) {
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const custom = value.filter((item) => !hasItem(presets, item));
  const atLimit = value.length >= max;

  const add = (raw: string) => {
    const items = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (items.length === 0) {
      setDraft("");
      return;
    }
    if (items.some((item) => item.length > maxLength)) {
      setHint(`Each entry must be at most ${maxLength} characters.`);
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
      // Reuse the preset's spelling when the typed value matches one.
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
    } else if (atLimit) {
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

  return (
    <div className="space-y-2">
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Common ${noun}`}>
          {presets.map((preset) => {
            const selected = hasItem(value, preset);
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(preset)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selected
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                }`}
              >
                {selected ? <Check className="h-3 w-3" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
                {preset}
              </button>
            );
          })}
        </div>
      )}

      {custom.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label={`Other ${noun}`}>
          {custom.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium border bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
            >
              {item}
              <button
                type="button"
                onClick={() => toggle(item)}
                aria-label={`Remove ${item}`}
                className="p-0.5 rounded-full hover:bg-emerald-500/20 hover:text-white transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={draft}
          maxLength={maxLength * 3}
          onChange={(event) => {
            setDraft(event.target.value);
            if (hint) setHint(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) add(draft);
          }}
          placeholder={placeholder ?? `Add another ${noun.replace(/s$/, "")}…`}
          disabled={atLimit && !draft}
          aria-invalid={invalid || !!hint}
          aria-describedby={[describedBy, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined}
          className={`flex-1 min-w-0 bg-slate-950 border rounded-xl px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors disabled:opacity-50 ${
            invalid || hint ? "border-rose-500/60 focus:border-rose-400" : "border-slate-800 focus:border-emerald-500/50"
          }`}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          aria-label={`Add ${noun.replace(/s$/, "")}`}
          className="shrink-0 inline-flex items-center gap-1 px-3 rounded-xl text-sm font-semibold border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-rose-400">
          {hint}
        </p>
      )}
    </div>
  );
}
