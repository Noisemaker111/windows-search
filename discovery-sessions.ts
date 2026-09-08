import {randomUUID} from 'node:crypto'
import {discoverPages,type DiscoveryInput,type SearchRoot} from './discovery'
type Scan=ReturnType<typeof discoverPages>
/** Bounded, single-use continuation tokens. Never restart an exhausted prefix. */
export class DiscoverySessions {
 private pending=new Map<string,{scan:Scan;expires:number}>()
 constructor(private roots:SearchRoot[],private ttl=60000,private limits={entries:50000,milliseconds:2500}){}
 get size(){return this.pending.size}
 async prune(){for(const [id,item] of this.pending)if(item.expires<=Date.now()){this.pending.delete(id);await item.scan.return()}}
 async start(input:DiscoveryInput,signal?:AbortSignal){await this.prune();return this.advance(discoverPages(input,this.roots,signal,this.limits),signal)}
 async resume(cursor:string,signal?:AbortSignal){
  await this.prune();const item=this.pending.get(cursor)
  if(!item)throw Error('Search continuation expired or already used. Start a new search.')
  this.pending.delete(cursor);return this.advance(item.scan,signal)
 }
 private async advance(scan:Scan,signal?:AbortSignal){
  try{
   signal?.throwIfAborted();const next=await scan.next(signal);signal?.throwIfAborted()
   if(!next.value)throw Error('Search already completed')
   if(!next.value.coverage.limited){await scan.return();return next.value}
   while(this.pending.size>=4){const [id,old]=this.pending.entries().next().value!;this.pending.delete(id);await old.scan.return()}
   const nextCursor=randomUUID();this.pending.set(nextCursor,{scan,expires:Date.now()+this.ttl})
   return {...next.value,nextCursor}
  }catch(error){await scan.return();throw error}
 }
 async dispose(){const scans=[...this.pending.values()];this.pending.clear();await Promise.all(scans.map(s=>s.scan.return()))}
}
