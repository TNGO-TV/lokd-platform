import ts from 'typescript';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const entries={clientEnquiries:['client-enquiries-view.tsx','EnquiriesResponse'],signup:['signup-portal.tsx','SignupResponse'],publicPassport:['private-passport-verifier.tsx','PassportResponse'],deliveryRecords:['private-passport-controls.tsx','DeliveryRecords'],deliveryReceipt:['private-passport-controls.tsx','DeliveryReceipt'],financialHistory:['finance-document-controls.tsx','FinancialHistory'],sandboxSchedule:['sandbox-service-workspace.tsx','SandboxSchedule'],sandboxService:['sandbox-service-workspace.tsx','SandboxService'],sandboxOrders:['sandbox-service-workspace.tsx','SandboxOrders'],sandboxOperations:['sandbox-service-workspace.tsx','OperationalState'],financeData:['sandbox-finance-workspace.tsx','Data'],financeCommandQueue:['sandbox-finance-workspace.tsx','CommandQueue'],financeCommandDetail:['sandbox-finance-workspace.tsx','CommandDetail'],financeOperationEvidence:['sandbox-finance-workspace.tsx','OperationEvidenceData'],financeTraining:['sandbox-finance-workspace.tsx','TrainingCatalogue'],financeEnrolment:['sandbox-finance-workspace.tsx','EnrolmentData'],readinessIdentity:['readiness-workspace.tsx','Identity'],readinessOfficer:['readiness-workspace.tsx','Officer'],readinessRecord:['readiness-workspace.tsx','Readiness'],readinessHolds:['readiness-workspace.tsx','Holds'],reviewQueue:['identity-review-inspector.tsx','ReviewQueue'],reviewDetail:['identity-review-inspector.tsx','ReviewDetail'],reviewHolds:['identity-review-inspector.tsx','ReviewHolds'],creditNotes:['finance-adjustment-controls.tsx','CreditData'],paymentFinance:['payment-finance-controls.tsx','Finance'],psira:['psira-verification-panel.tsx','State'],delivery:['operational-delivery-panel.tsx','State'],booksLinks:['quote-books-link-panel.tsx','State'],financeDocuments:['finance-document-controls.tsx','Data'],operations:['production-operations-panel.tsx','State'],signing:['production-signing-panel.tsx','State'],quotes:['client-quotes-panel.tsx','State'],payrollSnapshot:['production-payroll-controls.tsx','SnapshotEvidence'],employeeSnapshot:['employee-payment-controls.tsx','Snapshot'],partnerSnapshot:['partner-payment-controls.tsx','Snapshot'],employeeDestination:['payment-destination-controls.tsx','Payload'],partnerDestination:['partner-destination-controls.tsx','Payload']};
const components=new URL('app/components/',root);
const files=fs.readdirSync(components).filter(file=>file.endsWith('.tsx')).sort().map(file=>fileURLToPath(new URL(file,components)));
const program=ts.createProgram(files,{strict:true,target:ts.ScriptTarget.ES2022,moduleResolution:ts.ModuleResolutionKind.Bundler,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,skipLibCheck:true});
const checker=program.getTypeChecker(),F=ts.TypeFlags;
function schema(type,trail=[]){
 if(trail.includes(type))throw Error('Recursive workspace type: '+checker.typeToString(type));
 const next=[...trail,type];
 if(type.flags&F.Any)throw Error('Unresolved workspace type: '+checker.typeToString(type));
 if(type.flags&F.Unknown)return {kind:'unknown'};
 if(type.flags&F.Undefined)return {kind:'undefined'};
 if(type.flags&F.Null)return {kind:'literal',value:null};
 if(type.flags&F.StringLiteral||type.flags&F.NumberLiteral)return {kind:'literal',value:type.value};
 if(type.flags&F.BooleanLiteral)return {kind:'literal',value:type.intrinsicName==='true'};
 if(type.flags&F.String)return {kind:'string'};
 if(type.flags&F.Number)return {kind:'number'};
 if(type.flags&F.Boolean)return {kind:'boolean'};
 if(type.isUnion())return {kind:'union',items:type.types.map(item=>schema(item,next))};
 if(type.isIntersection()&&type.types.every(item=>checker.isArrayType(item)))return {kind:'intersection',items:type.types.map(item=>schema(item,next))};
 if(checker.isArrayType(type))return {kind:'array',item:schema(checker.getTypeArguments(type)[0],next)};
 if(type.getCallSignatures().length)throw Error('Functions are not response data: '+checker.typeToString(type));
 if(type.flags&F.Object||type.isIntersection()){
  const fields={};
  for(const property of checker.getPropertiesOfType(type)){
   const declaration=property.valueDeclaration??property.declarations?.[0]??type.aliasSymbol?.declarations?.[0];
   if(!declaration)throw Error('Missing declaration: '+property.name);
   fields[property.name]={optional:Boolean(property.flags&ts.SymbolFlags.Optional),schema:schema(checker.getTypeOfSymbolAtLocation(property,declaration),next)};
  }
  const index=checker.getIndexTypeOfType(type,ts.IndexKind.String);
  return {kind:'object',fields,...(index?{values:schema(index,next)}:{})};
 }
 throw Error('Unsupported workspace type: '+checker.typeToString(type));
}
const contracts={};
for(const [name,[file,typeName]] of Object.entries(entries)){
 const source=program.getSourceFile(fileURLToPath(new URL('app/components/'+file,root)));
 const declaration=source.statements.find(node=>ts.isTypeAliasDeclaration(node)&&node.name.text===typeName);
 if(!declaration)throw Error('Missing State: '+file);
 contracts[name]=schema(checker.getTypeFromTypeNode(declaration.type));
}
const automatic={},manual=[];
for(const file of files){
 const source=program.getSourceFile(file),edits=[];
 function visit(node){
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='readWorkspaceResponse'){
   const second=node.arguments[1],wired=second&&ts.isCallExpression(second)&&ts.isIdentifier(second.expression)&&second.expression.text==='workspaceAutoContract';
   if(!second||wired){
    const label=file.split(/[\\/]/).at(-1)+':'+source.getLineAndCharacterOfPosition(node.getStart()).line;
    try{
     if(!node.typeArguments?.[0])throw Error('untyped response needs an explicit receipt contract');
     const contract=schema(checker.getTypeFromTypeNode(node.typeArguments[0]));
     if(contract.kind==='unknown'||contract.kind==='object'&&!Object.keys(contract.fields).length)throw Error('opaque response needs an endpoint-specific contract');
     const key=file.split(/[\\/]/).at(-1)+'/'+createHash('sha256').update(node.typeArguments[0].getText(source)).digest('hex').slice(0,12);
     automatic[key]=contract;
     if(!second)edits.push({at:node.arguments[0].getEnd(),text:',workspaceAutoContract('+JSON.stringify(key)+')'});
     else if(second.arguments[0]?.text!==key)throw Error('automatic contract key changed; rewire this call');
    }catch(error){manual.push({call:label,reason:error.message});}
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
 if(process.argv.includes('--wire')&&edits.length){
  let content=source.text;
  for(const edit of edits.sort((a,b)=>b.at-a.at))content=content.slice(0,edit.at)+edit.text+content.slice(edit.at);
  if(!content.includes('import {workspaceAutoContract')&&!/import \{[^}]*\bworkspaceAutoContract\b/.test(content)){
   const existing=/import \{([^}]+)\} from ['"]\.\.\/lib\/workspace-response-contracts['"];/.exec(content);
   if(existing)content=content.replace(existing[0],existing[0].replace('{','{workspaceAutoContract,'));
   else content=content.replace(/(['"]use client['"];?)/,"$1\nimport {workspaceAutoContract} from '../lib/workspace-response-contracts';");
  }
  fs.writeFileSync(file,content);
 }
}
if(manual.length)throw Error('Workspace reads require explicit response or command contracts: '+JSON.stringify(manual));
const output='// Generated by scripts/generate-workspace-contracts.mjs; do not edit.\nimport type {Contract} from "./workspace-response-contracts";\nexport const workspaceContracts:Record<string,Contract> = '+JSON.stringify(contracts)+';\nexport const automaticWorkspaceContracts:Record<string,Contract> = '+JSON.stringify(automatic)+';\n';
const destination=new URL('app/lib/workspace-contracts-generated.ts',root);
if(process.argv.includes('--check')){if(fs.readFileSync(destination,'utf8')!==output)throw Error('Workspace contracts are stale. Regenerate from the consumer types.');}
else fs.writeFileSync(destination,output);
console.log(JSON.stringify({contracts:Object.keys(contracts),automatic:Object.keys(automatic).length,manual,bytes:Buffer.byteLength(output),checked:process.argv.includes('--check')}));
