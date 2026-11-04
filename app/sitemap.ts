import type { MetadataRoute } from "next";
import { canonicalUrl, PUBLIC_SITEMAP_PATHS } from "./lib/public-site";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITEMAP_PATHS.map((path) => ({
    url: canonicalUrl(path),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : ["/security-services", "/armed-security", "/vip-protection", "/locations/johannesburg"].includes(path) ? 0.9 : 0.7,
  }));
}
