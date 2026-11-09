import { HOURLY_PAY_POLICY_DEFAULTS, ZA_2027_SARS_POLICY_CANDIDATE, privateSecurityMinimumWage, type PayrollPolicy } from './payroll-engine';
import type { ServiceType } from "./production-service-types";

export type SpecialistServiceCode =
  | "standard_unarmed"
  | "armed_static"
  | "armed_movement"
  | "vip_unarmed"
  | "vip_armed"
  | "vip_protective_driver"
  | "vip_team";

export type SpecialistVehicleClass =
  | "none"
  | "client_vehicle"
  | "standard_suv";

export type SpecialistConfiguration = {
  serviceCode: SpecialistServiceCode;
  teamSize: number;
  vehicleClass: SpecialistVehicleClass;
  travelKmPerServiceDay: number;
  planningHours: number;
  overnightDays: number;
};

export type SpecialistCostInput = {
  engagementModel?: string;
  payrollPolicy?: PayrollPolicy;
  payrollPolicyReference?: {id:string;hash:string};
  attendedMinutesPerShift?: number;
  serviceCode: SpecialistServiceCode;
  serviceDayCount: number;
  shiftCount: number;
  officerTotalCents: number;
  calendarAdjustedListSubtotalCents: number;
  configuration: SpecialistConfiguration;
};

export type SpecialistPricingDecision = {
  version: typeof SPECIALIST_PRICING_VERSION;
  vatRateBasisPoints: typeof LOKD_VAT_RATE_BASIS_POINTS;
  minimumMarginBasisPoints: number;
  listSubtotalCents: number;
  payrollBurdenCents: number;
  payrollCostBasisCents: number;
  hourlyPremiumBasisPoints:number;hourlyMinimumShiftMinutes:number;hourlyDivisor:number;monthlyWageBasisCents:number;payrollPolicyId:string|null;payrollPolicyHash:string|null;
  employmentCostBasis: "hourly" | "monthly";
  provisionalCoidaInsuranceReserve: {
    label: "Provisional COIDA/insurance reserve";
    status: "provisional";
    rateBasisPoints: 200;
    amountCents: number;
  };
  readinessAndEquipmentCents: number;
  commandAndSupervisionCents: number;
  planningCents: number;
  travelCents: number;
  vehicleCents: number;
  overnightCents: number;
  costFloorCents: number;
  requiredRevenueCents: number;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  marginCents: number;
  marginBasisPoints: number;
  pricingStatus: "authoritative" | "review_required";
  reviewReasons: string[];
};

type SpecialistProfile = {
  code: SpecialistServiceCode;
  serviceType: ServiceType;
  label: string;
  publicLabel: string;
  description: string;
  minimumTeamSize: number;
  maximumTeamSize: number;
  officerShiftCents: number;
  listShiftCents: number;
  minimumPlanningHours: number;
  planningHourlyCostCents: number;
  readinessCostPerShiftCents: number;
  commandCostPerServiceDayCents: number;
  minimumMarginBasisPoints: number;
  allowedVehicles: SpecialistVehicleClass[];
  requiredControls: string[];
};

export const LEGACY_SPECIALIST_PRICING_VERSION = "LOKD-SPECIALIST-2026.09-v1" as const;
export const PREVIOUS_SPECIALIST_PRICING_VERSION = "LOKD-SPECIALIST-2026.09-v2-no-vat" as const;
export const SPECIALIST_PRICING_VERSION = "LOKD-SPECIALIST-2026.11-v3-employment" as const;
// Owner-confirmed commercial policy: no VAT is charged. This is not a
// statement that South Africa's statutory VAT rate is zero. Historical orders
// keep their original version, tax amount and immutable acceptance receipt.
export const LOKD_VAT_RATE_BASIS_POINTS = 0 as const;
export function isSpecialistPricingVersion(version: string) {
  return version === SPECIALIST_PRICING_VERSION || version === PREVIOUS_SPECIALIST_PRICING_VERSION || version === LEGACY_SPECIALIST_PRICING_VERSION;
}

export const specialistProfiles: Record<SpecialistServiceCode, SpecialistProfile> = {
  standard_unarmed: {
    code: "standard_unarmed",
    serviceType: "Unarmed",
    label: "Scheduled Unarmed fixed-site",
    publicLabel: "Unarmed guarding",
    description: "A controlled fixed-site post with site-specific duties and Operations supervision.",
    minimumTeamSize: 1,
    maximumTeamSize: 6,
    officerShiftCents: 80_000,
    listShiftCents: 140_000,
    minimumPlanningHours: 0,
    planningHourlyCostCents: 0,
    readinessCostPerShiftCents: 12_000,
    commandCostPerServiceDayCents: 14_000,
    minimumMarginBasisPoints: 2_500,
    allowedVehicles: ["none"],
    requiredControls: ["Current PSiRA registration", "LOKD Unarmed readiness", "Approved site and post orders"],
  },
  armed_static: {
    code: "armed_static",
    serviceType: "Armed",
    label: "Armed static guarding",
    publicLabel: "Armed site protection",
    description: "A fixed armed post for an assessed site, distinct from response or movement work.",
    minimumTeamSize: 1,
    maximumTeamSize: 6,
    officerShiftCents: 200_000,
    listShiftCents: 480_000,
    minimumPlanningHours: 1,
    planningHourlyCostCents: 65_000,
    readinessCostPerShiftCents: 55_000,
    commandCostPerServiceDayCents: 55_000,
    minimumMarginBasisPoints: 3_000,
    allowedVehicles: ["none"],
    requiredControls: ["Armed service authority", "Current firearm competency", "Monthly Armed readiness", "Approved armed post orders"],
  },
  armed_movement: {
    code: "armed_movement",
    serviceType: "Armed",
    label: "Armed movement protection",
    publicLabel: "Armed movement support",
    description: "Planned armed protection for a defined movement, route and handover—not armed response.",
    minimumTeamSize: 1,
    maximumTeamSize: 4,
    officerShiftCents: 220_000,
    listShiftCents: 690_000,
    minimumPlanningHours: 2,
    planningHourlyCostCents: 75_000,
    readinessCostPerShiftCents: 75_000,
    commandCostPerServiceDayCents: 85_000,
    minimumMarginBasisPoints: 3_200,
    allowedVehicles: ["client_vehicle", "standard_suv"],
    requiredControls: ["Armed service authority", "Current firearm competency", "Route and handover plan", "LOKD fleet authority and readiness evidence"],
  },
  vip_unarmed: {
    code: "vip_unarmed",
    serviceType: "VIP",
    label: "Unarmed close protection",
    publicLabel: "VIP protection · unarmed",
    description: "An individually assessed protection assignment with coordinated planning and movement.",
    minimumTeamSize: 1,
    maximumTeamSize: 4,
    officerShiftCents: 450_000,
    listShiftCents: 1_150_000,
    minimumPlanningHours: 2,
    planningHourlyCostCents: 95_000,
    readinessCostPerShiftCents: 70_000,
    commandCostPerServiceDayCents: 120_000,
    minimumMarginBasisPoints: 3_500,
    allowedVehicles: ["none", "client_vehicle", "standard_suv"],
    requiredControls: ["Protective Operations qualification", "Current first aid", "Threat and movement plan", "Principal consent and itinerary control"],
  },
  vip_armed: {
    code: "vip_armed",
    serviceType: "VIP",
    label: "Armed close protection",
    publicLabel: "VIP protection · armed",
    description: "Close protection with a separately justified and controlled armed capability.",
    minimumTeamSize: 1,
    maximumTeamSize: 4,
    officerShiftCents: 550_000,
    listShiftCents: 1_650_000,
    minimumPlanningHours: 3,
    planningHourlyCostCents: 95_000,
    readinessCostPerShiftCents: 120_000,
    commandCostPerServiceDayCents: 150_000,
    minimumMarginBasisPoints: 3_700,
    allowedVehicles: ["none", "client_vehicle", "standard_suv"],
    requiredControls: ["Protective Operations qualification", "Armed service authority", "Current firearm competency", "Threat and movement plan"],
  },
  vip_protective_driver: {
    code: "vip_protective_driver",
    serviceType: "VIP",
    label: "Protective driver",
    publicLabel: "Protective driver",
    description: "A protective driver assignment with vehicle, route, handover and working-time controls.",
    minimumTeamSize: 1,
    maximumTeamSize: 2,
    officerShiftCents: 500_000,
    listShiftCents: 1_350_000,
    minimumPlanningHours: 2,
    planningHourlyCostCents: 95_000,
    readinessCostPerShiftCents: 90_000,
    commandCostPerServiceDayCents: 130_000,
    minimumMarginBasisPoints: 3_600,
    allowedVehicles: ["client_vehicle", "standard_suv"],
    requiredControls: ["Protective driving qualification", "Licence and vehicle class verified", "Route and fatigue plan", "Vehicle handover evidence"],
  },
  vip_team: {
    code: "vip_team",
    serviceType: "VIP",
    label: "Protective team",
    publicLabel: "VIP protective team",
    description: "A coordinated protection detail of two or more specialists with a team plan and command owner.",
    minimumTeamSize: 2,
    maximumTeamSize: 6,
    officerShiftCents: 480_000,
    // Quote calculations multiply this per-operator list amount by team size.
    // The minimum two-person detail therefore starts at R23,000, with no VAT charged.
    listShiftCents: 1_150_000,
    minimumPlanningHours: 4,
    planningHourlyCostCents: 95_000,
    readinessCostPerShiftCents: 80_000,
    commandCostPerServiceDayCents: 180_000,
    minimumMarginBasisPoints: 3_800,
    allowedVehicles: ["none", "client_vehicle", "standard_suv"],
    requiredControls: ["Named team leader", "Role-specific Protective Operations evidence", "Threat and movement plan", "Communications and relief plan"],
  },
};

export const defaultSpecialistConfiguration: Record<ServiceType, SpecialistConfiguration> = {
  Unarmed: { serviceCode: "standard_unarmed", teamSize: 1, vehicleClass: "none", travelKmPerServiceDay: 0, planningHours: 0, overnightDays: 0 },
  Armed: { serviceCode: "armed_static", teamSize: 1, vehicleClass: "none", travelKmPerServiceDay: 0, planningHours: 1, overnightDays: 0 },
  VIP: { serviceCode: "vip_unarmed", teamSize: 1, vehicleClass: "none", travelKmPerServiceDay: 0, planningHours: 2, overnightDays: 0 },
};

export const specialistOptionsForService = (serviceType: ServiceType) =>
  Object.values(specialistProfiles).filter((profile) => profile.serviceType === serviceType);

function boundedInteger(value: number, minimum: number, maximum: number, label: string) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function normalizeSpecialistConfiguration(
  serviceType: ServiceType,
  input?: Partial<SpecialistConfiguration>,
): SpecialistConfiguration {
  const fallback = defaultSpecialistConfiguration[serviceType];
  const serviceCode = input?.serviceCode ?? fallback.serviceCode;
  const profile = specialistProfiles[serviceCode];
  if (!profile || profile.serviceType !== serviceType) {
    throw new Error(`Choose a valid ${serviceType} service model.`);
  }
  const teamSize = boundedInteger(input?.teamSize ?? profile.minimumTeamSize, profile.minimumTeamSize, profile.maximumTeamSize, "Team size");
  const vehicleClass = input?.vehicleClass ?? fallback.vehicleClass;
  if (!profile.allowedVehicles.includes(vehicleClass)) {
    throw new Error(`${profile.label} does not support that vehicle option.`);
  }
  return {
    serviceCode,
    teamSize,
    vehicleClass,
    travelKmPerServiceDay: boundedInteger(input?.travelKmPerServiceDay ?? 0, 0, 1_500, "Travel distance"),
    planningHours: boundedInteger(input?.planningHours ?? profile.minimumPlanningHours, profile.minimumPlanningHours, 80, "Planning hours"),
    overnightDays: boundedInteger(input?.overnightDays ?? 0, 0, 60, "Overnight days"),
  };
}

function ceilDivide(numerator: number, denominator: number) {
  return Math.ceil(numerator / denominator);
}

/**
 * Internal quote floor. Statutory percentages are policy inputs, while readiness,
 * command, travel and vehicle amounts are LOKD planning assumptions and must be
 * re-approved when LOKD operating cost or insurance evidence changes.
 */
export function priceSpecialistCostFloor(input: SpecialistCostInput): SpecialistPricingDecision {
  const profile = specialistProfiles[input.serviceCode];
  const configuration = normalizeSpecialistConfiguration(profile.serviceType, input.configuration);
  if (input.serviceDayCount < 1 || input.shiftCount < 1 || input.officerTotalCents < 0) {
    throw new Error("The specialist roster economics are incomplete.");
  }

  const employmentCostBasis = input.engagementModel === 'fixed' ? 'monthly' : 'hourly';
  const policy = input.payrollPolicy ?? ZA_2027_SARS_POLICY_CANDIDATE;
  const rules = policy.hourlyPay ?? HOURLY_PAY_POLICY_DEFAULTS;
  const minutes = input.attendedMinutesPerShift ?? 720;
  if (!Number.isSafeInteger(minutes) || minutes <= 0 || minutes > 1440) throw new Error('Review the attended minutes per shift.');
  const monthlyWageBasisCents=privateSecurityMinimumWage(policy.privateSecuritySector?policy:ZA_2027_SARS_POLICY_CANDIDATE,'areas_one_and_two','C');
  const paidMinutes=Math.max(minutes,rules.minimumShiftMinutes),premium=10000+rules.premiumBasisPoints;
  const ceiling=(numerator:bigint,denominator:bigint)=>{const value=Number((numerator+denominator-BigInt(1))/denominator);if(!Number.isSafeInteger(value))throw new Error('The cost basis exceeds the supported amount.');return value;};
  // Planning reserve only. Freeze the policy inputs used; accepted historical prices stay unchanged.
  const payrollCostBasisCents=employmentCostBasis==='monthly'?input.officerTotalCents:Math.max(input.officerTotalCents,
    ceiling(BigInt(input.officerTotalCents)*BigInt(premium)*BigInt(paidMinutes),BigInt(7200000)),
    ceiling(BigInt(monthlyWageBasisCents)*BigInt(premium)*BigInt(paidMinutes)*BigInt(input.shiftCount),BigInt(rules.hourlyDivisor)*BigInt(600000)));
  const provisionalCoidaInsuranceReserve = {label:'Provisional COIDA/insurance reserve' as const,status:'provisional' as const,rateBasisPoints:200 as const,amountCents:Math.ceil(payrollCostBasisCents*200/10000)};
  const payrollBurdenCents=payrollCostBasisCents-input.officerTotalCents+Math.ceil(payrollCostBasisCents*1150/10000);
  const readinessAndEquipmentCents = profile.readinessCostPerShiftCents * input.shiftCount;
  const commandAndSupervisionCents = profile.commandCostPerServiceDayCents * input.serviceDayCount;
  const planningCents = profile.planningHourlyCostCents * configuration.planningHours;
  const travelCents = configuration.travelKmPerServiceDay * input.serviceDayCount * 900;
  const vehicleDailyCents: Record<SpecialistVehicleClass, number> = {
    none: 0,
    client_vehicle: 0,
    standard_suv: 220_000,
  };
  const vehicleCents = vehicleDailyCents[configuration.vehicleClass] * input.serviceDayCount;
  const overnightCents = configuration.overnightDays * configuration.teamSize * 180_000;
  const costFloorCents = input.officerTotalCents + payrollBurdenCents + readinessAndEquipmentCents
    + commandAndSupervisionCents + planningCents + travelCents + vehicleCents + overnightCents;
  const requiredRevenueCents = ceilDivide(costFloorCents * 10_000, 10_000 - profile.minimumMarginBasisPoints);
  const subtotalCents = Math.max(input.calendarAdjustedListSubtotalCents, requiredRevenueCents);
  const vatCents = Math.round(subtotalCents * LOKD_VAT_RATE_BASIS_POINTS / 10_000);
  const marginCents = subtotalCents - costFloorCents;
  const marginBasisPoints = subtotalCents > 0 ? Math.floor(marginCents * 10_000 / subtotalCents) : 0;
  const commercialReviewRequired = false;
  const reviewReasons = [
    ...(commercialReviewRequired ? ["Current LOKD commercial approval is required."] : []),
    ...(configuration.overnightDays ? ["Accommodation, subsistence and working-time plan require Operations review."] : []),
  ];

  return {
    version: SPECIALIST_PRICING_VERSION,
    vatRateBasisPoints: LOKD_VAT_RATE_BASIS_POINTS,
    minimumMarginBasisPoints: profile.minimumMarginBasisPoints,
    listSubtotalCents: input.calendarAdjustedListSubtotalCents,
    payrollBurdenCents,
    payrollCostBasisCents, employmentCostBasis,
    hourlyPremiumBasisPoints:rules.premiumBasisPoints,hourlyMinimumShiftMinutes:rules.minimumShiftMinutes,hourlyDivisor:rules.hourlyDivisor,monthlyWageBasisCents,payrollPolicyId:input.payrollPolicyReference?.id??null,payrollPolicyHash:input.payrollPolicyReference?.hash??null,
    provisionalCoidaInsuranceReserve,
    readinessAndEquipmentCents,
    commandAndSupervisionCents,
    planningCents,
    travelCents,
    vehicleCents,
    overnightCents,
    costFloorCents,
    requiredRevenueCents,
    subtotalCents,
    vatCents,
    totalCents: subtotalCents + vatCents,
    marginCents,
    marginBasisPoints,
    pricingStatus: commercialReviewRequired ? "review_required" : "authoritative",
    reviewReasons,
  };
}

export function indicativeSingleShiftPrice(serviceCode: SpecialistServiceCode) {
  const profile = specialistProfiles[serviceCode];
  const configuration = normalizeSpecialistConfiguration(profile.serviceType, {
    serviceCode,
    teamSize: profile.minimumTeamSize,
    vehicleClass: profile.allowedVehicles.includes("none") ? "none" : "client_vehicle",
  });
  const shiftCount = profile.minimumTeamSize;
  return priceSpecialistCostFloor({
    serviceCode,
    serviceDayCount: 1,
    shiftCount,
    officerTotalCents: profile.officerShiftCents * shiftCount,
    calendarAdjustedListSubtotalCents: profile.listShiftCents * shiftCount,
    configuration,
  });
}
