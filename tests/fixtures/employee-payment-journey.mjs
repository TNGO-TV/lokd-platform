import assert from 'node:assert/strict';
import fs from 'node:fs';
import {operateEmployeePayment as operate,readEmployeePayments as read,receiveEmployeeTransferWebhook} from '../../app/lib/employee-payments.ts';
import {operatePaymentDestination} from '../../app/lib/payment-destinations.ts';
import {operateWithProof as operateProduction} from './operations-auth.mjs';
