import { expect, test } from '@playwright/test';
import { CURRICULUM } from '../../js/lessons.js';

const storageKey = 'apple_typing_tutor_data_v1';

test('a guided quote keeps its source identity and existing history after reload',
    async ({ page }) => {
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
        await page.getByRole('button', { name: 'quote', exact: true }).click();

        const passage = (await page.locator('.typing-text .word').allTextContents())
            .join('').replace(/\u00a0/g, ' ');
        const quote = CURRICULUM.quotes.find(item => item.text === passage);
        expect(quote).toBeDefined();
        const arena = page.getByRole('region', {
            name: `quote · ${quote.author}`,
            exact: true
        });
        await expect(arena).toContainText(`${quote.author} · Public-domain quotation`);
        await expect(arena.getByRole('link', { name: 'Read the source', exact: true }))
            .toHaveAttribute('href', quote.source);

        const input = page.getByRole('textbox', { name: 'Typing input' });
        await input.focus();
        await input.pressSequentially(passage, { delay: 10 });
        const results = page.getByRole('region', { name: 'Test results' });
        await expect(results).toBeVisible();
        await expect(results).toContainText('Every key in its place. No mistakes.');
        await expect(results.getByRole('status')).not.toContainText('Saving progress');
        const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)),
            storageKey);
        expect(stored.history[0].lessonId).toBe(`quote-${quote.id}`);
        expect(stored.history[1]).toEqual(saved.history[0]);
        expect(stored.progress['amat-1']).toEqual(saved.progress['amat-1']);

        await page.getByRole('button', { name: 'Session history' }).click();
        const history = page.getByRole('dialog', { name: 'Your recent sessions' });
        await expect(history.getByRole('row')).toHaveCount(3);
        await expect(history.getByRole('row').nth(1)).toContainText(
            `Quote · ${quote.author}`);
        await expect(history.getByRole('row').nth(2)).toContainText(
            'Quote · legacy selection');
        const savedSession = await history.getByRole('row').nth(1).innerText();

        await page.reload();
        await page.getByRole('button', { name: 'Session history' }).click();
        await expect(history.getByRole('row')).toHaveCount(3);
        await expect(history.getByRole('row').nth(1)).toHaveText(
            savedSession, { useInnerText: true });
        await expect(history.getByRole('row').nth(2)).toContainText(
            'Quote · legacy selection');
    });
