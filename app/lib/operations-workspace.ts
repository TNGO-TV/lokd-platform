import {publicPresence} from './officer-presence';
import {SignupError} from './signup-server';
import type {OperationsActor} from './operations-access';
export async function readOperationsWorkspace(db:D1Database,actor:OperationsActor,before:string|null=null) {
 const cursor=before?.split("|");
 if(cursor&&(cursor.length!==2||!Number.isFinite(Date.parse(cursor[0]))||!cursor[1]||before!.length>200))throw new SignupError("The audit cursor is invalid.");
 const [applications,enquiries,shifts,payroll,audit,presence]=await Promise.all([
  db.prepare("SELECT kind,status,count(*) AS count FROM signup_cases WHERE status!='withdrawn' GROUP BY kind,status").all<{kind:string;status:string;count:number}>(),
  db.prepare("SELECT id,organisation_name,contact_name,site_area,status,created_at FROM client_enquiries WHERE integrity_state='user_submitted' AND status!='closed' ORDER BY created_at LIMIT 50").all(),
  db.prepare("SELECT s.id,s.scheduled_date,s.status,s.check_in_at,s.check_out_at,o.full_name,b.site_name FROM shifts s JOIN officers o ON o.id=s.officer_id JOIN bookings b ON b.id=s.booking_id WHERE s.environment='production' AND b.environment='production' ORDER BY CASE WHEN s.status='on_post' THEN 0 WHEN s.status='scheduled' AND s.scheduled_date>=date('now') THEN 1 ELSE 2 END,abs(julianday(s.scheduled_date)-julianday('now')),s.id LIMIT 50").all(),
  actor.roles.some(r=>['finance_approver','payroll_preparer','payroll_reviewer'].includes(r))?db.prepare("SELECT id,period_start,period_end,pay_date,status,net_pay_cents FROM payroll_runs WHERE environment='production' ORDER BY created_at DESC LIMIT 50").all():Promise.resolve({results:[]}),
  db.prepare(`SELECT id,actor_id,event_type,entity_type,entity_id,detail,created_at FROM audit_events WHERE actor_type='operations' AND (event_type LIKE 'production_%' OR event_type IN ('rereview_disposition','readiness_decision','readiness_hold','officer_review_decided','officer_suspended','identity_review_data_access','evidence_stored','evidence_verified') OR (event_type='specialist_workflow_action' AND json_valid(detail) AND json_extract(detail,'$.environment')='production')) ${cursor?"AND (created_at<? OR (created_at=? AND id<?))":""} ORDER BY created_at DESC,id DESC LIMIT 101`).bind(...(cursor?[cursor[0],cursor[0],cursor[1]]:[])).all<{id:string;created_at:string}>(),
  publicPresence(db),
 ]);
 return {presence,applications:applications.results,enquiries:enquiries.results,shifts:shifts.results,payroll:payroll.results,audit:audit.results.slice(0,100),auditNext:audit.results.length>100?audit.results[99].created_at+"|"+audit.results[99].id:null,operator:{email:actor.email,roles:actor.roles,approvalLimitCents:actor.approvalLimitCents}};
}
