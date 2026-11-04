import type { Metadata } from "next";
import { requireLokdUser } from '../lokd-auth';
import ClientShell from './client-shell';

export const metadata: Metadata = { title: "Client portal", robots: { index: false, follow: false } };
export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireLokdUser('/client');
  return <ClientShell name={user.displayName}>{children}</ClientShell>;
}
