import { test, expect } from "bun:test"
import {search,launchIntent,launch,projects, type Hit} from "./pc"
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

test("typos, transpositions, dropped letters and misspelled question prefixes",()=>{
 for(const q of ["calcluator","claculator","calculatr","calulator"])expect(search(hits,q)[0]?.name).toBe("Calculator")
 for(const q of ["7 dyas to die","7 days to dei","wher is 7 days to die","where is 7 das to die"])expect(search(hits,q)[0]?.id).toBe("1")
 for(const q of ["where are my proejcts","where are my projcts","my projects"])expect(search(hits,q)[0]?.id).toBe("2")
 for(const q of ["potato spaceship","cat","nonexistentappzz"])expect(search(hits,q)).toEqual([])
 expect(launchIntent("calcluator",search(hits,"calcluator"))).toBe(false)
 expect(launchIntent("open calcluator",search(hits,"open calcluator"))).toBe(false)
})
test("ambiguous corrections stay suggestions and duplicate shortcuts collapse",()=>{
 const similar:Hit[]=[{...hits[3],name:"Notes",id:"a"},{...hits[3],name:"Votes",id:"b"}]
 expect(launchIntent("open motes",search(similar,"open motes"))).toBe(false)
 const duplicate={...hits[0],id:"duplicate",launch:"shortcut.lnk",kind:"app" as const}
 expect(search([...hits,duplicate],"7 days to die").filter(h=>h.name==="7 Days to Die")).toHaveLength(1)
})

test("short ambiguous prefixes never auto-launch and long text stays bounded",()=>{
 const apps=[hits[3],{...hits[3],id:"counter",name:"Counter Strike"}]
 expect(launchIntent("open c",search(apps,"open c"))).toBe(false)
 expect(launchIntent("open calc",search(apps,"open calc"))).toBe(false)
 expect(search(hits,"a".repeat(4000))).toEqual([])
})

 test("no unique fuzzy or partial result authorizes a launch",()=>{
 for(const q of ["open c","open calcluator","launch calculatr","play 7 dyas to die","open calc","wher is Calculator","where is Calculator"])
 expect(launchIntent(q,search(hits,q))).toBe(false)
 const code={...hits[3],name:"Visual Studio Code",id:"code"}
 expect(search([code],"VS Code")[0]?.id).toBe("code")
 expect(launchIntent("open VS Code",search([code],"open VS Code"))).toBe(false)
 })

test("removed Steam install fails before protocol dispatch",async()=>{await expect(launch({...hits[0],path:"C:/nonexistent-release-audit-fixture/removed-game"})).rejects.toThrow("no longer exists")})
