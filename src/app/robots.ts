import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The staff portal is private and must not appear in search results.
      disallow: [
        "/dashboard",
        "/volunteers",
        "/activities",
        "/attendance",
        "/projects",
        "/stays",
        "/settings",
        "/admin",
        "/certificates",
        "/pending-role",
        "/sign-in",
        "/sign-up",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
