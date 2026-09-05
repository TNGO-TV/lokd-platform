import type { MetadataRoute } from "next";
import { canonicalUrl, PUBLIC_SITEMAP_PATHS } from "./lib/public-site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-09-04T00:00:00.000Z");
  return PUBLIC_SITEMAP_PATHS.map((path) => ({
    url: canonicalUrl(path),
    lastModified,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : ["/security-services", "/armed-security", "/vip-protection", "/locations/johannesburg"].includes(path) ? 0.9 : 0.7,
  }));
}
