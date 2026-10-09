"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, MoreHorizontal, Search, X } from "lucide-react";
import { setLocaleAction } from "@/app/actions/locale";
import { LOCALES, LOCALE_LABELS, WORLD_LANGUAGES, isLocale, type Locale } from "@/i18n/locales";

const TEXT: Record<Locale, { more: string; title: string; search: string; note: string; close: string }> = {
  en: {
    more: "More languages",
    title: "Choose a language",
    search: "Search a language…",
    note: "Other languages are translated automatically by Google Translate.",
    close: "Close",
  },
  nl: {
    more: "Meer talen",
    title: "Kies een taal",
    search: "Zoek een taal…",
    note: "Andere talen worden automatisch vertaald door Google Translate.",
    close: "Sluiten",
  },
  ar: {
    more: "لغات أخرى",
    title: "اختر لغة",
    search: "ابحث عن لغة…",
    note: "تُترجم اللغات الأخرى تلقائياً بواسطة ترجمة Google.",
    close: "إغلاق",
  },
};

export default function LanguageSwitcher({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const text = TEXT[locale];

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const choose = (next: Locale) => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  };

  const translateWithGoogle = (code: string) => {
    if (isLocale(code)) {
      setOpen(false);
      choose(code);
      return;
    }
    const url = `https://translate.google.com/translate?sl=${locale}&tl=${encodeURIComponent(code)}&u=${encodeURIComponent(window.location.href)}`;
    window.location.assign(url);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? WORLD_LANGUAGES.filter((lang) => lang.name.toLowerCase().includes(q) || lang.code.toLowerCase().startsWith(q)) : WORLD_LANGUAGES;
  }, [query]);

  return (
    <>
      <div
        role="group"
        aria-label="Language"
        className={`flex items-center rounded-full border border-slate-200 bg-white p-0.5 text-sm ${pending ? "opacity-60" : ""}`}
      >
        {!compact && <Globe className="ms-2 me-1 h-4 w-4 text-slate-400" aria-hidden="true" />}
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            lang={code}
            onClick={() => choose(code)}
            aria-pressed={code === locale}
            title={LOCALE_LABELS[code].name}
            className={`rounded-full px-2.5 py-1.5 font-semibold transition-colors ${
              code === locale ? "bg-brand-red text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {LOCALE_LABELS[code].short}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={text.more}
          title={text.more}
          className="rounded-full px-2 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/50 p-4 pt-20 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="language-dialog-title"
            dir={LOCALE_LABELS[locale].dir}
            className="flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h2 id="language-dialog-title" className="text-lg font-bold text-slate-900">
                {text.title}
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={text.close} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-300 px-3">
                <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={text.search}
                  aria-label={text.search}
                  className="w-full bg-transparent py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">{text.note}</p>
            </div>
            <ul className="grid grid-cols-2 gap-1 overflow-y-auto p-3 sm:grid-cols-3">
              {filtered.map((lang) => (
                <li key={lang.code}>
                  <button
                    type="button"
                    onClick={() => translateWithGoogle(lang.code)}
                    lang={lang.code}
                    className={`w-full rounded-xl px-3 py-2.5 text-start text-sm transition-colors hover:bg-red-50 hover:text-brand-red ${
                      lang.code === locale ? "bg-red-50 font-semibold text-brand-red" : "text-slate-700"
                    }`}
                  >
                    {lang.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
