"use client";

import { useMemo, useState } from "react";

type ShiftState = "on-post" | "confirmed" | "attention";

type Shift = {
  id: string;
  officer: string;
  initials: string;
  grade: string;
  site: string;
  post: string;
  time: string;
  state: ShiftState;
  detail: string;
};

const shifts: Shift[] = [
  {
    id: "SH-1021",
    officer: "Lerato Khumalo",
    initials: "LK",
    grade: "Grade C",
    site: "Northbridge Rosebank Offices",
    post: "Main access",
    time: "06:00–18:00",
    state: "on-post",
    detail: "Checked in at 05:54 · Geofence verified · Post orders accepted",
  },
  {
    id: "SH-1022",
    officer: "Sibusiso Dlamini",
    initials: "SD",
    grade: "Grade C",
    site: "Eastline Linbro Yard",
    post: "Vehicle gate",
    time: "18:00–06:00",
    state: "confirmed",
    detail: "Shift confirmed · Rest rule passed · Arrival reminder scheduled 17:15",
  },
  {
    id: "SH-1023",
    officer: "Ayanda Ncube",
    initials: "AN",
    grade: "Grade C",
    site: "Metsi Midrand Depot",
    post: "Contractor access",
    time: "Sat · 06:00–18:00",
    state: "confirmed",
    detail: "Shift confirmed · Site induction current · Equipment list prepared",
  },
  {
    id: "TS-1048",
    officer: "Sibusiso Dlamini",
    initials: "SD",
    grade: "Grade C",
    site: "Eastline Linbro Yard",
    post: "Vehicle gate",
    time: "20 Aug · 18:00–06:00",
    state: "attention",
    detail: "11-minute checkout variance requires supervisor review",
  },
];

const navItems = ["Control", "Roster", "Officers", "Clients", "Incidents", "Compliance"];

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

export default function Home() {
  const [activeNav, setActiveNav] = useState("Control");
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const currentShifts = useMemo(() => shifts.filter((shift) => shift.state === "on-post" || shift.state === "confirmed"), []);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3200);
  }

  return (
    <main className="app-shell">
      <aside className="side-rail">
        <div className="brand-lockup">
          <img src="/lokd-logo.svg" alt="LOKD" />
        </div>

        <div className="pilot-chip">
          <span className="pulse-dot" />
          <span>
            <strong>Johannesburg pilot</strong>
            Phase 1 · Internal preview
          </span>
        </div>

        <nav aria-label="LOKD operations">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => (
            <button
              className={activeNav === item ? "nav-item nav-item--active" : "nav-item"}
              key={item}
              onClick={() => {
                setActiveNav(item);
                if (item !== "Control") flash(`${item} workspace is being assembled next.`);
              }}
            >
              <span>{item}</span>
              {item === "Incidents" && <em>1</em>}
              {item === "Compliance" && <em className="nav-warning">2</em>}
            </button>
          ))}
        </nav>

        <div className="rail-footer">
          <div className="avatar avatar--dark">Z</div>
          <span>
            <strong>Operations</strong>
            Responsible director
          </span>
          <button aria-label="Open account menu">•••</button>
        </div>
      </aside>

      <section className="main-stage">
        <header className="top-bar">
          <div className="mobile-brand"><img src="/lokd-logo.svg" alt="LOKD" /></div>
          <div className="breadcrumb"><span>Operations</span><b>/</b><strong>{activeNav}</strong></div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Search">⌕</button>
            <button className="icon-button notification-button" aria-label="Notifications"><span className="notification-dot" />◦</button>
            <button className="primary-button" onClick={() => flash("New shift draft opened.")}><span>＋</span> Create shift</button>
          </div>
        </header>

        <div className="page-content">
          <div className="preview-banner">
            <strong>Pilot preview</strong>
            Demo activity only. Live deployment and client billing remain locked until the organisation launch checklist is approved.
          </div>

          <section className="hero-copy">
            <div>
              <p className="eyebrow">Friday · 21 August · 14:35 SAST</p>
              <h1>Every contracted post is covered.</h1>
              <p className="hero-subtitle">One timesheet variance needs review before payroll closes.</p>
            </div>
            <div className="hero-actions">
              <button className="secondary-button" onClick={() => flash("Daily operations report prepared.")}>Export daily report</button>
              <button className="primary-button primary-button--light" onClick={() => setSelectedShift(shifts[3])}>Review variance</button>
            </div>
          </section>

          <section className="coverage-panel" aria-labelledby="coverage-title">
            <div className="coverage-summary">
              <div className="coverage-heading">
                <span className="live-label"><i /> Live operations</span>
                <span>Contracted coverage only</span>
              </div>
              <h2 id="coverage-title">2 of 2 scheduled shifts covered today</h2>
              <p>All assigned officers are directly employed, verified and operating inside the approved unarmed pilot scope.</p>
              <div className="coverage-stats">
                <div><strong>1</strong><span>On post</span></div>
                <div><strong>1</strong><span>Starts by 18:00</span></div>
                <div><strong>0</strong><span>Unfilled</span></div>
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
                <div><p className="eyebrow">Operational roster</p><h2>Current and next shifts</h2></div>
                <button onClick={() => { setActiveNav("Roster"); flash("Roster workspace is being assembled next."); }}>View roster →</button>
              </div>
              <div className="shift-list">
                {currentShifts.map((shift) => (
                  <button className="shift-row" key={shift.id} onClick={() => setSelectedShift(shift)}>
                    <div className="avatar">{shift.initials}</div>
                    <div className="shift-person"><strong>{shift.officer}</strong><span>{shift.grade} · {shift.id}</span></div>
                    <div className="shift-site"><strong>{shift.site}</strong><span>{shift.post}</span></div>
                    <div className="shift-time"><strong>{shift.time}</strong><span><StatusDot state={shift.state} /> {shift.state === "on-post" ? "On post" : "Confirmed"}</span></div>
                    <span className="row-arrow">›</span>
                  </button>
                ))}
              </div>
            </article>

            <aside className="panel panel--attention">
              <div className="panel-heading">
                <div><p className="eyebrow eyebrow--amber">Needs action</p><h2>Before payroll closes</h2></div>
                <span className="count-badge">1</span>
              </div>
              <button className="attention-card" onClick={() => setSelectedShift(shifts[3])}>
                <div className="attention-icon">!</div>
                <div><strong>Review checkout variance</strong><p>Actual presence is 12h11m. Payable hours remain 12h pending supervisor review.</p><span>TS-1048 · Eastline Linbro Yard</span></div>
              </button>
              <div className="clean-state">
                <span>✓</span>
                <div><strong>Everything else is clean</strong><p>No uncovered shifts, expired credentials or priority incidents.</p></div>
              </div>
            </aside>
          </section>

          <footer className="status-footer">
            <span><i /> All systems operational</span>
            <span>Last reconciled 14:32 · Evidence vault synced</span>
          </footer>
        </div>
      </section>

      {selectedShift && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={() => setSelectedShift(null)}>
          <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="shift-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-topline"><span className="detail-id">{selectedShift.id}</span><button onClick={() => setSelectedShift(null)} aria-label="Close details">×</button></div>
            <p className="eyebrow">{selectedShift.id.startsWith("TS") ? "Timesheet control record" : "Shift control record"}</p>
            <h2 id="shift-title">{selectedShift.officer}</h2>
            <p className="drawer-subtitle">{selectedShift.grade} · {selectedShift.time}</p>
            <div className={`detail-status detail-status--${selectedShift.state}`}><StatusDot state={selectedShift.state} />{selectedShift.state === "on-post" ? "Officer is on post" : selectedShift.state === "confirmed" ? "Shift confirmed" : "Supervisor action required"}</div>
            <dl className="detail-list">
              <div><dt>Client site</dt><dd>{selectedShift.site}</dd></div>
              <div><dt>Assigned post</dt><dd>{selectedShift.post}</dd></div>
              <div><dt>Control evidence</dt><dd>{selectedShift.detail}</dd></div>
              <div><dt>Service type</dt><dd>Unarmed fixed-site guarding</dd></div>
            </dl>
            <div className="drawer-timeline">
              <h3>Connected control trail</h3>
              <div><i className="done" /><span><strong>Officer eligibility passed</strong><small>Direct employee · PSiRA verified · Rest rules clear</small></span></div>
              <div><i className="done" /><span><strong>Assignment confirmed</strong><small>Recorded against officer, site and approved post order</small></span></div>
              <div><i className={selectedShift.state === "attention" ? "pending" : "done"} /><span><strong>{selectedShift.state === "attention" ? "Timesheet decision outstanding" : "Attendance evidence current"}</strong><small>{selectedShift.detail}</small></span></div>
            </div>
            <div className="drawer-actions">
              <button className="secondary-button" onClick={() => flash("Control record exported.")}>Export record</button>
              <button className="primary-button" onClick={() => { flash("Supervisor decision recorded."); setSelectedShift(null); }}>Acknowledge</button>
            </div>
          </aside>
        </div>
      )}

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}
