import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Officer Applications and Training",
  description: "Register interest in the LOKD Johannesburg officer pathway, future security training and controlled Unarmed fixed-site work.",
  alternates: { canonical: "/join" },
};

export default function JoinLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
