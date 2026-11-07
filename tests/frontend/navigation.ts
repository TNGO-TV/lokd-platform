export function usePathname(){return window.location.pathname;}
export function useSearchParams(){return new URLSearchParams(window.location.search);}

export function useRouter(){return {push:(href:string)=>window.location.assign(href),replace:(href:string)=>window.location.replace(href),refresh:()=>window.location.reload()};}
