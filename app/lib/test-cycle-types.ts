export type Cycle={id:string;client_case_id:string;officer_case_id:string;client_user_id:string;officer_user_id:string;client_version:number;officer_version:number;client_envelope_id:string;officer_envelope_id:string;site_brief:string;amount_minor:number;officer_amount_minor:number;state:string;revision:number;note:string};
export const cycleTransitions:Record<string,{from:string[];to:string;role:'client'|'officer'|'operations'}>={
 accept_booking:{from:['proposed'],to:'accepted',role:'client'},record_test_collection:{from:['accepted'],to:'test_funded',role:'operations'},
 start_service:{from:['test_funded'],to:'in_service',role:'officer'},complete_service:{from:['in_service'],to:'service_recorded',role:'officer'},
 dispute:{from:['service_recorded'],to:'disputed',role:'client'},resolve_dispute:{from:['disputed'],to:'service_recorded',role:'operations'},
 sign_off:{from:['service_recorded'],to:'signed_off',role:'client'},prepare_payment:{from:['signed_off'],to:'payment_prepared',role:'operations'},
 record_test_payment:{from:['payment_prepared'],to:'test_payment_recorded',role:'operations'},acknowledge_test_receipt:{from:['test_payment_recorded'],to:'completed',role:'officer'},
 record_test_refund:{from:['refund_pending'],to:'cancelled',role:'operations'},
};
