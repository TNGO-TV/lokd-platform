import WorkspaceShell from "../components/workspace-shell";
import { pilotStage } from "../lib/pilot-runtime";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Client portal", robots: { index: false, follow: false } };
export default function ClientPortalLayout({ children }: { children: React.ReactNode }) { return pilotStage() === "demo" ? children : <WorkspaceShell role="client">{children}</WorkspaceShell>; }
