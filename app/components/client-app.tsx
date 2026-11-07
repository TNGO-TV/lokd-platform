'use client';

import Link from 'next/link';
import { bookingModelLabel } from '../lib/booking-models';
import { ClientOfficerRoute } from './zone-location-sharing';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { ClientBooking, ClientRequest, ClientShift, ClientSite, ClientWorkspace } from '../lib/booking-client-types';
import BookingFinancePanel from './booking-finance-panel';
import ZoneCoverForm from './zone-cover-form';
import { ClientZoneHome, ClientContracts } from './client-zone-views';
import { InitialsAvatar, ZoneHeading } from './zone-ui';
import { bookingStage } from '../lib/zone-booking';

const money = (cents: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
const label = (value: string) => value.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());
const date = (value: string | null, time = false) => {
  if (!value) return 'Not recorded';
  const parsed = new Date(value.length === 10 ? value + 'T12:00:00+02:00' : value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', ...(time ? { timeStyle: 'short' as const } : {}) }).format(parsed) : 'Not recorded';
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function workspace(value: unknown): value is ClientWorkspace {
  return record(value) && ['enquiries', 'sites', 'requests', 'bookings', 'shifts', 'notifications'].every(key => Array.isArray(value[key])) && (value.account === null || record(value.account)) && typeof value.cancellationPolicy === 'string';
}
async function responseBody(response: Response) {
  let value: unknown;
  try { value = await response.json(); } catch { throw new Error('The response could not be read. Refresh to check the latest status.'); }
  if (!response.ok) throw new Error(record(value) && typeof value.error === 'string' ? value.error : 'Your request could not be completed. Please try again.');
  return value;
}
type Send = (body: Record<string, unknown>, message: string, endpoint?: string) => Promise<boolean>;

export default function ClientApp() {
  const params = useSearchParams();
  const view = params.get('view') ?? 'home';
  const [data, setData] = useState<ClientWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0), locked = useRef(false);
  const load = useCallback(async (quiet = false) => {
    const current = ++generation.current;
    if (!quiet) setLoading(true);
    try {
      const value = await responseBody(await fetch('/api/client-bookings', { cache: 'no-store', credentials: 'same-origin' }));
      if (!workspace(value)) throw new Error('Your account could not be loaded. Please refresh.');
      if (current === generation.current) { setData(value); setError(''); }
    } catch (cause) {
      if (current === generation.current) { setData(null); setError(cause instanceof Error ? cause.message : 'Your account could not be loaded.'); }
    } finally { if (current === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const requests = generation;
    const initial = setTimeout(() => void load(), 0);
    const interval = setInterval(() => { if (!locked.current && document.visibilityState === 'visible') void load(true); }, 30_000);
    return () => { clearTimeout(initial); clearInterval(interval); requests.current++; };
  }, [load]);
  const send: Send = async (body, message, endpoint = '/api/client-bookings') => {
    if (locked.current) return false;
    locked.current = true; generation.current++; setBusy(true); setError(''); setNotice('');
    try {
      const value = await responseBody(await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
      if (!record(value) || value.ok !== true) throw new Error('The update could not be confirmed. Refresh to check before trying again.');
      setNotice(message + (record(value.emailDelivery) && Array.isArray(value.emailDelivery.errors) && value.emailDelivery.errors.length ? ' ' + value.emailDelivery.errors.filter((entry): entry is string => typeof entry === 'string').join(' ') : ''));
      await load(true);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The update could not be confirmed. Refresh to check before trying again.');
      return false;
    } finally { locked.current = false; setBusy(false); }
  };
  if (view === 'invoices') return <BookingFinancePanel />;
  return <div className="client-screen">
    <div className="client-heading" hidden={['home', 'request', 'contracts'].includes(view)}><div><p className="client-kicker">LOKD Zone</p><h1>{view === 'account' ? 'Zone' : view === 'bookings' ? 'Your bookings' : view === 'reports' ? 'Shift reports' : view === 'updates' ? 'Your updates' : 'Client Zone'}</h1><p>{data?.account?.organisationName ?? 'Manage your security services in one place.'}</p></div><button className="client-secondary" disabled={loading || busy} onClick={() => void load()}>Refresh</button></div>
    {error && <div className="client-alert" role="alert"><p>{error}</p><button className="client-secondary" disabled={busy || loading} onClick={() => void load()}>Reload account</button></div>}
    {notice && <p className="client-notice" role="status">{notice}</p>}
    {loading && !data && <p role="status">Loading your account…</p>}
    {data && <>
      {data.notifications.length > 0 && <section className="client-panel client-email-status" aria-label="Email delivery"><h2>Your emails</h2><ul>{data.notifications.map(notification => <li key={notification.id}><strong>{notification.subject}</strong><span>{notification.error || label(notification.state)}</span></li>)}</ul>{data.notifications.some(notification => ['queued', 'blocked', 'retry_wait'].includes(notification.state)) && <button className="client-secondary" disabled={busy} onClick={() => void send({ action: 'retry_notifications' }, 'Email delivery checked. Any unsent messages are listed here.')}>Retry unsent emails</button>}</section>}
      {view === 'account' ? <Account data={data} busy={busy} send={send} /> : view === 'request' ? <ZoneCoverForm sites={data.sites} busy={busy} send={send} initialCover={['bolt','flex','fixed'].includes(params.get('cover')??'') ? params.get('cover') as 'bolt'|'flex'|'fixed' : params.get('cover')==='ongoing'?'fixed':undefined} /> : view === 'home' ? <ClientZoneHome data={data} /> : view === 'contracts' ? <ClientContracts data={data} selectedId={params.get('booking')} busy={busy} send={send} /> : view === 'reports' ? <div className="zone-stack"><ZoneHeading title="Shift reports" detail="Your completed shifts and service records" icon="report" />{data.shifts.filter(shift => ['completed', 'verified'].includes(shift.status)).map(shift => <Shift key={shift.id} shift={shift} busy={busy} send={send} />)}{!data.shifts.some(shift => ['completed', 'verified'].includes(shift.status)) && <p>Your reports appear after shifts are completed.</p>}</div> : view === 'updates' ? <Requests requests={data.requests} sites={data.sites} busy={busy} send={send} /> : <>
        {!data.account && <section className="client-panel"><h2>Welcome to LOKD</h2><p>{data.enquiries.length ? 'Your organisation is being reviewed. You can follow your enquiry and save your site details.' : 'Add your organisation and site details to request security cover.'}</p><Link className="client-primary" href="/client?view=account">{data.enquiries.length ? 'View your account' : 'Set up your account'}</Link></section>}
        <div className="client-heading"><h2>Service bookings</h2><Link className="client-primary" href="/client?view=request">Book officers</Link></div>
        {!data.bookings.length && <section className="client-panel client-empty"><h3>No bookings yet</h3><p>Your confirmed services will appear here. Book a shift or plan an ongoing roster for your site.</p></section>}
        <div className="client-card-list">{data.bookings.map(booking => <Booking key={booking.id} booking={booking} shifts={data.shifts.filter(shift => shift.bookingId === booking.id)} busy={busy} send={send} />)}</div>
        <Requests requests={data.requests} sites={data.sites} busy={busy} send={send} />
        {data.bookings.length > 0 && <p className="client-muted">{data.cancellationPolicy}</p>}
      </>}
    </>}
  </div>;
}

function Account({ data, busy, send }: { data: ClientWorkspace; busy: boolean; send: Send }) {
  const requestId = useRef<string | null>(null);
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    requestId.current ??= crypto.randomUUID();
    if (await send({ ...Object.fromEntries(f), action: 'register_account', requestId: requestId.current, privacyConsent: f.get('privacyConsent') === 'on' }, 'Your organisation details have been sent to LOKD.')) requestId.current = null;
  }
  return <div className="client-stack"><div className="zone-actions"><Link className="zone-secondary" href="/client/agreements">Quotes and agreements</Link><Link className="zone-quiet" href="/client?view=invoices">Invoices</Link><Link className="zone-quiet" href="/client?view=updates">Requests and updates</Link></div>
    {data.account && <section className="client-panel"><h2>{data.account.organisationName}</h2><dl className="client-facts"><div><dt>Contact</dt><dd>{data.account.contactName}</dd></div><div><dt>Email</dt><dd>{data.account.email}</dd></div><div><dt>Account status</dt><dd><Status value={data.account.approvalStatus} /></dd></div></dl></section>}
    {!data.account && !data.enquiries.length && <section className="client-panel"><h2>Organisation details</h2><form className="client-form" onSubmit={register}><fieldset disabled={busy}>
      <label>Organisation name<input name="organisationName" required minLength={2} maxLength={120} autoComplete="organization" /></label>
      <label>Contact name<input name="contactName" required minLength={3} maxLength={100} autoComplete="name" /></label>
      <label>Mobile number<input name="mobile" type="tel" required maxLength={24} autoComplete="tel" /></label>
      <label>Site area<input name="siteArea" required minLength={2} maxLength={100} autoComplete="address-level2" /></label>
      <label>Site type<select name="siteType" required defaultValue="commercial_property"><option value="commercial_property">Commercial property</option><option value="residential_estate">Residential estate</option><option value="construction">Construction</option><option value="logistics_industrial">Logistics or industrial</option><option value="education">Education</option><option value="retail">Retail</option><option value="other">Other</option></select></label>
      <label className="client-full">What security do you need?<textarea name="message" required minLength={20} maxLength={2000} rows={4} /></label>
      <label className="client-check client-full"><input type="checkbox" name="privacyConsent" required /><span>I agree that LOKD may use these details to handle my request. I have read the <Link href="/privacy">privacy notice</Link>.</span></label>
    </fieldset><button className="client-primary" disabled={busy}>{busy ? 'Saving…' : 'Save organisation details'}</button></form></section>}
    {data.enquiries.map(enquiry => <section className="client-panel" key={enquiry.id}><div className="client-heading"><h2>{enquiry.details.organisationName}</h2><Status value={enquiry.status} /></div><p>{enquiry.details.message}</p><p className="client-muted">{enquiry.id} · {date(enquiry.createdAt)}</p>{enquiry.note && <p>{enquiry.note}</p>}{!enquiry.accountLinked && <button className="client-primary" disabled={busy} onClick={() => void send({ action: 'claim_enquiry', id: enquiry.id, expectedVersion: enquiry.version }, 'Your enquiry is linked to your account.')}>Link this enquiry</button>}
      {enquiry.accountLinked && enquiry.status !== 'withdrawn' && <details><summary>Update organisation details</summary><form className="client-form" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); void send({ action: 'update_account', id: enquiry.id, expectedVersion: enquiry.version, changes: Object.fromEntries(f) }, 'Your updated details have been sent for review.'); }}><fieldset disabled={busy}><label>Organisation<input name="organisationName" required minLength={2} maxLength={120} defaultValue={enquiry.details.organisationName} /></label><label>Contact name<input name="contactName" required minLength={3} maxLength={100} defaultValue={enquiry.details.contactName} /></label><label>Mobile<input name="mobile" type="tel" maxLength={24} defaultValue={enquiry.details.mobile} /></label><label>Site area<input name="siteArea" required minLength={2} maxLength={100} defaultValue={enquiry.details.siteArea} /></label><label className="client-full">Requirements<textarea name="message" required minLength={20} maxLength={2000} defaultValue={enquiry.details.message} /></label></fieldset><button className="client-primary" disabled={busy}>Save changes</button></form></details>}
    </section>)}
    {(data.account || data.enquiries.some(enquiry => enquiry.accountLinked)) && <section className="client-panel" id="sites"><h2>Your sites</h2>{!data.sites.length && <p>Add the address where you need cover.</p>}{data.sites.map(site => <article className="client-site" key={site.id}><h3>{site.name}</h3><p>{site.address} · {site.area}</p>{site.publicNote && <p><strong>LOKD update: </strong>{site.publicNote}</p>}{site.editable && <details><summary>Edit site</summary><SiteForm key={site.id + ':' + site.version} site={site} busy={busy} send={send} /></details>}</article>)}<details open={!data.sites.length}><summary>Add a site</summary><SiteForm busy={busy} send={send} /></details></section>}
  </div>;
}

function SiteForm({ site, busy, send }: { site?: ClientSite; busy: boolean; send: Send }) {
  const requestId = useRef<string | null>(null), form = useRef<HTMLFormElement>(null);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  function locate() {
    if (!navigator.geolocation) { setLocationError('Location access is unavailable. You can enter the address without coordinates.'); return; }
    setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(position => { const current = form.current; if (current) { (current.elements.namedItem('latitude') as HTMLInputElement).value = String(position.coords.latitude); (current.elements.namedItem('longitude') as HTMLInputElement).value = String(position.coords.longitude); } setLocating(false); }, () => { setLocationError('Your location could not be read. Enter the site address below.'); setLocating(false); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const element = event.currentTarget, f = new FormData(element);
    requestId.current ??= crypto.randomUUID();
    if (await send({ action: 'save_site', requestId: requestId.current, id: site?.id, expectedVersion: site?.version, name: f.get('name'), area: f.get('area'), address: f.get('address'), latitude: f.get('latitude') ? Number(f.get('latitude')) : null, longitude: f.get('longitude') ? Number(f.get('longitude')) : null }, 'Your site has been saved.')) { requestId.current = null; if (!site) element.reset(); }
  }
  return <form className="client-form" ref={form} onSubmit={save}><fieldset disabled={busy}><label>Site name<input name="name" required minLength={2} maxLength={120} defaultValue={site?.name} /></label><label>Area or city<input name="area" required minLength={2} maxLength={100} defaultValue={site?.area} /></label><label className="client-full">Street address<textarea name="address" required minLength={5} maxLength={500} autoComplete="street-address" defaultValue={site?.address} /></label><label>Latitude (optional)<input name="latitude" type="number" min={-90} max={90} step="any" defaultValue={site?.latitude ?? ''} /></label><label>Longitude (optional)<input name="longitude" type="number" min={-180} max={180} step="any" defaultValue={site?.longitude ?? ''} /></label></fieldset>{locationError && <p role="alert">{locationError}</p>}<div className="client-actions"><button type="button" className="client-secondary" onClick={locate} disabled={busy || locating}>{locating ? 'Finding your location…' : 'Use my current location'}</button><button className="client-primary" disabled={busy || locating}>Save site</button></div></form>;
}

function CoverForm(props: { sites: ClientSite[]; busy: boolean; send: Send; request?: ClientRequest }) { return <ZoneCoverForm {...props} />; }

function Requests({ requests, sites, busy, send }: { requests: ClientRequest[]; sites: ClientSite[]; busy: boolean; send: Send }) {
  const visible = requests.filter(request => request.category !== 'client_site');
  if (!visible.length) return null;
  return <section className="client-stack"><h2>Your requests</h2>{visible.map(request => <article className="client-panel" key={request.id}><div className="client-heading"><h3>{request.summary}</h3><Status value={request.status} /></div><p className="client-muted">{date(request.createdAt)} · {request.id}</p>{typeof request.detail.note === 'string' && <p>{request.detail.note}</p>}{typeof request.detail.publicNote === 'string' && <p><strong>LOKD update: </strong>{request.detail.publicNote}</p>}{request.category === 'booking_request' && request.status === 'open' && <details><summary>Change or cancel request</summary><CoverForm key={request.id + ':' + request.version} sites={sites} busy={busy} send={send} request={request} /><ReasonForm label="Cancel request" busy={busy} submit={reason => send({ action: 'cancel_request', id: request.id, expectedVersion: request.version, reason }, 'Your request has been cancelled.')} /></details>}</article>)}</section>;
}
function Booking({ booking, shifts, busy, send }: { booking: ClientBooking; shifts: ClientShift[]; busy: boolean; send: Send }) {
  const requestId = useRef<Record<string, string>>({});
  return <section className="client-panel" id={booking.id}><div className="zone-booking-stage"><InitialsAvatar name={booking.siteName} /><div><strong>{bookingStage(booking.displayStatus)}</strong><p>{bookingModelLabel(booking.engagementModel)}</p></div></div><div className="client-heading"><div><p className="client-kicker">{booking.id}</p><h2>{booking.siteName}</h2></div><Status value={booking.displayStatus ?? booking.status} /></div><dl className="client-facts"><div><dt>Service</dt><dd>{booking.serviceType === 'Unarmed' ? 'Unarmed guarding' : booking.serviceType === 'Armed' ? 'Armed site security' : 'VIP protection'}</dd></div><div><dt>Dates</dt><dd>{date(booking.startDate)} – {date(booking.endDate)}</dd></div><div><dt>Hours</dt><dd>{booking.shiftStart} – {booking.shiftEnd} SAST</dd></div>{booking.priceConfirmed === true && <div><dt>Confirmed total</dt><dd>{money(booking.totalCents)}</dd></div>}<div><dt>Payment</dt><dd>{label(booking.fundingStatus)}</dd></div></dl>
    <h3>Your officer</h3>{!shifts.length && <p>Your officer’s details will appear here once they are assigned.</p>}{shifts.map(shift => <Shift key={shift.id} shift={shift} busy={busy} send={send} />)}
    {!['cancelled', 'completed', 'closed'].includes((booking.displayStatus ?? booking.status).toLowerCase()) && <details><summary>Change or cancel booking</summary><p>{booking.cancellationMessage}</p><ReasonForm label={booking.canCancel ? 'Cancel booking' : 'Request cancellation'} busy={busy} submit={async reason => { requestId.current.cancel ??= crypto.randomUUID(); const ok = await send({ action: booking.canCancel ? 'cancel_booking' : 'request_cancellation', id: booking.id, expectedVersion: booking.version, requestId: requestId.current.cancel, reason }, booking.canCancel ? 'Your booking has been cancelled.' : 'Your cancellation request has been sent to LOKD.'); if (ok) delete requestId.current.cancel; return ok; }} /><ReasonForm label="Request a change" busy={busy} submit={async reason => { requestId.current.change ??= crypto.randomUUID(); const ok = await send({ action: 'change_booking', id: booking.id, expectedVersion: booking.version, requestId: requestId.current.change, reason }, 'Your change request has been sent to LOKD.'); if (ok) delete requestId.current.change; return ok; }} /></details>}
  </section>;
}
function Shift({ shift, busy, send }: { shift: ClientShift; busy: boolean; send: Send }) {
  const requestId = useRef<string | null>(null);
  const complete = ['completed', 'verified'].includes(shift.status) && !!shift.checkOutAt;
  return <article className="client-shift"><div className="client-heading"><InitialsAvatar name={shift.officerName} /><div><h4>{shift.officerName}</h4><p>{shift.grade} · {date(shift.scheduledDate)}</p></div><Status value={shift.status} /></div><dl className="client-facts"><div><dt>LOKD Passport</dt><dd>{shift.passportNumber ?? 'Not issued'} · {label(shift.passportStatus)}</dd></div><div><dt>Passport checked</dt><dd>{date(shift.passportVerifiedAt, true)}</dd></div><div><dt>Check-in</dt><dd>{date(shift.checkInAt, true)}</dd></div><div><dt>Check-out</dt><dd>{date(shift.checkOutAt, true)}</dd></div><div><dt>Time on site</dt><dd>{Math.floor(shift.minutesOnSite / 60)}h {shift.minutesOnSite % 60}m</dd></div></dl>{shift.status === 'confirmed' && <ClientOfficerRoute shiftId={shift.id}/>}<p className="client-muted">Status refreshes every 30 seconds while this page is open.</p><a className="client-link" href={'/api/client-bookings/service-record?shift=' + encodeURIComponent(shift.id)}>Download service record</a>
    {complete && <><p>Service confirmation: {label(shift.clientSignoffStatus)}</p>{shift.timesheetVersion !== null && !['signed_off', 'confirmed', 'approved', 'disputed'].includes(shift.clientSignoffStatus) && <div className="client-actions"><button className="client-primary" disabled={busy} onClick={() => void send({ action: 'confirm_service', shiftId: shift.id, expectedVersion: shift.timesheetVersion, note: 'Service confirmed by the client.' }, 'Your service confirmation has been saved.')}>Confirm service</button><details><summary>Dispute service</summary><ReasonForm label="Submit dispute" busy={busy} submit={note => send({ action: 'dispute_service', shiftId: shift.id, expectedVersion: shift.timesheetVersion, note }, 'Your service dispute has been sent to LOKD.')} /></details></div>}
    {shift.feedbackScore ? <p>Your rating: {shift.feedbackScore} out of 5</p> : <details><summary>Rate this shift</summary><form className="client-form" onSubmit={async event => { event.preventDefault(); const f = new FormData(event.currentTarget); requestId.current ??= crypto.randomUUID(); if (await send({ action: 'rate_shift', requestId: requestId.current, shiftId: shift.id, score: Number(f.get('score')), note: f.get('note') }, 'Thank you. Your rating has been saved.', '/api/client-bookings/feedback')) requestId.current = null; }}><fieldset disabled={busy}><label>Rating<select name="score" required defaultValue=""><option value="" disabled>Choose a rating</option>{[5, 4, 3, 2, 1].map(score => <option key={score} value={score}>{score} out of 5</option>)}</select></label><label className="client-full">Your feedback<textarea name="note" maxLength={2000} required minLength={3} /></label></fieldset><button className="client-primary" disabled={busy}>Send feedback</button></form></details>}</>}
    <details><summary>Raise an issue</summary><ReasonForm label="Send to LOKD" busy={busy} submit={async note => { requestId.current ??= crypto.randomUUID(); const result = await send({ action: 'raise_issue', requestId: requestId.current, shiftId: shift.id, note }, 'Your issue has been sent to LOKD Operations.', '/api/client-bookings/feedback'); if (result) requestId.current = null; return result; }} /></details>
  </article>;
}
function ReasonForm({ label: text, busy, submit }: { label: string; busy: boolean; submit: (reason: string) => Promise<boolean> }) {
  return <form className="client-form" onSubmit={async event => { event.preventDefault(); const form = event.currentTarget; if (await submit(String(new FormData(form).get('reason')))) form.reset(); }}><label>Details<textarea name="reason" required minLength={10} maxLength={2000} disabled={busy} rows={3} /></label><button className="client-secondary" disabled={busy}>{text}</button></form>;
}
function Status({ value }: { value: string }) { return <span className="client-status">{label(value)}</span>; }
