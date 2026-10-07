"use client";

import React, { useEffect, useRef, useState } from "react";

export const PRESET_OTHER_VALUE = "__other__";

interface PresetFieldProps {
  /** Id of the primary control (the select, or the text input while "Other" is chosen), used by the label and error focus. */
  id: string;
  label: string;
  required?: boolean;
  options: string[];
  value: string;
  /** True while the free-text input is shown. */
  isOther: boolean;
  onChange: (value: string, isOther: boolean) => void;
  placeholder: string;
  otherLabel: string;
  otherPlaceholder: string;
  maxLength: number;
  invalid?: boolean;
  disabled?: boolean;
  inputClassName: (invalid: boolean, extra?: string) => string;
}

/** A select of preset values with an "Other…" choice that reveals a free-text input. */
export default function PresetField({
  id,
  label,
  required = false,
  options,
  value,
  isOther,
  onChange,
  placeholder,
  otherLabel,
  otherPlaceholder,
  maxLength,
  invalid = false,
  disabled = false,
  inputClassName,
}: PresetFieldProps) {
  const selectValue = isOther ? PRESET_OTHER_VALUE : options.includes(value) ? value : "";
  const selectId = isOther ? `${id}-choice` : id;
  // Focus the free-text input only when the user picks "Other…" (not when a form opens with a custom value).
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (focusRequest > 0) {
      inputRef.current?.focus();
    }
  }, [focusRequest]);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
        {label}
        {required && " *"}
      </label>
      <select
        id={selectId}
        value={selectValue}
        disabled={disabled}
        aria-label={isOther ? `${label} preset` : undefined}
        aria-invalid={invalid && !isOther ? true : undefined}
        onChange={(event) => {
          const next = event.target.value;
          if (next === PRESET_OTHER_VALUE) {
            // Keep a custom value the user already typed; drop a preset so the input starts empty.
            onChange(options.includes(value) ? "" : value, true);
            setFocusRequest((count) => count + 1);
          } else {
            onChange(next, false);
          }
        }}
        className={inputClassName(invalid && !isOther, "px-4 py-2.5 text-slate-200")}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={PRESET_OTHER_VALUE}>{otherLabel}</option>
      </select>
      {isOther && (
        <input
          ref={inputRef}
          id={id}
          type="text"
          required={required}
          maxLength={maxLength}
          value={value}
          disabled={disabled}
          aria-invalid={invalid ? true : undefined}
          onChange={(event) => onChange(event.target.value, true)}
          placeholder={otherPlaceholder}
          className={inputClassName(invalid, "px-4 py-2 text-white")}
        />
      )}
    </div>
  );
}
