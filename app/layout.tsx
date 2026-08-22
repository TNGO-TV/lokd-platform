import type { Metadata } from "next";
import PilotFeedback from "./components/pilot-feedback";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lokd-security.zenas-capetown.chatgpt.site"),
  title: "LOKD Security Platform",
  description: "Book verified security or start your pathway to becoming a work-ready LOKD officer.",
  openGraph: {
    title: "LOKD Security Platform",
    description: "Book verified security or start your pathway to becoming a work-ready LOKD officer.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "LOKD Security Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LOKD Security Platform",
    description: "Book verified security or start your pathway to becoming a work-ready LOKD officer.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/lokd-logo.svg",
    shortcut: "/lokd-logo.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<PilotFeedback /></body>
    </html>
  );
}
