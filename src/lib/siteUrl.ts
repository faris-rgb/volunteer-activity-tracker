/**
 * Canonical public URL of the website (sitemap, robots, canonical links, Open Graph).
 * Pinned to the vercel.app address until volunteerinmorocco.com points to Vercel — then change it here
 * (or set NEXT_PUBLIC_SITE_URL in Vercel).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://volunteer-activity-tracker.vercel.app").replace(
  /\/$/,
  ""
);

export const PUBLIC_PAGES = ["/", "/about", "/programmes", "/join", "/contact", "/privacy"] as const;
