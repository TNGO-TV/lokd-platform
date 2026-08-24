"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import WorkspaceView from "./workspace-view";
import { usePilot } from "../lib/use-pilot";

type ShiftState = "on-post" | "confirmed" | "attention";

type Shift = {
  id: string;
  officer: string;
  initials: string;
  grade: string;
  service: "Unarmed" | "Armed" | "VIP";
  purpose: string;
  passportStatus: "Ready" | "Verified" | "Attention";
  passportNumber: string;
  requirement: string;
  contractTerm: string;
  releaseCadence: "Weekly" | "Monthly";
  paymentState: string;
  site: string;
  post: string;
  time: string;
  state: ShiftState;
  detail: string;
};

const shifts: Shift[] = [
  {
    id: "BK-2081",
    officer: "Lerato Khumalo",
    initials: "LK",
    grade: "Grade B",
    service: "Unarmed",
    purpose: "Commercial access",
    passportStatus: "Verified",
    passportNumber: "LKD-P-1842",
    requirement: "Grade C+ · active Passport · Commercial access endorsed",
    contractTerm: "1 month",
    releaseCadence: "Weekly",
    paymentState: "Client term paid in full",
    site: "Northbridge Rosebank Offices",
    post: "Main access",
    time: "06:00–18:00",
    state: "on-post",
    detail: "Passport scanned by client · Commercial access current · Checked in 05:54",
  },
  {
    id: "BK-2082",
    officer: "Sibusiso Dlamini",
    initials: "SD",
    grade: "Grade B",
    service: "Armed",
    purpose: "Secure logistics",
    passportStatus: "Ready",
    passportNumber: "LKD-P-2097",
    requirement: "Grade B+ · active Passport · monthly armed readiness current",
    contractTerm: "3 months",
    releaseCadence: "Weekly",
    paymentState: "Client term paid in full",
    site: "Eastline Linbro Yard",
    post: "Vehicle gate",
    time: "18:00–06:00",
    state: "confirmed",
    detail: "Passport ready · Armed readiness current · Secure-logistics purpose endorsed",
  },
  {
    id: "BK-2083",
    officer: "Thabo Mokoena",
    initials: "TM",
    grade: "Grade A",
    service: "VIP",
    purpose: "Executive protection",
    passportStatus: "Ready",
    passportNumber: "LKD-P-1104",
    requirement: "Grade B+ · active Passport · Executive protection endorsed",
    contractTerm: "6 months",
    releaseCadence: "Monthly",
    paymentState: "Client term paid in full",
    site: "Metsi Midrand Depot",
    post: "Contractor access",
    time: "Sat · 06:00–18:00",
    state: "confirmed",
    detail: "Passport ready · Close-protection qualification and tactical assessment current",
  },
  {
    id: "SH-2080",
    officer: "Lerato Khumalo",
    initials: "LK",
    grade: "Grade B",
    service: "Unarmed",
    purpose: "Commercial access",
    passportStatus: "Verified",
    passportNumber: "LKD-P-1842",
    requirement: "Grade C+ · active Passport · Commercial access endorsed",
    contractTerm: "1 month",
    releaseCadence: "Weekly",
    paymentState: "Client term paid in full",
    site: "Northbridge Rosebank Offices",
    post: "Main access",
    time: "18 Aug · 06:00–18:00",
    state: "attention",
    detail: "Passport verified for this assignment · Client service confirmation pending · R800 remains in the verification stage",
  },
];

const navItems = ["Control", "Bookings", "Offers", "Applications", "Officers", "Clients", "Earnings", "Feedback", "Launch readiness"];

function StatusDot({ state }: { state: ShiftState }) {
  return <span className={`status-dot status-dot--${state}`} aria-hidden="true" />;
}

function MiniMark() {
  return (
    <div className="mini-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function OperationsApp() {
  const pilot = usePilot();
  const [activeNav, setActiveNav] = useState("Control");
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const currentShifts = useMemo(() => shifts.filter((shift) => shift.state === "on-post" || shift.state === "confirmed"), []);
  const pendingServiceRecords = pilot.state?.shifts.filter((shift) => shift.clientSignoffStatus === "pending").length ?? 0;
  const pendingPayments = pilot.state?.bookings.filter((booking) => booking.fundingStatus !== "paid_in_full").length ?? 0;
  const todayLabel = "Monday, 24 August · pilot snapshot";

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3200);
  }

  return (
    <main className="app-shell">
      <aside className="side-rail">
        <Link className="brand-lockup" href="/" aria-label="LOKD home">
          <img src="/lokd-logo-reverse.svg" alt="LOKD" />
        </Link>

        <div className="pilot-chip">
          <span className="pulse-dot" />
          <span>
            <strong>Johannesburg pilot</strong>
            Offer engine · Preview
          </span>
        </div>

        <div className="experience-switcher" aria-label="Preview experience">
          <a className="experience-active" href="/ops">Ops</a>
          <a href="/officer">Officer</a>
          <a href="/client">Client</a>
        </div>

        <nav aria-label="LOKD operations">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => (
            <button
              className={activeNav === item ? "nav-item nav-item--active" : "nav-item"}
              key={item}
              onClick={() => setActiveNav(item)}
            >
              <span>{item}</span>
              {item === "Offers" && <em>3</em>}
              {item === "Bookings" && pendingPayments > 0 && <em className="nav-warning">{pendingPayments}</em>}
              {item === "Applications" && <em>New</em>}
              {item === "Earnings" && <em className="nav-warning">1</em>}
              {item === "Feedback" && <em>Team</em>}
            </button>
          ))}
        </nav>

        <div className="rail-footer">
          <div className="avatar avatar--dark">Z</div>
          <span>
            <strong>Operations</strong>
            Marketplace control
          </span>
          <button aria-label="Open account menu">•••</button>
        </div>
      </aside>

      <section className="main-stage">
        <header className="top-bar">
          <Link className="mobile-brand" href="/" aria-label="LOKD home"><img src="/lokd-logo.svg" alt="LOKD" /></Link>
          <div className="breadcrumb"><span>Operations</span><b>/</b><strong>{activeNav}</strong></div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Search">⌕</button>
            <button className="icon-button notification-button" aria-label="Notifications"><span className="notification-dot" />◦</button>
            <button className="primary-button" onClick={() => flash("New client booking draft opened.")}><span>＋</span> Create booking</button>
          </div>
        </header>

        <div className="mobile-ops-controls">
          <div className="mobile-experience-switcher" aria-label="Preview experience">
            <a className="active" href="/ops">Ops</a>
            <a href="/officer">Officer</a>
            <a href="/client">Client</a>
          </div>
          <nav aria-label="LOKD operations mobile navigation">
            {navItems.map((item) => (
              <button
                className={activeNav === item ? "active" : ""}
                key={item}
                onClick={() => setActiveNav(item)}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        <div className="page-content">
          <div className="preview-banner">
            <strong>Private transactional demo</strong>
            Booking, matching, attendance and earnings states persist. Payment confirmation, identity checks and regulatory activation remain explicitly simulated or locked.
          </div>

          {activeNav !== "Control" ? (
            <WorkspaceView name={activeNav} />
          ) : <>
          <section className="hero-copy">
            <div>
              <p className="eyebrow">{todayLabel} SAST</p>
              <h1>Every confirmed booking is staffed.</h1>
              <p className="hero-subtitle">{pendingServiceRecords ? `${pendingServiceRecords} completed shift${pendingServiceRecords === 1 ? " is" : "s are"} waiting for client service confirmation.` : "All completed service records are current."}</p>
            </div>
            <div className="hero-actions">
              <button className="secondary-button" onClick={() => flash("Daily operations report prepared.")}>Export daily report</button>
              <button className="primary-button primary-button--light" disabled={!pendingServiceRecords} onClick={() => setSelectedShift(shifts[3])}>{pendingServiceRecords ? "Review service record" : "Records current"}</button>
            </div>
          </section>

          <section className="coverage-panel" aria-labelledby="coverage-title">
            <div className="coverage-summary">
              <div className="coverage-heading">
                <span className="live-label"><i /> Live operations</span>
                <span>Contracted coverage only</span>
              </div>
              <h2 id="coverage-title">2 of 2 client bookings covered today</h2>
              <p>Each slot passed the active Passport, purpose endorsement, service, grade and officer opt-in rules before the first valid acceptance secured it.</p>
              <div className="coverage-stats">
                <div><strong>1</strong><span>On post</span></div>
                <div><strong>1</strong><span>Accepted offer</span></div>
                <div><strong>0</strong><span>Open slots</span></div>
              </div>
            </div>
            <div className="coverage-map" aria-label="Schematic view of active LOKD sites">
              <div className="map-grid" />
              <div className="map-ring map-ring--one" />
              <div className="map-ring map-ring--two" />
              <div className="map-route" />
              <button className="site-pin site-pin--rosebank" onClick={() => setSelectedShift(shifts[0])}>
                <span><MiniMark /></span><strong>Rosebank</strong><small>On post · ends 18:00</small>
              </button>
              <button className="site-pin site-pin--linbro" onClick={() => setSelectedShift(shifts[1])}>
                <span><MiniMark /></span><strong>Linbro</strong><small>Confirmed · starts 18:00</small>
              </button>
              <div className="map-legend"><i /> LOKD verified coverage</div>
            </div>
          </section>

          <section className="operations-grid">
            <article className="panel panel--shifts">
              <div className="panel-heading">
                <div><p className="eyebrow">Booking engine</p><h2>Accepted assignments</h2></div>
                <button onClick={() => setActiveNav("Bookings")}>View bookings →</button>
              </div>
              <div className="shift-list">
                {currentShifts.map((shift) => (
                  <button className="shift-row" key={shift.id} onClick={() => setSelectedShift(shift)}>
                    <div className="avatar">{shift.initials}</div>
                    <div className="shift-person"><strong>{shift.officer}</strong><span>{shift.grade} · {shift.service} · {shift.purpose}</span></div>
                    <div className="shift-site"><strong>{shift.site}</strong><span>Passport {shift.passportStatus.toLowerCase()} · {shift.post}</span></div>
                    <div className="shift-time"><strong>{shift.time}</strong><span><StatusDot state={shift.state} /> {shift.state === "on-post" ? "On post" : "Confirmed"}</span></div>
                    <span className="row-arrow">›</span>
                  </button>
                ))}
              </div>
            </article>

            <aside className="panel panel--attention">
              <div className="panel-heading">
                <div><p className="eyebrow eyebrow--amber">Needs action</p><h2>Service records</h2></div>
                <span className="count-badge">{pendingServiceRecords}</span>
              </div>
              {pendingServiceRecords ? <button className="attention-card" onClick={() => setSelectedShift(shifts[3])}>
                <div className="attention-icon">!</div>
                <div><strong>Completed shift awaiting confirmation</strong><p>R800 is awaiting service verification; normal release controls remain separate.</p><span>SH-2080 · Northbridge Rosebank Offices</span></div>
              </button> : <div className="clean-state"><span>✓</span><div><strong>Service records current</strong><p>No completed shifts are waiting for client confirmation.</p></div></div>}
              <div className="clean-state">
                <span>✓</span>
                <div><strong>Everything else is clean</strong><p>No unstaffed bookings, expired offers or payout exceptions.</p></div>
              </div>
            </aside>
          </section>

          <footer className="status-footer">
            <span><i /> All systems operational</span>
            <span>Persistent pilot · Earnings ledger connected</span>
          </footer>
          </>}
        </div>
      </section>

      {selectedShift && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={() => setSelectedShift(null)}>
          <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="shift-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-topline"><span className="detail-id">{selectedShift.id}</span><button onClick={() => setSelectedShift(null)} aria-label="Close details">×</button></div>
            <p className="eyebrow">{selectedShift.state === "attention" ? "Client service record" : "Booking assignment"}</p>
            <h2 id="shift-title">{selectedShift.officer}</h2>
            <p className="drawer-subtitle">{selectedShift.grade} · {selectedShift.time}</p>
            <div className={`detail-status detail-status--${selectedShift.state}`}><StatusDot state={selectedShift.state} />{selectedShift.state === "on-post" ? "Officer is on post" : selectedShift.state === "confirmed" ? "Shift confirmed" : "Supervisor action required"}</div>
            <dl className="detail-list">
              <div><dt>Client site</dt><dd>{selectedShift.site}</dd></div>
              <div><dt>Assigned post</dt><dd>{selectedShift.post}</dd></div>
              <div><dt>Control evidence</dt><dd>{selectedShift.detail}</dd></div>
              <div><dt>Service type</dt><dd>{selectedShift.service}</dd></div>
              <div><dt>Purpose requirement</dt><dd>{selectedShift.purpose}</dd></div>
              <div><dt>LOKD Passport</dt><dd>{selectedShift.passportNumber} · {selectedShift.passportStatus}</dd></div>
              <div><dt>Eligibility rule</dt><dd>{selectedShift.requirement}</dd></div>
              <div><dt>Contract and funding</dt><dd>{selectedShift.contractTerm} · {selectedShift.paymentState}</dd></div>
              <div><dt>Officer offer</dt><dd>{selectedShift.service === "VIP" ? "Specialist rate · fixed offer" : selectedShift.service === "Armed" ? "Armed rate · fixed offer" : "R800 fixed offer"}</dd></div>
              <div><dt>Earnings release</dt><dd>{selectedShift.releaseCadence} after verified completion</dd></div>
            </dl>
            <div className="drawer-timeline">
              <h3>Connected control trail</h3>
              <div><i className="done" /><span><strong>LOKD Passport and purpose fit passed</strong><small>PSiRA grade · service qualification · current assessments · purpose endorsement</small></span></div>
              <div><i className="done" /><span><strong>Offer accepted</strong><small>Fixed offer and contract terms captured before assignment</small></span></div>
              <div><i className={selectedShift.state === "attention" ? "pending" : "done"} /><span><strong>{selectedShift.state === "attention" ? "Client confirmation outstanding" : "Attendance evidence current"}</strong><small>{selectedShift.detail}</small></span></div>
            </div>
            <div className="drawer-actions">
              <button className="secondary-button" onClick={() => flash("Control record exported.")}>Export record</button>
              <button className="primary-button" onClick={() => { flash("Booking control action recorded."); setSelectedShift(null); }}>Acknowledge</button>
            </div>
          </aside>
        </div>
      )}

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}
