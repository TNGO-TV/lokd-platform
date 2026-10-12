"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { projectGautengCoordinate } from "../lib/operations-core";
import type {
  CoverageState,
  IncidentSeverity,
  OperationsIncident,
  OperationsAssignmentActivation,
  OperationsReserveOfficer,
  OperationsRosterSlot,
  OperationsSite,
  OperationalState,
} from "../lib/operations-types";
import { useOperations } from "../lib/use-operations";
import { usePilot } from "../lib/use-pilot";
import WorkspaceView from "./workspace-view";
import { PlatformReadiness } from "./platform-readiness";
import ClientEnquiriesView from "./client-enquiries-view";
import { OnboardingControl } from "./onboarding-control";
import { SpecialistOperationsControl } from "./specialist-operations-control";
import {
  indicativeSingleShiftPrice,
  specialistProfiles,
  type SpecialistServiceCode,
} from "../lib/specialist-pricing";
import {
  CLIENT_PORTAL_URL,
  OFFICER_PORTAL_URL,
  OPERATIONS_PORTAL_URL,
  PUBLIC_SITE_URL,
} from "../lib/public-site";

const navItems = ["Control", "Coverage", "Assignment activation", "Incidents", "Bookings", "Specialist operations", "Specialist pricing", "Offers", "Applications", "Workforce", "Officer conversions", "Officers", "Clients", "Client enquiries", "Onboarding", "Service requests", "Timesheets", "Payroll", "Billing", "Operator controls", "Integrations", "Feedback", "Launch readiness"];

function Icon({ name }: { name: "search" | "bell" | "refresh" | "incident" | "close" | "chevron" | "map" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 9a7 7 0 0 1 11.8-2L20 12M4 12l2.1 5a7 7 0 0 0 11.8-2" /></>,
    incident: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5M12 17.5v.1" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
  };
  return <svg className="ops-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function formatSast(value: string, includeDate = false) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    ...(includeDate ? { day: "2-digit", month: "short" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatGenerated(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatZar(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(cents / 100);
}

function stateTone(state: OperationalState) {
  return state === "critical" ? "red" : state === "attention" ? "amber" : state === "scheduled" ? "blue" : state === "operational" ? "green" : "neutral";
}

function coverageTone(state: CoverageState) {
  if (state === "check_in_missing" || state === "uncovered") return "red";
  if (state === "arrival_at_risk" || state === "relief_active") return "amber";
  if (state === "confirmed") return "blue";
  if (state === "on_post") return "green";
  return "neutral";
}

function startWindowLabel(slot: OperationsRosterSlot) {
  if (slot.coverageState === "on_post") return `On post · ends ${formatSast(slot.endsAt)}`;
  if (slot.minutesToStart > 60) return `Starts in ${Math.floor(slot.minutesToStart / 60)}h ${slot.minutesToStart % 60}m`;
  if (slot.minutesToStart > 0) return `Starts in ${slot.minutesToStart}m`;
  return `Started ${Math.abs(slot.minutesToStart)}m ago`;
}

function MiniMark() {
  return <div className="mini-mark" aria-hidden="true"><span /><span /><span /></div>;
}

export default function OperationsApp({ stage, actorEmail, owner = false }: { owner?: boolean; stage: "demo" | "prelaunch" | "pilot" | "production"; actorEmail: string }) {
  const pilot = usePilot("operations");
  const operations = useOperations();
  const [activeNav, setActiveNav] = useState("Control");
  const [notice, setNotice] = useState<string | null>(null);
  const [createIncidentOpen, setCreateIncidentOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isCommand = activeNav === "Control" || activeNav === "Incidents";
  const isCoverage = activeNav === "Coverage";
  const isActivation = activeNav === "Assignment activation";
  const isWorkforce = activeNav === "Workforce";
  const isOfficerConversion = activeNav === "Officer conversions";
  const isClientEnquiries = activeNav === "Client enquiries";
  const isSpecialistPricing = activeNav === "Specialist pricing";
  const isSpecialistOperations = activeNav === "Specialist operations";
  const isOnboarding = activeNav === "Onboarding";
  const isLaunchReadiness = activeNav === "Launch readiness";
  const isPlatform = activeNav === "Integrations" || activeNav === "Service requests"
    || activeNav === "Timesheets" || activeNav === "Payroll" || activeNav === "Billing"
    || activeNav === "Operator controls";
  const isOperationalSurface = isCommand || isCoverage || isActivation || isWorkforce || isOfficerConversion || isClientEnquiries || isSpecialistPricing || isSpecialistOperations || isOnboarding || isLaunchReadiness || isPlatform;
  const pendingPayments = pilot.state?.bookings.filter((booking) => booking.fundingStatus !== "paid_in_full").length ?? 0;
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const sites = (operations.state?.sites ?? []).filter((item) => `${item.id} ${item.name} ${item.clientName} ${item.area}`.toLowerCase().includes(query)).map((item) => ({ type: "Site", id: item.id, label: item.name, detail: `${item.clientName} · ${item.stateLabel}`, destination: "Control" }));
    const officers = (operations.state?.workforce.officers ?? []).filter((item) => `${item.officerId} ${item.officerName} ${item.employerName ?? ""}`.toLowerCase().includes(query)).map((item) => ({ type: "Officer", id: item.officerId, label: item.officerName, detail: `${item.workforceModel ?? "network"} · ${item.employmentStatus}`, destination: "Officers" }));
    const bookings = (pilot.state?.bookings ?? []).filter((item) => `${item.id} ${item.siteName} ${item.postName}`.toLowerCase().includes(query)).map((item) => ({ type: "Booking", id: item.id, label: item.siteName, detail: `${item.serviceType} · ${item.status}`, destination: "Bookings" }));
    return [...sites, ...officers, ...bookings].slice(0, 12);
  }, [operations.state, pilot.state, searchQuery]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3400);
  }

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector<HTMLButtonElement>(".mobile-ops-controls nav button.active")
      ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
  }, [activeNav]);

  return (
    <main className="app-shell ops-premium-shell">
      <aside className="side-rail">
        <a className="brand-lockup" href={PUBLIC_SITE_URL} aria-label="LOKD home"><Image width={1096} height={333} unoptimized loading="eager" style={{height:"auto"}} src="/lokd-logo-reverse.png" alt="LOKD" /></a>
        <div className="pilot-chip"><span className="pulse-dot" /><span><strong>Johannesburg pilot</strong>Operations command · Synthetic</span></div>
        <div className="experience-switcher" aria-label="Preview experience">
          <a className="experience-active" href={OPERATIONS_PORTAL_URL}>Ops</a><a href={OFFICER_PORTAL_URL}>Officer</a><a href={CLIENT_PORTAL_URL}>Client</a>
        </div>
        <nav aria-label="LOKD operations">
          <p className="nav-label">Workspace</p>
          <a className="nav-item" href="/ops/intake">Live application review</a>
          <a className="nav-item" href="/ops/security">Account security</a>
          <a className="nav-item" href="/ops/psira">PSiRA verification</a>
          {navItems.map((item) => <button className={activeNav === item ? "nav-item nav-item--active" : "nav-item"} key={item} onClick={() => setActiveNav(item)}>
            <span>{item}</span>
            {item === "Coverage" && (operations.state?.summary.arrivalWatch ?? 0) > 0 && <em className="nav-warning">{operations.state?.summary.arrivalWatch}</em>}
            {item === "Incidents" && (operations.state?.summary.openIncidents ?? 0) > 0 && <em className="nav-warning">{operations.state?.summary.openIncidents}</em>}
            {item === "Bookings" && pendingPayments > 0 && <em className="nav-warning">{pendingPayments}</em>}
            {item === "Applications" && <em>New</em>}
            {item === "Client enquiries" && <em>Web</em>}
            {item === "Specialist pricing" && <em>V33</em>}
            {item === "Onboarding" && <em>V32</em>}
            {item === "Feedback" && <em>Team</em>}
          </button>)}
        </nav>
        <div className="rail-footer"><div className="avatar avatar--dark">Z</div><span><strong>Operations</strong>{actorEmail}</span><button aria-label="Account and access status" aria-expanded={accountOpen} onClick={() => setAccountOpen((value) => !value)}>•••</button></div>
        {accountOpen && <aside className="ops-account-popover"><header><strong>Operations access</strong><button aria-label="Close account details" onClick={() => setAccountOpen(false)}>×</button></header><dl><div><dt>Signed in as</dt><dd>{actorEmail}</dd></div><div><dt>Current role</dt><dd>{owner ? "Operations owner" : "Operations"}</dd></div><div><dt>Environment</dt><dd>{stage} · synthetic</dd></div></dl><p>Version 32 preserves role limits, recent MFA, maker/checker controls, controlled onboarding evidence and shadow-payroll settlement locks. Production identity and step-up MFA are still activation gates.</p><nav aria-label="Switch pilot workspace"><a href={CLIENT_PORTAL_URL}>Client workspace</a><a href={OFFICER_PORTAL_URL}>Officer workspace</a><a href="/sign-out">Sign out</a></nav></aside>}
      </aside>

      <section className="main-stage">
        <header className="top-bar ops-command-topbar">
          <a className="mobile-brand" href={PUBLIC_SITE_URL} aria-label="LOKD home"><Image width={1096} height={333} unoptimized loading="eager" style={{height:"auto"}} src="/lokd-logo.png" alt="LOKD" /></a>
          <div className="breadcrumb"><span>Operations</span><b>/</b><strong>{activeNav}</strong></div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Search" aria-expanded={searchOpen} onClick={() => { setSearchOpen((value) => !value); setNotificationsOpen(false); }}><Icon name="search" /></button>
            <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((value) => !value); setSearchOpen(false); }}><span className="notification-dot" /><Icon name="bell" /></button>
            {isOperationalSurface ? <button className="primary-button ops-incident-button" onClick={() => setCreateIncidentOpen(true)}><Icon name="incident" /> Create incident</button>
              : <a className="primary-button" href={CLIENT_PORTAL_URL}><span>＋</span> Create booking</a>}
          </div>
        </header>
        {searchOpen && <aside className="ops-top-popover ops-search-popover"><label><Icon name="search" /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search sites, officers or bookings" /></label><div>{searchQuery.trim() ? searchResults.length ? searchResults.map((item) => <button key={`${item.type}-${item.id}`} onClick={() => { setActiveNav(item.destination); setSearchOpen(false); }}><span>{item.type}</span><strong>{item.label}</strong><small>{item.id} · {item.detail}</small></button>) : <p>No matching connected records.</p> : <p>Search the current server-backed Operations picture.</p>}</div></aside>}
        {notificationsOpen && <aside className="ops-top-popover ops-notification-popover"><header><strong>Operations notifications</strong><button onClick={() => setNotificationsOpen(false)}>×</button></header><div><button onClick={() => { setActiveNav("Coverage"); setNotificationsOpen(false); }}><span className="tone-amber">Coverage</span><strong>{operations.state?.summary.arrivalWatch ?? 0} arrival or coverage item(s)</strong><small>Open the live synthetic roster queue</small></button><button onClick={() => { setActiveNav("Incidents"); setNotificationsOpen(false); }}><span className="tone-red">Incidents</span><strong>{operations.state?.summary.openIncidents ?? 0} open incident(s)</strong><small>Review ownership and SLA state</small></button><button onClick={() => { setActiveNav("Bookings"); setNotificationsOpen(false); }}><span className="tone-blue">Funding</span><strong>{pendingPayments} booking(s) before matching</strong><small>Risk or payment evidence still required</small></button></div></aside>}

        <div className="mobile-ops-controls">
          <div className="mobile-experience-switcher" aria-label="Preview experience"><a className="active" href={OPERATIONS_PORTAL_URL}>Ops</a><a href={OFFICER_PORTAL_URL}>Officer</a><a href={CLIENT_PORTAL_URL}>Client</a></div>
          <nav aria-label="LOKD operations mobile navigation">{navItems.map((item) => <button className={activeNav === item ? "active" : ""} key={item} onClick={() => setActiveNav(item)}>{item}</button>)}</nav>
        </div>

        <div className={isOperationalSurface ? "page-content ops-command-content" : "page-content"}>
          <div className="preview-banner ops-simulation-banner"><strong>Simulated {stage} command data</strong>Fixed sites, signals and cases are synthetic. Browser GPS is disabled; no officer is being tracked and no paid deployment is active.</div>
          {isCommand ? <CommandCentre
            operations={operations}
            incidentFocus={activeNav === "Incidents"}
            openIncident={() => setCreateIncidentOpen(true)}
            flash={flash}
          /> : isCoverage ? <CoverageCentre operations={operations} flash={flash} />
            : isActivation ? <AssignmentActivationControl operations={operations} flash={flash} />
            : isWorkforce ? <WorkforceControl operations={operations} />
              : isOfficerConversion ? <OfficerConversionControl operations={operations} flash={flash} />
                : isClientEnquiries ? <ClientEnquiriesView flash={flash} />
                  : isSpecialistPricing ? <SpecialistPricingControl state={pilot.state} />
                  : isSpecialistOperations ? <SpecialistOperationsControl />
                  : isOnboarding ? <OnboardingControl flash={flash} />
              : isLaunchReadiness ? <LaunchReadinessControl operations={operations} />
                : isPlatform ? <PlatformReadiness view={activeNav as "Integrations" | "Service requests" | "Timesheets" | "Payroll" | "Billing" | "Operator controls"} flash={flash} />
                : <WorkspaceView name={activeNav} />}
        </div>
      </section>

      {createIncidentOpen && operations.state && <CreateIncidentDialog sites={operations.state.sites} busy={operations.busy} onClose={() => setCreateIncidentOpen(false)} onCreate={async (values) => {
        const result = await operations.runAction({ action: "create_incident", ...values });
        if (result) { setCreateIncidentOpen(false); flash("Incident case created and added to the Operations queue."); }
      }} />}
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}

function SpecialistPricingControl({ state }: { state: ReturnType<typeof usePilot>["state"] }) {
  const serviceCodes = Object.keys(specialistProfiles).filter(
    (code) => code !== "standard_unarmed",
  ) as SpecialistServiceCode[];
  const actual = state?.bookings.filter((booking) =>
    booking.serviceType === "Armed" || booking.serviceType === "VIP",
  ) ?? [];
  return <>
    <section className="command-heading specialist-pricing-heading">
      <div><p className="eyebrow">Versioned commercial control</p><h1>Armed &amp; VIP pricing</h1><p>Cost floor first, then the minimum margin. No VAT is charged. The accepted total and readiness checks must be confirmed before service can start.</p></div>
      <span className="specialist-policy-chip">LOKD-SPECIALIST-2026.09-v2-no-vat</span>
    </section>
    <section className="specialist-pricing-summary">
      <article><span>VAT</span><strong>Not charged</strong><small>No VAT added to new quotes</small></article>
      <article><span>Armed margin floor</span><strong>30–32%</strong><small>Service revenue</small></article>
      <article><span>VIP margin floor</span><strong>35–38%</strong><small>Service revenue</small></article>
      <article><span>Credit days</span><strong>0</strong><small>Commercial readiness only</small></article>
    </section>
    <section className="specialist-model-grid">
      {serviceCodes.map((code) => {
        const profile = specialistProfiles[code];
        const price = indicativeSingleShiftPrice(code);
        return <article key={code} className={`specialist-model-card service-${profile.serviceType.toLowerCase()}`}>
          <header><span>{profile.serviceType}</span><em>{profile.minimumTeamSize} operator{profile.minimumTeamSize === 1 ? "" : "s"}</em></header>
          <h2>{profile.label}</h2><p>{profile.description}</p>
          <dl><div><dt>Indicative subtotal</dt><dd>{formatZar(price.subtotalCents)}</dd></div><div><dt>VAT</dt><dd>{formatZar(price.vatCents)}</dd></div><div><dt>Client total</dt><dd>{formatZar(price.totalCents)}</dd></div><div><dt>Cost floor</dt><dd>{formatZar(price.costFloorCents)}</dd></div><div><dt>Margin</dt><dd>{(price.marginBasisPoints / 100).toFixed(1)}%</dd></div></dl>
          <small>Ordinary single shift · minimum planning · no supplier vehicle · Operations review required before payment</small>
        </article>;
      })}
    </section>
    <section className="specialist-margin-register">
      <header><div><p className="eyebrow">Quote register</p><h2>Specialist margin decisions</h2></div><span>{actual.length} specialist booking{actual.length === 1 ? "" : "s"}</span></header>
      {actual.length ? actual.map((booking) => <article key={booking.id}>
        <span><strong>{booking.id} · {booking.specialistServiceCode.replaceAll("_", " ")}</strong><small>{booking.siteName} · {booking.headcount} position{booking.headcount === 1 ? "" : "s"} · {booking.shiftCount} shifts</small></span>
        <span><strong>{formatZar(booking.subtotalCents)}</strong><small>Subtotal · {formatZar(booking.vatCents)} VAT</small></span>
        <span><strong>{formatZar(booking.pricingInternal?.costFloorCents ?? 0)}</strong><small>Controlled cost floor</small></span>
        <span><strong>{((booking.pricingInternal?.marginBasisPoints ?? 0) / 100).toFixed(1)}%</strong><small>Minimum {((booking.pricingInternal?.minimumMarginBasisPoints ?? 0) / 100).toFixed(1)}%</small></span>
        <em className={`pill ${booking.pricingStatus === "authoritative" ? "tone-green" : "tone-amber"}`}>{booking.pricingStatus.replaceAll("_", " ")}</em>
      </article>) : <div className="clean-state"><span>i</span><div><strong>No specialist quote has been submitted</strong><p>The reference models above are active. A client configuration will appear here with its exact cost-floor decision.</p></div></div>}
    </section>
    <section className="specialist-pricing-boundary"><strong>Fail-closed pricing boundary</strong><p>Supplier estimates, armoured vehicles, overnight work or missing readiness evidence force Operations review. A discount can never reduce the quote below its stored cost floor or margin requirement, and no offer can release against less than the full accepted amount.</p></section>
  </>;
}

function CommandCentre({ operations, incidentFocus, openIncident, flash }: {
  operations: ReturnType<typeof useOperations>;
  incidentFocus: boolean;
  openIncident: () => void;
  flash: (message: string) => void;
}) {
  const state = operations.state;
  const [filter, setFilter] = useState<"all" | OperationalState>(incidentFocus ? "attention" : "all");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const selectedSite = state?.sites.find((site) => site.id === selectedSiteId) ?? state?.sites[0] ?? null;
  const selectedIncident = state?.incidents.find((incident) => incident.id === selectedIncidentId) ?? null;
  const visibleSites = useMemo(() => !state ? [] : state.sites.filter((site) => filter === "all" || site.state === filter), [state, filter]);

  function openSite(site: OperationsSite, incident?: OperationsIncident) {
    setSelectedSiteId(site.id);
    setSelectedIncidentId(incident?.id ?? null);
    setResolutionNote("");
    setDrawerOpen(true);
  }

  if (operations.loading && !state) return <div className="command-loading"><span className="pulse-dot" /><strong>Building the operational picture…</strong><small>Sites · deployment state · signals · exceptions</small></div>;
  if (!state) return <div className="command-error" role="alert"><strong>Operations unavailable</strong><p>{operations.error || "The command snapshot could not be loaded."}</p><button onClick={() => void operations.refresh()}>Try again</button></div>;

  const priorityIncidents = state.incidents.filter((incident) => !["resolved", "closed"].includes(incident.status));
  const priorityExceptions = state.exceptions.filter((exception) => !["resolved", "closed"].includes(exception.status));
  const priorityCoverage = state.roster.filter((slot) => ["arrival_at_risk", "check_in_missing", "uncovered", "relief_active"].includes(slot.coverageState));
  const summaryCards = [
    { label: "Active sites", value: state.summary.sites, detail: "Gauteng pilot picture", tone: "neutral" },
    { label: "On post", value: state.summary.operational, detail: "Fresh simulated evidence", tone: "green" },
    { label: "Scheduled", value: state.summary.scheduled, detail: "Arrival monitoring", tone: "blue" },
    { label: "Attention", value: state.summary.attention, detail: `${state.summary.openExceptions} open exception`, tone: "amber" },
    { label: "Open incidents", value: state.summary.openIncidents, detail: "Triage and ownership", tone: state.summary.openIncidents ? "red" : "green" },
  ];

  return <>
    <section className="command-heading">
      <div><p className="eyebrow">Gauteng operating area · SAST</p><h1>Operational picture</h1><p>{formatGenerated(state.generatedAt)} · refreshes every 30 seconds while visible</p></div>
      <div className="command-heading-actions"><button className="secondary-button" disabled={operations.busy} onClick={() => void operations.refresh()}><Icon name="refresh" /> Refresh</button><button className="primary-button primary-button--light" onClick={openIncident}><Icon name="incident" /> Create incident</button></div>
    </section>

    <section className="command-kpis" aria-label="Operations summary">{summaryCards.map((card) => <article key={card.label} className={`command-kpi command-kpi--${card.tone}`}><span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small></article>)}</section>

    <section className="command-primary-grid">
      <article className="command-map-panel">
        <header><div><span className="command-section-kicker"><i /> Simulated site layer</span><h2>Site coverage map</h2></div><div className="map-filters" aria-label="Filter sites">
          {(["all", "operational", "scheduled", "attention"] as const).map((value) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "operational" ? "On post" : value === "scheduled" ? "Scheduled" : "Attention"}</button>)}
        </div></header>
        <div className="command-map-canvas" aria-label="Coordinate-projected view of synthetic Gauteng pilot sites">
          <div className="command-map-grid" />
          <svg className="command-map-roads" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
            <path d="M40 472C190 420 260 270 410 214S720 232 970 84" /><path d="M172 20c100 104 116 195 156 292s152 162 320 276" /><path d="M12 170c166 18 306 36 416 126s260 116 564 82" /><path className="minor" d="M96 562c156-118 234-164 394-184s300-126 410-294" />
          </svg>
          <span className="map-place map-place--sandton">Sandton</span><span className="map-place map-place--midrand">Midrand</span><span className="map-place map-place--east">Johannesburg East</span>
          {visibleSites.map((site) => {
            const position = projectGautengCoordinate(site.latitude, site.longitude);
            return <button
              className={`command-site-pin command-site-pin--${site.state} ${selectedSite?.id === site.id ? "selected" : ""}`}
              key={site.id}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              onClick={() => openSite(site)}
              aria-label={`${site.name}: ${site.stateLabel}`}
            ><span className="command-pin-core"><MiniMark /></span><span className="command-pin-label"><strong>{site.area}</strong><small>{site.stateLabel}</small></span></button>;
          })}
          <div className="command-map-legend"><span><i className="green" /> On post</span><span><i className="blue" /> Scheduled</span><span><i className="amber" /> Attention</span><span><i className="red" /> Critical</span></div>
          <div className="command-map-mode"><Icon name="map" /><span><strong>Synthetic telemetry</strong>No browser location access</span></div>
          {selectedSite && <button className="map-site-dock" onClick={() => openSite(selectedSite)}><span className={`site-state-symbol tone-${stateTone(selectedSite.state)}`} /><span><strong>{selectedSite.name}</strong><small>{selectedSite.deployment.postName ?? "No active post"} · {selectedSite.latestSignal ? `${selectedSite.latestSignal.ageMinutes}m signal age` : "No signal"}</small></span><Icon name="chevron" /></button>}
        </div>
      </article>

      <aside className="priority-panel">
        <header><div><p className="eyebrow eyebrow--amber">Owned action</p><h2>Priority queue</h2></div><span>{priorityCoverage.length + priorityIncidents.length + priorityExceptions.length}</span></header>
        <div className="priority-list">
          {priorityCoverage.map((slot) => {
            const site = state.sites.find((item) => item.id === slot.siteId);
            if (!site) return null;
            return <article className={`priority-item priority-item--coverage priority-item--${slot.coverageState === "check_in_missing" || slot.coverageState === "uncovered" ? "high" : "medium"}`} key={`coverage-${slot.id}`}>
              <button className="priority-main" onClick={() => openSite(site)}><span className="priority-code">COVERAGE · {slot.id}</span><strong>{slot.coverageLabel}</strong><small>{slot.area} · {slot.postName} · {formatSast(slot.startsAt)}</small></button>
              <span className="priority-owner">{slot.relief ? "Case owned" : "Open Coverage to act"}</span>
            </article>;
          })}
          {priorityIncidents.map((incident) => {
            const site = state.sites.find((item) => item.id === incident.siteId);
            if (!site) return null;
            return <article className={`priority-item priority-item--${incident.severity}`} key={incident.id}>
              <button className="priority-main" onClick={() => openSite(site, incident)}><span className="priority-code">{incident.id}</span><strong>{incident.summary}</strong><small>{site.area} · {incident.severity} · {incident.status}</small></button>
              {incident.status === "open" ? <button className="priority-action" disabled={operations.busy} onClick={async () => { const result = await operations.runAction({ action: "acknowledge_incident", incidentId: incident.id, version: incident.version }); if (result) flash("Incident acknowledged. Ownership is recorded; the case remains open."); }}>Acknowledge</button> : <span className="priority-owner">Owned</span>}
            </article>;
          })}
          {priorityExceptions.map((exception) => {
            const site = state.sites.find((item) => item.id === exception.siteId);
            if (!site) return null;
            return <article className="priority-item priority-item--exception" key={exception.id}>
              <button className="priority-main" onClick={() => openSite(site)}><span className="priority-code">{exception.priority} · {exception.id}</span><strong>{exception.summary}</strong><small>{site.area} · {exception.status} · SLA {formatSast(exception.slaDueAt)}</small></button>
              {exception.status === "new" ? <button className="priority-action" disabled={operations.busy} onClick={async () => { const result = await operations.runAction({ action: "acknowledge_exception", exceptionId: exception.id, version: exception.version }); if (result) flash("Exception acknowledged and assigned to Operations."); }}>Take ownership</button> : <span className="priority-owner">Owned</span>}
            </article>;
          })}
          {!priorityCoverage.length && !priorityIncidents.length && !priorityExceptions.length && <div className="priority-clear"><span>✓</span><strong>No open operational exceptions</strong><p>All synthetic sites are inside their current control thresholds.</p></div>}
        </div>
        <footer><span><i /> SLA clock uses SAST</span><button onClick={() => operations.refresh()}>Refresh queue</button></footer>
      </aside>
    </section>

    <section className="command-secondary-grid">
      <article className="site-matrix panel">
        <header className="command-panel-heading"><div><p className="eyebrow">Authoritative snapshot</p><h2>Deployment board</h2></div><span>{state.sites.length} sites</span></header>
        <div className="site-matrix-head"><span>Site and state</span><span>Current deployment</span><span>Evidence</span><span>Next control</span><span /></div>
        {state.sites.map((site) => <button className="site-matrix-row" key={site.id} onClick={() => openSite(site)}>
          <span><i className={`site-state-symbol tone-${stateTone(site.state)}`} /><span><strong>{site.name}</strong><small>{site.id} · {site.riskBand} risk · {site.serviceType}</small></span></span>
          <span><strong>{site.deployment.officerName ?? "No officer assigned"}</strong><small>{site.deployment.postName ?? "No active post"} · {site.deployment.shiftStart ?? "—"}–{site.deployment.shiftEnd ?? "—"}</small></span>
          <span><strong>{site.latestSignal ? `${site.latestSignal.ageMinutes} min ago` : "Unavailable"}</strong><small>{site.latestSignal ? `${site.latestSignal.source} · ${site.latestSignal.accuracyMeters ?? "—"}m stated accuracy` : "No attendance signal"}</small></span>
          <span><strong>{site.nextAction}</strong><small>{site.openIncidentCount} incident · {site.openExceptionCount} exception</small></span>
          <Icon name="chevron" />
        </button>)}
      </article>

      <aside className="event-stream panel">
        <header className="command-panel-heading"><div><p className="eyebrow">Control evidence</p><h2>Recent timeline</h2></div><span>UTC stored · SAST shown</span></header>
        <div>{state.events.slice(0, 7).map((event) => <button key={event.id} onClick={() => { const site = state.sites.find((item) => item.id === event.siteId); if (site) openSite(site); }}><i className={`event-tone event-tone--${event.tone}`} /><span><strong>{event.title}</strong><small>{event.siteName} · {event.detail}</small></span><time>{formatSast(event.occurredAt)}</time></button>)}</div>
      </aside>
    </section>

    <footer className="status-footer ops-command-footer"><span><i /> Command service healthy</span><span>Simulated data only · GPS ingestion locked · exact coordinates Operations-only</span></footer>
    {operations.error && <div className="inline-notice" role="alert">{operations.error}</div>}

    {drawerOpen && selectedSite && <SiteDrawer site={selectedSite} incident={selectedIncident} events={state.events.filter((event) => event.siteId === selectedSite.id)} busy={operations.busy} resolutionNote={resolutionNote} setResolutionNote={setResolutionNote} onClose={() => setDrawerOpen(false)} onAcknowledge={async (incident) => {
      const result = await operations.runAction({ action: "acknowledge_incident", incidentId: incident.id, version: incident.version });
      if (result) flash("Incident acknowledged. It remains open until a resolution is recorded.");
    }} onResolve={async (incident) => {
      const result = await operations.runAction({ action: "resolve_incident", incidentId: incident.id, version: incident.version, resolutionNote });
      if (result) { setResolutionNote(""); flash("Incident resolved with an auditable resolution note."); }
    }} />}
  </>;
}

function CoverageCentre({ operations, flash }: {
  operations: ReturnType<typeof useOperations>;
  flash: (message: string) => void;
}) {
  const state = operations.state;
  const [reliefSlotId, setReliefSlotId] = useState<string | null>(null);
  if (operations.loading && !state) return <div className="command-loading"><span className="pulse-dot" /><strong>Building the coverage picture…</strong><small>Required posts · assignments · arrival controls · relief cases</small></div>;
  if (!state) return <div className="command-error" role="alert"><strong>Coverage unavailable</strong><p>{operations.error || "The roster snapshot could not be loaded."}</p><button onClick={() => void operations.refresh()}>Try again</button></div>;

  const watchSlots = state.roster.filter((slot) => ["arrival_at_risk", "check_in_missing", "uncovered", "relief_active"].includes(slot.coverageState));
  const activeReliefSlots = state.roster.filter((slot) => slot.relief && !["cancelled", "closed"].includes(slot.relief.status));
  const selectedReliefSlot = state.roster.find((slot) => slot.id === reliefSlotId) ?? null;
  const availableForSelected = selectedReliefSlot
    ? state.reserveOfficers.filter((officer) => officer.eligibleSlotIds.includes(selectedReliefSlot.id))
    : [];
  const coverageCards = [
    { label: "Posts · next 24h", value: state.summary.rosterSlots, detail: "Required coverage slots", tone: "neutral" },
    { label: "Assigned", value: state.summary.coveredSlots, detail: `${state.summary.coveragePercent}% roster coverage`, tone: "green" },
    { label: "Arrival watch", value: state.summary.arrivalWatch, detail: "Evidence or coverage control", tone: state.summary.arrivalWatch ? "amber" : "green" },
    { label: "Relief cases", value: state.summary.reliefActive, detail: "No messages sent in demo", tone: state.summary.reliefActive ? "amber" : "neutral" },
  ];

  function openRelief(slot: OperationsRosterSlot) {
    setReliefSlotId(slot.id);
  }

  return <>
    <section className="command-heading coverage-heading">
      <div><p className="eyebrow">Shift assurance · SAST</p><h1>Coverage control</h1><p>Next 24 hours · roster state refreshes every 30 seconds while visible</p></div>
      <div className="command-heading-actions"><button className="secondary-button" disabled={operations.busy} onClick={() => void operations.refresh()}><Icon name="refresh" /> Refresh</button>{watchSlots.some((slot) => !slot.relief) && <button className="primary-button primary-button--light" onClick={() => openRelief(watchSlots.find((slot) => !slot.relief)!)}>Open relief case</button>}</div>
    </section>

    <section className="command-kpis coverage-kpis" aria-label="Coverage summary">{coverageCards.map((card) => <article key={card.label} className={`command-kpi command-kpi--${card.tone}`}><span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small></article>)}</section>

    <section className="coverage-primary-grid">
      <article className="coverage-runway">
        <header><div><span className="command-section-kicker"><i /> Authoritative roster</span><h2>Coverage runway</h2></div><div className="coverage-meter"><span><strong>{state.summary.coveragePercent}%</strong> assigned</span><i><b style={{ width: `${state.summary.coveragePercent}%` }} /></i></div></header>
        <div className="coverage-runway-head"><span>Window</span><span>Site and post</span><span>Primary assignment</span><span>Control state</span></div>
        <div className="coverage-runway-list">{state.roster.map((slot) => <article className={`coverage-runway-row coverage-runway-row--${coverageTone(slot.coverageState)}`} key={slot.id}>
          <time><strong>{formatSast(slot.startsAt)}</strong><small>{formatSast(slot.endsAt)}</small></time>
          <span><strong>{slot.siteName}</strong><small>{slot.area} · {slot.postName}</small></span>
          <span><strong>{slot.officerName ?? "Unassigned"}</strong><small>{slot.officerName ? `${slot.officerGrade ?? "Grade pending"} · Passport ${slot.passportStatus ?? "not connected"}` : "Required post has no primary assignment"}</small></span>
          <span className="coverage-control-state"><em><i className={`site-state-symbol tone-${coverageTone(slot.coverageState)}`} />{slot.coverageLabel}</em><small>{startWindowLabel(slot)}</small>{["arrival_at_risk", "check_in_missing", "uncovered"].includes(slot.coverageState) && !slot.relief && <button disabled={operations.busy} onClick={() => openRelief(slot)}>Open case</button>}</span>
        </article>)}</div>
        <footer><span><i /> Absolute UTC records · SAST display</span><span>Arrival risk uses roster deadlines and check-in evidence—not officer movement</span></footer>
      </article>

      <aside className="arrival-watch-panel">
        <header><div><p className="eyebrow eyebrow--amber">Evidence control</p><h2>Arrival watch</h2></div><span>{watchSlots.length}</span></header>
        <div>{watchSlots.map((slot) => <article className={`arrival-watch-item arrival-watch-item--${coverageTone(slot.coverageState)}`} key={slot.id}>
          <div><span className="priority-code">{slot.id} · {formatSast(slot.startsAt)}</span><strong>{slot.siteName}</strong><small>{slot.postName} · {slot.coverageLabel}</small></div>
          <p>{slot.coverageState === "check_in_missing" ? "Start passed without check-in evidence. Operations review is required; the system has not declared a no-show." : slot.coverageState === "uncovered" ? "This required post has no active assignment." : slot.coverageState === "relief_active" ? "A controlled relief case is open; no notification has been sent." : `Arrival assurance became due at ${formatSast(slot.arrivalDueAt)}.`}</p>
          {slot.relief ? <span className="arrival-owned">Owned · {slot.relief.replacementOfficerName}</span> : <button disabled={operations.busy} onClick={() => openRelief(slot)}>Open relief case</button>}
        </article>)}{!watchSlots.length && <div className="priority-clear"><span>✓</span><strong>All arrivals assured</strong><p>No roster slot is inside an active control threshold.</p></div>}</div>
      </aside>
    </section>

    <section className="coverage-secondary-grid">
      <article className="relief-board panel">
        <header className="command-panel-heading"><div><p className="eyebrow">Auditable response</p><h2>Relief control</h2></div><span>{activeReliefSlots.length} active</span></header>
        {activeReliefSlots.length ? <div className="relief-case-list">{activeReliefSlots.map((slot) => <article key={slot.relief!.id}>
          <span className="relief-case-mark"><MiniMark /></span><div><span className="priority-code">{slot.relief!.id}</span><strong>{slot.siteName} · {slot.postName}</strong><small>{slot.relief!.reasonCode.replaceAll("_", " ")} · owned by {slot.relief!.requestedBy}</small></div>
          <div><span>Reserved candidate</span><strong>{slot.relief!.replacementOfficerName}</strong><small>Response control due {formatSast(slot.relief!.responseDueAt)}</small></div>
          <em>{slot.relief!.status.replaceAll("_", " ")}</em>
          <button disabled={operations.busy} onClick={async () => { const result = await operations.runAction({ action: "cancel_relief", reliefDispatchId: slot.relief!.id, version: slot.relief!.version }); if (result) flash("Relief case cancelled. No officer notification was sent."); }}>Cancel case</button>
        </article>)}</div> : <div className="relief-empty"><span>✓</span><div><strong>No active relief cases</strong><p>Opening a case reserves a verified candidate and records ownership. External offer release remains locked until messaging is connected.</p></div></div>}
        <footer className="relief-control-boundary"><strong>Offer release locked</strong><span>This demo records the case and candidate only. It does not send WhatsApp, SMS, push or email notifications.</span></footer>
      </article>

      <aside className="standby-pool panel">
        <header className="command-panel-heading"><div><p className="eyebrow">Slot-specific controls</p><h2>Verified standby pool</h2></div><span>{state.reserveOfficers.length}</span></header>
        <div>{state.reserveOfficers.map((officer) => <StandbyOfficer key={officer.id} officer={officer} />)}{!state.reserveOfficers.length && <div className="relief-empty"><span>!</span><div><strong>No eligible standby officers</strong><p>No officer passes the full current roster gate.</p></div></div>}</div>
        <footer>No distance estimates · declared availability windows only</footer>
      </aside>
    </section>

    <footer className="status-footer ops-command-footer"><span><i /> Coverage ledger healthy</span><span>Demo policy · 8-hour overlap/rest buffer · live policy approval required</span></footer>
    {operations.error && <div className="inline-notice" role="alert">{operations.error}</div>}

    {selectedReliefSlot && <ReliefCaseDialog slot={selectedReliefSlot} candidates={availableForSelected} busy={operations.busy} onClose={() => setReliefSlotId(null)} onCreate={async (candidateId, reasonCode) => {
      const result = await operations.runAction({ action: "open_relief_case", rosterSlotId: selectedReliefSlot.id, version: selectedReliefSlot.version, replacementOfficerId: candidateId, reasonCode });
      if (result) { setReliefSlotId(null); flash("Relief case opened and owned. Candidate reserved; no notification was sent."); }
    }} />}
  </>;
}

function AssignmentActivationControl({ operations, flash }: {
  operations: ReturnType<typeof useOperations>;
  flash: (message: string) => void;
}) {
  const state = operations.state;
  const [filter, setFilter] = useState<"all" | OperationsAssignmentActivation["state"]>("all");
  const [scope, setScope] = useState<"all" | OperationsAssignmentActivation["environment"]>("all");
  if (operations.loading && !state) return <div className="command-loading"><span className="pulse-dot" /><strong>Evaluating assignment activation…</strong><small>Funding · site evidence · Passport · employer route · hours</small></div>;
  if (!state) return <div className="command-error" role="alert"><strong>Activation queue unavailable</strong><p>{operations.error || "The activation register could not be loaded."}</p><button onClick={() => void operations.refresh()}>Try again</button></div>;
  const activation = state.activation;
  const visible = activation.queue.filter((item) => (filter === "all" || item.state === filter)
    && (scope === "all" || item.environment === scope));
  const productionCount = activation.queue.filter((item) => item.environment === "production").length;
  const rehearsalCount = activation.queue.filter((item) => item.environment === "demo_synthetic").length;
  const cards = [
    { state: "ready" as const, label: "Ready", value: activation.ready, note: "Evaluation passed; activation not yet committed", tone: "blue" },
    { state: "blocked" as const, label: "Blocked", value: activation.blocked, note: "Precise fail-closed reasons recorded", tone: "red" },
    { state: "reserved" as const, label: "Reserved", value: activation.reserved, note: "Inactive transaction stage only", tone: "amber" },
    { state: "activated" as const, label: "Activated", value: activation.activated, note: "Final protected records shown read-only", tone: "green" },
  ];
  return <>
    {operations.error && <div className="command-error activation-inline-error" role="alert"><strong>Latest action did not complete</strong><p>{operations.error}</p></div>}
    <section className="command-heading activation-heading"><div><p className="eyebrow">Atomic assignment control</p><h1>Assignment activation</h1><p>One server decision freezes responsibility, evidence, wages and hours—or creates no live assignment at all.</p></div><button className="secondary-button" disabled={operations.busy} onClick={() => void operations.refresh()}><Icon name="refresh" /> Refresh</button></section>
    <section className="activation-boundary"><span>{state.launch.activationLocked ? "PRODUCTION LOCKED" : "PRODUCTION READ-ONLY"}</span><div><strong>This public Site can inspect activation records; it cannot authorise paid deployment.</strong><p>{state.launch.activationLocked ? "PSiRA documentary verification, the control-room inspection, active business registration and every remaining hard gate must pass first." : "All production commands remain read-only in the public demo. A separately controlled Operations release path is required for paid deployment."} Synthetic funding and employer records never satisfy production activation.</p></div></section>
    <section className="command-kpis activation-kpis" aria-label="Assignment activation states">{cards.map((card) => <button type="button" aria-pressed={filter === card.state} key={card.state} className={`command-kpi command-kpi--${card.tone} ${filter === card.state ? "is-selected" : ""}`} onClick={() => setFilter(filter === card.state ? "all" : card.state)}><span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></button>)}</section>
    <section className="activation-toolbar"><div><strong>Read-only activation register</strong><span>{visible.length} of {activation.queue.length} shown · {productionCount} production · {rehearsalCount} synthetic</span></div><div className="activation-toolbar-groups"><div role="group" aria-label="Activation environment filter">{(["all", "production", "demo_synthetic"] as const).map((item) => <button type="button" aria-pressed={scope === item} key={item} className={scope === item ? "active" : ""} onClick={() => setScope(item)}>{item === "demo_synthetic" ? "synthetic" : item}</button>)}</div><div role="group" aria-label="Activation state filter">{(["all", "ready", "blocked", "reserved", "activated"] as const).map((item) => <button type="button" aria-pressed={filter === item} key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item.replaceAll("_", " ")}</button>)}</div></div></section>
    <section className="activation-queue">{visible.map((item) => <article className={`activation-card activation-card--${item.state}`} key={item.commandId ?? `${item.rosterSlotId}:${item.officerId}`}>
      <header><div><span className="priority-code">{item.environment === "production" ? "PRODUCTION COMMAND" : "SYNTHETIC REHEARSAL"} · {item.commandId ?? "UNRECORDED"}</span><h2>{item.siteName} · {item.postName}</h2><p>{item.clientName} · {formatSast(item.startsAt, true)} → {formatSast(item.endsAt, true)}</p></div><em>{item.state}</em></header>
      <div className="activation-facts">
        <dl><div><dt>Officer</dt><dd>{item.officerName}</dd></div><div><dt>Employer route</dt><dd>{item.workforceModel?.replaceAll("_", " ") ?? "Verified Network only"}</dd></div><div><dt>Employer</dt><dd>{item.employerName ?? "No employer of record"}</dd></div><div><dt>Terms</dt><dd>{item.termsVersion ?? "Not accepted"}</dd></div></dl>
        <dl><div><dt>{item.databaseProtected ? "Frozen funded wage" : "Proposed officer offer"}</dt><dd>{formatZar(item.fundedWageCents)}</dd></div><div><dt>{item.databaseProtected ? "Frozen statutory cost" : "Estimated statutory cost"}</dt><dd>{formatZar(item.statutoryCostCents)}</dd></div><div><dt>Pricing version</dt><dd>{item.pricingVersion}</dd></div><div><dt>Funding status</dt><dd>{item.fundingStatus.replaceAll("_", " ")}</dd></div><div><dt>Funding reference</dt><dd>{item.fundingReference ?? "No verified reference"}</dd></div></dl>
        <dl><div><dt>Hours</dt><dd>{item.reservedMinutes ? `${item.reservedMinutes / 60}h reserved` : `${item.hourSegments.reduce((sum, segment) => sum + segment.minutes, 0) / 60}h planned`}</dd></div><div><dt>ISO-week split</dt><dd>{item.hourSegments.length ? item.hourSegments.map((segment) => `${segment.isoWeekStart} · ${segment.minutes / 60}h`).join(" / ") : "No Direct Flex reservation"}</dd></div><div><dt>Evidence valid through</dt><dd>{item.evidenceValidThrough ? formatSast(item.evidenceValidThrough, true) : "Not frozen — see blockers"}</dd></div><div><dt>Last evaluated</dt><dd>{formatSast(item.lastDecisionAt, true)}</dd></div><div><dt>Revalidation</dt><dd>{item.revalidation.nextCheckpoint ? `${item.revalidation.nextCheckpoint.replaceAll("_", " ")} · ${formatSast(item.revalidation.nextDueAt!, true)}` : item.revalidation.status.replaceAll("_", " ")}</dd></div></dl>
      </div>
      {item.blockers.length ? <div className="activation-blockers"><strong>{item.blockers.length} blocker{item.blockers.length === 1 ? "" : "s"}</strong><ul>{item.blockers.map((blocker) => <li key={blocker.code}><span>{blocker.code}</span><p>{blocker.detail}</p></li>)}</ul></div> : <div className="activation-ready-note"><span>✓</span><div><strong>Evaluation passed</strong><p>Passing evaluation does not create an assignment. The atomic command must still win all database concurrency guards.</p></div></div>}
      <footer><div><strong>{item.environment === "production" ? (item.databaseProtected ? "Atomic production activation recorded" : "Production candidate · read-only · not authorised for paid deployment") : "Synthetic rehearsal only · not production authorised"}</strong><span>{item.databaseProtected ? "Final snapshot protected by database triggers" : "Evaluation record only; no immutable final snapshot or paid assignment"}</span></div>{item.environment === "demo_synthetic" && ["ready", "blocked"].includes(item.state) && <button className="primary-button" disabled={operations.busy} onClick={async () => {
        const result = await operations.runAction({ action: "evaluate_assignment_activation", rosterSlotId: item.rosterSlotId, officerId: item.officerId, expectedSlotVersion: item.slotVersion });
        if (result) flash("Fail-closed activation decision evaluated idempotently. No paid assignment was created.");
      }}>{item.commandId ? "Re-evaluate" : "Record evaluation"}</button>}</footer>
    </article>)}{!visible.length && <div className="activation-empty"><span>✓</span><strong>No {filter === "all" ? "activation" : filter} records</strong><p>The queue has no records in this state.</p></div>}</section>
    <footer className="status-footer ops-command-footer"><span><i /> Append-only decisions and blocker records</span><span>Database-enforced slot, snapshot and Direct Flex hour controls · production remains locked</span></footer>
  </>;
}

function WorkforceControl({ operations }: { operations: ReturnType<typeof useOperations> }) {
  const state = operations.state;
  if (operations.loading && !state) return <div className="command-loading"><span className="pulse-dot" /><strong>Resolving workforce responsibility…</strong><small>Network members · employment routes · employer snapshots</small></div>;
  if (!state) return <div className="command-error" role="alert"><strong>Workforce control unavailable</strong><p>{operations.error || "The workforce snapshot could not be loaded."}</p><button onClick={() => void operations.refresh()}>Try again</button></div>;
  const summary = state.workforce;
  const cards = [
    { label: "Verified Network", value: summary.verifiedNetwork, note: "Approved profiles; not automatically employed", tone: "neutral" },
    { label: "No employment", value: summary.profilesWithoutEmployment, note: "No LOKD payroll or leave record activated", tone: "blue" },
    { label: "Direct Flex", value: summary.activeDirectFlex, note: "LOKD payroll · controlled weekly cap", tone: "green" },
    { label: "Partner supplied", value: summary.activePartner, note: "Recorded partner employer; verification required", tone: "green" },
    { label: "Managed", value: summary.activeManaged, note: "Recurring LOKD employment route", tone: "green" },
  ];
  return <>
    <section className="command-heading workforce-heading"><div><p className="eyebrow">Employer-of-record control</p><h1>Workforce engine</h1><p>Network membership and employment are deliberately separate records.</p></div><button className="secondary-button" disabled={operations.busy} onClick={() => void operations.refresh()}><Icon name="refresh" /> Refresh</button></section>
    <section className="workforce-rule-banner"><span>10,000</span><div><strong>Verified members do not equal 10,000 employees.</strong><p>A member has no LOKD payroll, leave or benefit record until a compliant Direct Flex or Managed employment route is activated. Partner-supplied work records the verified partner employer.</p></div></section>
    <section className="command-kpis workforce-kpis" aria-label="Workforce model summary">{cards.map((card) => <article key={card.label} className={`command-kpi command-kpi--${card.tone}`}><span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></article>)}</section>
    <section className="workforce-layout">
      <article className="workforce-register panel"><header className="command-panel-heading"><div><p className="eyebrow">Current synthetic cohort</p><h2>Officer engagement register</h2></div><span>{summary.officers.length} profiles</span></header>
        <div className="workforce-register-head"><span>Officer</span><span>Network</span><span>Employment route</span><span>Employer and control</span></div>
        {summary.officers.map((officer) => <div className="workforce-register-row" key={officer.officerId}><span><strong>{officer.officerName}</strong><small>{officer.officerId} · Passport {officer.passportStatus ?? "not connected"}</small></span><span><em className="pill tone-green">{officer.networkStatus}</em><small>Membership only</small></span><span><strong>{officer.workforceModel ? officer.workforceModel.replaceAll("_", " ") : "Not employed"}</strong><small>{officer.employmentStatus.replaceAll("_", " ")}</small></span><span><strong>{officer.employerName ?? "No employer of record"}</strong><small>{officer.nextControl}</small></span></div>)}
      </article>
      <aside className="workforce-boundaries panel"><header className="command-panel-heading"><div><p className="eyebrow">Non-negotiable boundary</p><h2>What activates liability</h2></div></header>
        <ol><li><span>01</span><div><strong>Network</strong><p>Identity, PSiRA and Passport eligibility only. No work promise, roster or payroll record.</p></div></li><li><span>02</span><div><strong>Resolve the route</strong><p>Every paid assignment names Direct Flex, an approved Partner, or Managed employment.</p></div></li><li><span>03</span><div><strong>Freeze responsibility</strong><p>The atomic command creates employer and accepted-terms snapshots from server records only. Final Version 19 snapshots are database protected.</p></div></li><li><span>04</span><div><strong>Settle correctly</strong><p>Direct work routes to payroll; partner work routes to the partner company—not an officer wallet.</p></div></li></ol>
        <div className={`snapshot-health ${summary.assignmentsMissingEmployerSnapshot ? "has-gap" : "is-clean"}`}><span>{summary.assignmentsMissingEmployerSnapshot ? "!" : "✓"}</span><div><strong>{summary.assignmentsWithEmployerSnapshot}/{summary.assignmentsWithEmployerSnapshot + summary.assignmentsMissingEmployerSnapshot} legacy synthetic assignments carry an employer snapshot</strong><p>{summary.assignmentsMissingEmployerSnapshot ? "Missing snapshots block production activation." : "These are synthetic demo records, not production authorisations. New final snapshots use the atomic activation engine."}</p></div></div>
      </aside>
    </section>
    <footer className="status-footer ops-command-footer"><span><i /> Network membership remains non-employment</span><span>Direct Flex reservations are database enforced · final NBCPSS/PSSPF treatment and production evidence remain launch gates</span></footer>
  </>;
}

function OfficerConversionControl({ operations, flash }: {
  operations: ReturnType<typeof useOperations>;
  flash: (message: string) => void;
}) {
  const state = operations.state;
  const [formOpen, setFormOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [officerId, setOfficerId] = useState("");
  const [route, setRoute] = useState<"assigned_officer_conversion" | "private_recruitment_enquiry">("assigned_officer_conversion");
  const [specialistCategory, setSpecialistCategory] = useState<"standard" | "armed" | "vip_tactical">("standard");
  const [completedServiceMonths, setCompletedServiceMonths] = useState("8");
  const [annualCashRand, setAnnualCashRand] = useState("195000");

  if (operations.loading && !state) return <div className="command-loading"><span className="pulse-dot" /><strong>Loading private conversion controls…</strong><small>Clause · fee schedule · employer handover · compliance</small></div>;
  if (!state) return <div className="command-error" role="alert"><strong>Officer conversion controls unavailable</strong><p>{operations.error || "The private conversion register could not be loaded."}</p><button onClick={() => void operations.refresh()}>Try again</button></div>;
  const conversion = state.conversion;
  const selectedClientId = clientId || conversion.clients[0]?.id || "";
  const selectedOfficerId = officerId || conversion.officers[0]?.id || "";
  const selectedClient = conversion.clients.find((client) => client.id === selectedClientId);
  const activeCases = conversion.cases.filter((item) => !["completed", "withdrawn"].includes(item.status));
  const stepLabel: Record<"record_offer_notice" | "record_offer_acceptance" | "confirm_client_employer_pack" | "confirm_lokd_payroll_closeout" | "confirm_psira_transfer" | "mark_fee_paid" | "complete" | "withdraw", string> = {
    record_offer_notice: "Record client notice",
    record_offer_acceptance: "Record accepted offer",
    confirm_client_employer_pack: "Confirm client employer pack",
    confirm_lokd_payroll_closeout: "Confirm LOKD close-out",
    confirm_psira_transfer: "Confirm PSiRA formalities",
    mark_fee_paid: "Record cleared fee",
    complete: "Complete handover",
    withdraw: "Withdraw case",
  };

  async function advance(caseId: string, version: number, step: keyof typeof stepLabel) {
    const result = await operations.runAction({ action: "advance_officer_conversion_case", caseId, version, step });
    if (result) flash(`${stepLabel[step]} saved to the synthetic Operations record.`);
  }

  async function openCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const serviceMonths = Number(completedServiceMonths);
    const annualCash = Number(annualCashRand);
    if (!Number.isInteger(serviceMonths) || serviceMonths < 0) return;
    if (route === "private_recruitment_enquiry" && (!Number.isFinite(annualCash) || annualCash <= 0)) return;
    const result = await operations.runAction({
      action: "open_officer_conversion_case",
      clientId: selectedClientId,
      officerId: selectedOfficerId,
      route,
      specialistCategory,
      completedServiceMonths: serviceMonths,
      annualGuaranteedCashCents: route === "private_recruitment_enquiry" ? Math.round(annualCash * 100) : null,
    });
    if (result) {
      setFormOpen(false);
      flash("Private officer-conversion case opened with a server-calculated client fee.");
    }
  }

  return <>
    <section className="command-heading conversion-heading"><div><p className="eyebrow">Private Operations pathway</p><h1>Officer conversions</h1><p>Managed service remains the norm. This register is used only after a client asks to employ an assigned officer, or sends a direct private recruitment enquiry.</p></div><button className="primary-button" onClick={() => setFormOpen(true)}>＋ Open private case</button></section>
    {operations.error && <div className="command-error conversion-inline-error" role="alert"><strong>Control not saved</strong><p>{operations.error}</p></div>}
    <section className="conversion-policy-strip">
      <article><span>0 days</span><strong>No credit terms. Ever.</strong><p>Client funds must clear in full before a placement handover can complete. LOKD does not finance client payroll or fees.</p></article>
      <article><span>Officer protected</span><strong>The client pays the fee</strong><p>No conversion, recruitment or placement fee may be deducted from the officer or used to restrict the officer’s choice.</p></article>
      <article><span>Checklist only</span><strong>PEA registration</strong><p>{conversion.peaGateCode} · {conversion.peaGateLabel}. Tracked in the launch register; it does not block this workflow.</p></article>
    </section>
    <section className="conversion-layout">
      <article className="conversion-register panel"><header className="command-panel-heading"><div><p className="eyebrow">Internal case register</p><h2>Permanent-engagement controls</h2></div><span>{activeCases.length} active · {conversion.readyCases} ready</span></header>
        {conversion.cases.length ? <div className="conversion-case-list">{conversion.cases.map((conversionCase) => <article className={`conversion-case conversion-case--${conversionCase.readyToComplete ? "ready" : "blocked"}`} key={conversionCase.id}>
          <header><div><p className="eyebrow">{conversionCase.route === "assigned_officer_conversion" ? "Assigned officer consequence" : "Private recruitment enquiry"}</p><h3>{conversionCase.officerName} → {conversionCase.clientName}</h3><small>{conversionCase.id} · {conversionCase.policyVersion}</small></div><em>{conversionCase.status.replaceAll("_", " ")}</em></header>
          <dl><div><dt>Officer snapshot</dt><dd>{conversionCase.officerGrade} · {conversionCase.specialistCategory.replaceAll("_", " ")}</dd></div><div><dt>Client fee</dt><dd>{formatZar(conversionCase.calculatedFeeCents)} · no VAT charged</dd></div><div><dt>Tenure factor</dt><dd>{conversionCase.tenurePercent}% · {conversionCase.completedServiceMonths} completed month(s)</dd></div><div><dt>Fee state</dt><dd>{conversionCase.feeStatus.replaceAll("_", " ")}</dd></div><div><dt>Client clause</dt><dd>{conversionCase.clauseStatus.replaceAll("_", " ")}</dd></div><div><dt>Protection tail</dt><dd>{conversion.tailMonths} months after final assignment or introduction</dd></div></dl>
          <div className="conversion-control-grid"><span className={conversionCase.offerAcceptedAt ? "done" : "pending"}><i>{conversionCase.offerAcceptedAt ? "✓" : "1"}</i>Accepted offer</span><span className={conversionCase.clientEmployerPackStatus === "ready" ? "done" : "pending"}><i>{conversionCase.clientEmployerPackStatus === "ready" ? "✓" : "2"}</i>Client employer pack</span><span className={conversionCase.lokdPayrollCloseoutStatus === "ready" ? "done" : "pending"}><i>{conversionCase.lokdPayrollCloseoutStatus === "ready" ? "✓" : "3"}</i>Payroll and leave close-out</span><span className={conversionCase.psiraTransferStatus === "ready" ? "done" : "pending"}><i>{conversionCase.psiraTransferStatus === "ready" ? "✓" : "4"}</i>PSiRA formalities</span><span className={conversionCase.feeStatus === "paid" ? "done" : "pending"}><i>{conversionCase.feeStatus === "paid" ? "✓" : "5"}</i>Cleared client funds</span></div>
          {!conversionCase.readyToComplete && !["completed", "withdrawn"].includes(conversionCase.status) && <div className="conversion-blockers"><strong>Handover remains blocked</strong><ul>{conversionCase.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>}
          {!["completed", "withdrawn"].includes(conversionCase.status) && <footer>
            <div>{conversionCase.status === "enquiry" && <button disabled={operations.busy} onClick={() => void advance(conversionCase.id, conversionCase.version, "record_offer_notice")}>{stepLabel.record_offer_notice}</button>}{conversionCase.status === "offer_notified" && <button disabled={operations.busy} onClick={() => void advance(conversionCase.id, conversionCase.version, "record_offer_acceptance")}>{stepLabel.record_offer_acceptance}</button>}{conversionCase.offerAcceptedAt && <>
              {conversionCase.clientEmployerPackStatus !== "ready" && <button disabled={operations.busy} onClick={() => void advance(conversionCase.id, conversionCase.version, "confirm_client_employer_pack")}>{stepLabel.confirm_client_employer_pack}</button>}
              {conversionCase.lokdPayrollCloseoutStatus !== "ready" && <button disabled={operations.busy} onClick={() => void advance(conversionCase.id, conversionCase.version, "confirm_lokd_payroll_closeout")}>{stepLabel.confirm_lokd_payroll_closeout}</button>}
              {conversionCase.psiraTransferStatus !== "ready" && <button disabled={operations.busy} onClick={() => void advance(conversionCase.id, conversionCase.version, "confirm_psira_transfer")}>{stepLabel.confirm_psira_transfer}</button>}
              {conversionCase.feeStatus === "payable_prefund_required" && <button title="Record synthetic cleared funds" disabled={operations.busy} onClick={() => void advance(conversionCase.id, conversionCase.version, "mark_fee_paid")}>{stepLabel.mark_fee_paid}</button>}
              <button disabled={operations.busy || !conversionCase.readyToComplete} onClick={() => void advance(conversionCase.id, conversionCase.version, "complete")}>{stepLabel.complete}</button>
            </>}</div><button className="conversion-withdraw" disabled={operations.busy || conversionCase.feeStatus === "paid"} onClick={() => void advance(conversionCase.id, conversionCase.version, "withdraw")}>Withdraw</button>
          </footer>}
        </article>)}</div> : <div className="activation-empty"><span>✓</span><strong>No active cases</strong><p>Permanent employment remains a private consequence, never a public product.</p></div>}
      </article>
      <aside className="conversion-policy panel"><header className="command-panel-heading"><div><p className="eyebrow">Policy {conversion.policyVersion}</p><h2>Fee and contract rules</h2></div></header>
        <div className="conversion-fees"><h3>Minimum fee schedule</h3><dl><div><dt>Grade C / D / E</dt><dd>R12,500</dd></div><div><dt>Grade B</dt><dd>R14,000</dd></div><div><dt>Grade A / Supervisor</dt><dd>R15,000</dd></div><div><dt>Armed</dt><dd>Base + R5,000</dd></div><div><dt>VIP / Tactical</dt><dd>R25,000</dd></div></dl><small>No VAT is charged on these fees. Private recruitment enquiries use 15% of first-year guaranteed cash remuneration, subject to the applicable minimum.</small></div>
        <div className="conversion-tenure"><h3>Assigned-officer tenure</h3><ol><li><span>0–3 months</span><strong>100%</strong></li><li><span>4–6 months</span><strong>75%</strong></li><li><span>7–12 months</span><strong>50%</strong></li><li><span>Over 12 months</span><strong>25%</strong></li></ol></div>
        <div className="conversion-clause"><h3>Clause {conversion.clauseVersion}</h3><p>{conversion.clauseText}</p></div>
        {conversion.clients.filter((client) => client.clauseStatus !== "acknowledged").map((client) => <button className="conversion-clause-action" key={client.id} disabled={operations.busy} onClick={async () => { const result = await operations.runAction({ action: "acknowledge_permanent_engagement_clause", clientId: client.id }); if (result) flash("Synthetic client clause acknowledgement recorded."); }}>Record {client.name} acknowledgement</button>)}
      </aside>
    </section>
    <footer className="status-footer ops-command-footer"><span><i /> Internal Operations surface only · no public menu or booking product</span><span>Client prefunding required · officer pays R0 · six-month tail · launch gates are checklist-only</span></footer>
    {formOpen && <div className="drawer-backdrop incident-dialog-backdrop" role="presentation" onMouseDown={() => setFormOpen(false)}><form className="incident-dialog conversion-dialog" role="dialog" aria-modal="true" aria-labelledby="conversion-dialog-title" onSubmit={(event) => void openCase(event)} onMouseDown={(event) => event.stopPropagation()}>
      <div className="drawer-topline"><span className="detail-id">PRIVATE OPERATIONS CASE</span><button type="button" onClick={() => setFormOpen(false)} aria-label="Close conversion form"><Icon name="close" /></button></div><p className="eyebrow">Not a public service</p><h2 id="conversion-dialog-title">Open an officer-conversion case</h2><p className="incident-dialog-intro">The server freezes the grade, route, policy version and client-only fee. This does not notify the officer, send an invoice, extend credit, or create employment.</p>
      <div className="incident-form-grid"><label>Approved client<select required value={selectedClientId} onChange={(event) => setClientId(event.target.value)}>{conversion.clients.map((client) => <option key={client.id} value={client.id}>{client.name} · clause {client.clauseStatus.replaceAll("_", " ")}</option>)}</select></label><label>Officer<select required value={selectedOfficerId} onChange={(event) => setOfficerId(event.target.value)}>{conversion.officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name} · {officer.grade}</option>)}</select></label></div>
      <label>Private route<select value={route} onChange={(event) => setRoute(event.target.value as typeof route)}><option value="assigned_officer_conversion">Client wants an assigned officer permanently</option><option value="private_recruitment_enquiry">Direct private recruitment enquiry</option></select></label>
      <div className="incident-form-grid"><label>Officer category<select value={specialistCategory} onChange={(event) => setSpecialistCategory(event.target.value as typeof specialistCategory)}><option value="standard">Standard grade</option><option value="armed">Armed · base plus R5,000</option><option value="vip_tactical">VIP / Tactical · R25,000 minimum</option></select></label><label>Completed LOKD service months<input inputMode="numeric" min="0" max="600" required type="number" value={completedServiceMonths} onChange={(event) => setCompletedServiceMonths(event.target.value)} /></label></div>
      {route === "private_recruitment_enquiry" && <label>First-year guaranteed cash remuneration (ZAR)<input inputMode="decimal" min="1" max="10000000" required type="number" value={annualCashRand} onChange={(event) => setAnnualCashRand(event.target.value)} /></label>}
      <div className="relief-gate-note"><strong>Hard commercial boundary</strong><p>Zero credit days. The client funds the fee in full; no amount is charged to the officer. PEA registration remains on the launch checklist and does not block this workflow.</p></div>
      <div className="incident-dialog-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button primary-button--light" disabled={operations.busy || !selectedClientId || !selectedOfficerId}>{operations.busy ? "Opening…" : "Open controlled case"}</button></div>
      {selectedClient && selectedClient.clauseStatus !== "acknowledged" && <small className="conversion-dialog-warning">This client’s permanent-engagement clause is not yet acknowledged; the case can be opened but cannot complete.</small>}
    </form></div>}
  </>;
}

function LaunchReadinessControl({ operations }: { operations: ReturnType<typeof useOperations> }) {
  const state = operations.state;
  if (operations.loading && !state) return <div className="command-loading"><span className="pulse-dot" /><strong>Evaluating launch controls…</strong><small>Regulatory · workforce · finance · production operations</small></div>;
  if (!state) return <div className="command-error" role="alert"><strong>Launch controls unavailable</strong><p>{operations.error || "The launch-gate register could not be loaded."}</p><button onClick={() => void operations.refresh()}>Try again</button></div>;
  const launch = state.launch;
  const percent = launch.totalHardGates ? Math.round((launch.passedHardGates / launch.totalHardGates) * 100) : 0;
  const groups = [...new Set(launch.gates.map((gate) => gate.category))];
  const gate = (code: string) => launch.gates.find((item) => item.code === code);
  const gateLabel = (code: string) => (gate(code)?.status ?? "blocked").replaceAll("_", " ");
  return <>
    <section className="command-heading launch-heading"><div><p className="eyebrow">Fail-closed activation</p><h1>Launch readiness</h1><p>Paid deployment remains locked until every hard gate is independently evidenced and passed.</p></div><button className="secondary-button" disabled={operations.busy} onClick={() => void operations.refresh()}><Icon name="refresh" /> Re-evaluate</button></section>
    <section className={`launch-decision ${launch.activationLocked ? "is-locked" : "is-ready"}`}><div><span>{launch.activationLocked ? "LOCKED" : "READY"}</span><strong>{launch.activationLocked ? "Production paid-shift activation is disabled" : "Controlled pilot activation available"}</strong><p>{launch.activationLocked ? `${launch.blockers.length} required controls still need valid evidence or approval.` : "Every required control is present, evidenced and current."}</p></div><div className="launch-score"><strong>{launch.passedHardGates}/{launch.totalHardGates}</strong><span>required gates passed</span><i><b style={{ width: `${percent}%` }} /></i></div></section>
    <section className="psira-milestone"><div><span>01</span><p>Company paperwork</p><strong>{gateLabel("G1_PSIRA_PAPERWORK")}</strong><small>{gate("G1_PSIRA_PAPERWORK")?.detail ?? "Required gate missing"}</small></div><i /><div><span>02</span><p>Control-room inspection</p><strong>{gateLabel("G2_CONTROL_ROOM_INSPECTION")}</strong><small>{gate("G2_CONTROL_ROOM_INSPECTION")?.detail ?? "Required gate missing"}</small></div><i /><div><span>03</span><p>Business registration</p><strong>{gateLabel("G3_PSIRA_CERTIFICATE")}</strong><small>{gate("G3_PSIRA_CERTIFICATE")?.detail ?? "Required gate missing"}</small></div></section>
    <section className="launch-gate-groups">{groups.map((group) => <article className="launch-gate-group panel" key={group}><header><span>{group.replaceAll("_", " ")}</span><strong>{launch.gates.filter((gate) => gate.category === group && gate.status === "passed").length}/{launch.gates.filter((gate) => gate.category === group).length}</strong></header>{launch.gates.filter((gate) => gate.category === group).map((gate) => <div className={`launch-gate launch-gate--${gate.status}`} key={gate.code}><span>{gate.status === "passed" ? "✓" : gate.status === "reported" ? "R" : gate.status === "blocked" ? "×" : "•"}</span><div><strong>{gate.label}</strong><p>{gate.detail}</p><small>{gate.code} · {gate.evidenceLevel.replaceAll("_", " ")}</small></div><em>{gate.status.replaceAll("_", " ")}</em></div>)}</article>)}</section>
    <section className="launch-truth panel"><span>!</span><div><strong>PSiRA is reported complete; evidence still has to pass the platform gate.</strong><p>The issued certificate and expiry evidence must be attached and verified rather than assumed. PEA registration is a separate placement-only gate. Identity verification, cleared client funds, payroll/statutory processing, insurance and production access still govern paid deployment.</p></div></section>
  </>;
}

function StandbyOfficer({ officer }: { officer: OperationsReserveOfficer }) {
  const initials = officer.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2);
  return <article className="standby-officer"><span>{initials}</span><div><strong>{officer.fullName}</strong><small>{officer.city} · {officer.psiraGrade} · Passport {officer.passportStatus}</small><p>{officer.eligibilityLabel}</p></div><em>{officer.serviceTypes.join(" · ")}</em></article>;
}

function ReliefCaseDialog({ slot, candidates, busy, onClose, onCreate }: {
  slot: OperationsRosterSlot;
  candidates: OperationsReserveOfficer[];
  busy: boolean;
  onClose: () => void;
  onCreate: (candidateId: string, reasonCode: "arrival_not_assured" | "officer_unavailable" | "client_request" | "operations_contingency") => Promise<void>;
}) {
  const [candidateId, setCandidateId] = useState(candidates[0]?.id ?? "");
  const [reasonCode, setReasonCode] = useState<"arrival_not_assured" | "officer_unavailable" | "client_request" | "operations_contingency">(slot.coverageState === "uncovered" ? "operations_contingency" : "arrival_not_assured");
  return <div className="drawer-backdrop incident-dialog-backdrop" role="presentation" onMouseDown={onClose}><form className="incident-dialog relief-case-dialog" role="dialog" aria-modal="true" aria-labelledby="relief-case-title" onSubmit={(event) => { event.preventDefault(); void onCreate(candidateId, reasonCode); }} onMouseDown={(event) => event.stopPropagation()}>
    <div className="drawer-topline"><span className="detail-id">CONTROLLED RELIEF CASE</span><button type="button" onClick={onClose} aria-label="Close relief case form"><Icon name="close" /></button></div>
    <p className="eyebrow eyebrow--amber">{slot.siteName} · {slot.postName}</p><h2 id="relief-case-title">Open a relief control</h2><p className="incident-dialog-intro">This records ownership and reserves one server-eligible candidate. The demo does not notify the officer or claim acceptance.</p>
    <dl className="relief-dialog-facts"><div><dt>Post window</dt><dd>{formatSast(slot.startsAt, true)}–{formatSast(slot.endsAt)}</dd></div><div><dt>Current state</dt><dd>{slot.coverageLabel}</dd></div><div><dt>Primary officer</dt><dd>{slot.officerName ?? "Unassigned"}</dd></div><div><dt>Check-in evidence</dt><dd>{slot.arrivalEvidence === "checked_in" ? "Recorded" : "Not recorded"}</dd></div></dl>
    <label>Reason<select value={reasonCode} onChange={(event) => setReasonCode(event.target.value as typeof reasonCode)}><option value="arrival_not_assured">Arrival not assured</option><option value="officer_unavailable">Officer unavailable</option><option value="client_request">Client requested replacement</option><option value="operations_contingency">Operations contingency</option></select></label>
    <label>Eligible reserve candidate<select value={candidateId} onChange={(event) => setCandidateId(event.target.value)} disabled={!candidates.length}><option value="">{candidates.length ? "Choose an officer" : "No officer passes this slot’s controls"}</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.fullName} · {candidate.psiraGrade}</option>)}</select></label>
    <div className="relief-gate-note"><strong>Server gate</strong><p>LOKD rechecks funding, Passport, PSiRA grade, service, purpose endorsement, declared availability, overlap and the current demo rest buffer when this case is opened.</p></div>
    <div className="incident-dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button primary-button--light" disabled={busy || !candidateId}>{busy ? "Opening…" : "Open controlled case"}</button></div>
  </form></div>;
}

function SiteDrawer({ site, incident, events, busy, resolutionNote, setResolutionNote, onClose, onAcknowledge, onResolve }: {
  site: OperationsSite;
  incident: OperationsIncident | null;
  events: Array<{ id: string; title: string; detail: string; occurredAt: string; tone: string }>;
  busy: boolean;
  resolutionNote: string;
  setResolutionNote: (value: string) => void;
  onClose: () => void;
  onAcknowledge: (incident: OperationsIncident) => Promise<void>;
  onResolve: (incident: OperationsIncident) => Promise<void>;
}) {
  return <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}><aside className="detail-drawer site-command-drawer" role="dialog" aria-modal="true" aria-labelledby="site-drawer-title" onMouseDown={(event) => event.stopPropagation()}>
    <div className="drawer-topline"><span className="detail-id">{site.id} · GEOFENCE V{site.geofenceVersion}</span><button onClick={onClose} aria-label="Close site details"><Icon name="close" /></button></div>
    <div className="site-drawer-heading"><span className={`site-state-symbol tone-${stateTone(site.state)}`} /><div><p className="eyebrow">{site.area} · {site.stateLabel}</p><h2 id="site-drawer-title">{site.name}</h2><p>{site.clientName}</p></div></div>
    <div className={`detail-status detail-status--${site.state === "attention" || site.state === "critical" ? "attention" : site.state === "scheduled" ? "confirmed" : "on-post"}`}><span className={`site-state-symbol tone-${stateTone(site.state)}`} />{site.nextAction}</div>
    <dl className="detail-list site-command-facts">
      <div><dt>Site address</dt><dd>{site.addressLabel}</dd></div><div><dt>Risk and service</dt><dd>{site.riskBand} · {site.serviceType} · controlled assignment</dd></div>
      <div><dt>Current officer</dt><dd>{site.deployment.officerName ?? "No officer assigned"}</dd></div><div><dt>Shift and post</dt><dd>{site.deployment.postName ?? "No active post"} · {site.deployment.shiftStart ?? "—"}–{site.deployment.shiftEnd ?? "—"}</dd></div>
      <div><dt>LOKD Passport</dt><dd>{site.deployment.passportStatus ? `Passport ${site.deployment.passportStatus}` : "Passport test record not connected"}</dd></div><div><dt>Attendance evidence</dt><dd>{site.latestSignal ? `${site.latestSignal.type.replaceAll("_", " ")} · ${site.latestSignal.ageMinutes}m old · ${site.latestSignal.accuracyMeters ?? "—"}m stated accuracy` : "No signal available"}</dd></div>
      <div><dt>Geofence control</dt><dd>{site.geofenceRadiusMeters}m · Version {site.geofenceVersion} · synthetic data only</dd></div><div><dt>Open controls</dt><dd>{site.openIncidentCount} incident · {site.openExceptionCount} exception</dd></div>
    </dl>
    <section className="site-post-orders"><h3>Approved posts</h3>{site.posts.map((post) => <div key={post.id}><span><strong>{post.name}</strong><small>{post.serviceType} · {post.minimumGrade} · {post.purposeCode.replaceAll("_", " ")}</small></span><em>{post.postOrdersVersion}</em></div>)}</section>
    {incident && <section className={`drawer-incident drawer-incident--${incident.severity}`}><p className="eyebrow">Incident case · {incident.id}</p><h3>{incident.summary}</h3><p>{incident.detail}</p><dl><div><dt>Severity</dt><dd>{incident.severity}</dd></div><div><dt>Status</dt><dd>{incident.status}</dd></div><div><dt>SLA due</dt><dd>{incident.slaDueAt ? formatSast(incident.slaDueAt, true) : "Not set"}</dd></div><div><dt>Owner</dt><dd>{incident.ownerId ?? "Unassigned"}</dd></div></dl>
      {incident.status === "open" && <button disabled={busy} onClick={() => void onAcknowledge(incident)}>Acknowledge and take ownership</button>}
      {(incident.status === "acknowledged" || incident.status === "investigating") && <div className="incident-resolution"><label htmlFor="resolution-note">Resolution note</label><textarea id="resolution-note" value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="Record the action taken, outcome and any required follow-up." /><button disabled={busy || resolutionNote.trim().length < 8} onClick={() => void onResolve(incident)}>Resolve incident</button><small>Acknowledgement never closes a case. Resolution requires a recorded outcome.</small></div>}
    </section>}
    <div className="drawer-timeline"><h3>Site control timeline</h3>{events.slice(0, 6).map((event) => <div key={event.id}><i className={event.tone === "red" || event.tone === "amber" ? "pending" : "done"} /><span><strong>{event.title}</strong><small>{formatSast(event.occurredAt, true)} · {event.detail}</small></span></div>)}</div>
  </aside></div>;
}

function CreateIncidentDialog({ sites, busy, onClose, onCreate }: {
  sites: OperationsSite[];
  busy: boolean;
  onClose: () => void;
  onCreate: (values: { siteId: string; severity: IncidentSeverity; category: string; summary: string; detail: string }) => Promise<void>;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [category, setCategory] = useState("Site condition");
  const [summary, setSummary] = useState("");
  const [detail, setDetail] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); await onCreate({ siteId, severity, category, summary, detail }); }
  return <div className="drawer-backdrop incident-dialog-backdrop" role="presentation" onMouseDown={onClose}><form className="incident-dialog" role="dialog" aria-modal="true" aria-labelledby="create-incident-title" onSubmit={(event) => void submit(event)} onMouseDown={(event) => event.stopPropagation()}>
    <div className="drawer-topline"><span className="detail-id">OPERATIONS CASE CONTROL</span><button type="button" onClick={onClose} aria-label="Close incident form"><Icon name="close" /></button></div>
    <p className="eyebrow eyebrow--amber">New operational incident</p><h2 id="create-incident-title">Create an auditable case</h2><p className="incident-dialog-intro">Use the incident register for an event requiring triage, ownership and a recorded outcome. This demo does not contact emergency services.</p>
    <div className="incident-form-grid"><label>Site<select value={siteId} onChange={(event) => setSiteId(event.target.value)}>{sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label><label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as IncidentSeverity)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label></div>
    <label>Category<input value={category} maxLength={48} onChange={(event) => setCategory(event.target.value)} /></label><label>Incident summary<input value={summary} minLength={8} maxLength={120} required placeholder="A precise one-line description" onChange={(event) => setSummary(event.target.value)} /></label><label>Known facts<textarea value={detail} minLength={12} maxLength={700} required placeholder="What happened, what is known, and what immediate action was taken?" onChange={(event) => setDetail(event.target.value)} /></label>
    <div className="incident-dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button primary-button--light" disabled={busy || !siteId || summary.trim().length < 8 || detail.trim().length < 12}>{busy ? "Creating…" : "Create incident"}</button></div>
  </form></div>;
}
