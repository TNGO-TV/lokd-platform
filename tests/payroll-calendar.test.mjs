import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {PAYROLL_CALENDAR,southAfricanDate,payrollPeriodDatesValid} from '../app/lib/payroll-calendar.ts';
import {documentPaymentState} from '../app/lib/finance-documents.ts';
test('accepted payroll calendar agrees with SQLite at South African midnight, month and leap-year boundaries',()=>{
 assert.equal(PAYROLL_CALENDAR,'Africa/Johannesburg');const db=new DatabaseSync(':memory:');
 for(const [instant,date] of [['2026-09-13T21:59:59.999Z','2026-09-13'],['2026-09-13T22:00:00.000Z','2026-09-14'],['2026-12-31T22:00:00.000Z','2027-01-01'],['2028-02-28T22:00:00.000Z','2028-02-29'],['2028-02-29T22:00:00.000Z','2028-03-01']]){assert.equal(southAfricanDate(instant),date);assert.equal(db.prepare("SELECT date(?,'+2 hours') AS d").get(instant).d,date);}
 assert.equal(payrollPeriodDatesValid('2026-09-14','2026-09-14','2026-09-14','2026-09-13T21:59:59.999Z'),false);
 assert.equal(payrollPeriodDatesValid('2026-09-14','2026-09-14','2026-09-14','2026-09-13T22:00:00.000Z'),true);
 assert.equal(payrollPeriodDatesValid('2026-09-14','2026-09-14','2026-09-13','2026-09-13T22:00:00.000Z'),false);
 assert.equal(payrollPeriodDatesValid('2026-02-29','2026-02-29','2026-03-01','2026-03-01T00:00:00Z'),false);db.close();
});
test('document state preserves test isolation and canonical paid, held and reversal precedence',()=>{
 const row=(state,extra={})=>({reference:'fixture',mode:'live',active:true,status:'dispatch_claimed',state,paidReceipts:0,...extra});
 assert.equal(documentPaymentState([]),'unpaid');assert.equal(documentPaymentState([row('paid',{mode:'test'})]),'unpaid');
 for(const state of ['unpaid','pending','paid','held','reversed'])assert.equal(documentPaymentState([row(state)]),state);
 assert.equal(documentPaymentState([row('paid'),row('pending')]),'held');assert.equal(documentPaymentState([row('paid'),row('paid')]),'held');
 assert.equal(documentPaymentState([row('held',{active:false}),row('pending')]),'pending');
});
