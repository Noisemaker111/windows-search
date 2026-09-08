import {test,expect} from 'bun:test'
import {mkdtemp,mkdir,writeFile,rm,symlink,realpath,rename} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {discoverFiles} from './discovery'
import {DiscoverySessions} from './discovery-sessions'
import {search,launchIntent} from './pc'

test('deep discovery, duplicate paths, folder clues, Unicode and scope limits',async()=>{
 const temporaryRoot=await realpath(tmpdir())
 const base=await mkdtemp(join(temporaryRoot,'windows-search-discovery-'));const root=join(base,'files');await mkdir(root)
 try{
  const paths=['shallow/receipt.pdf','archive/2024/client/final/presentations/quarterly-review.pptx','archive/2025/receipt.pdf','notes/café-旅行.txt']
  for(const p of paths){await mkdir(join(root,p,'..'),{recursive:true});await writeFile(join(root,p),'fixture')}
  const roots=[{id:'test',path:root}]
  const deep=await discoverFiles({terms:['quarterly'],root:'test',maxDepth:10},roots);expect(deep.hits[0].path).toBe(join(root,paths[1]))
  const shallow=await discoverFiles({terms:['quarterly'],root:'test',maxDepth:1},roots);expect(shallow.hits).toHaveLength(0);expect(shallow.coverage.depthLimited).toBeGreaterThan(0)
  const duplicates=await discoverFiles({terms:['receipt'],root:'test'},roots);expect(duplicates.hits).toHaveLength(2)
  expect(search(duplicates.hits,'receipt.pdf')).toHaveLength(2);expect(launchIntent('open receipt.pdf',duplicates.hits)).toBe(false)
  const narrowed=await discoverFiles({terms:['receipt','2025'],root:'test'},roots);expect(narrowed.hits).toHaveLength(1);expect(narrowed.hits[0].path).toBe(join(root,paths[2]))
  expect((await discoverFiles({terms:['cafe'],root:'test'},roots)).hits).toHaveLength(1)
  expect((await discoverFiles({terms:['旅行'],root:'test'},roots)).hits).toHaveLength(1)
  expect((await discoverFiles({terms:['quarterly'],extensions:['pdf'],root:'test'},roots)).hits).toHaveLength(0)
  const limited=await discoverFiles({terms:['missing'],root:'test'},roots,undefined,{entries:1,milliseconds:1000});expect(limited.coverage.limited).toBe(true)
  await rm(join(root,paths[0]));expect((await discoverFiles({terms:['receipt'],root:'test'},roots)).hits).toHaveLength(1)
  await expect(discoverFiles({terms:['receipt'],under:'../outside'},roots)).rejects.toThrow('relative')
  const aborted=new AbortController();aborted.abort();await expect(discoverFiles({terms:['receipt']},roots,aborted.signal)).rejects.toThrow()
  await mkdir(join(base,'outside'));await writeFile(join(base,'outside','secret.pdf'),'fixture')
  await symlink(join(base,'outside'),join(root,'linked'),'junction')
  expect((await discoverFiles({terms:['secret']},roots)).hits).toHaveLength(0)
  for(let i=0;i<21;i++){await mkdir(join(root,'copy'+i));await writeFile(join(root,'copy'+i,'common.md'),'fixture')}
  const capped=await discoverFiles({terms:['common.md']},roots)
  expect(capped.hits).toHaveLength(20);expect(capped.coverage.matchingEntries).toBe(21);expect(capped.coverage.truncated).toBe(true)
  const scoped=await discoverFiles({terms:['common.md'],root:'test',under:'copy20'},roots)
  expect(scoped.hits).toHaveLength(1);expect(scoped.coverage.truncated).toBe(false)
 }finally{if(resolve(base).startsWith(resolve(temporaryRoot)+'\\windows-search-discovery-'))await rm(base,{recursive:true,force:true})}
})

test('continuations advance, consume tokens once, expire and cancel without retaining scans',async()=>{
 const temporaryRoot=await realpath(tmpdir()),base=await mkdtemp(join(temporaryRoot,'windows-search-discovery-'))
 try{
  for(let i=0;i<20;i++)await writeFile(join(base,'file-'+i+'.txt'),'fixture')
  const roots=[{id:'test',path:base}],sessions=new DiscoverySessions(roots,60000,{entries:3,milliseconds:1000})
  let page=await sessions.start({terms:['file'],root:'test'}),visited=0;const paths=new Set<string>();let pages=0
  while(true){pages++;expect(page.coverage.visited).toBeGreaterThan(visited);visited=page.coverage.visited;page.hits.forEach(h=>paths.add(h.path))
   if(!('nextCursor' in page))break
   const cursor=page.nextCursor;page=await sessions.resume(cursor)
   await expect(sessions.resume(cursor)).rejects.toThrow('already used')
  }
  expect(pages).toBe(7);expect(visited).toBe(20);expect(paths.size).toBe(20);expect(sessions.size).toBe(0)
  const partial=await sessions.start({terms:['file']});if(!('nextCursor' in partial))throw Error('Expected continuation')
  const abort=new AbortController();abort.abort();await expect(sessions.resume(partial.nextCursor,abort.signal)).rejects.toThrow();expect(sessions.size).toBe(0)
  const expiring=new DiscoverySessions(roots,-1,{entries:3,milliseconds:1000});const expired=await expiring.start({terms:['file']})
  if(!('nextCursor' in expired))throw Error('Expected continuation');await expect(expiring.resume(expired.nextCursor)).rejects.toThrow('expired');expect(expiring.size).toBe(0)
  await sessions.dispose();await expiring.dispose()
 }finally{if(resolve(base).startsWith(resolve(temporaryRoot)+'\\windows-search-discovery-'))await rm(base,{recursive:true,force:true})}
})

test('a directory replaced by an outside junction while paused is not followed',async()=>{
 const temporaryRoot=await realpath(tmpdir()),base=await mkdtemp(join(temporaryRoot,'windows-search-discovery-'))
 const root=join(base,'files'),branch=join(root,'branch'),outside=join(base,'outside')
 const sessions=new DiscoverySessions([{id:'test',path:root}],60000,{entries:1,milliseconds:1000})
 try{
  await mkdir(branch,{recursive:true});await mkdir(outside);await writeFile(join(branch,'note.txt'),'fixture');await writeFile(join(outside,'note.txt'),'outside fixture')
  const first=await sessions.start({terms:['note']});if(!('nextCursor' in first))throw Error('Expected pause inside branch')
  await rename(branch,join(base,'held'));await symlink(outside,branch,'junction')
  const next=await sessions.resume(first.nextCursor);expect(next.hits).toHaveLength(0);expect(next.coverage.excludedEntries).toBeGreaterThan(0)
 }finally{await sessions.dispose();if(resolve(base).startsWith(resolve(temporaryRoot)+'\\windows-search-discovery-'))await rm(base,{recursive:true,force:true})}
})
