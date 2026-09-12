import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionMetadata,collectionTransaction,collectionEvidenceDecision} from '../app/lib/collection-evidence.ts';
const b={reference:'lokd-booking-fixture',orderId:'ORDER-fixture',clientId:'CLIENT-fixture',applicantId:'applicant',caseId:'case',caseVersion:3,sourceHash:'source-hash',amountMinor:10000,currency:'ZAR',mode:'test'};
const raw={id:42,reference:b.reference,domain:'test',status:'success',amount:10000,currency:'ZAR',paid_at:'2026-01-01T00:00:00Z',metadata:collectionMetadata(b)};
const decide=(api,events=[{event:'charge.success',transaction:api}],bound=null,current=true)=>collectionEvidenceDecision(b,api,events,bound,current);
test('collection match needs signed webhook and exact API transaction; test and live remain unsettled',()=>{
 const t=collectionTransaction(raw);assert.equal(decide(t),'matched_test');assert.equal(decide(t,[]),'awaiting_webhook');
 const live={...b,mode:'live'},l=collectionTransaction({...raw,domain:'live',metadata:collectionMetadata(live)});
 assert.equal(collectionEvidenceDecision(live,l,[{event:'charge.success',transaction:l}],null,true),'matched_live_unsettled');
 assert.equal(decide(l),'review_required');assert.equal(decide(t,undefined,'43'),'review_required');assert.equal(decide(t,undefined,null,false),'review_required');
});
test('each source field and financial dimension is independently bound',()=>{
 for(const [k,v] of Object.entries({reference:'other',domain:'live',amount:9999,currency:'USD'}))assert.equal(decide(collectionTransaction({...raw,[k]:v})),'review_required',k);
 for(const k of Object.keys(raw.metadata))assert.equal(decide(collectionTransaction({...raw,metadata:{...raw.metadata,[k]:'different'}})),'review_required',k);
 const t=collectionTransaction(raw);assert.equal(decide(t,[{event:'charge.success',transaction:{...t,id:'43'}}]),'review_required');
 assert.equal(decide(t,[{event:'charge.success',transaction:{...t,paidAt:'2026-01-02T00:00:00.000Z'}}]),'review_required');
 assert.equal(decide(t,[{event:'refund.processed',transaction:t}]),'review_required');
});
test('malformed amounts, unsafe IDs, metadata, payment times and contradictory evidence fail closed',()=>{
 for(const patch of [{id:Number.MAX_SAFE_INTEGER+1},{id:0},{amount:'10000'},{amount:1.5},{domain:undefined},{metadata:'bad json'},{metadata:[]},{paid_at:'bad time'}])assert.equal(collectionTransaction({...raw,...patch}),null);
 const t=collectionTransaction(raw);assert.equal(decide(t,[{event:'charge.success',transaction:null}]),'review_required');
 assert.equal(decide(collectionTransaction({...raw,paid_at:null})),'review_required');
 assert.equal(decide(collectionTransaction({...raw,paid_at:'2999-01-01'})),'review_required');
 const clean=collectionTransaction({...raw,customer:{email:'private'},authorization:{card:'private'},metadata:{...raw.metadata,private:'hidden'}});
 assert.equal(JSON.stringify(clean).includes('private'),false);
});
test('provider failure and reversal cannot retain a successful collection match',()=>{
 for(const status of ['failed','abandoned','reversed'])assert.equal(decide(collectionTransaction({...raw,status}),[]),status);
 const t=collectionTransaction(raw);assert.equal(decide(collectionTransaction({...raw,status:'failed'}),[{event:'charge.success',transaction:t}]),'review_required');
 assert.equal(decide(collectionTransaction({...raw,status:'pending'}),[]),'pending');
});
