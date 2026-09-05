import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { getLOKDUser } from "./lokd-auth";
import { clerkSettings } from "./lib/clerk-config";
import PilotFeedback from "./components/pilot-feedback";
import { OrganisationJsonLd } from "./components/seo-json-ld";
import { PUBLIC_SITE_URL } from "./lib/public-site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: { default: "LOKD Security | Guarding, Armed Security and VIP Protection", template: "%s | LOKD Security" },
  description: "Controlled Unarmed guarding, Armed security and VIP protection in Johannesburg, built around verified officers, advance funding and auditable service delivery.",
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
    description: "Controlled Unarmed guarding, Armed security and VIP protection built around verified officers, controlled operations and auditable service delivery.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "LOKD Security Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LOKD Security | Guarding, Armed Security and VIP Protection",
    description: "Controlled Unarmed guarding, Armed security and VIP protection built around verified officers and controlled operations.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = clerkSettings();
  const user = await getLOKDUser();
  const content = <>{children}<OrganisationJsonLd />{user && <PilotFeedback />}</>;
  return (
    <html lang="en">
      <body>{settings.ready ? <ClerkProvider dynamic publishableKey={settings.publishableKey} signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/account" signUpFallbackRedirectUrl="/account" afterSignOutUrl="/" telemetry={false} appearance={{ variables: { colorPrimary: "#151718", borderRadius: "0.75rem", fontFamily: "inherit" } }}>{content}</ClerkProvider> : content}</body>
    </html>
  );
}
