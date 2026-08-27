"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { projectGautengCoordinate } from "../lib/operations-core";
import type {
  CoverageState,
  IncidentSeverity,
  OperationsIncident,
  OperationsReserveOfficer,
  OperationsRosterSlot,
  OperationsSite,
  OperationalState,
} from "../lib/operations-types";
import { useOperations } from "../lib/use-operations";
import { usePilot } from "../lib/use-pilot";
import WorkspaceView from "./workspace-view";

const navItems = ["Control", "Coverage", "Incidents", "Bookings", "Offers", "Applications", "Officers", "Clients", "Earnings", "Feedback", "Launch readiness"];

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

export default function OperationsApp({ stage, actorEmail }: { stage: "demo" | "prelaunch" | "pilot"; actorEmail: string }) {
  const pilot = usePilot("operations");
  const operations = useOperations();
  const [activeNav, setActiveNav] = useState("Control");
  const [notice, setNotice] = useState<string | null>(null);
  const [createIncidentOpen, setCreateIncidentOpen] = useState(false);
  const isCommand = activeNav === "Control" || activeNav === "Incidents";
  const isCoverage = activeNav === "Coverage";
  const isOperationalSurface = isCommand || isCoverage;
  const pendingPayments = pilot.state?.bookings.filter((booking) => booking.fundingStatus !== "paid_in_full").length ?? 0;

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3400);
  }

  return (
    <main className="app-shell ops-premium-shell">
      <aside className="side-rail">
        <Link className="brand-lockup" href="/" aria-label="LOKD home"><img src="/lokd-logo-reverse.svg" alt="LOKD" /></Link>
        <div className="pilot-chip"><span className="pulse-dot" /><span><strong>Johannesburg pilot</strong>Operations command · Synthetic</span></div>
        <div className="experience-switcher" aria-label="Preview experience">
          <a className="experience-active" href="/ops">Ops</a><a href="/officer">Officer</a><a href="/client">Client</a>
        </div>
        <nav aria-label="LOKD operations">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => <button className={activeNav === item ? "nav-item nav-item--active" : "nav-item"} key={item} onClick={() => setActiveNav(item)}>
            <span>{item}</span>
            {item === "Coverage" && (operations.state?.summary.arrivalWatch ?? 0) > 0 && <em className="nav-warning">{operations.state?.summary.arrivalWatch}</em>}
            {item === "Incidents" && (operations.state?.summary.openIncidents ?? 0) > 0 && <em className="nav-warning">{operations.state?.summary.openIncidents}</em>}
            {item === "Bookings" && pendingPayments > 0 && <em className="nav-warning">{pendingPayments}</em>}
            {item === "Applications" && <em>New</em>}
            {item === "Feedback" && <em>Team</em>}
          </button>)}
        </nav>
        <div className="rail-footer"><div className="avatar avatar--dark">Z</div><span><strong>Operations</strong>{actorEmail}</span><button aria-label="Account options">•••</button></div>
      </aside>

      <section className="main-stage">
        <header className="top-bar ops-command-topbar">
          <Link className="mobile-brand" href="/" aria-label="LOKD home"><img src="/lokd-logo.svg" alt="LOKD" /></Link>
          <div className="breadcrumb"><span>Operations</span><b>/</b><strong>{activeNav}</strong></div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Search"><Icon name="search" /></button>
            <button className="icon-button notification-button" aria-label="Notifications"><span className="notification-dot" /><Icon name="bell" /></button>
            {isOperationalSurface ? <button className="primary-button ops-incident-button" onClick={() => setCreateIncidentOpen(true)}><Icon name="incident" /> Create incident</button>
              : <button className="primary-button" onClick={() => flash("Booking creation opens in the Client workspace.")}><span>＋</span> Create booking</button>}
          </div>
        </header>

        <div className="mobile-ops-controls">
          <div className="mobile-experience-switcher" aria-label="Preview experience"><a className="active" href="/ops">Ops</a><a href="/officer">Officer</a><a href="/client">Client</a></div>
          <nav aria-label="LOKD operations mobile navigation">{navItems.map((item) => <button className={activeNav === item ? "active" : ""} key={item} onClick={() => setActiveNav(item)}>{item}</button>)}</nav>
        </div>

        <div className={isOperationalSurface ? "page-content ops-command-content" : "page-content"}>
          <div className="preview-banner ops-simulation-banner"><strong>Simulated {stage} command data</strong>Fixed sites, signals and cases are synthetic. Browser GPS is disabled; no officer is being tracked and no paid deployment is active.</div>
          {isCommand ? <CommandCentre
            operations={operations}
            incidentFocus={activeNav === "Incidents"}
            openIncident={() => setCreateIncidentOpen(true)}
            flash={flash}
          /> : isCoverage ? <CoverageCentre operations={operations} flash={flash} /> : <WorkspaceView name={activeNav} />}
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
      <div><dt>Site address</dt><dd>{site.addressLabel}</dd></div><div><dt>Risk and service</dt><dd>{site.riskBand} · {site.serviceType} · Phase 1 scheduled post</dd></div>
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
