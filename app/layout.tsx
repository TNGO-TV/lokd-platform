import type { Metadata } from "next";
import { getChatGPTUser } from "./chatgpt-auth";
import PilotFeedback from "./components/pilot-feedback";
import { OrganisationJsonLd } from "./components/seo-json-ld";
import { PUBLIC_SITE_URL } from "./lib/public-site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: { default: "LOKD Security | Verified Guarding in Johannesburg", template: "%s | LOKD Security" },
  description: "Scheduled Unarmed fixed-site security in Johannesburg, built around verified officers, controlled operations and auditable service delivery.",
  alternates: { canonical: "/" },
  applicationName: "LOKD Security",
  category: "business",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    type: "website",
    locale: "en_ZA",
    siteName: "LOKD Security",
    url: PUBLIC_SITE_URL,
    title: "LOKD Security | Verified Guarding in Johannesburg",
    description: "Scheduled Unarmed fixed-site security built around verified officers, controlled operations and auditable service delivery.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "LOKD Security Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LOKD Security | Verified Guarding in Johannesburg",
    description: "Scheduled Unarmed fixed-site security built around verified officers and controlled operations.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getChatGPTUser();
  return (
    <html lang="en">
      <body>{children}<OrganisationJsonLd />{user && <PilotFeedback />}</body>
    </html>
  );
}
