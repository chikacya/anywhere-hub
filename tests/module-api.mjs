import assert from 'node:assert/strict';
import {moduleAPI} from '../src/module-api.mjs';
import {validateModuleText} from '../public/lib/module-package.mjs';
const mitm='name = Fixture\nhostname = example.com\n0, 0, ^https://example.com/, 2, ok\n';
const routing='name = Fixture Reject\nrouting = 2\n2, ad.example.com\n';
const raw='https://raw.githubusercontent.com/chikacya/anywhere-rules/main';
const requests=[];
const fetcher=async url=>{requests.push(url);const objects={
 [`${raw}/hub/mitm.json`]:{resources:{'mitm/Fixture.amrs':{title:'Fixture',reject:'mitm/FixtureReject.arrs'}}},
 [`${raw}/hub/common.json`]:{resources:{'rules/common/Fixture.arrs':{}}},
 [`${raw}/rules/index.json`]:{files:[{output_path:'test/Fixture.arrs'}]},
};if(objects[url])return Response.json(objects[url]);const files={ [`${raw}/mitm/Fixture.amrs`]:mitm,[`${raw}/mitm/FixtureReject.arrs`]:routing,[`${raw}/rules/common/Fixture.arrs`]:routing,[`${raw}/rules/test/Fixture.arrs`]:routing};return new Response(files[url]||'missing',{status:files[url]?200:404});};
const call=(path,options={})=>moduleAPI(new Request('http://localhost:4175'+path,options),{}, {},fetcher);
const response=await call('/api/modules/Fixture.amod');assert.equal(response.status,200);assert.equal(response.headers.get("content-disposition"),'inline; filename="Fixture.amod"');const module=validateModuleText(await response.text());assert.equal(module.ruleSets.length,2);assert.equal(module.ruleSets[0].text.trim(),mitm.trim());assert.equal(module.ruleSets[1].routingSeed,'REJECT');
assert.equal((await call('/api/modules/Fixture.amod',{method:'HEAD'})).status,200);assert.equal(await (await call('/api/modules/Fixture.amod',{method:'HEAD'})).text(),'');
assert.equal((await call('/api/modules/Fixture.amod',{headers:{'if-none-match':response.headers.get('etag')}})).status,304);
assert.equal((await call('/api/modules/Fixture.amod',{method:'POST'})).status,405);
assert.equal((await call('/api/modules/Missing.amod')).status,404);
assert.equal((await call('/api/modules/selection.amod?paths=rules%2Fcommon%2FFixture.arrs')).status,200);
assert.equal((await call('/api/modules/selection.amod?paths=rules%2Ftest%2FFixture.arrs')).status,200);
assert.equal((await call('/api/modules/selection.amod?paths=https%3A%2F%2Fexample.com%2Fa.arrs')).status,400);
assert.equal((await call('/api/modules/selection.amod?paths=rules%2F..%2Fa.arrs')).status,400);
assert.equal((await call('/api/modules/selection.amod?paths=rules%2Ftest%2FUnknown.arrs')).status,400);
assert(!requests.some(url=>url.startsWith('https://example.com')));
console.log('Module API: child preservation, routing seed, ETag, HEAD, methods, catalog allowlist passed');

const publishedText='[Module]\nname = Published\ndescription = 来源：@fixture ｜ 净化广告\n\n[MITM]\n'+mitm+'\n[Routing]\n'+routing;
const publishedFetcher=async url=>url===`${raw}/hub/mitm.json`?Response.json({resources:{'mitm/Fixture.amrs':{module:'modules/Fixture.amod'}}}):url===`${raw}/modules/Fixture.amod`?new Response(publishedText):fetcher(url);
const publishedResponse=await moduleAPI(new Request('http://localhost:4175/api/modules/Fixture.amod'),{},{},publishedFetcher);assert.equal(publishedResponse.status,200);assert.equal(await publishedResponse.text(),publishedText);assert.equal(validateModuleText(publishedText).model.description,'来源：@fixture ｜ 净化广告');
console.log('Published module compatibility endpoint: exact file and description preserved');
