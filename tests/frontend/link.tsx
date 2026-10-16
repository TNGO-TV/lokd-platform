import type {AnchorHTMLAttributes} from 'react';
export default function Link({prefetch:ignoredPrefetch,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{prefetch?:boolean}){void ignoredPrefetch;const href=props.href?.startsWith('/')&&new URLSearchParams(location.search).has('preview')?props.href+(props.href.includes('?')?'&':'?')+'preview=1':props.href;return <a {...props} href={href}/>;}
