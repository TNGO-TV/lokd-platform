import type { Metadata } from "next";

export const metadata: Metadata = { title: "Operations portal", robots: { index: false, follow: false } };
export default function OperationsPortalLayout({ children }: { children: React.ReactNode }) { return children; }
