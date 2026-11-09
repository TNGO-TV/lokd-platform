export type BookingModel = 'bolt' | 'flex' | 'fixed';
import { scheduledDates, type SchedulePattern } from './booking-schedule';
export const BOOKING_MODEL_VERSION = 'LOKD-MODELS-2026.11.2';
export const bookingModels = {
  bolt: { label: 'LOKD Bolt', description: 'Immediate / Emergency Service · Less than 72 Hours Notice' },
  flex: { label: 'LOKD Flex', description: 'Temporary / Flexible Service · 7+ Days in a calendar month' },
  fixed: { label: 'LOKD Fixed', description: 'Ongoing deployment · 3 Months +' },
} as const;
export const bookingModelLabel = (model: string | undefined) => model && Object.hasOwn(bookingModels, model) ? bookingModels[model as BookingModel].label : 'Booking under review';
export const sastDate = (now = new Date()) => new Date(now.getTime() + 7200000).toISOString().slice(0, 10);
export function dateAfterDays(date: string, days: number) { return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10); }
function contractEnd(date: string, months: number) { const value = new Date(date + 'T00:00:00Z'); value.setUTCMonth(value.getUTCMonth() + months); value.setUTCDate(value.getUTCDate() - 1); return value.toISOString().slice(0, 10); }
export function bookingModelSchedule(input: { model: unknown; startDate: unknown; endDate?:unknown; shift: unknown; durationWeeks?: unknown; contractMonths?: unknown; rosterPattern?:unknown; includePublicHolidays?:unknown; firstShiftStartsAt?: unknown }, now = Date.now(), allowStartedBolt = false, enforceTiming = true) {
  if (!['bolt', 'flex', 'fixed'].includes(String(input.model))) throw new Error('Choose LOKD Bolt, LOKD Flex or LOKD Fixed.');
  const model = input.model as BookingModel, startDate = input.startDate;
  if (typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(Date.parse(startDate)) || new Date(startDate).toISOString().slice(0, 10) !== startDate) throw new Error('Choose a valid service date.');
  if (!['day', 'night','both'].includes(String(input.shift))) throw new Error('Choose 12 Hours · 1 Shift or 24 Hours · 2 Shifts.');
  const nominal = Date.parse(`${startDate}T${input.shift === 'night' ? '18' : '06'}:00:00+02:00`), end = nominal + 43200000;
  const startsAt = input.firstShiftStartsAt ? Date.parse(String(input.firstShiftStartsAt)) : nominal;
  if (!Number.isFinite(startsAt) || startsAt < nominal || startsAt >= end || enforceTiming && startsAt <= now && !(allowStartedBolt && model === 'bolt' && end > now)) throw new Error('Choose a future shift. For urgent cover in the current shift, Operations must review the actual start.');
  if (input.firstShiftStartsAt && model !== 'bolt') throw new Error('A reviewed partial first shift is available for LOKD Bolt only.');
  const noticeHours = Math.max(0, (startsAt - now) / 3600000);
  if (enforceTiming && model === 'bolt' && noticeHours >= 72) throw new Error('LOKD Bolt requires less than 72 hours’ notice. Choose LOKD Flex for temporary cover.');
  if (enforceTiming && model === 'flex' && noticeHours < 72) throw new Error('LOKD Flex requires at least 72 hours’ notice. Choose LOKD Bolt for urgent cover.');
  const weeks = input.durationWeeks ?? 0, months = input.contractMonths ?? 0;
  if (Number(weeks) !== 0) throw new Error('Choose service start and end dates. LOKD Flex is measured in days within a calendar month.');
  if (model === 'fixed' && (!Number.isSafeInteger(months) || ![3, 6, 12].includes(Number(months)))) throw new Error('LOKD Fixed requires at least three months. Choose 3, 6 or 12 months.');
  if (model !== 'fixed' && Number(months) !== 0) throw new Error('Contract terms belong to LOKD Fixed.');
  const endDate=model==='fixed'?contractEnd(startDate,Number(months)):model==='flex'?input.endDate:startDate;
  if(typeof endDate!=='string'||model==='flex'&&endDate.slice(0,7)!==startDate.slice(0,7))throw new Error('LOKD Flex requires seven or more service days within one calendar month.');
  if(input.includePublicHolidays!==undefined&&typeof input.includePublicHolidays!=='boolean')throw new Error('Choose whether to add public holidays.');
  const serviceDates=scheduledDates(startDate,endDate,(input.rosterPattern??'daily') as SchedulePattern,input.includePublicHolidays===true);
  if(!serviceDates.length)throw new Error('Choose schedule days that include at least one date in this period.');
  if(model==='flex'&&serviceDates.length<7)throw new Error('LOKD Flex requires at least seven scheduled service days in the same calendar month.');
  return { model, startDate, endDate,serviceDates,coverageShifts:input.shift==='both'?2:1,includePublicHolidays:input.includePublicHolidays===true, durationWeeks:0, contractMonths: model === 'fixed' ? Number(months) : 0, noticeHours, startsAt: new Date(startsAt).toISOString(), nominalStartsAt: new Date(nominal).toISOString() };
}
