'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookingFinanceData, EftInstructions } from '../lib/booking-finance';

const money = (value: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value / 100);
const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeZone: 'Africa/Johannesburg' }).format(new Date(value)) : '—';
const download = (kind: string, id?: string) => '/api/client-finance?download=' + kind + (id ? '&id=' + encodeURIComponent(id) : '');
function validData(value: BookingFinanceData) {
  return value && Array.isArray(value.invoices) && Array.isArray(value.credits) && Array.isArray(value.receipts) && Array.isArray(value.collections)
    && value.invoices.every(i => typeof i.id === 'string' && typeof i.number === 'string' && Number.isSafeInteger(i.balanceCents) && Array.isArray(i.lines));
}
function checkoutUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.origin === 'https://checkout.paystack.com' && !url.username && !url.password && !url.hash ? url.href : null; } catch { return null; }
}

export default function BookingFinancePanel() {
  const [data, setData] = useState<BookingFinanceData | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [instructions, setInstructions] = useState<Record<string, EftInstructions>>({});
  const actionLock = useRef(false);
  const loadGeneration = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const generation = ++loadGeneration.current;
    try {
      const response = await fetch('/api/client-finance', { cache: 'no-store', signal });
      if (generation !== loadGeneration.current || signal?.aborted) return;
      if (response.status === 401 || response.status === 403) { setData(null); setInstructions({}); }
      const result = await response.json() as BookingFinanceData & { error?: string };
      if (generation !== loadGeneration.current || signal?.aborted) return;
      if (!response.ok) throw new Error(result.error || 'Invoices could not be loaded.');
      if (!validData(result)) throw new Error('Invoices could not be loaded. Please refresh.');
      setData(result); setError('');
    } catch (e) { if (!signal?.aborted && generation === loadGeneration.current) setError(e instanceof Error ? e.message : 'Invoices could not be loaded.'); }
  }, []);
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => void load(controller.signal), 0); return () => { clearTimeout(timer); controller.abort(); }; }, [load]);
  async function send(body: Record<string, unknown>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/client-finance', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (response.status === 401 || response.status === 403) { ++loadGeneration.current; setData(null); setInstructions({}); }
      const result = await response.json() as { error?: string; checkoutUrl?: string; instructions?: EftInstructions; delivery?: { sent: number } };
      if (!response.ok) throw new Error(result.error || 'The payment action could not be completed.');
      if (result.checkoutUrl) { const url = checkoutUrl(result.checkoutUrl); if (!url) throw new Error('The checkout address could not be verified. Please contact LOKD.'); window.location.assign(url); return; }
      if (result.instructions) {
        const instruction = result.instructions;
        setInstructions(current => ({ ...current, [String(body.invoiceId)]: instruction }));
        setNotice(result.delivery?.sent ? 'Your bank transfer details are shown below and have been emailed to you.' : 'Your bank transfer details are shown below. The email could not be sent; you can use these details to make your payment.');
      }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'The payment action could not be completed.'); }
    finally { actionLock.current = false; setBusy(false); }
  }
  return <section className="client-finance" aria-labelledby="client-finance-title">
    <div className="client-finance-heading"><div><h2 id="client-finance-title">Invoices</h2><p>Your invoices, payments and credit notes.</p></div><button type="button" disabled={busy} onClick={() => void load()}>Refresh invoices</button></div>
    {error && <p role="alert" className="client-finance-error">{error}</p>}
    {notice && <p role="status" className="client-finance-notice">{notice}</p>}
    {!data && !error && <p role="status">Loading your invoices…</p>}
    {data && <>
      <div className="client-finance-summary"><p>Account balance <strong>{money(data.invoices.reduce((total, invoice) => total + invoice.balanceCents, 0))}</strong></p><a href={download('statement')}>Download statement</a></div>
      {!data.invoices.length && <p>Your issued invoices will appear here.</p>}
      {data.invoices.map(invoice => {
        const collection = data.collections.find(c => c.orderId === invoice.bookingId && c.current);
        const eft = instructions[invoice.id];
        const creditNotes = data.credits.filter(c => c.invoiceId === invoice.id);
        const receipts = data.receipts.filter(r => r.bookingId === invoice.bookingId);
        return <article className="client-finance-card" key={invoice.id}>
          <div className="client-finance-heading"><div><h3>{invoice.number}</h3><p>Booking {invoice.bookingId}</p></div><span className="client-finance-status">{invoice.status}</span></div>
          <p>Issued {date(invoice.issuedAt)} · Due {date(invoice.dueDate)}</p>
          <div className="client-finance-table" tabIndex={0} role="region" aria-label={'Invoice lines for ' + invoice.number}><table><thead><tr><th scope="col">Service</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Total</th></tr></thead><tbody>{invoice.lines.map((line, index) => <tr key={index}><td>{line.description}</td><td>{line.quantity}</td><td>{money(line.unitPriceCents)}</td><td>{money(line.grossCents)}</td></tr>)}</tbody></table></div>
          <dl className="client-finance-totals"><dt>Subtotal</dt><dd>{money(invoice.subtotalCents)}</dd><dt>Tax</dt><dd>{money(invoice.taxCents)}</dd><dt>Total</dt><dd>{money(invoice.totalCents)}</dd>{invoice.creditedCents !== 0 && <><dt>Credits</dt><dd>{money(invoice.creditedCents)}</dd></>}{invoice.receivedCents > 0 && <><dt>Received</dt><dd>{money(invoice.receivedCents)}</dd></>}{invoice.refundedCents > 0 && <><dt>Refunded</dt><dd>{money(invoice.refundedCents)}</dd></>}<dt>Balance</dt><dd><strong>{money(invoice.balanceCents)}</strong></dd></dl>
          <div className="client-finance-actions"><a href={download('invoice', invoice.id)}>Download invoice</a>
            {invoice.balanceCents > 0 && invoice.status === 'Payment due' && <><button type="button" className="client-finance-primary" disabled={busy} onClick={() => void send({ action: 'checkout', invoiceId: invoice.id, reference: collection?.reference, revision: collection?.revision })}>Pay by card</button><button type="button" disabled={busy} onClick={() => void send({ action: 'eft_instructions', invoiceId: invoice.id })}>Pay by bank transfer</button></>}
            {invoice.balanceCents > 0 && collection?.state === 'awaiting_checkout' && checkoutUrl(collection.checkoutUrl) && <a href={checkoutUrl(collection.checkoutUrl)!} className="client-finance-primary">Continue card payment</a>}
          </div>
          {eft && <section className="client-finance-eft" aria-label={'Bank transfer details for ' + invoice.number}><h4>Bank transfer details</h4><dl><dt>Bank</dt><dd>{eft.bank}</dd><dt>Account name</dt><dd>{eft.accountName}</dd><dt>Account number</dt><dd>{eft.accountNumber}</dd><dt>Branch code</dt><dd>{eft.branchCode}</dd><dt>Account type</dt><dd>{eft.accountType}</dd><dt>Payment reference</dt><dd><strong>{eft.reference}</strong></dd><dt>Amount</dt><dd>{money(eft.amountCents)}</dd></dl><p>Use this exact reference. Your invoice will update after your payment is received and checked.</p></section>}
          {!!creditNotes.length && <section><h4>Credit notes</h4>{creditNotes.map(credit => <p key={credit.id}><a href={download('credit', credit.id)}>{credit.number}</a> · {money(credit.amountCents)} · {date(credit.issuedAt)}</p>)}</section>}
          {!!receipts.length && <section><h4>Payment receipts</h4>{receipts.map(receipt => <p key={receipt.id}><a href={download('receipt', receipt.id)}>Receipt {date(receipt.receivedAt)}</a> · {money(receipt.amountCents)} · {receipt.status.replaceAll('_', ' ')}</p>)}</section>}
        </article>;
      })}
    </>}
  </section>;
}
