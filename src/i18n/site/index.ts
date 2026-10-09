import "server-only";
import { getLocale } from "@/i18n/server";
import type { Locale } from "@/i18n/locales";
import { ar } from "./ar";
import { en, type SiteDictionary } from "./en";
import { nl } from "./nl";

const DICTIONARIES: Record<Locale, SiteDictionary> = { en, nl, ar };

export type { SiteDictionary };

/** Website texts in the visitor's language (server components). */
export async function getSiteDictionary(): Promise<{ locale: Locale; t: SiteDictionary }> {
  const locale = await getLocale();
  return { locale, t: DICTIONARIES[locale] };
}
