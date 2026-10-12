import { env } from "cloudflare:workers";
import Link from "next/link";
import { testingToolsEnabledFor } from "./testing-tools-policy";

export function testingToolsEnabled() {
  return testingToolsEnabledFor(env);
}

export function TestingToolsUnavailable({ returnTo }: { returnTo: string }) {
  return <main><h1>Not available</h1><p>This page is an internal testing tool and is not part of your LOKD account.</p><Link href={returnTo}>Return to my account</Link></main>;
}
