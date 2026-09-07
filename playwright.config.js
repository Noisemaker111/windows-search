import {defineConfig} from '@playwright/test'
export default defineConfig({testMatch:'interaction.browser.js',workers:1,timeout:15000,use:{baseURL:process.env.SEARCH_TEST_URL||'http://127.0.0.1:8331',channel:'msedge',headless:true,viewport:{width:780,height:560}},reporter:'list'})
