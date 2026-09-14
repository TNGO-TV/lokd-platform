// Isolated surrounding site/funding/agreement fixtures extracted from activation tests.
// Intentionally does not seed identity, PSiRA, officer approval, readiness or engagement.
import { activationAgreementContext, requiredActivationAgreements } from '../../app/lib/agreement-activation.ts';
import { agreementHash, canonicalAgreementContext, prepareAgreementReceipt, storeAgreementReceipt } from '../../app/lib/agreement-acceptance.ts';
import assert from "node:assert/strict";

import {
  activateAssignment,
  evaluateAssignmentActivation,
  revalidateAssignment,
  runDueAssignmentRevalidations,
} from "../../app/lib/assignment-activation-server.ts";
import { officerShiftEconomicsForRoster } from "../../app/lib/pilot-pricing.ts";
import { REQUIRED_LAUNCH_GATE_CODES } from "../../app/lib/workforce-core.ts";

class Prepared {
  constructor(owner, sql, values = []) {
    this.owner = owner;
    this.sql = sql;
    this.values = values;
  }
  bind(...values) { return new Prepared(this.owner, this.sql, values); }
  async first() {
    const result = this.owner.database.prepare(this.sql).get(...this.values) ?? null;
    await this.owner.afterRead?.({ method: "first", sql: this.sql, values: this.values, result });
    return result;
  }
  async all() {
    const results = this.owner.database.prepare(this.sql).all(...this.values);
    await this.owner.afterRead?.({ method: "all", sql: this.sql, values: this.values, result: results });
    return { results };
  }
  async run() { return this.runSync(); }
  runSync() {
    const result = this.owner.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

class D1Adapter {
  constructor(database, beforeBatch = null) {
    this.database = database;
    this.beforeBatch = beforeBatch;
  }
  prepare(sql) { return new Prepared(this, sql); }
  async batch(statements) {
    if (this.beforeBatch && statements.some((statement) => statement.sql.includes("INSERT INTO assignment_evidence_tokens"))) {
      const hook = this.beforeBatch;
      this.beforeBatch = null;
      await hook();
    }
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.runSync());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

const now = "2026-08-27T08:00:00.000Z";
const expiry = "2041-12-31T23:59:59.999Z";
const startsAt = "2039-12-25T18:00:00.000Z";
const endsAt = "2039-12-26T06:00:00.000Z";

function run(database, sql, ...values) {
  return database.prepare(sql).run(...values);
}

async function seedEnvironment(database) {
  for (const [index, code] of REQUIRED_LAUNCH_GATE_CODES.entries()) run(database, `INSERT INTO launch_controls
    (code,label,category,status,evidence_level,evidence_reference,detail,hard_gate,sort_order,verified_by,verified_at,expires_at,version,updated_at)
    VALUES (?,?,'fixture','passed','independently_verified',?,'Fixture evidence',1,?,'Verifier',?,?,1,?)
    ON CONFLICT(code) DO UPDATE SET
      label=excluded.label,
      category=excluded.category,
      status=excluded.status,
      evidence_level=excluded.evidence_level,
      evidence_reference=excluded.evidence_reference,
      detail=excluded.detail,
      hard_gate=excluded.hard_gate,
      sort_order=excluded.sort_order,
      verified_by=excluded.verified_by,
      verified_at=excluded.verified_at,
      expires_at=excluded.expires_at,
      version=excluded.version,
      updated_at=excluded.updated_at`,
    code, code, `evidence:${code}`, index + 1, now, expiry, now);
  run(database, `INSERT INTO clients
    (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
    VALUES ('CL-1','Fixture Client','Client Contact','client@example.test','approved','production','production_verified')`);
  run(database, `INSERT INTO bookings
    (id,client_id,site_name,site_area,post_name,service_type,purpose_code,purpose_label,engagement_model,
     calendar_category,calendar_label,minimum_grade,contract_months,start_date,end_date,shift_start,shift_end,
     client_price_cents,officer_rate_cents,pricing_version,environment,integrity_state,funding_status,release_cadence,status)
    VALUES ('BK-1','CL-1','Fixture Site','Johannesburg','Gate','Unarmed','commercial_access','Commercial access','flex',
     'christmas','Christmas peak day','Grade C',0,'2039-12-25','2039-12-25','20:00','08:00',350000,200000,
     'LOKD-PREMIUM-2026.09','production','production_verified','paid_in_full','Weekly','matching')`);
  run(database, `INSERT INTO operational_sites
    (id,client_id,booking_id,name,area,address_label,latitude_e6,longitude_e6,timezone,risk_band,service_type,
     geofence_radius_meters,geofence_version,telemetry_mode,sensitivity_classification,environment,integrity_state,
     status,version,updated_by,created_at,updated_at)
    VALUES ('SITE-1','CL-1','BK-1','Fixture Site','Johannesburg','Fixture address',-26100000,28100000,
     'Africa/Johannesburg','Standard','Unarmed',120,1,'simulated','operational','production','production_verified',
     'active',3,'fixture',?,?)`, now, now);
  run(database, `INSERT INTO site_posts
    (id,site_id,booking_id,name,service_type,purpose_code,minimum_grade,post_orders_version,environment,integrity_state,
     status,created_at,updated_at)
    VALUES ('POST-1','SITE-1','BK-1','Gate','Unarmed','commercial_access','Grade C','PO-v4',
     'production','production_verified','active',?,?)`, now, now);
  run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,environment,integrity_state,
     position_index,calendar_category,officer_offer_cents,status,version,created_at,updated_at)
    VALUES ('SLOT-1','SITE-1','POST-1','BK-1','2039-12-25',?,?, '2039-12-25T17:45:00.000Z',
     '2039-12-25T18:10:00.000Z','production','production_verified',1,'christmas',200000,'uncovered',1,?,?)`, startsAt, endsAt, now, now);
  run(database, `INSERT INTO booking_funding_reconciliations
    (id,booking_id,environment,integrity_state,provider,provider_reference,currency,expected_amount_cents,cleared_amount_cents,status,
     cleared_at,reconciled_at,evidence_reference,evidence_verified_at,evidence_expires_at,version,active_key,created_at)
    VALUES ('FR-1','BK-1','production','verified','bank_api','BANK-1','ZAR',350000,350000,'cleared_reconciled',?,?, 'bank:evidence',?,?,1,'BK-1',?)`, now, now, now, expiry, now);
  run(database, `INSERT INTO site_risk_assessments
    (id,site_id,risk_rules_version,risk_band,status,environment,integrity_state,evidence_reference,approved_by,approved_at,valid_from,expires_at,version,active_key,created_at)
    VALUES ('RISK-1','SITE-1','RISK-v3','Standard','approved','production','verified','risk:evidence','Approver',?,?,?,3,'SITE-1',?)`, now, now, expiry, now);
  run(database, `INSERT INTO post_order_approvals
    (id,post_id,post_orders_version,status,environment,integrity_state,evidence_reference,approved_by,approved_at,valid_from,expires_at,version,active_key,created_at)
    VALUES ('POA-1','POST-1','PO-v4','approved','production','verified','orders:evidence','Approver',?,?,?,4,'POST-1',?)`, now, now, expiry, now);
  run(database, `INSERT INTO workforce_employers
    (id,legal_name,employer_type,environment,psira_status,nbcpss_status,psspf_status,uif_status,coida_status,
     insurance_status,service_agreement_status,status,last_reviewed_at,review_due_at,version,created_at,updated_at)
    VALUES ('EMP-1','LOKD Security','lokd_employer','production','current','current','current','current','current',
     'current','current','current',?,?,5,?,?)`, now, expiry, now, now);
  for (const control of ["psira", "nbcpss", "psspf", "uif", "coida", "insurance", "service_agreement"]) run(database, `INSERT INTO employer_compliance_evidence
    (id,employer_id,control_code,status,environment,integrity_state,evidence_reference,verified_at,expires_at,version,active_key,created_at)
    VALUES (?,'EMP-1',?,'current','production','verified',?,?,?,1,?,?)`, `ECE-${control}`, control, `evidence:${control}`, now, expiry, `EMP-1:${control}`, now);
  run(database, "UPDATE bookings SET contracting_entity_id='LOKD-CONTRACTOR-TEST'");
}

function seedOfficerSupport(database,id,engagementId,termsId) {
  run(database, `INSERT INTO workforce_terms_acceptances
    (id,workforce_engagement_id,officer_id,terms_version,acceptance_mode,environment,integrity_state,
     evidence_reference,accepted_at,expires_at,version,active_key,created_at)
    VALUES (?,?,?,'TERMS-v1','electronic','production','verified','terms:evidence',?,?,1,?,?)`, termsId, engagementId, id, now, expiry, engagementId, now);
  run(database, `INSERT INTO officer_availability_windows
    (id,officer_id,starts_at,ends_at,source,status,environment,integrity_state,evidence_reference,rest_confirmed_at,version,created_at)
    VALUES (?,?,?,?,'fixture','available','production','verified',?,?,1,?)`, `AV-${id}`, id,
    "2039-12-20T00:00:00.000Z", "2040-01-10T00:00:00.000Z", `availability:evidence:${id}`, now, now);
  run(database, `INSERT INTO officer_schedule_declarations
    (id,officer_id,version,status,environment,integrity_state,evidence_reference,declared_at,expires_at,supersedes_id,created_at)
    VALUES (?,?,1,'current','production','verified',?,?,?,NULL,?)`, `OSD-${id}`, id,
    `schedule:evidence:${id}`, now, expiry, now);
  run(database, `INSERT INTO officer_site_inductions
    (id,officer_id,site_id,induction_version,status,environment,integrity_state,evidence_reference,
     completed_at,expires_at,version,active_key,created_at)
    VALUES (?,?,'SITE-1','IND-v1','completed','production','verified','induction:evidence',?,?,1,?,?)`, `IND-${id}`, id, now, expiry, `${id}:SITE-1`, now);
  run(database, `INSERT INTO officer_travel_assessments
    (id,officer_id,site_id,status,environment,integrity_state,estimated_minutes,source,evidence_reference,
     assessed_at,valid_until,version,active_key,created_at)
    VALUES (?,?,'SITE-1','feasible','production','verified',30,'route_matrix','travel:evidence',?,?,1,?,?)`, `TRAVEL-${id}`, id, now, expiry, `${id}:SITE-1`, now);
}

async function moveCandidateToCheckInWindow(database,officerId,serviceType="Unarmed",specialistServiceCode,durationMinutes=720) {
  const base = Math.ceil(Date.now() / 60_000) * 60_000;
  const starts = new Date(base + 10 * 60_000).toISOString();
  const ends = new Date(base + (durationMinutes + 10) * 60_000).toISOString();
  const economics = officerShiftEconomicsForRoster({
    serviceType,specialistServiceCode,
    riskBand: "Standard",
    engagementModel: "flex",
    serviceDate: starts.slice(0, 10),
    startsAt: starts,
  });
  assert.ok(economics);
  run(database, `UPDATE bookings SET calendar_category=?,calendar_label=?,officer_rate_cents=? WHERE id='BK-1'`,
    economics.calendarCategory, economics.calendarLabel, economics.officerOfferCents);
  run(database, `UPDATE roster_slots SET service_date=?,starts_at=?,ends_at=?,arrival_due_at=?,check_in_due_at=?,
    calendar_category=?,officer_offer_cents=? WHERE id='SLOT-1'`,
    economics.serviceDate, starts, ends, starts, starts, economics.calendarCategory, economics.officerOfferCents);
  run(database, `UPDATE officer_availability_windows SET starts_at=?,ends_at=? WHERE officer_id=?`,
    new Date(base - 24 * 60 * 60_000).toISOString(), new Date(base + 48 * 60 * 60_000).toISOString(),officerId);
  await signFixtureAgreements(database);
  return { starts, ends };
}

function count(database, table) {
  return Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
}

async function passDueScheduledCheckpoints(db) {
  const results = await runDueAssignmentRevalidations(db, "system:assignment-revalidation");
  assert.deepEqual(results.map((item) => item.checkpoint), ["t_minus_24", "t_minus_2"]);
  assert.equal(results.every((item) => item.ready), true);
  return results;
}

const request = (key = "activation:test:one", officerId = "OFF-1") => ({
  rosterSlotId: "SLOT-1",
  officerId,
  expectedSlotVersion: 1,
  activationKey: key,
  environment: "production",
  checkpoint: "activation",
});

async function signFixtureAgreements(database) {
  const adapter = new D1Adapter(database);
  run(database, `INSERT OR IGNORE INTO operator_accounts
    (id,email,display_name,status,environment,integrity_state,created_at,updated_at)
    VALUES ('LEGAL-FIXTURE','legal@example.test','Synthetic Legal Reviewer','active','production','production_verified',?,?)`,now,now);
  for (const slot of database.prepare("SELECT id,version FROM roster_slots WHERE status IN ('scheduled','uncovered')").all()) {
    for (const officer of database.prepare("SELECT officer_id AS id FROM workforce_engagements WHERE environment='production' AND status='active'").all()) {
      const {facts} = await evaluateAssignmentActivation(adapter,{...request('fixture:sign',officer.id),rosterSlotId:slot.id,expectedSlotVersion:slot.version});
      for (const role of requiredActivationAgreements(facts)) {
        const wording=`Fixture ${role} wording for automated checks only; no actual contract.`;
        const hash=await agreementHash(wording),docId=`DOC-${role}`;

        const context=activationAgreementContext(facts,role),contextHash=await agreementHash(canonicalAgreementContext(context));
        const client=['CLIENT_MSA','SERVICE_ORDER'].includes(role);
        const entityId=client?facts.client.contractingEntityId:facts.workforce.employer.id;
        const purpose=client?'client_service':role==='PARTNER_SERVICE'?'partner_service':'officer_employment';
        run(database, `INSERT OR IGNORE INTO agreement_document_versions
          (id,document_code,document_version,entity_id,locale,content_hash,document_reference,status,approved_by,approved_at,effective_from,environment,integrity_state)
          VALUES (?,?,'1',?,'en-ZA',?,'fixture:body','approved','LEGAL-FIXTURE',?,?,'production','production_verified')`,docId,role,entityId,hash,now,now);
        const prepared=await prepareAgreementReceipt({document:{id:docId,version:'1',purpose,entityId,locale:'en-ZA',status:'approved',approvedBy:'LEGAL-FIXTURE',approvedAt:now,effectiveFrom:now,effectiveTo:null,wording,contentHash:hash},context,presentedContentHash:hash,presentedContextHash:contextHash,expectedPurpose:purpose,expectedEntityId:entityId,expectedLocale:'en-ZA',actorUserId:'user_signer_fixture',identityEvidence:'Synthetic identity evidence',authorityEvidence:'Synthetic representative mandate',action:'agree',affirmative:true,now:Date.parse(now)});
        await storeAgreementReceipt(adapter,`SIG-${contextHash}`,prepared);
      }
    }
  }
}


export {D1Adapter,seedEnvironment,seedOfficerSupport,moveCandidateToCheckInWindow,signFixtureAgreements,passDueScheduledCheckpoints,request,activateAssignment,evaluateAssignmentActivation,revalidateAssignment,count};
