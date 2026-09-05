import type { Metadata } from "next";

export const metadata: Metadata = { title: "Officer portal", robots: { index: false, follow: false } };
export default function OfficerPortalLayout({ children }: { children: React.ReactNode }) { return children; }
