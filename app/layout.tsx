import type { Metadata, Viewport } from "next";
import { OrganisationJsonLd } from "./components/seo-json-ld";
import { PUBLIC_SITE_URL } from "./lib/public-site";
import "./globals.css";
import "./styles/zone.css";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: { default: "LOKD | Security on your terms", template: "%s | LOKD Security" },
  description: "Book verified security officers in Johannesburg for guarding, armed security or VIP protection. Get a quote for a shift, event or ongoing cover.",
  alternates: { canonical: "/" },
  applicationName: "LOKD Security",
  category: "business",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    type: "website",
    locale: "en_ZA",
    siteName: "LOKD Security",
    url: PUBLIC_SITE_URL,
    title: "LOKD | Security on your terms",
    description: "Verified officers. Clear quotes. Security cover in Johannesburg.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "LOKD Security Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LOKD | Security on your terms",
    description: "Verified security officers for your Johannesburg site or event.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = { themeColor: "rgb(52, 71, 83)", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<OrganisationJsonLd /></body>
    </html>
  );
}
