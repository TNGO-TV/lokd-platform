import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LOKD Security Platform",
  description: "Verified people. Controlled operations. Complete proof.",
  icons: {
    icon: "/lokd-logo.svg",
    shortcut: "/lokd-logo.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
