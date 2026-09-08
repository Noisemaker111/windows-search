import {readdir,realpath,stat} from 'node:fs/promises'
import {join,relative,isAbsolute,sep,basename,extname} from 'node:path'
import {homedir} from 'node:os'
import {createHash} from 'node:crypto'
import {distance,type Hit} from './pc'
export type SearchRoot={id:string;path:string}
export function defaultRoots():SearchRoot[]{
 if(process.env.SEARCH_PC_ROOTS){
  const roots=JSON.parse(process.env.SEARCH_PC_ROOTS) as SearchRoot[]
  if(!Array.isArray(roots)||!roots.length||roots.length>16||roots.some(r=>!r||typeof r.id!=='string'||!/^([a-z][a-z0-9_-]{0,30})$/.test(r.id)||typeof r.path!=='string'||!isAbsolute(r.path))||new Set(roots.map(r=>r.id)).size!==roots.length)throw Error('Invalid SEARCH_PC_ROOTS configuration')
  return roots
 }
 return ['Desktop','Documents','Downloads','Projects','Pictures','Music','Videos'].map(name=>({id:name.toLowerCase(),path:join(homedir(),name)}))
}
export type DiscoveryInput={terms:string[];root?:string;under?:string;extensions?:string[];maxDepth?:number}
const excluded=new Set(['node_modules','vendor','dist','build','coverage','target','appdata','bin','obj','$recycle.bin','system volume information'])
const normalized=(s:string)=>s.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim()
const within=(root:string,path:string)=>{const r=relative(root,path);return r===''||(!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r))}
export async function discoverFiles(input:DiscoveryInput,roots=defaultRoots(),signal?:AbortSignal,limits={entries:50000,milliseconds:2500}){
 if(!input||!Array.isArray(input.terms)||input.terms.length<1||input.terms.length>6||input.terms.some(t=>typeof t!=='string'||!t.trim()||t.length>100))throw Error('Provide one to six short filename or folder keywords')
 const terms=input.terms.map(normalized);if(terms.some(t=>!t))throw Error('Keywords must contain letters or numbers')
 const depth=input.maxDepth??6;if(!Number.isInteger(depth)||depth<0||depth>20)throw Error('Depth must be 0 to 20')
 if(input.under&&(isAbsolute(input.under)||input.under.split(/[\\/]/).includes('..')))throw Error('Choose a relative folder inside a search location')
 const extensions=input.extensions??[];if(!Array.isArray(extensions)||extensions.length>8||extensions.some(x=>typeof x!=='string'||!/^\.?[a-z0-9]{1,12}$/i.test(x)))throw Error('Invalid extensions')
 const scopes=input.root&&input.root!=='all'?roots.filter(r=>r.id===input.root):roots;if(!scopes.length)throw Error('Unknown search location')
 const suffixes=extensions.map(x=>'.'+x.replace(/^\./,'').toLowerCase())
 const started=performance.now();let visited=0,depthLimited=0,inaccessible=0,excludedEntries=0,limited=false,matchingEntries=0
 const searched:string[]=[],unavailable:string[]=[],hits:Array<Hit&{score:number;match:string}>=[]
 const queue:Array<{path:string;root:string;depth:number}>=[]
 for(const r of scopes){try{const root=await realpath(r.path),path=await realpath(join(root,input.under||''));if(!within(root,path))throw Error('outside');if(!(await stat(path)).isDirectory())throw Error('not directory');queue.push({path,root,depth:0});searched.push(path)}catch{unavailable.push(r.id)}}
 for(let at=0;at<queue.length;at++){
  signal?.throwIfAborted();if(visited>=limits.entries||performance.now()-started>=limits.milliseconds){limited=true;break}
  const dir=queue[at];let entries
  try{if(!within(dir.root,await realpath(dir.path))){excludedEntries++;continue}entries=await readdir(dir.path,{withFileTypes:true})}catch{inaccessible++;continue}
  for(const e of entries){
   signal?.throwIfAborted();if(++visited>limits.entries||performance.now()-started>=limits.milliseconds){limited=true;break}
   if(e.isSymbolicLink()||e.name.startsWith('.')||excluded.has(e.name.toLowerCase())){excludedEntries++;continue}
   const path=join(dir.path,e.name)
   if(e.isDirectory()){if(dir.depth<depth)queue.push({path,root:dir.root,depth:dir.depth+1});else depthLimited++}
   if(!e.isDirectory()&&!e.isFile())continue
   if(suffixes.length&&(!e.isFile()||!suffixes.includes(extname(e.name).toLowerCase())))continue
   const name=normalized(e.name),context=normalized(relative(dir.root,path));let score=0,fuzzy=false,matched=true
   for(const term of terms){if(name===term)score+=100;else if(name.includes(term))score+=75;else if(context.includes(term))score+=35;else{
    const words=name.split(' ');if(term.length>=4&&term.length<=80&&words.some(w=>Math.abs(w.length-term.length)<=2&&distance(w,term)<=(term.length<7?1:2))){score+=30;fuzzy=true}else{matched=false;break}
   }}
   if(!matched)continue
   matchingEntries++
   hits.push({id:createHash('sha256').update(path.toLowerCase()).digest('hex').slice(0,20),name:e.name,path,launch:path,kind:e.isDirectory()?'folder':'file',score,match:fuzzy?'fuzzy':'discovered'})
   // Keep memory bounded even for broad keywords; final ranking retains distinct paths.
   if(hits.length>200){hits.sort((a,b)=>b.score-a.score||a.path.length-b.path.length);hits.length=100}
  }
  if(limited)break
 }
 hits.sort((a,b)=>b.score-a.score||a.path.length-b.path.length||a.path.localeCompare(b.path))
 const verified=[];for(const h of hits.slice(0,30)){try{if((await stat(h.path)).isDirectory()===(h.kind==='folder'))verified.push(h)}catch{}if(verified.length===20)break}
 return {query:input,hits:verified,coverage:{searched,unavailable,visited,depth,depthLimited,inaccessible,excludedEntries,limited,matchingEntries,truncated:matchingEntries>verified.length,elapsedMs:Math.round(performance.now()-started),resultLimit:20,notice:'visited counts filesystem entries, not searched locations. Filename and folder metadata only. Hidden folders, dependencies, build output and links are excluded. A miss does not prove absence elsewhere. If truncated, narrow by a parent-folder keyword or under subfolder.'}}
}
