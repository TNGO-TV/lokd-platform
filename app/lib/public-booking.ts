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
  if (coverType !== "soon" && coverType !== "date" && coverType !== "ongoing") throw new BookingRequestError("Choose how you need cover.");
  const engagementModel = coverType === "ongoing" ? "fixed" : "flex";
  const term = value.term;
  if (engagementModel === "fixed" ? !["1", "3", "6", "12"].includes(String(term)) || typeof term !== "string" : term !== "single") throw new BookingRequestError("Choose a valid cover term.");
  const roster = value.rosterPattern;
  if (!["weekdays", "monday_saturday", "daily"].includes(String(roster)) || typeof roster !== "string" || engagementModel === "flex" && roster !== "daily") throw new BookingRequestError("Choose a valid roster.");
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
  const quote = quoteBooking({ serviceType, engagementModel, term: term as ContractTerm, rosterPattern: roster as RosterPattern, startDate, shift, purposeCode, riskInput, specialistConfiguration: { teamSize: officers }, now });
  const startTime = shift === "day" ? "06:00" : "18:00";
  const endTime = shift === "day" ? "18:00" : "06:00";
  const schedule = engagementModel === "flex" ? "Single shift" : roster === "weekdays" ? "Weekdays in this period" : roster === "monday_saturday" ? "Monday–Saturday in this period" : "Every day in this period";
  // Hash only the stable intent: notice bands change as time passes, even on an exact retry.
  const intent = { coverType, startDate, shift, officers, term: term as ContractTerm, rosterPattern: roster as RosterPattern };
  return {
    intent, engagementModel, noticeWindow: deriveNoticeWindow(quote.startDate, shift, now),
    calendarType: quote.firstCalendarCategory, riskBand: risk.band,
    schedule: { siteAddress, startDate: quote.startDate, endDate: quote.endDate, startTime, endTime, officers, schedule },
    startsAt: `${quote.startDate}T${startTime}:00+02:00`,
    draftPrice: { totalCents: quote.clientPriceCents, version: quote.version, serviceDayCount: quote.serviceDayCount, shiftCount: quote.shiftCount, assessedOfficers: quote.headcount, manualReview: true },
  };
}

export function validateBookingStart(booking: NonNullable<ReturnType<typeof publicBooking>>, now = new Date()) {
  if (Date.parse(booking.startsAt) <= now.getTime()) throw new BookingRequestError("That shift has already started. Choose the next day or night shift.");
  if (booking.intent.coverType === "soon") {
    const today = new Date(now.getTime() + 7_200_000).toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 7_200_000 + 86_400_000).toISOString().slice(0, 10);
    if (![today, tomorrow].includes(booking.intent.startDate)) throw new BookingRequestError("Choose today or tomorrow, or select A specific date.");
  }
}
