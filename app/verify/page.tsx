"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PublicHeader, PublicFooter } from "../components/public-site-shell";

type Passport = { officerName: string; passportNumber: string; psiraGrade: string; status: string; result: string; verifiedAt: string; nextReviewAt?: string | null };
type Verification = { state: "valid" | "expired" | "revoked" | "unavailable"; title: string; message: string; passport?: Passport };
const tokenPattern = /^lokd_live_[a-f0-9]{64}$/;
function readToken(value: string) {
  const trimmed = value.trim();
  if (tokenPattern.test(trimmed)) return trimmed;
  try {
    const link = new URL(trimmed);
    if (link.protocol !== "https:" || !["lokd.co.za", "www.lokd.co.za", "officers.lokd.co.za"].includes(link.hostname) || link.pathname !== "/verify") return "";
    const token = new URLSearchParams(link.hash.slice(1)).get("token") ?? "";
    return tokenPattern.test(token) ? token : "";
  } catch { return ""; }
}
function checkedAt(value: string) {
  return Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(value)) + " SAST" : "Unavailable";
}
export default function VerifyPage() {
  const [canRefresh, setCanRefresh] = useState(false);
  const [input, setInput] = useState(""), [busy, setBusy] = useState(false), [result, setResult] = useState<Verification | null>(null);
  const token = useRef(""), request = useRef(0), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (result) heading.current?.focus(); }, [result]);
  async function verify(candidate: string) {
    const value = readToken(candidate);
    if (!value) { setResult({ state: "unavailable", title: "No valid Passport link", message: "Scan the officer’s LOKD Passport QR code or paste the verification link they shared with you." }); return; }
    token.current = value; setCanRefresh(true); setInput(""); setBusy(true); setResult(null);
    const generation = ++request.current;
    try {
      const response = await fetch("/api/passport/verify", { method: "POST", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: value }), signal: AbortSignal.timeout(15000) });
      if (generation !== request.current) return;
      if (!response.ok) {
        setResult({ state: "unavailable", title: response.status === 404 ? "Passport not found" : "Verification unavailable", message: response.status === 404 ? "This link is no longer available. Ask the officer for their current LOKD Passport or contact LOKD." : "We could not check the current record. Try again before relying on this Passport." }); return;
      }
      const body = await response.json() as {passport?: Passport & {environment: string}}, passport = body?.passport;
      if (!passport || passport.environment !== "production" || !["green", "amber", "red"].includes(passport.result) || !["officerName", "passportNumber", "status", "verifiedAt", "psiraGrade"].every(key => typeof (passport as unknown as Record<string, unknown>)[key] === "string")) throw new Error("Incomplete Passport");
      if (passport.status === "revoked") setResult({ state: "revoked", title: "Passport revoked", message: "This Passport has been revoked. Do not accept it as current clearance. Contact LOKD about the assignment.", passport });
      else if (passport.status === "expired") setResult({ state: "expired", title: "Passport expired", message: "This Passport has expired. Ask for a renewed Passport before confirming clearance.", passport });
      else if (["active", "expiring"].includes(passport.status) && ["green", "amber"].includes(passport.result)) setResult({ state: "valid", title: "Passport valid", message: passport.status === "expiring" ? "This Passport is current. A review is due soon." : "This officer’s Passport is current.", passport });
      else setResult({ state: "unavailable", title: "Passport not currently valid", message: "The officer’s current checks do not confirm clearance. Contact LOKD before the assignment proceeds.", passport });
    } catch {
      if (generation === request.current) setResult({ state: "unavailable", title: "Verification unavailable", message: "We could not check the current record. Please try again." });
    } finally { if (generation === request.current) setBusy(false); }
  }
  useEffect(() => {
    const activeRequest = request;
    const candidate = new URLSearchParams(location.hash.slice(1)).get("token") ?? "";
    if (location.hash || location.search) history.replaceState(history.state, "", location.pathname);
    const timer = setTimeout(() => { if (candidate) void verify(candidate); }, 0);
    return () => { clearTimeout(timer); activeRequest.current++; };
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!busy) void verify(input); }
  return <div className="public-site"><PublicHeader /><main id="main-content" className="public-system" tabIndex={-1}>
    <p className="public-kicker">LOKD Passport</p><h1>Check an officer’s Passport.</h1><p>See the current status of the LOKD Passport shared with you.</p>
    <form className="public-verify-form" onSubmit={submit}><label>Passport verification link<input type="text" value={input} onChange={event => setInput(event.target.value)} autoComplete="off" spellCheck={false} maxLength={1024} required aria-describedby="passport-link-help" /></label><p id="passport-link-help">Scan the QR code on the officer’s current Passport, or paste the link they shared. Your link is used only for this check.</p><button className="public-button public-button--primary" disabled={busy}>{busy ? "Checking…" : "Check Passport"}</button></form>
    {busy && <p role="status">Checking the current LOKD record…</p>}
    {result && <section className="public-passport-result" data-status={result.state} aria-live="polite"><h2 ref={heading} tabIndex={-1}>{result.title}</h2><p>{result.message}</p>{result.passport && <dl><dt>Officer</dt><dd>{result.passport.officerName}</dd><dt>Passport</dt><dd>{result.passport.passportNumber}</dd><dt>PSIRA grade</dt><dd>{result.passport.psiraGrade}</dd><dt>Checked at</dt><dd>{checkedAt(result.passport.verifiedAt)}</dd>{result.passport.nextReviewAt && <><dt>Next review</dt><dd>{checkedAt(result.passport.nextReviewAt)}</dd></>}</dl>}{canRefresh && <button className="public-button public-button--secondary" disabled={busy} onClick={() => void verify(token.current)}>Check again</button>}</section>}
    <p>A valid Passport confirms the current officer record. Check the officer’s name and your booking details before they start the assignment.</p><Link className="public-text-link" href="/contact">Contact LOKD →</Link>
  </main><PublicFooter /></div>;
}
