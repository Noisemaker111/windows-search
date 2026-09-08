import {test,expect} from 'bun:test'
import {fixtureEvidence,syntheticIndex} from './benchmark-fixtures'
import {isolateBenchmarkRuntime} from './benchmark-runtime'

test('model-only benchmark runtime cannot inherit PC discovery or other agents',async()=>{
 const product=await Bun.file(new URL('./runtime-config/opencode.json',import.meta.url)).json()
 const before=JSON.stringify(product)
 const isolated=isolateBenchmarkRuntime(product)
 expect(isolated.mcp).toEqual({servers:{}})
 expect(Object.keys(isolated.agents)).toEqual(['search-bar'])
 expect(isolated.agents['search-bar'].permissions).toEqual([{action:'*',resource:'*',effect:'deny'}])
 expect(isolated.agents['search-bar'].system).not.toContain('use search_files')
 expect(isolated.providers).toEqual(product.providers)
 expect(JSON.stringify(product)).toBe(before)
 expect(product.mcp.servers.pc).toBeDefined()
})
test('benchmark Projects uses supplied synthetic folders regardless of host home directory',()=>{
 const hits=fixtureEvidence('projects','Where are my projects')
 expect(hits.map(h=>h.path)).toContain('C:\\Projects')
 expect(hits).toHaveLength(7)
 expect(hits.every(h=>h.path.startsWith('C:\\Projects'))).toBe(true)
})
test('benchmark distinguishes lexical retrieval from semantic candidate selection',()=>{
 const q='Find the zombie survival game I have installed'
 expect(fixtureEvidence('vague',q)).toHaveLength(0)
 expect(fixtureEvidence('semantic-evidence',q).map(h=>h.name)).toContain('7 Days to Die')
 expect(fixtureEvidence('exact','Where is 7 Days to Die').map(h=>h.path)).toEqual(['C:\\Games\\7 Days To Die'])
 expect(JSON.stringify(syntheticIndex)).not.toContain('Users')
})
