import { buildIndex, search, launchIntent, launch } from "./pc"
import { complete, models, request } from "./opencode"
import { join } from "node:path"
import { mkdir } from "node:fs/promises"
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
const launches: unknown[] = []
const xml = (s:string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
async function web(query:string) {
  try {
    const r = await fetch("https://www.bing.com/search?format=rss&q="+encodeURIComponent(query),{signal:AbortSignal.timeout(3000)})
    if (!r.ok) return []
    return [...(await r.text()).matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,4).map(m=>{
      const field=(n:string)=>xml(m[1].match(new RegExp("<"+n+">([\\s\\S]*?)</"+n+">"))?.[1]||"")
      return {title:field("title"),url:field("link"),content:field("description")}
    }).filter(x=>x.url.startsWith("https://"))
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
    if (url.pathname==="/search") { stats.searches++; return Response.json({hits:search(index,url.searchParams.get("q")||"")}) }
    if (url.pathname==="/run" && req.method==="POST") {
      const body = await req.json() as {id?: string; launch?: string; query?: unknown; model?: unknown}
      if (!body) return Response.json({error:"Choose a current result"},{status:400})
      const hit = index.find(h=>h.id===body.id && h.launch===body.launch)
      if (!hit) return Response.json({error:"Choose a current indexed result"},{status:400})
      try { const result = await launch(hit); launches.push(result); return Response.json(result) }
      catch(e) { return Response.json({error:String(e)},{status:400}) }
    }
    if (url.pathname==="/ask" && req.method==="POST") {
      const body = await req.json() as {query: string; model: string; clientId?:string; selection?:string}
      if (!body || typeof body.model!=="string" || typeof body.query!=="string" || !body.query.trim() || body.query.length>4000 || !models.some(m=>m.id===body.model))
        return Response.json({error:"A query and supported model are required"},{status:400})
      stats.submissions++
      const hits=search(index,body.query)
      const selected=hits.find(h=>h.id===body.selection)
      const started=performance.now()
      const abort=new AbortController()
      const clientId=typeof body.clientId==="string"?body.clientId.slice(0,80):crypto.randomUUID()
      clients.get(clientId)?.abort();clients.set(clientId,abort)
      const signal=AbortSignal.any([abort.signal,req.signal,AbortSignal.timeout(50000)])
      const stream = new ReadableStream({
        async start(controller) {
          const send=(event:unknown)=> { if(!signal.aborted) controller.enqueue(new TextEncoder().encode("data: "+JSON.stringify(event)+"\n\n")) }
          try {
            send({type:"hits",hits})
            let launched:unknown, launchError:string|undefined
            if (selected || launchIntent(body.query,hits)) {
              try { launched=await launch(selected||hits[0]); launches.push(launched); send({type:"launch",result:launched}) }
              catch(e) { launchError=String(e); send({type:"launchError",message:launchError}) }
            }
            const sources=!hits.length && !/^(where|find|locate|open|play|run|launch)\b/i.test(body.query.trim()) ? await web(body.query) : []
            const source=hits.length?"This PC":sources.length?"Web":"General knowledge · no local hit"
            send({type:"context",source,sources})
            let first:number|undefined
            signal.throwIfAborted()
            stats.modelCalls++
            const result = await complete(body.model,JSON.stringify({
              query:body.query,pcHits:hits,launchOutcome:launched,launchError,webSources:sources,
              instruction:"Answer the query in 1-3 short sentences with actual paths where relevant. For packaged Windows apps, use the app name and launch outcome; do not print internal shell:AppsFolder identifiers. "+
                (hits.length?"Use the supplied disk evidence.":sources.length?"Say this is a web answer and cite supplied source URLs.":"Say this is a general answer with no local hit; do not pretend you searched the live web.")
            }),delta=>{first??=performance.now()-started;send({type:"delta",text:delta})},signal)
            send({type:"done",model:result.model,firstTokenMs:Math.round(first||0),totalMs:Math.round(performance.now()-started)})
          } catch(e) { send({type:"error",message:String(e)}) }
          finally { if(signal.aborted)stats.cancelled++;if(clients.get(clientId)===abort)clients.delete(clientId);try {controller.close()} catch {} }
        },
        cancel() {abort.abort()}
      })
      return new Response(stream,{headers:{"content-type":"text/event-stream","cache-control":"no-cache"}})
    }
    return new Response("Not found",{status:404})
  }
})
console.log("OpenCode search bar: http://127.0.0.1:"+server.port+"; "+index.length+" real items")
