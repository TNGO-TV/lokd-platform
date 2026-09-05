import type { Metadata } from "next";

export const metadata: Metadata = { title: "Passport verification", robots: { index: false, follow: false } };
export default function VerificationLayout({ children }: { children: React.ReactNode }) { return children; }
