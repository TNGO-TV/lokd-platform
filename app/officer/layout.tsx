import { pageTestSurfacesEnabled } from '../lib/test-surface-page';
import WorkspaceShell from "../components/workspace-shell";
import { pilotStage } from "../lib/pilot-runtime";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Officer portal", robots: { index: false, follow: false } };
export default async function OfficerPortalLayout({ children }: { children: React.ReactNode }) { const testTools = await pageTestSurfacesEnabled(); return testTools && pilotStage() === "demo" ? children : <WorkspaceShell testTools={testTools} role="officer">{children}</WorkspaceShell>; }
