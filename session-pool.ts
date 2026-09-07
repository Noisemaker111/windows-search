/** One unused, single-use session per model. Preparing never admits a prompt. */
export class EmptySessionPool {
  private slots=new Map<string,Promise<{id:string;created:number}>>()
  private closed=false
  constructor(private create:(model:string)=>Promise<string>,private remove:(id:string)=>Promise<void>,private ttl=300000){}
  warm(model:string):Promise<void>{
    if(this.closed)return Promise.resolve()
    const existing=this.slots.get(model)
    if(existing)return existing.then(()=>{},()=>{})
    const slot=this.create(model).then(id=>({id,created:Date.now()}))
    this.slots.set(model,slot)
    return slot.then(()=>{},()=>{if(this.slots.get(model)===slot)this.slots.delete(model)})
  }
  async take(model:string):Promise<{id:string;prepared:boolean}>{
    if(this.closed)throw Error('Session preparation is stopped')
    const slot=this.slots.get(model);this.slots.delete(model)
    if(slot){
      let ready
      try{ready=await slot}catch{}
      if(ready&&Date.now()-ready.created<this.ttl)return {id:ready.id,prepared:true}
      if(ready)await this.remove(ready.id).catch(()=>{})
    }
    return {id:await this.create(model),prepared:false}
  }
  async dispose(){
    this.closed=true
    const slots=[...this.slots.values()];this.slots.clear()
    await Promise.allSettled(slots.map(async slot=>{const {id}=await slot;await this.remove(id)}))
  }
  get size(){return this.slots.size}
}
