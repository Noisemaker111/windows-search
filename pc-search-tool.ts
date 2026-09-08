import {createInterface} from 'node:readline'
import {defaultRoots} from './discovery'
import {DiscoverySessions} from './discovery-sessions'
const roots=defaultRoots()
const entryBudget=Number(process.env.SEARCH_SCAN_ENTRIES||50000)
if(!Number.isInteger(entryBudget)||entryBudget<1||entryBudget>50000)throw Error('SEARCH_SCAN_ENTRIES must be 1 to 50000')
const searches=new DiscoverySessions(roots,60000,{entries:entryBudget,milliseconds:2500})
setInterval(()=>void searches.prune(),10000).unref()
const schema={type:'object',properties:{terms:{type:'array',items:{type:'string'},minItems:1,maxItems:6},root:{type:'string',enum:['all',...roots.map(r=>r.id)]},under:{type:'string',description:'Optional relative subfolder inside the selected root; no absolute paths or parent traversal'},extensions:{type:'array',items:{type:'string'},description:'Optional filename extensions, e.g. pdf or pptx'},maxDepth:{type:'integer',minimum:0,maximum:20,default:20}},required:['terms'],additionalProperties:false}
const controllers=new Map<string,AbortController>()
const respond=(id:unknown,result:unknown)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\n')
createInterface({input:process.stdin}).on('line',async line=>{
 let r:any;try{r=JSON.parse(line)}catch{return}
 if(r.method==='notifications/cancelled'){controllers.get(String(r.params?.requestId))?.abort();return}
 if(r.id===undefined)return
 if(r.method==='initialize'){respond(r.id,{protocolVersion:r.params?.protocolVersion||'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'windows-search-pc',version:'1.0.0'}});return}
 if(r.method==='ping'){respond(r.id,{});return}
 if(r.method==='tools/list'){respond(r.id,{tools:[{name:'search_files',description:'Find real files and folders on this PC by filename and parent-folder keywords. Read-only; no file contents or launching. Search the most likely root first, then broaden or increase depth when coverage is incomplete. Terms are ANDed; use short keywords, not a sentence. Preserve separate matches with the same name. If nextCursor is returned, continue_file_search resumes unchecked entries without rescanning. Report scope/limits on a miss. Available roots: '+roots.map(r=>r.id).join(', '),inputSchema:schema},{name:'continue_file_search',description:'Continue the previous limited file search from its nextCursor. Single-use cursor expires after one minute. Returns the next page of paths; merge with earlier results. No new keywords or scope changes.',inputSchema:{type:'object',properties:{cursor:{type:'string'}},required:['cursor'],additionalProperties:false}}]});return}
 if(r.method==='tools/call'&&['search_files','continue_file_search'].includes(r.params?.name)){
  const abort=new AbortController();controllers.set(String(r.id),abort)
  try{const result=await (r.params.name==='search_files'?searches.start(r.params.arguments,abort.signal):searches.resume(r.params.arguments?.cursor,abort.signal));respond(r.id,{content:[{type:'text',text:JSON.stringify(result)}]})}
  catch(e){respond(r.id,{isError:true,content:[{type:'text',text:String(e)}]})}
  finally{controllers.delete(String(r.id))}
  return
 }
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,error:{code:-32601,message:'Method not found'}})+'\n')
})
process.stdin.on('end',()=>{for(const controller of controllers.values())controller.abort();void searches.dispose()})
