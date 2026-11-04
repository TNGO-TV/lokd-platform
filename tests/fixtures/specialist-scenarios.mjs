import {defaultRiskInput,quoteBooking} from '../../app/lib/production-pricing.ts';
import {specialistProfiles} from '../../app/lib/specialist-pricing.ts';
import {evaluateSpecialistPack,requiredSpecialistChecks,quoteFingerprint} from '../../app/lib/specialist-operations-core.ts';
import {advanceFundingDecision} from '../../app/lib/operator-controls.ts';
export function runSpecialistScenarios(now = new Date()) {
  const future = new Date(now.getTime()+14*86400000); while(future.getUTCDay()!==2) future.setUTCDate(future.getUTCDate()+1);
  const date=future.toISOString().slice(0,10);
  return (["armed_static","armed_movement","vip_unarmed","vip_armed"]).map(code=>{
    const profile=specialistProfiles[code];
    const quote=quoteBooking({serviceType:profile.serviceType,engagementModel:"flex",term:"single",purposeCode:code==="armed_static"?"high_value_retail":code==="armed_movement"?"secure_logistics":"executive_protection",startDate:date,shift:"day",rosterPattern:"daily",riskInput:defaultRiskInput,specialistConfiguration:{serviceCode:code,vehicleClass:code==="armed_movement"?"client_vehicle":"none"},now});
    const booking={id:`SCENARIO-${code}`,clientId:"FIXTURE-CLIENT",siteName:"Fixture Johannesburg assignment",serviceCode:code,configuration:JSON.stringify(quote.specialistConfiguration),pricingVersion:quote.version,subtotalCents:quote.subtotalCents,vatCents:quote.vatCents,totalCents:quote.clientPriceCents,costFloorCents:quote.costFloorCents,marginBasisPoints:quote.marginBasisPoints,headcount:quote.headcount,startsAt:`${date}T04:00:00.000Z`,endsAt:`${date}T16:00:00.000Z`,pricingStatus:quote.pricingStatus,pricingValid:1,planCurrent:1,authorityCurrent:1,fundingCurrent:1,environment:"demo"};
    const content={commandOwner:"Fixture command",clientBrief:"Fixture scope",officerBrief:"Fixture assignment instructions",officerIds:Array.from({length:quote.headcount},(_,i)=>`FIXTURE-OFFICER-${i+1}`),partnerId:"",checks:[]};
    const validFrom=new Date(now.getTime()-86400000).toISOString(); const expiresAt=new Date(future.getTime()+86400000*3).toISOString();
    content.checks=requiredSpecialistChecks(booking,content.officerIds).map(x=>({code:x.code,reference:`demo://${x.code}`,validFrom,expiresAt}));
    const ready=evaluateSpecialistPack(booking,content,{commercialCurrent:true,now});
    const shortFunding=advanceFundingDecision({creditTermsDays:0,fundingModel:"advance_only",bookingAmountCents:booking.totalCents,expectedAmountCents:booking.totalCents,clearedAmountCents:booking.totalCents-1,status:"cleared_reconciled",evidenceReference:"demo://underfunded-test"});
    const expired={...content,checks:content.checks.map((x,i)=>i===0?{...x,expiresAt:validFrom}:x)};
    const steps=[
      {label:"Configured quote and cost floor",passed:quote.marginBasisPoints>=quote.minimumMarginBasisPoints,detail:"Risk, team, planning, employer reserve and minimum margin calculated by the booking engine."},
      {label:"commercial readiness",passed:quote.clientPriceCents===quote.subtotalCents+quote.vatCents && !shortFunding.ready && !evaluateSpecialistPack({...booking,fundingCurrent:0},content,{commercialCurrent:true,now}).ready,detail:"A one-cent shortfall is rejected by the commercial-readiness engine; an uncleared booking cannot become pack-ready."},
      {label:"Evidence and assignment pack",passed:ready.ready,detail:ready.ready?"Complete fixture scope, contract references, personnel and readiness evidence pass.":ready.blockers.join(" ")},
      {label:"Expired evidence blocks review",passed:!evaluateSpecialistPack(booking,expired,{commercialCurrent:true,now}).ready,detail:"A single expired document makes the pack unavailable for approval."},
      {label:"Quote change invalidates approval",passed:!evaluateSpecialistPack({...booking,totalCents:booking.totalCents+1},content,{commercialCurrent:true,quoteSnapshot:quoteFingerprint(booking),now}).ready,detail:"The approved snapshot must match the current quote and roster."},
      {label:"Authority withdrawal blocks release",passed:!evaluateSpecialistPack({...booking,authorityCurrent:0},content,{commercialCurrent:true,now}).ready,detail:"Specialist authority is checked again at use time."},
    ];
    return {serviceCode:code,label:profile.label,status:steps.every(s=>s.passed)?"passed":"failed",totalCents:quote.clientPriceCents,steps};
  });
}
