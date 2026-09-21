import {SignupError} from './signup-server';
const eligible=`EXISTS(SELECT 1 FROM assignment_activation_snapshots snap JOIN shifts s ON s.id=snap.shift_id JOIN roster_assignments r ON r.id=snap.roster_assignment_id JOIN assignment_activation_commands c ON c.id=snap.command_id WHERE snap.officer_id=p.officer_id AND snap.environment='production' AND snap.integrity_state='production_verified' AND snap.final=1 AND s.environment='production' AND s.integrity_state='production_verified' AND s.status='on_post' AND s.check_out_at IS NULL AND r.status='confirmed' AND r.active_key IS NOT NULL AND c.state='activated' AND snap.shift_starts_at<=? AND snap.shift_ends_at>? AND snap.evidence_valid_through>? AND NOT EXISTS(SELECT 1 FROM assignment_revalidations rv WHERE rv.snapshot_id=snap.id AND rv.status='failed'))`;
// Public locations and live writes both require the current reviewed account link.
const currentLink=`EXISTS(SELECT 1 FROM production_entity_links l JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.owner_user_id=l.owner_user_id AND c.version=l.case_version AND c.status='reviewed' WHERE l.kind='officer' AND l.entity_id=p.officer_id AND l.owner_user_id=p.user_id)`;
export async function publicPresence(db:D1Database){const now=new Date().toISOString();const r=await db.prepare(`SELECT latitude,longitude,count(*) AS count FROM public_officer_presence p WHERE p.mode='live' AND p.expires_at>? AND ${currentLink} AND ${eligible} GROUP BY latitude,longitude`).bind(now,now,now,now).all();return {areas:r.results,checkedAt:now,precision:'Approximately 11 km areas',expiresAfterSeconds:180};}
export async function writePresence(db:D1Database,userId:string,officerId:string|null,input:Record<string,unknown>){
 if(input.mode!=='test'&&input.mode!=='live')throw new SignupError('Choose test or live sharing.');const mode=input.mode;
 if(input.action==='stop'){await db.prepare('DELETE FROM public_officer_presence WHERE user_id=? AND mode=?').bind(userId,mode).run();return {sharing:false,mode};}
 if(input.action!=='share'||input.consent!==true)throw new SignupError('Explicit consent is required before location sharing.');
 if(typeof input.latitude!=='number'||typeof input.longitude!=='number'||!Number.isFinite(input.latitude)||!Number.isFinite(input.longitude)||input.latitude< -35||input.latitude> -22||input.longitude<16||input.longitude>33)throw new SignupError('Choose a location within the South African map area.');
 const latitude=Math.round(input.latitude*10)/10,longitude=Math.round(input.longitude*10)/10,stamp=Date.now(),now=new Date(stamp).toISOString(),expires=new Date(stamp+180000).toISOString();
 if(mode==='live'){
  const link=await db.prepare(`SELECT l.entity_id FROM production_entity_links l JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.owner_user_id=l.owner_user_id AND c.version=l.case_version AND c.status='reviewed' WHERE l.kind='officer' AND l.owner_user_id=?`).bind(userId).all<{entity_id:string}>();
  if(link.results.length!==1)throw new SignupError('Live sharing requires an assigned officer account linked to its current reviewed application and production assignment.',403);
  officerId=link.results[0].entity_id;
  const permitted=await db.prepare(`SELECT ? AS officer_id WHERE EXISTS(SELECT 1 FROM (SELECT ? AS officer_id) p WHERE ${eligible})`).bind(officerId,officerId,now,now,now).first();
  if(!permitted)throw new SignupError('Live sharing requires a current production assignment checked in on post.',409);
 }
 const values=[userId+':'+mode,userId,officerId,mode,latitude,longitude,now,now,expires];
 const result=await db.prepare(`INSERT INTO public_officer_presence(id,user_id,officer_id,mode,latitude,longitude,consented_at,updated_at,expires_at) SELECT ?,?,?,?,?,?,?,?,? ${mode==='live'?`FROM (SELECT ? AS officer_id, ? AS user_id) p WHERE ${currentLink} AND ${eligible}`:'WHERE 1'} ON CONFLICT(user_id,mode) DO UPDATE SET officer_id=excluded.officer_id,latitude=excluded.latitude,longitude=excluded.longitude,updated_at=excluded.updated_at,expires_at=excluded.expires_at`).bind(...values,...(mode==='live'?[officerId,userId,now,now,now]:[])).run();
 if(mode==='live'&&result.meta.changes!==1)throw new SignupError('Your reviewed account link or production assignment changed. Live sharing was not saved.',409);
 return {sharing:true,mode,latitude,longitude,expiresAt:expires};
}
