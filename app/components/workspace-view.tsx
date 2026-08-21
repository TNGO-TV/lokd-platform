"use client";

import { useState } from "react";

const officers = [
  { name: "Thabo Mokoena", ref: "LKD-001", grade: "Grade A", status: "Approved", services: "Unarmed · Armed · VIP", preference: "All offer alerts on", sites: "All pilot sites", tone: "green" },
  { name: "Lerato Khumalo", ref: "LKD-002", grade: "Grade B", status: "On booking", services: "Unarmed · Armed", preference: "Unarmed on · Armed off", sites: "Rosebank · Midrand", tone: "blue" },
  { name: "Sibusiso Dlamini", ref: "LKD-003", grade: "Grade B", status: "Offer accepted", services: "Unarmed · Armed", preference: "Armed offers on", sites: "Linbro", tone: "blue" },
  { name: "Ayanda Ncube", ref: "LKD-004", grade: "Grade C", status: "Approved", services: "Unarmed", preference: "Unarmed offers on", sites: "Rosebank · Midrand", tone: "green" },
  { name: "Kabelo Maseko", ref: "LKD-005", grade: "Grade C", status: "Approval hold", services: "Unarmed", preference: "Offers blocked", sites: "Offers blocked", tone: "red" },
];

const workspaceCopy: Record<string, { eyebrow: string; title: string; subtitle: string; action: string }> = {
  Bookings: { eyebrow: "Pre-funded client demand", title: "Booking control", subtitle: "The full contract term is secured before a booking can release officer offers.", action: "Create booking" },
  Offers: { eyebrow: "Uber-style allocation", title: "Offer engine", subtitle: "Grade, service qualification, preference, area and availability must all match.", action: "Release offer wave" },
  Officers: { eyebrow: "Approved officer network", title: "Officer approval", subtitle: "PSiRA grade is verified separately from Armed, Unarmed and VIP eligibility and offer choices.", action: "Invite officer" },
  Clients: { eyebrow: "Contracted service", title: "Clients and sites", subtitle: "Clients choose Armed, Unarmed or VIP, pay the term in full, then follow delivery.", action: "Add client" },
  Wallets: { eyebrow: "Officer payable ledger", title: "Wallets and settlements", subtitle: "Up to 3 months releases weekly; longer contracts release monthly before withdrawal.", action: "Prepare Thursday batch" },
};

function Top({ name, onAction }: { name: string; onAction: () => void }) {
  const copy = workspaceCopy[name];
  return (
    <section className="workspace-top">
      <div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.subtitle}</p></div>
      <button className="primary-button" onClick={onAction}><span>＋</span>{copy.action}</button>
    </section>
  );
}

export default function WorkspaceView({ name }: { name: string }) {
  const [message, setMessage] = useState("");
  const action = () => { setMessage(`${workspaceCopy[name].action} draft created in preview mode.`); window.setTimeout(() => setMessage(""), 2800); };

  return (
    <div className="workspace-view">
      <Top name={name} onAction={action} />
      {name === "Bookings" && <Bookings />}
      {name === "Offers" && <Offers />}
      {name === "Officers" && <Officers />}
      {name === "Clients" && <Clients />}
      {name === "Wallets" && <Wallets />}
      {message && <div className="inline-notice">✓ {message}</div>}
    </div>
  );
}

function Bookings() {
  const items = [
    { id: "BK-2081", client: "Northbridge Property Services", site: "Rosebank Offices", price: "R34,800", time: "1 month · Weekly release", service: "Unarmed", officer: "Lerato Khumalo", state: "Active", offer: "Grade B · Unarmed opted in" },
    { id: "BK-2082", client: "Eastline Freight Solutions", site: "Linbro Yard", price: "R134,400", time: "3 months · Weekly release", service: "Armed", officer: "Sibusiso Dlamini", state: "Staffed", offer: "Grade B · competency verified" },
    { id: "BK-2083", client: "Metsi Industrial Supplies", site: "Midrand Depot", price: "R384,000", time: "6 months · Monthly release", service: "VIP", officer: "Thabo Mokoena", state: "Staffed", offer: "Grade A · VIP verified" },
  ];
  return <section className="workspace-card booking-board"><div className="booking-summary"><div><span>Pre-funded terms</span><strong>R553,200</strong><small>Full client-term value secured</small></div><div><span>Service classes</span><strong>3</strong><small>Unarmed · Armed · VIP</small></div><div><span>Staffing</span><strong>3 / 3</strong><small>All eligibility gates passed</small></div><div><span>Awaiting release</span><strong>1</strong><small>R960 pending weekly cycle</small></div></div><div className="data-head booking-head"><span>Booking</span><span>Client price</span><span>Officer assignment</span><span>Status</span><span /></div>{items.map((item) => <button className="booking-row" key={item.id}><span><strong>{item.id} · {item.site}</strong><small>{item.client} · {item.service} · {item.time}</small></span><span><strong>{item.price}</strong><small>Paid in full · LOKD price</small></span><span><strong>{item.officer}</strong><small>{item.offer}</small></span><span><em className={item.state === "Active" ? "pill tone-green" : "pill tone-blue"}>{item.state}</em></span><b>›</b></button>)}</section>;
}

function Offers() {
  return <div className="offer-engine-layout"><section className="workspace-card offer-wave-card"><div className="card-title"><div><span>Live Unarmed wave</span><strong>Midrand · 1-month access contract</strong></div><em>03:12 remaining</em></div><div className="wave-path"><div className="wave-step done"><i>✓</i><span><strong>Term funded</strong><small>Full client payment secured</small></span></div><div className="wave-step done"><i>✓</i><span><strong>Eligibility pool built</strong><small>Grade + qualification + opt-in + area</small></span></div><div className="wave-step live"><i>2</i><span><strong>Offers delivered</strong><small>Fixed R980 · weekly release</small></span></div><div className="wave-step"><i>•</i><span><strong>Atomic assignment</strong><small>Competing offers expire instantly</small></span></div></div><div className="wave-candidates"><div><span>LK</span><strong>Lerato Khumalo</strong><small>Grade B · Unarmed on · viewed 14:33</small><em className="pill tone-amber">Decision pending</em></div><div><span>TM</span><strong>Thabo Mokoena</strong><small>Grade A · Unarmed on · delivered 14:32</small><em className="pill tone-blue">Not viewed</em></div><div><span>SD</span><strong>Sibusiso Dlamini</strong><small>Qualified, but Unarmed notifications off</small><em className="pill tone-red">Preference blocked</em></div></div></section><aside className="workspace-card offer-rules-card"><div className="card-title"><div><span>Offer snapshot</span><strong>Officer terms</strong></div></div><dl><div><dt>Service</dt><dd>Unarmed</dd></div><div><dt>Minimum grade</dt><dd>Grade C+</dd></div><div><dt>Officer amount</dt><dd>R980 fixed / shift</dd></div><div><dt>Contract term</dt><dd>1 month</dd></div><div><dt>Release cadence</dt><dd>Weekly</dd></div><div><dt>Client funding</dt><dd>Full term secured</dd></div></dl><p>A higher grade may accept lower-grade work when qualified and opted in. Client and officer pricing remain separated.</p></aside></div>;
}

function Wallets() {
  const ledger = [
    { officer: "Lerato Khumalo", source: "BK-2077 · 1 month", pending: "—", available: "R960", state: "Weekly release" },
    { officer: "Lerato Khumalo", source: "BK-2080 · 1 month", pending: "R960", available: "—", state: "Next weekly release" },
    { officer: "Sibusiso Dlamini", source: "BK-2079 · 3 months", pending: "—", available: "R1,020", state: "Weekly release" },
    { officer: "Thabo Mokoena", source: "BK-2078 · 6 months", pending: "R980", available: "—", state: "Next monthly release" },
  ];
  return <div className="wallet-layout"><section className="workspace-card wallet-ops"><div className="booking-summary wallet-summary"><div><span>Pending</span><strong>R1,940</strong><small>Waiting for weekly/monthly release</small></div><div><span>Available</span><strong>R1,980</strong><small>Can enter Thursday batch</small></div><div><span>Held</span><strong>R0</strong><small>No active disputes</small></div></div><div className="data-head wallet-head"><span>Officer</span><span>Source</span><span>Pending</span><span>Available</span><span>Release</span></div>{ledger.map((item) => <div className="wallet-ledger-row" key={item.source}><span><strong>{item.officer}</strong><small>Approved officer</small></span><span><strong>{item.source}</strong><small>Immutable earning entry</small></span><span>{item.pending}</span><span>{item.available}</span><em>{item.state}</em></div>)}</section><aside className="workspace-card thursday-card"><span>Thursday withdrawal cycle</span><h2>R1,980 ready</h2><p>Only released Available earnings can enter the controlled batch for expected Friday bank clearance.</p><div className="cutoff"><span>Short contracts</span><strong>0–3 months · Weekly</strong></div><div className="cutoff"><span>Long contracts</span><strong>Over 3 months · Monthly</strong></div><div className="cutoff"><span>Expected clearance</span><strong>Friday · Bank dependent</strong></div><button>Prepare payout batch</button><small>Maker/checker approval required before submission.</small><div className="future-card-note"><strong>LOKD Card · future layer</strong><p>Optional payout destination through a licensed banking partner; not part of Phase 1.</p></div></aside></div>;
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

function Officers() {
  return (
    <section className="workspace-card data-card">
      <div className="filter-row"><button className="filter-active">All officers <b>5</b></button><button>Approved <b>4</b></button><button>On hold <b>1</b></button><span /><input aria-label="Search officers" placeholder="Search officer" /></div>
      <div className="data-head"><span>Officer</span><span>Grade verification</span><span>Service eligibility & choices</span><span>Status</span><span /></div>
      {officers.map((officer) => <button className="data-row" key={officer.ref}><span className="person-cell"><i>{officer.name.split(" ").map((part) => part[0]).join("")}</i><span><strong>{officer.name}</strong><small>{officer.ref} · {officer.sites}</small></span></span><span><strong>{officer.grade} · Verified</strong><small>PSiRA •••• {officer.ref === "LKD-005" ? "6081" : "1842"}</small></span><span><strong>{officer.services}</strong><small>{officer.preference}</small></span><span><em className={`pill tone-${officer.tone}`}>{officer.status}</em></span><span>›</span></button>)}
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
