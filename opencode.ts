import { join } from "node:path"
export const models = [
  {id:"claude-haiku-4-5-20251001",name:"Haiku",providerID:"cliproxyapi"},
  {id:"gpt-5.6-luna",name:"Luna",providerID:"cliproxyapi"},
  {id:"gpt-5.6-sol",name:"Sol",providerID:"cliproxyapi"},
  {id:"grok-4.6",name:"Grok · SuperGrok",providerID:"grok-sub"}
]
const base = process.env.SEARCH_OPENCODE_URL || "http://127.0.0.1:8322"
export async function request(path: string, body?: unknown, signal?: AbortSignal) {
  // The dedicated host generates its own local credential. Keep it server-side.
  const log = await Bun.file(process.env.SEARCH_OPENCODE_LOG || join(import.meta.dir,"opencode.out.log")).text()
  const password = log.match(/server password (\S+)/)?.[1]
  if (!password) throw new Error("OpenCode is starting; try again shortly.")
  const res = await fetch(base+path,{method:body===undefined?"GET":"POST",signal,
    headers:{Authorization:"Basic "+Buffer.from("opencode:"+password).toString("base64"),"content-type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body)})
  if (!res.ok) throw new Error("OpenCode "+res.status+": "+(await res.text()).slice(0,300))
  return res
}
export function createCompleter(call: typeof request = request, timeoutMs = 45000) {
return async function complete(modelID: string, text: string, onDelta: (text:string)=>void, signal:AbortSignal) {
  const started=performance.now()
  const timings={sessionMs:0,subscriptionMs:0,promptMs:0,postPromptFirstTokenMs:0}
  const model = models.find(m => m.id===modelID)
  if (!model) throw new Error("Unsupported model. Only the configured subscription routes are allowed.")
  const created = await call("/api/session",{title:"Windows search",agent:"search-bar",
    model:{id:model.id,providerID:model.providerID},location:{directory:join(import.meta.dir,"runtime-config")}},signal)
  const result = await created.json() as {data:{id:string}}
  const session = result.data.id
  timings.sessionMs=performance.now()-started
  const events = new AbortController()
  const timer=setTimeout(()=>events.abort(new Error("OpenCode answer timed out")),timeoutMs)
  const combined = AbortSignal.any([events.signal,signal])
  let full = "", succeeded=false
  try {
    const subscribed=performance.now()
    const response = await call("/api/event",undefined,combined)
    timings.subscriptionMs=performance.now()-subscribed
    const reader = response.body!.getReader()
    const dec = new TextDecoder()
    // Subscribe before admitting the prompt, so the first token cannot race the listener.
    const promptStart=performance.now()
    await call("/api/session/"+session+"/prompt",{text},combined)
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
        if (event.type==="session.text.delta") { if(!full)timings.postPromptFirstTokenMs=performance.now()-admitted; full += event.data.delta; onDelta(event.data.delta) }
        if (event.type==="session.execution.failed") throw new Error(JSON.stringify(event.data.error))
        if (event.type==="session.execution.succeeded") {
          if (!full.trim()) throw new Error("OpenCode returned an empty answer")
          succeeded=true
          return {session,model:modelID,text:full,timings}
        }
      }
    }
  } finally {
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
export const complete=createCompleter()
