import {defineConfig} from '@playwright/test'
const external=process.env.SEARCH_TEST_URL
const baseURL=external||'http://127.0.0.1:8331'
export default defineConfig({
 testMatch:'interaction.browser.js',workers:1,timeout:15000,
 webServer:external?undefined:{command:'bun main.ts',url:baseURL+'/models',env:{SEARCH_SHIM_PORT:'8331'},timeout:30000,reuseExistingServer:false},
 use:{baseURL,channel:'msedge',headless:true,viewport:{width:780,height:560}},reporter:'list'
})
