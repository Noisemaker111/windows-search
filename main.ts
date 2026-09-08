import { buildIndex, search, launchIntent, launch } from "./pc"
import { complete, models, request, prepareModel, sessionPool } from "./opencode"
import { answerPrompt } from "./answer-prompt"
import { relevant,wantsWeb } from "./evidence"
import { join } from "node:path"
import { mkdir,stat } from "node:fs/promises"
const port = Number(process.env.SEARCH_SHIM_PORT || 8321)
let index = await buildIndex()
let indexedAt = Date.now()
const stats={searches:0,submissions:0,modelCalls:0,cancelled:0}
const clients=new Map<string,AbortController>()
async function cacheIcons(){
  await mkdir(join(import.meta.dir,".cache"),{recursive:true})
  const manifest=join(import.meta.dir,".cache","icons.json")
  await Bun.write(manifest,JSON.stringify(index))
  const p=Bun.spawn(["powershell.exe","-NoProfile","-NonInteractive","-File",join(import.meta.dir,"icons.ps1"),"-Manifest",manifest],{stdout:"ignore",stderr:"pipe",windowsHide:true})
  if(await p.exited!==0)console.error("Icon cache:",await new Response(p.stderr).text())
}
void cacheIcons()
setInterval(async()=> { try { index = await buildIndex(); indexedAt=Date.now();void cacheIcons() } catch(e) { console.error("Index refresh:",String(e)) } },60000)
void prepareModel(models[0].id)
const discovered=new Map<string,{hit:import('./pc').Hit,expires:number}>()
async function catalog(){
  // A discovered path is a short-lived suggestion, not a permanent index fact.
  await Promise.all([...discovered].map(async([id,item])=>{
    const valid=item.expires>=Date.now()&&await stat(item.hit.path).then(s=>item.hit.kind==='folder'?s.isDirectory():s.isFile(),()=>false)
    if(!valid&&discovered.get(id)===item)discovered.delete(id)
  }))
  return [...index,...[...discovered.values()].map(x=>x.hit)]
}
const launches: unknown[] = []
const xml = (s:string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
async function web(query:string, signal:AbortSignal) {
  try {
    const r = await fetch("https://www.bing.com/search?format=rss&q="+encodeURIComponent(query),{signal:AbortSignal.any([signal,AbortSignal.timeout(3000)])})
    if (!r.ok) return []
    return [...(await r.text()).matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,4).map(m=>{
      const field=(n:string)=>xml(m[1].match(new RegExp("<"+n+">([\\s\\S]*?)</"+n+">"))?.[1]||"")
      return {title:field("title"),url:field("link"),content:field("description")}
    }).filter(x=>x.url.startsWith("https://")&&relevant(query,x))
  } catch { return [] }
}
const server = Bun.serve({
  hostname:"127.0.0.1",port,idleTimeout:60,
  async fetch(req) {
    const url = new URL(req.url)
    // A website must not be able to post a launch into the loopback service.
    const origin = req.headers.get("origin")
    if (origin && origin !== url.origin) return new Response("Foreign origin",{status:403})
    if (req.method==="POST" && !req.headers.get("content-type")?.startsWith("application/json"))
      return new Response("JSON required",{status:415})
    if (url.pathname==="/") return new Response(Bun.file(join(import.meta.dir,"index.html")),{headers:{"cache-control":"no-store","content-type":"text/html;charset=utf-8"}})
    if (["/style.css","/app.js"].includes(url.pathname)) return new Response(Bun.file(join(import.meta.dir,url.pathname.slice(1))),{headers:{"cache-control":"no-store"}})
    if (/^\/icons\/[a-f0-9]{20}\.png$/.test(url.pathname)) { const file=Bun.file(join(import.meta.dir,".cache",url.pathname.slice(1))); return await file.exists()?new Response(file,{headers:{"cache-control":"public,max-age=86400"}}):new Response(null,{status:404}) }
    if (url.pathname==="/metrics") return Response.json({...stats,active:clients.size})
    if (url.pathname==="/health") return Response.json({ok:true,brain:"OpenCode v2",defaultModel:models[0].id,indexed:index.length,indexedAt,
      opencode:await request("/api/session/active").then(()=>true,()=>false),launches:launches.slice(-5)})
    if (url.pathname==="/models") return Response.json(models)
    if (url.pathname==="/search") { stats.searches++; return Response.json({hits:search(await catalog(),url.searchParams.get("q")||"")}) }
    if (url.pathname==="/run" && req.method==="POST") {
      const body = await req.json() as {id?: string; launch?: string; query?: unknown; model?: unknown}
      if (!body) return Response.json({error:"Choose a current result"},{status:400})
      const hit = index.find(h=>h.id===body.id && h.launch===body.launch)
      if (!hit) return Response.json({error:"Choose a current indexed result"},{status:400})
      try { const result = await launch(hit); launches.push(result); return Response.json(result) }
      catch(e) { return Response.json({error:String(e)},{status:400}) }
    }
    if (url.pathname==="/prepare" && req.method==="POST") {
      const body=await req.json() as {model?:unknown}
      if(!body||typeof body.model!=="string"||!models.some(m=>m.id===body.model))return Response.json({error:"Supported model required"},{status:400})
      await prepareModel(body.model)
      return Response.json({ok:true})
    }
    if (url.pathname==="/ask" && req.method==="POST") {
      const body = await req.json() as {query: string; model: string; clientId?:string; selection?:string}
      if (!body || typeof body.model!=="string" || typeof body.query!=="string" || !body.query.trim() || body.query.length>4000 || !models.some(m=>m.id===body.model))
        return Response.json({error:"A query and supported model are required"},{status:400})
      stats.submissions++
      const started=performance.now()
      void prepareModel(body.model)
      const current=await catalog()
      const hits=search(current,body.query)
      const localSearchMs=performance.now()-started
      const selected=body.selection?current.find(h=>h.id===body.selection):undefined
      if(body.selection&&!selected)return Response.json({error:'This result is no longer available. Search again.'},{status:409})
      if(selected&&!hits.some(h=>h.id===selected.id))hits.unshift({...selected,match:"discovered",score:100})
      const abort=new AbortController()
      const clientId=typeof body.clientId==="string"?body.clientId.slice(0,80):crypto.randomUUID()
      clients.get(clientId)?.abort();clients.set(clientId,abort)
      const disconnected=AbortSignal.any([abort.signal,req.signal])
      const deadline=new AbortController()
      const deadlineTimer=setTimeout(()=>deadline.abort(new Error("Answer timed out")),50000)
      const signal=AbortSignal.any([disconnected,deadline.signal])
      const stream = new ReadableStream({
        async start(controller) {
          const send=(event:unknown)=> { if(!disconnected.aborted) controller.enqueue(new TextEncoder().encode("data: "+JSON.stringify(event)+"\n\n")) }
          try {
            send({type:"hits",hits})
            let launched:unknown, launchError:string|undefined
            if (selected || launchIntent(body.query,hits)) {
              try { launched=await launch(selected||hits[0]); launches.push(launched); send({type:"launch",result:launched}) }
              catch(e) { launchError=String(e); send({type:"launchError",message:launchError}) }
            }
            const retrievalStart=performance.now()
            const sources=!hits.length && wantsWeb(body.query) ? await web(body.query,signal) : []
            const retrievalMs=performance.now()-retrievalStart
            const source=hits.length?"This PC · indexed locations":sources.length?"Web snippets · check sources":"No verified answer sources"
            send({type:"context",source,sources})
            let first:number|undefined
            signal.throwIfAborted()
            stats.modelCalls++
            const prompt=answerPrompt(body.query,hits,sources,launched,launchError)
            const result = await complete(body.model,prompt,delta=>{first??=performance.now()-started;send({type:"delta",text:delta})},signal,async value=>{
              const result=value as {hits?:import('./pc').Hit[],coverage?:unknown}
              if(!Array.isArray(result?.hits)||!result.coverage)return
              const found=result.hits.filter(h=>h&&typeof h.id==='string'&&typeof h.name==='string'&&typeof h.path==='string'&&h.launch===h.path&&['file','folder'].includes(h.kind)).slice(0,20)
              for(const hit of found)discovered.set(hit.id,{hit,expires:Date.now()+300000})
              while(discovered.size>500)discovered.delete(discovered.keys().next().value!)
              for(const hit of found)if(!hits.some(h=>h.path===hit.path))hits.push({...hit,match:'discovered',score:50})
              send({type:'hits',hits});send({type:'coverage',coverage:result.coverage})
            },()=>{first=undefined;send({type:'searching'})})
            send({type:"done",model:result.model,firstTokenMs:Math.round(first||0),totalMs:Math.round(performance.now()-started),timings:{localSearchMs,retrievalMs,...result.timings},preparedSession:result.preparedSession,promptBytes:Buffer.byteLength(prompt),usage:result.usage})
          } catch(e) { send({type:"error",message:String(e)}) }
          finally { clearTimeout(deadlineTimer);if(signal.aborted)stats.cancelled++;if(clients.get(clientId)===abort)clients.delete(clientId);try {controller.close()} catch {} }
        },
        cancel() {abort.abort()}
      })
      return new Response(stream,{headers:{"content-type":"text/event-stream","cache-control":"no-cache"}})
    }
    return new Response("Not found",{status:404})
  }
})
console.log("OpenCode search bar: http://127.0.0.1:"+server.port+"; "+index.length+" real items")

async function shutdown(){
  for(const abort of clients.values())abort.abort()
  server.stop(true)
  await sessionPool.dispose()
  process.exit(0)
}
process.once("SIGINT",()=>void shutdown())
process.once("SIGTERM",()=>void shutdown())
