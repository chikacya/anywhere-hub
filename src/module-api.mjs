import {packageModule,validateModuleText} from '../public/lib/module-package.mjs';
const RAW_BASE='https://raw.githubusercontent.com/chikacya/anywhere-rules/main';
const safePath=value=>typeof value==='string'&&value.length<=240&&/^(?:mitm|rules)\/[A-Za-z0-9_./ -]+\.(?:amrs|arrs)$/.test(value)&&!value.split('/').some(part=>!part||part==='.'||part==='..');
async function getJSON(url,fetcher){const response=await fetcher(url);if(!response.ok)throw Error('Rule catalog unavailable');return response.json();}
async function getCatalog(kind,request,env,fetcher){try{return await getJSON(`${RAW_BASE}/hub/${kind}.json`,fetcher);}catch{const response=await env.ASSETS.fetch(new Request(new URL(`/resource-metadata-${kind}.json`,request.url)));if(!response.ok)throw Error('Rule catalog unavailable');return response.json();}}
async function digest(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export async function moduleAPI(request,env,ctx,fetcher=fetch){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/modules/'))return null;
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
 const match=url.pathname.match(/^\/api\/modules\/([A-Za-z0-9_-]+)\.amod$/);if(!match)return new Response('Not found',{status:404});
 try{
  let paths,name,iconLight,description,publishedText;const id=match[1];
  if(id==='selection'){
   const input=url.searchParams.get('paths');if(!input||input.length>12000)throw Error('Invalid module selection');paths=[...new Set(input.split(','))].sort();if(!paths.length||paths.length>48||paths.some(p=>!safePath(p)))throw Error('Invalid module paths');
   const allowed=new Set();const common=await getCatalog('common',request,env,fetcher);for(const p of Object.keys(common.resources||{}))allowed.add(p);
   if(paths.some(p=>!allowed.has(p))){const index=await getJSON(`${RAW_BASE}/rules/index.json`,fetcher);for(const file of index.files||[])if(safePath(`rules/${file.output_path}`))allowed.add(`rules/${file.output_path}`);}
   if(paths.some(p=>!allowed.has(p)||!p.endsWith('.arrs')))throw Error('Selection contains an unknown routing file');name='Routing · '+(await digest(paths.join('\n'))).slice(0,16);
  }else{
   const catalog=await getCatalog('mitm',request,env,fetcher);const path=`mitm/${id}.amrs`,metadata=catalog.resources?.[path];if(!metadata)return new Response('Unknown module',{status:404});paths=[path];if(metadata.reject){if(!safePath(metadata.reject)||!metadata.reject.startsWith('mitm/')||!metadata.reject.endsWith('.arrs'))throw Error('Invalid associated routing file');paths.push(metadata.reject);}name=id;iconLight=metadata.icon||undefined;description=metadata.description||undefined;
   if(metadata.module){if(!/^modules\/[A-Za-z0-9_-]+\.amod$/.test(metadata.module))throw Error('Invalid published module path');const response=await fetcher(`${RAW_BASE}/${metadata.module}`);if(!response.ok)throw Error('Published module unavailable');publishedText=await response.text();}
  }
  const ruleSets=publishedText?[]:await Promise.all(paths.map(async path=>{const response=await fetcher(`${RAW_BASE}/${path}`);if(!response.ok)throw Error('Rule source unavailable: '+path);const text=await response.text();if(new TextEncoder().encode(text).length>4000000)throw Error('Rule source too large');return{kind:path.endsWith('.amrs')?'mitm':'routing',text};}));
  const output=publishedText?validateModuleText(publishedText,{subscriptionURL:url.href}):packageModule({name,description,ruleSets,iconLight,subscriptionURL:url.href});const etag='"'+await digest(output.text)+'"';const headers={'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=60',etag,'x-module-min-version':'397','content-disposition':`inline; filename="${id}.amod"`};
  if((request.headers.get('if-none-match')||'').split(',').some(v=>v.trim()==='*'||v.trim().replace(/^W\//,'')===etag))return new Response(null,{status:304,headers});
  return new Response(request.method==='HEAD'?null:output.text,{headers});
 }catch(error){return Response.json({error:error.message},{status:400,headers:{'cache-control':'no-store'}});}
}
