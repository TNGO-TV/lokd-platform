import {scheduleLabel} from './booking-schedule';
import type {quoteAcceptanceCopy} from './quote-acceptance';

const html=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const money=(cents:unknown)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(cents)/100);

export function quoteAcceptanceDocument(copy:Awaited<ReturnType<typeof quoteAcceptanceCopy>>,operations=false){
 const r=copy.receipt,q=r.quote;
 const termsUrl=copy.termsUrl+(operations?'&scope=operations':'');
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(copy.publicNumber)} · Signed agreement · LOKD Security</title>
 <style>body{font:16px/1.6 system-ui,sans-serif;max-width:780px;margin:32px auto;padding:0 20px;color:var(--lokd-slate)}h1{font-size:28px;line-height:1.2}dt{font-weight:700}dd{margin:0 0 16px;overflow-wrap:anywhere}a{color:var(--lokd-blue-strong)}:focus-visible{outline:2px solid var(--lokd-blue);outline-offset:3px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 4px;border-bottom:1px solid var(--lokd-line)}small{overflow-wrap:anywhere}@media print{body{margin:0;max-width:none}}</style>
 <body><header>LOKD Security</header><h1>Signed service agreement</h1><p>${html(copy.publicNumber)}</p>
 <dl><dt>Client</dt><dd>${html(q.clientName)}</dd><dt>Site</dt><dd>${html(q.siteName)}<br>${html(q.address)}</dd><dt>Service</dt><dd>${html(q.serviceType)} · ${html(q.purposeLabel)}</dd><dt>Dates and times (SAST)</dt><dd>${html(q.startDate)} to ${html(q.endDate)} · ${q.coverageShifts===2?'24 Hours · 2 Shifts · Day and night':html(q.shiftStart)+'–'+html(q.shiftEnd)}</dd><dt>Cover</dt><dd>${html(q.headcount)} officer(s) · ${html(q.shiftCount)} shifts · ${html(scheduleLabel(String(q.rosterPattern)))}${q.includePublicHolidays?' · Public holidays included':''}</dd><dt>Instructions</dt><dd>${html(q.instructions)}</dd></dl>
 <table><caption>Agreed price</caption><thead><tr><th>Service</th><th>Amount</th></tr></thead><tbody><tr><td>${html(q.serviceType)} cover</td><td>${html(money(q.subtotalCents))}</td></tr><tr><td>VAT</td><td>${html(money(q.vatCents))}</td></tr><tr><th>Total</th><th>${html(money(q.totalCents))}</th></tr></tbody></table>
 <h2>Signature</h2><p>${html(r.acknowledgement)}</p><dl><dt>Signed by</dt><dd>${html(r.signerName??q.contactName)}${r.signerEmail?'<br>'+html(r.signerEmail):''}</dd><dt>Accepted</dt><dd>${html(new Date(r.acceptedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}))} SAST</dd><dt>Terms</dt><dd><a href="${html(termsUrl)}">${html(r.terms.title)} · ${html(r.terms.version)} (PDF)</a></dd></dl>
 <p>The signed agreement includes the service details above and the linked terms.</p><small>Agreement reference: ${html(r.quoteId)}<br>Signed record checksum: ${html(copy.receiptHash)}<br>Terms checksum: ${html(r.terms.sha256)}</small></body></html>`;
}
