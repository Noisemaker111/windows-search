// Local metadata only: no inference, uploads or file-content reads.
import {readdir,mkdir} from 'node:fs/promises'
import {join,basename,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {buildIndex,search} from './pc'
import {defaultRoots,discoverFiles} from './discovery'
const seed=process.argv[2]||'discovery-audit-2'
const excluded=new Set(['node_modules','vendor','dist','build','coverage','target','appdata','bin','obj'])
const selected:Array<{root:string;path:string;name:string;depth:number;hash:string}>=[]
const sampling=[]
for(const root of defaultRoots()){
 let visited=0;const candidates:typeof selected=[];const queue=[{path:root.path,depth:0}]
 for(let at=0;at<queue.length&&visited<5000;at++){
  const dir=queue[at]
  for(const e of await readdir(dir.path,{withFileTypes:true}).catch(()=>[])){
   if(++visited>5000)break
   if(e.name.startsWith('.')||excluded.has(e.name.toLowerCase())||e.isSymbolicLink())continue
   const path=join(dir.path,e.name)
   if(e.isDirectory()&&dir.depth<9)queue.push({path,depth:dir.depth+1})
   else if(e.isFile()&&/\.(md|tsx?|js|json|pdf|png|jpe?g|txt|docx|xlsx|pptx)$/i.test(e.name)&&!/(credential|secret|password|auth|token|private|cookie|session)/i.test(e.name))
    candidates.push({root:root.id,path,name:e.name,depth:dir.depth,hash:createHash('sha256').update(seed+path).digest('hex')})
  }
 }
 for(const deep of [false,true])selected.push(...candidates.filter(x=>(x.depth>=3)===deep).sort((a,b)=>a.hash.localeCompare(b.hash)).slice(0,2))
 sampling.push({root:root.id,visited:Math.min(visited,5000),candidates:candidates.length,budgetReached:visited>=5000})
}
const index=await buildIndex(),rows=[]
for(const f of selected){
 const started=performance.now(),result=await discoverFiles({terms:[f.name],root:f.root,maxDepth:20})
 const rank=result.hits.findIndex(h=>h.path.toLowerCase()===f.path.toLowerCase())+1
 let contextualRank=rank
 if(!rank){const retry=await discoverFiles({terms:[f.name,basename(dirname(f.path))],root:f.root,maxDepth:20});contextualRank=retry.hits.findIndex(h=>h.path.toLowerCase()===f.path.toLowerCase())+1}
 rows.push({root:f.root,depth:f.depth,baselineRank:search(index,f.name).findIndex(h=>h.path.toLowerCase()===f.path.toLowerCase())+1,rank,contextualRank,elapsedMs:Math.round(performance.now()-started),limited:result.coverage.limited,visited:result.coverage.visited})
}
await mkdir(join(import.meta.dir,'.cache'),{recursive:true})
await Bun.write(join(import.meta.dir,'.cache','discovery-private-ground-truth.json'),JSON.stringify(selected,null,2))
const report={seed,sampling,samples:rows.length,baselineFound:rows.filter(x=>x.baselineRank>0).length,discoveryFound:rows.filter(x=>x.rank>0).length,withFolderClue:rows.filter(x=>x.contextualRank>0).length,rows}
await Bun.write(join(import.meta.dir,'.cache','discovery-local-report.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
