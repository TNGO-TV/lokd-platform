import { SignupError } from './signup-server';
/** Operations reviews the actual first start; the agreed price is not inferred
 * from elapsed hours. Every roster position still needs full activation. */
export function reviewedShiftWindow(input: { startDate: string; shift: 'day' | 'night' | 'both'; engagementModel: string; firstShiftStartsAt?: unknown }, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !Number.isFinite(Date.parse(input.startDate)) || new Date(input.startDate).toISOString().slice(0, 10) !== input.startDate) throw new SignupError('Choose a valid service date.');
  const nominal = Date.parse(`${input.startDate}T${input.shift === 'night' ? '18' : '06'}:00:00+02:00`), end = nominal + 43200000;
  const supplied = input.firstShiftStartsAt !== undefined && input.firstShiftStartsAt !== null && input.firstShiftStartsAt !== '';
  const start = supplied && typeof input.firstShiftStartsAt === 'string' ? Date.parse(input.firstShiftStartsAt) : nominal;
  if (supplied && input.engagementModel !== 'bolt') throw new SignupError('A reviewed partial first shift is available for LOKD Bolt.');
  if (!Number.isFinite(start) || start < nominal || start >= end || start % 60000 !== 0 || start <= now) throw new SignupError('Choose a future, whole-minute start inside the requested shift. For cover today, review the actual first shift start.');
  return { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), partial: start !== nominal };
}
