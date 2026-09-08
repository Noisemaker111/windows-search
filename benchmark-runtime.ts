/** Model-only benchmarks receive supplied evidence, never access to the PC. */
export function isolateBenchmarkRuntime<T extends {agents:Record<string, unknown>;mcp?:unknown}>(source:T){
 const config=structuredClone(source)
 config.mcp={servers:{}}
 config.agents={
  'search-bar':{
   mode:'primary',description:'Answer a synthetic Windows search benchmark',
   system:'Answer briefly using only the supplied evidence. Give exact supplied paths; never invent locations or claim to search the PC. A launch receipt means requested, not confirmed open. Only claim current web grounding from supplied relevant snippets. Plain text, one to three concise sentences.',
   permissions:[{action:'*',resource:'*',effect:'deny'}],steps:1
  }
 }
 return config
}
