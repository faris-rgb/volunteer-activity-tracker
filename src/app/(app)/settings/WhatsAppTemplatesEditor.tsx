"use client";

import { useRef } from "react";
import { ArrowDown, ArrowUp, Eye, ListRestart, MessageSquareText, Plus, Trash2, TriangleAlert } from "lucide-react";
import { DEFAULT_WHATSAPP_TEMPLATES, fillTemplate } from "@/lib/domain";
import { SETTINGS_LIMITS, TEMPLATE_PLACEHOLDERS, unknownPlaceholders } from "@/sanity/schemas/settings";

/** A template being edited. `key` is null for templates added since the last save (assigned on save). */
export interface TemplateDraft {
  id: string;
  key: string | null;
  label: string;
  text: string;
}

interface WhatsAppTemplatesEditorProps {
  templates: TemplateDraft[];
  organizationName: string;
  errors: Record<string, string | undefined>;
  /** Id of a template added in this session; its label input receives focus when it mounts. */
  focusTemplateId: string | null;
  onChange: (templates: TemplateDraft[]) => void;
  onAdd: () => void;
  onRestoreDefaults: () => void;
}

export function templateFieldErrorKey(templateId: string, field: "label" | "text"): string {
  return `template:${templateId}:${field}`;
}

export function defaultTemplateDrafts(): TemplateDraft[] {
  return DEFAULT_WHATSAPP_TEMPLATES.map((template) => ({
    id: `saved:${template.key}`,
    key: template.key,
    label: template.label,
    text: template.text,
  }));
}

const textareaClassName =
  "w-full bg-slate-900/60 border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-60";

export default function WhatsAppTemplatesEditor({
  templates,
  organizationName,
  errors,
  focusTemplateId,
  onChange,
  onAdd,
  onRestoreDefaults,
}: WhatsAppTemplatesEditorProps) {
  const sampleValues = {
    firstName: "Sara",
    project: "Malabis Share",
    date: "12 Oct",
    time: "14:30",
    org: organizationName.trim() || "your organisation",
  };

  const updateTemplate = (id: string, changes: Partial<Pick<TemplateDraft, "label" | "text">>) => {
    onChange(templates.map((template) => (template.id === id ? { ...template, ...changes } : template)));
  };

  const moveTemplate = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= templates.length) {
      return;
    }
    const next = [...templates];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const removeTemplate = (id: string) => {
    onChange(templates.filter((template) => template.id !== id));
  };

  const isFull = templates.length >= SETTINGS_LIMITS.templates;
  const matchesDefaults =
    templates.length === DEFAULT_WHATSAPP_TEMPLATES.length &&
    templates.every(
      (template, index) =>
        template.key === DEFAULT_WHATSAPP_TEMPLATES[index].key &&
        template.label === DEFAULT_WHATSAPP_TEMPLATES[index].label &&
        template.text === DEFAULT_WHATSAPP_TEMPLATES[index].text
    );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-900 bg-slate-900/20 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Placeholders</p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
            <div key={placeholder.key} className="flex items-baseline gap-2 text-xs">
              <dt>
                <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-emerald-300">{`{${placeholder.key}}`}</code>
              </dt>
              <dd className="text-slate-500">{placeholder.description}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[11px] text-slate-600">
          Placeholders are filled in when a message is opened in WhatsApp. Anything the portal does not know is left
          empty.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center space-y-3">
          <MessageSquareText className="mx-auto h-8 w-8 text-slate-600" />
          <div>
            <p className="text-sm font-semibold text-white">No WhatsApp templates</p>
            <p className="text-xs text-slate-500">Add at least one so staff can message volunteers in one tap.</p>
          </div>
          {errors.whatsappTemplates && (
            <p id="whatsappTemplates-error" className="text-xs text-rose-400">
              {errors.whatsappTemplates}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onAdd}
              data-invalid={errors.whatsappTemplates ? "true" : undefined}
              aria-describedby={errors.whatsappTemplates ? "whatsappTemplates-error" : undefined}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              Add template
            </button>
            <button
              type="button"
              onClick={onRestoreDefaults}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200"
            >
              <ListRestart className="h-4 w-4" />
              Restore default templates
            </button>
          </div>
        </div>
      ) : (
        <ol className="space-y-4">
          {templates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              index={index}
              total={templates.length}
              preview={fillTemplate(template.text, sampleValues)}
              labelError={errors[templateFieldErrorKey(template.id, "label")]}
              textError={errors[templateFieldErrorKey(template.id, "text")]}
              autoFocusLabel={template.id === focusTemplateId}
              onChange={(changes) => updateTemplate(template.id, changes)}
              onMove={(direction) => moveTemplate(index, direction)}
              onRemove={() => removeTemplate(template.id)}
            />
          ))}
        </ol>
      )}

      {templates.length > 0 && (
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={onRestoreDefaults}
            disabled={matchesDefaults}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ListRestart className="h-3.5 w-3.5" />
            Restore default templates
          </button>
          <button
            type="button"
            onClick={onAdd}
            disabled={isFull}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            {isFull ? `Maximum of ${SETTINGS_LIMITS.templates} templates` : "Add template"}
          </button>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  index,
  total,
  preview,
  labelError,
  textError,
  autoFocusLabel,
  onChange,
  onMove,
  onRemove,
}: {
  template: TemplateDraft;
  index: number;
  total: number;
  preview: string;
  labelError?: string;
  textError?: string;
  autoFocusLabel: boolean;
  onChange: (changes: Partial<Pick<TemplateDraft, "label" | "text">>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const baseId = `template-${template.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const labelId = `${baseId}-label`;
  const textId = `${baseId}-text`;
  const name = template.label.trim() || `template ${index + 1}`;
  const unknown = unknownPlaceholders(template.text);

  const insertPlaceholder = (key: string) => {
    const token = `{${key}}`;
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? template.text.length;
    const end = textarea?.selectionEnd ?? template.text.length;
    const nextText = `${template.text.slice(0, start)}${token}${template.text.slice(end)}`;
    if (nextText.length > SETTINGS_LIMITS.templateText) {
      return;
    }
    onChange({ text: nextText });
    requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (element) {
        element.focus();
        element.setSelectionRange(start + token.length, start + token.length);
      }
    });
  };

  const iconButtonClassName =
    "rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors";

  return (
    <li className="rounded-xl border border-slate-900 bg-slate-900/20 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor={labelId} className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Template name
          </label>
          <input
            id={labelId}
            type="text"
            value={template.label}
            maxLength={SETTINGS_LIMITS.templateLabel}
            placeholder="e.g. Pickup confirmed"
            // Focus the label of a template the user just added.
            autoFocus={autoFocusLabel}
            onChange={(event) => onChange({ label: event.target.value })}
            aria-invalid={!!labelError}
            aria-describedby={labelError ? `${labelId}-error` : undefined}
            className={`w-full bg-slate-900/60 border rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-60 ${
              labelError ? "border-rose-500/60" : "border-slate-800"
            }`}
          />
          {labelError && (
            <p id={`${labelId}-error`} className="text-xs text-rose-400">
              {labelError}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 pt-6">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Move ${name} up`}
            className={iconButtonClassName}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label={`Move ${name} down`}
            className={iconButtonClassName}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Delete ${name}`}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={textId} className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Message
          </label>
          <span className="text-[11px] text-slate-600 tabular-nums">
            {template.text.length} / {SETTINGS_LIMITS.templateText}
          </span>
        </div>
        <textarea
          ref={textareaRef}
          id={textId}
          rows={3}
          value={template.text}
          maxLength={SETTINGS_LIMITS.templateText}
          placeholder="Hi {firstName}, ..."
          onChange={(event) => onChange({ text: event.target.value })}
          aria-invalid={!!textError}
          aria-describedby={`${textError ? `${textId}-error ` : ""}${textId}-placeholders`}
          className={`${textareaClassName} resize-y ${textError ? "border-rose-500/60" : "border-slate-800"}`}
        />
        {textError && (
          <p id={`${textId}-error`} className="text-xs text-rose-400">
            {textError}
          </p>
        )}
        {!textError && unknown.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-amber-300">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            Unknown placeholder {unknown.map((key) => `{${key}}`).join(", ")}. Use one of the buttons below.
          </p>
        )}
        <div id={`${textId}-placeholders`} className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-slate-500">Insert:</span>
          {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
            <button
              key={placeholder.key}
              type="button"
              onClick={() => insertPlaceholder(placeholder.key)}
              aria-label={`Insert {${placeholder.key}} (${placeholder.description}) into ${name}`}
              className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-emerald-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-colors"
            >
              {`{${placeholder.key}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-400/80">
          <Eye className="h-3.5 w-3.5" />
          Preview
          {template.key && (
            <span className="ml-auto font-mono normal-case tracking-normal text-slate-600" title="Template key">
              {template.key}
            </span>
          )}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-300">
          {preview.trim() || <span className="text-slate-600">The message preview appears here.</span>}
        </p>
      </div>
    </li>
  );
}
