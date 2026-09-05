"use client";
import { useEffect, useState } from "react";
type Pack={packId:string;revision:number;service:string;site:string;startsAt:string;banner:string};
export function PortalSpecialistPacks({scope}:{scope:"client"|"officer"}) {
  const [packs,setPacks]=useState<Pack[]>([]),[error,setError]=useState("");
  useEffect(()=>{let cancelled=false;void fetch(`/api/specialist?scope=${scope}`,{cache:"no-store"}).then(async response=>{const data=await response.json() as {documents?:Pack[];error?:string};if(!response.ok) throw new Error(data.error??"Assignment packs unavailable.");if(!cancelled)setPacks(data.documents??[]);}).catch(cause=>{if(!cancelled)setError(cause instanceof Error?cause.message:"Assignment packs unavailable.");});return()=>{cancelled=true;};},[scope]);
  if(error) return <section className="portal-specialist-packs"><h2>Specialist assignment packs</h2><p>{error}</p></section>;
  if(!packs.length) return null;
  return <section className="portal-specialist-packs"><h2>{scope==="client"?"Specialist service orders":"Specialist assignment instructions"}</h2>{packs.map(p=><article key={p.packId}><strong>{p.service} · {p.site}</strong><p>{p.banner}</p><a href={`/api/specialist?scope=${scope}&pack=${encodeURIComponent(p.packId)}&download=1`}>Download revision {p.revision}</a></article>)}</section>;
}
