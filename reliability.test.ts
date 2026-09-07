import {test,expect} from 'bun:test'
import {createCompleter} from './opencode'
import {relevant} from './evidence'
test('unrelated current-banking snippets are not evidence about France',()=>{
 expect(relevant('Who is the current president of France?',{title:'Current banking',url:'https://current.com',content:'Current account bank'})).toBe(false)
 expect(relevant('Who is the current president of France?',{title:'President of France',url:'https://example.test',content:'France president'})).toBe(true)
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
