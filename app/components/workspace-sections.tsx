'use client';
import {useEffect,useState} from 'react';
import styles from './signup-portal.module.css';
export default function WorkspaceSections({items}:{items:{id:string;label:string}[]}){
 const [selected,setSelected]=useState('');
 useEffect(()=>{const sync=()=>setSelected(location.hash.slice(1));const timer=setTimeout(sync,0);window.addEventListener('hashchange',sync);return()=>{clearTimeout(timer);window.removeEventListener('hashchange',sync);};},[]);
 return <nav className={styles.tabs} aria-label="Service sections">{items.map(item=><a key={item.id} href={'#'+item.id} aria-current={selected===item.id?'location':undefined} onClick={()=>setSelected(item.id)}>{item.label}</a>)}</nav>;
}
