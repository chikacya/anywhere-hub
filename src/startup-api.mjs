import bundle from './generated/startup-bundle.json';
import {createSelectionEngine} from '../public/lib/startup-core.mjs';
const engine=createSelectionEngine(bundle);
export async function startupAPI(request, env, ctx) {
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/startup/'))return null;
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
 if(url.pathname==='/api/startup/catalog')return Response.json({schemaVersion:1,ids:bundle.ids,apps:bundle.apps,revision:bundle.revision,version:bundle.version,updated:bundle.updated},{headers:{'cache-control':'public, max-age=60'}});
 const match=url.pathname.match(/^\/api\/startup\/(mitm\.amrs|direct\.arrs|reject\.arrs)$/);if(!match)return new Response('Not found',{status:404});
 try{
  const ids=engine.decode(url.searchParams.get('s'));if(!ids.length)throw Error('Select at least one application');const code=engine.encode(ids),type=match[1].split('.')[0],etag=`"${bundle.revision}-${code}-${type}"`;
  const headers={'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=300','etag':etag,'x-startup-revision':bundle.revision};
  if((request.headers.get('if-none-match')||'').split(',').some(v=>v.trim()==='*'||v.trim().replace(/^W\//,'')===etag))return new Response(null,{status:304,headers});
  const key=new Request(url.origin+'/api/startup/cache/'+bundle.revision+'/'+match[1]+'?s='+code);
  const cache=globalThis.caches?.default;const hit=cache?await cache.match(key):null;
  if(hit)return new Response(request.method==='HEAD'?null:hit.body,{headers:hit.headers});
  const output=engine.assemble(ids)[type];if(!output)return new Response('This selection has no '+type+' rules',{status:404});
  const response=new Response(output,{headers});if(cache)ctx.waitUntil(cache.put(key,response.clone()));return request.method==='HEAD'?new Response(null,{headers}):response;
 }catch(error){return Response.json({error:error.message},{status:400,headers:{'cache-control':'no-store'}});}
}
