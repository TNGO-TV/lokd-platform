import { publicMetadata } from "../lib/public-site";
export const metadata = { ...publicMetadata("Verify a LOKD Passport", "Check a security officer’s current LOKD Passport and see whether it is valid, expired or revoked.", "/verify"), robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function VerificationLayout({ children }: { children: React.ReactNode }) { return children; }
