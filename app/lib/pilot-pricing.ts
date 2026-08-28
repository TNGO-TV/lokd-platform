import type { ServiceType } from "./pilot-types";

export type ContractTerm = "single" | "1" | "3" | "6" | "12";
export type NoticeWindow = "standard" | "priority" | "urgent" | "immediate";
export type EngagementModel = "fixed" | "flex";
export type RosterPattern = "weekdays" | "monday_saturday" | "daily";
export type CalendarCategory = "ordinary" | "sunday" | "public_holiday" | "easter" | "christmas";
export type RiskBand = "Standard" | "Enhanced" | "Elevated" | "High" | "Critical";
export type AssetExposure = "standard" | "valuable" | "high_value";
export type PublicAccess = "controlled" | "moderate" | "open";
export type IncidentHistory = "none" | "isolated" | "repeated";
export type ExistingControls = "strong" | "partial" | "limited";

export type RiskInput = {
  assetExposure: AssetExposure;
  publicAccess: PublicAccess;
  incidentHistory: IncidentHistory;
  existingControls: ExistingControls;
  nightOperation: boolean;
  vulnerablePeople: boolean;
};

export type RiskAssessment = {
  version: string;
  score: number;
  band: RiskBand;
  recommendedService: ServiceType;
  minimumGrade: string;
  headcount: number;
  requiredEndorsements: string[];
  reasons: string[];
  manualReview: boolean;
  clientMultiplier: number;
  officerMultiplier: number;
};

export type BookingQuoteRequest = {
  serviceType: ServiceType;
  engagementModel: EngagementModel;
  term: ContractTerm;
  purposeCode: string;
  startDate: string;
  shift: "day" | "night";
  rosterPattern: RosterPattern;
  riskInput: RiskInput;
  now?: Date;
};

export const PRICE_BOOK_VERSION = "LOKD-PREMIUM-2026.09";
export const RISK_RULES_VERSION = "LOKD-RISK-RULES-2026.09";

export const defaultRiskInput: RiskInput = {
  assetExposure: "standard",
  publicAccess: "controlled",
  incidentHistory: "none",
  existingControls: "strong",
  nightOperation: false,
  vulnerablePeople: false,
};

export const servicePriceBook: Record<ServiceType, {
  clientShiftCents: number;
  officerShiftCents: number;
  minimumGrade: string;
  label: string;
  note: string;
}> = {
  Unarmed: {
    clientShiftCents: 140_000,
    officerShiftCents: 80_000,
    minimumGrade: "Grade C",
    label: "Purpose-trained protection",
    note: "LOKD assessed professional for access, patrol and site-specific duties.",
  },
  Armed: {
    clientShiftCents: 420_000,
    officerShiftCents: 200_000,
    minimumGrade: "Grade B",
    label: "Armed readiness",
    note: "Continuously assessed armed professional with current monthly readiness.",
  },
  VIP: {
    clientShiftCents: 850_000,
    officerShiftCents: 450_000,
    minimumGrade: "Grade B",
    label: "Protective Operations",
    note: "Specialist protective operator with advanced selection and recurring tactical assessment.",
  },
};

export const noticePriceBook: Record<NoticeWindow, {
  label: string;
  clientMultiplier: number;
}> = {
  standard: { label: "72+ hours · Scheduled Flex", clientMultiplier: 8 / 7 },
  priority: { label: "24–72 hours · Priority Flex", clientMultiplier: 185 / 140 },
  urgent: { label: "6–24 hours · Urgent Flex", clientMultiplier: 1.5 },
  immediate: { label: "Under 6 hours · Immediate Flex", clientMultiplier: 12 / 7 },
};

export const engagementModels: Record<EngagementModel, { label: string; note: string }> = {
  fixed: { label: "LOKD Fixed", note: "Recurring cover on a planned roster at the contracted rate." },
  flex: { label: "LOKD Flex", note: "One-off or short-notice cover with a separate dispatch premium." },
};

export const rosterPatterns: Record<RosterPattern, { label: string; weekdays: number[] }> = {
  weekdays: { label: "Monday–Friday", weekdays: [1, 2, 3, 4, 5] },
  monday_saturday: { label: "Monday–Saturday", weekdays: [1, 2, 3, 4, 5, 6] },
  daily: { label: "Every day", weekdays: [0, 1, 2, 3, 4, 5, 6] },
};

export const calendarPriceBook: Record<CalendarCategory, {
  label: string;
  fixedClientMultiplier: number;
  flexClientMultiplier: number;
  fixedOfficerMultiplier: number;
  flexOfficerMultiplier: number;
}> = {
  ordinary: { label: "Ordinary Monday–Saturday", fixedClientMultiplier: 1, flexClientMultiplier: 1, fixedOfficerMultiplier: 1, flexOfficerMultiplier: 1 },
  sunday: { label: "Sunday", fixedClientMultiplier: 1.5, flexClientMultiplier: 2, fixedOfficerMultiplier: 1.5, flexOfficerMultiplier: 2 },
  public_holiday: { label: "Public holiday", fixedClientMultiplier: 2, flexClientMultiplier: 2, fixedOfficerMultiplier: 2, flexOfficerMultiplier: 2 },
  easter: { label: "Easter peak day", fixedClientMultiplier: 2.25, flexClientMultiplier: 2.25, fixedOfficerMultiplier: 2.25, flexOfficerMultiplier: 2.25 },
  christmas: { label: "Christmas peak day", fixedClientMultiplier: 2.5, flexClientMultiplier: 2.5, fixedOfficerMultiplier: 2.5, flexOfficerMultiplier: 2.5 },
};

export const purposePriceBook = [
  { code: "commercial_access", label: "Commercial access" },
  { code: "construction", label: "Construction site" },
  { code: "school", label: "School / education" },
  { code: "retail", label: "General retail" },
  { code: "high_value_retail", label: "Jewellery / high-value retail" },
  { code: "residential", label: "Residential" },
  { code: "event", label: "Event" },
  { code: "logistics_industrial", label: "Logistics / industrial" },
  { code: "secure_logistics", label: "Secure logistics" },
  { code: "executive_protection", label: "Executive protection" },
] as const;

const purposeRiskProfiles: Record<string, {
  baseScore: number;
  recommendedService: ServiceType;
  minimumGrade: string;
  endorsements: string[];
  reason: string;
  manualReview?: boolean;
  safeguarding?: boolean;
}> = {
  commercial_access: { baseScore: 18, recommendedService: "Unarmed", minimumGrade: "Grade C", endorsements: ["Commercial access"], reason: "Controlled access and patrol duties form the base requirement." },
  construction: { baseScore: 26, recommendedService: "Unarmed", minimumGrade: "Grade C", endorsements: ["Construction sites", "Access control"], reason: "Tools, contractors and changing site conditions increase loss and safety exposure." },
  school: { baseScore: 30, recommendedService: "Unarmed", minimumGrade: "Grade C", endorsements: ["School safety", "Safeguarding", "First aid"], reason: "Safeguarding consequences remain high even where cash and stock exposure are low.", safeguarding: true },
  retail: { baseScore: 28, recommendedService: "Unarmed", minimumGrade: "Grade C", endorsements: ["Retail loss prevention", "Public interaction"], reason: "Public access and stock exposure require retail-specific readiness." },
  high_value_retail: { baseScore: 65, recommendedService: "Armed", minimumGrade: "Grade B", endorsements: ["High-value retail", "Armed monthly readiness", "Incident response"], reason: "High-value stock and violent-crime exposure require a specialist deployment plan.", manualReview: true },
  residential: { baseScore: 20, recommendedService: "Unarmed", minimumGrade: "Grade C", endorsements: ["Residential access"], reason: "Visitor control, patrol and resident interaction drive the base requirement." },
  event: { baseScore: 38, recommendedService: "Unarmed", minimumGrade: "Grade C", endorsements: ["Event safety", "Crowd management"], reason: "Temporary access patterns and crowds increase coordination risk." },
  logistics_industrial: { baseScore: 36, recommendedService: "Unarmed", minimumGrade: "Grade C", endorsements: ["Logistics / industrial", "Access control"], reason: "Vehicle movement, stock and isolated areas increase operational exposure." },
  secure_logistics: { baseScore: 60, recommendedService: "Armed", minimumGrade: "Grade B", endorsements: ["Secure logistics", "Armed monthly readiness"], reason: "High-value movement requires armed and route-specific readiness.", manualReview: true },
  executive_protection: { baseScore: 70, recommendedService: "VIP", minimumGrade: "Grade B", endorsements: ["Protective Operations", "Tactical scenarios", "First aid"], reason: "Personal threat exposure requires a selected Protective Operations specialist.", manualReview: true },
};

export const termLabels: Record<ContractTerm, string> = {
  single: "Single shift",
  "1": "1 month",
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
};

const serviceRank: Record<ServiceType, number> = { Unarmed: 1, Armed: 2, VIP: 3 };

export function serviceMeetsRecommendation(selected: ServiceType, recommended: ServiceType) {
  return serviceRank[selected] >= serviceRank[recommended];
}

export function cadenceForTerm(term: ContractTerm): "Weekly" | "Monthly" {
  return term === "single" || Number(term) <= 3 ? "Weekly" : "Monthly";
}

function riskBand(score: number): RiskBand {
  if (score <= 24) return "Standard";
  if (score <= 39) return "Enhanced";
  if (score <= 54) return "Elevated";
  if (score <= 69) return "High";
  return "Critical";
}

const riskMultipliers: Record<RiskBand, { client: number; officer: number }> = {
  Standard: { client: 1, officer: 1 },
  Enhanced: { client: 1.05, officer: 1 },
  Elevated: { client: 1.1, officer: 1.05 },
  High: { client: 1.2, officer: 1.1 },
  Critical: { client: 1.3, officer: 1.2 },
};

export type AuthoritativeOfficerShiftEconomics = {
  serviceDate: string;
  serviceDateMatchesStart: boolean;
  calendarCategory: CalendarCategory;
  calendarLabel: string;
  ordinaryWageCents: number;
  holidayPremiumCents: number;
  officerOfferCents: number;
};

export function assessRisk(purposeCode: string, input: RiskInput): RiskAssessment {
  const profile = purposeRiskProfiles[purposeCode] ?? purposeRiskProfiles.commercial_access;
  let score = profile.baseScore;
  const reasons = [profile.reason];

  if (input.assetExposure === "valuable") { score += 12; reasons.push("Valuable cash, stock or equipment increases the likely loss impact."); }
  if (input.assetExposure === "high_value") { score += 25; reasons.push("High-value assets materially increase target attractiveness and consequence."); }
  if (input.publicAccess === "moderate") { score += 8; reasons.push("Regular public access increases screening and interaction demands."); }
  if (input.publicAccess === "open") { score += 16; reasons.push("Open or heavy public access increases screening complexity."); }
  if (input.incidentHistory === "isolated") { score += 12; reasons.push("A recent incident raises the current threat level."); }
  if (input.incidentHistory === "repeated") { score += 25; reasons.push("Repeated incidents indicate an active, persistent exposure."); }
  if (input.existingControls === "strong") { score -= 8; reasons.push("Working CCTV, alarms and controlled access reduce avoidable exposure."); }
  if (input.existingControls === "limited") { score += 10; reasons.push("Limited existing controls increase reliance on the deployed team."); }
  if (input.nightOperation) { score += 8; reasons.push("Night operation increases isolation, visibility and response challenges."); }
  if (input.vulnerablePeople || profile.safeguarding) { score += 12; reasons.push("Vulnerable people create a mandatory safeguarding consequence dimension."); }

  score = Math.max(0, Math.min(100, score));
  const band = riskBand(score);
  let recommendedService = profile.recommendedService;
  if (score >= 60 && recommendedService === "Unarmed" && purposeCode !== "school") recommendedService = "Armed";
  const minimumGrade = score >= 55 && recommendedService === "Unarmed" ? "Grade B" : servicePriceBook[recommendedService].minimumGrade;
  const manualReview = Boolean(profile.manualReview || band === "High" || band === "Critical");
  const headcount = band === "Critical" ? 2 : 1;
  const multipliers = riskMultipliers[band];

  return {
    version: RISK_RULES_VERSION,
    score,
    band,
    recommendedService,
    minimumGrade,
    headcount,
    requiredEndorsements: profile.endorsements,
    reasons: reasons.slice(0, 5),
    manualReview,
    clientMultiplier: multipliers.client,
    officerMultiplier: multipliers.officer,
  };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

const fixedPublicHolidays = new Set(["01-01", "03-21", "04-27", "05-01", "06-16", "08-09", "09-24", "12-16"]);

export function calendarCategoryForDate(dateValue: string): CalendarCategory {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "ordinary";
  const year = date.getUTCFullYear();
  const monthDay = dateValue.slice(5);
  if (monthDay === "12-25" || monthDay === "12-26") return "christmas";

  const easter = easterSunday(year);
  const easterDates = new Set([isoDate(addDays(easter, -2)), isoDate(easter), isoDate(addDays(easter, 1))]);
  if (easterDates.has(dateValue)) return "easter";

  let publicHoliday = fixedPublicHolidays.has(monthDay);
  if (!publicHoliday && date.getUTCDay() === 1) {
    const prior = addDays(date, -1);
    const priorMonthDay = isoDate(prior).slice(5);
    publicHoliday = fixedPublicHolidays.has(priorMonthDay) || priorMonthDay === "12-25" || priorMonthDay === "12-26";
  }
  if (publicHoliday) return "public_holiday";
  return date.getUTCDay() === 0 ? "sunday" : "ordinary";
}

/**
 * Prices one roster slot from server-owned rules. South Africa is UTC+02 year-round,
 * so the service day is derived from the absolute start instant without host locale.
 */
export function officerShiftEconomicsForRoster(input: {
  serviceType: string;
  riskBand: string;
  engagementModel: string;
  serviceDate: string;
  startsAt: string;
}): AuthoritativeOfficerShiftEconomics | null {
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(input.serviceDate)) return null;
  if (!(input.serviceType in servicePriceBook) || !(input.riskBand in riskMultipliers)
    || !["fixed", "flex"].includes(input.engagementModel)) return null;

  const johannesburgStart = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const serviceDate = johannesburgStart.toISOString().slice(0, 10);
  const calendarCategory = calendarCategoryForDate(serviceDate);
  const service = servicePriceBook[input.serviceType as ServiceType];
  const risk = riskMultipliers[input.riskBand as RiskBand].officer;
  const calendar = calendarPriceBook[calendarCategory];
  const calendarMultiplier = input.engagementModel === "flex"
    ? calendar.flexOfficerMultiplier
    : calendar.fixedOfficerMultiplier;
  const ordinaryWageCents = Math.round(service.officerShiftCents * risk);
  const officerOfferCents = Math.round(service.officerShiftCents * risk * calendarMultiplier);
  return {
    serviceDate,
    serviceDateMatchesStart: input.serviceDate === serviceDate,
    calendarCategory,
    calendarLabel: calendar.label,
    ordinaryWageCents,
    holidayPremiumCents: officerOfferCents - ordinaryWageCents,
    officerOfferCents,
  };
}

export function deriveNoticeWindow(startDate: string, shift: "day" | "night", now = new Date()): NoticeWindow {
  const target = new Date(`${startDate}T${shift === "night" ? "16" : "04"}:00:00.000Z`);
  const hours = (target.getTime() - now.getTime()) / 3_600_000;
  if (hours < 6) return "immediate";
  if (hours < 24) return "urgent";
  if (hours < 72) return "priority";
  return "standard";
}

export function addMonths(dateValue: string, months: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateValue;
  if (months <= 0) return dateValue;
  date.setUTCMonth(date.getUTCMonth() + months);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function scheduledDates(startDate: string, term: ContractTerm, engagementModel: EngagementModel, rosterPattern: RosterPattern) {
  if (engagementModel === "flex") return [startDate];
  const months = Number(term);
  const endDate = addMonths(startDate, months);
  const allowed = new Set(rosterPatterns[rosterPattern].weekdays);
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    if (allowed.has(cursor.getUTCDay())) dates.push(isoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function quoteBooking(request: BookingQuoteRequest) {
  const { serviceType, engagementModel, purposeCode, startDate, shift, rosterPattern, riskInput } = request;
  const term: ContractTerm = engagementModel === "flex" ? "single" : request.term === "single" ? "1" : request.term;
  const risk = assessRisk(purposeCode, riskInput);
  if (!serviceMeetsRecommendation(serviceType, risk.recommendedService)) {
    throw new Error(`${risk.recommendedService} is the minimum service recommended by this assessment.`);
  }
  const service = servicePriceBook[serviceType];
  const noticeWindow = engagementModel === "flex" ? deriveNoticeWindow(startDate, shift, request.now) : "standard";
  const notice = noticePriceBook[noticeWindow];
  const dates = scheduledDates(startDate, term, engagementModel, rosterPattern);
  const categories: Record<CalendarCategory, number> = { ordinary: 0, sunday: 0, public_holiday: 0, easter: 0, christmas: 0 };
  let baseClientCents = 0;
  let calendarPremiumCents = 0;
  let dispatchPremiumCents = 0;
  let riskPremiumCents = 0;
  let officerTotalCents = 0;
  let officerBaseTotalCents = 0;
  let firstClientShiftCents = 0;
  let firstOfficerShiftCents = 0;

  dates.forEach((dateValue, index) => {
    const category = calendarCategoryForDate(dateValue);
    categories[category] += 1;
    const calendar = calendarPriceBook[category];
    const clientCalendarMultiplier = engagementModel === "fixed" ? calendar.fixedClientMultiplier : calendar.flexClientMultiplier;
    const officerCalendarMultiplier = engagementModel === "fixed" ? calendar.fixedOfficerMultiplier : calendar.flexOfficerMultiplier;
    const baseClient = service.clientShiftCents;
    const afterCalendar = Math.round(baseClient * clientCalendarMultiplier);
    const afterDispatch = Math.round(afterCalendar * (engagementModel === "flex" ? notice.clientMultiplier : 1));
    const finalClient = Math.round(afterDispatch * risk.clientMultiplier);
    const officerBase = service.officerShiftCents;
    const finalOfficer = Math.round(officerBase * officerCalendarMultiplier * risk.officerMultiplier);
    baseClientCents += baseClient;
    calendarPremiumCents += afterCalendar - baseClient;
    dispatchPremiumCents += afterDispatch - afterCalendar;
    riskPremiumCents += finalClient - afterDispatch;
    officerBaseTotalCents += officerBase;
    officerTotalCents += finalOfficer;
    if (index === 0) {
      firstClientShiftCents = finalClient;
      firstOfficerShiftCents = finalOfficer;
    }
  });

  const clientPriceCents = baseClientCents + calendarPremiumCents + dispatchPremiumCents + riskPremiumCents;
  const firstCalendarCategory = calendarCategoryForDate(startDate);
  const manualReview = risk.manualReview || (engagementModel === "flex" && serviceType !== "Unarmed") || (engagementModel === "fixed" && Number(term) > 3);

  return {
    version: PRICE_BOOK_VERSION,
    engagementModel,
    shiftCount: dates.length,
    contractMonths: engagementModel === "flex" ? 0 : Number(term),
    startDate,
    endDate: engagementModel === "flex" ? startDate : addMonths(startDate, Number(term)),
    clientPriceCents,
    clientShiftCents: firstClientShiftCents,
    officerRateCents: firstOfficerShiftCents,
    officerTotalCents,
    officerBaseTotalCents,
    grossPlatformContributionCents: clientPriceCents - officerTotalCents,
    baseClientCents,
    calendarPremiumCents,
    dispatchPremiumCents,
    riskPremiumCents,
    minimumGrade: risk.minimumGrade,
    releaseCadence: cadenceForTerm(term),
    serviceLabel: service.label,
    noticeWindow,
    noticeLabel: engagementModel === "fixed" ? "Planned fixed roster" : notice.label,
    rosterLabel: engagementModel === "fixed" ? rosterPatterns[rosterPattern].label : "Single shift",
    firstCalendarCategory,
    firstCalendarLabel: calendarPriceBook[firstCalendarCategory].label,
    calendarBreakdown: categories,
    risk,
    manualReview,
  };
}
