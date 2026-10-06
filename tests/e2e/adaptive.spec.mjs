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
