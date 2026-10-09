/** Canonical public URL of the website (used for SEO: sitemap, robots, canonical links, Open Graph). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://volunteer-activity-tracker.vercel.app")
).replace(/\/$/, "");

export const PUBLIC_PAGES = ["/", "/about", "/programmes", "/join", "/contact", "/privacy"] as const;
