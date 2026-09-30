import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',timeout:60000,workers:1,use:{baseURL:'http://127.0.0.1:5174',headless:true,trace:'retain-on-failure'},webServer:{command:'node scripts/e2e-server.mjs',url:'http://127.0.0.1:5174/api/health',reuseExistingServer:false,timeout:90000},reporter:'list'});
