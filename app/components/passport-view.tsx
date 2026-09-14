"use client";

import Image from "next/image";
import Link from "next/link";
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
  environment: string;
  integrityState: string;
  synthetic: boolean;
  productionAuthorized: boolean;
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
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true); setError("");
        try {
          const query = new URLSearchParams({ token });
          if (bookingId) query.set("booking", bookingId);
          if (shiftId) query.set("shift", shiftId);
          const response = await fetch(`/api/passport?${query}`, { cache: "no-store", signal: controller.signal });
          const payload = await response.json() as { passport?: PassportResult; error?: string };
          if (!response.ok || !payload.passport) throw new Error(payload.error ?? "Passport could not be verified.");
          if (active) setPassport(payload.passport);
        } catch (cause) {
          if (active && !(cause instanceof DOMException && cause.name === "AbortError")) {
            setError(cause instanceof Error ? cause.message : "Passport could not be verified.");
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
    }, 0);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [token, bookingId, shiftId, retryKey]);

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
    <header><Link href="/"><Image width={1096} height={333} unoptimized loading="eager" style={{height:"auto"}} src="/lokd-logo.png" alt="LOKD" /></Link><span>{passport?.synthetic ? "PASSPORT REHEARSAL" : "PASSPORT RECORD"}</span></header>
    {loading ? <section className="passport-loading"><i /><h1>Checking LOKD Passport…</h1><p>Reading the current readiness record.</p></section>
      : error && !passport ? <section className="passport-error"><strong>!</strong><h1>Verification unavailable</h1><p>{error}</p><button onClick={() => setRetryKey((current) => current + 1)}>Try again</button></section>
      : passport && <>
        <section className={`passport-result passport-result--${passport.result}`}>
          <div className="passport-result-mark">{passport.synthetic ? "D" : passport.result === "green" ? "✓" : passport.result === "amber" ? "!" : "×"}</div>
          <div><span>{passport.synthetic ? "DEMO READINESS RECORD" : passport.productionAuthorized ? "PRODUCTION EVIDENCE CURRENT" : passport.result === "amber" ? "CHECK ASSIGNMENT" : "DO NOT DEPLOY"}</span><h1>{passport.message}</h1><p>{passport.synthetic ? "Synthetic result" : "Evidence read"} · {dateTime(passport.verifiedAt)}</p></div>
        </section>
        <section className="passport-profile-card">
          <div className="passport-person"><span>{passport.initials}</span><div><small>{passport.readinessLabel}</small><h2>{passport.officerName}</h2><p>{passport.passportNumber}</p></div></div>
          <div className="passport-current-grid"><div><span>PSiRA</span><strong>{passport.psiraGrade} · {passport.psiraCurrent ? "Current" : "Not current"}</strong></div><div><span>Passport</span><strong>{passport.status}</strong></div><div><span>Last reviewed</span><strong>{passport.lastReviewedAt?.slice(0,10) ?? "—"}</strong></div><div><span>Next review</span><strong>{passport.nextReviewAt?.slice(0,10) ?? "—"}</strong></div></div>
        </section>
        {passport.assignment && <section className={`passport-assignment ${passport.assignment.matched ? "matched" : "mismatch"}`}><span>{passport.assignment.matched ? "✓" : "!"}</span><div><small>ASSIGNMENT CHECK</small><h2>{passport.assignment.matched ? "Assigned to this LOKD shift" : "No matching assignment"}</h2>{passport.assignment.matched && <p>{passport.assignment.serviceType} · {passport.assignment.purposeLabel} · {passport.assignment.scheduledDate} · {passport.assignment.shiftStart}–{passport.assignment.shiftEnd}</p>}</div></section>}
        <section className="passport-endorsements"><div><small>CURRENT LOKD ENDORSEMENTS</small><h2>Purpose-trained readiness</h2></div>{passport.endorsements.filter((item) => item.status === "current").map((item) => <article key={item.id}><span>✓</span><p><strong>{item.label}</strong><small>{item.category === "purpose" ? "Purpose endorsement" : item.category === "service" ? "Service readiness" : "Core standard"}</small></p><em>{item.expiresAt ? `to ${item.expiresAt.slice(0,10)}` : "current"}</em></article>)}</section>
        {passport.assignment?.matched && !passport.synthetic && <button className="passport-confirm" disabled={busy || passport.assignment.verificationStatus === "green" || passport.result === "red" || !passport.productionAuthorized} onClick={() => void confirmShift()}>{passport.assignment.verificationStatus === "green" ? "✓ Arrival already verified" : busy ? "Recording…" : "Confirm officer at this shift"}</button>}
        {error && <p className="passport-inline-error" role="alert">{error}</p>}
        <p className="passport-privacy-note">{passport.synthetic ? "This is a synthetic rehearsal record. It does not prove identity, confirm PSiRA data or authorise deployment." : "This page exposes limited readiness evidence only; production deployment still requires the assignment activation and control-room gates."}</p>
      </>}
    <footer><strong>Compare the officer with their physical LOKD identification.</strong><span>When in doubt, contact LOKD Operations before deployment.</span></footer>
  </main>;
}
