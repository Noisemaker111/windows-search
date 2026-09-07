import {test,expect} from '@playwright/test'
const hit={id:'fixture',name:'Calculator',path:'shell:AppsFolder\\fixture',launch:'shell:AppsFolder\\fixture',kind:'app',match:'exact',score:100}
const event=e=>'data: '+JSON.stringify(e)+'\n\n'
test.beforeEach(async({page})=>{
 await page.route('**/search?*',r=>r.fulfill({json:{hits:[hit]}}))
 await page.goto('/')
})
test('typing, pauses, paste, corrections, model change and IME never submit',async({page})=>{
 let submissions=0;await page.route('**/ask',r=>{submissions++;return r.fulfill({body:''})})
 const q=page.getByRole('combobox',{name:'Ask this PC'});await q.pressSequentially('calcluator',{delay:10});await expect(page.locator('#hits [role=option]')).toBeVisible()
 await q.fill('Calculator');await page.locator('#model').selectOption('gpt-5.6-luna');await q.dispatchEvent('compositionstart');await q.press('Enter');await q.dispatchEvent('compositionend');await expect(page.locator('#hits [role=option]')).toBeVisible();expect(submissions).toBe(0)
})
test('held Enter submits once and fresh Enter can retry after completion',async({page})=>{
 let submissions=0
 await page.route('**/ask',async r=>{submissions++;await new Promise(resolve=>setTimeout(resolve,200));await r.fulfill({contentType:'text/event-stream',body:event({type:'delta',text:'Fixture answer'})+event({type:'done',firstTokenMs:20,totalMs:30})})})
 const q=page.getByRole('combobox',{name:'Ask this PC'});await q.fill('Calculator');await q.dispatchEvent('keydown',{key:'Enter',repeat:false});for(let i=0;i<5;i++)await q.dispatchEvent('keydown',{key:'Enter',repeat:true})
 await expect(page.locator('#status')).toHaveText('Answer complete');expect(submissions).toBe(1);await q.press('Enter');await expect.poll(()=>submissions).toBe(2)
})
test('click and selected Enter share the ask path; neither uses run',async({page})=>{
 const payloads=[];let runs=0
 await page.route('**/run',r=>{runs++;return r.fulfill({json:{}})})
 await page.route('**/ask',async r=>{payloads.push(r.request().postDataJSON());await r.fulfill({contentType:'text/event-stream',body:event({type:'done',firstTokenMs:1,totalMs:2})})})
 const q=page.getByRole('combobox',{name:'Ask this PC'});await q.fill('Calculator');await page.locator('#hits [role=option]').click();await expect(page.locator('#status')).toHaveText('Answer complete');await q.focus();await q.press('ArrowDown');await q.press('Enter');await expect.poll(()=>payloads.length).toBe(2);expect(payloads.map(x=>x.selection)).toEqual(['fixture','fixture']);expect(runs).toBe(0)
})
test('editing cancels pending answer and stale response cannot replace new state',async({page})=>{
 await page.route('**/ask',async r=>{await new Promise(resolve=>setTimeout(resolve,250));await r.fulfill({contentType:'text/event-stream',body:event({type:'delta',text:'STALE'})+event({type:'done',firstTokenMs:1,totalMs:2})}).catch(()=>{})})
 const q=page.getByRole('combobox',{name:'Ask this PC'});await q.fill('Calculator');await q.press('Enter');await expect(page.locator('#stop')).toBeVisible();await q.fill('Projects');await expect(page.locator('#answer')).toBeHidden();await page.waitForTimeout(300);await expect(page.locator('#out')).toHaveText('')
})
test('truncated response reports failure and permits retry',async({page})=>{
 await page.route('**/ask',r=>r.fulfill({contentType:'text/event-stream',body:event({type:'delta',text:'Partial'})}))
 await page.getByRole('combobox',{name:'Ask this PC'}).fill('Calculator');await page.getByRole('combobox',{name:'Ask this PC'}).press('Enter');await expect(page.locator('#out')).toContainText('Connection ended');await expect(page.locator('#ask')).toBeEnabled()
})
test('long names and paths fit narrow window and remain available to keyboard users',async({page})=>{
 await page.setViewportSize({width:390,height:560});await page.route('**/search?*',r=>r.fulfill({json:{hits:[{...hit,name:'A'.repeat(120),path:'C:\\Projects\\'+'directory'.repeat(40)}]}}));await page.getByRole('combobox',{name:'Ask this PC'}).fill('long');await expect(page.locator('#hits [role=option]')).toBeVisible();await page.getByRole('combobox',{name:'Ask this PC'}).press('ArrowDown');await expect(page.getByRole('combobox',{name:'Ask this PC'})).toHaveAttribute('aria-activedescendant','hit-fixture');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})



test('model change after outage makes no call and leaves a usable retry',async({page})=>{
 let count=0
 await page.route('**/ask',async r=>{count++;await r.fulfill(count===1?{status:503,json:{error:'Model unavailable'}}:{contentType:'text/event-stream',body:event({type:'delta',text:'Recovered'})+event({type:'done',firstTokenMs:1,totalMs:2})})})
 const q=page.getByRole('combobox',{name:'Ask this PC'});await q.fill('Calculator');await q.press('Enter');await expect(page.locator('#out')).toHaveText('Model unavailable');await page.locator('#model').selectOption('gpt-5.6-sol');expect(count).toBe(1);await q.press('Enter');await expect(page.locator('#out')).toHaveText('Recovered')
})

test('native window identity, dismissal cancellation and focus select the existing query',async({page})=>{
 await page.goto('/?native=1&windowId=0123456789abcdef0123456789abcdef')
 await expect(page).toHaveTitle('Windows Search [8331] 0123456789abcdef0123456789abcdef')
 await page.route('**/ask',async r=>{await new Promise(resolve=>setTimeout(resolve,250));await r.fulfill({contentType:'text/event-stream',body:event({type:'delta',text:'STALE'})+event({type:'done',firstTokenMs:1,totalMs:2})}).catch(()=>{})})
 const q=page.getByRole('combobox',{name:'Ask this PC'});await q.fill('Calculator');await q.press('Enter');await expect(page.locator('#stop')).toBeVisible()
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
 await expect(page.locator('#stop')).toBeVisible()
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))})
 await expect(page.locator('#status')).toHaveText('Answer stopped');await page.waitForTimeout(300);await expect(page.locator('#out')).toHaveText('')
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
 await expect(q).toBeFocused();expect(await q.evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd))).toBe('Calculator')
})
