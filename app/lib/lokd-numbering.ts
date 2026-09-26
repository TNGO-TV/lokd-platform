// Human-facing LOKD quote numbers. Africa/Johannesburg is UTC+2 all year (SAST, no daylight saving).
export const LOKD_QUOTE_TIME_ZONE = 'Africa/Johannesburg';
export const LOKD_QUOTE_SEQUENCE_MAX = 99;

export function lokdQuoteMonthKey(issuedAt: Date): string {
 if (!(issuedAt instanceof Date) || !Number.isFinite(issuedAt.getTime())) throw new Error('quote_month_unavailable');
 const parts = new Intl.DateTimeFormat('en-GB', {timeZone: LOKD_QUOTE_TIME_ZONE, year: 'numeric', month: '2-digit'}).formatToParts(issuedAt);
 const year = parts.find(part => part.type === 'year')?.value;
 const month = parts.find(part => part.type === 'month')?.value;
 if (!year || !month || !/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) throw new Error('quote_month_unavailable');
 return year.slice(2) + month;
}

export function lokdQuotePublicNumber(monthKey: string, sequence: number): string {
 if (!/^\d{4}$/.test(monthKey)) throw new Error('quote_month_unavailable');
 if (!Number.isInteger(sequence) || sequence < 1 || sequence > LOKD_QUOTE_SEQUENCE_MAX) throw new Error('quote_month_sequence_exhausted');
 return `LOKD${monthKey}${String(sequence).padStart(2, '0')}`;
}

export function lokdInvoicePublicNumber(quotePublicNumber: string): string {
 if (!/^LOKD\d{6}$/.test(quotePublicNumber)) throw new Error('quote_public_number_required');
 return `INV-${quotePublicNumber}`;
}
