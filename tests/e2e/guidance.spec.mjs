import { expect, test } from '@playwright/test';

const fingertip = finger => finger.evaluate(element => {
    const nail = element.querySelector('.finger-nail').getBoundingClientRect();
    const hand = element.closest('svg').getBoundingClientRect();
    return {
        x: (nail.left + nail.width / 2 - hand.left) / hand.width,
        y: (nail.top + nail.height / 2 - hand.top) / hand.height
    };
});

test('the next key moves its finger in the physical reach direction', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'custom', exact: true }).click();
    await page.getByRole('textbox', { name: 'Text to practice', exact: true }).fill(
        'df');
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    const middle = page.locator('#finger-left-middle');
    const leftIndex = page.locator('#finger-left-index');
    const rightIndex = page.locator('#finger-right-index');
    await expect(middle).toHaveAttribute('data-target-key', 'd');
    await expect.poll(() => middle.evaluate(element => element.getAnimations().length))
        .toBe(0);
    const homes = {
        middle: await fingertip(middle),
        leftIndex: await fingertip(leftIndex),
        rightIndex: await fingertip(rightIndex)
    };

    await page.getByRole('button', { name: 'custom', exact: true }).click();
    await page.getByRole('textbox', { name: 'Text to practice', exact: true })
        .fill('egch3E J? f');
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Typing input' });
    await expect(input).toBeFocused();
    expect(await middle.evaluate(element => getComputedStyle(element)
            .transitionProperty))
        .toContain('transform');
    expect(await middle.evaluate(element => getComputedStyle(element).transitionDuration
        .split(',').some(value => parseFloat(value) > 0))).toBe(true);

    const reaches = [
        {
            char: 'e',
            finger: middle,
            home: homes.middle,
            axis: 'y',
            direction: -1,
            row: 'upper',
            code: 'KeyE'
        },
        {
            char: 'g',
            finger: leftIndex,
            home: homes.leftIndex,
            axis: 'x',
            direction: 1,
            row: 'home',
            code: 'KeyG'
        },
        {
            char: 'c',
            finger: middle,
            home: homes.middle,
            axis: 'y',
            direction: 1,
            row: 'lower',
            code: 'KeyC'
        },
        {
            char: 'h',
            finger: rightIndex,
            home: homes.rightIndex,
            axis: 'x',
            direction: -1,
            row: 'home',
            code: 'KeyH'
        },
        {
            char: '3',
            finger: middle,
            home: homes.middle,
            axis: 'y',
            direction: -1,
            row: 'number',
            code: 'Digit3'
        }
    ];
    for (const reach of reaches) {
        await expect(reach.finger).toHaveAttribute('data-target-key', reach.char);
        await expect(reach.finger).toHaveAttribute('data-reach-row', reach.row);
        await expect(page.locator(`[data-code="${reach.code}"]`))
            .toHaveClass(/key-target/);
        await expect.poll(async () => {
            const position = await fingertip(reach.finger);
            return (position[reach.axis] - reach.home[reach.axis]) * reach
                .direction;
        }).toBeGreaterThan(0.01);
        await input.pressSequentially(reach.char);
    }

    await expect(middle).toHaveAttribute('data-target-key', 'E');
    await expect(page.locator('#finger-right-pinky')).toHaveAttribute('data-reach-row',
        'shift');
    await expect(page.locator('#finger-right-pinky .finger-tag')).toHaveText('⇧');
    await expect(page.locator('[data-code="ShiftRight"]')).toHaveClass(
        /key-shift-target/);
    await input.press('Shift+E');
    for (const hand of ['left', 'right']) {
        const thumb = page.locator(`#finger-${hand}-thumb`);
        await expect(thumb).toHaveAttribute('data-reach-row', 'space');
        await expect(thumb).toHaveClass(/active/);
    }
    await expect(middle).not.toHaveAttribute('data-target-key', /.+/);
    await expect(middle.locator('.finger-tag')).toHaveText('D');
    await expect(page.locator('[data-code="ShiftRight"]')).not.toHaveClass(
        /key-shift-target/);
    await input.press('Space');
    await expect(rightIndex).toHaveAttribute('data-target-key', 'J');
    await expect(page.locator('[data-code="ShiftLeft"]')).toHaveClass(
        /key-shift-target/);
    await input.press('Shift+J');
    await expect(page.locator('#finger-right-pinky')).toHaveAttribute('data-target-key',
        '?');
    await expect(page.locator('#finger-left-pinky')).toHaveAttribute('data-reach-row',
        'shift');
    await expect(page.locator('[data-code="Slash"]')).toHaveClass(/key-target/);
    await input.pressSequentially('?');
    await input.press('Space');
    await expect(leftIndex).toHaveAttribute('data-target-key', 'f');
    await expect(page.locator('#finger-left-pinky')).not.toHaveAttribute(
        'data-target-key', /.+/);
    await expect(page.locator('#finger-left-pinky .finger-tag')).toHaveText('A');
    await expect(page.locator('[data-code="ShiftLeft"]')).not.toHaveClass(
        /key-shift-target/);
});

test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('keeps the target finger reach without transitions or animations',
        async ({ page }) => {
            await page.goto('./');
            await page.getByRole('button', { name: 'custom', exact: true }).click();
            await page.getByRole('textbox', {
                name: 'Text to practice',
                exact: true
            }).fill('df');
            await page.getByRole('button', { name: 'Start practice', exact: true })
                .click();
            const middle = page.locator('#finger-left-middle');
            const home = await fingertip(middle);
            await page.getByRole('button', { name: 'custom', exact: true }).click();
            await page.getByRole('textbox', {
                name: 'Text to practice',
                exact: true
            }).fill('ef');
            await page.getByRole('button', { name: 'Start practice', exact: true })
                .click();
            await expect(middle).toHaveAttribute('data-reach-row', 'upper');
            await expect.poll(async () => (await fingertip(middle)).y)
                .toBeLessThan(home.y - 0.01);
            const motion = await middle.evaluate(element => {
                const style = getComputedStyle(element);
                return {
                    transitions: style.transitionDuration,
                    animation: style.animationName,
                    running: element.getAnimations({ subtree: true }).length
                };
            });
            expect(motion.transitions.split(',').every(value => parseFloat(value)
                === 0)).toBe(true);
            expect(motion.animation).toBe('none');
            expect(motion.running).toBe(0);
            await page.getByRole('textbox', { name: 'Typing input' })
                .pressSequentially('e');
            await expect(page.locator('#finger-left-index')).toHaveAttribute(
                'data-target-key', 'f');
            await expect(middle).not.toHaveAttribute('data-target-key', /.+/);
            expect(await middle.evaluate(element => getComputedStyle(element)
                    .transform))
                .toBe('matrix(1, 0, 0, 1, 0, 0)');
        });
});
