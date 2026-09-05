import Link from "next/link";

export default function AuthScreen({ children }: { children: React.ReactNode }) {
  return <main className="lokd-auth-screen">
    <Link href="/" className="lokd-auth-logo" aria-label="LOKD home"><img src="/lokd-logo.png" alt="LOKD" /></Link>
    {children}
    <p className="lokd-auth-help">Account access and officer approval are separate. <Link href="/privacy">Privacy notice</Link></p>
  </main>;
}

export function AuthUnavailable() {
  return <section className="lokd-auth-message"><h1>LOKD sign-in is being prepared</h1><p>Please try again shortly.</p><Link className="public-button public-button--dark" href="/">Return to LOKD</Link></section>;
}
