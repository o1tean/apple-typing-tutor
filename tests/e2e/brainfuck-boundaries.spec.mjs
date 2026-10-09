import { expect, test } from '@playwright/test';

const key = 'apple_typing_tutor_data_v1';
const input = page => page.getByRole('textbox', { name: 'Typing input', exact: true });
const passage = async page => (await page.locator('.typing-text .word').allTextContents())
    .join('').replace(/\u00a0/g, ' ');
const settings = { typingMode: 'flow', soundMuted: true, testMode: 'words', testWordCount: 10 };
const saved = page => page.evaluate(key => localStorage.getItem(key), key);

async function visit(page, data) {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
    await page.goto('./brainfuck.html');
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
}

async function custom(page, text) {
    await page.getByRole('button', { name: 'custom', exact: true }).click();
    await page.getByRole('textbox', { name: 'Text to practice', exact: true }).fill(text);
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    await expect(input(page)).toBeFocused();
}

test('Brainfuck renders and types the full legal 10000-character custom passage',
    async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await visit(page, { settings: { ...settings, typingMode: 'strict' } });
        const before = await saved(page);
        const text = 'a'.repeat(10000);
        await custom(page, text);
        expect(await passage(page)).toBe(text);
        await input(page).press('a');
        await expect(page.locator('.typing-text .char.correct')).toHaveCount(1);
        expect(await passage(page)).toBe(text);
        expect(await saved(page)).toBe(before);
        expect(errors).toEqual([]);
    });

test('Brainfuck retains 20000 native input characters and editable overflow', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await visit(page, { settings });
    await custom(page, 'a'.repeat(10000));
    await input(page).evaluate(node => {
        node.value = 'x'.repeat(20000);
        node.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType: 'insertText'
        }));
    });
    await expect(page.locator('.typing-text .char.incorrect')).toHaveCount(20000);
    await expect(page.locator('.typing-text .char.extra')).toHaveCount(10000);
    await input(page).press('Backspace');
    await expect(page.locator('.typing-text .char.extra')).toHaveCount(9999);
    expect(errors).toEqual([]);
});

test('Brainfuck preserves and exports saved unknown strings larger than one MiB',
    async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const unknown = 'future-😀-'.repeat(120000);
        await visit(page, { settings, futureRoot: { unknown } });
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('button', { name: 'light', exact: true }).click();
        await expect.poll(async () => JSON.parse(await saved(page)).settings.theme).toBe(
            'light');
        expect(JSON.parse(await saved(page)).futureRoot.unknown).toBe(unknown);
        await page.getByRole('button', { name: 'Manage saved progress', exact: true })
            .click();
        await page.getByText('View backup text', { exact: true }).click();
        const raw = await page.getByRole('textbox', { name: 'Backup JSON', exact: true })
            .inputValue();
        expect(raw.length).toBeGreaterThan(1024 * 1024);
        expect(raw).toContain(JSON.stringify(unknown));
        const downloaded = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download backup', exact: true }).click();
        const download = await downloaded;
        expect(await download.failure()).toBeNull();
        expect(errors).toEqual([]);
    });

test('Brainfuck handles native beforeinput deletion and composed Unicode without duplicate strokes',
    async ({ page }) => {
        await visit(page, { settings });
        await custom(page, 'cat dog');
        await input(page).pressSequentially('ca');
        await input(page).evaluate(node => node.dispatchEvent(new InputEvent(
            'beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType: 'deleteContentBackward'
            })));
        await expect(page.locator('.typing-text .char.correct')).toHaveCount(1);
        await input(page).pressSequentially('at dog');
        await expect(page.getByRole('region', { name: 'Test results', exact: true }))
            .toBeVisible();
        await expect.poll(async () => JSON.parse(await saved(page)).history?.[0]
            ?.totalKeystrokes).toBe(8);
        await custom(page, 'café');
        await input(page).evaluate(node => {
            node.dispatchEvent(new CompositionEvent(
                'compositionstart', { bubbles: true }));
            node.value = 'cafe\u0301';
            node.dispatchEvent(new CompositionEvent(
                'compositionend', { bubbles: true, data: node.value }));
            node.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                inputType: 'insertCompositionText'
            }));
        });
        await expect(page.getByRole('region', { name: 'Test results', exact: true }))
            .toBeVisible();
        await expect.poll(async () => JSON.parse(await saved(page)).history?.[0]
            ?.totalKeystrokes).toBe(4);
    });

test('Brainfuck keeps malformed saved bytes readable and protects them from automatic overwrites',
    async ({ page }) => {
        const raw = '{future data without closing bracket';
        await visit(page, raw);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('button', { name: 'light', exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
        expect(await saved(page)).toBe(raw);
        await page.getByRole('button', { name: 'Manage saved progress', exact: true })
            .click();
        await page.getByText('View backup text', { exact: true }).click();
        const backup = await page.getByRole('textbox', { name: 'Backup JSON', exact: true })
            .inputValue();
        expect(backup).toContain(raw);
        expect(await saved(page)).toBe(raw);
    });
