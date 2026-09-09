import type { NextConfig } from "next";

// Only the production Clerk host is permitted in a release build.
const clerkOrigin = process.env.NODE_ENV === "development"
  ? "https://awake-gorilla-7447.clerk.accounts.dev"
  : "https://clerk.lokd.co.za";
const contentSecurityPolicy = [
  "default-src 'self'", "base-uri 'self'", "form-action 'self'",
  "frame-ancestors 'none'", "object-src 'none'",
  `script-src 'self' 'unsafe-inline' ${clerkOrigin} https://challenges.cloudflare.com https://*.protect.clerk.com`,
  "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https://img.clerk.com",
  "font-src 'self' data:",
  `connect-src 'self' ${clerkOrigin} https://*.protect.clerk.com:* https://clerk-telemetry.com https://*.clerk-telemetry.com`,
  "frame-src 'self' https://challenges.cloudflare.com https://*.protect.clerk.com",
  "worker-src 'self' blob:",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;
