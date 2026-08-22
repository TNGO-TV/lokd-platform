"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PassportEndorsement, PassportStatus, ServiceType } from "../lib/pilot-types";

type PassportResult = {
  passportNumber: string;
  officerName: string;
  initials: string;
  psiraGrade: string;
  psiraCurrent: boolean;
  readinessLabel: string;
  status: PassportStatus;
  result: "green" | "amber" | "red" | "grey";
  message: string;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  endorsements: PassportEndorsement[];
  assignment: null | {
    matched: boolean;
    serviceType: ServiceType | null;
    purposeLabel: string | null;
    scheduledDate: string | null;
    shiftStart: string | null;
    shiftEnd: string | null;
    verificationStatus: string | null;
    verifiedAt: string | null;
  };
  verifiedAt: string;
};

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(value));
}

export default function VerifyPassport() {
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const bookingId = search.get("booking") ?? "";
  const shiftId = search.get("shift") ?? "";
  const [passport, setPassport] = useState<PassportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ token });
      if (bookingId) query.set("booking", bookingId);
      if (shiftId) query.set("shift", shiftId);
      const response = await fetch(`/api/passport?${query}`, { cache: "no-store" });
      const payload = await response.json() as { passport?: PassportResult; error?: string };
      if (!response.ok || !payload.passport) throw new Error(payload.error ?? "Passport could not be verified.");
      setPassport(payload.passport);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Passport could not be verified.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [token, bookingId, shiftId]);

  async function confirmShift() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/passport", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, bookingId, shiftId }),
      });
      const payload = await response.json() as { passport?: PassportResult; error?: string };
      if (!response.ok || !payload.passport) throw new Error(payload.error ?? "Verification could not be recorded.");
      setPassport(payload.passport);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verification could not be recorded.");
    } finally { setBusy(false); }
  }

  return <main className="passport-verify-shell">
    <header><a href="/"><img src="/lokd-logo.svg" alt="LOKD" /></a><span>LIVE PASSPORT VERIFICATION</span></header>
    {loading ? <section className="passport-loading"><i /><h1>Checking LOKD Passport…</h1><p>Reading the current readiness record.</p></section>
      : error && !passport ? <section className="passport-error"><strong>!</strong><h1>Verification unavailable</h1><p>{error}</p><button onClick={() => void load()}>Try again</button></section>
      : passport && <>
        <section className={`passport-result passport-result--${passport.result}`}>
          <div className="passport-result-mark">{passport.result === "green" ? "✓" : passport.result === "amber" ? "!" : "×"}</div>
          <div><span>{passport.result === "green" ? "CURRENT AND READY" : passport.result === "amber" ? "CHECK ASSIGNMENT" : "DO NOT DEPLOY"}</span><h1>{passport.message}</h1><p>Live result · {dateTime(passport.verifiedAt)}</p></div>
        </section>
        <section className="passport-profile-card">
          <div className="passport-person"><span>{passport.initials}</span><div><small>{passport.readinessLabel}</small><h2>{passport.officerName}</h2><p>{passport.passportNumber}</p></div></div>
          <div className="passport-current-grid"><div><span>PSiRA</span><strong>{passport.psiraGrade} · {passport.psiraCurrent ? "Current" : "Not current"}</strong></div><div><span>Passport</span><strong>{passport.status}</strong></div><div><span>Last reviewed</span><strong>{passport.lastReviewedAt?.slice(0,10) ?? "—"}</strong></div><div><span>Next review</span><strong>{passport.nextReviewAt?.slice(0,10) ?? "—"}</strong></div></div>
        </section>
        {passport.assignment && <section className={`passport-assignment ${passport.assignment.matched ? "matched" : "mismatch"}`}><span>{passport.assignment.matched ? "✓" : "!"}</span><div><small>ASSIGNMENT CHECK</small><h2>{passport.assignment.matched ? "Assigned to this LOKD shift" : "No matching assignment"}</h2>{passport.assignment.matched && <p>{passport.assignment.serviceType} · {passport.assignment.purposeLabel} · {passport.assignment.scheduledDate} · {passport.assignment.shiftStart}–{passport.assignment.shiftEnd}</p>}</div></section>}
        <section className="passport-endorsements"><div><small>CURRENT LOKD ENDORSEMENTS</small><h2>Purpose-trained readiness</h2></div>{passport.endorsements.filter((item) => item.status === "current").map((item) => <article key={item.id}><span>✓</span><p><strong>{item.label}</strong><small>{item.category === "purpose" ? "Purpose endorsement" : item.category === "service" ? "Service readiness" : "Core standard"}</small></p><em>{item.expiresAt ? `to ${item.expiresAt.slice(0,10)}` : "current"}</em></article>)}</section>
        {passport.assignment?.matched && <button className="passport-confirm" disabled={busy || passport.assignment.verificationStatus === "green" || passport.result === "red"} onClick={() => void confirmShift()}>{passport.assignment.verificationStatus === "green" ? "✓ Arrival already verified" : busy ? "Recording…" : "Confirm officer at this shift"}</button>}
        {error && <p className="passport-inline-error" role="alert">{error}</p>}
        <p className="passport-privacy-note">This page confirms current operational readiness only. It does not expose identity documents, background reports, medical information, assessment scores or private contact details.</p>
      </>}
    <footer><strong>Compare the officer with their physical LOKD identification.</strong><span>When in doubt, contact LOKD Operations before deployment.</span></footer>
  </main>;
}
