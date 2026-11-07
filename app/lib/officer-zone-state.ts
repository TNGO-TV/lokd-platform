export type OfficerOffer = { id: string; amountCents: number; expiresAt: string; siteName: string; siteArea: string; postName: string; serviceType: string; startDate: string; endDate: string; shiftStart: string; shiftEnd: string };
export type OfficerShift = { id: string; status: string; scheduledDate: string; startsAt: string; endsAt: string; siteName: string; siteArea: string; postName: string; address: string; checkInAt: string | null; checkOutAt: string | null; earningsCents: number };
export type OfficerStatement = { id: string; grossCents: number; deductionCents: number; netCents: number; periodStart: string; periodEnd: string; payDate: string; calculation: Record<string, unknown> };
export type OfficerZoneState = { officer: { id: string; fullName: string; mobile: string; email: string; city: string; psiraNumber: string; psiraGrade: string; psiraExpiry: string; approvalStatus: string } | null; applications: { id: string; status: string; fullName: string; version: number }[]; offers: OfficerOffer[]; shifts: OfficerShift[]; timesheets: { id: string; shiftId: string; serviceDate: string; recordedMinutes: number; payableMinutes: number | null; status: string; clientStatus: string }[]; statements: OfficerStatement[]; notifications: { id: string; message: string; createdAt: string }[]; emailEnabled: boolean };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string');
export function officerZoneResponse(value: unknown): value is { state: OfficerZoneState; result?: { message: string; notification?: { sent: boolean } } } {
  if (!record(value) || !record(value.state)) return false;
  const s = value.state;
  return (s.officer === null || record(s.officer) && strings(s.officer, ['id', 'fullName', 'mobile', 'email', 'city', 'psiraNumber', 'psiraGrade', 'psiraExpiry', 'approvalStatus']))
    && typeof s.emailEnabled === 'boolean'
    && Array.isArray(s.applications) && s.applications.every(row => record(row) && strings(row, ['id', 'status', 'fullName']) && Number.isSafeInteger(row.version))
    && Array.isArray(s.offers) && s.offers.every(row => record(row) && strings(row, ['id', 'expiresAt', 'siteName', 'siteArea', 'postName', 'serviceType', 'startDate', 'endDate', 'shiftStart', 'shiftEnd']) && Number.isSafeInteger(row.amountCents))
    && Array.isArray(s.shifts) && s.shifts.every(row => record(row) && strings(row, ['id', 'status', 'scheduledDate', 'startsAt', 'endsAt', 'siteName', 'siteArea', 'postName', 'address']) && Number.isSafeInteger(row.earningsCents) && (row.checkInAt === null || typeof row.checkInAt === 'string') && (row.checkOutAt === null || typeof row.checkOutAt === 'string'))
    && Array.isArray(s.timesheets) && s.timesheets.every(row => record(row) && strings(row, ['id', 'shiftId', 'serviceDate', 'status', 'clientStatus']) && Number.isSafeInteger(row.recordedMinutes) && (row.payableMinutes === null || Number.isSafeInteger(row.payableMinutes)))
    && Array.isArray(s.statements) && s.statements.every(row => record(row) && strings(row, ['id', 'periodStart', 'periodEnd', 'payDate']) && ['grossCents', 'deductionCents', 'netCents'].every(key => Number.isSafeInteger(row[key])) && record(row.calculation))
    && Array.isArray(s.notifications) && s.notifications.every(row => record(row) && strings(row, ['id', 'message', 'createdAt']));
}
