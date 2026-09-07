import {chromium} from 'playwright'
import {writeFile} from 'node:fs/promises'
const browser=await chromium.launch({channel:'msedge',headless:true,timeout:20000})
const page=await browser.newPage({viewport:{width:780,height:560}})
const samples=[]
try{
 await page.goto('http://127.0.0.1:8331/')
 const before=await (await page.request.get('http://127.0.0.1:8331/metrics')).json()
 await page.locator('#q').pressSequentially('7 dyas to die',{delay:8});await page.locator('.hit').first().waitFor();const after=await (await page.request.get('http://127.0.0.1:8331/metrics')).json();console.log(JSON.stringify({typing:{before,after}}))
 for(let i=0;i<5;i++){
 await page.locator('#q').fill('Where is 7 Days to Die');const started=Date.now();await page.locator('#q').press('Enter');await page.waitForFunction(()=>document.querySelector('#out').textContent.length>0);const first=Date.now()-started;await page.waitForFunction(()=>document.querySelector('#status').textContent==='Answer complete');const total=Date.now()-started;samples.push({first,total,answer:await page.locator('#out').innerText()})
 }
 await page.screenshot({path:'.cache/audit-candidate.png'});console.log(JSON.stringify({uiSamples:samples}));await writeFile('ui-measurements.log',JSON.stringify(samples,null,2))
}finally{await browser.close()}
