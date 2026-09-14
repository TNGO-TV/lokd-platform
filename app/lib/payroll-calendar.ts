// Finance-owner decision, 14 September 2026: calendar dates are Africa/Johannesburg.
// Instants remain UTC. Dates are inclusive service-date labels, never parsed in the host timezone.
export const PAYROLL_CALENDAR='Africa/Johannesburg' as const;
export function southAfricanDate(instant:Date|string|number=new Date()){
 const time=new Date(instant).getTime();if(!Number.isFinite(time))throw new Error('Invalid calendar instant.');
 return new Date(time+2*60*60*1000).toISOString().slice(0,10);
}
export function payrollPeriodDatesValid(start:string,end:string,payDate:string,instant:Date|string|number=new Date()){
 const valid=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 return valid(start)&&valid(end)&&valid(payDate)&&start<=end&&end<=southAfricanDate(instant)&&payDate>=end;
}
