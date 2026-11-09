// Isolated policy records only. These stages do not attest real statutory review.
import {createHash,randomUUID} from 'node:crypto';
import {ZA_2027_SARS_POLICY_CANDIDATE} from '../../app/lib/payroll-engine.ts';
export function seedHourlyPolicy(database, rules=structuredClone(ZA_2027_SARS_POLICY_CANDIDATE), replace=false) {
  const existing=database.prepare("SELECT id FROM payroll_policy_versions WHERE active_key='production:ZA'").get();
  if(existing&&!replace)return existing.id;
  if(existing)database.prepare("UPDATE payroll_policy_versions SET status='withdrawn',active_key=NULL,version=version+1 WHERE id=?").run(existing.id);
  const id='fixture-hourly-policy-'+randomUUID();
  rules={...structuredClone(rules),version:id};
  const json=JSON.stringify(rules),hash=createHash('sha256').update(json).digest('hex'),now=new Date().toISOString();
  database.prepare("INSERT INTO payroll_policy_versions(id,effective_from,effective_to,rules_json,policy_hash,source_reference,environment,integrity_state,created_by,created_at) VALUES(?,?,?,?,?,?,'production','production_verified','fixture-preparer',?)").run(id,rules.effectiveFrom,rules.effectiveTo,json,hash,'Isolated source-review fixture; no production approval',now);
  database.prepare("UPDATE payroll_policy_versions SET status='reviewed',reviewed_by='fixture-reviewer',reviewed_at=?,version=2 WHERE id=?").run(now,id);
  database.prepare("UPDATE payroll_policy_versions SET status='active',approved_by='fixture-approver',activated_at=?,active_key='production:ZA',version=3 WHERE id=?").run(now,id);
  return id;
}

export function setHourlyHourLimit(database,limit){const active=database.prepare("SELECT rules_json FROM payroll_policy_versions WHERE active_key='production:ZA'").get();const rules=active?JSON.parse(active.rules_json):structuredClone(ZA_2027_SARS_POLICY_CANDIDATE);rules.hourlyPay.weeklyHourThreshold=limit;seedHourlyPolicy(database,rules,true);}
