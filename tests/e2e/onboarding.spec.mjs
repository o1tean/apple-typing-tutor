import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';

test('a first visit starts lesson 1 with working finger and keyboard guides', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('region', { name: 'Lesson 1: Left Hand Home' }))
        .toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip to test', exact: true }))
        .toBeVisible();
    await expect(page.locator('.hands-container')).toBeVisible();
    await expect(page.locator('.keyboard-container')).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey))
        .toBeNull();

    const input = page.getByRole('textbox', { name: 'Typing input' });
    await expect(input).toBeFocused();
    const firstKeys = (await page.locator('.typing-text .word').allTextContents())
        .join('').replace(/\u00a0/g, ' ').slice(0, 3);
    const fingers = { a: 'pinky', s: 'ring', d: 'middle', f: 'index', ' ': 'thumb' };
    for (const [index, key] of Array.from(firstKeys).entries()) {
        expect(fingers[key]).toBeDefined();
        const code = key === ' ' ? 'Space' : `Key${key.toUpperCase()}`;
        await expect(page.locator(`[data-code="${code}"]`)).toHaveClass(/key-target/);
        await expect(page.locator(`#finger-left-${fingers[key]}`)).toHaveClass(
            /active/);
        await input.pressSequentially(key);
        await expect(page.locator('.typing-text .char.correct')).toHaveCount(index + 1);
    }

    await page.getByRole('button', { name: 'Skip to test', exact: true }).click();
    await page.getByRole('button', { name: 'words', exact: true }).click();
    await page.getByRole('button', { name: '10 words', exact: true }).click();
    await expect(page.getByRole('region', { name: '10 word test' })).toBeVisible();
    const firstWord = (await page.locator('.typing-text .word').first().textContent())
        .replace(/\u00a0/g, ' ');
    await input.pressSequentially(firstWord);
    await expect(page.locator('.typing-text .char.correct')).toHaveCount(firstWord
        .length);
});

test('a returning visitor keeps saved settings and their test startup', async ({ page }) => {
    const saved = {
        settings: {
            theme: 'light',
            soundProfile: 'thock',
            volume: 0.25,
            soundMuted: true,
            typingMode: 'flow',
            showHands: false,
            showKeyboard: false,
            testMode: 'words',
            testDuration: 60,
            testWordCount: 10,
            punctuation: true,
            numbers: false
        },
        progress: {
            'amat-1': { completed: true, bestWpm: 30, bestAccuracy: 98, stars: 2 }
        },
        history: [],
        stats: {
            totalSessions: 1,
            totalKeystrokes: 80,
            totalTimeSeconds: 12,
            highestWpm: 30,
            wordHighestWpm: 0
        }
    };
    await page.addInitScript(({ key, data }) => {
        localStorage.setItem(key, JSON.stringify(data));
    }, { key: storageKey, data: saved });
    await page.goto('./');
    await expect(page.getByRole('region', { name: '10 word test' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip to test', exact: true }))
        .toHaveCount(0);
    await expect(page.locator('.hands-container')).toBeHidden();
    await expect(page.locator('.keyboard-container')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'punctuation', exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Show keyboard', exact: true }))
        .not.toBeChecked();
    await expect(page.getByRole('checkbox', {
            name: 'Show finger guidance',
            exact: true
        }))
        .not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Free flow', exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)),
            storageKey))
        .toEqual(saved);
});

test('unread storage is not mistaken for an empty first visit', async ({ page }) => {
    await page.addInitScript(key => {
        const getItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function(name) {
            if (name === key) throw new DOMException('Storage unavailable',
                'SecurityError');
            return getItem.call(this, name);
        };
    }, storageKey);
    await page.goto('./');
    await expect(page.getByRole('region', { name: '30 second test' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip to test', exact: true }))
        .toHaveCount(0);
    await expect(page.locator('.hands-container')).toBeHidden();
    await expect(page.locator('.keyboard-container')).toBeHidden();
    await expect(page.getByText('storage unavailable · session only', { exact: true }))
        .toBeVisible();
});

test.describe('touch first visit', () => {
    test.use({ hasTouch: true, viewport: { width: 375, height: 812 } });

    test('explains physical-keyboard guidance while leaving typing and test available',
        async ({ page }) => {
            await page.goto('./');
            await expect(page.getByText(/Best with a physical keyboard\./))
                .toBeVisible();
            await expect(page.getByRole(
                    'region', { name: 'Lesson 1: Left Hand Home' }))
                .toBeVisible();
            const input = page.getByRole('textbox', { name: 'Typing input' });
            await page.getByRole('button', {
                name: 'Try this lesson',
                exact: true
            }).tap();
            await expect(input).toBeFocused();
            const firstKey = (await page.locator('.typing-text .word').first()
                    .textContent())
                .replace(/\u00a0/g, ' ')[0];
            await input.pressSequentially(firstKey);
            await expect(page.locator('.typing-text .char.correct')).toHaveCount(1);
            await page.getByRole('button', { name: 'Skip to test', exact: true })
                .tap();
            await expect(page.getByRole('region', { name: '30 second test' }))
                .toBeVisible();
            await expect(input).toBeEnabled();
        });
});
