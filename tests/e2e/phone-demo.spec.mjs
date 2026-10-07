import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';

test.use({ hasTouch: true, viewport: { width: 375, height: 812 } });

async function openWithPausedClock(page) {
    await page.clock.install({ time: new Date('2026-10-07T09:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-07T09:01:00Z'));
    await page.goto('./');
    await page.clock.runFor(32);
}

test('a fresh phone visitor watches, pauses and leaves the guide without recording a score',
    async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await openWithPausedClock(page);
        const demo = page.getByRole('region', { name: 'Finger demo', exact: true });
        const target = demo.getByLabel('Demo target', { exact: true });
        await expect(demo).toBeVisible();
        await expect(page.getByText(/Best with a physical keyboard\./)).toBeVisible();
        await expect(target).toHaveText('f');
        await expect(page.getByRole('textbox', { name: 'Typing input' })).toHaveCount(0);
        await expect(page.locator('#finger-left-index')).toHaveCount(1);
        await page.clock.runFor(1100);
        await expect(target).toHaveText('Space');
        await expect(demo.locator('[data-code="Space"]')).toHaveClass(/key-target/);
        await page.clock.runFor(1100);
        await expect(target).toHaveText('r');
        await expect(demo.locator('#finger-left-index')).toHaveAttribute('data-reach-row',
            'upper');
        await demo.getByRole('button', { name: 'Pause demo', exact: true }).tap();
        await page.clock.runFor(5000);
        await expect(target).toHaveText('r');
        await demo.getByRole('button', { name: 'Next key', exact: true }).tap();
        await expect(target).toHaveText('Space');
        await page.clock.runFor(5000);
        await expect(target).toHaveText('Space');
        await demo.getByRole('button', { name: 'Play demo', exact: true }).tap();
        await page.clock.runFor(1100);
        await expect(target).toHaveText('f');

        await page.getByRole('button', { name: 'Settings', exact: true }).tap();
        await page.clock.runFor(5000);
        await page.keyboard.press('Escape');
        await expect(target).toHaveText('f');
        await page.clock.runFor(1100);
        await expect(target).toHaveText('Space');
        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', {
                configurable: true,
                value: true
            });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.clock.runFor(5000);
        await expect(target).toHaveText('Space');
        await page.evaluate(() => {
            delete document.hidden;
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.clock.runFor(1100);
        await expect(target).toHaveText('j');
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey))
            .toBeNull();
        await page.getByRole('button', { name: 'Skip to test', exact: true }).tap();
        await page.clock.runFor(32);
        await expect(demo).toHaveCount(0);
        await expect(page.getByRole('region', { name: '30 second test', exact: true }))
            .toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Typing input' })).toBeEnabled();
        expect(errors).toEqual([]);
    });

test('reduced motion keeps the phone demo manual, including live preference changes',
    async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await openWithPausedClock(page);
        const demo = page.getByRole('region', { name: 'Finger demo', exact: true });
        const target = demo.getByLabel('Demo target', { exact: true });
        await expect(demo).toContainText('Reduced motion: use Next key');
        await expect(demo.getByRole('button', { name: /Play demo|Pause demo/ }))
            .toHaveCount(0);
        await page.clock.runFor(10000);
        await expect(target).toHaveText('f');
        const steps = ['Space', 'r', 'Space', 'f', 'Space', 'j', 'Space', 'u',
            'Space', 'j', 'Space', 'F', 'Space', 'J'];
        for (const key of steps) {
            await demo.getByRole('button', { name: 'Next key', exact: true }).tap();
            await expect(target).toHaveText(key);
            if (key === 'F' || key === 'J') {
                const shift = key === 'F' ? 'ShiftRight' : 'ShiftLeft';
                await expect(demo.locator(`[data-code="${shift}"]`)).toHaveClass(
                    /key-shift-target/);
            }
        }
        expect(await demo.locator('#finger-right-index').evaluate(element =>
            getComputedStyle(element).transitionDuration)).toBe('0s');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await expect(demo.getByRole('button', { name: 'Play demo', exact: true }))
            .toBeVisible();
        await page.clock.runFor(5000);
        await expect(target).toHaveText('J');
        await demo.getByRole('button', { name: 'Play demo', exact: true }).tap();
        await page.clock.runFor(1100);
        await expect(target).toHaveText('Space');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(demo).toContainText('Reduced motion: use Next key');
        await expect(demo.getByRole('button', { name: /Play demo|Pause demo/ }))
            .toHaveCount(0);
        await page.clock.runFor(5000);
        await expect(target).toHaveText('Space');
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey))
            .toBeNull();
    });

test('a returning phone visitor can preview fingers without changing saved progress',
    async ({ page }) => {
        const original = JSON.stringify({
            settings: {
                theme: 'light',
                colorPalette: 'ocean',
                typingMode: 'strict',
                testMode: 'words',
                testWordCount: 10,
                futureSetting: 'keep'
            },
            progress: {
                'amat-1': {
                    completed: true,
                    bestWpm: 40,
                    bestAccuracy: 99,
                    stars: 3
                }
            },
            history: [{
                lessonId: 'amat-1',
                date: '2026-10-06T08:00:00Z',
                wpm: 40,
                accuracy: 99,
                stars: 3,
                futureSession: 'keep'
            }],
            futureData: { keep: true }
        });
        await page.addInitScript(({ key, value }) => {
            if (localStorage.getItem(key) === null) localStorage.setItem(key,
                value);
        }, { key: storageKey, value: original });
        await openWithPausedClock(page);
        const demo = page.getByRole('region', { name: 'Finger demo', exact: true });
        await expect(demo).toHaveCount(0);
        await expect(page.getByRole('region', { name: '10 word test', exact: true }))
            .toBeVisible();
        await page.getByRole('button', { name: 'Watch a demo', exact: true }).tap();
        await expect(demo).toBeVisible();
        await page.clock.runFor(3300);
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
            original);
        await demo.getByRole('button', { name: 'Try this lesson', exact: true }).tap();
        await page.clock.runFor(32);
        await expect(demo).toHaveCount(0);
        await expect(page.getByRole('region', {
                name: 'Lesson 1: Left Hand Home',
                exact: true
            }))
            .toBeVisible();
        const input = page.getByRole('textbox', { name: 'Typing input' });
        await expect(input).toBeFocused();
        const key = await page.locator('.typing-text .char').first().textContent();
        await input.pressSequentially(key);
        await expect(page.locator('.typing-text .char.correct')).toHaveCount(1);
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
            original);
        await page.reload();
        await page.clock.runFor(32);
        await expect(demo).toHaveCount(0);
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
            original);
    });

test('watching the demo pauses a real timed session through dialogs and visibility changes',
    async ({ page }) => {
        const original = JSON.stringify({
            settings: {
                testMode: 'time',
                testDuration: 15,
                typingMode: 'strict',
                soundMuted: true
            },
            history: [],
            futureData: 'keep'
        });
        await page.addInitScript(({ key, value }) => localStorage.setItem(key,
            value), { key: storageKey, value: original });
        await openWithPausedClock(page);
        await expect(page.getByRole('region', { name: '15 second test', exact: true }))
            .toBeVisible();
        const key = await page.locator('.typing-text .char').first().textContent();
        await page.getByRole('textbox', { name: 'Typing input' }).pressSequentially(key);
        await page.clock.runFor(1000);
        await page.getByRole('button', { name: 'Watch a demo', exact: true }).tap();
        await page.clock.fastForward(20000);
        await page.getByRole('button', { name: 'Settings', exact: true }).tap();
        await page.clock.fastForward(20000);
        await page.keyboard.press('Escape');
        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', {
                configurable: true,
                value: true
            });
            document.dispatchEvent(new Event('visibilitychange'));
            delete document.hidden;
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.clock.fastForward(20000);
        await expect(page.getByRole('region', { name: 'Finger demo', exact: true }))
            .toBeVisible();
        await expect(page.getByRole('region', { name: 'Test results', exact: true }))
            .toHaveCount(0);
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
            original);
    });
