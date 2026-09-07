import { join } from "node:path"
export const models = [
  {id:"claude-haiku-4-5-20251001",name:"Haiku · fast",providerID:"cliproxyapi"},
  {id:"gpt-5.6-luna",name:"Luna",providerID:"cliproxyapi"},
  {id:"gpt-5.6-sol",name:"Sol",providerID:"cliproxyapi"},
  {id:"grok-4.6",name:"Grok · SuperGrok",providerID:"grok-sub"}
]
const base = process.env.SEARCH_OPENCODE_URL || "http://127.0.0.1:8322"
export async function request(path: string, body?: unknown, signal?: AbortSignal) {
  // The dedicated host generates its own local credential. Keep it server-side.
  const log = await Bun.file(join(import.meta.dir,"opencode.out.log")).text()
  const password = log.match(/server password (\S+)/)?.[1]
  if (!password) throw new Error("OpenCode is starting; try again shortly.")
  const res = await fetch(base+path,{method:body===undefined?"GET":"POST",signal,
    headers:{Authorization:"Basic "+Buffer.from("opencode:"+password).toString("base64"),"content-type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body)})
  if (!res.ok) throw new Error("OpenCode "+res.status+": "+(await res.text()).slice(0,300))
  return res
}
export async function complete(modelID: string, text: string, onDelta: (text:string)=>void, signal:AbortSignal) {
  const model = models.find(m => m.id===modelID)
  if (!model) throw new Error("Unsupported model. Only the configured subscription routes are allowed.")
  const created = await request("/api/session",{title:"Windows search",agent:"search-bar",
    model:{id:model.id,providerID:model.providerID},location:{directory:join(import.meta.dir,"runtime-config")}},signal)
  const result = await created.json() as {data:{id:string}}
  const session = result.data.id
  const events = new AbortController()
  const combined = AbortSignal.any([events.signal,signal,AbortSignal.timeout(45000)])
  let full = ""
  try {
    const response = await request("/api/event",undefined,combined)
    const reader = response.body!.getReader()
    const dec = new TextDecoder()
    // Subscribe before admitting the prompt, so the first token cannot race the listener.
    await request("/api/session/"+session+"/prompt",{text},signal)
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
        if (event.type==="session.text.delta") { full += event.data.delta; onDelta(event.data.delta) }
        if (event.type==="session.execution.failed") throw new Error(JSON.stringify(event.data.error))
        if (event.type==="session.execution.succeeded") {
          if (!full.trim()) throw new Error("OpenCode returned an empty answer")
          return {session,model:modelID,text:full}
        }
      }
    }
  } finally {
    events.abort()
    if (signal.aborted) await request("/api/session/"+session+"/interrupt",{}).catch(()=>{})
  }
}
