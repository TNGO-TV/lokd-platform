import test from 'node:test';import assert from 'node:assert/strict';
import {sandboxConnected} from './fixtures/sandbox-connected.mjs';
import {sandboxReady} from './fixtures/sandbox-completion.mjs';
import {maker,checker,applicant} from './fixtures/production-identity-journey.mjs';
import {activateAssignment,request,signFixtureAgreements,revalidateAssignment} from './fixtures/identity-activation-environment.mjs';
import {sandboxReleaseAssignment} from '../app/lib/sandbox-service.ts';
import {sandboxRead} from '../app/lib/sandbox-read.ts';
import {executeSandboxApplication} from '../app/lib/sandbox-application.ts';
import {sandboxFundingBoundary} from '../app/lib/sandbox-funding-boundary.ts';
import {operateProduction} from '../app/lib/production-operations.ts';
import {freshHeaders} from './fixtures/connected-payroll-consumption.mjs';
test('pre-check-in replacement preserves immutable assignment history and releases only the old reservations',async()=>{const x=await sandboxConnected();try{
 await operateProduction(x.db,checker,{action:'grant_operator',email:checker.email,role:'operations_owner',limitCents:10000000},freshHeaders(checker));
 const a=await activateAssignment(x.activationDb,{...request('release-source',x.officerId),expectedSlotVersion:x.database.prepare("SELECT version FROM roster_slots WHERE id='SLOT-1'").get().version},'ops-fixture');assert.equal(a.state,'activated');
 const row=x.database.prepare('SELECT * FROM roster_assignments WHERE shift_id=?').get(a.shiftId),snap=x.database.prepare('SELECT * FROM assignment_activation_snapshots WHERE shift_id=?').get(a.shiftId),input={assignmentId:row.id,expectedVersion:row.version,reason:'replaced'};
 await assert.rejects(sandboxReleaseAssignment(x.runtime,applicant,input,freshHeaders(applicant)));await assert.rejects(sandboxReleaseAssignment(x.runtime,checker,{...input,expectedVersion:0},freshHeaders(checker)));
 await sandboxReleaseAssignment(x.runtime,checker,input,freshHeaders(checker));assert.deepEqual(x.database.prepare('SELECT * FROM assignment_activation_snapshots WHERE shift_id=?').get(a.shiftId),snap);assert.equal(x.database.prepare('SELECT status FROM roster_assignments WHERE id=?').get(row.id).status,'replaced');await assert.rejects(revalidateAssignment(x.activationDb,a.shiftId,'check_in',applicant.userId,true));
 await signFixtureAgreements(x.database);const replacement=await activateAssignment(x.activationDb,{...request('release-replacement',x.officerId),expectedSlotVersion:x.database.prepare("SELECT version FROM roster_slots WHERE id='SLOT-1'").get().version},'ops-fixture');assert.equal(replacement.state,'activated');assert.notEqual(replacement.shiftId,a.shiftId);assert.equal(x.database.prepare('SELECT count(*) n FROM assignment_activation_snapshots').get().n,2);
 }finally{x.close();}});
test('private read contracts isolate officers and HTTP bridge never generates an Operations passport token',async()=>{const x=await sandboxReady();try{
 assert.ok((await sandboxRead(x.runtime,applicant,{officerId:x.officerId})).reviews.length);await assert.rejects(sandboxRead(x.runtime,{...applicant,userId:'unrelated'},{officerId:x.officerId}));
 await assert.rejects(executeSandboxApplication(x.runtime,maker,'passport_prepare',x.passportInput,new Headers()),/officer-owned/);assert.equal(x.db.sql.prepare('SELECT count(*) n FROM production_readiness_passports').get().n,0);
 }finally{x.close();}});
test('simulated funding boundary retains source integrity and rejects self-approval and changed amounts',async()=>{const x=await sandboxConnected();try{
 const before=x.database.prepare("SELECT * FROM booking_funding_reconciliations WHERE id='FR-1'").get();const p=await sandboxFundingBoundary(x.runtime,maker,{action:'prepare',reconciliationId:'FR-1',expectedVersion:before.version});
 await assert.rejects(sandboxFundingBoundary(x.runtime,{...maker,owner:true},{action:'decide',acceptanceId:p.acceptanceId,decision:'approve',independentlyChecked:true,reason:'Self'}));
 x.database.prepare("UPDATE booking_funding_reconciliations SET cleared_amount_cents=cleared_amount_cents-1 WHERE id='FR-1'").run();await assert.rejects(sandboxFundingBoundary(x.runtime,checker,{action:'decide',acceptanceId:p.acceptanceId,decision:'approve',independentlyChecked:true,reason:'Changed source'}));assert.equal(x.database.prepare("SELECT integrity_state FROM booking_funding_reconciliations WHERE id='FR-1'").get().integrity_state,before.integrity_state);assert.equal(x.database.prepare('SELECT count(*) n FROM sandbox_funding_decisions').get().n,0);
 }finally{x.close();}});
