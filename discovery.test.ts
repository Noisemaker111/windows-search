import {test,expect} from 'bun:test'
import {mkdtemp,mkdir,writeFile,rm,symlink,realpath} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {discoverFiles} from './discovery'
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
