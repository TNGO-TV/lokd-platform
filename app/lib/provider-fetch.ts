// Workers reject redirect: "error" before I/O. Manual mode keeps credentials and
// request bodies on the original provider origin; never follow a Location header.
export async function fetchWithoutRedirect(transport:typeof fetch,input:RequestInfo|URL,init:RequestInit):Promise<Response>{
 const response=await transport(input,{...init,redirect:'manual'});
 if(response.status>=300&&response.status<400){
  await response.body?.cancel();
  throw new TypeError('Provider redirect refused');
 }
 return response;
}
