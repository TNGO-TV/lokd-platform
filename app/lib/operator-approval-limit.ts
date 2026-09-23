// Every supported monetary amount is a non-negative safe integer in cents.
// This value therefore imposes no personal cap while preserving numeric SQL guards.
export const NO_PERSONAL_APPROVAL_CAP = Number.MAX_SAFE_INTEGER;
export function operatorApprovalLimit(input:Record<string,unknown>):number {
 if(input.noPersonalCap!==undefined&&typeof input.noPersonalCap!=='boolean')throw new Error('Choose a valid approval limit mode.');
 if(input.noPersonalCap===true){
  if(input.limitCents!==undefined)throw new Error('Choose either no personal cap or a fixed approval limit.');
  return NO_PERSONAL_APPROVAL_CAP;
 }
 if(!Number.isSafeInteger(input.limitCents)||Number(input.limitCents)<0)throw new Error('Choose a non-negative approval limit in cents.');
 return Number(input.limitCents);
}
export function operatorApprovalLimitLabel(cents:number):string {
 return cents===NO_PERSONAL_APPROVAL_CAP?'No personal approval cap':'R'+(cents/100).toFixed(2);
}
