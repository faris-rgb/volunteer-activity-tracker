// Public website content for Volunteer in Morocco (Martil & Tetouan). The page texts live in src/i18n/site.
// Plain module: safe for client and server components.

import type { PublicOrgInfo } from "@/app/join/joinShared";

/** Public contact details shown when they are not set in Portal Settings (from the original website). */
export const DEFAULT_CONTACT = {
  email: "info@volunteerinmorocco.com",
  phone: "+212 605 724 535",
  instagramUrl: "https://www.instagram.com/volunteerinmorocco/",
  facebookUrl: "https://www.facebook.com/VolunteerinMorocco",
  address: "Route nationale N°16, Av. Miramar, Martil, Morocco",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Av.+Miramar+Martil+Morocco",
} as const;

export function withContactDefaults(org: PublicOrgInfo) {
  return {
    organizationName: org.organizationName,
    email: org.contactEmail || DEFAULT_CONTACT.email,
    phone: org.contactPhone || DEFAULT_CONTACT.phone,
    instagramUrl: org.instagramUrl || DEFAULT_CONTACT.instagramUrl,
    facebookUrl: org.facebookUrl || DEFAULT_CONTACT.facebookUrl,
    address: DEFAULT_CONTACT.address,
    mapsUrl: DEFAULT_CONTACT.mapsUrl,
  };
}
export type SiteContact = ReturnType<typeof withContactDefaults>;

export const NAV_LINKS = [
  { href: "/", key: "home" },
  { href: "/about", key: "about" },
  { href: "/programmes", key: "programmes" },
  { href: "/contact", key: "contact" },
] as const;

/** Project page anchors (/programmes#slug), in display order. Texts: `programmes.items` in src/i18n/site. */
export const PROGRAMME_SLUGS = [
  "malabis-share",
  "project-yatra",
  "soccer4all",
  "aji-triyed",
  "we-act",
  "language-cafe",
  "english-lessons",
  "digital-skills",
] as const;
