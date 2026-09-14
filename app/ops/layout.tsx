import WorkspaceShell from "../components/workspace-shell";
import { pilotStage } from "../lib/pilot-runtime";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Operations portal", robots: { index: false, follow: false } };
export default function OperationsPortalLayout({ children }: { children: React.ReactNode }) { return pilotStage() === "demo" ? children : <WorkspaceShell role="operations">{children}</WorkspaceShell>; }
