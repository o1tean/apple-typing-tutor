import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';
const savedBytes = page => page.evaluate(key => localStorage.getItem(key), storageKey);
const passage = async page => (await page.locator('.typing-text .word').allTextContents())
    .join('').replace(/\u00a0/g, ' ');
const comparison = page => page.getByRole('region', { name: 'Practice focus results' });
const targetRow = (page, target) => comparison(page).getByRole('row').filter({
    has: page.getByRole('rowheader', { name: target, exact: true })
});

function savedPractice(keyboardLayout = 'mac-us') {
    const strongest = {
        attempts: 40,
        errors: 36,
        latencySamples: 40,
        latencyTotalMs: 36000,
        recentErrorRate: 0.8,
        recentLatencyMs: 900,
        futureCell: ['keep']
    };
    const next = {
        attempts: 40,
        errors: 12,
        latencySamples: 40,
        latencyTotalMs: 20000,
        recentErrorRate: 0.3,
        recentLatencyMs: 500
    };
    return {
        futureRoot: ['keep'],
        settings: {
            keyboardLayout,
            typingMode: 'strict',
            soundMuted: true,
            showHands: true,
            showKeyboard: true,
            testMode: 'words',
            testWordCount: 10,
            testDuration: 60,
            punctuation: true,
            numbers: true,
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
            keys: { q: { ...strongest }, w: { ...next } },
            bigrams: { qz: { ...strongest }, wv: { ...next } },
            futureLearning: ['keep']
        }
    };
}

async function seed(page, data) {
    await page.addInitScript(({ key, data }) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON
            .stringify(data));
    }, { key: storageKey, data });
    await page.goto('./');
}

async function finish(page, group = 'bigrams', errors = false, waitForSave = true) {
    const input = page.getByRole('textbox', { name: 'Typing input' });
    const lines = [];
    const total = group === 'keys' ? 4 : 2;
    const flow = (await page.locator('.arena-meta').textContent()).includes('free flow');
    for (let line = 0; line < total; line++) {
        const text = await passage(page);
        lines.push(text);
        await input.focus();
        if (errors) {
            for (const key of text) {
                if (key === 'z') await input.pressSequentially('x');
                await input.pressSequentially(key, { delay: 2 });
            }
        } else await input.pressSequentially(text, { delay: 2 });
        if (flow && line < total - 1) await input.press('Space');
    }
    const results = page.getByRole('region', { name: 'Test results' });
    await expect(results).toBeVisible();
    if (waitForSave) await expect(results.getByRole('status')).not.toContainText(
        'Saving progress');
    return lines;
}

for (const layout of ['mac-us', 'colemak', 'dvorak', 'uk-iso']) {
    test(`${layout} compares key and pair drills offline using scoped observations without extra saves`,
        async ({ page, context }) => {
            const saved = savedPractice(layout);
            await seed(page, saved);
            await expect(page.getByText('Available offline', { exact: true }))
                .toBeVisible();
            await page.reload();
            await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller
                ?.state)).toBe('activated');
            await context.setOffline(true);
            await page.reload();
            await page.evaluate(key => {
                const setItem = Storage.prototype.setItem;
                window.practiceResultWrites = 0;
                Storage.prototype.setItem = function(name, value) {
                    if (name === key) window.practiceResultWrites++;
                    return setItem.call(this, name, value);
                };
            }, storageKey);
            for (const [group, target, label, next] of [
                ['keys', 'q', 'q', 'w'], ['bigrams', 'qz', 'q → z', 'w → v']
            ]) {
                await page.getByRole('button', {
                    name: group === 'keys' ?
                        'Practice weak keys' : /^Practice this pair/
                }).click();
                await finish(page, group);
                const region = comparison(page);
                await expect(region).toContainText(
                    'Earlier: weighted recent observations across layouts. This drill: this attempt only.'
                );
                await expect(region).toContainText(
                    'A short drill is not proof of mastery.');
                const cells = targetRow(page, label).getByRole('cell');
                await expect(cells.nth(0)).toHaveText(
                    '80.0% recent errors, 900 ms recent reach');
                const after = JSON.parse(await savedBytes(page));
                const observed = after.history[0].learning[group][target];
                await expect(cells.nth(1)).toHaveText(
                    `0.0% errors, ${Math.round(observed.latencyTotalMs / observed.latencySamples)} ms reach · 0/${observed.attempts} errors · ${observed.latencySamples} timed`
                );
                await expect(region).toContainText('now suggest a different focus.');
                await expect(region).toContainText(`Next focus: ${next}`);
                const nextAction = region.getByRole('button', {
                    name: 'Start next drill',
                    exact: true
                });
                await expect(nextAction).toBeFocused();
                expect(after.progress).toMatchObject(saved.progress);
                expect(after.settings).toMatchObject(saved.settings);
                expect(after.futureRoot).toEqual(saved.futureRoot);
                expect(after.stats.futureStats).toEqual(saved.stats.futureStats);
                expect(after.learning.futureLearning).toEqual(saved.learning
                    .futureLearning);
                expect(after.learning[group][target].futureCell).toEqual(['keep']);
                expect(after.history.at(-1)).toEqual(saved.history[0]);
                expect(after.history[0]).toMatchObject({
                    wpmMetric: 'words-v1',
                    recordEligible: false
                });
                expect(after.history[0]).not.toHaveProperty('learningBefore');
                const bytes = await savedBytes(page);
                await page.keyboard.press('Enter');
                await expect(page.getByRole('list', {
                        name: group === 'keys' ? 'Focus keys'
                            : 'Focus pair'
                    }))
                    .toHaveText(next);
                expect(await savedBytes(page)).toBe(bytes);
                await page.getByRole('button', { name: 'Typeflow home', exact: true })
                    .click();
            }
            expect(await page.evaluate(() => window.practiceResultWrites)).toBe(2);
            await expect(page.getByRole('region', { name: '10 word test' })).toBeVisible();
            await page.getByRole('button', { name: 'learn', exact: true }).click();
            await expect(page.getByRole('dialog', { name: 'Build your muscle memory' }))
                .toBeVisible();
        });
}

for (const rate of [0.1, 0.5]) {
    test(`a ${rate === 0.1 ? 'worse' : 'matching'} observed pair error rate retains honest evidence and same-focus retry`,
        async ({ page }) => {
            const saved = savedPractice();
            saved.learning.bigrams = {
                qz: {
                    ...saved.learning.bigrams.qz,
                    recentErrorRate: rate
                }
            };
            await seed(page, saved);
            await page.getByRole('button', { name: /^Practice this pair/ }).click();
            const lines = await finish(page, 'bigrams', true);
            const cells = targetRow(page, 'q → z').getByRole('cell');
            await expect(cells.nth(0)).toContainText(
                `${(rate * 100).toFixed(1)}% recent errors`);
            await expect(cells.nth(1)).toContainText('50.0% errors');
            await expect(comparison(page)).toContainText('still suggest this focus.');
            await expect(comparison(page)).toContainText('Next focus: q → z');
            const recorded = JSON.parse(await savedBytes(page));
            await page.getByRole('button', { name: 'Settings', exact: true }).click();
            await page.getByRole('combobox', { name: 'Keyboard layout', exact: true })
                .selectOption('dvorak');
            await page.keyboard.press('Escape');
            await expect(cells.nth(0)).toContainText(
                `${(rate * 100).toFixed(1)}% recent errors`);
            if (rate === 0.5) {
                await page.getByRole('button', { name: 'Settings', exact: true }).click();
                await page.getByRole('button', { name: 'Free flow', exact: true }).click();
                await page.keyboard.press('Escape');
            } else await page.getByRole('button', { name: 'Try again', exact: true })
                .click();
            await expect(page.getByRole('list', { name: 'Focus pair' })).toHaveText(
                'q → z');
            expect(await passage(page)).toBe(lines[0]);
            await expect(page.locator('[data-code="KeyX"]')).toHaveClass(/key-target/);
            await expect.poll(async () => JSON.parse(await savedBytes(page)).settings
                    .keyboardLayout)
                .toBe('dvorak');
            const stored = await savedBytes(page);
            const preferences = JSON.parse(stored);
            expect(preferences.settings.typingMode).toBe(rate === 0.5 ? 'flow' : 'strict');
            for (const field of ['learning', 'history', 'progress']) {
                expect(preferences[field]).toEqual(recorded[field]);
            }
            expect(await savedBytes(page)).toBe(stored);
            await finish(page);
            await expect(targetRow(page, 'q → z').getByRole('cell').nth(0)).toHaveText(
                `50.0% recent errors, ${Math.round(recorded.learning.bigrams.qz.recentLatencyMs)} ms recent reach`
            );
        });
}

test('sparse earlier evidence reports absent timing without inventing a measurement',
    async ({ page }) => {
        const saved = savedPractice();
        saved.learning.bigrams = {
            qz: {
                attempts: 1,
                errors: 1,
                latencySamples: 0,
                latencyTotalMs: 0,
                recentErrorRate: 1,
                recentLatencyMs: 0
            }
        };
        await seed(page, saved);
        await page.getByRole('button', { name: /^Practice this pair/ }).click();
        await finish(page);
        const cells = targetRow(page, 'q → z').getByRole('cell');
        await expect(cells.nth(0)).toHaveText(
            '100.0% recent errors, no reach timing yet · few observations');
        await expect(cells.nth(1)).toContainText('0.0% errors');
        await expect(cells.nth(1)).not.toContainText('few observations');
    });

test('pending and failed saves retain stable comparisons and allow the projected next drill',
    async ({ page }) => {
        const saved = savedPractice();
        await seed(page, saved);
        await page.getByRole('button', { name: /^Practice this pair/ }).click();
        await page.evaluate(key => {
            navigator.locks.request(key, () => new Promise(resolve => {
                window.releasePracticeResultLock = resolve;
            }));
        }, storageKey);
        await expect.poll(() => page.evaluate(() => typeof window
                .releasePracticeResultLock))
            .toBe('function');
        await finish(page, 'bigrams', false, false);
        await expect(page.getByRole('region', { name: 'Test results' })).toContainText(
            'Saving progress');
        await expect(targetRow(page, 'q → z').getByRole('cell').nth(0))
            .toHaveText('80.0% recent errors, 900 ms recent reach');
        await expect(comparison(page)).toContainText('Next focus: w → v');
        expect(await savedBytes(page)).toBe(JSON.stringify(saved));
        await comparison(page).getByRole('button', {
            name: 'Start next drill',
            exact: true
        }).click();
        await expect(page.getByRole('list', { name: 'Focus pair' })).toHaveText('w → v');
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('combobox', { name: 'Keyboard layout', exact: true })
            .selectOption('dvorak');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('list', { name: 'Focus pair' })).toHaveText('w → v');
        await expect(page.locator('[data-code="Comma"]')).toHaveClass(/key-target/);
        expect(await savedBytes(page)).toBe(JSON.stringify(saved));
        await page.evaluate(() => window.releasePracticeResultLock());
        await expect.poll(async () => JSON.parse(await savedBytes(page)).history.length)
            .toBe(2);
        await expect.poll(async () => JSON.parse(await savedBytes(page)).settings
                .keyboardLayout)
            .toBe('dvorak');
        await expect(page.getByRole('region', { name: 'Test results' })).toHaveCount(0);
        await expect(page.getByRole('list', { name: 'Focus pair' })).toHaveText('w → v');
        const firstSave = await savedBytes(page);
        await page.evaluate(key => {
            const setItem = Storage.prototype.setItem;
            window.restorePracticeResultStorage = () => {
                Storage.prototype
                    .setItem = setItem;
            };
            Storage.prototype.setItem = function(name, value) {
                if (name === key) throw new DOMException('Storage full',
                    'QuotaExceededError');
                return setItem.call(this, name, value);
            };
        }, storageKey);
        await finish(page);
        await expect(page.getByRole('region', { name: 'Test results' }))
            .toContainText('Progress is in memory.');
        await expect(targetRow(page, 'w → v').getByRole('cell').nth(0))
            .toHaveText('30.0% recent errors, 500 ms recent reach');
        await expect(comparison(page).getByRole('button', {
                name: 'Start next drill',
                exact: true
            }))
            .toBeEnabled();
        const snapshot = await comparison(page).textContent();
        expect(await savedBytes(page)).toBe(firstSave);
        await page.evaluate(() => window.restorePracticeResultStorage());
        await page.getByRole('button', { name: 'Keep my progress', exact: true }).click();
        await page.getByRole('button', { name: 'Try saving again', exact: true }).click();
        await expect(page.getByText(
                'Your progress is saved on this device.', { exact: true }))
            .toBeVisible();
        await page.keyboard.press('Escape');
        expect(await comparison(page).textContent()).toBe(snapshot);
        const after = JSON.parse(await savedBytes(page));
        expect(after.history).toHaveLength(3);
        expect(after.history.at(-1)).toEqual(saved.history[0]);
        expect(after.progress).toMatchObject(saved.progress);
        expect(after.settings).toMatchObject({
            ...saved.settings,
            keyboardLayout: 'dvorak'
        });
        expect(after.futureRoot).toEqual(saved.futureRoot);
    });
