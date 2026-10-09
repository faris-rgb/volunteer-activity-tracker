"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/i18n/locales";

/** Public: stores the visitor's website language in a cookie. Only accepts the supported locales. */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
