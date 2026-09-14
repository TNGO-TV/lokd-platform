import styles from './signup-portal.module.css';

function label(key:string){return key.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/^./,char=>char.toUpperCase());}
function Value({value}:{value:unknown}){
  if(value===null)return <>Not provided</>;
  if(Array.isArray(value))return value.length?<ol>{value.map((item,index)=><li key={index}><Value value={item}/></li>)}</ol>:<>None recorded</>;
  if(typeof value==='object')return <dl className={styles.details}>{Object.entries(value as Record<string,unknown>).map(([key,item])=><div key={key}><dt>{label(key)}</dt><dd><Value value={item}/></dd></div>)}</dl>;
  return <>{typeof value==='boolean'?(value?'Yes':'No'):String(value)}</>;
}
// Presentation only: all stored fields remain available; exact JSON is retained for audit.
export default function RecordDetails({json}:{json:string}){
  let value:unknown;
  try{value=JSON.parse(json);}catch{return <p role="alert">This record could not be displayed. Refresh it or ask Operations to review the source record.</p>;}
  return <div><Value value={value}/><details><summary>View exact stored record</summary><pre>{json}</pre></details></div>;
}
