export type SchedulePattern = 'weekdays' | 'monday_saturday' | 'daily' | 'saturdays' | 'weekends' | 'public_holidays';
export type CoverageShift = 'day' | 'night' | 'both';
export const scheduleOptions = [
  {value:'daily',label:'Every day'},
  {value:'weekdays',label:'Weekdays · Monday–Friday'},
  {value:'saturdays',label:'Weekends excluding Sunday · Saturday'},
  {value:'weekends',label:'Weekends including Sunday · Saturday–Sunday'},
  {value:'public_holidays',label:'Public holidays only'},
] as const;
export const scheduleLabel = (pattern: string) => scheduleOptions.find(p=>p.value===pattern)?.label ?? (pattern==='monday_saturday'?'Monday–Saturday':'Schedule under review');
export const coverageLabel = (shift: string) => shift==='both'?'24 Hours · 2 Shifts':'12 Hours · 1 Shift';
export function validServiceDate(value:unknown):value is string { return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value; }
export function addCalendarDays(value:string,days:number){return new Date(Date.parse(value+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);}
export function publicHolidaysForYear(year:number){
  if(!Number.isSafeInteger(year)||year<1900||year>2200)throw new Error('Choose a supported calendar year.');
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1,easter=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const fixed=[['01-01','New Year’s Day'],['03-21','Human Rights Day'],['04-27','Freedom Day'],['05-01','Workers’ Day'],['06-16','Youth Day'],['08-09','National Women’s Day'],['09-24','Heritage Day'],['12-16','Day of Reconciliation'],['12-25','Christmas Day'],['12-26','Day of Goodwill']];
  const holidays=[...fixed.map(([date,name])=>({date:year+'-'+date,name,observed:false})),{date:addCalendarDays(easter,-2),name:'Good Friday',observed:false},{date:addCalendarDays(easter,1),name:'Family Day',observed:false}];
  return [...holidays,...holidays.filter(h=>new Date(h.date+'T00:00:00Z').getUTCDay()===0).map(h=>({...h,date:addCalendarDays(h.date,1),name:h.name+' (observed)',observed:true}))].sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
}
export function publicHolidayName(date:string){if(!validServiceDate(date))return null;return publicHolidaysForYear(Number(date.slice(0,4))).filter(h=>h.date===date).map(h=>h.name).join(' / ')||null;}
export function scheduledDates(start:string,end:string,pattern:SchedulePattern,includePublicHolidays=false){
  if(!validServiceDate(start)||!validServiceDate(end)||end<start||Date.parse(end)-Date.parse(start)>370*86400000)throw new Error('Choose valid service start and end dates within one year.');
  const weekdays:Record<SchedulePattern,number[]>={daily:[0,1,2,3,4,5,6],weekdays:[1,2,3,4,5],monday_saturday:[1,2,3,4,5,6],saturdays:[6],weekends:[0,6],public_holidays:[]};
  if(!Object.hasOwn(weekdays,pattern))throw new Error('Choose your schedule days.');
  const holidays=new Set([...new Set([Number(start.slice(0,4)),Number(end.slice(0,4))])].flatMap(year=>publicHolidaysForYear(year).map(h=>h.date))),result:string[]=[];
  for(let date=start;date<=end;date=addCalendarDays(date,1))if(weekdays[pattern].includes(new Date(date+'T00:00:00Z').getUTCDay())||holidays.has(date)&&(includePublicHolidays||pattern==='public_holidays'))result.push(date);
  return result;
}
