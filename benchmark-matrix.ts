import {join} from 'node:path'
import {mkdir} from 'node:fs/promises'
import {models,request,createCompleter} from './opencode'
import {EmptySessionPool} from './session-pool'
import {answerPrompt} from './answer-prompt'
import {fixtureEvidence} from './benchmark-fixtures'
import {isolateBenchmarkRuntime} from './benchmark-runtime'

type Cell={key:string;model:string;provider:string;effort:string;declared:string[];basis:string}
const phase=process.argv[2]
if(process.env.SEARCH_BENCHMARK!=='1'||!['prepare','screen','finalists','projects'].includes(phase))throw Error('Opt-in: SEARCH_BENCHMARK=1 bun benchmark-matrix.ts prepare|screen|finalists|projects')
const directory=join(import.meta.dir,'.cache','matrix-runtime')
await mkdir(directory,{recursive:true})
if(phase==='prepare'){
 const live=(await (await fetch('http://127.0.0.1:8317/v1/models',{headers:{Authorization:'Bearer local'}})).json() as {data:{id:string}[]}).data
 const definitions=await (await fetch('https://raw.githubusercontent.com/router-for-me/CLIProxyAPI/v7.2.147/internal/registry/models/models.json')).json() as Record<string,any[]>
 const cells:Cell[]=[]
 const inventory=[]
 for(const {id} of [...live,{id:'grok-4.6'}]){
  if(/image|auto-review/.test(id)){inventory.push({model:id,excluded:'image generation or internal review'});continue}
  const d=Object.values(definitions).flat().find(m=>m.id===id)
  const t=d?.thinking
  const levels:string[]=t?.levels||[]
  const declared=[...(t?.zero_allowed?['none']:[]),...levels]
  const efforts=t?.zero_allowed?['none','low']:levels.length?levels.slice(0,2):t?['default','low']:['default','low']
  inventory.push({model:id,declared:declared.length?declared:t?['token-budget',t.min,t.max]:[],screened:efforts,basis:d?'v7.2.147 static metadata':'unknown; request probe only'})
  for(const effort of efforts)cells.push({key:'matrix-'+cells.length,model:id,provider:id==='grok-4.6'?'grok-sub':'cliproxyapi',effort,declared,basis:d?'static metadata':'probe; support unverified'})
 }
 const config=isolateBenchmarkRuntime(await Bun.file('runtime-config/opencode.json').json())
 config.providers.cliproxyapi.settings.baseURL='http://127.0.0.1:8337/cliproxy/v1'
 config.providers['grok-sub'].settings.baseURL='http://127.0.0.1:8337/grok/v1'
 for(const c of cells)config.providers[c.provider].models[c.key]={modelID:c.model,name:c.model+' '+c.effort,body:c.effort==='default'?{}:{reasoning_effort:c.effort},limit:{context:200000,output:4096}}
 await Bun.write(join(directory,'opencode.json'),JSON.stringify(config,null,2))
 await Bun.write('.cache/matrix-cells.json',JSON.stringify(cells,null,2))
 await Bun.write('model-reasoning-inventory.json',JSON.stringify(inventory,null,2)+'\n')
 console.log(JSON.stringify({advertised:live.length,cells:cells.length,models:new Set(cells.map(c=>c.model)).size}));process.exit(0)
}
const cells=await Bun.file('.cache/matrix-cells.json').json() as Cell[]
// Also sanitize a runtime prepared before discovery support was integrated.
const configPath=join(directory,'opencode.json')
await Bun.write(configPath,JSON.stringify(isolateBenchmarkRuntime(await Bun.file(configPath).json()),null,2))
const selected=phase==='screen'?cells:cells.filter(c=>(process.env.SEARCH_BENCH_CELLS||'').split(',').includes(c.key))
if(!selected.length)throw Error('Select finalist keys with SEARCH_BENCH_CELLS')
let wire:{model:unknown;effort:unknown;status?:number;headersMs?:number}[]=[]
// Benchmark-only relay observes model/effort, never saves auth, prompts or reasoning text.
const relay=Bun.serve({hostname:'127.0.0.1',port:8337,idleTimeout:60,async fetch(req){
 if(req.headers.has('origin'))return new Response('Foreign origin',{status:403})
 if(req.method!=='POST'||!req.headers.get('content-type')?.startsWith('application/json'))return new Response('JSON POST required',{status:405})
 const u=new URL(req.url);const prefix=u.pathname.startsWith('/cliproxy/')?'/cliproxy':u.pathname.startsWith('/grok/')?'/grok':undefined
 if(!prefix||!['/cliproxy/v1/chat/completions','/grok/v1/chat/completions'].includes(u.pathname))return new Response('Unknown benchmark route',{status:404})
 const body=await req.text();const parsed=JSON.parse(body)
 const observed={model:parsed.model,effort:parsed.reasoning_effort??'absent',status:undefined as number|undefined,headersMs:undefined as number|undefined};wire.push(observed)
 const start=performance.now();const upstream=await fetch((prefix==='/cliproxy'?'http://127.0.0.1:8317':'http://127.0.0.1:3011')+u.pathname.slice(prefix.length),{method:req.method,body,headers:{'content-type':'application/json',Authorization:'Bearer local'},signal:req.signal})
 observed.status=upstream.status;observed.headersMs=performance.now()-start
 return new Response(upstream.body,{status:upstream.status,headers:{'content-type':upstream.headers.get('content-type')||'text/event-stream'}})
}})
for(const c of cells)models.push({id:c.key,name:c.model+' '+c.effort,providerID:c.provider})
const owned=new Set<string>()
const call:typeof request=async(path,body,signal,method)=>{
 if(path==='/api/session'&&body)body={...body as object,location:{directory}}
 const res=await request(path,body,signal,method)
 if(path==='/api/session'&&body)owned.add((await res.clone().json() as {data:{id:string}}).data.id)
 return res
}
const remove=async(id:string)=>{await call('/api/session/'+id,undefined,AbortSignal.timeout(3000),'DELETE');owned.delete(id)}
const pool=new EmptySessionPool(async id=>{
 const cell=cells.find(c=>c.key===id)!
 const res=await call('/api/session',{title:'Windows search reasoning benchmark',agent:'search-bar',model:{id,providerID:cell.provider}},AbortSignal.timeout(5000))
 return (await res.json() as {data:{id:string}}).data.id
},remove)
const complete=createCompleter(call,25000,pool)
// Public synthetic evidence only. Never enumerate or send local files in this screen.
const screen=[{kind:'exact',query:'Where is 7 Days to Die'}]
const followup=[...screen,{kind:'semantic-evidence',query:'Find the zombie survival game I have installed'},{kind:'current-unverified',query:'Who is the current president of France?'},{kind:'projects',query:'Where are my projects'}]
const rows:unknown[]=[];const errors:string[]=[]
try{
 for(let round=0;round<(phase==='screen'?1:2);round++)for(const q of phase==='screen'?screen:phase==='projects'?followup.filter(q=>q.kind==='projects'):followup)for(const c of selected){
 const hits=fixtureEvidence(q.kind,q.query);const prompt=answerPrompt(q.query,hits,[])
 await pool.warm(c.key);wire=[];const start=performance.now();let firstMs:number|undefined
 let row
 try{
 const r=await complete(c.key,prompt,()=>{firstMs??=performance.now()-start},AbortSignal.timeout(30000))
 row={...c,phase,round,kind:q.kind,firstMs,totalMs:performance.now()-start,usage:r.usage,timings:r.timings,wire:[...wire],text:r.text}
 await remove(r.session).catch(e=>errors.push(String(e)))
 }catch(e){row={...c,phase,round,kind:q.kind,error:String(e),totalMs:performance.now()-start,wire:[...wire]}}
 rows.push(row);console.log(JSON.stringify(row));await Bun.write('.cache/matrix-'+phase+'.json',JSON.stringify(rows,null,2))
 }
}finally{
 await pool.dispose();for(const id of [...owned])await remove(id).catch(e=>errors.push(String(e)))
 relay.stop(true);await Bun.write('.cache/matrix-'+phase+'-cleanup.json',JSON.stringify({remaining:owned.size,errors}));console.log(JSON.stringify({attempts:rows.length,remaining:owned.size,errors}))
}
