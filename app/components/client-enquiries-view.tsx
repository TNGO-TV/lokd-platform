"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ClientEnquiry = {
  id: string;
  organisationName: string;
  contactName: string;
  email: string;
  mobile: string | null;
  siteArea: string;
  siteType: string;
  requiredStart: string;
  message: string;
  status: "new" | "triaged" | "closed";
  ownerId: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

const siteTypeLabels: Record<string, string> = {
  commercial_property: "Commercial property",
  logistics_industrial: "Logistics / industrial",
  construction: "Construction",
  residential_estate: "Residential estate",
  education: "Education",
  retail: "Retail",
  other: "Other",
};

const startLabels: Record<string, string> = {
  within_30_days: "Within 30 days",
  one_to_three_months: "1–3 months",
  three_to_six_months: "3–6 months",
  planning: "Early planning",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function ClientEnquiriesView({ flash }: { flash: (message: string) => void }) {
  const [enquiries, setEnquiries] = useState<ClientEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"open" | "new" | "triaged" | "closed">("open");
  const [closingId, setClosingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/enquiries", { cache: "no-store" });
      const payload = await response.json() as { enquiries?: ClientEnquiry[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The enquiry queue could not be loaded.");
      setEnquiries(payload.enquiries ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The enquiry queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/enquiries", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { enquiries?: ClientEnquiry[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "The enquiry queue could not be loaded.");
        return payload.enquiries ?? [];
      })
      .then((items) => { if (active) setEnquiries(items); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "The enquiry queue could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => enquiries.filter((item) => {
    if (filter === "open") return item.status !== "closed";
    return item.status === filter;
  }), [enquiries, filter]);

  const counts = useMemo(() => ({
    new: enquiries.filter((item) => item.status === "new").length,
    triaged: enquiries.filter((item) => item.status === "triaged").length,
    closed: enquiries.filter((item) => item.status === "closed").length,
  }), [enquiries]);

  async function update(item: ClientEnquiry, action: "triage" | "close") {
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch("/api/enquiries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, action, version: item.version, resolution: action === "close" ? resolution : undefined }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "The enquiry could not be updated.");
      setClosingId(null);
      setResolution("");
      await load();
      flash(action === "triage" ? `${item.id} is owned by this Operations account.` : `${item.id} was closed with an audit record.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The enquiry could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  return <>
    <section className="command-heading enquiry-queue-heading">
      <div><p className="eyebrow">Authenticated Operations intake</p><h1>Client enquiries</h1><p>Public site briefs only. No enquiry creates a quotation, booking, credit facility, officer offer or deployment.</p></div>
      <button className="secondary-button" disabled={loading} onClick={() => void load()}>↻ Refresh queue</button>
    </section>

    <section className="enquiry-queue-summary" aria-label="Client enquiry summary">
      <article><span>New</span><strong>{counts.new}</strong><small>Awaiting an owner</small></article>
      <article><span>Triaged</span><strong>{counts.triaged}</strong><small>Owned by Operations</small></article>
      <article><span>Closed</span><strong>{counts.closed}</strong><small>Resolution recorded</small></article>
      <article className="enquiry-zero-credit"><span>Commercial boundary</span><strong>0 days</strong><small>Cleared advance funding only</small></article>
    </section>

    <section className="enquiry-queue-panel">
      <header><div><strong>Controlled launch queue</strong><span>Prelaunch · user submitted</span></div><nav aria-label="Filter enquiries">{(["open", "new", "triaged", "closed"] as const).map((value) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value}</button>)}</nav></header>
      {error && <p className="command-error-inline" role="alert">{error}</p>}
      {loading ? <div className="enquiry-queue-empty"><span className="pulse-dot" /><strong>Loading the signed-in queue…</strong></div>
        : visible.length === 0 ? <div className="enquiry-queue-empty"><span>✓</span><strong>No {filter} enquiries.</strong><p>The queue stays separate from bookings and deployment controls.</p></div>
          : <div className="enquiry-queue-list">{visible.map((item) => <article className={`enquiry-queue-card status-${item.status}`} key={item.id}>
            <header><div><span>{item.id}</span><h2>{item.organisationName}</h2><p>{item.contactName} · {item.email}{item.mobile ? ` · ${item.mobile}` : ""}</p></div><em>{item.status}</em></header>
            <dl><div><dt>Area</dt><dd>{item.siteArea}</dd></div><div><dt>Site</dt><dd>{siteTypeLabels[item.siteType] ?? item.siteType}</dd></div><div><dt>Window</dt><dd>{startLabels[item.requiredStart] ?? item.requiredStart}</dd></div><div><dt>Received</dt><dd>{formatDate(item.createdAt)} SAST</dd></div></dl>
            <blockquote>{item.message}</blockquote>
            {item.ownerId && <p className="enquiry-owner">Owner: <strong>{item.ownerId}</strong></p>}
            {item.resolution && <p className="enquiry-resolution"><strong>Resolution</strong>{item.resolution}</p>}
            {item.status !== "closed" && <footer>
              {item.status === "new" && <button disabled={busyId === item.id} onClick={() => void update(item, "triage")}>Take ownership</button>}
              <button className="secondary" disabled={busyId === item.id} onClick={() => { setClosingId(closingId === item.id ? null : item.id); setResolution(""); }}>Close with outcome</button>
            </footer>}
            {closingId === item.id && <div className="enquiry-close-panel"><label><span>Resolution note</span><textarea value={resolution} minLength={3} maxLength={600} onChange={(event) => setResolution(event.target.value)} placeholder="Record the outcome, next route, or reason the request is out of scope." /></label><div><button onClick={() => { setClosingId(null); setResolution(""); }}>Cancel</button><button disabled={resolution.trim().length < 3 || busyId === item.id} onClick={() => void update(item, "close")}>{busyId === item.id ? "Saving…" : "Record and close"}</button></div></div>}
          </article>)}</div>}
    </section>
  </>;
}
