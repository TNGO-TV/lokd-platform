import {readRequestBytes,readRequestText,RequestBodyError} from './request-body';
import {SignupError} from './signup-server';

export async function readFinanceText(request:Request,maxBytes:number,timeoutMs=5000){
 try{return await readRequestText(request,maxBytes,timeoutMs);}
 catch(error){if(error instanceof RequestBodyError)throw new SignupError(error.status===413?'Request too large.':error.message,error.status);throw error;}
}

export async function readFinanceWebhookBytes(request:Request,timeoutMs=5000){
 if(!request.body)throw new SignupError('Missing event.');
 try{return await readRequestBytes(request,262144,timeoutMs);}
 catch(error){if(error instanceof RequestBodyError)throw new SignupError(error.status===413?'Event too large.':error.message,error.status);throw error;}
}

// Preserve fixed-origin transports and their existing network AbortSignal.
// This additional cap bounds parsing if the provider returns an excessive body.
export async function readFinanceProviderJson(response:Response){
 return JSON.parse(await readRequestText(response,262144,20000)) as {status?:boolean;data?:unknown};
}
