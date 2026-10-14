// Pure ESM. Codable shapes follow Anywhere 397 Module/MITMRule/RoutingRule.
export const MODULE_LIMITS = Object.freeze({ruleSets:64,routingRules:100000,mitmRules:10000,parameters:256,iconBytes:65536,encodedBytes:900000});
const uuid='00000000-0000-0000-0000-000000000000';
const bytes=s=>new TextEncoder().encode(s).length;
const fail=s=>{throw new Error(s);};
export function splitCSV(input){
 const fields=[];let i=0;
 while(true){while(input[i]===' '||input[i]==='\t')i++;let cur='';
 if(input[i]==='"'){i++;let closed=false;while(i<input.length){if(input[i]==='"'){if(input[i+1]==='"'){cur+='"';i+=2;}else{i++;closed=true;break;}}else cur+=input[i++];}if(!closed)fail('Unterminated CSV quote');while(input[i]===' '||input[i]==='\t')i++;if(i<input.length&&input[i]!==',')fail('Characters after CSV quote');}
 else{while(i<input.length&&input[i]!==',')cur+=input[i++];cur=cur.trim();}
 fields.push(cur);if(i>=input.length)break;i++;}return fields;
}
function base64Bytes(s){if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))fail('Invalid Base64');return s.length/4*3-(s.endsWith('==')?2:s.endsWith('=')?1:0);}
function rule(fields){const [phase,op,urlPattern,...a]=fields;if(!['0','1'].includes(phase)||!urlPattern)fail('Invalid MITM phase/pattern');let operation;
 const exact=n=>{if(a.length!==n)fail(`Invalid MITM operation ${op} arity`);};
 if(op==='0'){const [mode,...v]=a;let rewrite; if(['0','1'].includes(mode)){if(v.length!==1||!new URL(v[0]).host)fail('Invalid rewrite URL');rewrite={kind:mode==='0'?'transparent':'redirect302',url:v[0]};}else if(['2','4'].includes(mode)){if(v.length>1)fail('Invalid rewrite fields');rewrite=mode==='2'?{kind:'reject200Text',content:v[0]??''}:{kind:'reject200Data',base64:v[0]??''};}else if(mode==='3'&&v.length===0)rewrite={kind:'reject200Gif'};else fail('Unknown rewrite mode');operation={kind:'rewrite',rewrite};}
 else if(['1','2','3'].includes(op)){exact(op==='2'?1:2);if(!a[0])fail('Empty header name');operation={kind:({'1':'headerAdd','2':'headerDelete','3':'headerReplace'})[op],name:a[0],...(op==='2'?{}:{value:a[1]})};}
 else if(op==='4'){exact(2);operation={kind:'bodyReplace',search:a[0],replacement:a[1]};}
 else if(['100','101'].includes(op)){exact(1);if(!a[0])fail('Empty script');base64Bytes(a[0]);operation={kind:op==='100'?'script':'streamScript',script:a[0]};}
 else if(op==='5'){const actionMap={'add':['add','path','value'],'replace':['replace','path','value'],'delete':['delete','path'],'replace-recursive':['replaceRecursive','key','value'],'delete-recursive':['deleteRecursive','key'],'remove-where-key-exists':['removeWhereKeyExists','path','key'],'remove-where-field-in':['removeWhereFieldIn','path','field','values']};let shape=actionMap[a[0].toLowerCase()];if(!shape)shape=Object.values(actionMap).find(x=>x[0].toLowerCase()===a[0].toLowerCase());if(!shape||a.length!==shape.length)fail('Invalid JSON operation');const json={action:shape[0]};shape.slice(1).forEach((k,i)=>json[k]=a[i+1]);operation={kind:'bodyJSON',json};}
 else fail(`Unknown MITM operation ${op}`);
 return {phase:op==='0'||phase==='0'?'httpRequest':'httpResponse',urlPattern,operation};
}
export function parseRuleSet(kind,text){
 if(!['mitm','routing'].includes(kind))fail('Unknown rule-set kind');let name='',domainSuffixes=[],rules=[],parameters=[],routingSeed=null,section='rule';const parameterNames=new Set();
 for(const raw of text.split(/\r\n|[\n\r\u0085\u2028\u2029]/)){const l=raw.trim();if(!l||l.startsWith('#')||l.startsWith('//'))continue;
 if(/^\[.*\]$/.test(l)){const marker=l.slice(1,-1).trim().toLowerCase();if(['module','routing','mitm'].includes(marker))fail('Nested module section');if(kind==='routing')fail('Section in routing set');section=['parameter','parameters','param','params'].includes(marker)?'parameter':['rule','rules'].includes(marker)?'rule':'ignored';continue;}
 const h=l.match(/^(name|hostname|routing|icon-light|icon-dark)\s*=\s*(.*)$/i);if(h){const k=h[1].toLowerCase(),v=h[2].trim();if(k==='name')name=v;if(k==='hostname'){if(kind!=='mitm')fail('MITM header in routing');domainSuffixes=v.split(',').map(x=>x.trim()).filter(Boolean);}if(k==='routing'){if(kind!=='routing'||!['0','1','2'].includes(v))fail('Invalid routing seed');routingSeed=({0:null,1:'DIRECT',2:'REJECT'})[v];}continue;}
 if(section==='ignored')fail('Ignored section contains active data');
 if(kind==='routing'){const at=l.indexOf(',');const prefix=l.slice(0,at).trim();const type=Number(prefix);let value=l.slice(at+1).trim();if(at<0||!/^\d+$/.test(prefix)||![0,1,2,3].includes(type)||!value)fail('Invalid routing rule');if(type<2&&!value.includes('/'))value+=type===0?'/32':'/128';rules.push({type,value});}
 else if(section==='parameter'){const f=splitCSV(l),type=Number(f[0]),dataType=Number(f[1]);if(f.length<6||!['0','1'].includes(f[0])||f[1]!=='0'||![0,1].includes(type)||dataType!==0||!/^\w+$/.test(f[2])||bytes(f[2])>128||parameterNames.has(f[2]))fail('Invalid/duplicate parameter');parameterNames.add(f[2]);let options=type===1?(f[6]??'').replace(/^\[/,'').replace(/\]$/,'').split(',').map(x=>x.trim()).filter(Boolean):[];let defaultValue=f[5];if(type===1){if(!options.length)fail('Empty picker');if(!defaultValue)defaultValue=options[0];else if(!options.includes(defaultValue))options.unshift(defaultValue);}parameters.push({type,dataType,name:f[2],defaultValue,options,...(f[3]?{label:f[3]}:{}),...(f[4]?{description:f[4]}:{})});}
 else rules.push(rule(splitCSV(l)));
 }
 if(!name||/[\r\n]/.test(name))fail('Stable child name required');if(rules.length>(kind==='mitm'?MODULE_LIMITS.mitmRules:MODULE_LIMITS.routingRules)||parameters.length>MODULE_LIMITS.parameters)fail('Rule-set limit exceeded');
 const model={id:uuid,name,...(kind==='mitm'?{enabled:true,domainSuffixes}:{}),rules,...(parameters.length?{parameters}:{})};return {kind,name,text,routingSeed,model};
}
// JSONEncoder escapes forward slashes by default. Count the modeled record,
// including UUIDs, timestamp, subscription URL, operations and parameters.
export function encodedModuleBytes(model){return bytes(JSON.stringify(model).replaceAll('/','\\/'));}
export function validateModuleText(text,{subscriptionURL}={}){
 const parts=[];let kind='module',lines=[];const flush=()=>{parts.push({kind,text:lines.join('\n')});lines=[];};
 for(const l of text.split(/\r\n|[\n\r\u0085\u2028\u2029]/)){const m=l.trim().match(/^\[\s*(module|routing|mitm)\s*\]$/i);if(m){flush();kind=m[1].toLowerCase();}else lines.push(l);}flush();let name='',description,iconLight,iconDark;const ruleSets=[];
 for(const p of parts){if(p.kind==='module'){for(const l of p.text.split('\n')){const m=l.trim().match(/^(name|description|icon-light|icon-dark)\s*=\s*(.*)$/i);if(m){const k=m[1].toLowerCase(),v=m[2].trim();if(k==='name')name=v;else if(k==='description')description=v||undefined;else{if(base64Bytes(v)>MODULE_LIMITS.iconBytes)fail('Module icon exceeds 64 KiB');if(k==='icon-light')iconLight=v;else iconDark=v;}}}}else if(p.text.split('\n').some(x=>x.trim()&&!/^\s*(#|\/\/)/.test(x)))ruleSets.push(parseRuleSet(p.kind,p.text));}
 if(!name)fail('Module name required');if(!ruleSets.length||ruleSets.length>MODULE_LIMITS.ruleSets)fail('Module rule-set limit exceeded');const seen=new Set();for(const s of ruleSets){const key=s.kind+'\0'+s.name;if(seen.has(key))fail('Duplicate child kind/name');seen.add(key);}
 if(subscriptionURL){const u=new URL(subscriptionURL);if(!['http:','https:'].includes(u.protocol)||!u.pathname.toLowerCase().endsWith('.amod'))fail('Invalid module subscription URL');}
 const model={id:uuid,name,enabled:true,...(description?{description}:{}),...(subscriptionURL?{subscriptionURL}:{}),...(iconLight?{iconLight}:{}),...(iconDark?{iconDark}:{}),routingRuleSets:ruleSets.filter(s=>s.kind==='routing').map(s=>s.model),mitmRuleSets:ruleSets.filter(s=>s.kind==='mitm').map(s=>s.model),updatedAt:813456789.123456};
 const encodedBytes=encodedModuleBytes(model);if(encodedBytes>MODULE_LIMITS.encodedBytes)fail(`Module JSON exceeds 900000 bytes: ${encodedBytes}`);
 return {text,model,ruleSets,metrics:{encodedBytes,fileBytes:bytes(text),ruleSetCount:ruleSets.length,routingRules:model.routingRuleSets.reduce((a,s)=>a+s.rules.length,0),mitmRules:model.mitmRuleSets.reduce((a,s)=>a+s.rules.length,0),parameters:model.mitmRuleSets.reduce((a,s)=>a+(s.parameters?.length??0),0)}};
}
export function packageModule({name,description,ruleSets,iconLight,iconDark,subscriptionURL}){
 if(typeof name!=='string'||!name.trim()||/[\r\n\u0085\u2028\u2029]/.test(name))fail('Invalid module name');let text=`[Module]\nname = ${name.trim()}\n`;if(description!==undefined){if(typeof description!=='string'||/[\r\n\u0085\u2028\u2029]/.test(description))fail('Description must be one physical line');if(description.trim())text+=`description = ${description.trim()}\n`;}if(iconLight)text+=`icon-light = ${iconLight}\n`;if(iconDark)text+=`icon-dark = ${iconDark}\n`;
 for(const s of ruleSets){const parsed=parseRuleSet(s.kind,s.text);const body=s.text.split(/\r\n|[\n\r\u0085\u2028\u2029]/).filter(l=>!/^\s*icon-(light|dark)\s*=/i.test(l)).join('\n');text+=`\n[${parsed.kind==='mitm'?'MITM':'Routing'}]\n${body}${body.endsWith('\n')?'':'\n'}`;}
 return validateModuleText(text,{subscriptionURL});
}
