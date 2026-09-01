import type { Metadata } from "next";

export const metadata: Metadata = { title: "Client portal", robots: { index: false, follow: false } };
export default function ClientPortalLayout({ children }: { children: React.ReactNode }) { return children; }
