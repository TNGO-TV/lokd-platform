"use client";

import { useEffect, useState } from "react";
import type { PilotState } from "../lib/pilot-types";
import type { OperationsCommandState } from "../lib/operations-types";
import { usePilot } from "../lib/use-pilot";
import { useOperations } from "../lib/use-operations";
import { CLIENT_PORTAL_URL } from "../lib/public-site";

const workspaceCopy: Record<string, { eyebrow: string; title: string; subtitle: string; action: string }> = {
  Bookings: { eyebrow: "Pre-funded client demand", title: "Booking control", subtitle: "The full contract payment must be received and confirmed before a booking can release officer offers.", action: "Create booking" },
  Offers: { eyebrow: "Purpose-matched allocation", title: "Offer engine", subtitle: "An active LOKD Passport, purpose endorsement, grade, service qualification, preference, area and availability must all match.", action: "Release offer wave" },
  Applications: { eyebrow: "Officer intake", title: "Applications and verification", subtitle: "Review qualified and training-pathway applicants without presenting demo checks as real identity or PSiRA verification.", action: "Refresh applications" },
  Officers: { eyebrow: "Purpose-trained officer network", title: "Officer readiness", subtitle: "Every active officer carries a live LOKD Passport backed by current training, assessment and purpose endorsements.", action: "Invite officer" },
  Clients: { eyebrow: "Contracted service", title: "Clients and sites", subtitle: "Clients choose Armed, Unarmed or VIP, complete site approval and funding, then follow delivery.", action: "Open client workspace" },
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
  const pilot = usePilot("operations");
  const operations = useOperations();
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
      window.location.href = CLIENT_PORTAL_URL;
    } else if (name === "Officers") {
      window.location.href = "/join";
    } else if (name === "Clients") {
      window.location.href = CLIENT_PORTAL_URL;
    } else if (name === "Offers") {
      const booking = pilot.state?.bookings.find((item) => item.fundingStatus === "paid_in_full" && ["matching", "partially_staffed"].includes(item.status));
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
      {name === "Officers" && <Officers state={pilot.state} operations={operations.state} />}
      {name === "Clients" && <Clients state={pilot.state} operations={operations.state} />}
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
  onAction: (bookingId: string, action: "approve_risk_plan" | "confirm_booking_payment" | "release_offer_wave") => void;
}) {
  if (!state) return <section className="workspace-card"><div className="officer-loading"><span className="pulse-dot" /><strong>Loading connected bookings…</strong></div></section>;
  const funded = state.bookings.filter((item) => item.fundingStatus === "paid_in_full");
  const staffed = state.bookings.filter((item) => item.status === "staffed" || item.status === "active");
  const securedCents = funded.reduce((sum, item) => sum + item.clientPriceCents, 0);
  const serviceCount = new Set(state.bookings.map((item) => item.serviceType)).size;
  return <section className="workspace-card booking-board"><div className="booking-summary"><div><span>Pre-funded terms</span><strong>{money(securedCents)}</strong><small>VAT-inclusive value marked received</small></div><div><span>Service classes</span><strong>{serviceCount}</strong><small>Unarmed · Armed · VIP price book</small></div><div><span>Staffing</span><strong>{staffed.length} / {state.bookings.length}</strong><small>Connected booking records</small></div><div><span>Risk reviews</span><strong>{state.bookings.filter((item) => item.manualReview).length}</strong><small>High-risk or specialist plans</small></div></div><div className="data-head booking-head"><span>Booking</span><span>Client economics</span><span>Officer allocation</span><span>Status</span><span /></div>{state.bookings.map((item) => {
    const requiresPayment = item.fundingStatus === "awaiting_payment";
    const requiresRiskReview = item.status === "risk_review" || item.status === "site_review";
    const canRetry = item.fundingStatus === "paid_in_full" && ["matching", "partially_staffed"].includes(item.status);
    const statusTone = item.status === "active" || item.status === "staffed" ? "green" : item.status === "awaiting_payment" || requiresRiskReview ? "amber" : "blue";
    return <div className="booking-row booking-row--action" key={item.id}><span><strong>{item.id} · {item.siteName}</strong><small>{item.engagementModel === "flex" ? "LOKD Flex" : "LOKD Fixed"} · {item.specialistServiceCode.replaceAll("_", " ")} · {item.purposeLabel} · {item.riskBand} risk ({item.riskScore}) · {item.serviceDayCount} service day{item.serviceDayCount === 1 ? "" : "s"} × {item.headcount} position{item.headcount === 1 ? "" : "s"}</small></span><span><strong>{money(item.clientPriceCents)}</strong><small>{money(item.subtotalCents)} + {money(item.vatCents)} VAT · {((item.pricingInternal?.marginBasisPoints ?? 0) / 100).toFixed(1)}% margin</small></span><span><strong>{money(item.officerTotalCents)} planned</strong><small>{item.assignedOfficer ?? (item.offerStatus === "open" ? "Offer with eligible officer" : item.matchEligible ? "Pilot officer passes controls" : item.matchBlockers[0] ?? "Matching not run")}</small></span><span><em className={`pill tone-${statusTone}`}>{item.status.replaceAll("_", " ")}</em>{requiresRiskReview ? <button disabled={busy} onClick={() => onAction(item.id, "approve_risk_plan")}>Approve site plan</button> : requiresPayment ? <button disabled={busy} onClick={() => onAction(item.id, "confirm_booking_payment")}>Record demo payment</button> : canRetry ? <button disabled={busy} onClick={() => onAction(item.id, "release_offer_wave")}>Retry matching</button> : null}</span><b>›</b></div>;
  })}{error && <p className="pilot-error" role="alert">{error}</p>}<div className="demo-control-disclosure"><strong>Private demo control</strong><p>“Record demo payment” changes workflow state only. It does not charge a card, issue an invoice or confirm a real bank receipt.</p></div></section>;
}

function Offers({ state }: { state: PilotState | null }) {
  const offer = state?.offers.find((item) => item.status === "open") ?? state?.offers[0];
  const accepted = offer?.status === "accepted";
  const declined = offer?.status === "declined";
  const purpose = offer?.purposeLabel ?? "Commercial access";
  const passport = state?.officer.passport;
  if (!offer) return <section className="workspace-card"><div className="clean-state"><span>✓</span><div><strong>No offers have been released</strong><p>Create and fund a booking, then release a matching wave.</p></div></div></section>;
  return <div className="offer-engine-layout"><section className="workspace-card offer-wave-card"><div className="card-title"><div><span>{accepted ? `Assigned ${offer.serviceType} contract` : declined ? `Closed ${offer.serviceType} offer` : `Open ${offer.serviceType} contract offer`}</span><strong>{offer.siteArea} · position {offer.positionIndex} · {purpose} · {offer.engagementModel === "flex" ? "LOKD Flex" : offer.contractMonths ? `${offer.contractMonths}-month LOKD Fixed` : "single shift"}</strong></div><em>{offer.status}</em></div><div className="wave-path"><div className="wave-step done"><i>✓</i><span><strong>Payment rehearsal passed</strong><small>Full synthetic client term recorded before matching</small></span></div><div className="wave-step done"><i>✓</i><span><strong>Passport pool built</strong><small>Synthetic Passport + purpose + grade + service + opt-in</small></span></div><div className={`wave-step ${accepted || declined ? "done" : "live"}`}><i>{accepted || declined ? "✓" : "2"}</i><span><strong>Position contract delivered</strong><small>{money(offer.plannedEarningsCents)} planned across {offer.shiftCount} dated shifts</small></span></div><div className={`wave-step ${accepted ? "done" : ""}`}><i>{accepted ? "✓" : "•"}</i><span><strong>Dated roster materialisation</strong><small>{accepted ? `${state?.officer.fullName} holds position ${offer.positionIndex}` : "Acceptance creates every dated slot in this position together"}</small></span></div></div><div className="wave-candidates"><div><span>{state?.officer.initials ?? "LK"}</span><strong>{state?.officer.fullName ?? "Pilot officer"}</strong><small>{passport ? `Synthetic Passport ${passport.readinessLabel} · ${purpose} checked` : "Checking Passport rehearsal…"}</small><em className={`pill ${accepted ? "tone-green" : declined ? "tone-red" : passport?.offersEnabled ? "tone-amber" : "tone-red"}`}>{accepted ? "Offer accepted" : declined ? "Offer declined" : passport?.offersEnabled ? "Decision pending" : "Passport blocked"}</em></div></div></section><aside className="workspace-card offer-rules-card"><div className="card-title"><div><span>Offer snapshot</span><strong>Officer terms</strong></div></div><dl><div><dt>Offer</dt><dd>{offer.id}</dd></div><div><dt>Product</dt><dd>{offer.engagementModel === "flex" ? "LOKD Flex" : "LOKD Fixed"}</dd></div><div><dt>Position</dt><dd>{offer.positionIndex}</dd></div><div><dt>Service</dt><dd>{offer.serviceType}</dd></div><div><dt>Risk</dt><dd>{offer.riskBand} · {offer.riskScore}</dd></div><div><dt>First shift amount</dt><dd>{money(offer.amountCents)}</dd></div><div><dt>Planned gross</dt><dd>{money(offer.plannedEarningsCents)}</dd></div><div><dt>Required readiness</dt><dd>{offer.requiredEndorsements.join(" · ") || purpose}</dd></div><div><dt>Release cadence</dt><dd>{offer.releaseCadence}</dd></div><div><dt>Client payment</dt><dd>{offer.fundingStatus === "paid_in_full" ? "Synthetic term recorded" : "Blocked"}</dd></div></dl><p>Each roster date keeps its frozen calendar amount, so Sunday and public-holiday shifts can differ. No production work or payroll is authorised by this rehearsal.</p></aside></div>;
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

function Officers({ state, operations }: { state: PilotState | null; operations: OperationsCommandState | null }) {
  const [filter, setFilter] = useState<"all" | "employed" | "network">("all");
  const [query, setQuery] = useState("");
  if (!operations) return <section className="workspace-card"><div className="officer-loading"><span className="pulse-dot" /><strong>Loading connected workforce records…</strong></div></section>;
  const roster = operations.workforce.officers.map((officer) => {
    const isPilotOfficer = officer.officerId === state?.officer.id;
    const enabledServices = isPilotOfficer ? state.officer.services.filter((service) => service.qualified && service.optedIn).map((service) => service.serviceType) : [];
    return {
      name: officer.officerName,
      ref: officer.officerId,
      grade: isPilotOfficer ? state.officer.psiraGrade : "Verified profile",
      status: officer.employmentStatus === "not_employed" ? "Network only" : officer.employmentStatus.replaceAll("_", " "),
      services: enabledServices.length ? enabledServices.join(" · ") : officer.nextControl,
      passport: officer.passportStatus ?? "Not issued",
      purpose: officer.workforceModel ? `${officer.workforceModel.replaceAll("_", " ")} · ${officer.employerName}` : "No workforce route",
      nextDue: officer.termsVersion ? `Terms ${officer.termsVersion}` : "Engagement required",
      tone: officer.passportStatus === "active" && officer.employmentStatus === "active" ? "green" : officer.employmentStatus === "not_employed" ? "amber" : "red",
    };
  });
  const visibleRoster = roster.filter((officer) => {
    if (filter === "employed" && officer.status !== "active") return false;
    if (filter === "network" && officer.status !== "Network only") return false;
    const needle = query.trim().toLowerCase();
    return !needle || `${officer.name} ${officer.ref} ${officer.passport}`.toLowerCase().includes(needle);
  });
  return (
    <section className="workspace-card data-card">
      <div className="filter-row"><button className={filter === "all" ? "filter-active" : ""} onClick={() => setFilter("all")}>All officers <b>{roster.length}</b></button><button className={filter === "employed" ? "filter-active" : ""} onClick={() => setFilter("employed")}>Employed <b>{operations.workforce.officers.filter((item) => item.employmentStatus === "active").length}</b></button><button className={filter === "network" ? "filter-active" : ""} onClick={() => setFilter("network")}>Network only <b>{operations.workforce.profilesWithoutEmployment}</b></button><span /><input aria-label="Search officers" placeholder="Search officer or Passport" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="data-head"><span>Officer</span><span>Grade & Passport</span><span>Purpose fit & services</span><span>Status</span><span /></div>
      {visibleRoster.map((officer) => <div className="data-row" key={officer.ref}><span className="person-cell"><i>{officer.name.split(" ").map((part) => part[0]).join("")}</i><span><strong>{officer.name}</strong><small>{officer.ref}</small></span></span><span><strong>{officer.grade} · Passport {officer.passport}</strong><small>{officer.nextDue}</small></span><span><strong>{officer.purpose}</strong><small>{officer.services}</small></span><span><em className={`pill tone-${officer.tone}`}>{officer.status}</em></span><span /></div>)}
      {!visibleRoster.length && <div className="clean-state"><span>⌕</span><div><strong>No officers match this view</strong><p>Change the employment filter or search term.</p></div></div>}
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
  psiraVerificationRequired: boolean;
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
    // This effect owns the remote queue lifecycle, including its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  async function review(id: string, action: "demo_identity_manual_review" | "demo_identity_rejected" | "demo_identity_expired" | "start_demo_identity" | "complete_demo_identity" | "route_training" | "approve_assessment" | "issue_demo_network_profile") {
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
    <div className="application-state"><em className={`pill ${item.identityStatus === "demo_verified" ? "tone-green" : item.identityStatus === "checking" ? "tone-blue" : "tone-amber"}`}>{item.identityStatus.replaceAll("_", " ")}</em><small>{item.status.replaceAll("_", " ")}</small><small>{item.psiraVerificationRequired ? "Mandatory PSiRA verification before work approval" : "Training / registration guidance · no lookup required"}</small></div>
    <div className="application-actions">{!item.psiraVerificationRequired ? <button disabled={busyId === item.id} onClick={() => void review(item.id, "route_training")}>Route to Academy</button> : item.status === "network_profile_created" ? <span className="pill tone-green">Network profile created</span> : item.status === "assessment_ready" ? <button disabled={busyId === item.id} onClick={() => void review(item.id, "issue_demo_network_profile")}>Create restricted Network profile</button> : ["not_started", "expired"].includes(item.identityStatus) ? <button disabled={busyId === item.id} onClick={() => void review(item.id, "start_demo_identity")}>Start demo check</button> : ["checking", "manual_review"].includes(item.identityStatus) ? <>
      <button disabled={busyId === item.id} onClick={() => void review(item.id, "complete_demo_identity")}>Pass demo check</button>
      {item.identityStatus === "checking" && <button disabled={busyId === item.id} onClick={() => void review(item.id, "demo_identity_manual_review")}>Demo manual review</button>}
      <button disabled={busyId === item.id} onClick={() => void review(item.id, "demo_identity_rejected")}>Reject demo check</button>
      <button disabled={busyId === item.id} onClick={() => void review(item.id, "demo_identity_expired")}>Expire demo check</button>
    </> : item.identityStatus === "rejected" ? <button disabled={busyId === item.id} onClick={() => void review(item.id, "demo_identity_manual_review")}>Review demo rejection</button> : <button disabled={busyId === item.id} onClick={() => void review(item.id, "approve_assessment")}>Approve assessment</button>}</div>
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
    // This effect owns the remote queue lifecycle, including its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

function Clients({ state, operations }: { state: PilotState | null; operations: OperationsCommandState | null }) {
  if (!state || !operations) return <section className="workspace-card"><div className="officer-loading"><span className="pulse-dot" /><strong>Loading connected client and site records…</strong></div></section>;
  return <div className="client-grid">{operations.sites.map((site, index) => {
    const booking = state.bookings.find((item) => item.id === site.deployment.bookingId);
    return <article className="workspace-card client-card" key={site.id}><div className="client-card-top"><span>{String(index + 1).padStart(2, "0")}</span><em>{site.stateLabel}</em></div><h2>{site.name}</h2><p>{site.clientName}</p><dl><div><dt>Booking</dt><dd>{site.deployment.bookingId ?? "Site onboarding"}</dd></div><div><dt>Post scope</dt><dd>{site.posts.map((post) => post.name).join(" · ") || "Post pending"}</dd></div><div><dt>Service</dt><dd><span className={`service-badge service-${site.serviceType.toLowerCase()}`}>{site.serviceType}</span></dd></div><div><dt>Client funding</dt><dd>{booking ? `${money(booking.clientPriceCents)} · ${booking.fundingStatus.replaceAll("_", " ")}` : "Operations site seed"}</dd></div></dl><span className="client-record-note">Service records are available inside the assigned Client workspace.</span></article>;
  })}</div>;
}

function Compliance() {
  const controls = [
    { label: "G0 · Controlled Gauteng service scope; LOKD is the licensed contracting principal", state: "Operating model locked", done: true },
    { label: "G1 · Company PSiRA approval and certificate", state: "In progress", done: false },
    { label: "G2 · Direct employer or compliant TES; client pays LOKD and officers are paid through payroll", state: "No pass-through wallet", done: false },
    { label: "G3 · Lawful loaded-cost floor, approved site and cleared funding allocated to roster positions", state: "Evidence required", done: false },
    { label: "G4 · Verified identity, PSiRA/grade, skills, site induction and computed roster/rest eligibility", state: "Integration required", done: false },
    { label: "G5 · Production roles/data, attendance, incidents, complaints and append-only audit", state: "First access boundary connected", done: false },
    { label: "G6 · Payroll batch, payslip and EFT evidence independent of client sign-off", state: "Payroll integration required", done: false },
  ];
  return <div className="compliance-grid"><section className="workspace-card readiness-card"><div className="readiness-score"><span>Production activation gates</span><strong>1/7</strong><em>The operating model is locked; regulated service activation remains blocked.</em></div><div className="progress"><i style={{ width: "14%" }} /></div>{controls.map((item) => <div className="check-row" key={item.label}><span className={item.done ? "check-done" : "check-open"}>{item.done ? "✓" : "•"}</span><strong>{item.label}</strong><em>{item.state}</em></div>)}<div className="check-row"><span className="check-open">•</span><strong>Scale gate · Thirty clean controlled-pilot days</strong><em>Begins only after G0–G6 activation</em></div></section><section className="workspace-card controls-card"><div className="card-title"><div><span>Hard boundaries</span><strong>Authenticated pre-launch</strong></div><em>Paid shifts locked</em></div><div className="control-alert amber"><span>!</span><div><strong>Regulatory activation remains pending</strong><p>No paid shift can be activated until LOKD&apos;s PSiRA certificate and the labour/employer gates are cleared.</p></div></div><div className="control-alert amber"><span>!</span><div><strong>Payments and payroll are simulated</strong><p>No invoice, cleared bank receipt, payroll batch, payslip or EFT evidence is created by this demo.</p></div></div><div className="control-alert red"><span>!</span><div><strong>Demo and live data must remain separate</strong><p>The working transaction model will not be reused as the database for real client, officer or payroll records.</p></div></div><div className="audit-health"><span>Access boundary</span><strong>Client, Officer and Operations now require assigned sign-in roles</strong><p>Anonymous access is limited to public information, officer-interest submission and read-only Passport verification.</p></div></section></div>;
}
