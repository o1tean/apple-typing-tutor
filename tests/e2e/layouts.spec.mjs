import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';
const layouts = [
    {
        id: 'colemak',
        name: 'Colemak · US ANSI',
        home: 'arst',
        targets: [['t', 'KeyF', 'index', 'home'], ['f', 'KeyE', 'middle', 'upper']],
        passage: 'tft',
        demo: 't p t n l n T N '
    },
    {
        id: 'dvorak',
        name: 'Dvorak · US ANSI',
        home: 'aoeu',
        targets: [['u', 'KeyF', 'index', 'home'], ['j', 'KeyC', 'middle', 'lower'],
            ["'", 'KeyQ', 'pinky', 'upper'], ['"', 'KeyQ', 'pinky', 'upper']],
        passage: 'uj\'"u',
        demo: 'u p u h g h U H '
    }
];
const savedBytes = page => page.evaluate(key => localStorage.getItem(key), storageKey);
const passage = async page => (await page.locator('.typing-text .word').allTextContents())
    .join('').replace(/\u00a0/g, ' ');

async function chooseLayout(page, value) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('combobox', { name: 'Keyboard layout', exact: true }).selectOption(
        value);
    await page.keyboard.press('Escape');
}

async function physicalKey(session, key, code, shifted = false) {
    if (shifted) await session.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Shift',
        code: 'ShiftRight',
        modifiers: 8
    });
    await session.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key,
        code,
        text: key,
        modifiers: shifted ? 8 : 0
    });
    await session.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
        code,
        modifiers: shifted ? 8 : 0
    });
    if (shifted) await session.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Shift',
        code: 'ShiftRight'
    });
}

async function downloadCard(page) {
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download result card', exact: true }).click();
    const download = await downloading;
    expect(await download.failure()).toBeNull();
    return readFile(await download.path());
}

test('old saves keep QWERTY and preserve unknown progress through every layout choice',
    async ({ page }) => {
        const saved = {
            futureRoot: { version: 8 },
            settings: {
                theme: 'light',
                colorPalette: 'ocean',
                typingMode: 'strict',
                showHands: true,
                showKeyboard: true,
                soundMuted: true,
                futureSetting: ['keep']
            },
            progress: {
                'amat-1': {
                    completed: true,
                    bestWpm: 40,
                    bestAccuracy: 98,
                    stars: 2,
                    futureProgress: true
                }
            },
            history: [{
                lessonId: 'amat-1',
                wpm: 40,
                accuracy: 98,
                stars: 2,
                date: '2026-10-06T12:00:00Z',
                futureHistory: 'keep'
            }],
            stats: { totalSessions: 1, futureStats: [1, 2] }
        };
        await page.addInitScript(({ key, data }) => {
            if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON
                .stringify(data));
        }, { key: storageKey, data: saved });
        await page.goto('./');
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const select = page.getByRole('combobox', { name: 'Keyboard layout', exact: true });
        await expect(select).toHaveValue('mac-us');
        await expect(select.getByRole('option')).toHaveText([
            'Mac US · QWERTY', 'Colemak · US ANSI', 'Dvorak · US ANSI'
        ]);
        expect(await savedBytes(page)).toBe(JSON.stringify(saved));
        await page.keyboard.press('Escape');
        for (const layout of ['colemak', 'dvorak', 'mac-us']) {
            await chooseLayout(page, layout);
            const beforeReload = await savedBytes(page);
            const persisted = JSON.parse(beforeReload);
            expect(persisted.settings).toMatchObject({
                ...saved.settings,
                keyboardLayout: layout
            });
            for (const field of ['futureRoot', 'progress', 'history', 'stats']) {
                expect(persisted[field]).toMatchObject(saved[field]);
            }
            await page.reload();
            expect(await savedBytes(page)).toBe(beforeReload);
            await page.getByRole('button', { name: 'Settings', exact: true }).click();
            await expect(select).toHaveValue(layout);
            await page.keyboard.press('Escape');
        }
    });

for (const layout of layouts) {
    test(`${layout.name} maps lessons, physical reaches and the captured result card`,
        async ({ page, context }) => {
            await page.goto('./');
            const input = page.getByRole('textbox', { name: 'Typing input' });
            await input.pressSequentially((await passage(page))[0]);
            await expect(page.locator('.typing-text .char.correct')).toHaveCount(1);
            await chooseLayout(page, layout.id);
            await expect(page.locator('.typing-text .char.correct')).toHaveCount(0);
            const session = await context.newCDPSession(page);
            for (let line = 0; line < 4; line++) {
                const text = await passage(page);
                expect(text.length).toBeGreaterThan(0);
                expect(Array.from(text).every(key => `${layout.home} `.includes(key))).toBe(
                    true);
                await input.focus();
                for (const key of text) {
                    const index = layout.home.indexOf(key);
                    await physicalKey(session, key, index < 0 ? 'Space' : ['KeyA', 'KeyS',
                        'KeyD', 'KeyF'][index]);
                }
            }
            const results = page.getByRole('region', { name: 'Test results' });
            await expect(results).toBeVisible();
            await expect(results.getByRole('status')).not.toContainText('Saving progress');
            const lessonSave = JSON.parse(await savedBytes(page));
            expect(lessonSave.history[0].lessonId).toBe('amat-1');
            expect(lessonSave.history[0].accuracy).toBe(100);

            await chooseLayout(page, 'mac-us');
            await expect(results.getByRole('region', { name: 'Target-key heatmap' }))
                .toContainText(layout.name);
            await page.getByRole('button', { name: 'Settings', exact: true }).click();
            await page.getByRole('button', { name: 'Free flow', exact: true }).click();
            await page.keyboard.press('Escape');
            expect(Array.from(await passage(page)).every(key => 'asdf '.includes(key)))
                .toBe(true);
            await chooseLayout(page, layout.id);
            await page.getByRole('button', { name: 'Settings', exact: true }).click();
            await page.getByRole('button', { name: 'Guided', exact: true }).click();
            await page.keyboard.press('Escape');

            await page.getByRole('button', { name: 'custom', exact: true }).click();
            await page.getByRole('textbox', { name: 'Text to practice', exact: true }).fill(
                layout.passage);
            await page.getByRole('button', { name: 'Start practice', exact: true }).click();
            await expect(input).toBeFocused();
            await physicalKey(session, 'x', layout.id === 'colemak' ? 'KeyX' : 'KeyB');
            await expect(page.getByText(
                `Expected “${layout.passage[0]}”; typed “x”. Try again.`, { exact: true }
            )).toBeVisible();
            for (const [key, code, finger, row] of layout.targets) {
                await expect(page.locator(`[data-code="${code}"]`)).toHaveClass(
                    /key-target/);
                const hand = page.locator(`#finger-left-${finger}`);
                await expect(hand).toHaveAttribute('data-target-key', key);
                await expect(hand).toHaveAttribute('data-reach-row', row);
                if (key === '"') {
                    await expect(page.locator('[data-code="ShiftRight"]')).toHaveClass(
                        /key-shift-target/);
                    await expect(page.locator('#finger-right-pinky')).toHaveAttribute(
                        'data-reach-row', 'shift');
                }
                await physicalKey(session, key, code, key === '"');
            }
            await physicalKey(session, layout.passage.at(-1), 'KeyF');
            await expect(results).toBeVisible();
            await expect(results.getByRole('status')).not.toContainText('Saving progress');
            const heatmap = results.getByRole('region', { name: 'Target-key heatmap' });
            await expect(heatmap).toContainText(layout.name);
            await expect(heatmap.locator('[data-code="KeyF"]')).toHaveAttribute('title',
                /1 error.*3 attempts/i);
            const mapBefore = await heatmap.innerHTML();
            const cardBefore = await downloadCard(page);
            expect(cardBefore.readUInt32BE(16)).toBe(1200);
            expect(cardBefore.readUInt32BE(20)).toBe(780);
            const dataBefore = JSON.parse(await savedBytes(page));
            await chooseLayout(page, 'mac-us');
            await expect(results).toBeVisible();
            expect(await heatmap.innerHTML()).toBe(mapBefore);
            expect(await downloadCard(page)).toEqual(cardBefore);
            expect(JSON.parse(await savedBytes(page))).toEqual({
                ...dataBefore,
                settings: { ...dataBefore.settings, keyboardLayout: 'mac-us' }
            });
        });
}

test('touch demos follow the selected physical path and open its real lesson without saving',
    async ({ browser, baseURL }) => {
        for (const layout of layouts) {
            const context = await browser.newContext({
                baseURL,
                hasTouch: true,
                viewport: { width: 375, height: 812 },
                reducedMotion: 'reduce'
            });
            const page = await context.newPage();
            await page.goto('./');
            await chooseLayout(page, layout.id);
            const demo = page.getByRole('region', { name: 'Finger demo', exact: true });
            const stored = await savedBytes(page);
            const codes = ['KeyF', 'Space', 'KeyR', 'Space', 'KeyF', 'Space',
                'KeyJ', 'Space', 'KeyU', 'Space', 'KeyJ', 'Space', 'KeyF', 'Space', 'KeyJ', 'Space'];
            for (const [index, key] of Array.from(layout.demo).entries()) {
                await expect(demo.getByLabel('Demo target')).toHaveText(key === ' ' ?
                    'Space' : key);
                await expect(demo.locator(`[data-code="${codes[index]}"]`)).toHaveClass(
                    /key-target/);
                if (index === 12 || index === 14) await expect(demo.locator(
                    `[data-code="${index === 12 ? 'ShiftRight' : 'ShiftLeft'}"]`
                )).toHaveClass(/key-shift-target/);
                await demo.getByRole('button', { name: 'Next key', exact: true }).click();
            }
            expect(await savedBytes(page)).toBe(stored);
            await demo.getByRole('button', { name: 'Try this lesson', exact: true })
                .click();
            const input = page.getByRole('textbox', { name: 'Typing input' });
            await expect(input).toBeFocused();
            const text = await passage(page);
            expect(Array.from(text).every(key => `${layout.home} `.includes(key))).toBe(
                true);
            const session = await context.newCDPSession(page);
            const index = layout.home.indexOf(text[0]);
            await physicalKey(session, text[0], ['KeyA', 'KeyS', 'KeyD', 'KeyF'][index]);
            await expect(page.locator('.typing-text .char.correct')).toHaveCount(1);
            expect(await savedBytes(page)).toBe(stored);
            await context.close();
        }
    });
