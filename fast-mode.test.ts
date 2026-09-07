import {test,expect} from 'bun:test'
import {models,createCompleter} from './opencode'
const config=await Bun.file(new URL('./runtime-config/opencode.json',import.meta.url)).json()
test('Luna Fast selects a separate OpenCode variant without changing reasoning or subscription endpoint',async()=>{
 let selected:unknown;let stream!:ReadableStreamDefaultController<Uint8Array>
 const call=async(path:string,body?:unknown)=>{
  if(path==='/api/session'){selected=(body as any).model;return Response.json({data:{id:'owned'}})}
  if(path==='/api/event')return new Response(new ReadableStream<Uint8Array>({start(c){stream=c}}))
  if(path.endsWith('/prompt'))for(const e of [{type:'session.text.delta',data:{sessionID:'owned',delta:'answer'}},{type:'session.execution.succeeded',data:{sessionID:'owned'}}])stream.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n'))
  return Response.json({})
 }
 const result=await createCompleter(call)('gpt-5.6-luna#fast','query',()=>{},new AbortController().signal)
 expect(selected).toEqual({id:'gpt-5.6-luna',providerID:'cliproxyapi',variant:'fast'})
 expect(result.model).toBe('gpt-5.6-luna#fast')
 const provider=config.providers.cliproxyapi;const luna=provider.models['gpt-5.6-luna']
 expect(provider.settings.baseURL).toBe('http://127.0.0.1:8317/v1')
 expect(luna.package).toBe('@opencode-ai/ai/providers/openai/responses')
 expect(luna.settings.providerOptions.reasoningEffort).toBe('low')
 expect(luna.body.service_tier).toBe('default')
 expect(luna.variants).toEqual([{id:'fast',body:{service_tier:'priority'}}])
 expect(models[0].id).toBe('claude-haiku-4-5-20251001')
})
test('unsupported fast model or metered route never creates a session',async()=>{
 let calls=0;const complete=createCompleter(async()=>{calls++;return Response.json({})})
 for(const id of ['xai/grok#fast','grok-4.6#fast','gpt-5.6-sol#fast'])await expect(complete(id,'q',()=>{},new AbortController().signal)).rejects.toThrow('Unsupported model')
 expect(calls).toBe(0)
})
