"use client";

import {useState} from "react";
import {readWorkspaceResponse,workspaceFailure} from "./workspace-request";
import {clientEnquiriesResponse} from "../lib/workspace-response-contracts";

export type ClientEnquiry = {
  id: string;
  organisationName: string;
  contactName: string;
  email: string;
  mobile: string | null;
  siteArea: string;
  siteType: string;
  requiredStart: string;
  serviceType: string;
  message: string;
  status: "new" | "triaged" | "closed";
  ownerId: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  engagementModel?: string | null;
  noticeWindow?: string | null;
  calendarType?: string | null;
  riskBand?: string | null;
  bookingDetails?: string | null;
  internalDraftPrice?: string | null;
  siteAddress?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  officers?: number | null;
  schedule?: string | null;
};

type EnquiriesResponse = {enquiries:ClientEnquiry[]};

function bookingDetailResponse(value: unknown) {
  if (!clientEnquiriesResponse(value) || !value || typeof value !== "object" || !("enquiries" in value) || !Array.isArray(value.enquiries)) return false;
  return value.enquiries.every((row: unknown) => {
    if (!row || typeof row !== "object") return false;
    const fields = row as Record<string, unknown>;
    return ["engagementModel", "noticeWindow", "calendarType", "riskBand", "bookingDetails", "internalDraftPrice", "siteAddress", "startDate", "endDate", "startTime", "endTime", "schedule"].every(key => fields[key] === null || typeof fields[key] === "string")
      && (fields.officers === null || typeof fields.officers === "number" && Number.isSafeInteger(fields.officers));
  });
}

function BookingEnquiryDetail({ item, open = false }: { item: ClientEnquiry; open?: boolean }) {
  if (!item.engagementModel) return null;
  const parse = (value: string | null | undefined): Record<string, unknown> => {
    try { const parsed: unknown = JSON.parse(value ?? "null"); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; }
  };
  const intent = parse(item.bookingDetails), draft = parse(item.internalDraftPrice);
  const total = typeof draft.totalCents === "number" && Number.isSafeInteger(draft.totalCents) && draft.totalCents >= 0
    ? new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(draft.totalCents / 100) : null;
  return <details className="booking-ops-detail" open={open}><summary>Booking request details</summary>
    <dl><div><dt>Engagement</dt><dd>{item.engagementModel === "fixed" ? "LOKD Fixed" : "LOKD Flex"}</dd></div>
      <div><dt>Notice window</dt><dd>{item.noticeWindow}</dd></div><div><dt>Calendar type</dt><dd>{item.calendarType}</dd></div>
      <div><dt>Provisional risk band</dt><dd>{item.riskBand}</dd></div>
      <div><dt>Term</dt><dd>{intent.term === "single" ? "Single shift" : String(intent.term) + " months"}</dd></div>
      <div><dt>Roster</dt><dd>{item.schedule}</dd></div><div><dt>Dates</dt><dd>{item.startDate} to {item.endDate}</dd></div>
      <div><dt>Shift (SAST)</dt><dd>{item.startTime}–{item.endTime} · 12 hours</dd></div>
      <div><dt>Officers per shift</dt><dd>{item.officers}</dd></div><div><dt>Site address</dt><dd>{item.siteAddress}</dd></div>
    </dl><p><strong>Internal draft price: {total ?? "Pricing review required"}</strong></p>
    <p>Operations only. Review the site risk, officer availability and scope before confirming officers and the price with the client. This draft is not a confirmed booking.</p>
    {typeof draft.version === "string" && <small>Price book: {draft.version}</small>}
  </details>;
}

// Mount only on the Operations intake detail. Client records never contain draft prices.
export function OperationsBookingEnquiryDetail({ id }: { id: string }) {
  const [item, setItem] = useState<ClientEnquiry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true); setError(""); setItem(null);
    try {
      const response = await fetch("/api/enquiries?id=" + encodeURIComponent(id), { cache: "no-store" });
      const data = await readWorkspaceResponse<EnquiriesResponse>(response, bookingDetailResponse);
      const match = data.enquiries.find(row => row.id === id);
      if (!match?.engagementModel) throw new Error("No booking request details are available for this enquiry.");
      setItem(match);
    } catch (cause) { setError(workspaceFailure(cause, "The booking request could not be loaded.")); }
    finally { setBusy(false); }
  }
  return <section aria-label="Operations booking detail"><button type="button" disabled={busy} onClick={() => void load()}>{busy ? "Loading booking details…" : item ? "Refresh booking details" : "View booking request and internal draft"}</button>
    {error && <p role="alert">{error}</p>}{item && <BookingEnquiryDetail item={item} open />}
  </section>;
}
