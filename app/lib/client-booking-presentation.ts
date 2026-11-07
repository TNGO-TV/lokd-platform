import type { ClientBooking } from './booking-client-types';
import { bookingModelLabel } from './booking-models';
import { scheduleLabel } from './booking-schedule';
export function confirmedBookingFacts(booking:ClientBooking){
 const date=(value:string)=>new Intl.DateTimeFormat('en-ZA',{dateStyle:'long',timeZone:'Africa/Johannesburg'}).format(new Date(value+'T12:00:00+02:00'));
 const grade=booking.serviceType==='Unarmed'?(booking.minimumGrade?booking.minimumGrade+' Guard':'PSIRA grade under review'):booking.serviceType==='Armed'?'Armed site security':booking.serviceType;
 return {siteName:booking.siteName.toUpperCase(),grade,rows:[
  ['Schedule',(booking.coverageShifts===2?'24 Hours · 2 Shifts':'12 Hours · 1 Shift')+'\n'+scheduleLabel(booking.rosterPattern??'')+(booking.includePublicHolidays?'\nPublic holidays included':'')],
  ['Officers',booking.headcount?String(booking.headcount)+' per shift':'Allocation under review'],
  ['Service',bookingModelLabel(booking.engagementModel)+(booking.engagementModel==='fixed'&&booking.contractMonths?' · '+booking.contractMonths+' Months':'')],
  ['Service Start Date',date(booking.startDate)],['Service End Date',date(booking.endDate)],
 ]};
}
