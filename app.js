const $=s=>document.querySelector(s)
const q=$('#q'),model=$('#model'),out=$('#out'),status=$('#status'),hitsEl=$('#hits'),answer=$('#answer'),empty=$('#empty'),results=$('#results'),askButton=$('#ask'),clearButton=$('#clear'),stopButton=$('#stop')
const paths={
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
 arrow:'<path d="M12 19V5m-6 6 6-6 6 6"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 sparkle:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/>',
 folder:'<path d="M3 7V5h6l2 2h10v12H3Z"/>',
 game:'<path d="M7 7h10c2 0 3 2 4 10 0 2-2 3-4 0l-2-2H9l-2 2c-2 3-4 2-4 0 1-8 2-10 4-10Z"/><path d="M8 9v5m-2.5-2.5h5M16 10h.01M18 13h.01"/>',
 app:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
 file:'<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v5h4M9 12h6M9 16h6"/>',
 calculator:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h1m6 0h1m-8 4h1m6 0h1m-8 3h1m6 0h1"/>',
 open:'<path d="M8 5h11v11M19 5 5 19"/>'
}
const svg=name=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>'
$('#search-icon').innerHTML=svg('search');askButton.innerHTML=svg('arrow');clearButton.innerHTML=svg('close');$('#answer-icon').innerHTML=svg('sparkle');$('#empty-icon').innerHTML=svg('sparkle')
const nativeWindow=new URLSearchParams(location.search).get('native')==='1'
const windowId=new URLSearchParams(location.search).get('windowId')||''
if(nativeWindow)document.title='Windows Search ['+location.port+']'+(/^[a-f0-9]{32}$/.test(windowId)?' '+windowId:'')
const clientId=crypto.randomUUID()
let hits=[],active=-1,lookupId=0,answerId=0,controller,lookupController,timer,pending=false,composing=false
function render(){
 q.setAttribute('aria-expanded',String(!!hits.length));results.hidden=!hits.length;empty.hidden=!!q.value.trim();$('#count').textContent=hits.length+' result'+(hits.length===1?'':'s')
 hitsEl.replaceChildren();q.removeAttribute('aria-activedescendant')
 hits.forEach((h,i)=>{
  const b=document.createElement('button');b.className='hit'+(i===active?' active':'');b.id='hit-'+h.id;b.setAttribute('role','option');b.tabIndex=-1;b.setAttribute('aria-selected',String(i===active))
  const icon=document.createElement('span');icon.className='hit-icon '+h.kind;icon.innerHTML=svg(/calculator/i.test(h.name)?'calculator':h.kind)
  if(!h.path.startsWith('shell:')){const img=document.createElement('img');img.alt='';img.src='/icons/'+h.id+'.png';img.onload=()=>icon.replaceChildren(img)}
  const body=document.createElement('span');body.className='hit-body'
  const name=document.createElement('span');name.className='name';name.textContent=h.name
  if(h.match==='fuzzy'){const badge=document.createElement('span');badge.className='match-label';badge.textContent='Closest match';name.append(badge)}
  b.setAttribute('aria-label',h.name+' · '+h.path+' · Open and ask OpenCode');
  const path=document.createElement('span');path.className='path';path.textContent=h.path.startsWith("shell:")?"Windows app · Installed on this PC":h.path;path.title=h.path
  const action=document.createElement('span');action.className='hit-action';action.innerHTML='Open '+svg('open')
  body.append(name,path);b.append(icon,body,action);b.onclick=()=>{q.focus();ask(h.id)};hitsEl.append(b)
  if(i===active){q.setAttribute('aria-activedescendant',b.id);b.scrollIntoView({block:'nearest'})}
 })
 $('#footer-hint').innerHTML=active>=0?'<kbd>Enter</kbd> open selection & ask <kbd>Esc</kbd> clear':'<kbd>↑</kbd><kbd>↓</kbd> choose <kbd>Enter</kbd> ask'
}
function setPending(value){pending=value;answer.classList.toggle('pending',value);stopButton.hidden=!value;askButton.disabled=value||!q.value.trim();askButton.setAttribute('aria-label',value?'Answering':'Ask OpenCode')}
function cancel(){
 answerId++;controller?.abort();controller=undefined;setPending(false);if(!out.textContent)answer.hidden=true
}
function edited(){
 cancel();lookupId++;lookupController?.abort();clearTimeout(timer);hits=[];active=-1;render()
 answer.hidden=true;out.textContent='';$('#sources').replaceChildren();$('#launch').hidden=true;$('#timing').textContent=''
 clearButton.hidden=!q.value;askButton.disabled=!q.value.trim();status.textContent=q.value.trim()?'Finding local matches…':'Your PC, a little closer.'
 if(!composing)timer=setTimeout(lookup,40)
}
async function lookup(){
 const id=++lookupId,text=q.value.trim();if(!text)return
 lookupController?.abort();lookupController=new AbortController()
 try{
  const r=await fetch('/search?q='+encodeURIComponent(text),{signal:lookupController.signal});if(!r.ok)throw Error('Search unavailable')
  const data=await r.json();if(id!==lookupId)return;hits=data.hits;active=-1;render()
  if(!pending)status.textContent=hits.length?'Local matches · Enter to ask OpenCode':'No local match · Enter to ask OpenCode'
 }catch(e){if(e.name!=='AbortError'&&id===lookupId)status.textContent='Search unavailable. Try again.'}
}
async function ask(selection){
 const query=q.value.trim()
 if(!query||composing||pending)return
 clearTimeout(timer);lookupId++;lookupController?.abort();cancel()
 controller=new AbortController();const signal=controller.signal,id=++answerId;setPending(true)
 answer.hidden=false;out.textContent='';$('#launch').hidden=true;$('#sources').replaceChildren();status.textContent='Finding your answer…';$('#timing').textContent=''
 $('#answer-label').textContent='OpenCode · '+model.selectedOptions[0].textContent
 try{
  const r=await fetch('/ask',{method:'POST',headers:{'content-type':'application/json'},signal,body:JSON.stringify({query,model:model.value,clientId,selection})})
  if(!r.ok)throw Error((await r.json()).error||r.status)
  const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='',completed=false
  while(true){
   const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()
   for(const line of lines){
    if(!line.startsWith('data:')||id!==answerId)continue;const e=JSON.parse(line.slice(5))
    if(e.type==='hits'){hits=e.hits;active=selection?hits.findIndex(h=>h.id===selection):-1;render()}
    if(e.type==='context'){status.textContent=e.source;for(const s of e.sources){const a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener';a.textContent=s.title||new URL(s.url).hostname;a.title=s.title;$('#sources').append(a)}}
    if(e.type==='delta')out.textContent+=e.text
    if(e.type==='launch'){$('#launch').hidden=false;$('#launch').className='';$('#launch').textContent='Launch requested · '+e.result.name}
    if(e.type==='launchError'){$('#launch').hidden=false;$('#launch').className='error';$('#launch').textContent=e.message}
    if(e.type==='done'){completed=true;$('#timing').textContent=(e.firstTokenMs/1000).toFixed(1)+'s first text · '+(e.totalMs/1000).toFixed(1)+'s total';status.textContent='Answer complete'}
    if(e.type==='error')throw Error(e.message)
   }
  }
  if(!completed&&!signal.aborted)throw Error('Connection ended before the answer finished. Try again.')
 }catch(e){if(e.name!=='AbortError'&&id===answerId){status.textContent='Unable to finish that answer';out.textContent=e.message}}
 finally{if(id===answerId){setPending(false)}}
}
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.repeat)e.preventDefault()},true)
q.addEventListener('input',edited)
q.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer)})
q.addEventListener('compositionend',()=>{composing=false;edited()})
q.addEventListener('keydown',e=>{
 if(e.isComposing||composing)return
 if(e.key==='Enter'){e.preventDefault();if(!e.repeat)ask(active>=0?hits[active]?.id:undefined)}
 if(e.key==='ArrowDown'&&hits.length){e.preventDefault();active=Math.min(active+1,hits.length-1);render()}
 if(e.key==='ArrowUp'&&hits.length){e.preventDefault();active=Math.max(active-1,0);render()}
 if(e.key==='Escape'){e.preventDefault();if(pending){cancel();status.textContent='Answer stopped';return}q.value='';edited()}
})
askButton.onclick=()=>ask(active>=0?hits[active]?.id:undefined)
stopButton.onclick=()=>{cancel();status.textContent='Answer stopped'}
clearButton.onclick=()=>{q.value='';edited();q.focus()}
model.onchange=()=>{cancel();status.textContent='Model changed · Enter to ask';answer.hidden=true}
document.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>{q.value=b.dataset.query;edited();q.focus()})
window.addEventListener('focus',()=>{
 if(nativeWindow){q.focus();q.select()}
 else if(document.activeElement===document.body)q.focus()
})
function leaveWindow(){
 const wasPending=pending;cancel();clearTimeout(timer);lookupId++;lookupController?.abort()
 if(wasPending)status.textContent='Answer stopped'
}
if(nativeWindow)document.addEventListener('visibilitychange',()=>{if(document.hidden)leaveWindow()})
window.addEventListener('pagehide',leaveWindow)
edited();q.focus()
