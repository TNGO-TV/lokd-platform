export async function load(url,context,nextLoad){
 const loaded=await nextLoad(url,context);if(!url.endsWith('/tests/fixtures/payroll-correction-review-journey.mjs'))return loaded;
 const source=String(loaded.source),needle=' assert.deepEqual(original(),before);assert.deepEqual(saved(),row);';
 const extra=`
 database.exec('PRAGMA recursive_triggers=OFF');
 const reviewRows=JSON.stringify(database.prepare('SELECT * FROM payroll_correction_reviews ORDER BY rowid').all());
 const decisionRows=JSON.stringify(database.prepare('SELECT * FROM payroll_correction_decisions ORDER BY rowid').all());
 await assert.rejects(()=>prepare(db,{...maker,userId:'different-maker-user'},input,headers(maker)),/different correction/);
 await assert.rejects(()=>prepare(db,maker,{...input,parentId:next.reviewId,requestKey:'qa-pending-parent'},headers(maker)),/original correction history/);
 await assert.rejects(()=>prepare(db,maker,{...input,parentId:row.id,requestKey:'qa-second-successor'},headers(maker)),/immutable/);
 function replace(table,changes){const original=database.prepare('SELECT * FROM '+table+' ORDER BY rowid LIMIT 1').get(),value={...original,...changes},keys=Object.keys(value);return database.prepare('INSERT OR REPLACE INTO '+table+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...Object.values(value));}
 assert.throws(()=>replace('payroll_correction_reviews',{id:'qa-new-review'}),/immutable/);
 const successor=database.prepare('SELECT * FROM payroll_correction_reviews WHERE parent_id=?').get(row.id),keys=Object.keys(successor);
 assert.throws(()=>database.prepare('INSERT OR REPLACE INTO payroll_correction_reviews('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>k==='id'?'qa-new-successor':k==='request_key'?'qa-new-successor-key':successor[k])),/immutable/);
 assert.throws(()=>replace('payroll_correction_decisions',{id:'qa-new-decision',decision:'rejected'}),/immutable/);
 assert.equal(JSON.stringify(database.prepare('SELECT * FROM payroll_correction_reviews ORDER BY rowid').all()),reviewRows);
 assert.equal(JSON.stringify(database.prepare('SELECT * FROM payroll_correction_decisions ORDER BY rowid').all()),decisionRows);
 console.log('QA_EX01: alternate-key replacement, pending-parent, duplicate-successor and cross-user key blocked; retained evidence and originals unchanged');
`;
 if(!source.includes(needle))throw Error('EX01 fixture insertion point changed');return {...loaded,source:source.replace(needle,extra+needle)};
}
