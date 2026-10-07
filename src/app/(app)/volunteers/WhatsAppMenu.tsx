"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, MessageCircle, MessageSquarePlus, SquarePen, TriangleAlert, X } from "lucide-react";
import { fillTemplate, whatsappLink, type WhatsAppTemplate } from "@/lib/domain";

interface WhatsAppMenuProps {
  firstName: string;
  name: string;
  phone?: string;
  templates: WhatsAppTemplate[];
  organizationName: string;
  /** Called after a wa.me chat was opened in a new tab. */
  onOpened?: (message: string) => void;
  disabled?: boolean;
}

const MENU_WIDTH = 256;
const MAX_MESSAGE_LENGTH = 1000;
const KNOWN_PLACEHOLDERS = new Set(["firstName", "org"]);
const MARKER_PATTERN = /\[[a-zA-Z]+\]/;

/** Placeholders other than {firstName} and {org}, which the user must fill in before sending. */
function missingPlaceholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).filter((key) => !KNOWN_PLACEHOLDERS.has(key));
}

/**
 * WhatsApp click-to-chat button with a menu of message templates from Settings.
 * Templates that need more details ({project}, {date}, {time}) open an editor first.
 */
export default function WhatsAppMenu({
  firstName,
  name,
  phone,
  templates,
  organizationName,
  onOpened,
  disabled,
}: WhatsAppMenuProps) {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  const chatLink = whatsappLink(phone);
  const isOpen = menuStyle !== null;

  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();

    const close = () => setMenuStyle(null);
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        buttonRef.current?.focus();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
        if (items.length === 0) return;
        event.preventDefault();
        const index = items.indexOf(document.activeElement as HTMLElement);
        const nextIndex =
          event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items[nextIndex]?.focus();
      }
    };
    const handleScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) close();
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  useEffect(() => {
    if (draft === null) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setDraft(null);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [draft]);

  if (!chatLink) return null;

  const values = { firstName, org: organizationName };

  const toggleMenu = () => {
    if (isOpen) {
      setMenuStyle(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimatedHeight = 56 + (templates.length + 2) * 44;
    const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    const openUp = rect.bottom + estimatedHeight > window.innerHeight && rect.top > estimatedHeight;
    setMenuStyle(
      openUp
        ? { position: "fixed", left, bottom: window.innerHeight - rect.top + 6, width: MENU_WIDTH }
        : { position: "fixed", left, top: rect.bottom + 6, width: MENU_WIDTH }
    );
  };

  const openEditor = (text: string) => {
    setMenuStyle(null);
    setDraft(text);
  };

  const handleOpened = () => {
    setMenuStyle(null);
    setDraft(null);
    onOpened?.(`Opened a WhatsApp chat with ${name}.`);
  };

  /** Fills known placeholders and turns the others into visible [markers] to replace by hand. */
  const editorText = (template: WhatsAppTemplate) => {
    const markers = Object.fromEntries(missingPlaceholders(template.text).map((key) => [key, `[${key}]`] as const));
    return fillTemplate(template.text, { ...markers, ...values });
  };

  const draftLink = draft !== null ? whatsappLink(phone, draft.trim() || undefined) : null;
  const draftHasMarkers = draft !== null && MARKER_PATTERN.test(draft);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        disabled={disabled}
        aria-label={`Send a WhatsApp message to ${name}`}
        title="WhatsApp"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
          isOpen ? "text-emerald-300 bg-emerald-500/10" : "text-slate-400 hover:text-emerald-400 hover:bg-slate-900"
        }`}
      >
        <MessageCircle className="h-4 w-4" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={`WhatsApp messages for ${name}`}
            style={menuStyle}
            className="z-[70] rounded-xl border border-slate-800 bg-slate-900 shadow-2xl p-1.5 text-left animate-in fade-in zoom-in-95 duration-100"
          >
            <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              WhatsApp {firstName || name}
            </p>
            {templates.map((template) => {
              const needsDetails = missingPlaceholders(template.text).length > 0;
              return (
                <div key={template.key} className="flex items-center gap-1">
                  {needsDetails ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openEditor(editorText(template))}
                      className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
                    >
                      <span className="truncate">{template.label}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">add details…</span>
                    </button>
                  ) : (
                    <>
                      <a
                        role="menuitem"
                        href={whatsappLink(phone, fillTemplate(template.text, values)) ?? chatLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleOpened}
                        className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
                      >
                        <span className="truncate">{template.label}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                      </a>
                      <button
                        type="button"
                        onClick={() => openEditor(fillTemplate(template.text, values))}
                        aria-label={`Edit the ${template.label} message before sending`}
                        title="Edit before sending"
                        className="shrink-0 p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            <div className="my-1 border-t border-slate-800" />
            <button
              type="button"
              role="menuitem"
              onClick={() => openEditor(fillTemplate("Hi {firstName}, ", values))}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-emerald-300 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              Custom message…
            </button>
          </div>,
          document.body
        )}

      {draft !== null &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[65] flex items-center justify-center p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDraft(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${menuId}-compose-title`}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-left animate-in fade-in zoom-in duration-200"
            >
              <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                <h3 id={`${menuId}-compose-title`} className="text-base font-bold text-white flex items-center gap-2">
                  <MessageCircle className="h-4.5 w-4.5 text-emerald-400" />
                  WhatsApp {name}
                </h3>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <label htmlFor={`${menuId}-message`} className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Message
                </label>
                <textarea
                  id={`${menuId}-message`}
                  autoFocus
                  rows={5}
                  maxLength={MAX_MESSAGE_LENGTH}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                />
                <div className="flex items-start justify-between gap-3 text-xs">
                  {draftHasMarkers ? (
                    <span className="flex items-start gap-1.5 text-amber-300">
                      <TriangleAlert className="h-3.5 w-3.5 mt-px shrink-0" />
                      Replace the [bracketed] parts before sending.
                    </span>
                  ) : (
                    <span className="text-slate-500">WhatsApp opens in a new tab so you can send it.</span>
                  )}
                  <span className="shrink-0 text-slate-600">
                    {draft.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <a
                  href={draftLink ?? chatLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleOpened}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open WhatsApp
                </a>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
