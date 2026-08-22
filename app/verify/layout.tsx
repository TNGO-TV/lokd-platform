import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify LOKD Passport",
  description: "Live verification of a LOKD officer's current readiness status.",
  robots: { index: false, follow: false },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
