"use client";

import { useEffect, useState } from "react";
import type { PilotState } from "../lib/pilot-types";
import { usePilot } from "../lib/use-pilot";

const officers = [
  { name: "Thabo Mokoena", ref: "LKD-001", grade: "Grade A", status: "Approved", services: "Unarmed · Armed · VIP", preference: "All offer alerts on", sites: "All pilot sites", passport: "Ready", purpose: "Executive protection · Commercial access", nextDue: "Fitness assessment · 04 Sep", tone: "green" },
  { name: "Lerato Khumalo", ref: "LKD-002", grade: "Grade B", status: "On booking", services: "Unarmed · Armed", preference: "Unarmed on · Armed off", sites: "Rosebank · Midrand", passport: "Ready", purpose: "Commercial access · Construction", nextDue: "Passport review · 15 Sep", tone: "blue" },
  { name: "Sibusiso Dlamini", ref: "LKD-003", grade: "Grade B", status: "Offer accepted", services: "Unarmed · Armed", preference: "Armed offers on", sites: "Linbro", passport: "Ready", purpose: "Secure logistics · Commercial access", nextDue: "Armed assessment · 29 Aug", tone: "green" },
  { name: "Ayanda Ncube", ref: "LKD-004", grade: "Grade C", status: "Approved", services: "Unarmed", preference: "Unarmed offers on", sites: "Rosebank · Midrand", passport: "Ready", purpose: "School safety · Commercial access", nextDue: "Skills review · 12 Sep", tone: "green" },
  { name: "Kabelo Maseko", ref: "LKD-005", grade: "Grade C", status: "Approval hold", services: "Unarmed", preference: "Offers blocked", sites: "Offers blocked", passport: "Restricted", purpose: "No current endorsement", nextDue: "PSiRA reverification required", tone: "red" },
];

const workspaceCopy: Record<string, { eyebrow: string; title: string; subtitle: string; action: string }> = {
  Bookings: { eyebrow: "Pre-funded client demand", title: "Booking control", subtitle: "The full contract payment must be received and confirmed before a booking can release officer offers.", action: "Create booking" },
  Offers: { eyebrow: "Purpose-matched allocation", title: "Offer engine", subtitle: "An active LOKD Passport, purpose endorsement, grade, service qualification, preference, area and availability must all match.", action: "Release offer wave" },
  Officers: { eyebrow: "Purpose-trained officer network", title: "Officer readiness", subtitle: "Every active officer carries a live LOKD Passport backed by current training, assessment and purpose endorsements.", action: "Invite officer" },
  Clients: { eyebrow: "Contracted service", title: "Clients and sites", subtitle: "Clients choose Armed, Unarmed or VIP, pay the term in full, then follow delivery.", action: "Add client" },
  Earnings: { eyebrow: "Officer payable ledger", title: "Earnings and payouts", subtitle: "Contracts up to 3 months release weekly; longer contracts release monthly before an officer can request payout.", action: "Release eligible earnings" },
  Feedback: { eyebrow: "Team testing loop", title: "Pilot feedback", subtitle: "Review bugs, confusing moments, missing capabilities and ideas submitted from every pilot screen.", action: "Refresh feedback" },
};

function Top({ name, onAction, busy }: { name: string; onAction: () => void; busy?: boolean }) {
  const copy = workspaceCopy[name];
  return (
    <section className="workspace-top">
      <div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.subtitle}</p></div>
      <button className="primary-button" disabled={busy} onClick={onAction}><span>＋</span>{busy ? "Working…" : copy.action}</button>
    </section>
  );
}

export default function WorkspaceView({ name }: { name: string }) {
  const pilot = usePilot();
  const [message, setMessage] = useState("");
  const [feedbackReload, setFeedbackReload] = useState(0);
  const action = async () => {
    if (name === "Earnings") {
      const result = await pilot.runAction({ action: "release_earnings" });
      setMessage(result ? "Eligible verified earnings moved to Available." : "No earnings were released. Check the release date or exception state.");
    } else if (name === "Feedback") {
      setFeedbackReload((value) => value + 1);
      setMessage("Feedback queue refreshed.");
    } else {
      setMessage(`${workspaceCopy[name].action} draft created in preview mode.`);
    }
    window.setTimeout(() => setMessage(""), 3200);
  };

  return (
    <div className="workspace-view">
      <Top name={name} busy={pilot.busy} onAction={() => void action()} />
      {name === "Bookings" && <Bookings />}
      {name === "Offers" && <Offers state={pilot.state} />}
      {name === "Officers" && <Officers state={pilot.state} />}
      {name === "Clients" && <Clients />}
      {name === "Earnings" && <Wallets state={pilot.state} loading={pilot.loading} busy={pilot.busy} onRelease={() => void action()} error={pilot.error} />}
      {name === "Feedback" && <FeedbackQueue reloadKey={feedbackReload} />}
      {message && <div className="inline-notice">✓ {message}</div>}
    </div>
  );
}

function Bookings() {
  const items = [
    { id: "BK-2081", client: "Northbridge Property Services", site: "Rosebank Offices", price: "R48,000", time: "1 month · Weekly release", service: "Unarmed", purpose: "Commercial access", officer: "Lerato Khumalo", state: "Active", offer: "Passport verified · purpose current" },
    { id: "BK-2082", client: "Eastline Freight Solutions", site: "Linbro Yard", price: "R134,400", time: "3 months · Weekly release", service: "Armed", purpose: "Secure logistics", officer: "Sibusiso Dlamini", state: "Staffed", offer: "Passport ready · monthly armed assessment current" },
    { id: "BK-2083", client: "Metsi Industrial Supplies", site: "Midrand Depot", price: "R384,000", time: "6 months · Monthly release", service: "VIP", purpose: "Executive protection", officer: "Thabo Mokoena", state: "Staffed", offer: "Passport ready · tactical readiness current" },
  ];
  return <section className="workspace-card booking-board"><div className="booking-summary"><div><span>Pre-funded terms</span><strong>R566,400</strong><small>Full client-term value secured</small></div><div><span>Service classes</span><strong>3</strong><small>Unarmed · Armed · VIP</small></div><div><span>Staffing</span><strong>3 / 3</strong><small>Passport and purpose gates passed</small></div><div><span>Awaiting release</span><strong>1</strong><small>R960 pending weekly cycle</small></div></div><div className="data-head booking-head"><span>Booking</span><span>Client price</span><span>Officer assignment</span><span>Status</span><span /></div>{items.map((item) => <button className="booking-row" key={item.id}><span><strong>{item.id} · {item.site}</strong><small>{item.client} · {item.service} · {item.purpose} · {item.time}</small></span><span><strong>{item.price}</strong><small>Paid in full · LOKD price</small></span><span><strong>{item.officer}</strong><small>{item.offer}</small></span><span><em className={item.state === "Active" ? "pill tone-green" : "pill tone-blue"}>{item.state}</em></span><b>›</b></button>)}</section>;
}

function Offers({ state }: { state: PilotState | null }) {
  const offer = state?.offers.find((item) => item.id === "OF-2084");
  const accepted = offer?.status === "accepted";
  const declined = offer?.status === "declined";
  const purpose = offer?.purposeLabel ?? "Commercial access";
  const passport = state?.officer.passport;
  return <div className="offer-engine-layout"><section className="workspace-card offer-wave-card"><div className="card-title"><div><span>{accepted ? "Assigned Unarmed offer" : declined ? "Closed Unarmed offer" : "Live Unarmed offer"}</span><strong>Midrand · {purpose} · 1-month contract</strong></div><em>{offer ? offer.status : "Loading"}</em></div><div className="wave-path"><div className="wave-step done"><i>✓</i><span><strong>Payment gate passed</strong><small>Full client payment received and confirmed</small></span></div><div className="wave-step done"><i>✓</i><span><strong>Passport pool built</strong><small>Active Passport + purpose endorsement + grade + service + opt-in</small></span></div><div className={`wave-step ${accepted || declined ? "done" : "live"}`}><i>{accepted || declined ? "✓" : "2"}</i><span><strong>Fixed offer delivered</strong><small>R980 · weekly release</small></span></div><div className={`wave-step ${accepted ? "done" : ""}`}><i>{accepted ? "✓" : "•"}</i><span><strong>Atomic assignment</strong><small>{accepted ? "Lerato secured the booking" : "First currently eligible acceptance secures the booking"}</small></span></div></div><div className="wave-candidates"><div><span>LK</span><strong>{state?.officer.fullName ?? "Lerato Khumalo"}</strong><small>{passport ? `Passport ${passport.readinessLabel} · ${purpose} endorsed` : "Checking Passport readiness…"}</small><em className={`pill ${accepted ? "tone-green" : declined ? "tone-red" : passport?.offersEnabled ? "tone-amber" : "tone-red"}`}>{accepted ? "Offer accepted" : declined ? "Offer declined" : passport?.offersEnabled ? "Decision pending" : "Passport blocked"}</em></div><div><span>TM</span><strong>Thabo Mokoena</strong><small>Passport ready · Commercial access endorsed</small><em className="pill tone-blue">Wave candidate</em></div><div><span>SD</span><strong>Sibusiso Dlamini</strong><small>Passport ready, but Unarmed notifications off</small><em className="pill tone-red">Preference blocked</em></div></div></section><aside className="workspace-card offer-rules-card"><div className="card-title"><div><span>Offer snapshot</span><strong>Officer terms</strong></div></div><dl><div><dt>Service</dt><dd>Unarmed</dd></div><div><dt>Purpose</dt><dd>{purpose}</dd></div><div><dt>Passport gate</dt><dd>Active and current</dd></div><div><dt>Minimum grade</dt><dd>Grade C</dd></div><div><dt>Officer amount</dt><dd>R980 fixed / shift</dd></div><div><dt>Contract term</dt><dd>1 month</dd></div><div><dt>Release cadence</dt><dd>Weekly</dd></div><div><dt>Client payment</dt><dd>Received and confirmed in full</dd></div></dl><p>A higher-grade officer may accept lower-grade work only when their Passport, purpose training and service qualification are current and they have opted in.</p></aside></div>;
}

function money(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(cents / 100);
}

function Wallets({ state, loading, busy, onRelease, error }: { state: PilotState | null; loading: boolean; busy: boolean; onRelease: () => void; error: string }) {
  if (loading || !state) return <section className="workspace-card"><div className="officer-loading"><span className="pulse-dot" /><strong>{error || "Loading the earnings ledger…"}</strong></div></section>;
  const heldCents = state.ledger.filter((entry) => entry.state === "held").reduce((sum, entry) => sum + entry.amountCents, 0);
  const stateLabels: Record<string, string> = { pending_signoff: "Service record pending", pending_release: "Release date pending", available: "Available", withdrawal_queued: "Payout processing", paid: "Paid", held: "Exception hold" };
  return <div className="wallet-layout"><section className="workspace-card wallet-ops"><div className="booking-summary wallet-summary"><div><span>Pending</span><strong>{money(state.wallet.pendingCents)}</strong><small>Awaiting verification or scheduled release</small></div><div><span>Available</span><strong>{money(state.wallet.availableCents)}</strong><small>Officer can request payout</small></div><div><span>Held</span><strong>{money(heldCents)}</strong><small>{heldCents ? "Affected earnings only" : "No active exceptions"}</small></div></div><div className="data-head wallet-head"><span>Officer</span><span>Source</span><span>Pending</span><span>Available</span><span>Status</span></div>{state.ledger.map((item) => { const pending = item.state === "pending_signoff" || item.state === "pending_release"; return <div className="wallet-ledger-row" key={item.id}><span><strong>{state.officer.fullName}</strong><small>{state.officer.id} · Approved</small></span><span><strong>{item.bookingId} · {item.siteName}</strong><small>{item.releaseCadence} earning record</small></span><span>{pending ? money(item.amountCents) : "—"}</span><span>{item.state === "available" ? money(item.amountCents) : "—"}</span><em>{stateLabels[item.state]}</em></div>; })}</section><aside className="workspace-card thursday-card"><span>LOKD earnings controls</span><h2>{money(state.wallet.availableCents)} available</h2><p>Only verified earnings that have reached their weekly or monthly release date can move to Available.</p><div className="cutoff"><span>Short contracts</span><strong>0–3 months · Weekly</strong></div><div className="cutoff"><span>Long contracts</span><strong>Over 3 months · Monthly</strong></div><div className="cutoff"><span>Payout processing</span><strong>Thursday · expected Friday clearance</strong></div><button disabled={busy} onClick={onRelease}>{busy ? "Releasing…" : "Release eligible earnings"}</button><small>Operations release and payout submission are separate, auditable actions.</small>{error && <p className="pilot-error" role="alert">{error}</p>}<div className="future-card-note"><strong>LOKD Card · interest register</strong><p>Card concept only—not yet available. Ordinary EFT payout access will not depend on a future card.</p></div></aside></div>;
}

function Roster() {
  const days = [
    { day: "Fri 21", shifts: [{ time: "06:00", site: "Rosebank Offices", officer: "Lerato Khumalo", state: "On post" }, { time: "18:00", site: "Linbro Yard", officer: "Sibusiso Dlamini", state: "Confirmed" }] },
    { day: "Sat 22", shifts: [{ time: "06:00", site: "Midrand Depot", officer: "Ayanda Ncube", state: "Confirmed" }] },
    { day: "Sun 23", shifts: [] },
    { day: "Mon 24", shifts: [{ time: "06:00", site: "Rosebank Offices", officer: "Lerato Khumalo", state: "Scheduled" }, { time: "18:00", site: "Linbro Yard", officer: "Thabo Mokoena", state: "Scheduled" }] },
  ];
  return (
    <div className="roster-layout">
      <section className="workspace-card roster-board">
        <div className="card-title"><div><span>This week</span><strong>Contracted shifts</strong></div><em>5 filled · 0 gaps</em></div>
        <div className="roster-days">
          {days.map((day) => <div className="roster-day" key={day.day}><h3>{day.day}</h3>{day.shifts.length ? day.shifts.map((shift) => <button key={shift.time + shift.site}><time>{shift.time}</time><span><strong>{shift.site}</strong><small>{shift.officer}</small></span><em>{shift.state}</em></button>) : <p>No contracted shifts</p>}</div>)}
        </div>
      </section>
      <aside className="workspace-card eligibility-card">
        <div className="card-title"><div><span>Assignment gate</span><strong>Eligible now</strong></div><em>4 of 5</em></div>
        {officers.slice(0,4).map((officer) => <div className="compact-person" key={officer.ref}><span>{officer.name.split(" ").map((part) => part[0]).join("")}</span><div><strong>{officer.name}</strong><small>{officer.grade} · {officer.sites}</small></div><i className={`tone-${officer.tone}`} /></div>)}
      <div className="hard-block"><strong>1 hard block</strong><p>Kabelo Maseko cannot receive offers until PSiRA reverification is complete.</p></div>
      </aside>
    </div>
  );
}

function Officers({ state }: { state: PilotState | null }) {
  const roster = officers.map((officer) => {
    if (officer.ref !== "LKD-002" || !state) return officer;
    const enabledServices = state.officer.services.filter((service) => service.qualified && service.optedIn).map((service) => service.serviceType);
    const purposeLabels = state.officer.passport.endorsements.filter((endorsement) => endorsement.category === "purpose" && endorsement.status === "current").map((endorsement) => endorsement.label);
    const nextReview = state.officer.passport.nextReviewAt
      ? new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short" }).format(new Date(state.officer.passport.nextReviewAt))
      : "Not scheduled";
    return {
      ...officer,
      name: state.officer.fullName,
      grade: state.officer.psiraGrade,
      services: enabledServices.length ? enabledServices.join(" · ") : "No offer classes enabled",
      passport: state.officer.passport.readinessLabel,
      purpose: purposeLabels.length ? purposeLabels.join(" · ") : "No current purpose endorsement",
      nextDue: `Passport review · ${nextReview}`,
      tone: state.officer.passport.offersEnabled ? officer.tone : "red",
    };
  });
  return (
    <section className="workspace-card data-card">
      <div className="filter-row"><button className="filter-active">All officers <b>5</b></button><button>Passport ready <b>4</b></button><button>Restricted <b>1</b></button><span /><input aria-label="Search officers" placeholder="Search officer or Passport" /></div>
      <div className="data-head"><span>Officer</span><span>Grade & Passport</span><span>Purpose fit & services</span><span>Status</span><span /></div>
      {roster.map((officer) => <button className="data-row" key={officer.ref}><span className="person-cell"><i>{officer.name.split(" ").map((part) => part[0]).join("")}</i><span><strong>{officer.name}</strong><small>{officer.ref} · {officer.sites}</small></span></span><span><strong>{officer.grade} · Passport {officer.passport}</strong><small>{officer.nextDue}</small></span><span><strong>{officer.purpose}</strong><small>{officer.services} · {officer.preference}</small></span><span><em className={`pill tone-${officer.tone}`}>{officer.status}</em></span><span>›</span></button>)}
    </section>
  );
}

type FeedbackItem = {
  id: string;
  reviewerEmail: string | null;
  route: string;
  role: string;
  category: "Bug" | "Confusing" | "Missing" | "Idea";
  score: number;
  note: string;
  status: string;
  createdAt: string;
};

function FeedbackQueue({ reloadKey }: { reloadKey: number }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch("/api/feedback", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { feedback?: FeedbackItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Feedback could not be loaded.");
        setItems(payload.feedback ?? []);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Feedback could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const newItems = items.filter((item) => item.status === "new").length;
  const averageScore = items.length ? (items.reduce((total, item) => total + item.score, 0) / items.length).toFixed(1) : "—";
  const categoryCounts = items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.category]: (counts[item.category] ?? 0) + 1 }), {});
  const statusTone = (status: string) => status === "resolved" ? "green" : status === "reviewed" ? "blue" : "amber";
  const categoryTone = (category: FeedbackItem["category"]) => category === "Bug" ? "red" : category === "Confusing" ? "amber" : category === "Missing" ? "blue" : "green";

  return (
    <section className="workspace-card booking-board" aria-live="polite">
      <div className="booking-summary">
        <div><span>Submissions</span><strong>{loading ? "…" : items.length}</strong><small>Across the current pilot</small></div>
        <div><span>New to review</span><strong>{loading ? "…" : newItems}</strong><small>Operations feedback queue</small></div>
        <div><span>Average clarity</span><strong>{loading ? "…" : averageScore}</strong><small>Team score out of 5</small></div>
        <div><span>Most reported</span><strong>{loading ? "…" : Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None"}</strong><small>Bug · Confusing · Missing · Idea</small></div>
      </div>
      {error ? <div className="inline-notice" role="alert">{error}</div> : loading ? <div className="officer-loading"><span className="pulse-dot" /><strong>Loading team feedback…</strong></div> : items.length === 0 ? <div className="clean-state"><span>✓</span><div><strong>No feedback submitted yet</strong><p>The floating feedback control is available on every pilot screen.</p></div></div> : <>
        <div className="data-head booking-head"><span>Feedback</span><span>Experience</span><span>Reviewer</span><span>Status</span><span /></div>
        {items.map((item) => <div className="booking-row" key={item.id}><span><strong>{item.note}</strong><small>{new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</small></span><span><strong><em className={`pill tone-${categoryTone(item.category)}`}>{item.category}</em> · {item.score}/5</strong><small>{item.role} · {item.route}</small></span><span><strong>{item.reviewerEmail ?? "Authenticated team reviewer"}</strong><small>Submitted from the pilot</small></span><span><em className={`pill tone-${statusTone(item.status)}`}>{item.status}</em></span><b>›</b></div>)}
      </>}
    </section>
  );
}

function Clients() {
  const clients = [
    { client: "Northbridge Property Services", site: "Rosebank Offices", window: "1 month · Weekly officer release", state: "On post", meta: "Visitor verification · Badge register", service: "Unarmed", price: "R34,800 · Paid in full" },
    { client: "Eastline Freight Solutions", site: "Linbro Yard", window: "3 months · Weekly officer release", state: "Starts 18:00", meta: "Vehicle gate · Perimeter checks", service: "Armed", price: "R134,400 · Paid in full" },
    { client: "Metsi Industrial Supplies", site: "Midrand Depot", window: "6 months · Monthly officer release", state: "Sat 06:00", meta: "Executive movement · Arrival control", service: "VIP", price: "R384,000 · Paid in full" },
  ];
  return <div className="client-grid">{clients.map((item, index) => <article className="workspace-card client-card" key={item.site}><div className="client-card-top"><span>0{index+1}</span><em>{item.state}</em></div><h2>{item.site}</h2><p>{item.client}</p><dl><div><dt>Contract and release</dt><dd>{item.window}</dd></div><div><dt>Post scope</dt><dd>{item.meta}</dd></div><div><dt>Service</dt><dd><span className={`service-badge service-${item.service.toLowerCase()}`}>{item.service}</span></dd></div><div><dt>Client funding</dt><dd>{item.price}</dd></div></dl><button>Open service record →</button></article>)}</div>;
}

function Incidents() {
  const items = [
    { ref: "INC-0026", event: "Vehicle-gate latch did not secure", site: "Eastline Linbro Yard", severity: "Medium", status: "Client action", outcome: "Officer remained at gate; maintenance requested; no loss or injury." },
    { ref: "INC-0027", event: "Visitor arrived without approved booking", site: "Northbridge Rosebank Offices", severity: "Low", status: "Resolved", outcome: "Entry declined; host confirmed no appointment; no confrontation." },
    { ref: "INC-0025", event: "Delivery outside authorised window", site: "Metsi Midrand Depot", severity: "Low", status: "Resolved", outcome: "Vehicle remained outside the controlled area; delivery rescheduled." },
  ];
  return <section className="workspace-card incident-list"><div className="card-title"><div><span>Case register</span><strong>Open and recent incidents</strong></div><em>1 action · 2 resolved</em></div>{items.map((item) => <button key={item.ref}><span className="incident-ref">{item.ref}</span><span className="incident-main"><strong>{item.event}</strong><small>{item.site}</small><p>{item.outcome}</p></span><span><em className={item.severity === "Medium" ? "pill tone-amber" : "pill tone-blue"}>{item.severity}</em></span><span><em className={item.status === "Resolved" ? "pill tone-green" : "pill tone-amber"}>{item.status}</em></span><b>›</b></button>)}</section>;
}

function Compliance() {
  return <div className="compliance-grid"><section className="workspace-card readiness-card"><div className="readiness-score"><span>Launch controls</span><strong>11/14</strong><em>Three gates remain in preview</em></div><div className="progress"><i /></div>{["Organisation profile approved","Officer employment records verified","PSiRA status checks current","Pilot sites and post orders approved","Payroll and invoice activation","Production data access policy"].map((item,index) => <div className="check-row" key={item}><span className={index < 4 ? "check-done" : "check-open"}>{index < 4 ? "✓" : "•"}</span><strong>{item}</strong><em>{index < 4 ? "Passed" : "Required"}</em></div>)}</section><section className="workspace-card controls-card"><div className="card-title"><div><span>Exception queue</span><strong>Hard controls</strong></div><em>2</em></div><div className="control-alert red"><span>!</span><div><strong>Officer assignment blocked</strong><p>Kabelo Maseko · PSiRA reverification required</p></div></div><div className="control-alert amber"><span>!</span><div><strong>Invoice issuing locked</strong><p>Organisation activation checklist is not complete</p></div></div><div className="audit-health"><span>Audit health</span><strong>All connected records retrievable</strong><p>Assignments, attendance, incidents and timesheet decisions are present in the demo audit trail.</p></div></section></div>;
}
