import {operatorApprovalLimit} from './operator-approval-limit';
import {readPartnerPayments,operatePartnerPayment} from './partner-payments';
import {readPartnerDestinations,operatePartnerDestination} from './partner-destinations';
import {readPartnerPayables,operatePartnerPayable} from './partner-payables';
import {readEmployeePayments,operateEmployeePayment} from './employee-payments';
import {readPaymentDestinations,operatePaymentDestination} from './payment-destinations';
import {readBookingSettlements,operateBookingSettlement} from './booking-settlements';
import {readBookingCollections,operateBookingCollection,type CollectionRuntime} from './booking-collections';
import {readProductionPayroll,prepareProductionPayroll,decideProductionPayroll} from './production-payroll';
import {readProductionPayrollPolicies,manageProductionPayrollPolicy} from './production-payroll-policy';
import {readProductionSchedule,declareProductionSchedule} from './production-schedule';
import {readProductionService,recordProductionService} from './production-service';
import {readProductionEvidence,manageProductionEvidence} from './production-evidence';
import {prepareProductionOrder,readProductionOrders} from './production-orders';
import {readClientReviews,reviewProductionClient} from './production-client-review';
import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {OPERATOR_ACTION_POLICIES} from './operator-controls';
import {productionOperatorControl as control} from './production-operator-control';
import {evaluateAssignmentActivation,recordAssignmentActivationEvaluation,activateAssignment,revalidateAssignment,type AssignmentActivationRequest} from './assignment-activation-server';
import type {SigningActor} from './production-signing';
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>200)throw new SignupError('Choose a valid operational reference.');return v.trim();};
export async function readProductionOperations(db:D1Database,actor:SigningActor){
 const rosters=await db.prepare(`SELECT r.id,r.version,r.status,r.starts_at,r.ends_at,ra.officer_id,b.id AS booking_id,b.client_id,b.client_price_cents FROM roster_slots r JOIN bookings b ON b.id=r.booking_id LEFT JOIN roster_assignments ra ON ra.roster_slot_id=r.id AND ra.status='confirmed' AND ra.active_key IS NOT NULL WHERE r.environment='production' AND b.environment='production' ${actor.operations?'':"AND (EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='client' AND l.entity_id=b.client_id AND l.owner_user_id=?) OR EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='officer' AND l.entity_id=ra.officer_id AND l.owner_user_id=?))"} ORDER BY r.starts_at DESC LIMIT 100`).bind(...(actor.operations?[]:[actor.userId,actor.userId])).all();
 const approvals=actor.operations?await db.prepare('SELECT * FROM production_activation_approvals ORDER BY created_at DESC LIMIT 100').all():{results:[]};
 const shifts=await db.prepare(`SELECT s.id,s.officer_id,s.status,s.check_in_at,s.check_out_at,s.client_signoff_status,b.client_id FROM shifts s JOIN bookings b ON b.id=s.booking_id WHERE s.environment='production' AND b.environment='production' ${actor.operations?'':"AND (EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='client' AND l.entity_id=b.client_id AND l.owner_user_id=?) OR EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='officer' AND l.entity_id=s.officer_id AND l.owner_user_id=?))"} ORDER BY s.scheduled_date DESC LIMIT 100`).bind(...(actor.operations?[]:[actor.userId,actor.userId])).all();
 const operators=actor.owner?await db.prepare("SELECT id,email,status,approval_limit_cents FROM operator_accounts WHERE environment='production'").all():{results:[]};
 // Independent read-only groups overlap, with at most four reader chains.
 // Each reader retains its own live entitlement and ownership checks. Do not
 // cache grants or move mutation/approval commands into these groups.
 const [partner,collections,workforce,evidence]=await Promise.all([
  (async()=>({...await readPartnerPayments(db,actor),...await readPartnerDestinations(db,actor),...await readPartnerPayables(db,actor),...await readEmployeePayments(db,actor)}))(),
  (async()=>({...await readPaymentDestinations(db,actor),...await readBookingSettlements(db,actor),...await readBookingCollections(db,actor),...await readProductionPayroll(db,actor)}))(),
  (async()=>({...await readProductionPayrollPolicies(db,actor),...await readProductionSchedule(db,actor),...await readProductionService(db,actor)}))(),
  (async()=>({...await readProductionEvidence(db,actor),...await readClientReviews(db,actor),...await readProductionOrders(db,actor)}))(),
 ]);
 return {...partner,...collections,...workforce,...evidence,rosters:rosters.results,approvals:approvals.results,shifts:shifts.results,operators:operators.results,owner:actor.owner};
}
export async function operateProduction(db:D1Database,actor:SigningActor,input:Record<string,unknown>,headers:Headers,liveCheckInEnabled=false,collectionRuntime:CollectionRuntime={}){
 const now=new Date().toISOString();
 if(['prepare_partner_payable','approve_partner_payable','reject_partner_payable','hold_partner_payable','export_partner_payable'].includes(String(input.action)))return operatePartnerPayable(db,actor,input,headers);
 if(['prepare_employee_payment','approve_employee_payment','cancel_employee_payment','dispatch_employee_test','verify_employee_test'].includes(String(input.action)))return operateEmployeePayment(db,actor,input,headers,collectionRuntime);
 if(['prepare_partner_payment','approve_partner_payment','cancel_partner_payment','dispatch_partner_test','verify_partner_test'].includes(String(input.action)))return operatePartnerPayment(db,actor,input,headers,collectionRuntime);
 if(['prepare_partner_destination','approve_partner_destination','reject_partner_destination','hold_partner_destination','recheck_partner_destination'].includes(String(input.action)))return operatePartnerDestination(db,actor,input,headers,collectionRuntime);
 if(['prepare_destination','approve_destination','reject_destination','hold_destination','recheck_destination'].includes(String(input.action)))return operatePaymentDestination(db,actor,input,headers,collectionRuntime);
 if(['prepare_settlement','approve_settlement','reject_settlement','hold_collection','apply_booking_funding'].includes(String(input.action)))return operateBookingSettlement(db,actor,input,headers,collectionRuntime);
 if(['prepare_collection','approve_collection','initialize_collection','verify_collection'].includes(String(input.action)))return operateBookingCollection(db,actor,input,headers,collectionRuntime);
 if(input.action==='prepare_payroll_period')return prepareProductionPayroll(db,actor,input,headers);
 if(['first_approve_payroll','second_approve_payroll','void_payroll','export_payroll'].includes(String(input.action)))return decideProductionPayroll(db,actor,input,headers);
 if(['prepare_payroll_policy','review_payroll_policy','activate_payroll_policy','withdraw_payroll_policy'].includes(String(input.action)))return manageProductionPayrollPolicy(db,actor,input,headers);
 if(['declare_schedule','withdraw_availability'].includes(String(input.action)))return declareProductionSchedule(db,actor,input);
 if(['complete_service','client_signoff','client_dispute','resolve_service_dispute','review_service_pay','reopen_service_pay'].includes(String(input.action)))return recordProductionService(db,actor,input,headers);
 if(['prepare_evidence','decide_evidence','suspend_evidence'].includes(String(input.action)))return manageProductionEvidence(db,actor,input);
 if(['quote_order','prepare_order','prepare_roster'].includes(String(input.action)))return prepareProductionOrder(db,actor,input);
 if(['prepare_client_review','decide_client_review','suspend_client'].includes(String(input.action)))return reviewProductionClient(db,actor,input);
 if(input.action==='grant_operator'){
  if(!actor.owner||!actor.operations)throw new SignupError('Only the assigned Operations owner can manage operator roles.',403);
  const email=text(input.email).toLowerCase(),role=text(input.role);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!OPERATOR_ACTION_POLICIES.some(p=>p.requiredRole===role))throw new SignupError('Choose an operator email, policy role and non-negative limit in cents.');
  let limitCents:number;try{limitCents=operatorApprovalLimit(input);}catch(error){throw new SignupError((error as Error).message);}
  let a=await db.prepare("SELECT id FROM operator_accounts WHERE lower(email)=? AND environment='production'").bind(email).first<{id:string}>();
  if(!a){const id='OP-'+crypto.randomUUID();await db.prepare("INSERT INTO operator_accounts(id,email,display_name,status,approval_limit_cents,environment,integrity_state,created_at,updated_at) VALUES(?,?,?,'active',?,'production','production_verified',?,?)").bind(id,email,email,limitCents,now,now).run();a={id};}
  await db.batch([db.prepare("UPDATE operator_accounts SET approval_limit_cents=?,version=version+1,updated_at=? WHERE id=?").bind(limitCents,now,a.id),db.prepare("INSERT INTO operator_role_assignments(id,operator_id,role,status,environment,integrity_state,granted_by,granted_at) VALUES(?,?,?,'active','production','production_verified',?,?) ON CONFLICT(operator_id,role,environment) DO UPDATE SET status='active',granted_by=excluded.granted_by,granted_at=excluded.granted_at,revoked_at=NULL").bind(crypto.randomUUID(),a.id,role,actor.userId,now),db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'production_operator_role_granted','operator',?,?,?)").bind(crypto.randomUUID(),actor.userId,a.id,JSON.stringify({role,limitCents,noPersonalCap:input.noPersonalCap===true}),now)]);return {operatorId:a.id};
 }
 if(input.action==='revoke_operator'){
  if(!actor.owner||!actor.operations)throw new SignupError('Operations owner access required.',403);
  await db.batch([db.prepare("UPDATE operator_accounts SET status='suspended',version=version+1,updated_at=? WHERE id=? AND environment='production'").bind(now,text(input.operatorId)),db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'production_operator_suspended','operator',?,?,?)").bind(crypto.randomUUID(),actor.userId,text(input.operatorId),'Owner suspended production operator access.',now)]);return {suspended:true};
 }
 if(input.action==='check_in'){
  if(!liveCheckInEnabled)throw new SignupError('Production check-in awaits live operating acceptance.',423);
  const shiftId=text(input.shiftId);const owns=await db.prepare("SELECT s.id FROM shifts s JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=s.officer_id JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.status!='withdrawn' WHERE s.id=? AND s.environment='production' AND l.owner_user_id=?").bind(shiftId,actor.userId).first();if(!owns||actor.operations)throw new SignupError('Only the assigned officer may check in.',403);
  return revalidateAssignment(db,shiftId,'check_in',actor.userId,true);
 }
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 if(input.action==='evaluate'||input.action==='prepare_activation'){
  const request:AssignmentActivationRequest={rosterSlotId:text(input.rosterSlotId),officerId:text(input.officerId),expectedSlotVersion:Number(input.slotVersion),activationKey:text(input.activationKey),environment:'production'};
  const evaluation=await evaluateAssignmentActivation(db,request);if(input.action==='evaluate')return {ready:evaluation.result.ready,blockers:evaluation.result.blockers,evaluationHash:evaluation.evaluationHash};
  if(!evaluation.result.ready)throw new SignupError('Readiness blockers must be resolved before activation can be prepared.',409);
  const maker=await control(db,actor,headers,'offer.release',evaluation.facts.funding.bookingAmountCents);
  await recordAssignmentActivationEvaluation(db,request,maker.id);const json=JSON.stringify(request),hash=await agreementHash(json);
  const old=await db.prepare('SELECT request_hash,maker_id FROM production_activation_approvals WHERE id=?').bind(request.activationKey).first<{request_hash:string;maker_id:string}>();if(old&&(old.request_hash!==hash||old.maker_id!==maker.id))throw new SignupError('Activation key already belongs to a different request.',409);
  await db.prepare("INSERT OR IGNORE INTO production_activation_approvals VALUES(?,?,?,?,'prepared',NULL,?,?)").bind(request.activationKey,json,hash,maker.id,now,now).run();return {prepared:true,requiresIndependentApproval:true};
 }
 if(input.action==='approve_activation'){
  const a=await db.prepare('SELECT * FROM production_activation_approvals WHERE id=?').bind(text(input.activationKey)).first<{id:string;request_json:string;request_hash:string;maker_id:string;state:string;approver_id:string|null}>();if(!a)throw new SignupError('Prepared activation not found.',404);
  if(await agreementHash(a.request_json)!==a.request_hash)throw new SignupError('Activation request integrity check failed.',409);
  const request=JSON.parse(a.request_json) as AssignmentActivationRequest;
  const amount=await db.prepare("SELECT b.client_price_cents AS cents FROM bookings b JOIN roster_slots r ON r.booking_id=b.id WHERE r.id=? AND r.environment='production' AND b.environment='production'").bind(request.rosterSlotId).first<{cents:number}>();if(!amount)throw new SignupError('Production booking no longer exists.',409);
  const approver=await control(db,actor,headers,'deployment.activate',amount.cents,a.maker_id);
  if(a.state==='activated')return {alreadyActivated:true};
  if(a.state!=='prepared'&&!(a.state==='approving'&&a.approver_id===approver.id))throw new SignupError('Another reviewer owns this activation. Refresh.',409);
  if(a.state==='prepared'){const claim=await db.prepare("UPDATE production_activation_approvals SET state='approving',approver_id=?,updated_at=? WHERE id=? AND state='prepared'").bind(approver.id,now,a.id).run();if(!claim.meta.changes)throw new SignupError('Another approval started. Refresh.',409);}
  let result;
  try{result=await activateAssignment(db,request,approver.id);}catch(error){
   // Only a persisted terminal provider-independent command permits a terminal recovery state.
   const command=await db.prepare('SELECT state FROM assignment_activation_commands WHERE activation_key=?').bind(a.id).first<{state:string}>();
   if(command?.state==='blocked')await db.prepare("UPDATE production_activation_approvals SET state='blocked',updated_at=? WHERE id=? AND approver_id=?").bind(new Date().toISOString(),a.id,approver.id).run();
   throw error;
  }
  await db.prepare("UPDATE production_activation_approvals SET state='activated',updated_at=? WHERE id=? AND approver_id=?").bind(new Date().toISOString(),a.id,approver.id).run();return result;
 }
 throw new SignupError('Choose a supported production command.');
}
