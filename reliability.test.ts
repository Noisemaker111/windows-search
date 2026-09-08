import {test,expect} from 'bun:test'
import {createCompleter,ensurePcSearch} from './opencode'
import {relevant,wantsWeb} from './evidence'
test('index misses and vague personal-file names are not sent to web search',()=>{
 for(const q of ['quarterly budget.pdf','slides for the solar panel project','my latest tax documents','where is my current budget','heliotrop migration plan'])expect(wantsWeb(q)).toBe(false)
 for(const q of ['Who is the current president of France?','weather in Paris','search the web for solar panel grants'])expect(wantsWeb(q)).toBe(true)
})
test('unrelated current-banking snippets are not evidence about France',()=>{
 expect(relevant('Who is the current president of France?',{title:'Current banking',url:'https://current.com',content:'Current account bank'})).toBe(false)
 expect(relevant('Who is the current president of France?',{title:'President of France',url:'https://example.test',content:'France president'})).toBe(true)
})

test('PC search readiness waits for catalog creation and refuses outages without inference',async()=>{
 let calls=0
 await ensurePcSearch(async()=>Response.json({data:++calls===1?[]:[{name:'pc',status:{status:'connected'}}]}),AbortSignal.timeout(1000))
 expect(calls).toBe(2)
 const paths:string[]=[]
 await expect(createCompleter(async path=>{paths.push(path);return Response.json({data:[{name:'pc',status:{status:'failed'}}]})})('claude-haiku-4-5-20251001','find file',()=>{},AbortSignal.timeout(1000),()=>{})).rejects.toThrow('unavailable')
 expect(paths.some(p=>p.endsWith('/prompt')||p==='/api/session')).toBe(false)
 const abort=new AbortController();abort.abort()
 await expect(ensurePcSearch(async()=>{throw Error('must not run')},abort.signal)).rejects.toThrow()
})

test('discovery uses actual matching tool events, ignores other sessions and malformed results',async()=>{
 let stream!:ReadableStreamDefaultController<Uint8Array>;const results:unknown[]=[];let searching=0
 const call=async(path:string)=>{
  if(path.startsWith('/api/mcp?'))return Response.json({data:[{name:'pc',status:{status:'connected'}}]})
  if(path==='/api/session')return Response.json({data:{id:'owned'}})
  if(path==='/api/event')return new Response(new ReadableStream<Uint8Array>({start(c){stream=c}}))
  if(path.endsWith('/prompt'))for(const [type,data] of [
   ['session.tool.input.started',{id:'wrong',name:'pc_search_files',sessionID:'other'}],
   ['session.tool.input.started',{id:'unrelated',name:'other_tool'}],
   ['session.tool.success',{id:'unrelated',content:[{type:'text',text:'{"hits":["wrong"]}'}]}],
   ['session.tool.input.started',{id:'real',name:'pc_search_files'}],
   ['session.tool.success',{id:'real',content:[{type:'text',text:'invalid'},{type:'text',text:'{"hits":[],"coverage":{"limited":true}}'}]}],
   ['session.text.delta',{delta:'No match in searched folders.'}],['session.execution.succeeded',{}]
  ] as Array<[string,Record<string,unknown>]>)stream.enqueue(new TextEncoder().encode('data: '+JSON.stringify({type,data:{sessionID:'owned',...data}})+'\n\n'))
  return Response.json({})
 }
 await createCompleter(call)('claude-haiku-4-5-20251001','find file',()=>{},AbortSignal.timeout(1000),v=>{results.push(v)},()=>{searching++})
 expect(searching).toBe(1);expect(results).toEqual([{hits:[],coverage:{limited:true}}])
})
for(const mode of ['success','failure','disconnect','timeout','cancel'] as const)test('OpenCode '+mode+' cleans up only its own incomplete execution',async()=>{
 const paths:string[]=[];const outer=new AbortController();let stream:ReadableStreamDefaultController<Uint8Array>
 const call=async(path:string,body?:unknown,signal?:AbortSignal)=>{
 paths.push(path)
 if(path==='/api/session')return Response.json({data:{id:'owned'}})
 if(path==='/api/event')return new Response(new ReadableStream<Uint8Array>({start(c){stream=c;signal?.addEventListener('abort',()=>{try{c.error(signal.reason)}catch{}})}}))
 if(path.endsWith('/prompt')){
 if(mode==='timeout')return Response.json({})
 if(mode==='cancel'){outer.abort();return Response.json({})}
 if(mode==='disconnect')stream!.close()
 else {const events=mode==='failure'?[{type:'session.execution.failed',data:{sessionID:'owned',error:'offline'}}]:[{type:'session.text.delta',data:{sessionID:'other',delta:'wrong'}},{type:'session.text.delta',data:{sessionID:'owned',delta:'answer'}},{type:'session.execution.succeeded',data:{sessionID:'owned'}}];for(const e of events)stream!.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n'))}
 }
 return Response.json({})
 }
 let text='';const result=createCompleter(call,30)('claude-haiku-4-5-20251001','query',d=>text+=d,outer.signal)
 if(mode==='success'){expect((await result).text).toBe('answer');expect(text).toBe('answer');expect(paths).not.toContain('/api/session/owned/interrupt')}
 else{await expect(result).rejects.toThrow();expect(paths.filter(p=>p.endsWith('/interrupt'))).toEqual(['/api/session/owned/interrupt'])}
})
