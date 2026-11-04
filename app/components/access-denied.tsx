import Image from "next/image";
import Link from "next/link";
import { PUBLIC_SITE_URL } from "../lib/public-site";
import { lokdSignOutPath } from "../lokd-auth";
type WorkspaceRole = "operations" | "client" | "officer" | "reviewer";

const labels: Record<WorkspaceRole, string> = {
  operations: "Operations",
  client: "Client",
  officer: "Officer",
  reviewer: "Reviewer",
};

export default function AccessDenied({ email, role }: { email: string; role: WorkspaceRole }) {
  return <main className="account-access-shell">
    <section className="account-access-card">
      <Link href="/" aria-label="LOKD home"><Image width={1096} height={333} unoptimized loading="eager" style={{height:"auto"}} src="/lokd-logo.png" alt="LOKD" /></Link>
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
