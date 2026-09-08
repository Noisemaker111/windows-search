import {mkdir,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {discoverFiles,type DiscoveryInput} from './discovery'
import {DiscoverySessions} from './discovery-sessions'
import {launchIntent} from './pc'
export async function runDeepBenchmark(scan=discoverFiles,continuations=true){
 const root=join(import.meta.dir,'.cache','deep-benchmark-fixtures'),roots=[{id:'fixture',path:root}]
 const cases:Array<{group:string;input:DiscoveryInput;expected:string[];paged?:boolean}>=[]
 const put=async(path:string)=>{await mkdir(join(path,'..'),{recursive:true});await writeFile(path,'Synthetic benchmark fixture')}
 for(let i=0;i<30;i++){
  const deep=join(root,'archive-'+i,...Array.from({length:i%15},(_,n)=>'level-'+n),'orbit-'+i+'.md');await put(deep)
  cases.push({group:'exact-depth-0-to-14',input:{terms:['orbit-'+i+'.md'],maxDepth:20},expected:[deep]})
  const clue=join(root,'solarpanel'+i,'notes.txt');await put(clue)
  cases.push({group:'parent-transposition',input:{terms:['solrapanel'+i,'notes'],maxDepth:20},expected:[clue]})
 }
 for(let i=0;i<10;i++){
  const duplicates=[join(root,'old-'+i,'receipt-'+i+'.pdf'),join(root,'new-'+i,'receipt-'+i+'.pdf')];for(const p of duplicates)await put(p)
  cases.push({group:'duplicate-paths',input:{terms:['receipt-'+i+'.pdf'],maxDepth:20},expected:duplicates})
  cases.push({group:'wrong-extension',input:{terms:['orbit-'+i],extensions:['pdf'],maxDepth:20},expected:[]})
  cases.push({group:'missing',input:{terms:['unfindable-wombat-'+i],maxDepth:20},expected:[]})
  cases.push({group:'continue-past-budget',input:{terms:['orbit-'+(i+14)+'.md'],maxDepth:20},expected:[join(root,'archive-'+(i+14),...Array.from({length:(i+14)%15},(_,n)=>'level-'+n),'orbit-'+(i+14)+'.md')],paged:true})
 }
 const rows=[]
 for(const [id,c] of cases.entries()){
  const start=performance.now();let calls=0;const hits=new Map<string,Awaited<ReturnType<typeof scan>>['hits'][number]>()
  if(c.paged&&continuations){const sessions=new DiscoverySessions(roots,60000,{entries:10,milliseconds:2500});try{let page=await sessions.start(c.input);while(true){calls++;page.hits.forEach(h=>hits.set(h.path,h));if(c.expected.every(p=>hits.has(p))||!('nextCursor' in page)||calls>=100)break;page=await sessions.resume(page.nextCursor)}}finally{await sessions.dispose()}}
  else{for(let retry=0;retry<(c.paged?3:1);retry++){calls++;const page=await scan(c.input,roots,undefined,c.paged?{entries:10,milliseconds:2500}:undefined);page.hits.forEach(h=>hits.set(h.path,h));if(c.expected.length&&c.expected.every(p=>hits.has(p)))break}}
  const actual=[...hits.values()],correct=c.expected.length?c.expected.every(p=>hits.has(p)):actual.length===0
  const safe=c.group==='parent-transposition'?!launchIntent('open '+c.input.terms[0],actual):c.group==='duplicate-paths'?!launchIntent('open '+c.input.terms[0],actual):true
  rows.push({id,group:c.group,correct,safe,calls,elapsedMs:Math.round(performance.now()-start)})
 }
 return {scope:'100 synthetic local retrieval cases; no model or Windows UI score',cases:rows.length,passed:rows.filter(r=>r.correct&&r.safe).length,rows}
}
if(import.meta.main){const report=await runDeepBenchmark();await Bun.write(join(import.meta.dir,'.cache','deep-discovery-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))}
