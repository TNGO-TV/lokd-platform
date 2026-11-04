'use client';
import type {OnboardingScope} from '../lib/onboarding-types';
import { useOnboarding } from "../lib/use-onboarding";
export function PortalOnboardingSummary({scope}:{scope:Exclude<OnboardingScope,'operations'>}){
 const onboarding=useOnboarding(scope);
 if(onboarding.loading)return <section className="portal-onboarding-card" role="status">Loading your application progress…</section>;
 if(onboarding.error||!onboarding.state)return <section className="portal-onboarding-card" role="alert"><h2>Application progress unavailable</h2><p>{onboarding.error}</p><button onClick={()=>void onboarding.refresh()}>Try again</button></section>;
 if(!onboarding.state.cases.length)return <section className="portal-onboarding-card"><h2>Your application</h2><p>No linked application yet.</p><a href={scope==='officer'?'/join':'/signup?kind=client'}>{scope==='officer'?'Apply to LOKD':'Open your application'}</a></section>;
 return <section className="portal-onboarding-card"><h2>Your application progress</h2>{onboarding.state.cases.map(item=>{
  const complete=item.checklist.filter(check=>check.status==='complete').length,percent=Math.round(complete/Math.max(1,item.checklist.length)*100);
  return <article key={item.id}><h3>{item.displayName}</h3><p>{percent}% complete · {complete} of {item.checklist.length} checks</p><ul>{item.checklist.map(check=><li key={check.id}><span aria-hidden="true">{check.status==='complete'?'✓':'○'}</span> <a href={check.href}>{check.label}</a> · {check.status==='complete'?'Complete':'Required'}</li>)}</ul></article>;
 })}<button onClick={()=>void onboarding.refresh()}>Refresh progress</button></section>;
}
