import {createInterface} from 'node:readline'
import {discoverFiles,defaultRoots} from './discovery'
const roots=defaultRoots()
const schema={type:'object',properties:{terms:{type:'array',items:{type:'string'},minItems:1,maxItems:6},root:{type:'string',enum:['all',...roots.map(r=>r.id)]},under:{type:'string',description:'Optional relative subfolder inside the selected root; no absolute paths or parent traversal'},extensions:{type:'array',items:{type:'string'},description:'Optional filename extensions, e.g. pdf or pptx'},maxDepth:{type:'integer',minimum:0,maximum:20,default:6}},required:['terms'],additionalProperties:false}
const controllers=new Map<string,AbortController>()
const respond=(id:unknown,result:unknown)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\n')
createInterface({input:process.stdin}).on('line',async line=>{
 let r:any;try{r=JSON.parse(line)}catch{return}
 if(r.method==='notifications/cancelled'){controllers.get(String(r.params?.requestId))?.abort();return}
 if(r.id===undefined)return
 if(r.method==='initialize'){respond(r.id,{protocolVersion:r.params?.protocolVersion||'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'windows-search-pc',version:'1.0.0'}});return}
 if(r.method==='ping'){respond(r.id,{});return}
 if(r.method==='tools/list'){respond(r.id,{tools:[{name:'search_files',description:'Find real files and folders on this PC by filename and parent-folder keywords. Read-only; no file contents or launching. Search the most likely root first, then broaden or increase depth when coverage is incomplete. Terms are ANDed; use short keywords, not a sentence. Preserve separate matches with the same name. Report scope/limits on a miss. Available roots: '+roots.map(r=>r.id).join(', '),inputSchema:schema}]});return}
 if(r.method==='tools/call'&&r.params?.name==='search_files'){
  const abort=new AbortController();controllers.set(String(r.id),abort)
  try{const result=await discoverFiles(r.params.arguments,roots,abort.signal);respond(r.id,{content:[{type:'text',text:JSON.stringify(result)}]})}
  catch(e){respond(r.id,{isError:true,content:[{type:'text',text:String(e)}]})}
  finally{controllers.delete(String(r.id))}
  return
 }
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,error:{code:-32601,message:'Method not found'}})+'\n')
})
process.stdin.on('end',()=>{for(const controller of controllers.values())controller.abort()})
