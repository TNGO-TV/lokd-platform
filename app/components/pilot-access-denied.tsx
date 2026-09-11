import Link from "next/link";
import { PUBLIC_SITE_URL } from "../lib/public-site";
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
      <p className="public-kicker">Account access</p>
      <h1>{labels[role]} access is not assigned.</h1>
      <p>You are signed in as <strong>{email}</strong>. LOKD has not linked this account to the requested role.</p>
      <p>If you have already submitted an enquiry or officer application, keep its reference and use the same email for your account. Operations must link the correct role separately; signing in does not approve work or service.</p>
      <div>
        <Link className="public-button public-button--dark" href={PUBLIC_SITE_URL}>Return to LOKD</Link>
        <a className="public-button public-button--outline-dark" href={lokdSignOutPath("/")}>Use another account</a>
      </div>
      {(role === "client" || role === "officer") && <p><a href={`${PUBLIC_SITE_URL}${role === "officer" ? "/join" : "/contact"}`}>{role === "officer" ? "New applicant? Start an officer or training application" : "New client? Submit a site enquiry"}</a></p>}
      <small>No operational or personal data has been disclosed.</small>
    </section>
  </main>;
}
