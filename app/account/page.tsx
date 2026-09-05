import Link from "next/link";
import { requireLOKDUser } from "../lokd-auth";
import { principalForClerkUser } from "../lib/pilot-runtime";
import { workspaceUrl } from "../lib/public-site";
import AuthScreen from "../components/auth-screen";
import { AccountControls } from "../components/account-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const user = await requireLOKDUser("/account");
  const principal = principalForClerkUser(user.id);
  return <AuthScreen><section className="lokd-auth-message">
    <h1>Your LOKD account</h1>
    <AccountControls />
    {principal.roles.length ? <><p>Choose your workspace.</p><nav className="lokd-workspace-links" aria-label="Your LOKD workspaces">
      {principal.roles.includes("client") && <a className="public-button public-button--dark" href={workspaceUrl("client")}>Client workspace</a>}
      {principal.roles.includes("officer") && <a className="public-button public-button--dark" href={workspaceUrl("officer")}>Officer workspace</a>}
      {principal.roles.includes("operations") && <a className="public-button public-button--dark" href={workspaceUrl("operations")}>Operations workspace</a>}
      {principal.roles.includes("reviewer") && <Link className="public-button public-button--outline-dark" href="/">LOKD review</Link>}
    </nav></> : <p>Your account is ready. Your workspace access will appear here once LOKD has assigned it.</p>}
  </section></AuthScreen>;
}
