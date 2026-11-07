import {SignupError} from './signup-server';

// Only server-owned table/column names are used. Record modes are immutable;
// client-supplied mode flags cannot relabel a saved non-live record as live.
async function liveRecord(db:D1Database,table:string,column:string,value:unknown){
 if(typeof value!=='string'||!value||value.length>1200)throw new SignupError('Choose the saved production finance reference.');
 const row=await db.prepare(`SELECT mode FROM ${table} WHERE ${column}=?`).bind(value).first<{mode:string}>();
 if(!row||row.mode!=='live')throw new SignupError('Only live finance records are available in this production workspace.',423);
}
export const requireLiveRefundReference=(db:D1Database,reference:unknown)=>liveRecord(db,'booking_collection_requests','reference',reference);

export async function requireLiveFinanceCommand(db:D1Database,input:Record<string,unknown>){
 const action=String(input.action);
 if(/(?:^|_)partner(?:_|$)/.test(action)||input.kind==='partner')throw new SignupError('External-firm work is no longer supported.',410);
 if(['prepare_collection','prepare_destination'].includes(action)){
  if(input.mode!=='live')throw new SignupError('Production finance requires live mode. Provider and independent approval requirements still apply.',423);
 }
 if(['approve_collection','initialize_collection','verify_collection','prepare_settlement','approve_settlement','reject_settlement','hold_collection','apply_booking_funding'].includes(action))await liveRecord(db,'booking_collection_requests','reference',input.reference);
 if(['approve_settlement','reject_settlement'].includes(action))await liveRecord(db,'booking_settlement_reviews','id',input.reviewId);
 if(['approve_destination','reject_destination','hold_destination','recheck_destination'].includes(action))await liveRecord(db,'payment_destination_reviews','id',input.destinationId);
 for(const kind of ['employee'] as const){
  if(action===`prepare_${kind}_payment`){
   await liveRecord(db,'payment_destination_reviews','id',input.destinationId);
   for(const key of ['replacesReference','replacesCancelledReference'])if(input[key]!==undefined)await liveRecord(db,`${kind}_payment_instructions`,'reference',input[key]);
  }
  if([`approve_${kind}_payment`,`cancel_${kind}_payment`].includes(action))await liveRecord(db,`${kind}_payment_instructions`,'reference',input.reference);
 }
 if(['propose_live_disposition','approve_live_disposition'].includes(action)){
  if(input.kind!=='employee')throw new SignupError('Choose the payment kind.');
  await liveRecord(db,`${input.kind}_payment_instructions`,'reference',input.reference);
 }
}
