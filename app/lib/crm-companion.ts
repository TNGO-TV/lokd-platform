import {DeliveryError,type OperationalRuntime} from './operational-provider';

/**
 * CRM companion seam for new client enquiries.
 *
 * Odoo was removed in November 2026. Until a CRM is connected, every enquiry
 * stays in LOKD's own D1 storage (client_enquiries) and the team is told by the
 * existing `enquiry_email` staff notice. The paired `enquiry_crm` delivery job
 * is settled as `cancelled` with `crm_companion_not_configured`, without any
 * network request.
 *
 * To connect Trigger CRM later, return a companion from
 * `configuredCrmCompanion` (gated on its own runtime settings) and add those
 * settings to `OperationalRuntime`. Nothing else in the delivery queue changes.
 */
export type CrmCompanion={
 /** Stable provider label stored with the job, for example `trigger-crm`. */
 provider:string;
 /** Records one enquiry by its LOKD id and returns the provider record id. */
 recordEnquiry(input:{enquiryId:string},transport:typeof fetch):Promise<string>;
};

export function configuredCrmCompanion(runtime:OperationalRuntime):CrmCompanion|null{
 void runtime;
 return null;
}

export function requireCrmCompanion(runtime:OperationalRuntime):CrmCompanion{
 const companion=configuredCrmCompanion(runtime);
 if(!companion)throw new DeliveryError('crm_companion_not_configured','cancelled');
 return companion;
}
