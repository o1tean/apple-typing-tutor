import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';

async function checkContrast(page, button) {
    const colors = await page.evaluate(() => {
        const probe = document.createElement('span');
        document.body.append(probe);
        const colors = {};
        for (const name of ['bg', 'surface', 'surface-hover', 'text', 'muted',
            'pending', 'accent', 'accent-ink', 'error']) {
            probe.style.color = `var(--${name})`;
            colors[name] = getComputedStyle(probe).color;
        }
        probe.remove();
        return colors;
    });
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3)
        .map(Number).map(value => value / 255)
        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const contrast = (first, second) => {
        const values = [luminance(first), luminance(second)];
        return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
    };
    for (const background of ['bg', 'surface', 'surface-hover']) {
        for (const foreground of ['text', 'muted', 'accent', 'error']) {
            expect(contrast(colors[foreground], colors[background]),
                `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
        }
    }
    expect(contrast(colors.pending, colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors['accent-ink'], colors.accent)).toBeGreaterThanOrEqual(4.5);
    const focus = await button.evaluate(element => {
        const style = getComputedStyle(element);
        return {
            visible: element.matches(':focus-visible'),
            width: parseFloat(style.outlineWidth),
            style: style.outlineStyle,
            color: style.outlineColor
        };
    });
    expect(focus.visible).toBe(true);
    expect(focus.width).toBeGreaterThanOrEqual(2);
    expect(focus.style).not.toBe('none');
    expect(contrast(focus.color, colors.surface)).toBeGreaterThanOrEqual(3);
}

for (const theme of ['light', 'dark', 'system']) {
    test(`${theme} settings retain progress while keyboard palette choices survive reload`,
        async ({ page }) => {
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => {
                if (message.type() === 'error') errors.push(message.text());
            });
            const saved = {
                settings: {
                    theme,
                    typingMode: 'strict',
                    soundMuted: true,
                    testMode: 'words',
                    testWordCount: 10,
                    futureSetting: { keep: true }
                },
                progress: {
                    'amat-1': {
                        completed: true,
                        bestWpm: 35,
                        bestAccuracy: 95,
                        stars: 2,
                        futureProgress: 'keep'
                    }
                },
                history: [{
                    lessonId: 'amat-1',
                    date: '2026-10-06T09:00:00Z',
                    wpm: 35,
                    accuracy: 95,
                    stars: 2,
                    futureSession: 'keep'
                }],
                stats: {
                    totalSessions: 1,
                    totalKeystrokes: 80,
                    totalTimeSeconds: 30,
                    highestWpm: 35,
                    futureStat: 'keep'
                },
                futureData: { keep: ['unknown fields'] }
            };
            const original = JSON.stringify(saved);
            await page.emulateMedia({ colorScheme: 'dark' });
            await page.addInitScript(({ key, value }) => {
                if (localStorage.getItem(key) === null) localStorage.setItem(key,
                    value);
            }, { key: storageKey, value: original });
            const readSaved = () => page.evaluate(key => JSON.parse(localStorage.getItem(
                    key)),
                storageKey);
            await page.goto('./');
            const root = page.locator('html');
            const actualTheme = theme === 'system' ? 'dark' : theme;
            await expect(root).toHaveAttribute('data-theme', actualTheme);
            await expect(root).toHaveAttribute('data-palette', 'mint');
            const firstKey = await page.locator('.typing-text .char').first().textContent();
            await page.getByRole('textbox', { name: 'Typing input' }).pressSequentially(
                firstKey);
            await expect(page.locator('.typing-text .char.correct')).toHaveCount(1);
            await page.getByRole('button', { name: 'Settings', exact: true }).click();
            const appearance = page.getByRole('group', { name: 'Appearance', exact: true });
            await expect(appearance.getByRole('button', { name: theme, exact: true }))
                .toHaveAttribute('aria-pressed', 'true');
            expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
                original);
            const palette = page.getByRole('group', { name: 'Color palette', exact: true });
            for (const name of ['Mint', 'Ocean', 'Plum']) {
                const choice = palette.getByRole('button', { name, exact: true });
                for (let count = 0; count < 24; count++) {
                    if (await choice.evaluate(element => element === document
                            .activeElement)) break;
                    await page.keyboard.press('Tab');
                }
                await expect(choice).toBeFocused();
                await page.keyboard.press('Enter');
                await expect(choice).toHaveAttribute('aria-pressed', 'true');
                await expect(root).toHaveAttribute('data-palette', name.toLowerCase());
                await expect(root).toHaveAttribute('data-theme', actualTheme);
                await expect(page.locator('.typing-text .char.correct')).toHaveCount(1);
                await checkContrast(page, choice);
                await expect.poll(async () => (await readSaved()).settings.colorPalette)
                    .toBe(name.toLowerCase());
                const current = await readSaved();
                expect(current.settings).toMatchObject({
                    ...saved.settings,
                    colorPalette: name.toLowerCase()
                });
                expect(current.progress).toEqual(saved.progress);
                expect(current.history).toEqual(saved.history);
                expect(current.stats).toMatchObject(saved.stats);
                expect(current.futureData).toEqual(saved.futureData);
                if (theme === 'light') {
                    await page.emulateMedia({ contrast: 'more' });
                    const highContrast = await root.evaluate(element => {
                        const style = getComputedStyle(element);
                        return ['text', 'muted', 'pending'].map(role =>
                            style.getPropertyValue(`--${role}`).trim());
                    });
                    expect(highContrast[1]).toBe(highContrast[0]);
                    expect(highContrast[2]).toBe(highContrast[0]);
                    await page.emulateMedia({ contrast: 'no-preference' });
                    expect(await readSaved()).toEqual(current);
                }
                if (theme === 'system') {
                    await page.emulateMedia({ colorScheme: 'light' });
                    await expect(root).toHaveAttribute('data-theme', 'light');
                    await checkContrast(page, choice);
                    await page.emulateMedia({ colorScheme: 'dark' });
                    await expect(root).toHaveAttribute('data-theme', 'dark');
                    expect(await readSaved()).toEqual(current);
                }
            }
            const beforeReload = await readSaved();
            await page.reload();
            await expect(root).toHaveAttribute('data-theme', actualTheme);
            await expect(root).toHaveAttribute('data-palette', 'plum');
            expect(await readSaved()).toEqual(beforeReload);
            await page.getByRole('button', { name: 'appearance', exact: true }).click();
            await expect(root).toHaveAttribute('data-theme', actualTheme === 'dark' ?
                'light' : 'dark');
            await expect(root).toHaveAttribute('data-palette', 'plum');
            await expect.poll(async () => (await readSaved()).settings.theme)
                .toBe(actualTheme === 'dark' ? 'light' : 'dark');
            expect((await readSaved()).history).toEqual(saved.history);
            expect(errors).toEqual([]);
        });
}
