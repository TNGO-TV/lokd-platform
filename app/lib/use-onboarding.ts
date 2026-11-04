'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {OnboardingScope,OnboardingState} from './onboarding-types';
import type {SignupRecord} from './signup-types';
import {onboardingSummary} from './onboarding-core';
export function useOnboarding(scope:OnboardingScope){
 const [state,setState]=useState<OnboardingState|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const generation=useRef(0);
 const refresh=useCallback(async()=>{
  const current=++generation.current;setLoading(true);setError('');
  try{
   const response=await fetch(scope==='client'?'/api/signup?scope=client':'/api/onboarding?scope='+encodeURIComponent(scope),{cache:'no-store'});
   const value=await response.json() as {onboarding?:OnboardingState;records?:SignupRecord[];error?:string};
   if(scope==='client'&&response.ok&&Array.isArray(value.records))value.onboarding=onboardingSummary(value.records.filter(record=>record.status!=='withdrawn').map(record=>({id:record.id,displayName:record.details.organisationName??record.id,status:record.status,checklist:[{id:'account',label:'Link your application',status:record.accountLinked?'complete':'required',href:'/signup?kind=client'},{id:'intake',label:'Application review',status:record.status==='reviewed'?'complete':'required',href:'/signup?kind=client'}]})));
   if(!response.ok||!value.onboarding||!Array.isArray(value.onboarding.cases))throw Error(value.error??'Your application progress could not be loaded.');
   if(current===generation.current)setState(value.onboarding);
  }catch(cause){if(current===generation.current){setState(null);setError(cause instanceof Error?cause.message:'Your application progress could not be loaded.');}}
  finally{if(current===generation.current)setLoading(false);}
 },[scope]);
 useEffect(()=>{
  const lifecycle=generation;
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void refresh();return()=>{lifecycle.current++;};
 },[refresh]);
 return {state,loading,error,refresh};
}
