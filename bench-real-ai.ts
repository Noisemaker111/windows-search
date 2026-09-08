import {readFile,stat} from 'node:fs/promises'
import {basename,dirname,extname} from 'node:path'
import {createCompleter,request} from './opencode'
import {answerPrompt} from './answer-prompt'

// Opt-in: sends filename/path metadata through configured subscription proxies.
// Private ground truth and raw responses stay ignored; public output is allowlisted.
if(process.env.SEARCH_BENCH_METADATA_CONSENT!=='1')throw Error('Set SEARCH_BENCH_METADATA_CONSENT=1 only with permission to send real filename/path metadata')
const samples=JSON.parse(await readFile('.cache/discovery-private-ground-truth.json','utf8')) as {root:string;path:string;name:string;depth:number}[]
const rows:any[]=[],raw:any[]=[]
const normalize=(s:string)=>s.replaceAll('\\\\','\\').replaceAll('/','\\').toLowerCase()
const chosen=[0,3,5,7,8,10,12,15,16,17,18,19].filter(i=>samples[i])
const selected=process.env.SEARCH_BENCH_SAMPLES?.split(',').map(Number)
const output=process.env.SEARCH_BENCH_OUTPUT||'real-ai-results.json'
if(!/^[a-z0-9-]+\.json$/.test(output))throw Error('Output must be an anonymous report basename')
const repeats=Number(process.env.SEARCH_BENCH_REPEATS||1)
if(!Number.isInteger(repeats)||repeats<1||repeats>3)throw Error('Repeats must be 1 to 3')
for(let repeat=0;repeat<repeats;repeat++)for(let round=0;round<chosen.length;round++){
 const index=chosen[round],s=samples[index];await stat(s.path)
 if(selected&&!selected.includes(index+1))continue
 const kind=['exact','partial','parent-clue'][round%3]
 const stem=basename(s.name,extname(s.name))
 const clue=kind==='exact'?s.name:kind==='partial'?stem.slice(0,Math.max(4,Math.ceil(stem.length*.7))):basename(dirname(s.path))
 const query=kind==='parent-clue'?`Find ${extname(s.name)||'a'} files related to ${clue} in ${s.root}. Show their paths.`:`Where is ${clue} in ${s.root}? Find the file and show its path.`
 const order=round%2?['gpt-5.6-luna','claude-haiku-4-5-20251001']:['claude-haiku-4-5-20251001','gpt-5.6-luna']
 for(const model of order){
  const started=performance.now(),results:any[]=[],toolNames:string[]=[];let firstAnswer=0,firstTarget=0,result:any,error:any
  try{result=await createCompleter(request,60000)(model,answerPrompt(query,[],[]),()=>{firstAnswer ||= performance.now()-started},AbortSignal.timeout(65000),v=>{results.push(v);if((v as any).hits?.some((h:any)=>normalize(h.path)===normalize(s.path)))firstTarget ||= performance.now()-started},name=>{toolNames.push(name);firstAnswer=0},()=>{firstAnswer=0})}catch(e){error=String(e)}
  const row={sample:index+1,root:s.root,depth:s.depth,kind,model,targetRetrieved:!!firstTarget,targetPathInAnswer:!!result&&normalize(result.text).includes(normalize(s.path)),firstTargetMs:Math.round(firstTarget)||null,firstAnswerMs:Math.round(firstAnswer)||null,totalMs:Math.round(performance.now()-started),scanMs:results.reduce((n,r)=>n+(r.coverage?.elapsedMs||0),0),toolNames,pages:results.length,limited:results.some(r=>r.coverage?.limited),truncated:results.some(r=>r.coverage?.truncated),timings:result?.timings,usage:result?.usage,repairs:result?.investigationRepairs,error:error?'execution-failed':null}
  rows.push(row);raw.push({sample:index+1,query,target:s.path,result,error,results})
  Object.assign(row,{repeat,answerChars:result?.text.length||0,answerPathsFromEvidence:results.flatMap(r=>r.hits||[]).filter((h:any)=>result&&normalize(result.text).includes(normalize(h.path))).length})
  await Bun.write('.cache/'+output.replace('.json','-private.json'),JSON.stringify(raw,null,2))
  await Bun.write(output,JSON.stringify({conditions:'Sequential real-file metadata queries; previously sampled targets, 3 clue types; Haiku and Luna low Normal, alternating order; fresh sessions, same isolated host, no prepared pool, production scan budget 50000/2500ms; no file contents; path presence is mechanical, not a semantic quality score. Parent clues may legitimately match several files. No Windows UI comparison or actual account charges.',rows},null,2)+'\n')
  console.log(JSON.stringify(row))
  if(result)await request('/api/session/'+result.session,undefined,AbortSignal.timeout(3000),'DELETE').catch(()=>{})
 }
}
