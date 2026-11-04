import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./test/e2e',
  timeout:20_000,
  use:{baseURL:'http://127.0.0.1:8787',browserName:'chromium',trace:'retain-on-failure'},
  webServer:{command:'npm run preview',port:8787,reuseExistingServer:!process.env.CI,timeout:15_000},
});
