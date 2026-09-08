import { join } from "node:path"
import { EmptySessionPool } from "./session-pool"
export type SearchModel={id:string;name:string;providerID:string;modelID?:string;variant?:string}
export const models:SearchModel[] = [
  {id:"claude-haiku-4-5-20251001",name:"Haiku",providerID:"cliproxyapi"},
  {id:"gpt-5.6-luna",name:"Luna · low reasoning",providerID:"cliproxyapi"},
  {id:"gpt-5.6-sol",name:"Sol",providerID:"cliproxyapi"},
  {id:"grok-4.6",name:"Grok · SuperGrok",providerID:"grok-sub"},
  {id:"gpt-5.6-luna#fast",name:"Luna · low reasoning · Fast requested",providerID:"cliproxyapi",modelID:"gpt-5.6-luna",variant:"fast"}
]
const base = process.env.SEARCH_OPENCODE_URL || "http://127.0.0.1:8322"
export class OpenCodeHttpError extends Error { constructor(public status:number,message:string){super(message)} }
export async function request(path: string, body?: unknown, signal?: AbortSignal, method?:string) {
  // The dedicated host generates its own local credential. Keep it server-side.
  const log = await Bun.file(process.env.SEARCH_OPENCODE_LOG || join(import.meta.dir,"opencode.out.log")).text()
  const password = log.match(/server password (\S+)/)?.[1]
  if (!password) throw new Error("OpenCode is starting; try again shortly.")
  const res = await fetch(base+path,{method:method||(body===undefined?"GET":"POST"),signal,
    headers:{Authorization:"Basic "+Buffer.from("opencode:"+password).toString("base64"),"content-type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body)})
  if (!res.ok) throw new OpenCodeHttpError(res.status,"OpenCode "+res.status+": "+(await res.text()).slice(0,300))
  return res
}
async function createSession(call:typeof request,modelID:string,signal?:AbortSignal){
  const model=models.find(m=>m.id===modelID)
  if(!model)throw Error("Unsupported subscription model")
  const created=await call("/api/session",{title:"Windows search",agent:"search-bar",
    model:{id:model.modelID||model.id,providerID:model.providerID,...(model.variant?{variant:model.variant}:{})},location:{directory:join(import.meta.dir,"runtime-config")}},signal)
  return ((await created.json()) as {data:{id:string}}).data.id
}
async function removeSession(id:string){
  await request("/api/session/"+encodeURIComponent(id),undefined,AbortSignal.timeout(2000),"DELETE")
}
export const sessionPool=new EmptySessionPool(async model=>{const signal=AbortSignal.timeout(10000);await ensurePcSearch(request,signal);return createSession(request,model,signal)},removeSession)
export function prepareModel(model:string){return models.some(m=>m.id===model)?sessionPool.warm(model):Promise.resolve()}
export type Tokens={input:number;output:number;reasoning:number;cache:{read:number;write:number}}
export async function ensurePcSearch(call:typeof request,signal:AbortSignal){
  const bounded=AbortSignal.any([signal,AbortSignal.timeout(8000)])
  while(true){
    bounded.throwIfAborted()
    const res=await call('/api/mcp?location[directory]='+encodeURIComponent(join(import.meta.dir,'runtime-config')),undefined,bounded)
    const value=await res.json() as {data?:Array<{name:string,status:{status:string}}>}
    const status=value.data?.find(s=>s.name==='pc')?.status.status
    if(status==='connected')return
    if(status&&status!=='pending')throw Error('PC file search is unavailable. No filesystem search was performed; restart the search host and try again.')
    await new Promise<void>((resolve,reject)=>{
      const stop=()=>{clearTimeout(timer);reject(bounded.reason)}
      const timer=setTimeout(()=>{bounded.removeEventListener('abort',stop);resolve()},100)
      bounded.addEventListener('abort',stop,{once:true})
    })
  }
}
export function createCompleter(call: typeof request = request, timeoutMs = 45000, pool?:EmptySessionPool) {
return async function complete(modelID: string, text: string, onDelta: (text:string)=>void, signal:AbortSignal,onDiscovery?:(result:unknown)=>void|Promise<void>,onSearch?:(name:string)=>void,onRetry?:()=>void) {
  const started=performance.now()
  const timings={sessionMs:0,subscriptionMs:0,promptMs:0,postPromptFirstTokenMs:0}
  const model = models.find(m => m.id===modelID)
  if (!model) throw new Error("Unsupported model. Only the configured subscription routes are allowed.")
  if(onDiscovery)await ensurePcSearch(call,signal)
  const reserved=pool?await pool.take(modelID):{id:await createSession(call,modelID,signal),prepared:false}
  let session=reserved.id,preparedSession=reserved.prepared
  timings.sessionMs=performance.now()-started
  const events = new AbortController()
  const timer=setTimeout(()=>events.abort(new Error("OpenCode answer timed out")),timeoutMs)
  const combined = AbortSignal.any([events.signal,signal])
  const discoveryTools=new Set<string>()
  let pendingCursor:string|undefined,discoveredHits=false,investigationRepairs=0
  let full = "", succeeded=false
  let usage:Tokens|undefined
  try {
    signal.throwIfAborted()
    const subscribed=performance.now()
    const response = await call("/api/event",undefined,combined)
    timings.subscriptionMs=performance.now()-subscribed
    const reader = response.body!.getReader()
    const dec = new TextDecoder()
    // Subscribe before admitting the prompt, so the first token cannot race the listener.
    const promptStart=performance.now()
    try { await call("/api/session/"+session+"/prompt",{text},combined) }
    catch(error){
      // A definitive 404 means nothing was admitted. Never replay ambiguous errors.
      if(!preparedSession||!(error instanceof OpenCodeHttpError)||error.status!==404)throw error
      session=await createSession(call,modelID,combined);preparedSession=false
      await call("/api/session/"+session+"/prompt",{text},combined)
    }
    timings.promptMs=performance.now()-promptStart
    const admitted=performance.now()
    let buffer = ""
    while (true) {
      const {done,value} = await reader.read()
      if (done) throw new Error("OpenCode stream ended before completion")
      buffer += dec.decode(value,{stream:true})
      const lines = buffer.split("\n"); buffer = lines.pop()!
      for (const line of lines) {
        if (!line.startsWith("data:")) continue
        const event = JSON.parse(line.slice(5))
        if (event.data?.sessionID !== session) continue
        if(event.type==="session.tool.input.started"&&/(?:^|[_.])(?:search_files|continue_file_search)$/.test(event.data.name)){discoveryTools.add(event.data.id);full='';timings.postPromptFirstTokenMs=0;onSearch?.(event.data.name)}
        if(event.type==="session.tool.success"&&discoveryTools.has(event.data.id)){
          for(const part of event.data.content||[])if(part.type==='text'){let result;try{result=JSON.parse(part.text)}catch{continue}
            if(Array.isArray(result?.hits)&&result.coverage){discoveredHits ||= result.hits.length>0;pendingCursor=typeof result.nextCursor==='string'?result.nextCursor:undefined}
            await onDiscovery?.(result)}
        }
        if(event.type==="session.step.ended"&&event.data.tokens){
          const t=event.data.tokens as Tokens
          usage={input:(usage?.input||0)+t.input,output:(usage?.output||0)+t.output,reasoning:(usage?.reasoning||0)+t.reasoning,cache:{read:(usage?.cache.read||0)+t.cache.read,write:(usage?.cache.write||0)+t.cache.write}}
        }
        if (event.type==="session.text.delta") { if(!full)timings.postPromptFirstTokenMs=performance.now()-admitted; full += event.data.delta; if(!pendingCursor||discoveredHits)onDelta(event.data.delta) }
        if (event.type==="session.execution.failed") throw new Error(JSON.stringify(event.data.error))
        if (event.type==="session.execution.succeeded") {
          if(pendingCursor&&!discoveredHits){
            onRetry?.();full=''
            if(investigationRepairs++)throw Error('File search is incomplete. No match in the checked portion; remaining folders were not checked.')
            await call('/api/session/'+session+'/prompt',{text:JSON.stringify({instruction:'The last scan is incomplete, so absence has not been established. Call continue_file_search with this cursor before answering. If still incomplete, explicitly state that limit; never claim the whole location was searched.',cursor:pendingCursor})},combined)
            continue
          }
          if (!full.trim()) throw new Error("OpenCode returned an empty answer")
          succeeded=true
          return {session,model:modelID,text:full,timings,preparedSession,usage,investigationRepairs}
        }
      }
    }
  } finally {
    if(succeeded&&pool)void pool.warm(modelID)
    clearTimeout(timer)
    events.abort()
    if (!succeeded) {
      const cleanup=new AbortController()
      const cleanupTimer=setTimeout(()=>cleanup.abort(),2000)
      try { await call("/api/session/"+session+"/interrupt",{},cleanup.signal).catch(()=>{}) }
      finally { clearTimeout(cleanupTimer) }
    }
  }
}

}
export const complete=createCompleter(request,45000,sessionPool)
