import type { ServiceType } from "./pilot-types";

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
  | "standard_suv"
  | "armoured_partner";

export type SpecialistConfiguration = {
  serviceCode: SpecialistServiceCode;
  teamSize: number;
  vehicleClass: SpecialistVehicleClass;
  travelKmPerServiceDay: number;
  planningHours: number;
  overnightDays: number;
};

export type SpecialistCostInput = {
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
  readinessAndEquipmentCents: number;
  commandAndSupervisionCents: number;
  planningCents: number;
  travelCents: number;
  vehicleAndPartnerCents: number;
  overnightCents: number;
  costFloorCents: number;
  requiredRevenueCents: number;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  marginCents: number;
  marginBasisPoints: number;
  pricingStatus: "authoritative" | "partner_review_required";
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
export const SPECIALIST_PRICING_VERSION = "LOKD-SPECIALIST-2026.09-v2-no-vat" as const;
// Owner-confirmed commercial policy: no VAT is charged. This is not a
// statement that South Africa's statutory VAT rate is zero. Historical orders
// keep their original version, tax amount and immutable acceptance receipt.
export const LOKD_VAT_RATE_BASIS_POINTS = 0 as const;
export function isSpecialistPricingVersion(version: string) {
  return version === SPECIALIST_PRICING_VERSION || version === LEGACY_SPECIALIST_PRICING_VERSION;
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
    allowedVehicles: ["client_vehicle", "standard_suv", "armoured_partner"],
    requiredControls: ["Armed service authority", "Current firearm competency", "Route and handover plan", "Vehicle and partner evidence"],
  },
  vip_unarmed: {
    code: "vip_unarmed",
    serviceType: "VIP",
    label: "Unarmed close protection",
    publicLabel: "VIP protection · unarmed",
    description: "An individually assessed protection assignment with advance planning and movement coordination.",
    minimumTeamSize: 1,
    maximumTeamSize: 4,
    officerShiftCents: 450_000,
    listShiftCents: 1_150_000,
    minimumPlanningHours: 2,
    planningHourlyCostCents: 95_000,
    readinessCostPerShiftCents: 70_000,
    commandCostPerServiceDayCents: 120_000,
    minimumMarginBasisPoints: 3_500,
    allowedVehicles: ["none", "client_vehicle", "standard_suv", "armoured_partner"],
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
    allowedVehicles: ["none", "client_vehicle", "standard_suv", "armoured_partner"],
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
    allowedVehicles: ["client_vehicle", "standard_suv", "armoured_partner"],
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
    allowedVehicles: ["none", "client_vehicle", "standard_suv", "armoured_partner"],
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
 * re-approved when supplier or insurance evidence changes.
 */
export function priceSpecialistCostFloor(input: SpecialistCostInput): SpecialistPricingDecision {
  const profile = specialistProfiles[input.serviceCode];
  const configuration = normalizeSpecialistConfiguration(profile.serviceType, input.configuration);
  if (input.serviceDayCount < 1 || input.shiftCount < 1 || input.officerTotalCents < 0) {
    throw new Error("The specialist roster economics are incomplete.");
  }

  // Employer PSSPF 7.5%, UIF 1%, SDL 1%, plus a 2% provisional COIDA/insurance reserve.
  const payrollBurdenCents = Math.ceil(input.officerTotalCents * 1_150 / 10_000);
  const readinessAndEquipmentCents = profile.readinessCostPerShiftCents * input.shiftCount;
  const commandAndSupervisionCents = profile.commandCostPerServiceDayCents * input.serviceDayCount;
  const planningCents = profile.planningHourlyCostCents * configuration.planningHours;
  const travelCents = configuration.travelKmPerServiceDay * input.serviceDayCount * 900;
  const vehicleDailyCents: Record<SpecialistVehicleClass, number> = {
    none: 0,
    client_vehicle: 0,
    standard_suv: 220_000,
    armoured_partner: 1_500_000,
  };
  const vehicleAndPartnerCents = vehicleDailyCents[configuration.vehicleClass] * input.serviceDayCount;
  const overnightCents = configuration.overnightDays * configuration.teamSize * 180_000;
  const costFloorCents = input.officerTotalCents + payrollBurdenCents + readinessAndEquipmentCents
    + commandAndSupervisionCents + planningCents + travelCents + vehicleAndPartnerCents + overnightCents;
  const requiredRevenueCents = ceilDivide(costFloorCents * 10_000, 10_000 - profile.minimumMarginBasisPoints);
  const subtotalCents = Math.max(input.calendarAdjustedListSubtotalCents, requiredRevenueCents);
  const vatCents = Math.round(subtotalCents * LOKD_VAT_RATE_BASIS_POINTS / 10_000);
  const marginCents = subtotalCents - costFloorCents;
  const marginBasisPoints = subtotalCents > 0 ? Math.floor(marginCents * 10_000 / subtotalCents) : 0;
  const partnerReviewRequired = configuration.vehicleClass === "armoured_partner";
  const reviewReasons = [
    ...(partnerReviewRequired ? ["An independently verified armoured-vehicle partner quote must replace the conservative reserve."] : []),
    ...(configuration.overnightDays ? ["Accommodation, subsistence and working-time plan require Operations review."] : []),
  ];

  return {
    version: SPECIALIST_PRICING_VERSION,
    vatRateBasisPoints: LOKD_VAT_RATE_BASIS_POINTS,
    minimumMarginBasisPoints: profile.minimumMarginBasisPoints,
    listSubtotalCents: input.calendarAdjustedListSubtotalCents,
    payrollBurdenCents,
    readinessAndEquipmentCents,
    commandAndSupervisionCents,
    planningCents,
    travelCents,
    vehicleAndPartnerCents,
    overnightCents,
    costFloorCents,
    requiredRevenueCents,
    subtotalCents,
    vatCents,
    totalCents: subtotalCents + vatCents,
    marginCents,
    marginBasisPoints,
    pricingStatus: partnerReviewRequired ? "partner_review_required" : "authoritative",
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
