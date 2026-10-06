import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';

async function tabTo(page, target, key = 'Tab') {
    for (let count = 0; count < 60; count++) {
        if (await target.evaluate(element => element === document.activeElement)) return;
        await page.keyboard.press(key);
    }
    await expect(target).toBeFocused();
}

test('a fresh visitor completes, shares and revisits a test with only the keyboard',
    async ({ page }) => {
        await page.goto('./');
        await expect(page.getByRole('region', {
                name: 'Lesson 1: Left Hand Home',
                exact: true
            }))
            .toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Typing input' })).toBeFocused();
        await expect(page.locator('.hands-container')).toBeVisible();
        await expect(page.locator('.keyboard-container')).toBeVisible();
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey))
            .toBeNull();

        await tabTo(page, page.getByRole('button', { name: 'Skip to test', exact: true }),
            'Shift+Tab');
        await page.keyboard.press('Enter');
        await tabTo(page, page.getByRole('button', { name: 'words', exact: true }),
            'Shift+Tab');
        await page.keyboard.press('Enter');
        await tabTo(page, page.getByRole('button', { name: '10 words', exact: true }),
            'Shift+Tab');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('region', { name: '10 word test', exact: true }))
            .toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Typing input' })).toBeFocused();
        const passage = (await page.locator('.typing-text .word').allTextContents())
            .join('').replace(/\u00a0/g, ' ');
        expect(passage.trim().split(/\s+/)).toHaveLength(10);
        await page.keyboard.type(passage, { delay: 10 });

        const results = page.getByRole('region', { name: 'Test results' });
        await expect(results).toBeVisible();
        await expect(results).toContainText('Every key in its place. No mistakes.');
        await expect(results.getByRole('status')).not.toContainText('Saving progress');
        const heatmap = results.getByRole('region', { name: 'Target-key heatmap' });
        const details = heatmap.locator('summary')
            .filter({ hasText: 'View key and pair details' });
        await tabTo(page, details, 'Shift+Tab');
        await page.keyboard.press('Space');
        await expect(heatmap.getByRole('table', { name: /Target keys/ })).toBeVisible();
        await page.keyboard.press('Enter');
        await expect(heatmap.getByRole('table', { name: /Target keys/ })).toBeHidden();
        await page.keyboard.press('Enter');
        await expect(heatmap.getByRole('table', { name: /Target keys/ })).toBeVisible();
        await tabTo(page, results.getByRole('button', {
            name: 'Download result card',
            exact: true
        }));
        const downloadPromise = page.waitForEvent('download');
        await page.keyboard.press('Enter');
        const download = await downloadPromise;
        expect(await download.failure()).toBeNull();
        await expect(results.getByText('Result card downloaded.', { exact: true }))
            .toBeVisible();

        const beforeHistory = await page.evaluate(key => localStorage.getItem(key),
            storageKey);
        const saved = JSON.parse(beforeHistory);
        expect(saved.history).toHaveLength(1);
        expect(saved.settings.typingMode).toBe('strict');
        expect(saved.settings.showHands).toBe(true);
        expect(saved.settings.showKeyboard).toBe(true);
        await tabTo(page, page.getByRole('button', {
            name: 'Session history',
            exact: true
        }));
        await page.keyboard.press('Enter');
        const history = page.getByRole('dialog', { name: 'Your recent sessions' });
        await expect(history).toBeVisible();
        await expect(history.getByRole('row')).toHaveCount(2);
        const savedRow = await history.getByRole('row').nth(1).innerText();
        await expect(history.getByRole('row').nth(1)).toContainText('10 words');
        await expect(history.getByRole('row').nth(1)).toContainText('100%');
        await page.keyboard.press('Escape');
        await expect(history).toBeHidden();
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
            beforeHistory);

        await page.reload();
        await expect(page.getByRole('region', { name: '10 word test', exact: true }))
            .toBeVisible();
        await tabTo(page, page.getByRole('button', {
            name: 'Session history',
            exact: true
        }), 'Shift+Tab');
        await page.keyboard.press('Enter');
        await expect(history.getByRole('row')).toHaveCount(2);
        await expect(history.getByRole('row').nth(1)).toHaveText(
            savedRow, { useInnerText: true });
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
            beforeHistory);
    });
