import { SignupError } from './signup-server';
import { addMonths } from './pricing';
import { sastDate, zoneService } from './zone-booking';

export function validateZoneCover(input: Record<string, unknown>, now = Date.now()) {
  if (!['soon', 'date', 'ongoing'].includes(String(input.coverType))) throw new SignupError('Choose how you need cover.');
  const service = zoneService(input.serviceCode);
  if (!service || input.serviceType !== service.serviceType) throw new SignupError('Choose a valid security service.');
  const coverType = input.coverType as 'soon' | 'date' | 'ongoing', engagementModel = coverType === 'ongoing' ? 'fixed' : 'flex';
  if (input.engagementModel !== engagementModel) throw new SignupError('LOKD Flex covers single shifts; LOKD Fixed covers ongoing rosters.');
  const startDate = input.startDate;
  if (typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(Date.parse(startDate)) || new Date(startDate).toISOString().slice(0, 10) !== startDate) throw new SignupError('Choose a valid service date.');
  const today = sastDate(new Date(now)), tomorrow = sastDate(new Date(now + 86_400_000));
  if (startDate < today || coverType === 'soon' && ![today, tomorrow].includes(startDate)) throw new SignupError('Choose today or tomorrow, or select A specific date.');
  if (!['day', 'night'].includes(String(input.shift))) throw new SignupError('Choose a day or night shift.');
  const shiftStart = input.shift === 'day' ? '06:00' : '18:00', shiftEnd = input.shift === 'day' ? '18:00' : '06:00';
  // A same-day request can arrive after the normal shift start. Dispatch must
  // confirm what cover is still available; this never promises an arrival time.
  const endAt = Date.parse(startDate + 'T' + shiftEnd + ':00+02:00') + (input.shift === 'night' ? 86_400_000 : 0);
  if (engagementModel === 'flex' && endAt <= now) throw new SignupError('That shift has ended. Choose the next day or night shift.');
  const term = input.contractMonths, rosterPattern = input.rosterPattern;
  if (engagementModel === 'fixed' && (!Number.isSafeInteger(term) || ![1, 3, 6, 12].includes(Number(term)))) throw new SignupError('Choose a contract term of 1, 3, 6 or 12 months.');
  if (engagementModel === 'fixed' && !['weekdays', 'monday_saturday', 'daily'].includes(String(rosterPattern))) throw new SignupError('Choose weekdays, Mon–Sat or daily cover.');
  if (engagementModel === 'flex' && (term !== 0 || rosterPattern !== 'daily')) throw new SignupError('LOKD Flex is a single shift. Choose Ongoing cover for a roster.');
  const headcount = input.headcount;
  if (typeof headcount !== 'number' || !Number.isSafeInteger(headcount) || headcount < 1 || headcount > 100) throw new SignupError('Choose between 1 and 100 officers.');
  return { coverType, engagementModel: engagementModel as 'fixed' | 'flex', serviceCode: service.code, serviceLabel: service.label, serviceType: service.serviceType, contractMonths: engagementModel === 'fixed' ? Number(term) : 0, rosterPattern: String(rosterPattern), startDate, endDate: engagementModel === 'fixed' ? addMonths(startDate, Number(term)) : startDate, shiftStart, shiftEnd, shift: input.shift as 'day' | 'night', headcount };
}
