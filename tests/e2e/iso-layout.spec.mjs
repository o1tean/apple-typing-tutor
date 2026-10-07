import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';
const savedBytes = page => page.evaluate(key => localStorage.getItem(key), storageKey);
const passage = async page => (await page.locator('.typing-text .word').allTextContents())
    .join('').replace(/\u00a0/g, ' ');
const symbols = {
    '\\': ['IntlBackslash'],
    '|': ['IntlBackslash', 'ShiftRight'],
    '#': ['Backslash'],
    '~': ['Backslash', 'ShiftLeft'],
    '"': ['Digit2', 'ShiftRight'],
    '@': ['Quote', 'ShiftLeft'],
    '£': ['Digit3', 'ShiftRight'],
    '¬': ['Backquote', 'ShiftRight'],
    '{': ['BracketLeft', 'ShiftLeft'],
    '}': ['BracketRight', 'ShiftLeft'],
    '[': ['BracketLeft'],
    ']': ['BracketRight'],
    '<': ['Comma', 'ShiftLeft'],
    '>': ['Period', 'ShiftLeft'],
    '/': ['Slash'],
    '=': ['Equal'],
    '+': ['Equal', 'ShiftLeft'],
    '*': ['Digit8', 'ShiftLeft'],
    '&': ['Digit7', 'ShiftLeft'],
    '%': ['Digit5', 'ShiftRight'],
    '$': ['Digit4', 'ShiftRight'],
    ' ': ['Space']
};

async function physicalKey(session, key) {
    const [code, shift] = symbols[key] || [`Key${key.toUpperCase()}`];
    if (shift) await session.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Shift',
        code: shift,
        modifiers: 8
    });
    await session.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key,
        code,
        text: key,
        modifiers: shift ? 8 : 0
    });
    await session.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
        code,
        modifiers: shift ? 8 : 0
    });
    if (shift) await session.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Shift',
        code: shift
    });
}

async function chooseLayout(page, preset) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('combobox', { name: 'Keyboard layout', exact: true }).selectOption(
        preset);
    await page.keyboard.press('Escape');
}

async function downloadCard(page) {
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download result card', exact: true }).click();
    const download = await downloading;
    expect(await download.failure()).toBeNull();
    return readFile(await download.path());
}

test('UK ISO preserves old saves and teaches its physical symbols with a captured result map',
    async ({ page, context }) => {
        const saved = {
            futureRoot: { version: 9 },
            settings: {
                keyboardLayout: 'colemak',
                theme: 'light',
                colorPalette: 'plum',
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
        expect(await savedBytes(page)).toBe(JSON.stringify(saved));
        await chooseLayout(page, 'uk-iso');
        const beforeReload = await savedBytes(page);
        expect(JSON.parse(beforeReload).settings).toMatchObject({
            ...saved.settings,
            keyboardLayout: 'uk-iso'
        });
        await page.reload();
        expect(await savedBytes(page)).toBe(beforeReload);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await expect(page.getByRole('combobox', { name: 'Keyboard layout', exact: true }))
            .toHaveValue('uk-iso');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'custom', exact: true }).click();
        await page.getByRole('textbox', { name: 'Text to practice', exact: true }).fill(
            '\\|#~"@a£¬b');
        await page.getByRole('button', { name: 'Start practice', exact: true }).click();
        const input = page.getByRole('textbox', { name: 'Typing input' });
        await expect(input).toBeFocused();
        const board = page.locator('.guidance .keyboard-container');
        const codes = await board.locator('[data-code]').evaluateAll(keys => keys.map(key =>
            key.dataset.code));
        expect(codes.length).toBe(new Set(codes).size);
        for (const code of ['Enter', 'IntlBackslash', 'Backslash']) await expect(board
            .locator(`[data-code="${code}"]`)).toHaveCount(1);
        await expect(board.locator('[data-code="AltLeft"]')).toContainText(/alt/i);
        await expect(board.locator('[data-code="MetaLeft"]')).toContainText(/win/i);
        const shape = await board.evaluate(element => {
            const key = code => element.querySelector(`[data-code="${code}"]`)
                .getBoundingClientRect();
            const enter = key('Enter'),
                upper = key('KeyQ'),
                home = key('KeyA');
            const polygon = element.querySelector('[data-code="Enter"] polygon');
            const filled = (x, y) => polygon.isPointInFill(new DOMPoint(x, y));
            return {
                height: enter.height / upper.height,
                aligned: Math.abs(enter.top - upper.top) < 2 && Math.abs(enter
                    .bottom - home.bottom) < 2,
                top: filled(0.5, 0.2),
                notch: filled(0.08, 0.75),
                stem: filled(0.8, 0.75),
                hashRow: Math.abs(key('Backslash').top - home.top),
                slashRow: Math.abs(key('IntlBackslash').top - key('KeyZ').top),
                shortShift: key('ShiftLeft').width < key('IntlBackslash').width *
                    1.5
            };
        });
        expect(shape.height).toBeGreaterThan(1.8);
        expect(shape.aligned).toBe(true);
        expect(shape.top).toBe(true);
        expect(shape.notch).toBe(false);
        expect(shape.stem).toBe(true);
        expect(shape.hashRow).toBeLessThan(2);
        expect(shape.slashRow).toBeLessThan(2);
        expect(shape.shortShift).toBe(true);

        const session = await context.newCDPSession(page);
        await physicalKey(session, 'x');
        await expect(page.getByText(
            'Expected “\\”; typed “x”. Try again.', { exact: true })).toBeVisible();
        const targets = [
            ['\\', 'left', 'pinky', 'lower'], ['|', 'left', 'pinky', 'lower'],
            ['#', 'right', 'pinky', 'home'], ['~', 'right', 'pinky', 'home'],
            ['"', 'left', 'ring', 'number'], ['@', 'right', 'pinky', 'home'],
            ['a', 'left', 'pinky', 'home'], ['£', 'left', 'middle', 'number'],
            ['¬', 'left', 'pinky', 'number'], ['b', 'left', 'index', 'lower']
        ];
        for (const [key, hand, finger, row] of targets) {
            const [code, shift] = symbols[key] || [`Key${key.toUpperCase()}`];
            await expect(board.locator(`[data-code="${code}"]`)).toHaveClass(/key-target/);
            const active = page.locator(`#finger-${hand}-${finger}`);
            await expect(active).toHaveAttribute('data-target-key', key);
            await expect(active).toHaveAttribute('data-reach-row', row);
            if (shift) await expect(board.locator(`[data-code="${shift}"]`)).toHaveClass(
                /key-shift-target/);
            else await expect(board.locator('.key-shift-target')).toHaveCount(0);
            await physicalKey(session, key);
        }
        const results = page.getByRole('region', { name: 'Test results' });
        await expect(results).toBeVisible();
        await expect(results.getByRole('status')).not.toContainText('Saving progress');
        const persisted = JSON.parse(await savedBytes(page));
        expect(persisted.futureRoot).toEqual(saved.futureRoot);
        expect(persisted.progress['amat-1']).toEqual(saved.progress['amat-1']);
        expect(persisted.history[1]).toEqual(saved.history[0]);
        expect(persisted.settings.futureSetting).toEqual(saved.settings.futureSetting);
        expect(persisted.stats.futureStats).toEqual(saved.stats.futureStats);
        const learning = persisted.history[0].learning;
        expect(persisted.history[0].correctKeystrokes).toBe(10);
        expect(persisted.history[0].totalKeystrokes).toBe(11);
        expect(learning.keys['\\'].attempts).toBe(2);
        expect(learning.keys['\\'].errors).toBe(1);
        expect(learning.keys['#'].attempts).toBe(1);
        for (const key of ['£', '¬']) expect(learning.keys[key]).toBeUndefined();
        expect(learning.bigrams.ab).toBeUndefined();
        expect(Object.keys(learning.bigrams).some(pair => /[£¬]/.test(pair))).toBe(false);
        const heatmap = results.getByRole('region', { name: 'Target-key heatmap' });
        await expect(heatmap).toContainText('UK QWERTY · ISO');
        await expect(heatmap.locator('[data-code="IntlBackslash"]')).toHaveAttribute(
            'title', /1 error.*3 attempts/i);
        await expect(heatmap.locator('[data-code="Backslash"]')).toHaveAttribute('title',
            /0 errors.*2 attempts/i);
        const map = await heatmap.innerHTML();
        const card = await downloadCard(page);
        expect(card.readUInt32BE(16)).toBe(1200);
        expect(card.readUInt32BE(20)).toBe(780);
        const pixels = await page.evaluate(async encoded => {
            const bytes = Uint8Array.from(atob(encoded), char => char
                .charCodeAt(0));
            const bitmap = await createImageBitmap(new Blob([
            bytes], { type: 'image/png' }));
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const drawing = canvas.getContext('2d');
            drawing.drawImage(bitmap, 0, 0);
            const pixel = (x, y) => Array.from(drawing.getImageData(x, y, 1, 1)
                .data);
            const colors = {
                top: pixel(1071, 502),
                notch: pixel(1071, 564),
                stem: pixel(1100, 564),
                chassis: pixel(500, 492),
                cleanHash: pixel(1040, 556),
                wrongSlash: pixel(180, 606),
                untried: pixel(330, 606)
            };
            bitmap.close();
            return colors;
        }, card.toString('base64'));
        expect(pixels.top).toEqual(pixels.stem);
        expect(pixels.top).toEqual(pixels.untried);
        expect(pixels.notch).toEqual(pixels.chassis);
        expect(pixels.notch).not.toEqual(pixels.stem);
        expect(pixels.cleanHash).not.toEqual(pixels.wrongSlash);
        expect(pixels.cleanHash).not.toEqual(pixels.untried);
        expect(pixels.wrongSlash).not.toEqual(pixels.untried);
        await chooseLayout(page, 'mac-us');
        expect(await heatmap.innerHTML()).toBe(map);
        expect(await downloadCard(page)).toEqual(card);
    });

test('the UK coding lesson practices every added ASCII symbol and saves its original identity',
    async ({ page, context }) => {
        await page.goto('./');
        await chooseLayout(page, 'uk-iso');
        await page.getByRole('button', { name: 'learn', exact: true }).click();
        await page.getByRole('button', { name: 'Advanced', exact: true }).click();
        await page.getByRole('button', { name: /Coding & Developer Symbols/ }).click();
        await expect(page.getByRole(
                'region', { name: 'Lesson 9: Coding & Developer Symbols', exact: true }
            ))
            .toBeVisible();
        const input = page.getByRole('textbox', { name: 'Typing input' });
        await expect(input).toBeFocused();
        const session = await context.newCDPSession(page);
        let typed = '';
        for (let line = 0; line < 4; line++) {
            const text = await passage(page);
            expect(text).toMatch(/^[\x20-\x7e]+$/);
            typed += text;
            for (const key of text) await physicalKey(session, key);
        }
        for (const key of '#@|~') expect(typed).toContain(key);
        const results = page.getByRole('region', { name: 'Test results' });
        await expect(results).toBeVisible();
        await expect(results.getByRole('status')).not.toContainText('Saving progress');
        const stored = JSON.parse(await savedBytes(page));
        expect(stored.history[0].lessonId).toBe('pro-9');
        expect(stored.history[0].accuracy).toBe(100);
        expect(stored.progress['words-v1:pro-9'].completed).toBe(true);
        for (const key of '#@|~') expect(stored.learning.keys[key].attempts)
            .toBeGreaterThan(0);
        const beforeReload = await savedBytes(page);
        await page.reload();
        expect(await savedBytes(page)).toBe(beforeReload);
    });
