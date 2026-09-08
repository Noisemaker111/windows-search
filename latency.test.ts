import {test,expect} from 'bun:test'
import {EmptySessionPool} from './session-pool'
import {answerPrompt} from './answer-prompt'
import {type Hit} from './pc'

test('preparation is bounded and every checkout consumes a distinct fresh session',async()=>{
 let calls=0;const pool=new EmptySessionPool(async model=>model+'-'+(++calls),async()=>{})
 await Promise.all([pool.warm('haiku'),pool.warm('haiku'),pool.warm('haiku')]);expect(calls).toBe(1);expect(pool.size).toBe(1)
 const [a,b]=await Promise.all([pool.take('haiku'),pool.take('haiku')]);expect(a.id).not.toBe(b.id);expect(calls).toBe(2);expect(pool.size).toBe(0)
})
test('models never borrow each other sessions and idle sessions are removed on shutdown',async()=>{
 const removed:string[]=[];const pool=new EmptySessionPool(async m=>m,async id=>{removed.push(id)})
 await pool.warm('haiku');await pool.warm('sol');expect((await pool.take('sol')).id).toBe('sol');await pool.dispose();expect(removed).toEqual(['haiku']);expect(pool.size).toBe(0);await expect(pool.take('haiku')).rejects.toThrow()
})
test('failed preparation does not poison subsequent submissions or retry in the background',async()=>{
 let count=0;const pool=new EmptySessionPool(async()=>{if(++count===1)throw Error('offline');return 'recovered'},async()=>{})
 await pool.warm('haiku');expect(count).toBe(1);expect(pool.size).toBe(0);expect((await pool.take('haiku')).id).toBe('recovered');expect(count).toBe(2)
})
test('expired unused sessions are removed; no history-bearing session is recycled',async()=>{
 const removed:string[]=[];let n=0;const pool=new EmptySessionPool(async()=>String(++n),async id=>{removed.push(id)},-1)
 await pool.warm('haiku');expect((await pool.take('haiku')).id).toBe('2');expect(removed).toEqual(['1'])
})
test('shutdown owns an in-flight preparation and does not leak its eventual session',async()=>{
 let finish!:(s:string)=>void;const removed:string[]=[];const pool=new EmptySessionPool(()=>new Promise(resolve=>finish=resolve),async id=>{removed.push(id)})
 const pending=pool.warm('haiku');const done=pool.dispose();finish('late');await pending;await done;expect(removed).toEqual(['late'])
})
test('compact evidence preserves exact paths and removes index/launch/icon metadata',()=>{
 const h:Hit={id:'private-index-id',name:'Example',path:'C:\\Games\\Example',launch:'steam://rungameid/123',kind:'game',iconPath:'C:\\icons\\large.ico'}
 const value=JSON.parse(answerPrompt('where is Example',[h],[]));expect(value.pc).toEqual([{name:'Example',path:h.path}]);expect(JSON.stringify(value)).not.toContain(h.id);expect(JSON.stringify(value)).not.toContain(h.launch);expect(JSON.stringify(value)).not.toContain('iconPath')
 const app=JSON.parse(answerPrompt('Calculator',[{...h,path:'shell:AppsFolder\\internal'}],[]));expect(app.pc[0]).toEqual({name:'Example',installedApp:true})
})

import {createCompleter,OpenCodeHttpError,models} from './opencode'
for(const failure of [404,503,'transport'] as const)test('prepared session recovery only replays definitive missing session: '+failure,async()=>{
 const paths:string[]=[];let stream!:ReadableStreamDefaultController<Uint8Array>
 const pool=new EmptySessionPool(async()=> 'prepared',async()=>{})
 await pool.warm(models[0].id)
 const call=async(path:string)=>{
  paths.push(path)
  if(path==='/api/event')return new Response(new ReadableStream<Uint8Array>({start(c){stream=c}}))
  if(path==='/api/session/prepared/prompt')throw failure==='transport'?Error('connection lost'):new OpenCodeHttpError(failure,'failed')
  if(path==='/api/session')return Response.json({data:{id:'fresh'}})
  if(path==='/api/session/fresh/prompt')for(const e of [{type:'session.text.delta',data:{sessionID:'fresh',delta:'answer'}},{type:'session.step.ended',data:{sessionID:'fresh',tokens:{input:10,output:2,reasoning:0,cache:{read:0,write:0}}}},{type:'session.execution.succeeded',data:{sessionID:'fresh'}}])stream.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n'))
  return Response.json({})
 }
 const result=createCompleter(call,100,pool)(models[0].id,'query',()=>{},new AbortController().signal)
 if(failure===404){const value=await result;expect(value.text).toBe('answer');expect(value.usage?.output).toBe(2);expect(paths.filter(p=>p.endsWith('/prompt')).length).toBe(2)}
 else{await expect(result).rejects.toThrow();expect(paths.filter(p=>p.endsWith('/prompt')).length).toBe(1);expect(paths).not.toContain('/api/session')}
 await pool.dispose()
})
test('cancelled prepared checkout never admits inference',async()=>{
 const pool=new EmptySessionPool(async()=> 'unused',async()=>{});await pool.warm(models[0].id)
 const paths:string[]=[];const abort=new AbortController();abort.abort()
 await expect(createCompleter(async p=>{paths.push(p);return Response.json({})},100,pool)(models[0].id,'query',()=>{},abort.signal)).rejects.toThrow()
 expect(paths).toEqual(['/api/session/unused/interrupt']);await pool.dispose()
})

test('reopening refreshes expired preparation and shutdown awaits both removals',async()=>{
 let n=0;const finish:Array<()=>void>=[];const removed:string[]=[]
 const pool=new EmptySessionPool(async()=>String(++n),id=>new Promise<void>(resolve=>{removed.push(id);finish.push(resolve)}),0)
 await pool.warm('luna');await pool.warm('luna');expect(n).toBe(2);expect(removed).toEqual(['1'])
 let disposed=false;const done=pool.dispose().then(()=>{disposed=true});await Promise.resolve();expect(disposed).toBe(false)
 expect(removed.sort()).toEqual(['1','2']);finish.forEach(resolve=>resolve());await done;expect(disposed).toBe(true)
})
