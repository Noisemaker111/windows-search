import { readdir, readFile, stat } from "node:fs/promises"
import { join, basename } from "node:path"
import { homedir } from "node:os"

export type Hit = { id: string; name: string; path: string; launch: string; kind: "app" | "game" | "folder" | "file" }
export const projects = join(homedir(), "Projects")
export const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
export function needle(q: string) {
  return normalize(q).replace(/^(where (is|are)|wheres|find|locate|open|run|launch|start|play|go to|show me|show)\s+/, "")
    .replace(/^(my|the)\s+/, "").replace(/\s+(at|located|installed|folder|directory|path)$/, "").trim()
}
export function search(index: Hit[], query: string) {
  const n = needle(query)
  if (!n) return []
  const score = (h: Hit) => {
    const names = [normalize(h.name), normalize(basename(h.path))]
    return Math.max(...names.map(a => a === n ? 100 : a.startsWith(n) ? 85 : a.includes(n) ? 70 :
      n.split(" ").every(t => a.split(" ").includes(t)) ? 65 : 0))
  }
  if (/^projects?$/.test(n)) return index.filter(h => h.path === projects || h.path.startsWith(projects + "\\")).slice(0, 12)
  return index.map(h => ({ h, score: score(h) })).filter(x => x.score > 0)
    .sort((a,b) => b.score-a.score || Number(b.h.launch.startsWith("steam:"))-Number(a.h.launch.startsWith("steam:")))
    .slice(0,12).map(x => x.h)
}
export function launchIntent(query: string, hits: Hit[]) {
  if (!hits.length || /^(where|find|locate|what|how|why|who|when)\b/i.test(query.trim())) return false
  if (/^(open|run|launch|start|play)\b/i.test(query.trim())) return true
  return ["app","game"].includes(hits[0].kind) && normalize(hits[0].name) === normalize(query)
}
export async function buildIndex() {
  const hits: Hit[] = []
  const add = (name: string, path: string, launch: string, kind: Hit["kind"]) => hits.push({id: String(hits.length), name, path, launch, kind})
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
      else if (/\.(lnk|url)$/i.test(item.name) && !/uninstall/i.test(item.name)) add(item.name.replace(/\.(lnk|url)$/i,""),path,path,"app")
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
