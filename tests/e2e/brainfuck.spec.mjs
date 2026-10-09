import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';
const passage = async page => (await page.locator('.typing-text .word').allTextContents())
    .join('').replace(/\u00a0/g, ' ');
const savedBytes = page => page.evaluate(key => localStorage.getItem(key), storageKey);

async function custom(page, text) {
    await page.getByRole('button', { name: 'custom', exact: true }).click();
    await page.getByRole('textbox', { name: 'Text to practice', exact: true }).fill(text);
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Typing input' });
    await input.focus();
    return input;
}

async function finished(page) {
    const results = page.getByRole('region', { name: 'Test results' });
    await expect(results).toBeVisible();
    await expect(results.getByRole('status')).not.toContainText('Saving progress');
    return JSON.parse(await savedBytes(page));
}

test('the Brainfuck WebAssembly version guides mistakes through a complete lesson',
    async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const loading = page.waitForResponse(response => response.url().includes('.wasm'));
        await page.goto('./brainfuck.html');
        const wasm = await loading;
        expect(wasm.ok()).toBe(true);
        expect(wasm.headers()['content-type']).toContain('application/wasm');
        expect(Array.from((await wasm.body()).subarray(0, 8)))
            .toEqual([0, 97, 115, 109, 1, 0, 0, 0]);
        await expect(page.getByRole('region', { name: 'Lesson 1: Left Hand Home' }))
            .toBeVisible();
        await expect(page.locator('.hands-container')).toBeVisible();
        await expect(page.locator('.keyboard-container')).toBeVisible();
        const input = page.getByRole('textbox', { name: 'Typing input' });
        const first = (await passage(page))[0];
        await expect(page.locator(`[data-code="Key${first.toUpperCase()}"]`))
            .toHaveClass(/key-target/);
        await input.pressSequentially('x');
        await expect(page.locator('.typing-text .char.incorrect')).toHaveCount(1);
        await expect(page.locator('.typing-text .char.correct')).toHaveCount(0);
        for (let line = 0; line < 4; line++) {
            await expect(page.locator('.arena-meta')).toContainText(`line ${line + 1} / 4`);
            await input.pressSequentially(await passage(page), { delay: 2 });
        }
        const saved = await finished(page);
        expect(saved.history).toHaveLength(1);
        expect(saved.history[0]).toMatchObject({
            lessonId: 'amat-1',
            typingMode: 'strict',
            errorKeystrokes: 1,
            skippedChars: 0,
            wpmMetric: 'words-v1'
        });
        expect(saved.history[0].learning.keys[first].errors).toBe(1);
        expect(saved.progress['words-v1:amat-1'].completed).toBe(true);
        await page.reload();
        await page.getByRole('button', { name: 'Session history', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Your recent sessions' })
            .getByRole('row')).toHaveCount(2);
        expect(errors).toEqual([]);
    });

test('Brainfuck flow mode reopens short words, removes overflow and keeps error history',
    async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('./brainfuck.html');
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('button', { name: 'Free flow', exact: true }).click();
        await page.keyboard.press('Escape');
        const input = await custom(page, 'cat dog');
        await input.pressSequentially('c ');
        await expect(page.locator('.typing-text .char.skipped')).toHaveCount(2);
        await expect(page.locator('[data-code="KeyD"]')).toHaveClass(/key-target/);
        await input.press('Backspace');
        await expect(page.locator('.typing-text .char.skipped')).toHaveCount(0);
        await expect(page.locator('[data-code="KeyA"]')).toHaveClass(/key-target/);
        await input.pressSequentially('at ');
        await expect(page.locator('.typing-text .char.correct')).toHaveCount(4);
        await input.press('Backspace');
        await expect(page.locator('.typing-text .char.correct')).toHaveCount(4);
        await input.pressSequentially('doxy');
        await expect(page.locator('.typing-text .char.extra')).toHaveCount(1);
        await expect(page.getByRole('region', { name: 'Test results' })).toHaveCount(0);
        await input.press('Backspace');
        await input.press('Backspace');
        await expect(page.locator('.typing-text .char.extra')).toHaveCount(0);
        await expect(page.locator('.typing-text .char.incorrect')).toHaveCount(0);
        await input.pressSequentially('g');
        const saved = await finished(page);
        expect(saved.history[0]).toMatchObject({
            typingMode: 'flow',
            totalKeystrokes: 10,
            correctKeystrokes: 8,
            errorKeystrokes: 2,
            skippedChars: 2,
            accuracy: 66.7
        });
        expect(errors).toEqual([]);
    });

test('Brainfuck lessons reload offline while retaining original progress and unknown fields',
    async ({ page, context }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const old = {
            futureRoot: ['keep'],
            settings: {
                theme: 'light',
                typingMode: 'strict',
                showHands: true,
                showKeyboard: true,
                soundMuted: true,
                testMode: 'words',
                testWordCount: 10,
                futureSetting: ['keep']
            },
            progress: {
                'amat-1': {
                    completed: true,
                    bestWpm: 30,
                    bestAccuracy: 98,
                    stars: 2,
                    futureProgress: ['keep']
                }
            },
            history: [{
                lessonId: 'amat-1',
                wpm: 30,
                accuracy: 98,
                stars: 2,
                date: '2026-10-06T12:00:00Z',
                futureHistory: ['keep']
            }],
            stats: { totalSessions: 1, futureStats: ['keep'] },
            learning: { version: 1, keys: {}, bigrams: {}, futureLearning: ['keep'] }
        };
        await page.addInitScript(({ key, data }) => {
            if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON
                .stringify(data));
        }, { key: storageKey, data: old });
        await page.goto('./brainfuck.html');
        expect(await savedBytes(page)).toBe(JSON.stringify(old));
        await expect(page.getByText('Available offline', { exact: true })).toBeVisible();
        await page.reload();
        await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller
            ?.state)).toBe('activated');
        await context.setOffline(true);
        await page.reload();
        await expect(page.getByRole('region', { name: '10 word test' })).toBeVisible();
        const input = await custom(page, 'ab ba');
        await input.pressSequentially('ab ba', { delay: 2 });
        const saved = await finished(page);
        expect(saved.history).toHaveLength(2);
        expect(saved.history[0].accuracy).toBe(100);
        expect(saved.history[1]).toEqual(old.history[0]);
        expect(saved.progress['amat-1']).toEqual(old.progress['amat-1']);
        expect(saved.settings).toMatchObject(old.settings);
        expect(saved.futureRoot).toEqual(old.futureRoot);
        expect(saved.stats.futureStats).toEqual(old.stats.futureStats);
        expect(saved.learning.futureLearning).toEqual(old.learning.futureLearning);
        const raw = await savedBytes(page);
        await page.reload();
        expect(await savedBytes(page)).toBe(raw);
        await page.goto('./');
        await page.getByRole('button', { name: 'Session history', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Your recent sessions' })
            .getByRole('row')).toHaveCount(3);
        expect(await savedBytes(page)).toBe(raw);
        expect(errors).toEqual([]);
    });

test('a failed WebAssembly load offers an accessible path to the original version',
    async ({ page }) => {
        await page.route('**/*.wasm', route => route.abort());
        await page.goto('./brainfuck.html');
        await expect(page.getByRole('alert')).toContainText(/WebAssembly/i);
        await expect(page.getByRole('textbox', { name: 'Typing input' })).toHaveCount(0);
        await page.getByRole('link', { name: /original/i }).click();
        await expect(page.getByRole('textbox', { name: 'Typing input' })).toBeEnabled();
    });

for (const width of [375, 1440]) {
    for (const theme of ['light', 'dark']) {
        test.describe(`Brainfuck at ${width}px in ${theme}`, () => {
            test.use({
                viewport: { width, height: width === 375 ? 812 : 1000 },
                hasTouch: width === 375,
                reducedMotion: 'reduce'
            });
            test('retains the original lesson and finger guidance', async ({ page }) => {
                await page.goto('./brainfuck.html');
                await expect(page.getByRole(
                        'region', { name: 'Lesson 1: Left Hand Home' }))
                    .toBeVisible();
                if (theme === 'light') {
                    await page.getByRole('button', {
                            name: 'appearance',
                            exact: true
                        })
                        .click();
                }
                await expect(page.locator('html')).toHaveAttribute('data-theme',
                    theme);
                await expect(page.getByText(
                        'Available offline', { exact: true }))
                    .toBeVisible();
                await page.evaluate(() => document.fonts.ready);
                expect(await page.evaluate(() => document.documentElement
                    .scrollWidth <=
                    innerWidth)).toBe(true);
                const directory = resolve(import.meta.dirname, '../../.local');
                await mkdir(directory, { recursive: true });
                await page.screenshot({
                    path: resolve(directory,
                        `brainfuck-${width}-${theme}.png`),
                    fullPage: true
                });
            });
        });
    }
}
