// Store references and action names, never request bodies, bank details or credentials.
export async function auditOperationsCommand(db:D1Database,userId:string,input:Record<string,unknown>,outcome:'requested'|'completed'|'failed') {
 const action=typeof input.action==='string'?input.action.slice(0,100):'unknown';
 const id=['id','reviewId','officerId','applicantId','runId','orderId','reference','rosterSlotId'].map(k=>input[k]).find(v=>typeof v==='string'&&v.length<=300) as string|undefined;
 await db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'production_operator_command','operation',?,?,?)")
  .bind(crypto.randomUUID(),userId,id??action,JSON.stringify({action,outcome}),new Date().toISOString()).run();
}
