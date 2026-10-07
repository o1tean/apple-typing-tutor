import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';
const savedBytes = page => page.evaluate(key => localStorage.getItem(key), storageKey);
const passage = async page => (await page.locator('.typing-text .word').allTextContents())
    .join('').replace(/\u00a0/g, ' ');

function savedLesson(lessonId = 'pro-2', keyboardLayout = 'mac-us') {
    return {
        futureRoot: { keep: true },
        settings: {
            keyboardLayout,
            typingMode: 'strict',
            showHands: false,
            showKeyboard: false,
            soundMuted: true,
            testMode: 'words',
            testWordCount: 10,
            testDuration: 60,
            punctuation: true,
            numbers: true,
            futureSetting: ['keep']
        },
        progress: {
            [lessonId]: {
                completed: true,
                bestWpm: 35,
                bestAccuracy: 98,
                stars: 2,
                futureProgress: true
            }
        },
        history: ['words-10', 'removed-lesson', lessonId, 'amat-1'].map((id, index) => ({
            lessonId: id,
            wpm: 35,
            accuracy: 98,
            stars: 2,
            date: `2026-10-0${6 - index}T12:00:00Z`,
            futureHistory: 'keep'
        })),
        stats: { totalSessions: 4, futureStats: ['keep'] }
    };
}

async function seed(page, data) {
    await page.addInitScript(({ key, data }) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON
            .stringify(data));
    }, { key: storageKey, data });
    await page.goto('./');
}

async function completeLesson(page, mistakes = false) {
    const input = page.getByRole('textbox', { name: 'Typing input' });
    for (let line = 0; line < 4; line++) {
        const text = await passage(page);
        expect(text.length).toBeGreaterThan(0);
        await input.focus();
        if (mistakes && line === 0) {
            await input.pressSequentially((text[0] === 'q' ? 'z' : 'q').repeat(30));
        }
        await input.pressSequentially(text, { delay: 2 });
    }
    const results = page.getByRole('region', { name: 'Test results' });
    await expect(results).toBeVisible();
    await expect(results.getByRole('status')).not.toContainText('Saving progress');
    return results;
}

for (const [layout, keys] of [
    ['mac-us', 'jkl;'], ['colemak', 'neio'], ['dvorak', 'htns'], ['uk-iso', 'jkl;']
]) {
    test(`${layout} continues the latest retained lesson offline without changing preferences`,
        async ({ page, context }) => {
            const saved = savedLesson('pro-2', layout);
            await seed(page, saved);
            await expect(page.getByRole('region', { name: '10 word test' })).toBeVisible();
            const returning = page.locator('[aria-label="Return to learning"]');
            await expect(returning).toContainText('Lesson 2: Right Hand Home');
            await expect(returning).toContainText(
                'Start a fresh drill from your latest recorded lesson.');
            await expect(page.getByText('Available offline', { exact: true }))
                .toBeVisible();
            await page.reload();
            await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller
                ?.state)).toBe('activated');
            await context.setOffline(true);
            await page.reload();
            await returning.getByRole('button', { name: 'Continue lesson', exact: true })
                .click();
            await expect(page.getByRole('region', {
                name: 'Lesson 2: Right Hand Home',
                exact: true
            })).toBeVisible();
            expect(Array.from(await passage(page)).every(key => `${keys} `.includes(key)))
                .toBe(true);
            await expect(page.getByRole('textbox', { name: 'Typing input' })).toBeFocused();
            await expect(page.locator('.hands-container')).toBeHidden();
            await expect(page.locator('.keyboard-container')).toBeHidden();
            expect(await savedBytes(page)).toBe(JSON.stringify(saved));
            await page.getByRole('button', { name: 'Skip to test', exact: true }).click();
            await expect(page.getByRole('region', { name: '10 word test' })).toBeVisible();
            for (const option of ['punctuation', 'numbers']) {
                await expect(page.getByRole('button', { name: option, exact: true }))
                    .toHaveAttribute('aria-pressed', 'true');
            }
            expect(await savedBytes(page)).toBe(JSON.stringify(saved));
        });
}

test('dated progress resumes a lesson after tests have filled retained history',
    async ({ page }) => {
        const saved = savedLesson();
        saved.history = Array.from({ length: 50 }, () => ({ ...saved.history[0] }));
        saved.progress = {
            'amat-3': {
                completed: true,
                lastPlayed: Date.parse(
                    '2026-10-02T12:00:00Z')
            },
            'words-v1:pro-2': {
                ...saved.progress['pro-2'],
                lastPlayed: Date.parse('2026-10-04T12:00:00Z')
            },
            'words-v1:amat-10': {
                completed: false,
                lastPlayed: Date.parse(
                    '2026-10-05T12:00:00Z')
            },
            'removed-lesson': {
                completed: true,
                lastPlayed: Date.parse(
                    '2026-10-06T12:00:00Z')
            }
        };
        await seed(page, saved);
        await expect(page.getByRole('region', { name: '10 word test' })).toBeVisible();
        await expect(page.locator('[aria-label="Return to learning"]'))
            .toContainText('Lesson 2: Right Hand Home');
        await page.getByRole('button', { name: 'Continue lesson', exact: true }).click();
        await expect(page.getByRole('region', {
            name: 'Lesson 2: Right Hand Home',
            exact: true
        })).toBeVisible();
        expect(await savedBytes(page)).toBe(JSON.stringify(saved));
        await page.reload();
        await expect(page.getByRole('button', { name: 'Continue lesson', exact: true }))
            .toBeVisible();
        expect(await savedBytes(page)).toBe(JSON.stringify(saved));
    });

test('suggested key practice explains recent observations and preserves saved data',
    async ({ page }) => {
        const saved = savedLesson();
        saved.learning = {
            version: 1,
            futureLearning: true,
            keys: {
                q: {
                    attempts: 40,
                    errors: 36,
                    latencySamples: 40,
                    latencyTotalMs: 36000,
                    recentErrorRate: 0.8,
                    recentLatencyMs: 800,
                    futureKey: ['keep']
                },
                w: {
                    attempts: 40,
                    errors: 0,
                    latencySamples: 40,
                    latencyTotalMs: 8000,
                    recentErrorRate: 0,
                    recentLatencyMs: 200
                }
            },
            bigrams: {}
        };
        await seed(page, saved);
        await page.getByText('Suggested key practice', { exact: true }).click();
        const recommendation = page.locator('[aria-label="Learning recommendation"]');
        await expect(recommendation).toContainText('q');
        await expect(recommendation).toContainText('80.0%');
        await expect(recommendation).toContainText('800 ms');
        await expect(recommendation).toContainText('across layouts');
        await expect(recommendation).not.toContainText('90.0%');
        await page.getByRole('button', { name: 'Practice weak keys', exact: true }).click();
        const focus = page.getByRole('list', { name: 'Focus keys' });
        await expect(focus.getByText('q', { exact: true })).toBeVisible();
        await expect(focus.getByText('w', { exact: true })).toHaveCount(0);
        expect(await savedBytes(page)).toBe(JSON.stringify(saved));
    });

test('missing, sparse and newer observations get honest recommendation states',
    async ({ browser, baseURL }) => {
        for (const learning of [undefined, {
                version: 1,
                keys: {
                    q: {
                        attempts: 1,
                        errors: 1,
                        latencySamples: 0,
                        latencyTotalMs: 0,
                        recentErrorRate: 1,
                        recentLatencyMs: 0
                    }
                },
                bigrams: {}
        }, { version: 2, futureProfile: ['keep'] }]) {
            const context = await browser.newContext({ baseURL });
            const page = await context.newPage();
            const saved = { ...savedLesson(), history: [], learning };
            await seed(page, saved);
            await expect(page.getByRole('button', { name: 'Continue lesson', exact: true }))
                .toHaveCount(0);
            await page.getByText('Suggested key practice', { exact: true }).click();
            const recommendation = page.locator('[aria-label="Learning recommendation"]');
            if (learning?.version === 1) {
                await expect(recommendation).toContainText(
                    'few observations');
                await expect(recommendation).not.toContainText('0 ms');
            } else {
                await expect(recommendation).toContainText(learning ?
                    /newer|unavailable|compatible/i :
                    'No key recommendation yet. Complete a lesson or test to gather more observations.'
                );
                await expect(page.getByRole('button', {
                    name: 'Practice weak keys',
                    exact: true
                })).toHaveCount(0);
            }
            expect(await savedBytes(page)).toBe(JSON.stringify(saved));
            await context.close();
        }
    });

test('a completed lesson highlights its next lesson and retains retry and saved preferences',
    async ({ page }) => {
        const saved = savedLesson();
        await seed(page, saved);
        await page.getByRole('button', { name: 'Continue lesson', exact: true }).click();
        const results = await completeLesson(page);
        const primary = results.locator('.primary-button');
        await expect(primary).toHaveCount(1);
        await expect(primary).toHaveText('Next lesson');
        await expect(primary).toBeFocused();
        await expect(results.getByRole('button', { name: 'Try again', exact: true }))
            .toBeVisible();
        const stored = JSON.parse(await savedBytes(page));
        expect(stored.history[0].lessonId).toBe('pro-2');
        expect(stored.history.slice(1)).toEqual(saved.history);
        expect(stored.settings).toMatchObject(saved.settings);
        expect(stored.progress['pro-2']).toEqual(saved.progress['pro-2']);
        expect(stored.futureRoot).toEqual(saved.futureRoot);
        expect(stored.stats.futureStats).toEqual(saved.stats.futureStats);
        const beforeNext = await savedBytes(page);
        await page.keyboard.press('Enter');
        await expect(page.getByRole('region', {
            name: 'Lesson 3: Home Row Synthesis',
            exact: true
        })).toBeVisible();
        expect(await savedBytes(page)).toBe(beforeNext);
    });

test('a lesson below its accuracy target recommends retry while keeping next lesson available',
    async ({ page }) => {
        await page.goto('./');
        const results = await completeLesson(page, true);
        await expect(results.locator('.primary-button')).toHaveText('Try again');
        await expect(results.locator('.primary-button')).toBeFocused();
        await expect(results.getByRole('button', { name: 'Next lesson', exact: true }))
            .toBeVisible();
        await results.getByRole('button', { name: 'Try again', exact: true }).click();
        await expect(page.getByRole('region', {
            name: 'Lesson 1: Left Hand Home',
            exact: true
        })).toBeVisible();
    });

test('finishing either curriculum offers a clear lesson choice', async ({ browser, baseURL }) => {
    for (const lessonId of ['amat-11', 'pro-10']) {
        const context = await browser.newContext({ baseURL });
        const page = await context.newPage();
        await seed(page, savedLesson(lessonId));
        await page.getByRole('button', { name: 'Continue lesson', exact: true })
            .click();
        const results = await completeLesson(page);
        const primary = results.locator('.primary-button');
        await expect(primary).toHaveText('Choose a lesson');
        await primary.click();
        await expect(page.getByRole('dialog', { name: 'Build your muscle memory' }))
            .toBeVisible();
        await context.close();
    }
});
