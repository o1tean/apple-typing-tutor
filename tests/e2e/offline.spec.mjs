import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';
const root = resolve(import.meta.dirname, '../..');
const scope = '/apple-typing-tutor/';
const nextHeadline = 'Offline build B is ready.';
let alternate;

test.beforeAll(async () => {
    if (process.env.PLAYWRIGHT_BASE_URL) return;
    alternate = await mkdtemp(join(tmpdir(), 'typeflow-offline-'));
    for (const name of ['src', 'js', 'css', 'public', 'scripts', 'brainfuck', 'swift',
            'index.html',
        'brainfuck.html', 'vite.config.js', 'package.json']) {
        await cp(join(root, name), join(alternate, name), { recursive: true });
    }
    await cp(join(root, 'docs/media/social-preview.png'),
        join(alternate, 'docs/media/social-preview.png'), { recursive: true });
    await symlink(join(root, 'node_modules'), join(alternate, 'node_modules'), 'dir');
    const source = await readFile(join(alternate, 'src/App.jsx'), 'utf8');
    expect(source).toContain('Just you and the keys.');
    await writeFile(join(alternate, 'src/App.jsx'),
        source.replace('Just you and the keys.', nextHeadline));
    // Swift source is unchanged; reuse the verified Wasm for the cache-update fixture.
    const vite = join(root, 'node_modules/vite/bin/vite.js');
    await promisify(execFile)(process.execPath, [vite, 'build'], { cwd: alternate });
    await promisify(execFile)(process.execPath, [vite, 'build', '--config',
        'swift/vite.config.js'], { cwd: alternate });
    await promisify(execFile)(process.execPath, [
    'scripts/build-offline.mjs'], { cwd: alternate });
});

test.afterAll(async () => {
    if (alternate) await rm(alternate, { recursive: true, force: true });
});

async function serveBuilds() {
    let build = join(root, 'dist');
    let fault;
    const server = createServer(async (request, response) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        response.setHeader('Cache-Control', 'no-store');
        if (pathname === '/observer.html' || pathname === '/neighbor.txt') {
            response.setHeader('Content-Type', pathname.endsWith('.html') ?
                'text/html' : 'text/plain');
            response.end(pathname.endsWith('.html') ?
                '<!doctype html><title>Observer</title>' : build);
            return;
        }
        if (!pathname.startsWith(scope)) {
            response.writeHead(404).end();
            return;
        }
        const name = decodeURIComponent(pathname.slice(scope.length)) ||
            'index.html';
        if (name.split('/').some(part => part === '..')) {
            response.writeHead(400).end();
            return;
        }
        if (fault && name === 'icon-192.png') {
            response.writeHead(fault === 'missing' ? 404 :
                200, { 'Content-Type': 'image/png' });
            response.end('deliberately invalid icon');
            return;
        }
        try {
            const bytes = await readFile(join(build, name));
            const type = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.png': 'image/png',
                '.svg': 'image/svg+xml',
                '.webmanifest': 'application/manifest+json'
            };
            response.writeHead(200, {
                'Content-Type': type[extname(name)] ||
                    'application/octet-stream'
            });
            response.end(bytes);
        } catch {
            response.writeHead(404).end();
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    return {
        origin,
        url: origin + scope,
        useNext: () => { build = join(alternate, 'dist'); },
        setFault: value => { fault = value; },
        close: () => new Promise(resolve => {
            server.close(resolve);
            server.closeAllConnections();
        })
    };
}

async function controlled(page, url) {
    await page.goto(url);
    await expect(page.getByText('Available offline', { exact: true })).toBeVisible();
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state))
        .toBe('activated');
}

async function startCustom(page) {
    await page.getByRole('button', { name: 'custom', exact: true }).click();
    await page.getByRole('textbox', { name: 'Text to practice', exact: true }).fill('ab ba');
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    return page.getByRole('textbox', { name: 'Typing input' });
}

test('cached lessons work offline with install icons, old progress and reload intact',
    async ({ page, context }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await controlled(page, './');
        const protocol = await context.newCDPSession(page);
        const parsedManifest = await protocol.send('Page.getAppManifest');
        expect(parsedManifest.errors).toEqual([]);
        expect((await protocol.send('Page.getInstallabilityErrors')).installabilityErrors)
            .toEqual([]);
        await protocol.detach();
        const manifestURL = new URL(await page.locator('link[rel="manifest"]').getAttribute(
                'href'),
            page.url()).href;
        const manifestResponse = await page.request.get(manifestURL);
        expect(manifestResponse.ok()).toBe(true);
        const manifest = await manifestResponse.json();
        expect(manifest.name).toContain('Typeflow');
        expect(manifest.display).toBe('standalone');
        const appURL = new URL('./', page.url());
        expect(new URL(manifest.start_url, manifestURL).href).toBe(appURL.href);
        expect(new URL(manifest.scope, manifestURL).href).toBe(appURL.href);
        for (const size of [192, 512]) {
            const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
            expect(icon.type).toBe('image/png');
            const response = await page.request.get(new URL(icon.src, manifestURL).href);
            expect(response.ok()).toBe(true);
            const bytes = await response.body();
            expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26,
                10]);
            expect(bytes.readUInt32BE(16)).toBe(size);
            expect(bytes.readUInt32BE(20)).toBe(size);
        }
        const old = {
            settings: {
                theme: 'light',
                colorPalette: 'plum',
                typingMode: 'strict',
                showHands: true,
                showKeyboard: true,
                soundMuted: true,
                futureSetting: 'keep'
            },
            progress: {
                'amat-1': {
                    completed: true,
                    bestWpm: 17,
                    bestAccuracy: 95,
                    stars: 1
                }
            },
            history: [{
                lessonId: 'amat-1',
                wpm: 17,
                accuracy: 95,
                stars: 1,
                date: '2026-10-06T08:00:00Z',
                futureSession: 'keep'
            }],
            futureData: { keep: true }
        };
        await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(
            data)), { key: storageKey, data: old });
        await context.setOffline(true);
        await page.reload();
        await expect(page.getByText('Available offline', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'learn', exact: true }).click();
        await page.getByRole('button', { name: /Left Hand Home/ }).click();
        const input = page.getByRole('textbox', { name: 'Typing input' });
        for (let line = 0; line < 4; line++) {
            const passage = (await page.locator('.typing-text .word').allTextContents())
                .join('').replace(/\u00a0/g, ' ');
            expect(passage).toMatch(/^[asdf ]+$/);
            await input.pressSequentially(passage, { delay: 5 });
        }
        const results = page.getByRole('region', { name: 'Test results' });
        await expect(results).toBeVisible();
        await expect(results.getByRole('status')).not.toContainText('Saving progress');
        const savedRaw = await page.evaluate(key => localStorage.getItem(key), storageKey);
        const saved = JSON.parse(savedRaw);
        expect(saved.history).toHaveLength(2);
        expect(saved.history[1]).toEqual(old.history[0]);
        expect(saved.progress['amat-1']).toEqual(old.progress['amat-1']);
        expect(saved.progress['words-v1:amat-1'].completed).toBe(true);
        expect(saved.settings).toMatchObject(old.settings);
        expect(saved.futureData).toEqual(old.futureData);
        await page.reload();
        await page.getByRole('button', { name: 'Session history', exact: true }).click();
        await expect(page.getByRole('dialog').getByRole('row')).toHaveCount(3);
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
            savedRaw);
        expect(errors).toEqual([]);
    });

test('a real new build waits for all tabs and saved attempts before replacing the old cache',
    async ({ browser }, testInfo) => {
        test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL),
            'Local alternate-build server.');
        const server = await serveBuilds();
        const context = await browser.newContext();
        try {
            const page = await context.newPage();
            await controlled(page, server.url);
            const second = await context.newPage();
            await second.goto(server.url);
            const observer = await context.newPage();
            await observer.goto(server.origin + '/observer.html');
            await observer.evaluate(async () => {
                const cache = await caches.open('neighbor-app-v1');
                await cache.put('/neighbor-data', new Response('keep'));
            });
            const oldCaches = await page.evaluate(() => caches.keys());
            const oldCache = oldCaches.find(name => name.startsWith('typeflow-offline:'));
            expect(oldCache).toBeTruthy();
            const input = await startCustom(page);
            await input.pressSequentially('a', { delay: 20 });
            server.useNext();
            await page.evaluate(async () => (await navigator.serviceWorker
                .getRegistration()).update());
            await expect(page.getByText('Update ready', { exact: true })).toBeVisible();
            await expect(page.locator('.typing-text .char.correct')).toHaveCount(1);
            await page.locator('.offline-status summary').click();
            await expect(page.locator('.offline-status')).toContainText(
                'Finish and save your session');
            await page.locator('.offline-status').screenshot({
                path: testInfo.outputPath(
                    'update-ready.png')
            });
            expect(await page.evaluate(() => caches.keys())).toContain(oldCache);
            await second.reload();
            await expect(second.getByRole('heading', { name: nextHeadline, exact: true }))
                .toHaveCount(0);

            await page.evaluate(key => {
                navigator.locks.request(key, () => new Promise(resolve => {
                    window.releaseOfflineFixtureLock = resolve;
                }));
            }, storageKey);
            await expect.poll(() => page.evaluate(() => typeof window
                .releaseOfflineFixtureLock)).toBe('function');
            await input.pressSequentially('b ba', { delay: 20 });
            const results = page.getByRole('region', { name: 'Test results' });
            await expect(results).toContainText('Saving progress');
            await expect(page.getByText('Update ready', { exact: true })).toBeVisible();
            await page.evaluate(() => window.releaseOfflineFixtureLock());
            await expect(results.getByRole('status')).not.toContainText('Saving progress');
            const firstSave = await page.evaluate(key => localStorage.getItem(key),
                storageKey);
            expect(JSON.parse(firstSave).history).toHaveLength(1);

            const nextInput = await startCustom(page);
            await page.evaluate(key => {
                const setItem = Storage.prototype.setItem;
                window.restoreOfflineFixtureStorage = () => {
                    Storage.prototype
                        .setItem = setItem;
                };
                Storage.prototype.setItem = function(name, value) {
                    if (name === key) throw new DOMException('Storage full',
                        'QuotaExceededError');
                    return setItem.call(this, name, value);
                };
            }, storageKey);
            await nextInput.pressSequentially('ab ba', { delay: 20 });
            await expect(page.getByText(
                'storage unavailable · session only', { exact: true })).toBeVisible();
            expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
                firstSave);
            await expect(page.getByText('Update ready', { exact: true })).toBeVisible();
            await page.evaluate(() => window.restoreOfflineFixtureStorage());
            await page.getByRole('button', { name: 'Keep my progress', exact: true })
                .click();
            await page.getByRole('button', { name: 'Try saving again', exact: true })
                .click();
            await expect(page.getByText(
                    'Your progress is saved on this device.', { exact: true }))
                .toBeVisible();
            const saved = await page.evaluate(key => localStorage.getItem(key), storageKey);
            expect(JSON.parse(saved).history).toHaveLength(2);
            await page.close();
            expect(await second.evaluate(async () => (await navigator.serviceWorker
                    .getRegistration()).waiting?.state))
                .toBe('installed');
            await second.close();
            await expect.poll(() => observer.evaluate(async ({ url, oldCache }) => {
                const registration = await navigator.serviceWorker
                    .getRegistration(url);
                return !registration.waiting && registration.active?.state
                    === 'activated'
                    && !(await caches.keys()).includes(oldCache);
            }, { url: server.url, oldCache })).toBe(true);
            expect(await observer.evaluate(() => caches.keys())).not.toContain(oldCache);
            expect(await observer.evaluate(async () => (await caches.match(
                '/neighbor-data')).text())).toBe('keep');
            const reopened = await context.newPage();
            await reopened.goto(server.url);
            await expect(reopened.getByRole('heading', { name: nextHeadline, exact: true }))
                .toBeVisible();
            expect(await reopened.evaluate(key => localStorage.getItem(key), storageKey))
                .toBe(saved);
            const registrationScope = await reopened.evaluate(async () => (await navigator
                .serviceWorker.getRegistration()).scope);
            expect(registrationScope).toBe(server.url);
            expect(await observer.evaluate(() => navigator.serviceWorker.controller))
                .toBeNull();
            expect(await reopened.evaluate(async () => (await fetch('/neighbor.txt'))
                    .text()))
                .toBe(join(alternate, 'dist'));
            await context.setOffline(true);
            await reopened.reload();
            await expect(reopened.getByRole('heading', { name: nextHeadline, exact: true }))
                .toBeVisible();
            expect(await reopened.evaluate(key => localStorage.getItem(key), storageKey))
                .toBe(saved);
        } finally {
            await context.close();
            await server.close();
        }
    });

test('failed missing and corrupt asset installs retain the working build and report first-visit failure',
    async ({ browser }, testInfo) => {
        test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local fault server.');
        const server = await serveBuilds();
        const context = await browser.newContext();
        let fresh;
        try {
            const page = await context.newPage();
            await controlled(page, server.url);
            const cacheBefore = await page.evaluate(() => caches.keys());
            server.useNext();
            for (const fault of ['missing', 'corrupt']) {
                server.setFault(fault);
                await page.evaluate(async () => {
                    const registration = await navigator.serviceWorker
                        .getRegistration();
                    const failed = new Promise(resolve => {
                        registration.addEventListener('updatefound',
                            () => {
                                const worker = registration
                                    .installing;
                                worker.addEventListener(
                                    'statechange', () => {
                                        if (worker.state ===
                                            'redundant')
                                            resolve();
                                    });
                            }, { once: true });
                    });
                    await registration.update();
                    await failed;
                });
                expect(await page.evaluate(async () => (await navigator.serviceWorker
                    .getRegistration()).waiting)).toBeNull();
                for (const name of cacheBefore) expect(await page.evaluate(() => caches
                    .keys())).toContain(name);
                await page.reload();
                await expect(page.getByText('Available offline', { exact: true }))
                    .toBeVisible();
                await expect(page.getByRole('heading', { name: nextHeadline, exact: true }))
                    .toHaveCount(0);
            }
            fresh = await browser.newContext();
            const failedPage = await fresh.newPage();
            await failedPage.goto(server.url);
            await expect(failedPage.getByText('Offline setup unavailable', { exact: true }))
                .toBeVisible();
            await failedPage.locator('.offline-status summary').click();
            await failedPage.locator('.offline-status').screenshot({
                path: testInfo
                    .outputPath('setup-unavailable.png')
            });
            await expect(failedPage.getByRole('textbox', { name: 'Typing input' }))
                .toBeEnabled();
            expect(await failedPage.evaluate(async () => (await navigator.serviceWorker
                .getRegistration())?.active || null)).toBeNull();
        } finally {
            await fresh?.close();
            await context.close();
            await server.close();
        }
    });
