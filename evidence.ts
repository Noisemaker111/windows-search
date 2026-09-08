export type Source={title:string;url:string;content:string}
export function wantsWeb(query:string){
 const q=query.trim()
 if(/^(?:search (?:the )?web|web search|look (?:this )?up online)\b/i.test(q))return true
 // An index miss is not web intent. Bare names and vague personal-file requests
 // must reach the PC search agent without first being sent to a search engine.
 if(/\b(my|file|folder|document|pdf|docx|pptx|xlsx)\b|this pc/i.test(q))return false
 return (/^(who|what|when|how|is|are|does|did|can|will)\b/i.test(q)&&/\b(current|currently|latest|today|recent|now)\b/i.test(q))||/^(?:(?:latest|today'?s?)\s+)?(?:news|weather)(?:\s+(?:in|for)\b.*)?[?!.]?$/i.test(q)
}
const stop=new Set(['who','what','where','when','which','how','why','the','and','for','are','was','does','current','currently','latest','today','now','this','that','with','can','you','tell','about'])
export function relevant(query:string,source:Source){
 const terms=query.toLowerCase().match(/[a-z0-9]+/g)?.filter(t=>t.length>2&&!stop.has(t))||[]
 const words=new Set((source.title+' '+source.content).toLowerCase().match(/[a-z0-9]+/g)||[])
 return terms.length>0&&terms.filter(t=>words.has(t)).length>=Math.min(2,terms.length)
}
