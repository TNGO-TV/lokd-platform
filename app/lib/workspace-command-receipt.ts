export type WorkspaceCommandKind='client-enquiries'|'signup'|'production-operations'|'finance-documents'|'payment-recovery'|'payment-execution'|'production-signing'|'quotes'|'psira'|'operational-delivery'|'odoo-books'|'credit-notes'|'booking-refunds'|'payroll-correction-reviews'|'production-identity'|'finance-workflows'|'sandbox-application'|'sandbox-identity';
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
async function fingerprint(input:Record<string,unknown>){
 const bytes=new TextEncoder().encode(JSON.stringify(input));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
}
// Added only after the selected authorized handler has completed. This proves
// which command returned, not that a payment was released or a gate passed.
export async function workspaceCommandReceipt(kind:WorkspaceCommandKind,input:Record<string,unknown>){
 return {version:1,kind,action:input.action,requestHash:await fingerprint(input)};
}
export async function matchesWorkspaceCommand(value:unknown,kind:WorkspaceCommandKind,input:Record<string,unknown>){
 if(!record(value)||!record(value.commandReceipt))return false;
 const receipt=value.commandReceipt;
 return receipt.version===1&&receipt.kind===kind&&receipt.action===input.action&&receipt.requestHash===await fingerprint(input);
}
