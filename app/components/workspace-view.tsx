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
  Applications: { eyebrow: "Officer intake", title: "Applications and verification", subtitle: "Review qualified and training-pathway applicants without presenting demo checks as real identity or PSiRA verification.", action: "Refresh applications" },
  Officers: { eyebrow: "Purpose-trained officer network", title: "Officer readiness", subtitle: "Every active officer carries a live LOKD Passport backed by current training, assessment and purpose endorsements.", action: "Invite officer" },
  Clients: { eyebrow: "Contracted service", title: "Clients and sites", subtitle: "Clients choose Armed, Unarmed or VIP, pay the term in full, then follow delivery.", action: "Add client" },
  Earnings: { eyebrow: "Officer payable ledger", title: "Earnings and payouts", subtitle: "Contracts up to 3 months release weekly; longer contracts release monthly before an officer can request payout.", action: "Release eligible earnings" },
  Feedback: { eyebrow: "Team testing loop", title: "Pilot feedback", subtitle: "Review bugs, confusing moments, missing capabilities and ideas submitted from every pilot screen.", action: "Refresh feedback" },
  "Launch readiness": { eyebrow: "Private demo controls", title: "Launch readiness", subtitle: "Regulatory, billing, identity and access gates remain explicitly separated from the connected product demo.", action: "Reset shared demo" },
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
    } else if (name === "Applications") {
      setFeedbackReload((value) => value + 1);
      setMessage("Application queue refreshed.");
    } else if (name === "Launch readiness") {
      const result = await pilot.runAction({ action: "reset_demo" });
      setMessage(result ? "Shared transaction demo reset. Applications and feedback were preserved." : "The demo could not be reset.");
    } else if (name === "Bookings") {
      window.location.href = "/client";
    } else if (name === "Officers") {
      window.location.href = "/join";
    } else if (name === "Offers") {
      const booking = pilot.state?.bookings.find((item) => item.fundingStatus === "paid_in_full" && item.status === "matching");
      if (!booking) setMessage("No funded booking is waiting for another offer wave.");
      else {
        const result = await pilot.runAction({ action: "release_offer_wave", bookingId: booking.id });
        setMessage(result ? "Eligibility rechecked and the offer-wave result recorded." : "The offer wave could not be released.");
      }
    } else {
      setMessage(`${workspaceCopy[name].action} draft created in preview mode.`);
    }
    window.setTimeout(() => setMessage(""), 3200);
  };

  return (
    <div className="workspace-view">
      <Top name={name} busy={pilot.busy} onAction={() => void action()} />
      {name === "Bookings" && <Bookings state={pilot.state} busy={pilot.busy} error={pilot.error} onAction={(bookingId, actionName) => void pilot.runAction({ action: actionName, bookingId })} />}
      {name === "Offers" && <Offers state={pilot.state} />}
      {name === "Applications" && <Applications reloadKey={feedbackReload} />}
      {name === "Officers" && <Officers state={pilot.state} />}
      {name === "Clients" && <Clients />}
      {name === "Earnings" && <Wallets state={pilot.state} loading={pilot.loading} busy={pilot.busy} onRelease={() => void action()} error={pilot.error} />}
      {name === "Feedback" && <FeedbackQueue reloadKey={feedbackReload} />}
      {name === "Launch readiness" && <Compliance />}
      {message && <div className="inline-notice">✓ {message}</div>}
    </div>
  );
}

function Bookings({ state, busy, error, onAction }: {
  state: PilotState | null;
  busy: boolean;
  error: string;
  onAction: (bookingId: string, action: "confirm_booking_payment" | "release_offer_wave") => void;
}) {
  if (!state) return <section className="workspace-card"><div className="officer-loading"><span className="pulse-dot" /><strong>Loading connected bookings…</strong></div></section>;
  const funded = state.bookings.filter((item) => item.fundingStatus === "paid_in_full");
  const staffed = state.bookings.filter((item) => item.status === "staffed" || item.status === "active");
  const securedCents = funded.reduce((sum, item) => sum + item.clientPriceCents, 0);
  const serviceCount = new Set(state.bookings.map((item) => item.serviceType)).size;
  return <section className="workspace-card booking-board"><div className="booking-summary"><div><span>Pre-funded terms</span><strong>{money(securedCents)}</strong><small>Full client-term value marked received</small></div><div><span>Service classes</span><strong>{serviceCount}</strong><small>Unarmed · Armed · VIP price book</small></div><div><span>Staffing</span><strong>{staffed.length} / {state.bookings.length}</strong><small>Connected booking records</small></div><div><span>Payment queue</span><strong>{state.bookings.filter((item) => item.fundingStatus !== "paid_in_full").length}</strong><small>Demo confirmations required</small></div></div><div className="data-head booking-head"><span>Booking</span><span>Client price</span><span>Officer assignment</span><span>Status</span><span /></div>{state.bookings.map((item) => {
    const requiresPayment = item.fundingStatus !== "paid_in_full";
    const canRetry = item.fundingStatus === "paid_in_full" && item.status === "matching";
    const statusTone = item.status === "active" || item.status === "staffed" ? "green" : item.status === "awaiting_payment" ? "amber" : "blue";
    return <div className="booking-row booking-row--action" key={item.id}><span><strong>{item.id} · {item.siteName}</strong><small>{state.client.organisationName} · {item.serviceType} · {item.purposeLabel} · {item.contractMonths ? `${item.contractMonths} month${item.contractMonths === 1 ? "" : "s"}` : "Single shift"} · {item.releaseCadence}</small></span><span><strong>{money(item.clientPriceCents)}</strong><small>{requiresPayment ? "Awaiting full-term payment" : "Paid in full · demo record"}</small></span><span><strong>{item.assignedOfficer ?? (item.offerStatus === "open" ? "Offer with eligible officer" : "Not assigned")}</strong><small>{item.matchEligible ? "Pilot officer passes current controls" : item.matchBlockers[0] ?? "Matching not run"}</small></span><span><em className={`pill tone-${statusTone}`}>{item.status.replaceAll("_", " ")}</em>{requiresPayment ? <button disabled={busy} onClick={() => onAction(item.id, "confirm_booking_payment")}>Record demo payment</button> : canRetry ? <button disabled={busy} onClick={() => onAction(item.id, "release_offer_wave")}>Retry matching</button> : null}</span><b>›</b></div>;
  })}{error && <p className="pilot-error" role="alert">{error}</p>}<div className="demo-control-disclosure"><strong>Private demo control</strong><p>“Record demo payment” changes workflow state only. It does not charge a card, issue an invoice or confirm a real bank receipt.</p></div></section>;
}

function Offers({ state }: { state: PilotState | null }) {
  const offer = state?.offers.find((item) => item.status === "open") ?? state?.offers[0];
  const accepted = offer?.status === "accepted";
  const declined = offer?.status === "declined";
  const purpose = offer?.purposeLabel ?? "Commercial access";
  const passport = state?.officer.passport;
  if (!offer) return <section className="workspace-card"><div className="clean-state"><span>✓</span><div><strong>No offers have been released</strong><p>Create and fund a booking, then release a matching wave.</p></div></div></section>;
  return <div className="offer-engine-layout"><section className="workspace-card offer-wave-card"><div className="card-title"><div><span>{accepted ? `Assigned ${offer.serviceType} offer` : declined ? `Closed ${offer.serviceType} offer` : `Live ${offer.serviceType} offer`}</span><strong>{offer.siteArea} · {purpose} · {offer.contractMonths ? `${offer.contractMonths}-month contract` : "single shift"}</strong></div><em>{offer.status}</em></div><div className="wave-path"><div className="wave-step done"><i>✓</i><span><strong>Payment gate passed</strong><small>Full client payment recorded before matching</small></span></div><div className="wave-step done"><i>✓</i><span><strong>Passport pool built</strong><small>Passport + purpose + grade + service + opt-in</small></span></div><div className={`wave-step ${accepted || declined ? "done" : "live"}`}><i>{accepted || declined ? "✓" : "2"}</i><span><strong>Fixed offer delivered</strong><small>{money(offer.amountCents)} · {offer.releaseCadence.toLowerCase()} release</small></span></div><div className={`wave-step ${accepted ? "done" : ""}`}><i>{accepted ? "✓" : "•"}</i><span><strong>Single-winner assignment</strong><small>{accepted ? `${state?.officer.fullName} secured the booking` : "First still-eligible acceptance secures the booking"}</small></span></div></div><div className="wave-candidates"><div><span>{state?.officer.initials ?? "LK"}</span><strong>{state?.officer.fullName ?? "Pilot officer"}</strong><small>{passport ? `Passport ${passport.readinessLabel} · ${purpose} checked` : "Checking Passport readiness…"}</small><em className={`pill ${accepted ? "tone-green" : declined ? "tone-red" : passport?.offersEnabled ? "tone-amber" : "tone-red"}`}>{accepted ? "Offer accepted" : declined ? "Offer declined" : passport?.offersEnabled ? "Decision pending" : "Passport blocked"}</em></div></div></section><aside className="workspace-card offer-rules-card"><div className="card-title"><div><span>Offer snapshot</span><strong>Officer terms</strong></div></div><dl><div><dt>Offer</dt><dd>{offer.id}</dd></div><div><dt>Service</dt><dd>{offer.serviceType}</dd></div><div><dt>Purpose</dt><dd>{purpose}</dd></div><div><dt>Passport gate</dt><dd>Active and current</dd></div><div><dt>Minimum grade</dt><dd>{offer.minimumGrade}</dd></div><div><dt>Officer amount</dt><dd>{money(offer.amountCents)} fixed / shift</dd></div><div><dt>Contract term</dt><dd>{offer.contractMonths ? `${offer.contractMonths} months` : "Single shift"}</dd></div><div><dt>Release cadence</dt><dd>{offer.releaseCadence}</dd></div><div><dt>Client payment</dt><dd>{offer.fundingStatus === "paid_in_full" ? "Recorded in full" : "Blocked"}</dd></div></dl><p>Client price and officer offer remain separate. A higher-grade officer may accept lower-grade work only when every qualification and preference gate still passes.</p></aside></div>;
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

type ApplicationItem = {
  id: string;
  pathway: "qualified" | "training";
  fullName: string;
  mobile: string;
  email: string;
  city: string;
  province: string;
  psiraStatus: string;
  psiraNumber: string | null;
  psiraGrade: string | null;
  services: string[];
  purposes: string[];
  training: string[];
  identityStatus: string;
  status: string;
  source: string;
  createdAt: string;
};

function Applications({ reloadKey }: { reloadKey: number }) {
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch("/api/applications", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { applications?: ApplicationItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Applications could not be loaded.");
        setItems(payload.applications ?? []);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Applications could not be loaded.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reloadKey, refreshKey]);

  async function review(id: string, action: "start_demo_identity" | "complete_demo_identity" | "route_training" | "approve_assessment") {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The application could not be updated.");
      setRefreshKey((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The application could not be updated.");
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <section className="workspace-card"><div className="officer-loading"><span className="pulse-dot" /><strong>Loading officer applications…</strong></div></section>;
  return <section className="workspace-card application-queue"><div className="demo-control-disclosure"><strong>Demo verification only</strong><p>These controls demonstrate workflow states. No bank-grade ID, Home Affairs or live PSiRA verification provider is connected yet, and no action below makes an applicant deployable.</p></div><div className="booking-summary"><div><span>Total applications</span><strong>{items.length}</strong><small>Homepage and demo seed</small></div><div><span>Qualified pathway</span><strong>{items.filter((item) => item.pathway === "qualified").length}</strong><small>Credentials require verification</small></div><div><span>Training pathway</span><strong>{items.filter((item) => item.pathway === "training").length}</strong><small>Academy opportunity</small></div><div><span>Assessment ready</span><strong>{items.filter((item) => item.status === "assessment_ready").length}</strong><small>Demo state only</small></div></div>{items.map((item) => <article key={item.id}>
    <div className="application-person"><span>{item.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</span><div><strong>{item.fullName}</strong><small>{item.id} · {item.city}, {item.province}</small></div></div>
    <div><strong>{item.psiraGrade ?? "No verified grade"}</strong><small>{item.psiraNumber ?? item.psiraStatus.replaceAll("_", " ")} · {item.services.join(" · ")}</small></div>
    <div><strong>{item.pathway === "training" ? "Academy pathway" : "Qualified officer pathway"}</strong><small>{item.pathway === "training" ? item.training.join(" · ") : item.purposes.join(" · ")}</small></div>
    <div className="application-state"><em className={`pill ${item.identityStatus === "demo_verified" ? "tone-green" : item.identityStatus === "checking" ? "tone-blue" : "tone-amber"}`}>{item.identityStatus.replaceAll("_", " ")}</em><small>{item.status.replaceAll("_", " ")}</small></div>
    <div className="application-actions">{item.pathway === "training" ? <button disabled={busyId === item.id} onClick={() => void review(item.id, "route_training")}>Route to Academy</button> : item.identityStatus === "not_started" ? <button disabled={busyId === item.id} onClick={() => void review(item.id, "start_demo_identity")}>Start demo check</button> : item.identityStatus === "checking" ? <button disabled={busyId === item.id} onClick={() => void review(item.id, "complete_demo_identity")}>Complete demo check</button> : <button disabled={busyId === item.id} onClick={() => void review(item.id, "approve_assessment")}>Approve assessment</button>}</div>
  </article>)}{error && <p className="pilot-error" role="alert">{error}</p>}</section>;
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
  const controls = [
    { label: "Premium price book and persisted quote", state: "Connected" },
    { label: "Full-term funding gate and matched offers", state: "Connected" },
    { label: "LOKD Passport, attendance and service record", state: "Connected" },
    { label: "Earnings release and payout-request workflow", state: "Connected" },
    { label: "Company PSiRA and final regulatory activation", state: "In progress this week" },
    { label: "Production payment, identity and PSiRA providers", state: "Integration required" },
    { label: "Team roles, external access and production data policy", state: "Required before public access" },
  ];
  return <div className="compliance-grid"><section className="workspace-card readiness-card"><div className="readiness-score"><span>Phase 1 demo</span><strong>4/7</strong><em>Four product controls connected · three launch gates open</em></div><div className="progress"><i style={{ width: "57%" }} /></div>{controls.map((item,index) => <div className="check-row" key={item.label}><span className={index < 4 ? "check-done" : "check-open"}>{index < 4 ? "✓" : "•"}</span><strong>{item.label}</strong><em>{item.state}</em></div>)}</section><section className="workspace-card controls-card"><div className="card-title"><div><span>Hard boundaries</span><strong>Private demo mode</strong></div><em>3 open</em></div><div className="control-alert amber"><span>!</span><div><strong>Regulatory activation remains pending</strong><p>The product demo does not represent an operational security deployment or final PSiRA approval.</p></div></div><div className="control-alert amber"><span>!</span><div><strong>Payments are simulated</strong><p>No card charge, invoice or bank receipt is created by the Operations payment control.</p></div></div><div className="control-alert red"><span>!</span><div><strong>Do not publish write access yet</strong><p>Add authenticated team roles before moving from owner-only access to public or external testing.</p></div></div><div className="audit-health"><span>Demo reset</span><strong>Applications and feedback are preserved</strong><p>The reset action clears only team-created demo bookings and returns the pilot transaction to its opening state.</p></div></section></div>;
}
