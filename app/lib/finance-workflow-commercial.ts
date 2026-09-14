import {SignupError} from './signup-server';
import {FinanceContext,str,num,type Data} from './finance-workflow-store';
import {activeOrder,document} from './finance-workflow-accounting';
export async function planCommercial(c:FinanceContext,input:Data){const action=str(input,'action');
 if(action==='cancel_unsubmitted'){
 const o=await c.get(str(input,'operationId'),'operation');if(o.data.state!=='authorized'||await c.db.prepare('SELECT 1 FROM finance_provider_claims WHERE workspace_id=? AND operation_id=?').bind(c.workspace,o.id).first())throw new SignupError('A submitted or uncertain operation cannot be cancelled.',409);c.plan.unsubmitted.push(o.id);
 const amount=Number(o.data.amount),order=await c.get(String(o.data.orderId),'order');if(o.data.kind==='collection')await c.put(order.id,order.kind,order.owner_user_id,{...order.data,pendingCollections:Number(order.data.pendingCollections)-amount});else {c.move('reserve:'+o.id,o.data.kind==='refund'?'cash:'+order.id:String(o.data.fundingAccount),amount);if(o.data.kind==='payout'){const l=await c.get(String(o.data.liabilityId),'liability'),field=o.data.tax?'taxPending':'pending';await c.put(l.id,l.kind,l.owner_user_id,{...l.data,[field]:Number(l.data[field]??0)-amount});}}
 await c.put(o.id,o.kind,o.owner_user_id,{...o.data,state:'failed',reason:str(input,'reason'),neverSubmitted:true});return true;
 }
 if(action==='void_credit_note'){
 const note=await c.get(str(input,'creditNoteId'),'credit_note'),o=await c.get(String(note.data.orderId),'order');if(note.data.state==='void'||Number(note.data.reserved))throw new SignupError('Reserved or void credit cannot be corrected.',409);await c.put(note.id,note.kind,note.owner_user_id,{...note.data,state:'void',reason:str(input,'reason')});await c.put(o.id,o.kind,o.owner_user_id,{...o.data,credited:Number(o.data.credited)-Number(note.data.amount)});c.plan.amount=Number(note.data.amount);return true;
 }
 if(action==='publish_package'){
 const id=str(input,'id'),old=await c.db.prepare('SELECT id FROM finance_current_records WHERE workspace_id=? AND id=?').bind(c.workspace,id).first();if(old)await c.get(id,'package');
 await c.put(id,'package',c.actor.userId,{title:str(input,'title'),provider:str(input,'provider'),price:num(input,'price',1),terms:str(input,'terms',2000),validityDays:c.policy.trainingValidityDays,refundBasisPoints:c.policy.trainingRefundBasisPoints,active:input.active!==false});return true;
 }
 if(action==='order_training'||action==='order_enrolment'){
 c.plan.requiredRole='participant';const id=str(input,'id'),applicationId=str(input,'applicationId'),application=await c.source('application',applicationId);if(application.owner_user_id!==c.actor.userId)throw new SignupError('Application belongs to another person.',403);
 let packageData:Data={},total=c.policy.enrolmentAmount;const kind=action==='order_training'?'training':'enrolment';if(kind==='training'){const p=await c.get(str(input,'packageId'),'package');if(!p.data.active||input.acceptedTerms!==p.data.terms)throw new SignupError('Accept the current package terms.',409);packageData={packageId:p.id,packageVersion:p.version,...p.data};total=Number(p.data.price);}else c.claim('enrolment',applicationId+':'+application.version,String(application.version),id);
 await c.put(id,'order',c.actor.userId,{kind,applicationId,applicationVersion:application.version,package:packageData,total,received:0,refunded:0,pendingCollections:0,state:'open'});await document(c,'invoice:'+id,c.actor.userId,{type:'invoice',orderId:id,total,currency:'ZAR',kind,applicationId,applicationVersion:application.version,package:packageData});c.plan.amount=total;c.plan.result={orderId:id};return true;
 }
 if(action==='issue_entitlement'){
 const o=await activeOrder(c,str(input,'orderId'));if(!['enrolment','training'].includes(String(o.data.kind))||Number(o.data.received)!==Number(o.data.total)||Number(o.data.refunded)||Number(o.data.pendingCollections))throw new SignupError('Exact fully reconciled payment is required.',409);
 const app=await c.source('application',String(o.data.applicationId));if(app.version!==o.data.applicationVersion||app.owner_user_id!==o.owner_user_id||['withdrawn','suspended','rejected'].includes(String(app.status)))throw new SignupError('Application changed before entitlement issuance.',409);
 const payments=(await c.db.prepare("SELECT id FROM finance_current_records WHERE workspace_id=? AND kind='operation' AND json_extract(data_json,'$.orderId')=? AND json_extract(data_json,'$.kind')='collection' AND json_extract(data_json,'$.state')='paid'").bind(c.workspace,o.id).all<{id:string}>()).results;
 let sum=0;for(const row of payments){const p=await c.get(row.id,'operation');sum+=Number(p.data.amount);const used=await c.db.prepare("SELECT consumer_id FROM finance_source_claims WHERE workspace_id=? AND source_type='entitlement-payment' AND source_id=?").bind(c.workspace,p.id).first<{consumer_id:string}>();if(used&&used.consumer_id!=='entitlement:'+o.id)throw new SignupError('Payment already used for another entitlement.',409);if(!used)c.claim('entitlement-payment',p.id,String(p.version),'entitlement:'+o.id);}if(sum!==Number(o.data.total))throw new SignupError('Entitlement payments do not match the order.',409);
 const prior=await c.db.prepare('SELECT id FROM finance_current_records WHERE workspace_id=? AND id=?').bind(c.workspace,'entitlement:'+o.id).first();if(prior)throw new SignupError('This order already issued its entitlement; a new purchase is required for renewal.',409);
 const expires=o.data.kind==='training'?new Date(Date.parse(c.at)+Number((o.data.package as Data).validityDays)*86400000).toISOString():null;
 await c.put('entitlement:'+o.id,'entitlement',o.owner_user_id,{kind:o.data.kind,orderId:o.id,applicationId:o.data.applicationId,applicationVersion:o.data.applicationVersion,payments:payments.map(p=>p.id),state:'active',issuedAt:c.at,expiresAt:expires,workEligible:false});return true;
 }
 if(action==='revoke_entitlement'){
 const e=await c.get(str(input,'entitlementId'),'entitlement');await c.put(e.id,e.kind,e.owner_user_id,{...e.data,state:'revoked',reason:str(input,'reason'),revokedAt:c.at});return true;
 }
 if(action==='record_completion'){
 const e=await c.get(str(input,'entitlementId'),'entitlement'),o=await activeOrder(c,String(e.data.orderId)),app=await c.source('application',String(e.data.applicationId));if(app.owner_user_id!==e.owner_user_id||app.version!==e.data.applicationVersion||['withdrawn','suspended','rejected'].includes(String(app.status)))throw new SignupError('Current training application is required.',409);if(e.data.kind!=='training'||e.data.state!=='active'||Date.parse(String(e.data.expiresAt))<=Date.parse(c.at)||Number(o.data.refunded)||['disputed','cancelled','reversed','charged_back'].includes(String(o.data.state)))throw new SignupError('Current training entitlement is required.',409);
 const provider=str(input,'provider');if(provider!==(o.data.package as Data).provider)throw new SignupError('Wrong training provider.',403);c.claim('completion',e.id,String(e.version),str(input,'id'));c.claim('completion-reference',provider+':'+str(input,'reference'),String(e.version),str(input,'id'));await c.put(str(input,'id'),'completion',e.owner_user_id,{entitlementId:e.id,provider,reference:str(input,'reference'),completedAt:c.at,workEligible:false});return true;
 }
 if(action==='cancel_order'){
 const o=await c.get(str(input,'orderId'),'order');if(Number(o.data.pendingCollections)||await c.balance('reserve:'+o.id))throw new SignupError('Recover pending payment initialization first.',409);await c.put(o.id,o.kind,o.owner_user_id,{...o.data,state:'cancelled',reason:str(input,'reason')});return true;
 }
 if(action==='issue_credit_note'){
 const o=await c.get(str(input,'orderId'),'order'),amount=num(input,'amount',1),id=str(input,'id');const credited=Number(o.data.credited??0),limit=o.data.kind==='training'?Math.floor(Number(o.data.total)*Number((o.data.package as Data).refundBasisPoints)/10000):Number(o.data.total);
 if(input.replacementOf){const previous=await c.get(str(input,'replacementOf'),'credit_note');if(previous.data.orderId!==o.id||previous.data.state!=='void')throw new SignupError('Void the original unused credit before replacement.',409);c.claim('credit-replacement',previous.id,String(previous.version),id);}
 if(credited+amount>limit)throw new SignupError('Credit exceeds the versioned refundable value.',409);await c.put(o.id,o.kind,o.owner_user_id,{...o.data,credited:credited+amount});await c.put(id,'credit_note',o.owner_user_id,{orderId:o.id,amount,reason:str(input,'reason'),originalInvoice:'invoice:'+o.id,replacementOf:input.replacementOf??null});await document(c,'document:'+id,o.owner_user_id,{type:'credit_note',creditNoteId:id,originalInvoice:'invoice:'+o.id,amount,reason:input.reason});c.plan.amount=amount;return true;
 }
 if(action==='prepare_refund'){
 const note=await c.get(str(input,'creditNoteId'),'credit_note'),o=await c.get(String(note.data.orderId),'order'),id=str(input,'id'),amount=input.amount===undefined?Number(note.data.amount):num(input,'amount',1);if(note.data.state==='void'||amount>Number(note.data.amount)-Number(note.data.reserved??0))throw new SignupError('Credit is void or already reserved.',409);
 if(amount>Number(o.data.received)-Number(o.data.refunded))throw new SignupError('Refund exceeds reconciled receipts.',409);const collection=await c.get(str(input,'collectionId'),'operation');if(collection.data.kind!=='collection'||collection.data.orderId!==o.id||collection.data.state!=='paid'||amount>Number(collection.data.amount)-Number(collection.data.refundReserved??0))throw new SignupError('Refund requires its original paid collection.',409);
 await c.put(note.id,note.kind,note.owner_user_id,{...note.data,reserved:Number(note.data.reserved??0)+amount});await c.put(collection.id,collection.kind,collection.owner_user_id,{...collection.data,refundReserved:Number(collection.data.refundReserved??0)+amount});c.move('cash:'+o.id,'reserve:'+id,amount);await c.put(o.id,o.kind,o.owner_user_id,{...o.data,lastRefund:id});await c.put(id,'operation',o.owner_user_id,{kind:'refund',orderId:o.id,creditNoteId:note.id,collectionId:collection.id,originalReference:collection.data.reference,amount,reference:'lokd-sbx-'+c.workspace+'-'+id,state:'authorized',attempt:1});c.plan.result={operationId:id};return true;
 }
 if(action==='retry_refund'){
 const o=await c.get(str(input,'operationId'),'operation');if(o.data.kind!=='refund'||!['needs_attention','failed','reversed'].includes(String(o.data.state)))throw new SignupError('Final reviewed refund disposition is required.',409);
 const d=await c.get(str(input,'destinationId'),'destination');if(d.owner_user_id!==o.owner_user_id)throw new SignupError('Refund recipient owner mismatch.',403);if(o.data.state!=='needs_attention')c.move('cash:'+o.data.orderId,'reserve:'+o.id,Number(o.data.amount));
 await c.put(o.id,o.kind,o.owner_user_id,{...o.data,attempt:Number(o.data.attempt)+1,state:'authorized',recipientCode:d.data.recipientCode,destinationId:d.id,destinationVersion:d.version});c.plan.amount=Number(o.data.amount);return true;
 }
 if(action==='open_dispute'){
 const o=await activeOrder(c,str(input,'orderId')),amount=num(input,'amount',1),id=str(input,'id');if(amount>Number(o.data.received)-Number(o.data.refunded))throw new SignupError('Dispute exceeds net receipts.',409);const held=Math.min(amount,await c.balance('cash:'+o.id));if(held)c.move('cash:'+o.id,'hold:'+id,held);await c.put(o.id,o.kind,o.owner_user_id,{...o.data,state:'disputed'});await c.put(id,'dispute',o.owner_user_id,{orderId:o.id,amount,held,state:'open',reference:str(input,'reference')});c.plan.amount=amount;return true;
 }
 if(action==='resolve_dispute'){
 const d=await c.get(str(input,'disputeId'),'dispute'),o=await c.get(String(d.data.orderId),'order'),outcome=str(input,'outcome');if(d.data.state!=='open'||!['won','lost'].includes(outcome))throw new SignupError('Choose a final unresolved dispute outcome.',409);
 // Bank final-disposition evidence is itself an independently prepared and reviewed source record.
 const proof=await c.get(str(input,'evidenceId'),'bank_disposition');if(proof.data.disputeId!==d.id||proof.data.outcome!==outcome||proof.data.amount!==d.data.amount||Date.parse(c.at)-Date.parse(String(proof.data.observedAt))>900000)throw new SignupError('Matching fresh final bank disposition required.',409);c.claim('dispute-evidence',proof.id,String(proof.version),d.id);
 const held=Number(d.data.held),amount=Number(d.data.amount);if(held)c.move('hold:'+d.id,outcome==='won'?'cash:'+o.id:'external:provider',held);if(outcome==='lost'&&amount>held)c.move('debt:'+o.id,'external:provider',amount-held);await c.put(d.id,d.kind,d.owner_user_id,{...d.data,state:outcome,evidenceId:proof.id});await c.put(o.id,o.kind,o.owner_user_id,{...o.data,state:outcome==='won'?'funded':'charged_back',chargeback:outcome==='lost'?amount:0});c.plan.amount=amount;return true;
 }
 if(action==='record_bank_disposition'){
 await c.put(str(input,'id'),'bank_disposition',c.actor.userId,{disputeId:str(input,'disputeId'),outcome:str(input,'outcome'),amount:num(input,'amount',1),reference:str(input,'reference'),observedAt:c.at});c.plan.amount=Number(input.amount);return true;
 }
 if(action==='restore_funding'){
 const o=await c.get(str(input,'orderId'),'order'),amount=num(input,'amount',1),id=str(input,'id');
 // A funding operation is a separately invoiced, provider-reconciled top-up linked to the original debt.
 await c.put(id,'order',o.owner_user_id,{kind:'topup',parentOrder:o.id,total:amount,received:0,refunded:0,pendingCollections:0,state:'open'});await document(c,'invoice:'+id,o.owner_user_id,{type:'invoice',orderId:id,parentOrder:o.id,total:amount});c.plan.amount=amount;return true;
 }
 if(action==='apply_restored_funding'){
 const top=await c.get(str(input,'topupId'),'order'),o=await c.get(String(top.data.parentOrder),'order');if(top.data.kind!=='topup'||Number(top.data.received)!==Number(top.data.total))throw new SignupError('Reconcile the top-up first.',409);c.claim('funding-topup',top.id,String(top.version),o.id);const amount=await c.balance('cash:'+top.id),debt=Math.min(amount,Math.max(0,-await c.balance('debt:'+o.id)));if(debt)c.move('cash:'+top.id,'debt:'+o.id,debt);if(amount>debt)c.move('cash:'+top.id,'cash:'+o.id,amount-debt);await c.put(o.id,o.kind,o.owner_user_id,{...o.data,state:await c.balance('debt:'+o.id)+debt<0?'charged_back':'funded'});return true;
 }
 if(action==='release_allocation'){
 const o=await c.get(str(input,'orderId'),'order'),company=str(input,'companyId'),account='allocation:'+o.id+':'+company,amount=num(input,'amount',1),liabilities=(await c.db.prepare("SELECT id,data_json FROM finance_current_records WHERE workspace_id=? AND kind='liability' AND json_extract(data_json,'$.orderId')=? AND json_extract(data_json,'$.company')=?").bind(c.workspace,o.id,company).all<{id:string;data_json:string}>()).results;let owed=0;for(const row of liabilities){const l=await c.get(row.id,'liability');owed+=Math.max(0,await c.balance('liability:'+l.id)-Number(l.data.pending))+Math.max(0,await c.balance('tax:'+l.id));}if(await c.balance(account)-amount<owed)throw new SignupError('Earned liabilities still require this funding.',409);c.move(account,'cash:'+o.id,amount);await c.put(o.id,o.kind,o.owner_user_id,{...o.data,lastRelease:c.at});return true;
 }
 return false;
}
