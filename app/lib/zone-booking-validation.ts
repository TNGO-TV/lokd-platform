import { SignupError } from './signup-server';
import { bookingModelSchedule, BOOKING_MODEL_VERSION } from './booking-models';
import { zoneService } from './zone-booking';
export function validateZoneCover(input: Record<string, unknown>, now = Date.now()) {
  const service = zoneService(input.serviceCode);
  if (!service || input.serviceType !== service.serviceType) throw new SignupError('Choose a valid security service.');
  if (input.coverType !== input.engagementModel) throw new SignupError('Choose a matching booking model.');
  let schedule: ReturnType<typeof bookingModelSchedule>;
  try { schedule = bookingModelSchedule({ model: input.engagementModel, startDate: input.startDate, shift: input.shift, endDate:input.endDate, durationWeeks:input.durationWeeks,contractMonths:input.contractMonths,rosterPattern:input.rosterPattern,includePublicHolidays:input.includePublicHolidays }, now, true); } catch (error) { throw new SignupError(error instanceof Error ? error.message : 'Choose valid cover.'); }
  const rosterPattern = input.rosterPattern;
  if (!['weekdays', 'monday_saturday', 'daily','saturdays','weekends','public_holidays'].includes(String(rosterPattern))) throw new SignupError('Choose a valid roster pattern.');
  if (typeof input.headcount !== 'number' || !Number.isSafeInteger(input.headcount) || input.headcount < 1 || input.headcount > 100) throw new SignupError('Choose between 1 and 100 officers.');
  return { coverType: schedule.model, engagementModel: schedule.model, modelVersion: BOOKING_MODEL_VERSION, serviceCode: service.code, serviceLabel: service.label, serviceType: service.serviceType, contractMonths: schedule.contractMonths, durationWeeks: schedule.durationWeeks, rosterPattern: String(rosterPattern), startDate: schedule.startDate, endDate: schedule.endDate, shiftStart: input.shift === 'night' ? '18:00' : '06:00', shiftEnd: input.shift === 'day' ? '18:00' : '06:00', shift: input.shift as 'day' | 'night' | 'both',coverageShifts:schedule.coverageShifts,serviceDates:schedule.serviceDates,includePublicHolidays:schedule.includePublicHolidays, headcount: input.headcount };
}
