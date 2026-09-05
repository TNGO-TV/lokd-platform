import Link from "next/link";
import { clerkSettings } from "../lib/clerk-config";
import ClerkAccountControls from "./clerk-account-controls";

export function AccountControls({ switchAccount = false }: { switchAccount?: boolean }) {
  if (clerkSettings().ready) return <ClerkAccountControls switchAccount={switchAccount} />;
  return <div className="lokd-account-controls"><Link className="lokd-sign-in" href="/sign-in">Sign in</Link>{!switchAccount && <Link className="lokd-sign-up" href="/sign-up">Create account</Link>}</div>;
}

export function WorkspaceAccountBar() {
  return <div className="lokd-workspace-account-bar"><Link href="/account">LOKD account</Link><AccountControls /></div>;
}
