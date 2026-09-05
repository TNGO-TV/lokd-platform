import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Officer Applications and Training",
  description: "Register interest in the LOKD Johannesburg officer pathway, security training, Unarmed posts and separately verified Armed or VIP protection work.",
  alternates: { canonical: "/join" },
};

export default function JoinLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
