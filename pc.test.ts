import { test, expect } from "bun:test"
import {search,launchIntent,projects, type Hit} from "./pc"
const hits:Hit[]=[
{id:"1",name:"7 Days to Die",path:"C:\\Program Files (x86)\\Steam\\steamapps\\common\\7 Days To Die",launch:"steam://rungameid/251570",kind:"game"},
{id:"2",name:"Projects",path:projects,launch:projects,kind:"folder"},
{id:"3",name:"opencode2",path:projects+"\\opencode2",launch:projects+"\\opencode2",kind:"folder"},
{id:"4",name:"Calculator",path:"shell:AppsFolder\\calculator",launch:"shell:AppsFolder\\calculator",kind:"app"}
]
test("natural language locations and possessive projects resolve real indexed hits",()=>{
expect(search(hits,"Where is 7 Days to Die")[0].id).toBe("1")
expect(search(hits,"Where are my projects").map(h=>h.id)).toEqual(["2","3"])
expect(search(hits,"where is imaginary-xyz")).toEqual([])
})
test("play and exact names launch; location/general questions do not",()=>{
for(const q of ["play 7 Days to Die","7 Days to Die","open Calculator","Calculator"])expect(launchIntent(q,search(hits,q))).toBe(true)
for(const q of ["Where is 7 Days to Die","What is Calculator?","Projects","calc","open missing"])expect(launchIntent(q,search(hits,q))).toBe(false)
})
