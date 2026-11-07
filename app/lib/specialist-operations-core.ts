import { calendarPriceBook } from "./production-pricing";
import { indicativeSingleShiftPrice, SPECIALIST_PRICING_VERSION, specialistProfiles, type SpecialistServiceCode } from "./specialist-pricing";
import type { SpecialistBooking, SpecialistPackContent } from "./specialist-operations-types";

export const SPECIALIST_TERMS_VERSION = "LOKD-SPECIALIST-TERMS-2026.09-v1";
export const SPECIALIST_SERVICE_CODES = Object.keys(specialistProfiles).filter(code => code !== "standard_unarmed") as SpecialistServiceCode[];
export const specialistTerms = {
  version: SPECIALIST_TERMS_VERSION,
  minimumBookingHours: 12,
  quoteValidityDays: 7,
  funding: "100% of the accepted full service order must clear before offers or deployment. Zero credit days.",
  minimum: "A 12-hour priced service block per operator. Shorter assignments retain the block minimum; individual duty hours remain subject to the approved roster, rest and relief plan.",
  planning: "Minimum planning is included in the cost-floor calculation, once per booking. The quote uses the higher of the adjusted list price and cost floor plus minimum margin; planning must not be charged twice.",
  extension: "Additional time, operators, routes or scope require a separate amended quotation, client acceptance, cleared additional funding and a fresh readiness check. Never extend an officer's duty automatically. Apply actual overtime and rest obligations through the payroll and roster engines; the 12-hour block is not permission to exceed working-time limits.",
  cancellation: "Record notice time, work already delivered, evidenced unrecoverable commitments and mitigation or resale. Operations proposes a reasonable charge for review, capped at the remaining agreed service price; no blanket forfeiture or automatic refund. Apply any statutory waiver, including qualifying death or hospitalisation, and obtain legal review where required.",
  exclusion: "Armed response, cash-in-transit, offensive operations, unapproved cross-border work and guarantees of safety are excluded. Armoured vehicles are outside the current service scope. LOKD supplies its officers directly.",
  assumptions: [
    "Officer remuneration is the offered commercial amount, subject to applicable payroll minima, overtime, allowances and employment terms.",
    "The 11.5% payroll burden is a planning reserve, not a complete statutory payroll calculation; employer-specific costs must be approved.",
    "Travel allowance: R9/km per service day. Standard SUV reserve: R2,200 per day. Actual LOKD operating costs require review.",
    "Overnight allowance: R1,800 per operator per night, subject to accommodation and subsistence evidence.",
    "Any LOKD-provided vehicle requires independently reviewed fleet authority and readiness.",
    "Risk and notice premiums affect the quote. Calendar premiums are LOKD commercial multipliers; payroll still applies the relevant employment rules.",
  ],
  sources: [
    { label: "SARS VAT", url: "https://www.sars.gov.za/types-of-tax/value-added-tax/" },
    { label: "NBCPSS 2026–27 wage schedule", url: "https://nbcpss.org.za/docs/legislations/minimum-wage-increase-2026-2027/" },
    { label: "NCC cancellation guidance", url: "https://thencc.org.za/wp-content/uploads/2020/11/Explanatory-note-4-of-2023.pdf" },
  ],
};

export const specialistRateCard = SPECIALIST_SERVICE_CODES.map(code => {
  const p = specialistProfiles[code];
  return { code, label: p.label, minimumOperators: p.minimumTeamSize,
    officerShiftCents: p.officerShiftCents, listShiftCents: p.listShiftCents,
    minimumPlanningHours: p.minimumPlanningHours, planningHourlyCostCents: p.planningHourlyCostCents,
    minimumMarginBasisPoints: p.minimumMarginBasisPoints, price: indicativeSingleShiftPrice(code) };
});
export { calendarPriceBook };
export function quoteFingerprint(booking: SpecialistBooking) {
  return JSON.stringify([booking.id, booking.clientId, booking.serviceCode, booking.configuration, booking.pricingVersion,
    booking.subtotalCents, booking.vatCents, booking.totalCents, booking.costFloorCents, booking.marginBasisPoints,
    booking.headcount, booking.startsAt, booking.endsAt, SPECIALIST_TERMS_VERSION]);
}

export function requiredSpecialistChecks(booking: Pick<SpecialistBooking,"serviceCode"|"configuration">, officerIds: string[]) {
  const code = booking.serviceCode;
  const armed = ["armed_static","armed_movement","vip_armed"].includes(code);
  const vip = code.startsWith("vip_");
  const config = JSON.parse(booking.configuration) as { vehicleClass?: string; overnightDays?: number };
  const result = [
    { code: "client_contract", label: "Signed client agreement and specialist service order" },
    { code: "client_onboarding", label: "Verified client entity and authorised signatory" },
    { code: "risk_assessment", label: "Assignment risk assessment and scope approval" },
    { code: "post_orders", label: code === "armed_static" ? "Approved site instructions and post orders" : "Approved itinerary, journey and handover plan" },
    { code: "insurance", label: "Specialist insurance and scope of cover" },
    { code: "command_relief", label: "Command contact, communications, relief and fatigue plan" },
    { code: "cost_evidence", label: "Approved actual LOKD labour, employment, equipment and operating costs within the quote floor" },
  ];
  if (armed) result.push({ code:"armed_authority", label:"LOKD firearm authority, lawful issue and custody controls" });
  if (vip) result.push({ code:"principal_consent", label:"Principal consent and controlled itinerary access" });
  if (config.vehicleClass && config.vehicleClass !== "none") result.push({ code:"vehicle", label:"Vehicle authority, insurance and roadworthiness" });
  if(config.vehicleClass === 'standard_suv')result.push({code:'lokd_vehicle_authority',label:'Current LOKD fleet ownership and operating authority'});
  if (config.overnightDays) result.push({ code:"overnight", label:"Accommodation, subsistence and working-time plan" });
  for (const id of officerIds) {
    for (const [kind,label] of [["onboarding","Identity, banking and employment onboarding"],["psira","Current PSiRA grade"],["induction","Assignment induction and accepted terms"],["readiness","Current specialist readiness"]])
      result.push({code:`officer:${id}:${kind}`,label:`${id} · ${label}`});
    if (armed) result.push({code:`officer:${id}:firearm`,label:`${id} · Firearm competency and authorisation`});
    if (vip) result.push({code:`officer:${id}:protection`,label:`${id} · Protective qualification and first aid`});
    if (code === "vip_protective_driver" || code === "armed_movement") result.push({code:`officer:${id}:driving`,label:`${id} · Driving qualification and licence`});
  }
  return result;
}

export function isCurrentEvidence(from: string, until: string, startsAt: string | null, endsAt: string | null, now = new Date()) {
  const [a,b,s,e] = [from,until,startsAt,endsAt].map(x => x ? Date.parse(x) : NaN);
  return [a,b,s,e].every(Number.isFinite) && a <= now.getTime() && a <= s && b > now.getTime() && b >= e && e > s;
}

export function evaluateSpecialistPack(booking: SpecialistBooking, content: SpecialistPackContent, options: {
  commercialCurrent: boolean; quoteSnapshot?: string; now?: Date;
}) {
  const blockers: string[]=[];
  const now=options.now ?? new Date();
  if (!options.commercialCurrent) blockers.push("Commercial rate card and terms need a current independent approval.");
  if (booking.pricingVersion !== SPECIALIST_PRICING_VERSION || booking.pricingValid !== 1 || booking.pricingStatus !== "authoritative") blockers.push("The specialist quotation is invalid or requires a current commercial review.");
  if (!booking.startsAt || !booking.endsAt || Date.parse(booking.endsAt) <= now.getTime()) blockers.push("A current roster with a final end time is required.");
  if (booking.planCurrent !== 1) blockers.push("Current risk and post-order records must cover the full roster.");
  if (booking.authorityCurrent !== 1) blockers.push("Specialist authority, insurance and board approval must cover the full roster.");
  if (booking.fundingCurrent !== 1) blockers.push("Commercial readiness must be confirmed and reconciled for the full service total.");
  if (options.quoteSnapshot && options.quoteSnapshot !== quoteFingerprint(booking)) blockers.push("The quote or roster changed; prepare and review a new pack revision.");
  if (!content.commandOwner.trim() || !content.clientBrief.trim() || !content.officerBrief.trim()) blockers.push("A command owner, client scope and officer instructions are required.");
  if (new Set(content.officerIds).size !== content.officerIds.length || content.officerIds.length < booking.headcount) blockers.push(`Name at least ${booking.headcount} distinct officers, including any required relief.`);
  const config=JSON.parse(booking.configuration) as {vehicleClass?: string};
  if (config.vehicleClass === 'standard_suv' && !content.checks.some(e=>e.code==='lokd_vehicle_authority' && e.reference.trim() && isCurrentEvidence(e.validFrom,e.expiresAt,booking.startsAt,booking.endsAt,now))) blockers.push('Current LOKD fleet authority is required for the vehicle.');
  for (const required of requiredSpecialistChecks(booking,content.officerIds)) {
    const evidence=content.checks.find(x=>x.code===required.code);
    if (!evidence?.reference.trim() || !isCurrentEvidence(evidence.validFrom,evidence.expiresAt,booking.startsAt,booking.endsAt,now)) blockers.push(`${required.label}: missing or expired evidence.`);
  }
  return { ready: blockers.length===0, blockers };
}
