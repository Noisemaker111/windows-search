import {buildIndex,search} from './pc'
import {models,request,createCompleter} from './opencode'
import {EmptySessionPool} from './session-pool'
import {answerPrompt} from './answer-prompt'
import {relevant,type Source} from './evidence'
import {needsWeb} from './retrieval-intent'
import {join} from 'node:path'
import {mkdir} from 'node:fs/promises'
import {isolateBenchmarkRuntime} from './benchmark-runtime'

// Opt-in only: real subscription requests. Never imported by the app or CI.
if(process.env.SEARCH_BENCHMARK!=='1')throw Error('Set SEARCH_BENCHMARK=1 to run real subscription requests')
const extra=[{id:'claude-3-5-haiku-20241022',name:'Haiku 3.5',providerID:'cliproxyapi'},{id:'gpt-5.3-codex-spark',name:'Spark',providerID:'cliproxyapi'}]
models.push(...extra) // This isolated process only; the product allowlist is unchanged.
const contenders=[models[0],models[1],...extra,models[3]].filter(m=>!process.env.SEARCH_BENCH_MODELS||process.env.SEARCH_BENCH_MODELS.split(',').includes(m.id))
if(!contenders.length)throw Error('No benchmark models selected')
const output=process.env.SEARCH_BENCH_OUTPUT==='extra'?'extra':'model'
const directory=join(import.meta.dir,'.cache','benchmark-runtime')
await mkdir(directory,{recursive:true})
const config=isolateBenchmarkRuntime(await Bun.file(join(import.meta.dir,'runtime-config','opencode.json')).json())
for(const m of extra)config.providers.cliproxyapi.models[m.id]={name:m.name,limit:{context:200000,output:4096}}
await Bun.write(join(directory,'opencode.json'),JSON.stringify(config,null,2))
const owned=new Set<string>()
const call:typeof request=async(path,body,signal,method)=>{
 if(path==='/api/session'&&body)body={...body as object,location:{directory}}
 const res=await request(path,body,signal,method)
 if(path==='/api/session'&&body)owned.add((await res.clone().json() as {data:{id:string}}).data.id)
 return res
}
const remove=async(id:string)=>{await call('/api/session/'+id,undefined,AbortSignal.timeout(3000),'DELETE');owned.delete(id)}
const pool=new EmptySessionPool(async id=>{
 const model=contenders.find(m=>m.id===id)!
 const res=await call('/api/session',{title:'Windows search benchmark',agent:'search-bar',model:{id,providerID:model.providerID}},AbortSignal.timeout(5000))
 return (await res.json() as {data:{id:string}}).data.id
},remove)
const complete=createCompleter(call,30000,pool)
const queries=[
 {kind:'exact location',query:'Where is 7 Days to Die'},
 {kind:'transposed typo',query:'Where is 7 dyas to die'},
 {kind:'projects',query:'Where are my projects'},
 {kind:'vague local intent',query:'Find the zombie survival game I have installed'},
 {kind:'missing local item',query:'Where is DefinitelyMissingAppZXQ937'},
 {kind:'current web',query:'Who is the current president of France?'},
 {kind:'general explanation',query:'What is RAM used for?'}
]
const index=await buildIndex()
// Same RSS and relevance policy as main.ts; acquire once per query for equal evidence.
const xml=(s:string)=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
const fixtures=[]
for(const q of queries){
 const start=performance.now();const hits=search(index,q.query);const localMs=performance.now()-start
 let sources:Source[]=[];const retrievalStart=performance.now()
 if(needsWeb(q.query,!!hits.length))try{
 const res=await fetch('https://www.bing.com/search?format=rss&q='+encodeURIComponent(q.query),{signal:AbortSignal.timeout(3000)})
 if(res.ok)sources=[...(await res.text()).matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,4).map(m=>{const field=(n:string)=>xml(m[1].match(new RegExp('<'+n+'>([\\s\\S]*?)</'+n+'>'))?.[1]||'');return {title:field('title'),url:field('link'),content:field('description')}}).filter(x=>x.url.startsWith('https://')&&relevant(q.query,x))
 }catch{}
 fixtures.push({...q,hits,sources,localMs,retrievalMs:performance.now()-retrievalStart,prompt:answerPrompt(q.query,hits,sources)})
}
await Bun.write('.cache/model-fixtures.json',JSON.stringify(fixtures,null,2))
const rows:unknown[]=[];const disabled=new Set<string>();const cleanupFailures:string[]=[]
try{
 for(let round=0;round<2;round++)for(let qi=0;qi<fixtures.length;qi++)for(let mi=0;mi<contenders.length;mi++){
 const model=contenders[(mi+qi+round)%contenders.length];if(disabled.has(model.id))continue
 const f=fixtures[qi];const prep=performance.now();await pool.warm(model.id);const preparationMs=performance.now()-prep
 const start=performance.now();let firstMs:number|undefined
 let row
 try{
 const result=await complete(model.id,f.prompt,()=>{firstMs??=performance.now()-start},AbortSignal.timeout(35000))
 row={model:model.name,id:model.id,round,kind:f.kind,query:f.query,hits:f.hits.length,sources:f.sources.length,preparationMs,firstMs,totalMs:performance.now()-start,timings:result.timings,usage:result.usage,text:result.text}
 await remove(result.session).catch(e=>cleanupFailures.push(String(e)))
 }catch(e){row={model:model.name,id:model.id,round,kind:f.kind,error:String(e),totalMs:performance.now()-start};disabled.add(model.id)}
 rows.push(row);console.log(JSON.stringify(row));await Bun.write('.cache/'+output+'-results.json',JSON.stringify(rows,null,2))
 }
}finally{
 await pool.dispose()
 for(const id of [...owned])await remove(id).catch(e=>cleanupFailures.push(String(e)))
 await Bun.write('.cache/'+output+'-cleanup.json',JSON.stringify({remaining:owned.size,cleanupFailures}))
 console.log(JSON.stringify({completed:rows.length,disabled:[...disabled],remainingOwnedSessions:owned.size}))
}
