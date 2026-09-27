import { calendarPriceBook, defaultRiskInput, quoteBooking } from "./pilot-pricing";
import { indicativeSingleShiftPrice, SPECIALIST_PRICING_VERSION, specialistProfiles, type SpecialistServiceCode } from "./specialist-pricing";
import { PRODUCTION_ONBOARDING_BLOCKERS } from "./onboarding-core";
import { ZA_2027_SARS_POLICY_CANDIDATE } from "./payroll-engine";
import { runPayrollShadowValidation } from "./payroll-shadow";
import { advanceFundingDecision } from "./operator-controls";
import type { SpecialistBooking, SpecialistPackContent, SpecialistPartner, SpecialistScenarioResult } from "./specialist-operations-types";

export const SPECIALIST_TERMS_VERSION = "LOKD-SPECIALIST-TERMS-2026.09-v1";
export const SPECIALIST_SERVICE_CODES = Object.keys(specialistProfiles).filter(code => code !== "standard_unarmed") as SpecialistServiceCode[];
export const specialistTerms = {
  version: SPECIALIST_TERMS_VERSION,
  minimumBookingHours: 12,
  quoteValidityDays: 7,
  funding: "100% of the accepted full service order must clear before offers or deployment. Zero credit days.",
  minimum: "A 12-hour priced service block per operator. Shorter assignments retain the block minimum; individual duty hours remain subject to the approved roster, rest and relief plan.",
  planning: "Minimum planning is included in the cost-floor calculation, once per booking. The quote uses the higher of the adjusted list price and cost floor plus minimum margin; planning must not be charged twice.",
  extension: "Additional time, operators, routes or scope require a separate amended quotation, client acceptance and a fresh readiness check. Never extend an officer's duty automatically. Apply actual overtime and rest obligations through the payroll and roster engines; the 12-hour block is not permission to exceed working-time limits.",
  cancellation: "Record notice time, work already delivered, evidenced unrecoverable commitments and mitigation or resale. Operations proposes a reasonable charge for review, capped at the remaining agreed service price; no blanket forfeiture or automatic refund. Apply any statutory waiver, including qualifying death or hospitalisation, and obtain legal review where required.",
  exclusion: "Armed response, cash-in-transit, offensive operations, unapproved cross-border work and guarantees of safety are excluded. Armoured vehicles require a verified partner quotation and remain blocked under the current pricing policy.",
  assumptions: [
    "Officer remuneration is the offered commercial amount, subject to applicable payroll minima, overtime, allowances and employment terms.",
    "The 11.5% payroll burden is a planning reserve, not a complete statutory payroll calculation; employer-specific costs must be approved.",
    "Travel allowance: R9/km per service day. Standard SUV reserve: R2,200 per day. Neither is a confirmed supplier price.",
    "Overnight allowance: R1,800 per operator per night, subject to accommodation and subsistence evidence.",
    "Armoured-partner reserve: R15,000/day, blocked pending a supported verified-price amendment.",
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
export const specialistProductionBlockers = [...PRODUCTION_ONBOARDING_BLOCKERS,
  "Commercial cost assumptions, final specialist contract terms, authority and insurance need evidenced approval.",
  "Every actual client, named specialist and supplier requires verified onboarding; rehearsal identities cannot satisfy this gate.",
];

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
    { code: "cost_evidence", label: "Approved actual labour, employer, equipment and supplier costs within the quote floor" },
  ];
  if (armed) result.push({ code:"armed_authority", label:"Provider firearm authority, lawful issue and custody controls" });
  if (vip) result.push({ code:"principal_consent", label:"Principal consent and controlled itinerary access" });
  if (config.vehicleClass && config.vehicleClass !== "none") result.push({ code:"vehicle", label:"Vehicle, insurance, roadworthiness and supplier quote" });
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
  commercialCurrent: boolean; partner?: SpecialistPartner; quoteSnapshot?: string; now?: Date;
}) {
  const blockers: string[]=[];
  const now=options.now ?? new Date();
  if (!options.commercialCurrent) blockers.push("Commercial rate card and terms need a current independent approval.");
  if (booking.pricingVersion !== SPECIALIST_PRICING_VERSION || booking.pricingValid !== 1 || booking.pricingStatus !== "authoritative") blockers.push("The specialist quotation is invalid or still requires a partner-price review.");
  if (!booking.startsAt || !booking.endsAt || Date.parse(booking.endsAt) <= now.getTime()) blockers.push("A current roster with a final end time is required.");
  if (booking.planCurrent !== 1) blockers.push("Current risk and post-order records must cover the full roster.");
  if (booking.authorityCurrent !== 1) blockers.push("Specialist authority, insurance and board approval must cover the full roster.");
  if (booking.fundingCurrent !== 1) blockers.push("The exact full advance payment must be cleared and reconciled.");
  if (options.quoteSnapshot && options.quoteSnapshot !== quoteFingerprint(booking)) blockers.push("The quote or roster changed; prepare and review a new pack revision.");
  if (!content.commandOwner.trim() || !content.clientBrief.trim() || !content.officerBrief.trim()) blockers.push("A command owner, client scope and officer instructions are required.");
  if (new Set(content.officerIds).size !== content.officerIds.length || content.officerIds.length < booking.headcount) blockers.push(`Name at least ${booking.headcount} distinct officers, including any required relief.`);
  const config=JSON.parse(booking.configuration) as {vehicleClass?: string};
  if (config.vehicleClass === "standard_suv" || config.vehicleClass === "armoured_partner" || content.partnerId) {
    const p=options.partner;
    if (!p || p.status !== "approved" || !p.serviceCodes.includes(booking.serviceCode) || !isCurrentEvidence(p.validFrom,p.expiresAt,booking.startsAt,booking.endsAt,now)) blockers.push("An approved partner with current scope and evidence is required.");
  }
  for (const required of requiredSpecialistChecks(booking,content.officerIds)) {
    const evidence=content.checks.find(x=>x.code===required.code);
    if (!evidence?.reference.trim() || !isCurrentEvidence(evidence.validFrom,evidence.expiresAt,booking.startsAt,booking.endsAt,now)) blockers.push(`${required.label}: missing or expired evidence.`);
  }
  return { ready: blockers.length===0, blockers };
}

export function runSpecialistRehearsals(now = new Date()): SpecialistScenarioResult[] {
  const payroll=runPayrollShadowValidation(ZA_2027_SARS_POLICY_CANDIDATE);
  const future = new Date(now.getTime()+14*86400000); while(future.getUTCDay()!==2) future.setUTCDate(future.getUTCDate()+1);
  const date=future.toISOString().slice(0,10);
  return (["armed_static","armed_movement","vip_unarmed","vip_armed"] as SpecialistServiceCode[]).map(code=>{
    const profile=specialistProfiles[code];
    const quote=quoteBooking({serviceType:profile.serviceType,engagementModel:"flex",term:"single",purposeCode:code==="armed_static"?"high_value_retail":code==="armed_movement"?"secure_logistics":"executive_protection",startDate:date,shift:"day",rosterPattern:"daily",riskInput:defaultRiskInput,specialistConfiguration:{serviceCode:code,vehicleClass:code==="armed_movement"?"client_vehicle":"none"},now});
    const booking:SpecialistBooking={id:`REHEARSAL-${code}`,clientId:"SYNTHETIC",siteName:"Synthetic Johannesburg assignment",serviceCode:code,configuration:JSON.stringify(quote.specialistConfiguration),pricingVersion:quote.version,subtotalCents:quote.subtotalCents,vatCents:quote.vatCents,totalCents:quote.clientPriceCents,costFloorCents:quote.costFloorCents,marginBasisPoints:quote.marginBasisPoints,headcount:quote.headcount,startsAt:`${date}T04:00:00.000Z`,endsAt:`${date}T16:00:00.000Z`,pricingStatus:quote.pricingStatus,pricingValid:1,planCurrent:1,authorityCurrent:1,fundingCurrent:1,environment:"demo"};
    const content:SpecialistPackContent={commandOwner:"Synthetic command",clientBrief:"Synthetic scope",officerBrief:"Synthetic assignment instructions",officerIds:Array.from({length:quote.headcount},(_,i)=>`SYNTHETIC-${i+1}`),partnerId:"",checks:[]};
    const validFrom=new Date(now.getTime()-86400000).toISOString(); const expiresAt=new Date(future.getTime()+86400000*3).toISOString();
    content.checks=requiredSpecialistChecks(booking,content.officerIds).map(x=>({code:x.code,reference:`demo://${x.code}`,validFrom,expiresAt}));
    const ready=evaluateSpecialistPack(booking,content,{commercialCurrent:true,now});
    const shortFunding=advanceFundingDecision({creditTermsDays:0,fundingModel:"advance_only",bookingAmountCents:booking.totalCents,expectedAmountCents:booking.totalCents,clearedAmountCents:booking.totalCents-1,status:"cleared_reconciled",evidenceReference:"demo://underfunded-test"});
    const expired={...content,checks:content.checks.map((x,i)=>i===0?{...x,expiresAt:validFrom}:x)};
    const steps=[
      {label:"Configured quote and cost floor",passed:quote.marginBasisPoints>=quote.minimumMarginBasisPoints,detail:"Risk, team, planning, employer reserve and minimum margin calculated by the booking engine."},
      {label:"Amount match",passed:quote.clientPriceCents===quote.subtotalCents+quote.vatCents && !shortFunding.ready && !evaluateSpecialistPack({...booking,fundingCurrent:0},content,{commercialCurrent:true,now}).ready,detail:"A one-cent shortfall is rejected; an uncleared booking cannot become pack-ready."},
      {label:"Evidence and assignment pack",passed:ready.ready,detail:ready.ready?"Complete synthetic scope, contract references, personnel and readiness evidence pass.":ready.blockers.join(" ")},
      {label:"Expired evidence blocks review",passed:!evaluateSpecialistPack(booking,expired,{commercialCurrent:true,now}).ready,detail:"A single expired document makes the pack unavailable for approval."},
      {label:"Quote change invalidates approval",passed:!evaluateSpecialistPack({...booking,totalCents:booking.totalCents+1},content,{commercialCurrent:true,quoteSnapshot:quoteFingerprint(booking),now}).ready,detail:"The approved snapshot must match the current quote and roster."},
      {label:"Authority withdrawal blocks release",passed:!evaluateSpecialistPack({...booking,authorityCurrent:0},content,{commercialCurrent:true,now}).ready,detail:"Specialist authority is checked again at use time."},
      {label:"Attendance and payroll validation",passed:payroll.status==="passed"&&payroll.failedCount===0,detail:`${payroll.passedCount}/${payroll.scenarioCount} existing shadow-payroll cases pass. Available for withdrawal and Awaiting approval remain separate; no real attendance is asserted.`},
      {label:"Settlement remains locked",passed:payroll.settlementLocked&&!payroll.activationEligible,detail:"The shadow payroll cannot authorise a payslip, payment or production activation."},
    ];
    return {serviceCode:code,label:profile.label,status:steps.every(s=>s.passed)?"passed":"failed",totalCents:quote.clientPriceCents,steps};
  });
}
