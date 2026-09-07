export type Source={title:string;url:string;content:string}
const stop=new Set(['who','what','where','when','which','how','why','the','and','for','are','was','does','current','currently','latest','today','now','this','that','with','can','you','tell','about'])
export function relevant(query:string,source:Source){
 const terms=query.toLowerCase().match(/[a-z0-9]+/g)?.filter(t=>t.length>2&&!stop.has(t))||[]
 const words=new Set((source.title+' '+source.content).toLowerCase().match(/[a-z0-9]+/g)||[])
 return terms.length>0&&terms.filter(t=>words.has(t)).length>=Math.min(2,terms.length)
}
