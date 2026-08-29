"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ServiceType } from "../lib/pilot-types";
import {
  assessRisk,
  defaultRiskInput,
  engagementModels,
  noticePriceBook,
  purposePriceBook,
  quoteBooking,
  rosterPatterns,
  servicePriceBook,
  serviceMeetsRecommendation,
  termLabels,
  type ContractTerm,
  type EngagementModel,
  type RiskInput,
  type RosterPattern,
} from "../lib/pilot-pricing";
import { usePilot } from "../lib/use-pilot";

const serviceOptions = (Object.keys(servicePriceBook) as ServiceType[]).map(
  (name) => ({ name, ...servicePriceBook[name] }),
);

function money(cents: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function defaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() + 5);
  return date.toISOString().slice(0, 10);
}

function johannesburgToday() {
  return new Date(Date.now() + 2 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function newBookingCommandId() {
  return `client-booking-${globalThis.crypto.randomUUID()}`;
}

export default function ClientApp() {
  const pilot = usePilot("client");
  const [requestOpen, setRequestOpen] = useState(false);
  const [minimumStartDate] = useState(johannesburgToday);
  const [service, setService] = useState<ServiceType>("Unarmed");
  const [engagementModel, setEngagementModel] =
    useState<EngagementModel>("fixed");
  const [term, setTerm] = useState<ContractTerm>("1");
  const [rosterPattern, setRosterPattern] =
    useState<RosterPattern>("monday_saturday");
  const [purposeCode, setPurposeCode] = useState("commercial_access");
  const [riskInput, setRiskInput] = useState<RiskInput>(defaultRiskInput);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [bookingCommandId, setBookingCommandId] = useState(newBookingCommandId);
  const [siteName, setSiteName] = useState("Northbridge Rosebank Offices");
  const [siteArea, setSiteArea] = useState("Rosebank");
  const [addressLabel, setAddressLabel] = useState("Rosebank, Johannesburg");
  const [shift, setShift] = useState<"day" | "night">("day");
  const [postName, setPostName] = useState("Main access");
  const [instructions, setInstructions] = useState(
    "Standard contracted post instructions apply.",
  );
  const [notice, setNotice] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [supportCategory, setSupportCategory] = useState<string | null>(null);
  const [supportSummary, setSupportSummary] = useState("");
  const [supportDetail, setSupportDetail] = useState("");
  const [supportTarget, setSupportTarget] = useState<{
    bookingId?: string;
    shiftId?: string;
  }>({});
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [selectedServiceRecordId, setSelectedServiceRecordId] = useState("");

  useEffect(() => {
    function closeDrawer(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setRequestOpen(false);
      setSupportCategory(null);
      setAccountOpen(false);
    }
    window.addEventListener("keydown", closeDrawer);
    return () => window.removeEventListener("keydown", closeDrawer);
  }, []);

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3000);
  }

  const risk = assessRisk(purposeCode, riskInput);
  const effectiveService = serviceMeetsRecommendation(
    service,
    risk.recommendedService,
  )
    ? service
    : risk.recommendedService;
  const quote = quoteBooking({
    serviceType: effectiveService,
    engagementModel,
    term: engagementModel === "flex" ? "single" : term,
    purposeCode,
    startDate,
    shift,
    rosterPattern,
    riskInput,
  });
  const calendarSummary = Object.entries(quote.calendarBreakdown)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => `${count} ${category.replaceAll("_", " ")}`)
    .join(" · ");
  const purposeLabel =
    purposePriceBook.find((item) => item.code === purposeCode)?.label ??
    "Commercial access";
  const demoBookings =
    pilot.state?.bookings.filter((booking) =>
      booking.id.startsWith("BK-DEMO-"),
    ) ?? [];
  const reviewableServiceRecords =
    pilot.state?.shifts
      .filter((item) =>
        ["completed", "verified"].includes(item.status),
      )
      .sort((left, right) =>
        right.scheduledDate.localeCompare(left.scheduledDate),
      ) ?? [];
  const serviceRecord =
    reviewableServiceRecords.find(
      (item) => item.id === selectedServiceRecordId,
    ) ??
    reviewableServiceRecords.find(
      (item) => item.clientSignoffStatus === "pending",
    ) ??
    reviewableServiceRecords[0] ??
    null;
  const recordConfirmed = serviceRecord?.clientSignoffStatus === "approved";
  const activeShift =
    pilot.state?.shifts.find(
      (item) => item.status === "on_post" && item.checkInAt,
    ) ?? null;
  const nextCoverage =
    [...(pilot.state?.shifts ?? [])]
      .filter((item) => item.status === "confirmed")
      .sort((left, right) =>
        left.scheduledDate.localeCompare(right.scheduledDate),
      )[0] ?? null;
  const focusShift = activeShift ?? nextCoverage ?? serviceRecord;
  const passportPath = focusShift
    ? `${pilot.state?.officer.passport.verificationPath ?? ""}&booking=${encodeURIComponent(focusShift.bookingId)}&shift=${encodeURIComponent(focusShift.id)}`
    : (pilot.state?.officer.passport.verificationPath ?? "");
  const todayLabel = new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const primaryBooking =
    pilot.state?.bookings.find(
      (booking) => booking.id === focusShift?.bookingId,
    ) ?? pilot.state?.bookings.find((booking) => booking.id === "BK-2081");

  function updateRisk<K extends keyof RiskInput>(key: K, value: RiskInput[K]) {
    setRiskInput((current) => ({ ...current, [key]: value }));
  }

  async function confirmServiceRecord() {
    if (!serviceRecord) return;
    const result = await pilot.runAction({
      action: "client_signoff",
      shiftId: serviceRecord.id,
    });
    if (result)
      flash(
        "Service record confirmed. LOKD operations will apply the normal release controls.",
      );
  }

  async function createBooking() {
    const result = await pilot.runAction({
      action: "create_booking",
      commandId: bookingCommandId,
      siteName,
      siteArea,
      addressLabel,
      serviceType: effectiveService,
      engagementModel,
      term: engagementModel === "flex" ? "single" : term,
      rosterPattern,
      purposeCode,
      riskInput,
      startDate,
      shift,
      postName,
      instructions,
    });
    if (!result) return;
    setBookingCommandId(newBookingCommandId());
    setRequestOpen(false);
    flash(
      "Request saved. Operations must approve the site, risk plan and post orders before the payment step.",
    );
  }

  function openSupport(
    category: string,
    summary: string,
    target: { bookingId?: string; shiftId?: string } = {},
  ) {
    setSupportCategory(category);
    setSupportSummary(summary);
    setSupportDetail("");
    setSupportTarget(target);
  }

  async function submitSupport() {
    if (!supportCategory) return;
    const result = await pilot.runAction({
      action: "create_client_service_request",
      category: supportCategory,
      summary: supportSummary,
      detail: supportDetail,
      shiftId: supportTarget.shiftId,
      bookingId: supportTarget.bookingId,
    });
    if (!result) return;
    setSupportCategory(null);
    setSupportTarget({});
    flash("Service request recorded in the Operations queue.");
  }

  async function recordArrivalCheck(shiftId: string) {
    const result = await pilot.runAction({
      action: "record_demo_arrival_check",
      shiftId,
    });
    if (result)
      flash(
        "Synthetic arrival check recorded. The officer can now rehearse check-in.",
      );
  }

  if (pilot.loading || !pilot.state) {
    return (
      <main className="portal-shell client-shell">
        <header className="portal-header client-header">
          <Link href="/" className="portal-logo">
            <img src="/lokd-logo.png" alt="LOKD" />
          </Link>
        </header>
        <section className="portal-page client-page">
          <div className="officer-loading">
            <span className="pulse-dot" />
            <strong>
              {pilot.error || "Loading the client service record…"}
            </strong>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="portal-shell client-shell">
      <header className="portal-header client-header">
        <Link href="/" className="portal-logo">
          <img src="/lokd-logo.png" alt="LOKD" />
        </Link>
        <div className="portal-role-switch">
          <Link href="/ops">Ops</Link>
          <Link href="/officer">Officer</Link>
          <Link className="active" href="/client">
            Client
          </Link>
        </div>
        <div className="client-account">
          <span>
            <strong>{pilot.state.client.organisationName}</strong>
            <small>Client administrator</small>
          </span>
          <button
            aria-label="Open client account"
            onClick={() => setAccountOpen(true)}
          >
            NP
          </button>
        </div>
      </header>

      <section className="portal-page client-page">
        <div className="client-welcome">
          <div>
            <p className="eyebrow">{todayLabel} · SIMULATED</p>
            <h1>Manage your security service.</h1>
            <p>
              Every booking, site plan, roster and service record below is
              synthetic and cannot authorise paid deployment.
            </p>
          </div>
          <button
            className="primary-button primary-button--light"
            onClick={() => setRequestOpen(true)}
          >
            Test a request
          </button>
        </div>
        <section className="client-status-card">
          <div className="client-status-main">
            <span
              className={activeShift ? "coverage-active" : "coverage-pending"}
            >
              <i />{" "}
              {activeShift
                ? "Synthetic officer checked in"
                : nextCoverage
                  ? "Next synthetic shift confirmed"
                  : "No active synthetic coverage"}
            </span>
            <h2>{focusShift?.siteName ?? "No site selected"}</h2>
            <p>
              {focusShift?.postName ?? "Create a request to begin"}
              {focusShift && (
                <>
                  {" "}
                  ·{" "}
                  <span
                    className={`service-badge service-${focusShift.serviceType.toLowerCase()}`}
                  >
                    {focusShift.serviceType}
                  </span>{" "}
                  · {focusShift.purposeLabel}
                </>
              )}
            </p>
            {focusShift && (
              <div className="coverage-timeline">
                <span className="timeline-start">
                  {activeShift?.checkInAt
                    ? new Date(activeShift.checkInAt).toLocaleTimeString(
                        "en-ZA",
                        { hour: "2-digit", minute: "2-digit" },
                      )
                    : focusShift.shiftStart}
                  <br />
                  <small>
                    {activeShift ? "Synthetic check-in" : "Scheduled start"}
                  </small>
                </span>
                <i>
                  <b />
                </i>
                <span className="timeline-end">
                  {focusShift.shiftEnd}
                  <br />
                  <small>Scheduled end</small>
                </span>
              </div>
            )}
          </div>
          <div className="client-booking-price">
            <span>
              {primaryBooking
                ? `${primaryBooking.id} · ${primaryBooking.engagementModel === "flex" ? "LOKD Flex" : "LOKD Fixed"}`
                : "No active booking"}
            </span>
            <strong>{money(primaryBooking?.clientPriceCents ?? 0)}</strong>
            <small>Synthetic full-service estimate</small>
            <dl>
              <div>
                <dt>Funding gate</dt>
                <dd>
                  <span
                    className={
                      primaryBooking?.fundingStatus === "paid_in_full"
                        ? "paid-status"
                        : "pill tone-amber"
                    }
                  >
                    {primaryBooking?.fundingStatus === "paid_in_full"
                      ? "✓ Simulated"
                      : (primaryBooking?.fundingStatus?.replaceAll("_", " ") ??
                        "Not started")}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Service</dt>
                <dd>{primaryBooking?.serviceType ?? "—"}</dd>
              </div>
              <div>
                <dt>Risk plan</dt>
                <dd>
                  {primaryBooking
                    ? `${primaryBooking.riskBand} · demo assessed`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Service record</dt>
                <dd>
                  {serviceRecord
                    ? recordConfirmed
                      ? "Confirmed"
                      : "Awaiting review"
                    : "No completed shift"}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="client-passport-card">
          <div className="client-passport-person">
            <span>{pilot.state.officer.initials}</span>
            <div>
              <small>SIMULATED ASSIGNMENT</small>
              <h2>{pilot.state.officer.fullName}</h2>
              <p>
                {pilot.state.officer.passport.passportNumber} ·{" "}
                {pilot.state.officer.psiraGrade}
              </p>
            </div>
          </div>
          <div className="client-passport-status">
            <i>◌</i>
            <span>
              <strong>
                Synthetic Passport · {pilot.state.officer.passport.readinessLabel}
              </strong>
              <small>
                {primaryBooking?.serviceType ?? "No service"} ·{" "}
                {primaryBooking?.purposeLabel ?? "No assignment purpose"} ·{" "}
                {pilot.state.officer.passport.status.replaceAll("_", " ")}
              </small>
            </span>
          </div>
          <img
            src="/lokd-shift-passport-qr.svg"
            alt="Example assigned-officer Passport QR"
          />
          <a href={passportPath} target="_blank" rel="noreferrer">
            Open Passport preview
          </a>
        </section>

        <section className="contract-rule-strip">
          <span>✓</span>
          <div>
            <strong>Simulated funding gate passed before matching</strong>
            <p>
              This demonstrates the intended control only. No card was charged,
              invoice issued or bank receipt confirmed.
            </p>
          </div>
        </section>

        <section className="client-request-pipeline">
          <div className="card-title">
            <div>
              <span>Connected booking pipeline</span>
              <strong>Your new coverage requests</strong>
            </div>
            <a href="/ops">Open Operations →</a>
          </div>
          {demoBookings.length ? (
            demoBookings.map((booking) => (
              <article key={booking.id}>
                <span>
                  <strong>
                    {booking.id} ·{" "}
                    {booking.engagementModel === "flex"
                      ? "LOKD Flex"
                      : "LOKD Fixed"}
                  </strong>
                  <small>
                    {booking.serviceType} · {booking.purposeLabel} ·{" "}
                    {booking.riskBand} risk · {booking.shiftCount} shift
                    {booking.shiftCount === 1 ? "" : "s"} · starts{" "}
                    {booking.startDate}
                  </small>
                </span>
                <span>
                  <strong>{money(booking.clientPriceCents)}</strong>
                  <small>Full-term premium price</small>
                </span>
                <span>
                  <em
                    className={`pill ${booking.fundingStatus === "paid_in_full" ? "tone-green" : "tone-amber"}`}
                  >
                    {booking.status === "site_review" ||
                    booking.status === "risk_review"
                      ? "Site plan review"
                      : booking.fundingStatus === "paid_in_full"
                        ? "Payment confirmed"
                        : "Awaiting payment"}
                  </em>
                  <small>
                    {booking.status === "offered"
                      ? "Contract offer released"
                      : booking.status === "staffed"
                        ? "All positions assigned"
                        : booking.status === "partially_staffed"
                          ? "Some positions still uncovered"
                          : booking.status === "matching"
                            ? "Matching controls"
                            : booking.status === "site_review" ||
                                booking.status === "risk_review"
                              ? "Operations must approve site, risk and post orders"
                              : "No offers released"}
                  </small>
                </span>
              </article>
            ))
          ) : (
            <div className="client-pipeline-empty">
              <span>＋</span>
              <div>
                <strong>Create the first live demo request</strong>
                <p>
                  The request will persist here, then move to Operations for
                  simulated payment confirmation and controlled matching.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="client-grid-main">
          <article className="client-signoff-card">
            <div className="card-title">
              <div>
                <span>Shift completion</span>
                <strong>Confirm service record</strong>
              </div>
              <em>
                {serviceRecord
                  ? recordConfirmed
                    ? "Confirmed"
                    : "Ready for review"
                  : "Nothing pending"}
              </em>
            </div>
            {reviewableServiceRecords.length > 0 && (
              <label className="service-record-picker">
                <span>Completed shift</span>
                <select
                  value={serviceRecord?.id ?? ""}
                  onChange={(event) =>
                    setSelectedServiceRecordId(event.target.value)
                  }
                >
                  {reviewableServiceRecords.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} · {item.siteName} · {item.scheduledDate} ·{" "}
                      {item.clientSignoffStatus.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="signoff-body">
              <div className="signoff-icon">{recordConfirmed ? "✓" : "→"}</div>
              <div>
                <h3>
                  {recordConfirmed
                    ? "Service record confirmed"
                    : serviceRecord
                      ? "Review completed service"
                      : "No completed service is waiting"}
                </h3>
                <p>
                  {recordConfirmed
                    ? "Your confirmation is recorded in the service trail. Normal weekly release controls still apply."
                    : serviceRecord
                      ? "Confirm that this contracted shift was completed. Report a service issue if any part of this record requires review."
                      : "A completed connected shift will appear here automatically for review."}
                </p>
              </div>
            </div>
            <div className="signoff-evidence">
              <div>
                <span>Attendance</span>
                <strong>
                  {serviceRecord?.passportVerificationStatus === "green"
                    ? "Synthetic arrival check recorded"
                    : "Arrival evidence pending"}
                </strong>
              </div>
              <div>
                <span>Readiness</span>
                <strong>
                  {primaryBooking
                    ? `${primaryBooking.serviceType} · ${primaryBooking.purposeLabel}`
                    : "No assignment selected"}
                </strong>
              </div>
              <div>
                <span>Incidents</span>
                <strong>Review Operations case log</strong>
              </div>
            </div>
            {!recordConfirmed ? (
              <>
                <div className="service-record-note">
                  Your confirmation is evidence for the service record; it is
                  not a manual pay switch. A missing response cannot hold
                  undisputed officer earnings indefinitely.
                </div>
                <div className="signoff-actions">
                  <button
                    onClick={() =>
                      openSupport(
                        "service_issue",
                        "Review this completed service record",
                        serviceRecord
                          ? {
                              bookingId: serviceRecord.bookingId,
                              shiftId: serviceRecord.id,
                            }
                          : {},
                      )
                    }
                  >
                    Report an issue
                  </button>
                  <button
                    disabled={pilot.busy || !serviceRecord}
                    onClick={() => void confirmServiceRecord()}
                  >
                    {pilot.busy ? "Confirming…" : "Confirm completed service"}
                  </button>
                </div>
              </>
            ) : (
              <a
                className="download-record"
                href={`/api/service-record?shift=${encodeURIComponent(serviceRecord?.id ?? "")}`}
              >
                Download service record →
              </a>
            )}
            {pilot.error && (
              <p className="pilot-error" role="alert">
                {pilot.error}
              </p>
            )}
          </article>

          <aside className="client-side-stack">
            <article className="small-portal-card">
              <div className="small-card-title">
                <span>Next coverage</span>
                <em>{nextCoverage ? "Confirmed" : "None"}</em>
              </div>
              <h3>
                {nextCoverage
                  ? new Intl.DateTimeFormat("en-ZA", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }).format(
                      new Date(`${nextCoverage.scheduledDate}T00:00:00`),
                    )
                  : "No confirmed shift"}
              </h3>
              <p>
                {nextCoverage
                  ? `${nextCoverage.shiftStart}–${nextCoverage.shiftEnd} · ${nextCoverage.postName}`
                  : "Complete the booking workflow to create a roster."}
              </p>
              {nextCoverage && (
                <div className="verified-row">
                  <span>
                    {nextCoverage.passportVerificationStatus === "green"
                      ? "✓"
                      : "→"}
                  </span>
                  <div>
                    <strong>
                      {nextCoverage.passportVerificationStatus === "green"
                        ? "Synthetic arrival check complete"
                        : "Assignment ready for arrival rehearsal"}
                    </strong>
                    <small>
                      This demo check is not identity or geolocation evidence.
                    </small>
                  </div>
                </div>
              )}
              {nextCoverage &&
                nextCoverage.passportVerificationStatus !== "green" && (
                  <button
                    disabled={pilot.busy}
                    onClick={() => void recordArrivalCheck(nextCoverage.id)}
                  >
                    Run demo arrival check
                  </button>
                )}
              {nextCoverage && (
                <button
                  onClick={() =>
                    openSupport(
                      "change_request",
                      "Request a change to upcoming coverage",
                      {
                        bookingId: nextCoverage.bookingId,
                        shiftId: nextCoverage.id,
                      },
                    )
                  }
                >
                  Request a change
                </button>
              )}
            </article>
            <article className="small-portal-card client-support">
              <span>Operations support</span>
              <strong>Need help?</strong>
              <p>
                Your authorised contact can create a general Operations request
                without attaching an unrelated shift.
              </p>
              <button
                onClick={() =>
                  openSupport(
                    "operations_support",
                    "Help needed with my LOKD service",
                  )
                }
              >
                Contact operations →
              </button>
            </article>
          </aside>
        </section>

        <section className="client-history-card">
          <div className="card-title">
            <div>
              <span>Service history</span>
              <strong>Recent contract shifts</strong>
            </div>
            <button onClick={() => setHistoryExpanded((value) => !value)}>
              {historyExpanded ? "Show recent" : "View all"} →
            </button>
          </div>
          {pilot.state.shifts
            .slice(0, historyExpanded ? pilot.state.shifts.length : 2)
            .map((item) => (
              <a
                className="client-history-row"
                key={item.id}
                href={`/api/service-record?shift=${encodeURIComponent(item.id)}`}
              >
                <span>
                  <strong>{item.id}</strong>
                  <small>
                    {item.siteName} · {item.serviceType}
                  </small>
                </span>
                <span>
                  <strong>
                    {new Intl.DateTimeFormat("en-ZA", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(`${item.scheduledDate}T00:00:00Z`))}
                  </strong>
                  <small>
                    {item.shiftStart}–{item.shiftEnd}
                  </small>
                </span>
                <span>
                  <strong>Service evidence</strong>
                  <small>
                    {item.passportVerificationStatus === "green"
                      ? "Arrival check recorded"
                      : "Arrival check pending"}
                  </small>
                </span>
                <em>{item.clientSignoffStatus.replaceAll("_", " ")}</em>
                <b>↓</b>
              </a>
            ))}
        </section>
      </section>

      {requestOpen && (
        <div
          className="drawer-backdrop"
          onMouseDown={() => setRequestOpen(false)}
        >
          <aside
            className="detail-drawer request-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-request-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-topline">
              <span className="detail-id">NEW REQUEST</span>
              <button
                aria-label="Close security request"
                onClick={() => setRequestOpen(false)}
              >
                ×
              </button>
            </div>
            <p className="eyebrow">Risk-matched coverage</p>
            <h2 id="client-request-title">Request security</h2>
            <p className="drawer-subtitle">
              Tell LOKD what you need. Our assisted assessment recommends the
              minimum suitable cover before the request reaches Operations.
            </p>
            <div className="request-fields">
              <label>
                Site name
                <input
                  value={siteName}
                  maxLength={100}
                  onChange={(event) => setSiteName(event.target.value)}
                />
              </label>
              <div>
                <label>
                  Area
                  <input
                    value={siteArea}
                    maxLength={80}
                    onChange={(event) => setSiteArea(event.target.value)}
                  />
                </label>
                <label>
                  Site address
                  <input
                    value={addressLabel}
                    maxLength={180}
                    onChange={(event) => setAddressLabel(event.target.value)}
                  />
                </label>
              </div>
              <fieldset className="engagement-picker">
                <legend>Choose the coverage model</legend>
                {(Object.keys(engagementModels) as EngagementModel[]).map(
                  (model) => (
                    <button
                      type="button"
                      key={model}
                      className={engagementModel === model ? "selected" : ""}
                      onClick={() => setEngagementModel(model)}
                    >
                      <strong>{engagementModels[model].label}</strong>
                      <small>{engagementModels[model].note}</small>
                      <i>{engagementModel === model ? "✓" : ""}</i>
                    </button>
                  ),
                )}
              </fieldset>
              <div>
                <label>
                  Site purpose
                  <select
                    value={purposeCode}
                    onChange={(event) => setPurposeCode(event.target.value)}
                  >
                    {purposePriceBook.map((item) => (
                      <option value={item.code} key={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start date
                  <input
                    type="date"
                    value={startDate}
                    min={minimumStartDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </label>
              </div>
              <div>
                <label>
                  Shift
                  <select
                    value={shift}
                    onChange={(event) => {
                      const nextShift = event.target.value as "day" | "night";
                      setShift(nextShift);
                      updateRisk("nightOperation", nextShift === "night");
                    }}
                  >
                    <option value="day">06:00–18:00</option>
                    <option value="night">18:00–06:00</option>
                  </select>
                </label>
                {engagementModel === "fixed" ? (
                  <label>
                    Coverage days
                    <select
                      value={rosterPattern}
                      onChange={(event) =>
                        setRosterPattern(event.target.value as RosterPattern)
                      }
                    >
                      {(Object.keys(rosterPatterns) as RosterPattern[]).map(
                        (pattern) => (
                          <option value={pattern} key={pattern}>
                            {rosterPatterns[pattern].label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ) : (
                  <label>
                    Dispatch window
                    <input
                      value={noticePriceBook[quote.noticeWindow].label}
                      disabled
                    />
                  </label>
                )}
              </div>
              {engagementModel === "fixed" && (
                <label>
                  Contract term
                  <select
                    value={term}
                    onChange={(event) =>
                      setTerm(event.target.value as ContractTerm)
                    }
                  >
                    <option value="1">1 month</option>
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                  </select>
                </label>
              )}

              <fieldset className="risk-assessment">
                <legend>LOKD assisted risk assessment</legend>
                <p>
                  Rules-based Phase 1 recommendation · reviewed by Operations
                  for High or Critical requests.
                </p>
                <div className="risk-input-grid">
                  <label>
                    Cash / asset exposure
                    <select
                      value={riskInput.assetExposure}
                      onChange={(event) =>
                        updateRisk(
                          "assetExposure",
                          event.target.value as RiskInput["assetExposure"],
                        )
                      }
                    >
                      <option value="standard">Standard property</option>
                      <option value="valuable">
                        Valuable cash / stock / equipment
                      </option>
                      <option value="high_value">High-value target</option>
                    </select>
                  </label>
                  <label>
                    Public access
                    <select
                      value={riskInput.publicAccess}
                      onChange={(event) =>
                        updateRisk(
                          "publicAccess",
                          event.target.value as RiskInput["publicAccess"],
                        )
                      }
                    >
                      <option value="controlled">Controlled access</option>
                      <option value="moderate">Regular visitors</option>
                      <option value="open">Open / heavy footfall</option>
                    </select>
                  </label>
                  <label>
                    Incident history
                    <select
                      value={riskInput.incidentHistory}
                      onChange={(event) =>
                        updateRisk(
                          "incidentHistory",
                          event.target.value as RiskInput["incidentHistory"],
                        )
                      }
                    >
                      <option value="none">No recent incidents</option>
                      <option value="isolated">
                        One recent incident / threat
                      </option>
                      <option value="repeated">
                        Repeated incidents / active threat
                      </option>
                    </select>
                  </label>
                  <label>
                    Existing controls
                    <select
                      value={riskInput.existingControls}
                      onChange={(event) =>
                        updateRisk(
                          "existingControls",
                          event.target.value as RiskInput["existingControls"],
                        )
                      }
                    >
                      <option value="strong">
                        CCTV, alarms and controlled access
                      </option>
                      <option value="partial">Some controls</option>
                      <option value="limited">Limited controls</option>
                    </select>
                  </label>
                </div>
                <label className="risk-check">
                  <input
                    type="checkbox"
                    checked={riskInput.vulnerablePeople}
                    onChange={(event) =>
                      updateRisk("vulnerablePeople", event.target.checked)
                    }
                  />
                  Vulnerable people or a safeguarding duty are present
                </label>
              </fieldset>

              <article
                className={`risk-result risk-${risk.band.toLowerCase()}`}
              >
                <div>
                  <span>
                    LOKD RECOMMENDATION · {risk.band.toUpperCase()} {risk.score}
                  </span>
                  <h3>
                    {risk.recommendedService} · {risk.minimumGrade} or higher ·{" "}
                    {risk.headcount} officer{risk.headcount === 1 ? "" : "s"}
                  </h3>
                  <p>{risk.reasons[0]}</p>
                </div>
                <ul>
                  {risk.requiredEndorsements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {risk.manualReview && (
                  <strong>
                    Operations review required before payment and matching.
                  </strong>
                )}
              </article>

              <fieldset className="service-picker">
                <legend>
                  Security service · the assessed minimum cannot be reduced
                </legend>
                {serviceOptions.map((item) => {
                  const allowed = serviceMeetsRecommendation(
                    item.name,
                    risk.recommendedService,
                  );
                  return (
                    <button
                      type="button"
                      key={item.name}
                      disabled={!allowed}
                      className={`${effectiveService === item.name ? "selected" : ""} ${allowed ? "" : "blocked"}`}
                      onClick={() => setService(item.name)}
                    >
                      <span
                        className={`service-badge service-${item.name.toLowerCase()}`}
                      >
                        {item.name}
                      </span>
                      <small>
                        {allowed
                          ? item.note
                          : `Below the ${risk.recommendedService} minimum`}
                      </small>
                      <i>
                        {effectiveService === item.name
                          ? "✓"
                          : allowed
                            ? ""
                            : "×"}
                      </i>
                    </button>
                  );
                })}
              </fieldset>
              <label>
                Post
                <select
                  value={postName}
                  onChange={(event) => setPostName(event.target.value)}
                >
                  <option>Main access</option>
                  <option>Patrol and access</option>
                  <option>Executive movement</option>
                </select>
              </label>
              <label>
                Instructions
                <textarea
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                />
              </label>
            </div>
            <div className="price-summary">
              <span>
                {engagementModel === "fixed"
                  ? "Full-term LOKD estimate"
                  : "LOKD Flex shift estimate"}
              </span>
              <strong>{money(quote.clientPriceCents)}</strong>
              <p>
                {engagementModel === "fixed"
                  ? `${termLabels[term]} · ${quote.rosterLabel}`
                  : quote.noticeLabel}{" "}
                · {effectiveService} · {purposeLabel} · {quote.shiftCount} shift
                {quote.shiftCount === 1 ? "" : "s"}
              </p>
              <dl className="price-breakdown">
                <div>
                  <dt>Base protection</dt>
                  <dd>{money(quote.baseClientCents)}</dd>
                </div>
                <div>
                  <dt>Calendar premium</dt>
                  <dd>{money(quote.calendarPremiumCents)}</dd>
                </div>
                <div>
                  <dt>Short-notice dispatch</dt>
                  <dd>{money(quote.dispatchPremiumCents)}</dd>
                </div>
                <div>
                  <dt>Risk / specialist adjustment</dt>
                  <dd>{money(quote.riskPremiumCents)}</dd>
                </div>
              </dl>
              <small>
                {calendarSummary || quote.firstCalendarLabel} · Pilot estimate;
                VAT treatment is not yet applied.
              </small>
            </div>
            <div className="payment-gate">
              <span>i</span>
              <p>
                <strong>
                  {quote.manualReview
                    ? "Risk plan first, payment second."
                    : engagementModel === "fixed"
                      ? "Full-term payment required."
                      : "Shift payment required."}
                </strong>{" "}
                No officer offer is released until the plan is approved where
                required and LOKD records payment as received.
              </p>
            </div>
            <div className="drawer-actions">
              <button
                className="secondary-button"
                onClick={() => setRequestOpen(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button primary-button--light"
                disabled={pilot.busy}
                onClick={() => void createBooking()}
              >
                {pilot.busy
                  ? "Saving…"
                  : quote.manualReview
                    ? "Send for risk review"
                    : "Save request & continue"}
              </button>
            </div>
            {pilot.error && (
              <p className="pilot-error" role="alert">
                {pilot.error}
              </p>
            )}
          </aside>
        </div>
      )}
      {supportCategory && (
        <div
          className="drawer-backdrop"
          onMouseDown={() => setSupportCategory(null)}
        >
          <aside
            className="detail-drawer compact-workflow-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-support-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-topline">
              <span className="detail-id">SERVICE REQUEST</span>
              <button
                aria-label="Close service request"
                onClick={() => setSupportCategory(null)}
              >
                ×
              </button>
            </div>
            <p className="eyebrow">Connected Operations queue</p>
            <h2 id="client-support-title">{supportSummary}</h2>
            <p className="drawer-subtitle">
              This request will persist with only the relevant client, booking
              and shift context for Operations ownership.
            </p>
            <label>
              Summary
              <input
                value={supportSummary}
                maxLength={120}
                onChange={(event) => setSupportSummary(event.target.value)}
              />
            </label>
            <label>
              What should Operations know?
              <textarea
                value={supportDetail}
                maxLength={1200}
                onChange={(event) => setSupportDetail(event.target.value)}
                placeholder="Add the facts, requested change or service concern."
              />
            </label>
            <div className="drawer-actions">
              <button
                className="secondary-button"
                onClick={() => setSupportCategory(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button primary-button--light"
                disabled={pilot.busy || supportDetail.trim().length < 3}
                onClick={() => void submitSupport()}
              >
                {pilot.busy ? "Sending…" : "Send to Operations"}
              </button>
            </div>
            {pilot.error && (
              <p className="pilot-error" role="alert">
                {pilot.error}
              </p>
            )}
          </aside>
        </div>
      )}
      {accountOpen && (
        <div
          className="drawer-backdrop"
          onMouseDown={() => setAccountOpen(false)}
        >
          <aside
            className="detail-drawer compact-workflow-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-account-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-topline">
              <span className="detail-id">CLIENT ACCOUNT</span>
              <button
                aria-label="Close client account"
                onClick={() => setAccountOpen(false)}
              >
                ×
              </button>
            </div>
            <p className="eyebrow">Authorised pilot profile</p>
            <h2 id="client-account-title">
              {pilot.state.client.organisationName}
            </h2>
            <p className="drawer-subtitle">
              {pilot.state.client.contactName} ·{" "}
              {pilot.state.client.approvalStatus}
            </p>
            <dl className="account-facts">
              <div>
                <dt>Client ID</dt>
                <dd>{pilot.state.client.id}</dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>Synthetic Gauteng pilot</dd>
              </div>
              <div>
                <dt>Bookings</dt>
                <dd>{pilot.state.bookings.length}</dd>
              </div>
              <div>
                <dt>Service records</dt>
                <dd>{pilot.state.shifts.length}</dd>
              </div>
            </dl>
            <a
              className="primary-button primary-button--light"
              href="/api/service-record"
            >
              Download all service records
            </a>
          </aside>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <span>✓</span>
          {notice}
        </div>
      )}
    </main>
  );
}
