import { defineConfig } from '@playwright/test';

const liveURL = process.env.PLAYWRIGHT_BASE_URL;
const localURL = 'http://127.0.0.1:4173';

export default defineConfig({
    testDir: './tests/e2e',
    forbidOnly: Boolean(process.env.CI),
    reporter: 'list',
    use: {
        baseURL: `${(liveURL || localURL).replace(/\/$/, '')}/`,
        browserName: 'chromium',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },
    webServer: liveURL ? undefined : {
        command: 'npm run preview -- --port 4173 --strictPort',
        url: localURL,
        reuseExistingServer: false
    }
});
