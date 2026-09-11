import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "./lib/public-site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/signup", "/ops", "/portal", "/operations", "/verify", "/sign-in", "/sign-out", "/callback"] },
    sitemap: `${PUBLIC_SITE_URL}/sitemap.xml`,
    host: PUBLIC_SITE_URL,
  };
}
