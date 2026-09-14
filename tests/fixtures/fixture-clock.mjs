import {DatabaseSync} from 'node:sqlite';

// Disposable-fixture clock only. Keep JavaScript and SQLite's notion of "now"
// aligned while simulating elapsed service; never rewrite stored evidence dates.
export function installFixtureClock(context,database,initial=Date.now()){
 let current=initial;
 const native=new DatabaseSync(':memory:');
 context.mock.timers.enable({apis:['Date'],now:current});
 const iso=()=>new Date(current).toISOString();
 for(const name of ['julianday','unixepoch','datetime','date','time','strftime']){
  database.function(name,{varargs:true},(...args)=>{
   if(name==='strftime'&&args.length===0)return native.prepare('SELECT strftime() AS value').get().value;
   const values=args.length?[...args]:['now'];
   const timeIndex=name==='strftime'?1:0;
   if(['subsec','subsecond'].includes(values[timeIndex]))values.splice(timeIndex,0,iso());
   if(name==='strftime'&&values.length===1)values.push('now');
   for(let i=name==='strftime'?1:0;i<values.length;i++)if(values[i]==='now')values[i]=iso();
   return native.prepare(`SELECT ${name}(${values.map(()=>'?').join(',')}) AS value`).get(...values).value;
  });
 }
 database.function('current_timestamp',()=>iso().slice(0,19).replace('T',' '));
 database.function('current_date',()=>iso().slice(0,10));
 database.function('current_time',()=>iso().slice(11,19));
 context.after(()=>{context.mock.timers.reset();native.close();});
 return {set(value){if(!Number.isFinite(value)||value<current)throw new Error('Fixture clock must advance monotonically');current=value;context.mock.timers.setTime(value);},advance(ms){this.set(current+ms);}};
}
