import type {AnchorHTMLAttributes} from 'react';
export default function Link(props:AnchorHTMLAttributes<HTMLAnchorElement>){const href=props.href?.startsWith('/')&&new URLSearchParams(location.search).has('preview')?props.href+(props.href.includes('?')?'&':'?')+'preview=1':props.href;return <a {...props} href={href}/>;}
