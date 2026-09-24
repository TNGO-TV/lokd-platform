import assert from 'node:assert/strict';

// Schedule real SQLite reads asynchronously so tests can observe query waves.
export function observeReads(sql, fail='') {
 const observed={active:0,max:0,queries:[]};
 const prepare=(query,values=[])=>({
  bind:(...args)=>prepare(query,args),
  async all(){return {results:await read(query,values,false)};},
  async first(){return await read(query,values,true);},
 });
 async function read(query,values,first){
  assert.match(query,/^SELECT/i,'read path must not mutate');
  observed.queries.push({query,values,startedWith:observed.active});
  observed.active++;observed.max=Math.max(observed.max,observed.active);
  try {
   await new Promise(resolve=>setImmediate(resolve));
   if(fail&&query.includes(fail))throw Error('storage unavailable');
   const stmt=sql.prepare(query);return first?stmt.get(...values)??null:stmt.all(...values);
  }finally{observed.active--;}
 }
 return {db:{prepare},observed,async drain(){while(observed.active)await new Promise(resolve=>setImmediate(resolve));}};
}
