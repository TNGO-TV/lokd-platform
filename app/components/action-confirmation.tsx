'use client';
import {useRef,useState} from 'react';
import styles from './signup-portal.module.css';

type Field={name:string;label:string;maxLength?:number};
export default function ActionConfirmation({label,acknowledgement,fields=[],disabled=false,onConfirm}:{label:string;acknowledgement?:string;fields?:Field[];disabled?:boolean;onConfirm:(values:Record<string,string>)=>Promise<boolean>}){
 const [open,setOpen]=useState(false),[checked,setChecked]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
 const inFlight=useRef(false),trigger=useRef<HTMLButtonElement>(null);
 function close(){setOpen(false);setChecked(false);setError('');requestAnimationFrame(()=>trigger.current?.focus());}
 return <div><button ref={trigger} type="button" disabled={disabled||pending} aria-expanded={open} onClick={()=>{setOpen(true);setError('');}}>{label}</button>{open&&<form aria-label={label} className={styles.form} onSubmit={async e=>{
  e.preventDefault();if(disabled||inFlight.current||(acknowledgement&&!checked))return;
  const values=Object.fromEntries([...new FormData(e.currentTarget)].map(([name,value])=>[name,String(value).trim()]));
  if(fields.some(field=>!values[field.name])){setError('Complete each required field.');return;}
  inFlight.current=true;setPending(true);setError('');
  try{if(await onConfirm(values)===true)close();}catch{setError('The action could not be completed. Your entries have been retained.');}finally{inFlight.current=false;setPending(false);}
 }}><fieldset disabled={disabled||pending} style={{border:0,padding:0,margin:0,minWidth:0,display:'grid',gap:'1rem'}}>
 {fields.map((field,index)=><label key={field.name}>{field.label}<textarea name={field.name} required maxLength={field.maxLength??1200} autoFocus={index===0}/></label>)}
 {acknowledgement&&<label><input type="checkbox" required checked={checked} autoFocus={!fields.length} onChange={e=>setChecked(e.target.checked)}/>{acknowledgement}</label>}
 {error&&<p role="alert">{error}</p>}
 <div style={{display:'flex',flexWrap:'wrap',gap:'.75rem'}}><button type="submit" disabled={!!acknowledgement&&!checked}>{pending?'Saving…':'Confirm '+label.toLowerCase()}</button><button type="button" onClick={close}>Keep unchanged</button></div>
 </fieldset></form>}</div>;
}
