export const useClerk=()=>({openUserProfile:()=>{}});
export const useAuth=()=>({getToken:async()=>'',isLoaded:true});
export const useReverification=(callback:()=>unknown)=>callback;
