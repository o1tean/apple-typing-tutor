import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';
const errors = new WeakMap();
const input = page => page.getByRole('textbox', { name: 'Typing input', exact: true });
const results = page => page.getByRole('region', { name: 'Typing results', exact: true });
const savedBytes = page => page.evaluate(key => localStorage.getItem(key), storageKey);
const passage = async page => (await page.locator('.typing-text .word').allTextContents())
    .join('').replace(/\u00a0/g, ' ');

function savedPractice() {
    const cell = {
        attempts: 40,
        errors: 36,
        latencySamples: 40,
        latencyTotalMs: 36000,
        recentErrorRate: 0.8,
        recentLatencyMs: 900,
        futureCell: ['keep']
    };
    return {
        futureRoot: { keep: true },
        settings: {
            keyboardLayout: 'mac-us',
            typingMode: 'strict',
            soundMuted: true,
            showHands: true,
            showKeyboard: true,
            theme: 'light',
            colorPalette: 'plum',
            testMode: 'words',
            testWordCount: 10,
            futureSetting: ['keep']
        },
        progress: { 'amat-1': { completed: true, stars: 2, futureProgress: ['keep'] } },
        history: [{
            lessonId: 'amat-1',
            wpm: 35,
            accuracy: 98,
            stars: 2,
            date: '2026-10-06T12:00:00Z',
            futureHistory: ['keep']
        }],
        stats: { totalSessions: 1, futureStats: ['keep'] },
        learning: {
            version: 1,
            futureLearning: ['keep'],
            keys: { q: { ...cell } },
            bigrams: { qz: { ...cell } }
        }
    };
}

async function visit(page, saved) {
    if (saved) await page.addInitScript(({ key, data }) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON
            .stringify(data));
    }, { key: storageKey, data: saved });
    await page.goto('./swift/');
    await expect(input(page)).toBeVisible();
}

async function setting(page, name, value) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    await dialog.getByRole('combobox', { name, exact: true }).selectOption(value);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(input(page)).toBeFocused();
}

async function custom(page, text) {
    await page.getByRole('button', { name: 'Custom text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Text to practice', exact: true }).fill(text);
    await page.getByRole('button', { name: 'Start custom text', exact: true }).click();
    await expect(input(page)).toBeFocused();
}

async function finish(page, lines = 4, firstOffset = 0, waitForSave = true) {
    for (let line = 0; line < lines; line++) {
        const text = await passage(page);
        expect(text.length).toBeGreaterThan(0);
        await input(page).focus();
        await input(page).pressSequentially(text.slice(line === 0 ? firstOffset : 0), {
            delay: 2
        });
    }
    await expect(results(page)).toBeVisible();
    if (waitForSave) await expect(results(page).getByRole('status'))
        .toHaveText('Progress saved on this device.');
}

function expectPreserved(actual, before) {
    expect(actual.futureRoot).toEqual(before.futureRoot);
    expect(actual.settings).toMatchObject(before.settings);
    expect(actual.progress).toMatchObject(before.progress);
    expect(actual.history.at(-1)).toEqual(before.history[0]);
    expect(actual.stats.futureStats).toEqual(before.stats.futureStats);
    expect(actual.learning.futureLearning).toEqual(before.learning.futureLearning);
    expect(actual.learning.keys.q.futureCell).toEqual(before.learning.keys.q.futureCell);
    expect(actual.learning.bigrams.qz.futureCell).toEqual(before.learning.bigrams.qz.futureCell);
}

test.beforeEach(async ({ page }) => {
    const messages = [];
    errors.set(page, messages);
    page.on('pageerror', error => messages.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') messages.push(message.text());
    });
});

test.afterEach(async ({ page }) => {
    expect(errors.get(page)).toEqual([]);
});

test('Swift WebAssembly runs a fresh guided lesson, pauses and records native input',
    async ({ page }) => {
        await page.addInitScript(() => {
            const instantiate = WebAssembly.instantiate;
            window.swiftWasmInstantiated = false;
            WebAssembly.instantiate = async function(...args) {
                const result = await instantiate.apply(this, args);
                const instance = result.instance || result;
                window.swiftWasmInstantiated =
                    instance instanceof WebAssembly.Instance
                    && typeof instance.exports.typeflow_render ===
                    'function'
                    && typeof instance.exports.typeflow_key === 'function';
                return result;
            };
        });
        const fetched = page.waitForResponse(response => /\.wasm(?:\?|$)/.test(response
            .url()));
        await visit(page);
        const wasm = await fetched;
        expect(wasm.ok()).toBe(true);
        expect(Array.from((await wasm.body()).subarray(0, 4))).toEqual([0, 97, 115, 109]);
        expect(await page.evaluate(() => window.swiftWasmInstantiated)).toBe(true);
        expect(await savedBytes(page)).toBeNull();
        await expect(page.getByRole('heading', { name: 'Lesson 1: Left Hand Home' }))
            .toBeVisible();
        await expect(page.locator('#instructions')).toContainText('left hand');
        await expect(page.locator('#hands')).toBeVisible();
        await expect(page.locator('#keyboard')).toBeVisible();
        const first = (await passage(page))[0];
        await input(page).pressSequentially('x');
        await expect(page.locator('#typing-feedback')).toContainText('Expected');
        await expect(page.locator('.typing-text .char.incorrect')).toHaveCount(1);
        await input(page).pressSequentially(first);
        await expect(page.locator('.typing-text .char.correct')).toHaveCount(1);
        await expect(page.locator('.typing-text .char.incorrect')).toHaveCount(0);
        await page.getByRole('button', { name: 'Restart', exact: true }).focus();
        await expect(page.locator('#position')).toContainText('paused');
        const pausedTime = await page.locator('#live-time').textContent();
        // Observe two timer ticks while focus remains outside the typing field.
        await page.waitForTimeout(250);
        await expect(page.locator('#live-time')).toHaveText(pausedTime);
        await input(page).focus();
        await expect(page.locator('#position')).toContainText('running');
        await finish(page, 4, 1);
        const saved = JSON.parse(await savedBytes(page));
        expect(saved.history).toHaveLength(1);
        expect(saved.history[0]).toMatchObject({ lessonId: 'amat-1', errorKeystrokes: 1 });
        expect(saved.history[0].elapsedMilliseconds).toBeGreaterThan(0);
        expect(saved.progress['words-v1:amat-1'].completed).toBe(true);
        const next = results(page).getByRole('button', {
            name: 'Next lesson',
            exact: true
        });
        await expect(next).toBeFocused();
        await next.press('Enter');
        await expect(page.getByRole('heading', { name: 'Lesson 2: Right Hand Home' }))
            .toBeVisible();
    });

test('Swift free flow corrects a native typo and history survives reload', async ({ page }) => {
    const saved = savedPractice();
    saved.settings.typingMode = 'flow';
    await visit(page, saved);
    await custom(page, 'ab cd');
    await input(page).pressSequentially('ax', { delay: 5 });
    await expect(page.locator('.typing-text .char.incorrect')).toHaveCount(1);
    await input(page).press('Backspace');
    await expect(page.locator('.typing-text .char.incorrect')).toHaveCount(0);
    await expect(page.locator('.typing-text .char.correct')).toHaveCount(1);
    await input(page).pressSequentially('b cd', { delay: 5 });
    await expect(results(page).getByRole('status')).toHaveText(
        'Progress saved on this device.');
    const stored = JSON.parse(await savedBytes(page));
    expect(stored.history[0]).toMatchObject({ lessonId: 'custom', errorKeystrokes: 1 });
    expect(stored.history[0].accuracy).toBeLessThan(100);
    expectPreserved(stored, saved);
    await results(page).getByRole('button', {
        name: 'Practice missed words',
        exact: true
    }).click();
    await expect(page.getByRole('heading', { name: 'Missed words', exact: true }))
        .toBeVisible();
    expect(await passage(page)).toBe('ab');
    await finish(page, 1);
    const raw = await savedBytes(page);
    const practiced = JSON.parse(raw);
    expect(practiced.history[0]).toMatchObject({
        lessonId: 'missed-words',
        recordEligible: false
    });
    expect(practiced.stats.wordHighestWpm).toBe(stored.stats.wordHighestWpm);
    await page.reload();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    const history = page.getByRole('dialog', { name: 'Practice history' });
    await expect(history).toContainText('Custom text');
    expect(await savedBytes(page)).toBe(raw);
});

test('Swift test preferences apply on the next start and repeats preserve the personal best',
    async ({ page }) => {
        await visit(page, savedPractice());
        const original = await passage(page);
        await setting(page, 'Word count', '25');
        expect(await passage(page)).toBe(original);
        await page.getByRole('button', { name: 'Test', exact: true }).click();
        const text = await passage(page);
        expect(text.trim().split(/\s+/)).toHaveLength(25);
        await finish(page, 1);
        const first = JSON.parse(await savedBytes(page));
        expect(first.history[0]).toMatchObject({
            lessonId: 'words-25',
            recordEligible: true
        });
        expect(first.stats.wordHighestWpm).toBeGreaterThan(0);
        await results(page).getByRole('button', { name: 'Try again', exact: true }).click();
        expect(await passage(page)).toBe(text);
        await finish(page, 1);
        const repeated = JSON.parse(await savedBytes(page));
        expect(repeated.history[0]).toMatchObject({
            lessonId: 'words-25',
            recordEligible: false
        });
        expect(repeated.stats.wordHighestWpm).toBe(first.stats.wordHighestWpm);
    });

test('Swift long custom text and native overflow input remain usable without a WASM trap',
    async ({ page }) => {
        test.setTimeout(60000);
        const saved = savedPractice();
        saved.settings.typingMode = 'flow';
        await visit(page, saved);
        await custom(page, '<'.repeat(12000));
        const characters = page.locator('#passage .word .char');
        await expect(characters).toHaveCount(12000);
        expect(await passage(page)).toBe('<'.repeat(12000));
        await input(page).focus();
        await page.keyboard.insertText('x'.repeat(20000));
        await expect(characters).toHaveCount(20000);
        await expect(page.locator('#passage .char.extra')).toHaveCount(8000);
        await page.getByRole('button', { name: 'Restart', exact: true }).click();
        await expect(characters).toHaveCount(12000);
        await expect(page.locator('#passage .char.incorrect')).toHaveCount(0);
        expect(await savedBytes(page)).toBe(JSON.stringify(saved));
    });

for (const [layout, home] of [
        ['mac-us', 'jkl;'], ['colemak', 'neio'], ['dvorak', 'htns'], ['uk-iso', 'jkl;']
]) {
    test(`Swift lesson choice and physical guide follow ${layout}`, async ({ page }) => {
        await visit(page, savedPractice());
        await setting(page, 'Keyboard layout', layout);
        await page.getByRole('button', { name: 'Change lesson', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Choose a lesson' });
        await expect(dialog).not.toContainText('undefined');
        await dialog.getByRole('button', { name: /Lesson 2: Right Hand Home/ }).click();
        const text = await passage(page);
        expect(Array.from(text).every(key => `${home} `.includes(key))).toBe(true);
        expect(text.length).toBeGreaterThan(0);
        const first = text[0];
        const code = ['KeyJ', 'KeyK', 'KeyL', 'Semicolon'][home.indexOf(first)];
        await expect(page.locator(`#keyboard [data-code="${code}"]`)).toHaveClass(
            /key-target/);
        await expect(page.locator('#hands')).toContainText(home.toUpperCase().split('')
            .join(' '));
        if (layout === 'uk-iso') {
            await expect(page.locator('#keyboard [data-code="Enter"]')).toHaveClass(
                /key-iso-enter/);
            await expect(page.locator('#keyboard [data-code="IntlBackslash"]'))
                .toBeVisible();
        }
        await finish(page);
        const stored = JSON.parse(await savedBytes(page));
        expect(stored.settings.keyboardLayout).toBe(layout);
        expect(stored.history[0]).toMatchObject({ lessonId: 'amat-2', accuracy: 100 });
    });
}

test('Swift key and pair practice retain learning observations and unknown saved fields',
    async ({ page }) => {
        const saved = savedPractice();
        await visit(page, saved);
        expect(await savedBytes(page)).toBe(JSON.stringify(saved));
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
        await expect(page.locator('html')).toHaveAttribute('data-palette', 'plum');
        for (const [button, target, lines, id] of [
                ['Practice weak keys', 'q', 4, 'weak-keys'],
                ['Practice pairs', 'q → z', 2, 'weak-pairs']
        ]) {
            await page.getByRole('button', { name: button, exact: true }).click();
            await finish(page, lines);
            await expect(page.locator('#practice-comparison')).toContainText(target);
            await expect(page.locator('#practice-comparison')).toContainText(
                'This drill: this attempt only.');
            const stored = JSON.parse(await savedBytes(page));
            expect(stored.history[0]).toMatchObject({
                lessonId: id,
                recordEligible: false
            });
            expectPreserved(stored, saved);
            await page.getByRole('button', { name: 'Back to practice', exact: true })
                .click();
        }
        const stored = JSON.parse(await savedBytes(page));
        expect(stored.history).toHaveLength(3);
        expect(stored.learning.keys.q.attempts).toBeGreaterThan(saved.learning.keys.q
            .attempts);
        expect(stored.learning.bigrams.qz.attempts).toBeGreaterThan(saved.learning.bigrams
            .qz.attempts);
    });

test('Swift quota failure exports the in-memory session and retries without losing progress',
    async ({ page }) => {
        const saved = savedPractice();
        await visit(page, saved);
        await custom(page, 'ab ba');
        const before = await savedBytes(page);
        await page.evaluate(key => {
            const set = Storage.prototype.setItem;
            window.restoreSwiftStorage = () => { Storage.prototype.setItem = set; };
            Storage.prototype.setItem = function(name, value) {
                if (name === key) throw new DOMException('Storage full',
                    'QuotaExceededError');
                return set.call(this, name, value);
            };
        }, storageKey);
        await finish(page, 1, 0, false);
        await expect(page.getByRole('button', { name: 'Retry save', exact: true }))
            .toBeVisible();
        await expect(results(page).getByRole('status')).toContainText(
            'Progress is pending');
        expect(await savedBytes(page)).toBe(before);
        const downloading = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export backup', exact: true }).click();
        const download = await downloading;
        expect(await download.failure()).toBeNull();
        const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
        expect(backup.session.history[0].lessonId).toBe('custom');
        expectPreserved(backup.session, saved);
        await page.evaluate(() => window.restoreSwiftStorage());
        await page.getByRole('button', { name: 'Retry save', exact: true }).click();
        await expect(results(page).getByRole('status')).toHaveText(
            'Progress saved on this device.');
        await expect(page.getByRole('button', { name: 'Retry save', exact: true }))
            .toBeHidden();
        const stored = JSON.parse(await savedBytes(page));
        expect(stored.history).toHaveLength(2);
        expectPreserved(stored, saved);
    });

test('Swift WebAssembly reloads offline and completes a saved learner’s lesson',
    async ({ page, context }) => {
        const saved = savedPractice();
        await visit(page, saved);
        await expect(page.getByText('Available offline', { exact: true })).toBeVisible();
        await page.reload();
        await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller
                ?.state))
            .toBe('activated');
        await context.setOffline(true);
        await page.reload();
        await expect(input(page)).toBeFocused();
        await finish(page);
        const stored = JSON.parse(await savedBytes(page));
        expect(stored.history).toHaveLength(2);
        expect(stored.history[0].lessonId).toBe('amat-1');
        expectPreserved(stored, saved);
        const raw = await savedBytes(page);
        await page.reload();
        await page.getByRole('button', { name: 'History', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Practice history' })).toContainText(
            'Left Hand Home');
        expect(await savedBytes(page)).toBe(raw);
    });
