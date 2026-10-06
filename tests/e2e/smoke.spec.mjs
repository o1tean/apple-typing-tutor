import { expect, test } from '@playwright/test';

test('a fresh visitor finishes a 10-word test and history survives reload', async ({ page }) => {
    const errors = [];
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('./');
    expect(await page.evaluate(() => localStorage.getItem(
            'apple_typing_tutor_data_v1')))
        .toBeNull();
    await page.getByRole('button', { name: 'test', exact: true }).click();
    await page.getByRole('button', { name: 'words', exact: true }).click();
    await page.getByRole('button', { name: '10 words', exact: true }).click();
    await expect(page.getByRole('region', { name: '10 word test' })).toBeVisible();

    const passage = (await page.locator('.typing-text .word').allTextContents())
        .join('').replace(/\u00a0/g, ' ');
    expect(passage.trim().split(/\s+/)).toHaveLength(10);
    const input = page.getByRole('textbox', { name: 'Typing input' });
    await input.focus();
    await input.pressSequentially(passage, { delay: 10 });

    const results = page.getByRole('region', { name: 'Test results' });
    await expect(results).toBeVisible();
    await expect(results).toContainText('10 word test');
    await expect(results).toContainText('Every key in its place. No mistakes.');
    await expect(results.getByRole('status')).not.toContainText('Saving progress');

    await page.getByRole('button', { name: 'Session history' }).click();
    const history = page.getByRole('dialog', { name: 'Your recent sessions' });
    await expect(history.getByRole('row')).toHaveCount(2);
    const row = history.getByRole('row').nth(1);
    await expect(row).toContainText('10 words');
    await expect(row).toContainText('100%');
    const savedSession = await row.innerText();

    await page.reload();
    await page.getByRole('button', { name: 'Session history' }).click();
    await expect(history.getByRole('row')).toHaveCount(2);
    await expect(history.getByRole('row').nth(1)).toHaveText(
        savedSession, { useInnerText: true });
    expect(errors).toEqual([]);
});
