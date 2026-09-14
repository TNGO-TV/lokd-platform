import {sandboxFundingBoundary} from '../../app/lib/sandbox-funding-boundary.ts';
import assert from 'node:assert/strict';
import {quoteBooking,defaultRiskInput} from '../../app/lib/pilot-pricing.ts';
import {sandboxSpecialist} from '../../app/lib/sandbox-specialist.ts';
import {requiredSpecialistChecks} from '../../app/lib/specialist-operations-core.ts';
import {operateProduction} from '../../app/lib/production-operations.ts';
import {freshHeaders} from './connected-payroll-consumption.mjs';
import {maker,checker} from './production-identity-journey.mjs';
export function priceSpecialistFixture(database,serviceType,serviceCode){
 database.exec("UPDATE bookings SET status='draft',funding_status='unfunded' WHERE id='BK-1'");
 const q=quoteBooking({serviceType,engagementModel:'flex',term:'single',rosterPattern:'daily',purposeCode:'commercial_access',startDate:new Date(Date.now()+86400000).toISOString().slice(0,10),shift:'day',riskInput:defaultRiskInput,specialistConfiguration:{serviceCode,...(['armed_movement','vip_protective_driver'].includes(serviceCode)?{vehicleClass:'client_vehicle'}:{})}});
 const fields={service_type:serviceType,pricing_version:q.version,pricing_breakdown:JSON.stringify({...q,...q.pricingDecision}),specialist_service_code:q.specialistServiceCode,specialist_configuration:JSON.stringify(q.specialistConfiguration),quote_subtotal_cents:q.subtotalCents,vat_rate_basis_points:q.vatRateBasisPoints,vat_cents:q.vatCents,cost_floor_cents:q.costFloorCents,margin_cents:q.marginCents,margin_basis_points:q.marginBasisPoints,minimum_margin_basis_points:q.minimumMarginBasisPoints,pricing_status:q.pricingStatus,client_price_cents:q.clientPriceCents,officer_total_cents:q.officerTotalCents,gross_platform_contribution_cents:q.grossPlatformContributionCents,service_day_count:q.serviceDayCount,headcount:q.headcount,shift_count:q.shiftCount,risk_band:q.risk.band};
 database.prepare('UPDATE bookings SET '+Object.keys(fields).map(k=>k+'=?').join(',')+" WHERE id='BK-1'").run(...Object.values(fields));

 assert.equal(database.prepare("SELECT valid FROM specialist_pricing_validation_v33 WHERE id='BK-1'").get().valid,1);return q;
}
export async function prepareSpecialistFixture(x){
 const run=(actor,input)=>sandboxSpecialist(x.runtime,actor,input,freshHeaders(actor));
 for(const actor of [maker,checker])await operateProduction(x.db,checker,{action:'grant_operator',email:actor.email,role:actor===maker?'operations_controller':'compliance_reviewer',limitCents:100000000},freshHeaders(actor));
 for(const code of ['S1_ARMED_SERVICE_AUTHORITY','S2_VIP_SERVICE_AUTHORITY','S3_SPECIALIST_INSURANCE','S4_SPECIALIST_BOARD_APPROVAL']){const p=await run(maker,{action:'prepare_authority',code,reference:'sandbox:versioned-authority'});await assert.rejects(run({...maker,owner:true},{action:'decide_authority',authorityId:p.authorityId,decision:'approve',independentlyChecked:true,reason:'Self review'}));await run(checker,{action:'decide_authority',authorityId:p.authorityId,decision:'approve',independentlyChecked:true,reason:'Independent sandbox source review'});}
 const price=x.db.sql.prepare("SELECT client_price_cents FROM bookings WHERE id='BK-1'").get().client_price_cents;
 x.db.sql.prepare("UPDATE booking_funding_reconciliations SET expected_amount_cents=?,cleared_amount_cents=? WHERE booking_id='BK-1'").run(price,price);
 const f=await sandboxFundingBoundary(x.runtime,maker,{action:'prepare',reconciliationId:'FR-1',expectedVersion:x.db.sql.prepare("SELECT version FROM booking_funding_reconciliations WHERE id='FR-1'").get().version});
 await sandboxFundingBoundary(x.runtime,checker,{action:'decide',acceptanceId:f.acceptanceId,decision:'approve',independentlyChecked:true,reason:'Explicit simulator settlement boundary only'});
 x.db.sql.exec("UPDATE bookings SET funding_status='paid_in_full',status='matching' WHERE id='BK-1'");
 let state=await run(maker,{action:'submit_commercial',version:0,evidenceReference:'sandbox:commercial',expiresAt:new Date(Date.now()+86400000).toISOString()});
 // The accepted engine returns state after each successful mutation.
 state=await run(checker,{action:'approve_commercial',id:state.commercialReview.id,version:state.commercialReview.version});
 const officerIds=[x.officerId,...(x.additional??[]).map(o=>o.officerId)],b=state.bookings.find(b=>b.id==='BK-1'),content={commandOwner:'Sandbox command',clientBrief:'Fictional client scope',officerBrief:'Fictional officer scope',officerIds,partnerId:'',checks:requiredSpecialistChecks(b,officerIds).map(c=>({code:c.code,reference:'sandbox:qualification:'+c.code,validFrom:new Date(Date.now()-60000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}))};
 state=await run(maker,{action:'save_pack',bookingId:b.id,version:0,content});let p=state.packs[0];
 state=await run(maker,{action:'submit_pack',id:p.id,version:p.version});p=state.packs[0];
 await assert.rejects(run(maker,{action:'approve_pack',id:p.id,version:p.version}));
 state=await run(checker,{action:'approve_pack',id:p.id,version:p.version});assert.equal(state.packs[0].status,'approved');return state;
}
