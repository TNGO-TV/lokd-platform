'use client';

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WorkspaceRole } from "../lib/public-site";
import styles from "./workspace-shell.module.css";

export default function WorkspaceShell({ role, children }: { role: WorkspaceRole; children: React.ReactNode }) {
  const pathname = usePathname();
  const base = role === "operations" ? "/ops" : "/" + role;
  const label = role === "operations" ? "Operations" : role === "client" ? "Client" : "Officer";
  const links = [
    { href: base, label: role === "operations" ? "Overview" : role === "client" ? "Your bookings" : "Your shifts" },
    ...(role === "operations" ? [{ href: "/ops/intake", label: "Applications & enquiries" }] : []),
    { href: base + "/agreements", label: "Agreements" },
    { href: base + "/service", label: "Service & payments" },
    ...(role !== "client" ? [{ href: base + "/readiness", label: "Identity & qualifications" }, { href: base + "/psira", label: "PSIRA checks" }] : []),
    ...(role === "operations" ? [{ href: "/ops/security", label: "Account security" }] : []),
  ];
  return <div className={styles.workspace}>
    <a className={styles.skip} href="#workspace-content">Skip to page content</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <div className={styles.brand}><Link href="/" aria-label="LOKD home"><Image width={2202} height={713} unoptimized priority src="/lokd-logo-reverse.svg" alt="LOKD" /></Link><strong>{label} portal</strong><Link prefetch={false} href="/sign-out">Sign out</Link></div>
      <nav className={styles.nav} aria-label={label + " navigation"}>{links.map(link => <Link prefetch={false} key={link.href} href={link.href} aria-current={pathname === link.href || link.href !== base && pathname.startsWith(link.href + "/") ? "page" : undefined}>{link.label}</Link>)}</nav>
    </div></header>
    <div id="workspace-content" className={styles.content} tabIndex={-1}>{children}</div>
    <footer className={styles.footer}><Link href="/contact">Contact LOKD</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
  </div>;
}
