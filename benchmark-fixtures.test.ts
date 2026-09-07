import {test,expect} from 'bun:test'
import {fixtureEvidence,syntheticIndex} from './benchmark-fixtures'
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
