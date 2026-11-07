import type { SignupRecord } from './signup-types';

export type ClientSite = { id: string; name: string; area: string; address: string; latitude: number | null; longitude: number | null; version: number; status: string; publicNote: string | null; editable: boolean };
export type ClientCoverDetails = { siteId: string; siteName: string; siteArea: string; address: string; serviceType: 'Unarmed' | 'Armed' | 'VIP'; startDate: string; endDate: string; shiftStart: string; shiftEnd: string; headcount: number; note: string; engagementModel?: 'bolt' | 'flex' | 'fixed'; coverType?: 'bolt' | 'flex' | 'fixed'; durationWeeks?: number; modelVersion?: string; requestedAt?: string; serviceCode?: string; serviceLabel?: string; contractMonths?: number; rosterPattern?: string; coverageShifts?:number;serviceDates?:string[];includePublicHolidays?:boolean;shift?:'day'|'night'|'both' };
export type ClientRequest = { id: string; category: string; status: string; summary: string; detail: Record<string, unknown>; version: number; createdAt: string; bookingId: string | null; shiftId: string | null };
export type ClientBooking = { id: string; siteName: string; siteArea: string; serviceType: string; startDate: string; endDate: string; shiftStart: string; shiftEnd: string; status: string; displayStatus: string; fundingStatus: string; totalCents: number; priceConfirmed?: boolean; version: number; canCancel: boolean; cancellationMessage: string; engagementModel?: string; durationWeeks?: number; contractMonths?: number; rosterPattern?: string; headcount?: number; coverageShifts?:number;includePublicHolidays?:boolean;minimumGrade?: string; serviceCode?: string };
export type ClientShift = { id: string; bookingId: string; siteName: string; scheduledDate: string; status: string; officerName: string; grade: string; passportNumber: string | null; passportStatus: string; passportVerifiedAt: string | null; checkInAt: string | null; checkOutAt: string | null; minutesOnSite: number; clientSignoffStatus: string; timesheetVersion: number | null; feedbackScore: number | null };
export type ClientWorkspace = {
  account: { id: string; organisationName: string; contactName: string; email: string; approvalStatus: string } | null;
  enquiries: SignupRecord[];
  sites: ClientSite[];
  requests: ClientRequest[];
  bookings: ClientBooking[];
  shifts: ClientShift[];
  notifications: { id: string; sourceId: string; subject: string; state: string; error: string | null; createdAt: string }[];
  cancellationPolicy: string;
};
