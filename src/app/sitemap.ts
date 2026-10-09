import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE_URL } from "@/lib/siteUrl";

export default function sitemap(): MetadataRoute.Sitemap {
  const priority: Record<string, number> = { "/": 1, "/join": 0.9, "/programmes": 0.8, "/about": 0.8, "/contact": 0.7, "/privacy": 0.3 };
  return PUBLIC_PAGES.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    lastModified: new Date(),
    changeFrequency: path === "/join" || path === "/" ? "weekly" : "monthly",
    priority: priority[path] ?? 0.5,
  }));
}
