import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';

test('a visitor downloads the measured result card without changing saved progress',
    async ({ page }) => {
        const saved = {
            settings: {
                theme: 'dark',
                typingMode: 'strict',
                showHands: false,
                showKeyboard: false,
                soundMuted: true,
                testMode: 'words',
                testWordCount: 10
            },
            progress: {
                'amat-1': {
                    completed: true,
                    bestWpm: 30,
                    bestAccuracy: 98,
                    stars: 2
                }
            },
            history: [],
            stats: { totalSessions: 1, totalKeystrokes: 80, totalTimeSeconds: 12 }
        };
        await page.addInitScript(({ key, data }) => {
            if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON
                .stringify(data));
        }, { key: storageKey, data: saved });
        await page.goto('./');
        await expect(page).toHaveTitle(/Typeflow.*(?:learn|teach|touch typing)/i);
        for (const selector of ['meta[name="description"]',
            'meta[property="og:description"]',
            'meta[name="twitter:description"]']) {
            const description = await page.locator(selector).getAttribute('content');
            expect(description).toMatch(/guided lessons/i);
            expect(description).toMatch(/finger guidance/i);
        }
        for (const selector of ['meta[property="og:title"]',
        'meta[name="twitter:title"]']) {
            expect(await page.locator(selector).getAttribute('content')).toMatch(
                /Typeflow/i);
        }
        const advertisedImage = await page.locator('meta[property="og:image"]')
            .getAttribute('content');
        const imageURL = new URL(advertisedImage);
        expect(imageURL.protocol).toBe('https:');
        expect(imageURL.hostname).toMatch(/\.github\.io$/);
        expect(imageURL.pathname).toMatch(/\/og-image\.png$/);
        expect(await page.locator('meta[name="twitter:image"]').getAttribute('content'))
            .toBe(advertisedImage);
        const previewResponse = await page.request.get(new URL('./og-image.png', page.url())
            .href);
        expect(previewResponse.ok()).toBe(true);
        expect(previewResponse.headers()['content-type']).toMatch(/image\/png/);
        const preview = await previewResponse.body();

        await page.getByRole('button', { name: 'custom', exact: true }).click();
        await page.getByRole('textbox', { name: 'Text to practice', exact: true }).fill(
            'ab ba');
        await page.getByRole('button', { name: 'Start practice', exact: true }).click();
        const input = page.getByRole('textbox', { name: 'Typing input' });
        await input.pressSequentially('ax', { delay: 20 });
        await expect(page.getByText('Expected “b”; typed “x”. Try again.', { exact: true }))
            .toBeVisible();
        await input.pressSequentially('b ba', { delay: 20 });
        const results = page.getByRole('region', { name: 'Test results' });
        await expect(results).toBeVisible();
        await expect(results.getByRole('status')).not.toContainText('Saving progress');
        const beforeDownload = await page.evaluate(key => localStorage.getItem(key),
            storageKey);
        const downloadPromise = page.waitForEvent('download');
        await results.getByRole('button', { name: 'Download result card', exact: true })
            .click();
        const download = await downloadPromise;
        expect(await download.failure()).toBeNull();
        expect(download.suggestedFilename()).toMatch(/\.png$/i);
        const card = await readFile(await download.path());
        expect(card.length).toBeGreaterThan(10000);
        expect(card.length).toBeLessThan(1000000);
        for (const [bytes, width, height] of [[card, 1200, 780], [preview, 1280, 640]]) {
            expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26,
            10]);
            expect(bytes.readUInt32BE(16)).toBe(width);
            expect(bytes.readUInt32BE(20)).toBe(height);
        }
        const pixels = await page.evaluate(async encoded => {
            const bytes = Uint8Array.from(atob(encoded), char => char
                .charCodeAt(0));
            const bitmap = await createImageBitmap(new Blob([
        bytes], { type: 'image/png' }));
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext('2d');
            context.drawImage(bitmap, 0, 0);
            const color = (x, y) => Array.from(context.getImageData(x, y, 1, 1)
                .data);
            const decoded = {
                width: bitmap.width,
                height: bitmap.height,
                a: color(209, 556),
                b: color(540, 606),
                untouched: color(391, 606)
            };
            bitmap.close();
            return decoded;
        }, card.toString('base64'));
        expect([pixels.width, pixels.height]).toEqual([1200, 780]);
        expect(pixels.a).not.toEqual(pixels.untouched);
        expect(pixels.b).not.toEqual(pixels.untouched);
        expect(pixels.a).not.toEqual(pixels.b);
        expect(pixels.a[1]).toBeGreaterThan(pixels.a[0]);
        expect(pixels.b[0]).toBeGreaterThan(pixels.b[1]);
        expect(pixels.a[3]).toBe(255);
        expect(pixels.b[3]).toBe(255);
        await expect(results.getByText('Result card downloaded.', { exact: true }))
            .toBeVisible();
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(
            beforeDownload);
    });
