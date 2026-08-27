import type { Metadata } from "next";
import { getChatGPTUser } from "./chatgpt-auth";
import PilotFeedback from "./components/pilot-feedback";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://demo.lokd.co.za"),
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
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getChatGPTUser();
  return (
    <html lang="en">
      <body>{children}{user && <PilotFeedback />}</body>
    </html>
  );
}
