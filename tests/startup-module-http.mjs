import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createSelectionEngine} from '../public/lib/startup-core.mjs';
import {validateModuleText,parseRuleSet} from '../public/lib/module-package.mjs';
const origin=process.argv[2]||'http://localhost:4175';
const bundle=JSON.parse(fs.readFileSync(new URL('../src/generated/startup-bundle.json',import.meta.url)));const engine=createSelectionEngine(bundle);
for(const ids of [[bundle.apps.find(a=>a.available).id],bundle.apps.filter(a=>a.available).map(a=>a.id)]){
 const code=engine.encode(ids),url=origin+'/api/startup/selection.amod?s='+code,response=await fetch(url);assert.equal(response.status,200,await response.clone().text());const text=await response.text(),module=validateModuleText(text,{subscriptionURL:url}),assembled=engine.assemble(ids);assert.equal(module.model.name,'应用开屏去广告');
 const expected=['mitm','direct','reject'].filter(k=>assembled[k]).map(k=>parseRuleSet(k==='mitm'?'mitm':'routing',assembled[k]));assert.equal(module.ruleSets.length,expected.length);for(let i=0;i<expected.length;i++){assert.deepEqual(module.ruleSets[i].model,expected[i].model);assert.equal(module.ruleSets[i].routingSeed,expected[i].routingSeed);}
 assert.equal(response.headers.get('etag'),'"'+createHash('sha256').update(text).digest('hex')+'"');
 const legacy='"'+bundle.revision+'-'+code+'-selection-amod1"';assert.equal((await fetch(url,{headers:{'if-none-match':legacy}})).status,200);
 assert.equal((await fetch(url,{headers:{'if-none-match':response.headers.get('etag')}})).status,304);const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');console.log(ids.length+' selected; '+module.metrics.encodedBytes+' encoded bytes; '+module.ruleSets.length+' unchanged children');
}
assert.equal((await fetch(origin+'/api/startup/selection.amod?s=bad')).status,400);assert.equal((await fetch(origin+'/api/startup/selection.amod?s=1.')).status,400);assert.equal((await fetch(origin+'/api/startup/selection.amod',{method:'POST'})).status,405);
