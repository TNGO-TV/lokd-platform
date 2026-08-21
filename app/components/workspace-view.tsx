"use client";

import { useState } from "react";

const officers = [
  { name: "Thabo Mokoena", ref: "LKD-001", grade: "Grade A", status: "Approved", sites: "All pilot sites", tone: "green" },
  { name: "Lerato Khumalo", ref: "LKD-002", grade: "Grade C", status: "On booking", sites: "Rosebank", tone: "blue" },
  { name: "Sibusiso Dlamini", ref: "LKD-003", grade: "Grade C", status: "Offer accepted", sites: "Linbro", tone: "blue" },
  { name: "Ayanda Ncube", ref: "LKD-004", grade: "Grade C", status: "Approved", sites: "Rosebank · Midrand", tone: "green" },
  { name: "Kabelo Maseko", ref: "LKD-005", grade: "Grade C", status: "Approval hold", sites: "Offers blocked", tone: "red" },
];

const workspaceCopy: Record<string, { eyebrow: string; title: string; subtitle: string; action: string }> = {
  Bookings: { eyebrow: "Client demand", title: "Booking control", subtitle: "Every confirmed booking becomes one or more officer offer slots.", action: "Create booking" },
  Offers: { eyebrow: "Uber-style allocation", title: "Offer engine", subtitle: "Fixed offers go only to approved, eligible officers; first valid acceptance claims the slot.", action: "Release offer wave" },
  Officers: { eyebrow: "Approved officer network", title: "Officer approval", subtitle: "Applications, PSiRA status, grades, service areas and offer eligibility in one view.", action: "Invite officer" },
  Clients: { eyebrow: "Contracted service", title: "Clients and sites", subtitle: "Coverage is measured against approved service windows, not 24-hour calendar time.", action: "Add client" },
  Wallets: { eyebrow: "Officer payable ledger", title: "Wallets and settlements", subtitle: "Pending earnings release on sign-off or contract expiry, then enter the Thursday payout cycle.", action: "Prepare Thursday batch" },
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
    { id: "BK-2081", client: "Northbridge Property Services", site: "Rosebank Offices", price: "R1,740", time: "Today · 06:00–18:00", officer: "Lerato Khumalo", state: "Active", offer: "R960 accepted" },
    { id: "BK-2082", client: "Eastline Freight Solutions", site: "Linbro Yard", price: "R1,860", time: "Today · 18:00–06:00", officer: "Sibusiso Dlamini", state: "Staffed", offer: "R1,020 accepted" },
    { id: "BK-2083", client: "Metsi Industrial Supplies", site: "Midrand Depot", price: "R1,800", time: "Sat · 06:00–18:00", officer: "Ayanda Ncube", state: "Staffed", offer: "R980 accepted" },
  ];
  return <section className="workspace-card booking-board"><div className="booking-summary"><div><span>Confirmed value</span><strong>R5,400</strong><small>Client-facing LOKD price</small></div><div><span>Officer offers</span><strong>R2,960</strong><small>Accepted fixed amounts</small></div><div><span>Staffing</span><strong>3 / 3</strong><small>All slots claimed</small></div><div><span>Awaiting sign-off</span><strong>1</strong><small>R960 pending wallet release</small></div></div><div className="data-head booking-head"><span>Booking</span><span>Client price</span><span>Officer assignment</span><span>Status</span><span /></div>{items.map((item) => <button className="booking-row" key={item.id}><span><strong>{item.id} · {item.site}</strong><small>{item.client} · {item.time}</small></span><span><strong>{item.price}</strong><small>LOKD service price</small></span><span><strong>{item.officer}</strong><small>{item.offer}</small></span><span><em className={item.state === "Active" ? "pill tone-green" : "pill tone-blue"}>{item.state}</em></span><b>›</b></button>)}</section>;
}

function Offers() {
  return <div className="offer-engine-layout"><section className="workspace-card offer-wave-card"><div className="card-title"><div><span>Live wave</span><strong>Midrand Saturday access shift</strong></div><em>03:12 remaining</em></div><div className="wave-path"><div className="wave-step done"><i>✓</i><span><strong>Booking confirmed</strong><small>Client price R1,800 secured</small></span></div><div className="wave-step done"><i>✓</i><span><strong>Eligibility pool built</strong><small>3 approved officers passed 9 rules</small></span></div><div className="wave-step live"><i>3</i><span><strong>Offers delivered</strong><small>Fixed R980 · first valid acceptance claims slot</small></span></div><div className="wave-step"><i>•</i><span><strong>Atomic assignment</strong><small>Competing offers expire instantly</small></span></div></div><div className="wave-candidates"><div><span>AN</span><strong>Ayanda Ncube</strong><small>Viewed 14:33</small><em className="pill tone-amber">Decision pending</em></div><div><span>TM</span><strong>Thabo Mokoena</strong><small>Delivered 14:32</small><em className="pill tone-blue">Not viewed</em></div><div><span>SD</span><strong>Sibusiso Dlamini</strong><small>Unavailable after 18:00 booking</small><em className="pill tone-red">Rule blocked</em></div></div></section><aside className="workspace-card offer-rules-card"><div className="card-title"><div><span>Offer snapshot</span><strong>Officer terms</strong></div></div><dl><div><dt>Officer amount</dt><dd>R980 fixed</dd></div><div><dt>Hours</dt><dd>12 scheduled</dd></div><div><dt>Release policy</dt><dd>Per-shift sign-off</dd></div><div><dt>Fallback release</dt><dd>Booking term expiry</dd></div><div><dt>Cancellation</dt><dd>Version 1.2</dd></div></dl><p>The officer never sees the client price. The client never sees the officer offer.</p></aside></div>;
}

function Wallets() {
  const ledger = [
    { officer: "Lerato Khumalo", source: "BK-2077 · Rosebank", pending: "—", available: "R960", state: "Available" },
    { officer: "Lerato Khumalo", source: "BK-2080 · Rosebank", pending: "R960", available: "—", state: "Client sign-off" },
    { officer: "Sibusiso Dlamini", source: "BK-2079 · Linbro", pending: "—", available: "R1,020", state: "Available" },
    { officer: "Ayanda Ncube", source: "BK-2078 · Midrand", pending: "R980", available: "—", state: "Contract end" },
  ];
  return <div className="wallet-layout"><section className="workspace-card wallet-ops"><div className="booking-summary wallet-summary"><div><span>Pending</span><strong>R1,940</strong><small>Not withdrawable</small></div><div><span>Available</span><strong>R1,980</strong><small>Can enter Thursday batch</small></div><div><span>Held</span><strong>R0</strong><small>No active disputes</small></div></div><div className="data-head wallet-head"><span>Officer</span><span>Source</span><span>Pending</span><span>Available</span><span>Release</span></div>{ledger.map((item) => <div className="wallet-ledger-row" key={item.source}><span><strong>{item.officer}</strong><small>Approved officer</small></span><span><strong>{item.source}</strong><small>Immutable earning entry</small></span><span>{item.pending}</span><span>{item.available}</span><em>{item.state}</em></div>)}</section><aside className="workspace-card thursday-card"><span>Thursday cycle</span><h2>R1,980 ready</h2><p>Withdrawal requests lock into the controlled batch on Thursday for expected Friday bank clearance.</p><div className="cutoff"><span>Cut-off</span><strong>Thu · 14:00 SAST</strong></div><div className="cutoff"><span>Expected clearance</span><strong>Fri · Bank dependent</strong></div><button>Prepare payout batch</button><small>Maker/checker approval required before submission.</small></aside></div>;
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
      <div className="data-head"><span>Employee</span><span>Verification</span><span>Site eligibility</span><span>Status</span><span /></div>
      {officers.map((officer) => <button className="data-row" key={officer.ref}><span className="person-cell"><i>{officer.name.split(" ").map((part) => part[0]).join("")}</i><span><strong>{officer.name}</strong><small>{officer.ref} · Registered profile</small></span></span><span><strong>{officer.grade} · Verified</strong><small>PSiRA •••• {officer.ref === "LKD-005" ? "6081" : "1842"}</small></span><span><strong>{officer.sites}</strong><small>{officer.ref === "LKD-004" ? "Linbro induction pending" : "Offer rules current"}</small></span><span><em className={`pill tone-${officer.tone}`}>{officer.status}</em></span><span>›</span></button>)}
    </section>
  );
}

function Clients() {
  const clients = [
    { client: "Northbridge Property Services", site: "Rosebank Offices", window: "Selected weekdays · 06:00–18:00", state: "On post", meta: "Visitor verification · Badge register · Delivery log" },
    { client: "Eastline Freight Solutions", site: "Linbro Yard", window: "Selected nights · 18:00–06:00", state: "Starts 18:00", meta: "Vehicle gate · Authorised-entry list · Perimeter checks" },
    { client: "Metsi Industrial Supplies", site: "Midrand Depot", window: "Saturdays · 06:00–18:00", state: "Sat 06:00", meta: "Contractor access · Delivery records · Exit authorisations" },
  ];
  return <div className="client-grid">{clients.map((item, index) => <article className="workspace-card client-card" key={item.site}><div className="client-card-top"><span>0{index+1}</span><em>{item.state}</em></div><h2>{item.site}</h2><p>{item.client}</p><dl><div><dt>Contracted window</dt><dd>{item.window}</dd></div><div><dt>Post scope</dt><dd>{item.meta}</dd></div><div><dt>Service</dt><dd>Unarmed fixed-site guarding</dd></div></dl><button>Open service record →</button></article>)}</div>;
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
