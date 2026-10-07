import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';
const savedBytes = page => page.evaluate(key => localStorage.getItem(key), storageKey);
const passage = async page => (await page.locator('.typing-text .word').allTextContents())
    .join('').replace(/\u00a0/g, ' ');

function savedPairs(keyboardLayout = 'mac-us') {
    return {
        futureRoot: { keep: true },
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
        progress: {
            'amat-1': {
                completed: true,
                bestWpm: 35,
                bestAccuracy: 98,
                stars: 2,
                futureProgress: ['keep']
            }
        },
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
            keys: {
                q: {
                    attempts: 40,
                    errors: 36,
                    latencySamples: 40,
                    latencyTotalMs: 36000,
                    recentErrorRate: 0.8,
                    recentLatencyMs: 900
                }
            },
            bigrams: {
                qz: {
                    attempts: 40,
                    errors: 36,
                    latencySamples: 40,
                    latencyTotalMs: 36000,
                    recentErrorRate: 0.8,
                    recentLatencyMs: 900,
                    futurePair: ['keep']
                },
                wv: {
                    attempts: 40,
                    errors: 12,
                    latencySamples: 40,
                    latencyTotalMs: 20000,
                    recentErrorRate: 0.3,
                    recentLatencyMs: 500
                }
            }
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

test('recent pair evidence produces a fresh drill and clean practice rotates its focus',
    async ({ page }) => {
        const saved = savedPairs();
        await seed(page, saved);
        await expect(page.getByRole('button', {
                name: 'Practice this pair: q → z',
                exact: true
            }))
            .toBeVisible();
        await page.getByText('Suggested pair practice', { exact: true }).click();
        const recommendation = page.getByRole('region', { name: 'Pair recommendation' });
        await expect(recommendation).toContainText('q → z');
        await expect(recommendation).toContainText('80.0%');
        await expect(recommendation).toContainText('900 ms');
        await expect(recommendation).toContainText('across layouts');
        await expect(recommendation).not.toContainText('90.0%');
        await expect(page.getByRole('button', { name: 'Continue lesson', exact: true }))
            .toBeVisible();
        await expect(page.getByRole('button', { name: 'Practice weak keys', exact: true }))
            .toBeVisible();
        await page.getByRole('button', { name: /^Practice this pair/ }).click();
        const arena = page.getByRole('region', { name: 'Pair practice', exact: true });
        const focus = page.getByRole('list', { name: 'Focus pair' });
        await expect(arena).toBeVisible();
        await expect(focus).toHaveText('q → z');
        const input = page.getByRole('textbox', { name: 'Typing input' });
        await input.pressSequentially((await passage(page)).slice(0, 2));
        await page.getByRole('button', { name: 'Restart test', exact: true }).click();
        await expect(page.locator('.typing-text .char.correct')).toHaveCount(0);
        await expect(focus).toHaveText('q → z');
        expect(await savedBytes(page)).toBe(JSON.stringify(saved));
        const lines = [];
        for (let line = 0; line < 2; line++) {
            const text = await passage(page);
            expect(text).toMatch(/^[qz ]+$/);
            lines.push(text);
            await input.focus();
            await input.pressSequentially(text, { delay: 5 });
        }
        const occurrences = lines.join('').match(/qz/g).length;
        expect(occurrences).toBeGreaterThanOrEqual(20);
        const results = page.getByRole('region', { name: 'Test results' });
        await expect(results).toBeVisible();
        await expect(results.getByRole('status')).not.toContainText('Saving progress');
        const after = JSON.parse(await savedBytes(page));
        expect(after.history[0]).toMatchObject({
            lessonId: 'weak-pairs',
            wpmMetric: 'words-v1',
            recordEligible: false
        });
        expect(after.history[0].learning.bigrams.qz.attempts).toBe(occurrences);
        expect(after.history.slice(1)).toEqual(saved.history);
        expect(after.learning.bigrams.qz).toMatchObject({
            attempts: 40 + occurrences,
            errors: 36,
            recentErrorRate: 0,
            futurePair: ['keep']
        });
        expect(after.learning.bigrams.qz.recentLatencyMs).toBeLessThan(500);
        expect(after.learning.bigrams.wv).toEqual(saved.learning.bigrams.wv);
        expect(after.learning.futureLearning).toEqual(saved.learning.futureLearning);
        expect(after.settings).toMatchObject(saved.settings);
        expect(after.progress).toEqual(saved.progress);
        expect(after.futureRoot).toEqual(saved.futureRoot);
        expect(after.stats.futureStats).toEqual(saved.stats.futureStats);
        const stored = await savedBytes(page);
        await results.getByRole('button', { name: 'Try again', exact: true }).click();
        await expect(arena).toBeVisible();
        await expect(focus).toHaveText('w → v');
        expect(await savedBytes(page)).toBe(stored);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('combobox', { name: 'Keyboard layout', exact: true })
            .selectOption('dvorak');
        await page.keyboard.press('Escape');
        await expect(arena).toBeVisible();
        await expect(focus).toHaveText('w → v');
        const layoutBytes = await savedBytes(page);
        const changedLayout = JSON.parse(layoutBytes);
        expect(changedLayout.settings).toMatchObject({
            ...saved.settings,
            keyboardLayout: 'dvorak'
        });
        for (const field of ['learning', 'history', 'progress', 'futureRoot']) {
            expect(changedLayout[field]).toEqual(after[field]);
        }
        await page.reload();
        await page.getByText('Suggested pair practice', { exact: true }).click();
        await expect(recommendation).toContainText('w → v');
        expect(await savedBytes(page)).toBe(layoutBytes);
    });

for (const [layout, targets] of [
    ['mac-us', [['q', 'KeyQ', 'left-pinky', 'upper'], ['z', 'KeyZ', 'left-pinky', 'lower']]],
    ['colemak', [['q', 'KeyQ', 'left-pinky', 'upper'], ['z', 'KeyZ', 'left-pinky', 'lower']]],
    ['dvorak', [['q', 'KeyX', 'left-ring', 'lower'], ['z', 'Slash', 'right-pinky', 'lower']]],
    ['uk-iso', [['q', 'KeyQ', 'left-pinky', 'upper'], ['z', 'KeyZ', 'left-pinky', 'lower']]]
]) {
    test(`${layout} practices the pair offline with matching guidance and preserved preferences`,
        async ({ page, context }) => {
            const saved = savedPairs(layout);
            await seed(page, saved);
            await expect(page.getByText('Available offline', { exact: true }))
                .toBeVisible();
            await page.reload();
            await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller
                ?.state)).toBe('activated');
            await context.setOffline(true);
            await page.reload();
            await page.getByRole('button', { name: /^Practice this pair/ }).click();
            await expect(page.getByRole('region', { name: 'Pair practice', exact: true }))
                .toBeVisible();
            await expect(page.getByRole('list', { name: 'Focus pair' })).toHaveText(
                'q → z');
            await expect(page.getByRole('textbox', { name: 'Typing input' })).toBeFocused();
            const session = await context.newCDPSession(page);
            for (const [key, code, finger, row] of targets) {
                await expect(page.locator(`[data-code="${code}"]`)).toHaveClass(
                    /key-target/);
                await expect(page.locator(`#finger-${finger}`)).toHaveAttribute(
                    'data-reach-row',
                    row);
                await session.send('Input.dispatchKeyEvent', {
                    type: 'keyDown',
                    key,
                    code,
                    text: key
                });
                await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
            }
            await expect(page.locator('.typing-text .char.correct')).toHaveCount(2);
            expect(await savedBytes(page)).toBe(JSON.stringify(saved));
            await page.getByRole('button', { name: 'Typeflow home', exact: true }).click();
            await expect(page.getByRole('region', { name: '10 word test' })).toBeVisible();
            for (const option of ['punctuation', 'numbers']) {
                await expect(page.getByRole('button', { name: option, exact: true }))
                    .toHaveAttribute('aria-pressed', 'true');
            }
            expect(await savedBytes(page)).toBe(JSON.stringify(saved));
        });
}

test('pair recommendations distinguish missing, sparse, unsupported and all-space evidence',
    async ({ browser, baseURL }) => {
        for (const learning of [undefined, {
                version: 1,
                keys: {},
                bigrams: {
                    ' q': {
                        attempts: 1,
                        errors: 1,
                        latencySamples: 0,
                        latencyTotalMs: 0,
                        recentErrorRate: 1,
                        recentLatencyMs: 0
                    }
                }
        }, { version: 2, futureProfile: ['keep'] }, {
                version: 1,
                keys: {},
                bigrams: {
                    '  ': {
                        attempts: 20,
                        errors: 20,
                        latencySamples: 0,
                        latencyTotalMs: 0,
                        recentErrorRate: 1,
                        recentLatencyMs: 0
                    }
                }
        }]) {
            const context = await browser.newContext({ baseURL });
            const page = await context.newPage();
            const saved = { ...savedPairs(), learning };
            await seed(page, saved);
            await page.getByText('Suggested pair practice', { exact: true }).click();
            const recommendation = page.getByRole(
                'region', { name: 'Pair recommendation' });
            if (learning?.bigrams?.[' q']) {
                await expect(recommendation).toContainText('Space → q');
                await expect(recommendation).toContainText(
                    'Early suggestion — only a few observations so far.');
                await expect(recommendation).toContainText('no reach timing yet');
                await expect(recommendation).not.toContainText('0 ms');
                await page.getByRole('button', { name: /^Practice this pair/ }).click();
                await expect(page.getByRole('list', { name: 'Focus pair' }))
                    .toHaveText('Space → q');
                expect((await passage(page)).trim()).toMatch(/^q(?: q)+$/);
            } else {
                await expect(recommendation).toContainText(learning?.version > 1 ?
                    /newer|unavailable|compatible/i :
                    'No pair recommendation yet. Complete a lesson or test to gather more observations.'
                );
                await expect(page.getByRole('button', {
                    name: /^Practice this pair/
                })).toHaveCount(0);
            }
            expect(await savedBytes(page)).toBe(JSON.stringify(saved));
            await context.close();
        }
    });
