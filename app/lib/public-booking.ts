import { bookingModelSchedule, BOOKING_MODEL_VERSION } from './booking-models';
import {
  assessRisk, defaultRiskInput, deriveNoticeWindow, quoteBooking,
  type ContractTerm, type RosterPattern, type ServiceType,
} from "./pricing";

// Server-only pricing. Public forms send intent; they never receive this snapshot.
const services: Record<string, ServiceType> = {
  scheduled_unarmed_fixed_site: "Unarmed", armed_static: "Armed", vip_unarmed: "VIP",
};
const purposes: Record<string, string> = {
  commercial_property: "commercial_access", logistics_industrial: "logistics_industrial",
  construction: "construction", residential_estate: "residential", education: "school",
  retail: "retail", other: "event",
};

export class BookingRequestError extends Error { readonly status = 400; }

export function publicBooking(input: Record<string, unknown>, now = new Date()) {
  if (input.booking === undefined) return null;
  if (!input.booking || typeof input.booking !== "object" || Array.isArray(input.booking)) throw new BookingRequestError("Choose how you need cover.");
  const value = input.booking as Record<string, unknown>;
  const coverType = value.coverType;
  if (!['bolt','flex','fixed'].includes(String(coverType))) throw new BookingRequestError('Choose LOKD Bolt, LOKD Flex or LOKD Fixed.');
  const engagementModel = coverType as 'bolt'|'flex'|'fixed', term = value.term;
  if(typeof term!=='string' || (engagementModel==='bolt'?term!=='single':engagementModel==='flex'?term!=='week':!['3','6','12'].includes(term)))throw new BookingRequestError(engagementModel==='fixed'?'LOKD Fixed requires at least three months. Choose 3, 6 or 12 months.':'Choose a valid cover term for '+(engagementModel==='bolt'?'LOKD Bolt.':'LOKD Flex.'));
  const roster = value.rosterPattern;
  if (!['weekdays','monday_saturday','daily'].includes(String(roster)) || typeof roster !== 'string' || engagementModel === 'bolt' && roster !== 'daily') throw new BookingRequestError('Choose a valid roster.');
  let modelSchedule: ReturnType<typeof bookingModelSchedule>;
  try { modelSchedule = bookingModelSchedule({model:engagementModel,startDate:value.startDate,shift:value.shift,durationWeeks:value.durationWeeks??0,contractMonths:engagementModel==='fixed'?Number(value.term):0},now.getTime(),true,false); } catch(error) { throw new BookingRequestError(error instanceof Error?error.message:'Choose valid cover.'); }
  const startDate = value.startDate;
  if (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(Date.parse(startDate + "T00:00:00Z")) || new Date(startDate + "T00:00:00Z").toISOString().slice(0, 10) !== startDate) throw new BookingRequestError("Choose a valid start date.");
  const shift = value.shift;
  if (shift !== "day" && shift !== "night") throw new BookingRequestError("Choose a day or night shift.");
  const serviceType = typeof input.serviceType === "string" ? services[input.serviceType] : undefined;
  if (!serviceType) throw new BookingRequestError("Choose Unarmed guarding, Armed security or VIP protection.");
  const officers = value.officers;
  const maximum = serviceType === "VIP" ? 4 : 6;
  if (typeof officers !== "number" || !Number.isSafeInteger(officers) || officers < 1 || officers > maximum) throw new BookingRequestError(`Choose between 1 and ${maximum} officers for this service. Contact bookings@lokd.co.za for a larger team.`);
  const siteAddress = typeof input.siteAddress === "string" ? input.siteAddress.trim().replace(/\s+/g, " ") : "";
  if (siteAddress.length < 5 || siteAddress.length > 200) throw new BookingRequestError("Enter the site address.");
  const purposeCode = purposes[String(input.siteType)];
  if (!purposeCode) throw new BookingRequestError("Choose a valid site type.");
  // A provisional assessment from the supplied site and shift, for Operations to review.
  const riskInput = { ...defaultRiskInput, existingControls: "partial" as const, nightOperation: shift === "night" };
  const risk = assessRisk(purposeCode, riskInput);
  const quote = quoteBooking({ serviceType, engagementModel, term: term as ContractTerm, rosterPattern: roster as RosterPattern, startDate, shift, purposeCode, riskInput, specialistConfiguration: { teamSize: officers }, durationWeeks:modelSchedule.durationWeeks, modelVersion:BOOKING_MODEL_VERSION, now });
  const startTime = shift === "day" ? "06:00" : "18:00";
  const endTime = shift === "day" ? "18:00" : "06:00";
  const schedule = engagementModel === "bolt" ? "Single shift" : roster === "weekdays" ? "Weekdays in this period" : roster === "monday_saturday" ? "Monday–Saturday in this period" : "Every day in this period";
  // Hash only the stable intent: notice bands change as time passes, even on an exact retry.
  const intent = { coverType, startDate, shift, officers, term: term as ContractTerm, durationWeeks: modelSchedule.durationWeeks, rosterPattern: roster as RosterPattern };
  return {
    intent, engagementModel, modelVersion:BOOKING_MODEL_VERSION, noticeWindow: deriveNoticeWindow(quote.startDate, shift, now),
    calendarType: quote.firstCalendarCategory, riskBand: risk.band,
    schedule: { siteAddress, startDate: quote.startDate, endDate: quote.endDate, startTime, endTime, officers, schedule },
    startsAt: `${quote.startDate}T${startTime}:00+02:00`,
    draftPrice: { totalCents: quote.clientPriceCents, version: quote.version, serviceDayCount: quote.serviceDayCount, shiftCount: quote.shiftCount, assessedOfficers: quote.headcount, manualReview: true },
  };
}

export function validateBookingStart(booking: NonNullable<ReturnType<typeof publicBooking>>, now = new Date()) {
  try { bookingModelSchedule({model:booking.engagementModel,startDate:booking.intent.startDate,shift:booking.intent.shift,durationWeeks:booking.intent.durationWeeks,contractMonths:booking.engagementModel==='fixed'?Number(booking.intent.term):0},now.getTime(),true); } catch(error) { throw new BookingRequestError(error instanceof Error?error.message:'Choose valid cover.'); }
}
