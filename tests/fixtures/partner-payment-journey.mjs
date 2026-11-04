import assert from 'node:assert/strict';
import fs from 'node:fs';
import {operatePartnerPayment as operate,readPartnerPayments as read,receivePartnerTransferWebhook} from '../../app/lib/partner-payments.ts';
import {operatePartnerDestination} from '../../app/lib/partner-destinations.ts';
import {operateWithProof as operateProduction} from './operations-auth.mjs';
