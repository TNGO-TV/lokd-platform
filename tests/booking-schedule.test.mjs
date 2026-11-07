import assert from 'node:assert/strict';
import test from 'node:test';
import { publicHolidaysForYear, publicHolidayName, scheduledDates } from '../app/lib/booking-schedule.ts';
import { bookingModelSchedule } from '../app/lib/booking-models.ts';
import { quoteBooking, officerShiftEconomicsForRoster } from '../app/lib/production-pricing.ts';
import { confirmedBookingFacts } from '../app/lib/client-booking-presentation.ts';
test('all twelve statutory South African holidays and observed Mondays appear in each annual calendar',()=>{
 const y2026=publicHolidaysForYear(2026),y2027=publicHolidaysForYear(2027);
 for(const holidays of [y2026,y2027])assert.equal(holidays.filter(h=>!h.observed).length,12);
 for(const name of ['New Year’s Day','Human Rights Day','Good Friday','Family Day','Freedom Day','Workers’ Day','Youth Day','National Women’s Day','Heritage Day','Day of Reconciliation','Christmas Day','Day of Goodwill'])assert.ok(y2026.some(h=>h.name===name));
 assert.equal(publicHolidayName('2026-04-03'),'Good Friday');assert.equal(publicHolidayName('2026-04-06'),'Family Day');
 assert.equal(publicHolidayName('2026-08-10'),'National Women’s Day (observed)');
 assert.equal(publicHolidayName('2027-03-22'),'Human Rights Day (observed)');assert.equal(publicHolidayName('2027-12-27'),'Day of Goodwill (observed)');
 assert.equal(publicHolidayName('2026-04-05'),null,'Easter Sunday retains its existing premium but is not a separate statutory public holiday');
});
test('weekday, Saturday, weekend and holiday selections produce distinct dated schedules without duplicates',()=>{
 const select=(pattern,holidays=false)=>scheduledDates('2026-12-01','2026-12-31',pattern,holidays);
 assert.ok(select('weekdays').every(d=>new Date(d).getUTCDay()>=1&&new Date(d).getUTCDay()<=5));
 assert.deepEqual(select('saturdays'),['2026-12-05','2026-12-12','2026-12-19','2026-12-26']);
 assert.equal(select('weekends').length,8);assert.deepEqual(select('public_holidays'),['2026-12-16','2026-12-25','2026-12-26']);
 const combined=select('weekends',true);assert.ok(combined.includes('2026-12-16'));assert.ok(combined.includes('2026-12-25'));assert.equal(combined.length,new Set(combined).size);
 assert.deepEqual(scheduledDates('2026-08-09','2026-08-10','public_holidays'),['2026-08-09','2026-08-10']);
});
test('Flex requires seven actual scheduled dates in one calendar month, including non-consecutive weekend cover',()=>{
 const input={model:'flex',startDate:'2026-12-01',endDate:'2026-12-31',shift:'both',rosterPattern:'weekends',durationWeeks:0},now=Date.parse('2026-11-20');
 assert.equal(bookingModelSchedule(input,now).serviceDates.length,8);assert.equal(bookingModelSchedule(input,now).coverageShifts,2);
 assert.throws(()=>bookingModelSchedule({...input,rosterPattern:'saturdays'},now),/seven scheduled/);
 assert.throws(()=>bookingModelSchedule({...input,endDate:'2027-01-01'},now),/calendar month/);
 assert.throws(()=>bookingModelSchedule({...input,durationWeeks:2},now),/calendar month/);
});
test('two-shift coverage prices both shifts and preserves distinct ordinary, Sunday and public-holiday officer rates',()=>{
 const input={serviceType:'Unarmed',engagementModel:'fixed',term:'3',startDate:'2026-12-01',shift:'both',rosterPattern:'weekends',includePublicHolidays:true,specialistConfiguration:{teamSize:2},riskInput:{assetExposure:'standard',publicAccess:'controlled',incidentHistory:'none',existingControls:'strong',nightOperation:true,vulnerablePeople:false}};
 const quote=quoteBooking(input),single=quoteBooking({...input,shift:'day'});
 assert.ok(quote.serviceDates.includes('2026-12-16'));assert.equal(quote.shiftCount,quote.serviceDayCount*2*2);assert.equal(quote.officerTotalCents,single.officerTotalCents*2);assert.equal(quote.baseClientCents,single.baseClientCents*2);
 const offer=date=>officerShiftEconomicsForRoster({startsAt:date+'T04:00:00Z',serviceType:'Unarmed',engagementModel:'fixed',serviceDate:date,riskBand:quote.risk.band,specialistServiceCode:'standard_unarmed'}).officerOfferCents;
 assert.ok(offer('2026-12-06')>offer('2026-12-05'));assert.ok(offer('2026-12-16')>offer('2026-12-06'));assert.ok(offer('2026-12-25')>offer('2026-12-16'));
 assert.equal(quote.officerTotalCents,quote.serviceDates.reduce((sum,d)=>sum+offer(d)*2*2,0));
});
test('confirmed booking cards use the actual grade, officer count, coverage and service term',()=>{
 const facts=confirmedBookingFacts({siteName:'Sandton Business Park',serviceType:'Unarmed',minimumGrade:'Grade D',coverageShifts:2,rosterPattern:'weekends',headcount:2,engagementModel:'fixed',contractMonths:6,startDate:'2026-11-01',endDate:'2027-04-30',includePublicHolidays:true});
 assert.equal(facts.siteName,'SANDTON BUSINESS PARK');assert.equal(facts.grade,'Grade D Guard');assert.equal(facts.rows.find(([k])=>k==='Officers')[1],'2 per shift');assert.equal(facts.rows.find(([k])=>k==='Service')[1],'LOKD Fixed · 6 Months');assert.match(facts.rows.find(([k])=>k==='Schedule')[1],/24 Hours · 2 Shifts[\s\S]*Saturday–Sunday[\s\S]*Public holidays/);assert.ok(facts.rows.some(([k])=>k==='Service Start Date'));assert.ok(facts.rows.some(([k])=>k==='Service End Date'));
});
