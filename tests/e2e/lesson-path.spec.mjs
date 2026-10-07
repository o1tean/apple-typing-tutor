import { expect, test } from '@playwright/test';

const storageKey = 'apple_typing_tutor_data_v1';
const savedBytes = page => page.evaluate(key => localStorage.getItem(key), storageKey);
const passage = async page => (await page.locator('.typing-text .word').allTextContents())
    .join('').replace(/\u00a0/g, ' ');

function savedPath(keyboardLayout = 'mac-us') {
    return {
        futureRoot: ['keep'],
        settings: {
            keyboardLayout,
            typingMode: 'strict',
            showHands: true,
            showKeyboard: true,
            testMode: 'words',
            testWordCount: 10,
            testDuration: 60,
            punctuation: true,
            numbers: true,
            soundMuted: true,
            futureSetting: ['keep']
        },
        progress: {
            'amat-intro': { completed: true, stars: 3 },
            'amat-1': { completed: true, stars: 1, futureProgress: ['keep'] },
            'words-v1:amat-1': { completed: true, stars: 3 },
            'amat-2': { completed: false, stars: 2 },
            'words-v1:amat-4': { completed: true, stars: 3 },
            'pro-1': { completed: true, stars: 3 },
            'words-v1:pro-1': { completed: true, stars: 1 },
            'words-v1:pro-3': { completed: true, stars: 2 },
            'removed-lesson': { completed: true, stars: 3 }
        },
        history: [{
            lessonId: 'words-10',
            wpm: 35,
            accuracy: 98,
            stars: 2,
            date: '2026-10-06T12:00:00Z',
            futureHistory: ['keep']
        }],
        stats: { totalSessions: 1, futureStats: ['keep'] }
    };
}

async function seed(page, data) {
    await page.addInitScript(({ key, data }) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON
            .stringify(data));
    }, { key: storageKey, data });
    await page.goto('./');
}

async function openPath(page, track) {
    await page.getByRole('button', { name: 'learn', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Build your muscle memory' });
    await dialog.getByRole('button', { name: track, exact: true }).click();
    return dialog;
}

async function checkPath(dialog, total, completed, threeStar, title, reason) {
    const overview = dialog.getByRole('region', { name: 'Saved track progress' });
    await expect(overview).toContainText(
        `${completed} of ${total} completed · ${threeStar} of ${total} with 3 stars`);
    await expect(overview).toContainText('Saved progress shared across layouts.');
    const suggestion = dialog.getByRole('complementary', { name: 'Suggested lesson' });
    await expect(suggestion).toContainText(title);
    await expect(suggestion).toContainText(reason);
    await expect(dialog.getByRole('button', { name: 'Start suggested lesson', exact: true }))
        .toHaveCount(1);
    await expect(dialog.locator('.lesson-list button')).toHaveCount(total + (total === 11 ? 1 :
        0));
    await expect(dialog.locator('.lesson-list button:disabled')).toHaveCount(0);
    return suggestion.getByRole('button', { name: 'Start suggested lesson', exact: true });
}

test('untouched tracks suggest lesson one while the introduction remains optional and selectable',
    async ({ page }) => {
        await page.goto('./');
        let dialog = await openPath(page, 'Foundations');
        await checkPath(dialog, 11, 0, 0, 'Lesson 1: Left Hand Home',
            'First lesson without a saved completion.');
        const intro = dialog.locator('.lesson-list button')
            .filter({ hasText: 'Basic Position' });
        await expect(intro).toContainText('Optional introduction');
        await expect(intro.locator('.lesson-number')).toHaveText('—');
        await expect(dialog.locator('.lesson-list button').nth(1).locator('.lesson-number'))
            .toHaveText('01');
        await dialog.getByRole('button', { name: 'Advanced', exact: true }).click();
        await checkPath(dialog, 10, 0, 0, 'Lesson 1: Left Hand Home',
            'First lesson without a saved completion.');
        await expect(dialog.locator('.lesson-list button').first().locator(
                '.lesson-number'))
            .toHaveText('01');
        await expect(dialog.locator('.lesson-list button').last().locator('.lesson-number'))
            .toHaveText('10');
        await dialog.getByRole('button', { name: 'Foundations', exact: true }).click();
        await intro.click();
        await expect(page.getByRole('region', { name: 'Basic Position', exact: true }))
            .toBeVisible();
        expect(await savedBytes(page)).toBeNull();
        dialog = await openPath(page, 'Foundations');
        await checkPath(dialog, 11, 0, 0, 'Lesson 1: Left Hand Home',
            'First lesson without a saved completion.');
        expect(await savedBytes(page)).toBeNull();
        await dialog.getByRole('button', { name: 'Start suggested lesson', exact: true })
            .click();
        const input = page.getByRole('textbox', { name: 'Typing input' });
        for (let line = 0; line < 4; line++) {
            await input.pressSequentially(await passage(page), { delay: 2 });
        }
        const results = page.getByRole('region', { name: 'Test results' });
        await expect(results).toBeVisible();
        await expect(results.getByRole('status')).not.toContainText('Saving progress');
        dialog = await openPath(page, 'Foundations');
        await checkPath(dialog, 11, 1, 1, 'Lesson 2: Right Hand Home',
            'First lesson without a saved completion.');
    });

for (const [layout, home, right] of [
    ['mac-us', 'asdfjkl;', 'jkl;'], ['colemak', 'arstneio', 'neio'],
    ['dvorak', 'aoeuhtns', 'htns'], ['uk-iso', 'asdfjkl;', 'jkl;']
]) {
    test(`${layout} merges saved track progress and opens either suggestion offline without writes`,
        async ({ page, context }) => {
            const saved = savedPath(layout);
            await seed(page, saved);
            await expect(page.getByText('Available offline', { exact: true }))
                .toBeVisible();
            await page.reload();
            await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller
                ?.state)).toBe('activated');
            await context.setOffline(true);
            await page.reload();
            let dialog = await openPath(page, 'Foundations');
            let action = await checkPath(dialog, 11, 3, 2, 'Lesson 3: Home Row Words',
                'First lesson without a saved completion.');
            const firstLesson = dialog.locator('.lesson-list button').filter({
                hasText: 'Left Hand Home'
            });
            await expect(firstLesson.getByRole('img', { name: 'Earned stars: 3 of 3' }))
                .toBeVisible();
            await action.focus();
            await page.keyboard.press('Enter');
            await expect(page.getByRole('region', {
                name: 'Lesson 3: Home Row Words',
                exact: true
            })).toBeVisible();
            expect(Array.from(await passage(page)).every(key => `${home} `.includes(key)))
                .toBe(true);
            await expect(page.getByRole('textbox', { name: 'Typing input' })).toBeFocused();
            expect(await savedBytes(page)).toBe(JSON.stringify(saved));
            dialog = await openPath(page, 'Advanced');
            action = await checkPath(dialog, 10, 2, 1, 'Lesson 2: Right Hand Home',
                'First lesson without a saved completion.');
            await action.click();
            await expect(page.getByRole('region', {
                name: 'Lesson 2: Right Hand Home',
                exact: true
            })).toBeVisible();
            expect(Array.from(await passage(page)).every(key => `${right} `.includes(key)))
                .toBe(true);
            await page.getByRole('button', { name: 'learn', exact: true }).click();
            await expect(dialog.getByRole('button', { name: 'Advanced', exact: true }))
                .toHaveAttribute('aria-pressed', 'true');
            await page.keyboard.press('Escape');
            await page.getByRole('button', { name: 'Skip to test', exact: true }).click();
            await expect(page.getByRole('region', { name: '10 word test' })).toBeVisible();
            for (const option of ['punctuation', 'numbers']) {
                await expect(page.getByRole('button', { name: option, exact: true }))
                    .toHaveAttribute('aria-pressed', 'true');
            }
            expect(await savedBytes(page)).toBe(JSON.stringify(saved));
        });
}

for (const threeStars of [false, true]) {
    test(`${threeStars ? 'three-star' : 'completed'} tracks suggest a revisit without requiring the introduction`,
        async ({ page }) => {
            const saved = savedPath();
            saved.progress = { 'removed-lesson': { completed: true, stars: 3 } };
            for (const [prefix, total, revisit] of [['amat', 11, 5], ['pro', 10, 2]]) {
                for (let lesson = 1; lesson <= total; lesson++) {
                    saved.progress[
                        `${lesson % 2 ? 'words-v1:' : ''}${prefix}-${lesson}`] = {
                        completed: true,
                        stars: !threeStars && lesson === revisit ? 2 : 3,
                        futureProgress: ['keep']
                    };
                }
            }
            await seed(page, saved);
            let dialog = await openPath(page, 'Foundations');
            await checkPath(dialog, 11, 11, threeStars ? 11 : 10, threeStars ?
                'Lesson 11: Amateur Graduation' : 'Lesson 5: Top Row Centers (E & I)',
                threeStars ? 'All 3-star targets earned. Revisit the final lesson.' :
                'All lessons completed. Work toward 3 stars here.');
            await dialog.getByRole('button', { name: 'Advanced', exact: true }).click();
            await checkPath(dialog, 10, 10, threeStars ? 10 : 9, threeStars ?
                'Lesson 10: Master Touch Typist' : 'Lesson 2: Right Hand Home',
                threeStars ? 'All 3-star targets earned. Revisit the final lesson.' :
                'All lessons completed. Work toward 3 stars here.');
            await dialog.locator('.lesson-list button')
                .filter({ hasText: 'Left Hand Home' })
                .click();
            await expect(page.getByRole('region', {
                name: 'Lesson 1: Left Hand Home',
                exact: true
            })).toBeVisible();
            expect(await savedBytes(page)).toBe(JSON.stringify(saved));
            dialog = await openPath(page, 'Advanced');
            await expect(dialog.locator('.lesson-list button')).toHaveCount(10);
            expect(await savedBytes(page)).toBe(JSON.stringify(saved));
        });
}
