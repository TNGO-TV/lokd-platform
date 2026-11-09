import { splitAcrossIsoWeeks } from './assignment-activation-core';
import { isoWeekDateRange, type PayBasis } from './workforce-core';
import { southAfricanDate } from './payroll-calendar';

export type OfficerEmployment = {
  payBasis: PayBasis; payCadence: string; weeklyHourThreshold: number | null;
  hoursWorkedThisWeek: number; committedHoursThisWeek: number; hoursRemaining: number | null;
  exceededWeeks: number; conversionReviewRequired: boolean;
};
export async function readOfficerEmploymentSummaries(db: D1Database, officerIds?: string[], now = Date.now()) {
  const ids = officerIds ? [...new Set(officerIds)] : null;
  const workers = (await db.prepare("SELECT officer_id AS officerId,pay_basis AS payBasis,pay_cadence AS payCadence FROM workforce_engagements WHERE environment='production' AND status='active' AND active_key=officer_id AND (? IS NULL OR officer_id IN (SELECT value FROM json_each(?))) LIMIT 500").bind(ids ? JSON.stringify(ids) : null, ids ? JSON.stringify(ids) : '[]').all<{ officerId:string;payBasis: PayBasis; payCadence: string }>()).results;
  const selected = JSON.stringify(workers.map(w=>w.officerId));
  const p = await db.prepare('SELECT cap_minutes FROM current_hourly_pay_rules').first<{ cap_minutes: number }>();
  const current = isoWeekDateRange(southAfricanDate(now)).monday;
  const first = new Date(Date.parse(current) - 28 * 86400000).toISOString().slice(0, 10);
  const worked = (await db.prepare("SELECT officer_id AS officerId,check_in_at AS startsAt,COALESCE(check_out_at,?) AS endsAt FROM shifts WHERE officer_id IN (SELECT value FROM json_each(?)) AND environment='production' AND check_in_at IS NOT NULL AND julianday(check_in_at)>=julianday(?||'T00:00:00+02:00','-1 day') AND julianday(check_in_at)<julianday(?)").bind(new Date(now).toISOString(), selected, first, new Date(now).toISOString()).all<{ officerId:string;startsAt: string; endsAt: string }>()).results;
  const intervals = (await db.prepare("SELECT officer_id AS officerId,starts_at AS startsAt,ends_at AS endsAt FROM employment_work_intervals WHERE officer_id IN (SELECT value FROM json_each(?)) AND julianday(ends_at)>julianday(?||'T00:00:00+02:00') AND julianday(starts_at)<julianday(?||'T00:00:00+02:00','+7 days')").bind(selected, current, current).all<{ officerId:string;startsAt: string; endsAt: string }>()).results;
  const minutes = new Map<string,Record<string,number>>(), committed = new Map<string,number>();
  for (const interval of worked) { const weeks=minutes.get(interval.officerId)??{}; for(const segment of splitAcrossIsoWeeks(interval.startsAt,interval.endsAt)) weeks[segment.isoWeekStart]=(weeks[segment.isoWeekStart]??0)+segment.minutes; minutes.set(interval.officerId,weeks); }
  for (const interval of intervals) for(const segment of splitAcrossIsoWeeks(interval.startsAt,interval.endsAt)) if(segment.isoWeekStart===current)committed.set(interval.officerId,(committed.get(interval.officerId)??0)+segment.minutes);
  return new Map(workers.map(w=>{
    const weeks=minutes.get(w.officerId)??{},used=committed.get(w.officerId)??0,cap=w.payBasis==='hourly'&&p?p.cap_minutes:null;
    const exceededWeeks=cap===null?0:Object.entries(weeks).filter(([week,value])=>week>=first&&week<current&&value>cap).length;
    const employment:OfficerEmployment={payBasis:w.payBasis,payCadence:w.payCadence,weeklyHourThreshold:cap===null?null:cap/60,hoursWorkedThisWeek:(weeks[current]??0)/60,committedHoursThisWeek:used/60,hoursRemaining:cap===null?null:Math.max(0,cap-Math.max(used,weeks[current]??0))/60,exceededWeeks,conversionReviewRequired:w.payBasis==='hourly'&&exceededWeeks>=3};
    return [w.officerId,employment];
  }));
}
export async function readOfficerEmployment(db:D1Database,officerId:string,now=Date.now()):Promise<OfficerEmployment|null>{return (await readOfficerEmploymentSummaries(db,[officerId],now)).get(officerId)??null;}

// Attendance belongs to the Officer even if an engagement was later suspended.
export async function readOfficerHoursThisWeek(db:D1Database,officerId:string,now=Date.now()){
  const monday=isoWeekDateRange(southAfricanDate(now)).monday,instant=new Date(now).toISOString();
  const row=await db.prepare("SELECT COALESCE(SUM(max(0,(min(julianday(COALESCE(check_out_at,?)),julianday(?))-max(julianday(check_in_at),julianday(?||'T00:00:00+02:00')))*24)),0) AS hours FROM shifts WHERE officer_id=? AND environment='production' AND check_in_at IS NOT NULL AND julianday(check_in_at)<julianday(?) AND julianday(COALESCE(check_out_at,?))>julianday(?||'T00:00:00+02:00')").bind(instant,instant,monday,officerId,instant,instant,monday).first<{hours:number}>();
  return Math.round((row?.hours??0)*60)/60;
}
