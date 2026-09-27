import { headers } from "next/headers";
import { pilotStage } from './lib/pilot-runtime';
import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { LokdClerkProvider } from "./components/clerk-login";
import { getLokdUser } from "./lokd-auth";
import PilotFeedback from "./components/pilot-feedback";
import { OrganisationJsonLd } from "./components/seo-json-ld";
import { PUBLIC_SITE_URL } from "./lib/public-site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: { default: "LOKD Security | Guarding, Armed Security and VIP Protection", template: "%s | LOKD Security" },
  description: "Unarmed guarding, armed security and VIP protection in South Africa, built around verified officers, advance funding and auditable service delivery.",
  alternates: { canonical: "/" },
  applicationName: "LOKD Security",
  category: "business",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    type: "website",
    locale: "en_ZA",
    siteName: "LOKD Security",
    url: PUBLIC_SITE_URL,
    title: "LOKD Security | Guarding, Armed Security and VIP Protection",
    description: "Unarmed guarding, armed security and VIP protection built around verified officers, controlled operations and auditable service delivery.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "LOKD Security Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LOKD Security | Guarding, Armed Security and VIP Protection",
    description: "Unarmed guarding, armed security and VIP protection built around verified officers and controlled operations.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getLokdUser();
  const nonce = (await headers()).get("x-lokd-script-nonce") ?? undefined;
  const runtime = env as unknown as Record<string, string | undefined>;
  const publishableKey = runtime.CLERK_PUBLISHABLE_KEY || runtime.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <html lang="en">
      <body><LokdClerkProvider publishableKey={publishableKey} nonce={nonce}>{children}<OrganisationJsonLd />{user && pilotStage() === "demo" && <PilotFeedback />}</LokdClerkProvider></body>
    </html>
  );
}
