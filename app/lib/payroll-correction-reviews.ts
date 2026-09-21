import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {operationsMfaRequired} from './operations-mfa-policy';
import {documentPaymentState} from './finance-documents';
import type {SigningActor} from './production-signing';
const text=(v:unknown,label:string,max=1200)=>{if(typeof v!=='string'||v.trim().length<3||v.length>max)throw new SignupError(`Provide ${label}.`);return v.trim();};
type Source={item_id:string;officer_id:string;recipient_user:string;review_amount_cents:number;run_id:string;export_reference:string;source_json:string;financial_json:string};
type Review={id:string;item_id:string;parent_id:string|null;source_json:string;financial_json:string;export_reference:string;request_json:string;payload_hash:string;operator_id:string;user_id:string};
const outcome={payChanged:false,paymentReleased:false,originalPayslipChanged:false,calculationStatus:'awaiting_company_rules'} as const;
async function source(db:D1Database,id:unknown){const row=await db.prepare('SELECT * FROM payroll_correction_sources WHERE item_id=?').bind(text(id,'the original payroll item',200)).first<Source>();if(!row)throw new SignupError('Choose an exported payroll item.',404);return row;}
async function authority(db:D1Database,a:SigningActor,h:Headers,s:Source,reviewer=false,maker?:string){if(a.userId===s.recipient_user)throw new SignupError('The person being paid cannot review their own correction.',403);return productionOperatorControl(db,a,h,reviewer?'payroll.second_approve':'payroll.calculate',s.review_amount_cents,maker);}
export async function preparePayrollCorrectionReview(db:D1Database,a:SigningActor,input:Record<string,unknown>,h:Headers){
 const s=await source(db,input.itemId),op=await authority(db,a,h,s);
 if(input.originalReviewed!==true)throw new SignupError('Review the original payslip, service records and payment history.');
 const parentId=input.parentId===undefined?null:text(input.parentId,'the previous review',200);
 const request={itemId:s.item_id,parentId,findings:text(input.findings,'what is wrong'),requestedCorrection:text(input.requestedCorrection,'what needs to be checked'),evidenceReference:text(input.evidenceReference,'the supporting record reference',200),evidenceHash:text(input.evidenceHash,'the supporting record digest',64)};
 if(!/^[a-f0-9]{64}$/.test(request.evidenceHash))throw new SignupError('Use the exact SHA-256 digest of the supporting record.');
 const key=text(input.requestKey,'a stable request key',200),requestJson=JSON.stringify(request),old=await db.prepare('SELECT * FROM payroll_correction_reviews WHERE request_key=?').bind(key).first<Review>();
 if(old){if(old.request_json!==requestJson||old.user_id!==a.userId||old.operator_id!==op.id)throw new SignupError('This request key belongs to a different correction review.',409);return {reviewId:old.id,alreadyPrepared:true,...outcome};}
 const id=crypto.randomUUID(),hash=await agreementHash(JSON.stringify({request:requestJson,source:s.source_json,financial:s.financial_json,exportReference:s.export_reference}));
 await db.prepare('INSERT INTO payroll_correction_reviews VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,key,s.item_id,parentId,s.source_json,s.financial_json,s.export_reference,requestJson,hash,op.id,a.userId,new Date().toISOString()).run();return {reviewId:id,...outcome};
}
export async function decidePayrollCorrectionReview(db:D1Database,a:SigningActor,input:Record<string,unknown>,h:Headers){
 const c=await db.prepare('SELECT * FROM payroll_correction_reviews WHERE id=?').bind(text(input.reviewId,'the correction review',200)).first<Review>();if(!c)throw new SignupError('Correction review not found.',404);
 const s=await source(db,c.item_id),op=await authority(db,a,h,s,true,c.operator_id);if(a.userId===c.user_id)throw new SignupError('A different person must review the correction.',403);
 const decision=input.decision;if(decision!=='evidence_reviewed'&&decision!=='rejected')throw new SignupError('Choose evidence reviewed or rejected. This step cannot approve changed pay.');
 const hash=await agreementHash(JSON.stringify({request:c.request_json,source:c.source_json,financial:c.financial_json,exportReference:c.export_reference}));
 if(input.payloadHash!==c.payload_hash||hash!==c.payload_hash||input.originalReviewed!==true)throw new SignupError('Review the exact original records and correction request.',409);
 await db.prepare('INSERT INTO payroll_correction_decisions VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),c.id,decision,hash,op.id,a.userId,text(input.findings,'the independent findings'),operationsMfaRequired()?'mfa_verified':'owner_mfa_exception',new Date().toISOString()).run();return {reviewId:c.id,decision,...outcome};
}
export async function readPayrollCorrectionReviews(db:D1Database,a:SigningActor,h:Headers,itemId:unknown,after=0,pageSize=25){
 if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw new SignupError('Choose a valid history page.',400);
 const s=await source(db,itemId);try{await authority(db,a,h,s);}catch(error){if(!(error instanceof SignupError)||error.status!==403)throw error;await authority(db,a,h,s,true);}
 const all=(await db.prepare('SELECT c.rowid AS sequence,c.*,d.decision,d.findings AS reviewer_findings,d.operator_id AS reviewer_operator_id,d.user_id AS reviewer_user_id,d.created_at AS reviewed_at FROM payroll_correction_reviews c LEFT JOIN payroll_correction_decisions d ON d.review_id=c.id WHERE c.item_id=? AND c.rowid>? ORDER BY c.rowid LIMIT ?').bind(s.item_id,after,pageSize+1).all<Review&{sequence:number}>()).results;
 const rows=all.slice(0,pageSize).map(c=>({...c,paymentStateWhenRecorded:documentPaymentState(JSON.parse(c.financial_json)),currentPaymentState:documentPaymentState(JSON.parse(s.financial_json)),sourceChanged:c.source_json!==s.source_json||c.financial_json!==s.financial_json||c.export_reference!==s.export_reference}));
 return {source:s,reviews:rows,nextAfter:all.length>pageSize?rows.at(-1)!.sequence:null,...outcome};
}
