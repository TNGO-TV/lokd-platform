"use client";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "./components/public-site-shell";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="public-site"><PublicHeader /><main id="main-content" className="public-system" tabIndex={-1}><h1>This page couldn’t load.</h1><p>Please try again. If you just submitted a form, check your account or confirmation email before submitting another request.</p><button className="public-button public-button--primary" onClick={reset}>Try again</button><p><Link className="public-text-link" href="/contact">Contact LOKD →</Link></p></main><PublicFooter /></div>;
}
