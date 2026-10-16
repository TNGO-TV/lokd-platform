import MagicString from 'magic-string';
import type {Plugin,ResolvedConfig} from 'vite';

export function mapRscTransform(input:string,result:unknown,source:string,kind:'prefix'|'manifest'|'action-manifest'){
 if(result==null)return result;
 if(typeof result!=='string'&&(typeof result!=='object'||!('code' in result)||typeof result.code!=='string'))throw Error('RSC transform returned an unsupported code shape; review its source-map adapter.');
 const code=typeof result==='string'?result:result.code;
 if(typeof code!=='string')throw Error('RSC transform returned non-text code.');
 if(typeof result==='object'&&'map' in result&&result.map)return result;
 if(code===input)return result;
 const mapped=new MagicString(input);
 if(kind==='prefix'){
  if(!code.endsWith(input))throw Error('RSC AsyncLocalStorage transform changed; review its source-map adapter.');
  mapped.prepend(code.slice(0,code.length-input.length));
 }else{
  const needle=kind==='action-manifest'?'virtual:vinext-action-owner-manifest':'virtual:vite-rsc/assets-manifest',positions:number[]=[];
  for(let index=input.indexOf(needle);index>=0;index=input.indexOf(needle,index+needle.length))positions.push(index);
  const length=needle.length+(code.length-input.length)/positions.length;
  if(!positions.length||!Number.isSafeInteger(length)||length<1)throw Error('RSC manifest transform changed; review its source-map adapter.');
  const replacement=code.slice(positions[0],positions[0]+length);
  for(const position of positions)mapped.overwrite(position,position+needle.length,replacement);
 }
 if(mapped.toString()!==code)throw Error('RSC transform differs from its mapped edits.');
 return {...(typeof result==='object'?result:{}),code,map:mapped.generateMap({source,includeContent:true,hires:true})};
}

// Preserve the upstream hooks, context, filters and predicates. Only their missing
// maps are supplied, and only when the actual edits match these verified forms.
export function rscSourceMaps():Plugin{
 return {name:'lokd-rsc-transform-maps',enforce:'pre',configResolved(config:ResolvedConfig){
  let found=0;
  for(const plugin of config.plugins){
   if(plugin.name==='rsc:inject-async-local-storage'){
    const hook=plugin.transform;if(!hook)throw Error('RSC AsyncLocalStorage hook is missing.');
    const handler=typeof hook==='function'?hook:hook.handler;
    const wrapped:typeof handler=async function(code,id,...rest){return mapRscTransform(code,await handler.call(this,code,id,...rest),id,'prefix') as Awaited<ReturnType<typeof handler>>;};
    plugin.transform=typeof hook==='function'?wrapped:{...hook,handler:wrapped};found++;
   }
   if(plugin.name==='rsc:virtual:vite-rsc/assets-manifest'||plugin.name==='vinext:action-owner-manifest'){
    const kind=plugin.name==='vinext:action-owner-manifest'?'action-manifest':'manifest';
    const hook=plugin.renderChunk;if(!hook)throw Error('RSC manifest hook is missing.');
    const handler=typeof hook==='function'?hook:hook.handler;
    const wrapped:typeof handler=async function(code,chunk,...rest){return mapRscTransform(code,await handler.call(this,code,chunk,...rest),chunk.fileName,kind) as Awaited<ReturnType<typeof handler>>;};
    plugin.renderChunk=typeof hook==='function'?wrapped:{...hook,handler:wrapped};found++;
   }
  }
  if(found!==3)throw Error('Expected exactly three reviewed RSC/Vinext source-map hooks; inspect the installed adapter version.');
 }};
}
