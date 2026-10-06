import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';

test('a corrected typo teaches through the key map and persists across reload',
    async ({ page }) => {
        const saved = {
            settings: {
                typingMode: 'strict',
                showHands: false,
                showKeyboard: false,
                soundMuted: true,
                testMode: 'words',
                testWordCount: 10
            },
            progress: {
                'amat-1': { completed: true, bestWpm: 30, bestAccuracy: 98, stars: 2 }
            },
            history: [{
                lessonId: 'quote-0',
                wpm: 40,
                accuracy: 99,
                stars: 2,
                date: '2026-10-06T00:00:00.000Z'
        }],
            stats: { totalSessions: 1, totalKeystrokes: 80, totalTimeSeconds: 12 }
        };
        await page.addInitScript(({ key, data }) => {
            if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON
                .stringify(data));
        }, { key: storageKey, data: saved });
        await page.goto('./');
        await page.getByRole('button', { name: 'custom', exact: true }).click();
        await page.getByRole('textbox', { name: 'Text to practice', exact: true }).fill(
            'ab ba');
        await page.getByRole('button', { name: 'Start practice', exact: true }).click();
        const input = page.getByRole('textbox', { name: 'Typing input' });
        await input.pressSequentially('ax', { delay: 20 });
        await expect(page.getByText('Expected “b”; typed “x”. Try again.', { exact: true }))
            .toBeVisible();
        await input.pressSequentially('b ba', { delay: 20 });

        const results = page.getByRole('region', { name: 'Test results' });
        await expect(results).toBeVisible();
        await expect(results.getByRole('status')).not.toContainText('Saving progress');
        const heatmap = results.getByRole('region', { name: 'Target-key heatmap' });
        await expect(heatmap).toBeVisible();
        await expect(heatmap.locator('[data-code="KeyB"]'))
            .toHaveAttribute('title', /1 error.*3 attempts/i);
        await heatmap.getByText('View key and pair details', { exact: true }).click();
        const keyRow = heatmap.getByRole('row').filter({
            has: page.getByRole('cell', { name: 'b', exact: true })
        });
        await expect(keyRow.getByRole('cell').nth(1)).toHaveText('3');
        await expect(keyRow.getByRole('cell').nth(2)).toHaveText('1');
        const pairRow = heatmap.getByRole('row').filter({
            has: page.getByRole('cell', { name: 'ab', exact: true })
        });
        await expect(pairRow.getByRole('cell').nth(1)).toHaveText('2');
        await expect(pairRow.getByRole('cell').nth(2)).toHaveText('1');

        const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)),
            storageKey);
        expect(stored.learning.version).toBe(1);
        expect(stored.learning.keys.b.attempts).toBe(3);
        expect(stored.learning.keys.b.errors).toBe(1);
        expect(stored.learning.bigrams.ab.attempts).toBe(2);
        expect(stored.learning.bigrams.ab.errors).toBe(1);
        expect(stored.learning.keys.b.latencySamples).toBeGreaterThan(0);
        expect(stored.learning.keys.b.latencyTotalMs).toBeGreaterThan(0);
        expect(stored.history[0].learning.keys.b.errors).toBe(1);
        expect(stored.history[1]).toEqual(saved.history[0]);
        expect(stored.progress['amat-1']).toEqual(saved.progress['amat-1']);
        expect(stored.settings.showHands).toBe(false);
        expect(stored.settings.showKeyboard).toBe(false);

        await page.reload();
        await expect(page.getByRole('region', { name: '10 word test' })).toBeVisible();
        const reloaded = await page.evaluate(key => JSON.parse(localStorage.getItem(key)),
            storageKey);
        expect(reloaded.learning).toEqual(stored.learning);
        expect(reloaded.history).toEqual(stored.history);
        expect(reloaded.progress).toEqual(stored.progress);
    });

test('clean weak-key practice rotates its focus across sessions', async ({ page }) => {
    const saved = {
        settings: {
            typingMode: 'strict',
            showHands: true,
            showKeyboard: true,
            soundMuted: true,
            testMode: 'words',
            testWordCount: 10
        },
        progress: {
            'amat-1': {
                completed: true,
                bestWpm: 30,
                bestAccuracy: 98,
                stars: 2
            }
        },
        history: [],
        learning: {
            version: 1,
            keys: {
                q: {
                    attempts: 40,
                    errors: 36,
                    latencySamples: 40,
                    latencyTotalMs: 36000,
                    recentErrorRate: 0.9,
                    recentLatencyMs: 900
                },
                w: {
                    attempts: 40,
                    errors: 12,
                    latencySamples: 40,
                    latencyTotalMs: 20000,
                    recentErrorRate: 0.3,
                    recentLatencyMs: 500
                }
            },
            bigrams: {}
        }
    };
    await page.addInitScript(({ key, data }) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON
            .stringify(data));
    }, { key: storageKey, data: saved });
    await page.goto('./');
    await page.getByRole('button', { name: 'Practice weak keys', exact: true }).click();
    const arena = page.getByRole('region', { name: 'Weak-key practice', exact: true });
    await expect(arena).toBeVisible();
    const focus = arena.getByRole('list', { name: 'Focus keys' });
    await expect(focus.getByText('q', { exact: true })).toBeVisible();
    await expect(focus.getByText('w', { exact: true })).toHaveCount(0);
    const input = page.getByRole('textbox', { name: 'Typing input' });
    const passages = [];
    for (let line = 0; line < 4; line++) {
        const passage = (await page.locator('.typing-text .word').allTextContents())
            .join('').replace(/\u00a0/g, ' ');
        expect(passage.length).toBeGreaterThan(0);
        passages.push(passage);
        await input.focus();
        await input.pressSequentially(passage, { delay: 10 });
    }
    const text = passages.join('');
    const focusedCharacters = Array.from(text).filter(key => key === 'q').length;
    expect(focusedCharacters / text.length).toBeGreaterThanOrEqual(1 / 3);
    expect(focusedCharacters).toBeGreaterThanOrEqual(21);
    const results = page.getByRole('region', { name: 'Test results' });
    await expect(results).toBeVisible();
    await expect(results.getByRole('status')).not.toContainText('Saving progress');
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)),
        storageKey);
    expect(stored.learning.keys.q.attempts).toBe(40 + focusedCharacters);
    expect(stored.learning.keys.q.errors).toBe(36);
    expect(stored.learning.keys.q.recentErrorRate).toBe(0);
    expect(stored.learning.keys.q.recentLatencyMs).toBeLessThan(500);
    expect(stored.progress['amat-1']).toEqual(saved.progress['amat-1']);

    await page.reload();
    const reloaded = await page.evaluate(key => JSON.parse(localStorage.getItem(key)),
        storageKey);
    expect(reloaded.learning).toEqual(stored.learning);
    await page.getByRole('button', { name: 'Practice weak keys', exact: true }).click();
    await expect(arena).toBeVisible();
    await expect(focus.getByText('w', { exact: true })).toBeVisible();
    await expect(focus.getByText('q', { exact: true })).toHaveCount(0);
});

test('Try again generates a fresh lesson while retaining its saved identity and settings',
    async ({ page }) => {
        await page.goto('./');
        const lesson = page.getByRole('region', {
            name: 'Lesson 1: Left Hand Home',
            exact: true
        });
        await expect(lesson).toBeVisible();
        const passages = [];
        const input = page.getByRole('textbox', { name: 'Typing input' });
        for (let line = 0; line < 4; line++) {
            const passage = (await page.locator('.typing-text .word').allTextContents())
                .join('').replace(/\u00a0/g, ' ');
            expect(passage).toMatch(/^[asdf ]+$/);
            passages.push(passage);
            await input.pressSequentially(passage, { delay: 10 });
        }
        const results = page.getByRole('region', { name: 'Test results' });
        await expect(results).toBeVisible();
        await expect(results.getByRole('status')).not.toContainText('Saving progress');
        const storedRaw = await page.evaluate(key => localStorage.getItem(key), storageKey);
        const stored = JSON.parse(storedRaw);
        expect(stored.history[0].lessonId).toBe('amat-1');
        expect(stored.progress['words-v1:amat-1'].completed).toBe(true);
        expect(stored.settings.typingMode).toBe('strict');
        expect(stored.settings.showHands).toBe(true);
        expect(stored.settings.showKeyboard).toBe(true);
        await results.getByRole('button', { name: 'Try again', exact: true }).click();
        await expect(lesson).toBeVisible();
        const retry = (await page.locator('.typing-text .word').allTextContents())
            .join('').replace(/\u00a0/g, ' ');
        expect(retry).toMatch(/^[asdf ]+$/);
        expect(retry).not.toBe(passages[0]);
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
            storedRaw);
    });
