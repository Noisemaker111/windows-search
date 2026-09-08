import {search,type Hit} from './pc'
export const syntheticIndex:Hit[]=[
 {id:'fixture-game',name:'7 Days to Die',path:'C:\\Games\\7 Days To Die',launch:'steam://rungameid/251570',kind:'game'},
 {id:'fixture-projects',name:'Projects',path:'C:\\Projects',launch:'C:\\Projects',kind:'folder'},
 ...Array.from({length:6},(_,i)=>({id:'fixture-project-'+i,name:'Project '+i,path:'C:\\Projects\\Project'+i,launch:'C:\\Projects\\Project'+i,kind:'folder' as const}))
]
/** Synthetic model tests must not inherit the indexer's machine-specific Projects filter. */
export function fixtureEvidence(kind:string,query:string){
 return kind==='semantic-evidence'?syntheticIndex:kind==='projects'?syntheticIndex.filter(h=>h.kind==='folder'):search(syntheticIndex,query)
}
