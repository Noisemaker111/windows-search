import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"
import { createHash } from "node:crypto"

export type Hit = { iconPath?: string; id: string; name: string; path: string; launch: string; kind: "app" | "game" | "folder" | "file" }
export const projects = join(homedir(), "Projects")
export const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
export function needle(q: string) {
  return normalize(q).replace(/^(whe?re (is|are)|wher (is|are)|wheres|where s|find|locate|open|run|launch|start|play|go to|show me|show)\s+/, "")
    .replace(/^(my|the)\s+/, "").replace(/\s+(at|located|installed|folder|directory|path)$/, "").trim()
}
export function distance(a: string, b: string) {
  const rows = Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i===0?j:j===0?i:0))
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) {
    rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+Number(a[i-1]!==b[j-1]))
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1)
  }
  return rows[a.length][b.length]
}
export function search(index: Hit[], query: string) {
  const n = needle(query)
  if (!n) return []
  function score(h: Hit) {
    const a=normalize(h.name)
    if(a===n) return 100
    if(a.startsWith(n)) return 95
    if(a.includes(n)) return 90
    if(n.length<3) return 0
    const tokens=n.split(" "), words=a.split(" ")
    const costs=tokens.map(t=>Math.min(...words.map(w=>{
      if(w===t||w.startsWith(t))return 0
      if(t.length<3||Math.abs(t.length-w.length)>2)return 99
      const d=distance(t,w)
      return d<=(t.length<6?1:2)?d:99
    })))
    if(costs.some(c=>c===99))return 0
    const errors=costs.reduce((a,b)=>a+b,0)
    if(errors===0)return 85
    const confidence=1-errors/n.replaceAll(" ","").length
    return confidence>=0.65?Math.round(60+confidence*20):0
  }
  if (/^projects?$/.test(n) || (n.length>=6 && n.length<=10 && distance(n,"projects")<=2)) return index
    .filter(h=>h.path===projects||h.path.startsWith(projects+"\\")).slice(0,12)
    .map(h=>({...h,match:normalize(h.name)===n?"exact":"related",score:h.path===projects?100:50}))
  const seen=new Set<string>()
  return index.map(h=>({...h,score:score(h)})).filter(h=>h.score>0)
    .sort((a,b)=>b.score-a.score||Number(b.launch.startsWith("steam:"))-Number(a.launch.startsWith("steam:")))
    .filter(h=>{const key=normalize(h.name);if(seen.has(key))return false;seen.add(key);return true})
    .slice(0,8).map(h=>({...h,match:h.score===100?"exact":h.score<80?"fuzzy":"prefix"}))
}

export function launchIntent(query: string, hits: (Hit & {score?:number})[]) {
  if (!hits.length || /^(where|find|locate|what|how|why|who|when)\b/i.test(query.trim())) return false
  if (/^(open|run|launch|start|play)\b/i.test(query.trim())) return !(hits[0].score!==undefined && hits[0].score<100 && hits[1]?.score!==undefined && hits[0].score-hits[1].score<3)
  return ["app","game"].includes(hits[0].kind) && normalize(hits[0].name) === normalize(query)
}
export async function buildIndex() {
  const hits: Hit[] = []
  const add = (name: string, path: string, launch: string, kind: Hit["kind"]) => hits.push({id: createHash("sha256").update(launch).digest("hex").slice(0,20), name, path, launch, kind})
  const exists = async (p: string) => stat(p).then(() => true, () => false)
  const steam = "C:\\Program Files (x86)\\Steam"
  const vdf = await readFile(join(steam,"steamapps","libraryfolders.vdf"),"utf8").catch(() => "")
  const libraries = new Set([steam,...[...vdf.matchAll(/"path"\s+"([^"]+)"/g)].map(m => m[1].replace(/\\\\/g,"\\"))])
  for (const lib of libraries) {
    const apps = join(lib,"steamapps"), common = join(apps,"common"), known = new Set<string>()
    for (const name of await readdir(apps).catch(() => [])) {
      if (!/^appmanifest_\d+\.acf$/.test(name)) continue
      const text = await readFile(join(apps,name),"utf8")
      const title = text.match(/"name"\s+"([^"]+)"/)?.[1], dir = text.match(/"installdir"\s+"([^"]+)"/)?.[1]
      if (!title || !dir) continue
      const path = join(common,dir)
      if (!(await exists(path))) continue
      known.add(path.toLowerCase())
      add(title,path,"steam://rungameid/"+name.match(/\d+/)![0],"game")
    }
    for (const dir of await readdir(common).catch(() => [])) {
      const path = join(common,dir)
      if (!known.has(path.toLowerCase()) && await exists(path)) add(dir,path,path,"folder")
    }
  }
  if (await exists(projects)) {
    add("Projects",projects,projects,"folder")
    for (const item of await readdir(projects,{withFileTypes:true})) {
      if (item.name.startsWith(".")) continue
      const path = join(projects,item.name)
      add(item.name,path,path,item.isDirectory() ? "folder" : "file")
    }
  }
  // Start menu shortcuts supply real paths, including classic desktop apps.
  const startRoots = [join(process.env.APPDATA!,"Microsoft","Windows","Start Menu","Programs"),
    join(process.env.ProgramData!,"Microsoft","Windows","Start Menu","Programs")]
  async function walk(dir: string) {
    for (const item of await readdir(dir,{withFileTypes:true}).catch(() => [])) {
      const path = join(dir,item.name)
      if (item.isDirectory()) await walk(path)
      else if (/\.(lnk|url)$/i.test(item.name) && !/uninstall/i.test(item.name)) {
        const name=item.name.replace(/\.(lnk|url)$/i,"")
        const existing=hits.find(h=>normalize(h.name)===normalize(name))
        let iconPath=path
        if(/\.url$/i.test(path)) iconPath=(await readFile(path,"utf8")).match(/^IconFile=(.+)$/m)?.[1]?.trim()||path
        if(existing){existing.iconPath=iconPath;continue}
        add(name,path,path,"app");hits[hits.length-1].iconPath=iconPath
      }
    }
  }
  await Promise.all(startRoots.map(walk))
  const proc = Bun.spawn(["powershell.exe","-NoProfile","-NonInteractive","-Command",
    "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress"],
    {stdout:"pipe",stderr:"pipe",windowsHide:true})
  const raw = await new Response(proc.stdout).text()
  if (await proc.exited !== 0) throw new Error("Start apps indexing failed: "+await new Response(proc.stderr).text())
  const apps = JSON.parse(raw)
  for (const a of Array.isArray(apps) ? apps : [apps]) {
    if (!a?.Name || !a.AppID || hits.some(h => normalize(h.name)===normalize(a.Name))) continue
    const target = "shell:AppsFolder\\"+a.AppID
    add(a.Name,target,target,"app")
  }
  return hits
}
export async function launch(hit: Hit) {
  if (!hit.launch.startsWith("shell:") && !hit.launch.startsWith("steam:") && !(await stat(hit.path).catch(() => null)))
    throw new Error("This result no longer exists. Refresh the search.")
  const encoded = Buffer.from(hit.launch,"utf8").toString("base64")
  const proc = Bun.spawn(["powershell.exe","-NoProfile","-NonInteractive","-Command",
    "$ErrorActionPreference='Stop'; $target=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+encoded+"')); Start-Process -FilePath $target"],
    {stdout:"ignore",stderr:"pipe",windowsHide:true})
  if (await proc.exited !== 0) throw new Error(await new Response(proc.stderr).text())
  return {name:hit.name,target:hit.launch,status:"launch requested"}
}
