import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';

test.use({ timezoneId: 'Europe/Bucharest', locale: 'en-GB' });

test('saved local days show honest trends and streaks without changing progress',
    async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error') errors.push(message.text());
        });
        const session = (date, wpm = 40, accuracy = 90, extra = {}) => ({
            lessonId: 'amat-1',
            date,
            wpm,
            accuracy,
            wpmMetric: 'words-v1',
            elapsedMilliseconds: 30000,
            stars: 2,
            ...extra
        });
        const saved = {
            settings: { theme: 'dark', futureSetting: 'keep' },
            progress: { 'amat-1': { bestWpm: 95, bestAccuracy: 100, stars: 3 } },
            history: [
                session('2026-10-07T08:00:00Z', 60, 100, { futureScore: 7 }),
                session('2026-10-06T21:30:00Z'),
                session('2026-10-06T08:00:00Z', 30, 95),
                session('2026-10-04T08:00:00Z'),
                session('2026-10-04T07:00:00Z', 999, 1, { elapsedMilliseconds: 0 }),
                session('2026-10-03T08:00:00Z'),
                session('2026-10-02T08:00:00Z'),
                session('2026-09-29T08:00:00Z', 900, 5, { wpmMetric: undefined }),
                session(null, 800, 1),
                session('2026-10-08T08:00:00Z', 700, 1)
            ],
            stats: { totalSessions: 123, highestWpm: 95, futureStat: { keep: true } },
            futureData: { keep: ['unchanged'] }
        };
        const original = JSON.stringify(saved);
        await page.clock.setFixedTime(new Date('2026-10-07T09:00:00Z'));
        await page.addInitScript(({ key, value }) => {
            if (localStorage.getItem(key) === null) localStorage.setItem(key,
                value);
        }, { key: storageKey, value: original });
        await page.goto('./');
        await page.getByRole('button', { name: 'Session history', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Your recent sessions' });
        const progress = dialog.getByRole('region', { name: 'Practice progress' });
        await expect(progress).toBeVisible();
        await expect(progress).toContainText('Last 14 days');
        await expect(progress.locator('dl > div').filter({ hasText: 'Current streak' }))
            .toContainText('2 days');
        await expect(progress.locator('dl > div')
                .filter({ hasText: 'Longest saved streak' }))
            .toContainText('3 days');
        await expect(progress).toContainText('older activity may be missing');
        for (const label of ['WPM', 'Accuracy']) {
            const chart = progress.getByRole('img', {
                name: new RegExp(
                    `^${label} daily averages`)
            });
            await expect(chart.locator('path')).toHaveCount(5);
            await expect(chart.locator('polyline')).toHaveCount(3);
        }
        await expect(dialog.getByRole('row')).toHaveCount(saved.history.length + 1);
        await progress.locator('summary').filter({ hasText: 'View daily averages' })
            .click();
        const daily = progress.getByRole('table', { name: 'Daily practice · local dates' });
        const day = date => daily.getByRole('row').filter({
            has: page.locator(`time[datetime="${date}"]`)
        });
        await expect(daily.getByRole('row')).toHaveCount(15);
        await expect(day('2026-10-07').getByRole('cell')).toHaveText(['2', '50.0',
        '95.0%']);
        await expect(day('2026-10-06').getByRole('cell')).toHaveText(['1', '30.0',
        '95.0%']);
        await expect(day('2026-10-05').getByRole('cell')).toHaveText(['0', '—', '—']);
        await expect(day('2026-10-04').getByRole('cell')).toHaveText(['2', '40.0',
        '90.0%']);
        await expect(day('2026-09-29').getByRole('cell')).toHaveText(['1', '—', '—']);
        const beforeReload = await progress.innerText();
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
            original);
        await page.keyboard.press('Escape');
        await page.reload();
        await page.getByRole('button', { name: 'Session history', exact: true }).click();
        await progress.locator('summary').filter({ hasText: 'View daily averages' })
            .click();
        await expect(progress).toHaveText(beforeReload, { useInnerText: true });
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
            original);
        expect(errors).toEqual([]);
    });

test('empty history offers a first session without inventing a trend or writing storage',
    async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-10-07T09:00:00Z'));
        await page.goto('./');
        await page.getByRole('button', { name: 'Session history', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Your recent sessions' });
        await expect(dialog).toContainText('Your first session is waiting.');
        await expect(dialog.getByRole('button', { name: "Let's type" })).toBeVisible();
        await expect(dialog.getByRole('region', { name: 'Practice progress' })).toHaveCount(
            0);
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey))
            .toBeNull();
    });
