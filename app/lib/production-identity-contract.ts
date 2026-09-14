// Browser-safe endpoint types and private token material. No server dependencies.
export const IDENTITY_WORKSPACE_CONTRACT='lokd.identity-workspace.v1' as const;
export type IdentityReviewType='identity'|'officer'|'rule'|'review'|'passport'|'disposition'|'workforce';
export type PassportDeliveryStatus='awaiting_preparation'|'awaiting_approval'|'available'|'unavailable'|'expired_or_stale';
export type PassportDelivery={deliveryId:string;officerId:string;applicantVersion:number;createdAt:string;expiresAt:string;passportId:string|null;sequence:number|null;status:PassportDeliveryStatus};
export type PrivateDeliveryRequest={action:'request_passport_delivery';officerId:string;requestKey:string;tokenHash:string};
export type PrivatePassportPreparation={action:'prepare_passport';officerId:string;officerReviewId:string;reviewIds:string[];expectedSequence:number;deliveryId:string};
export type IntakeAction=
 | {action:'correct_intake';applicantId:string;expectedVersion:number;changes:Record<string,string>}
 | {action:'withdraw_intake';applicantId:string;expectedVersion:number}
 | {action:'review_intake';applicantId:string;expectedVersion:number;status:'reviewed'|'needs_information';note:string}
 | {action:'prepare_entity';applicantId:string;applicantVersion:number};
// Call only in the signed-in Officer UI. Send `token` only in the dedicated
// read-only /api/passport/verify POST body, never the identity API, query
// strings, generic record components, analytics and persistent browser storage.
// A reload without a securely retained token requires a new request/approval.
export async function createPrivatePassportMaterial(){
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 const token='lokd_live_'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return {token,tokenHash:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''),requestKey:crypto.randomUUID()};
}
