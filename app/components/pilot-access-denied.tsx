import Link from "next/link";
import { lokdSignOutPath } from "../lokd-auth";
import type { PilotRole } from "../lib/pilot-access-core";

const labels: Record<PilotRole, string> = {
  operations: "Operations",
  client: "Client",
  officer: "Officer",
  reviewer: "Reviewer",
};

export default function PilotAccessDenied({ email, role }: { email: string; role: PilotRole }) {
  return <main className="pilot-access-shell">
    <section className="pilot-access-card">
      <Link href="/" aria-label="LOKD home"><img src="/lokd-logo.png" alt="LOKD" /></Link>
      <p className="public-kicker">Controlled pre-launch access</p>
      <h1>{labels[role]} access is not assigned.</h1>
      <p>You are signed in as <strong>{email}</strong>. LOKD has not linked this account to the requested pilot role.</p>
      <div>
        <Link className="public-button public-button--dark" href="/">Return to LOKD</Link>
        <a className="public-button public-button--outline-dark" href={lokdSignOutPath("/")}>Use another account</a>
      </div>
      <small>No operational or personal data has been disclosed.</small>
    </section>
  </main>;
}
