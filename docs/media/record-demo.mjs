/** Re-shoot with `node docs/media/record-demo.mjs` (Playwright Chromium + ffmpeg).
 * Set TYPEFLOW_DEMO_URL to a running preview to record an unpublished build.
 * Uses a fresh browser context and the real custom-practice controls, never a profile.
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('.', import.meta.url));
const liveURL = 'https://o1tean.github.io/apple-typing-tutor/';
const sourceURL = process.env.TYPEFLOW_DEMO_URL || liveURL;
const temporary = await mkdtemp(join(tmpdir(), 'typeflow-demo-'));
const browser = await chromium.launch();
const errors = [];

try {
    const context = await browser.newContext({
        viewport: { width: 1100, height: 1400 },
        colorScheme: 'dark',
        reducedMotion: 'no-preference',
        locale: 'en-US'
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(sourceURL);
    await page.getByRole('button', { name: 'custom', exact: true }).click();
    await page.getByRole('textbox', { name: 'Text to practice', exact: true })
        .fill('e g c h E J? 3 asdf jkl;');
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Typing input', exact: true });
    await input.focus();
    await page.waitForTimeout(300);
    const bounds = await page.locator('.guidance').boundingBox();
    if (!bounds) throw new Error('Finger guidance is not visible.');
    const clip = {
        x: Math.floor(bounds.x),
        y: Math.max(0, Math.floor(bounds.y) - 20),
        width: Math.ceil(bounds.width),
        height: Math.ceil(bounds.height) + 20
    };
    let frame = 0;
    const hold = async () => {
        for (let sample = 0; sample < 5; sample++) {
            await page.screenshot({
                path: join(temporary,
                    `frame-${String(frame++).padStart(4, '0')}.png`),
                clip
            });
            await page.waitForTimeout(60);
        }
    };
    await hold();
    for (const character of 'e g c h E J? 3 ') {
        await input.pressSequentially(character);
        await hold();
    }
    execFileSync('ffmpeg', [
        '-v', 'error', '-y', '-framerate', '10',
        '-i', join(temporary, 'frame-%04d.png'),
        '-filter_complex',
        'scale=920:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
        '-loop', '0', join(output, 'hero.gif')
    ]);
    const heroBytes = (await stat(join(output, 'hero.gif'))).size;
    if (heroBytes > 5000000) throw new Error(`Hero exceeds 5 MB: ${heroBytes} bytes.`);

    // The social card uses the same real reaching pose and existing app artwork.
    await page.getByRole('button', { name: 'Restart test', exact: true }).click();
    await input.pressSequentially('e g c h ');
    await page.waitForTimeout(300);
    const hands = await page.locator('.hands-display').evaluate(element => element.outerHTML);
    const [appCSS, handsCSS, mark] = await Promise.all([
        readFile(new URL('../../css/main.css', import.meta.url), 'utf8'),
        readFile(new URL('../../css/hands.css', import.meta.url), 'utf8'),
        readFile(new URL('../../public/favicon.svg', import.meta.url), 'utf8')
    ]);
    const social = await context.newPage();
    await social.setViewportSize({ width: 1280, height: 640 });
    await social.setContent(`<!doctype html>
        <html lang="en"><meta charset="utf-8"><title>Typeflow social preview</title>
        <style>${appCSS}\n${handsCSS}
            body { width: 1280px; height: 640px; overflow: hidden; }
            .poster { position: relative; height: 100%; padding: 56px 64px; }
            .poster-brand { display: flex; align-items: center; gap: 16px; }
            .poster-brand svg { width: 54px; height: 54px; }
            .poster-brand strong { font-size: 42px; letter-spacing: -2px; font-weight: 600; }
            .poster-brand strong span { color: var(--accent); }
            .poster-pitch { margin: 50px 0 24px; font-size: 60px; line-height: 1.09; letter-spacing: -2.5px; }
            .poster-pitch span { color: var(--accent); }
            .poster-detail { color: var(--muted); font-size: 22px; line-height: 1.6; }
            .poster-url { position: absolute; bottom: 56px; margin: 0; font-size: 18px; color: var(--accent); }
            .poster-guide { position: absolute; top: 76px; right: 64px; width: 490px; padding: 28px 24px; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); }
            .poster-guide > p { margin: 0 0 16px; text-align: center; color: var(--muted); font-size: 11px; letter-spacing: 2px; }
            .poster-keys { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 10px; color: var(--muted); }
            .poster-keys kbd { border: 1px solid var(--border); background: var(--bg); border-radius: 9px; padding: 10px 17px; font: 26px var(--font-mono); color: var(--accent); }
            .poster-guide .hands-display { gap: 12px 20px; }
            .poster-guide .finger-pill, .poster-guide .finger-shape { transition: none; }
        </style>
        <body><main class="poster">
            <div class="poster-brand">${mark}<strong>typeflow<span>.</span></strong></div>
            <h1 class="poster-pitch">Learn touch typing.<br><span>One key at a time.</span></h1>
            <p class="poster-detail">Guided lessons.<br>Live finger guidance.</p>
            <p class="poster-url">${liveURL.replace('https://', '')}</p>
            <section class="poster-guide" aria-label="Live finger guidance">
                <p>YOUR NEXT KEY</p>
                <div class="poster-keys"><kbd>E</kbd><span>+</span><kbd>⇧</kbd></div>
                ${hands}
            </section>
        </main></body></html>`);
    await social.screenshot({ path: join(output, 'social-preview.png') });
    if (errors.length) throw new Error(`Demo runtime errors: ${errors.join('; ')}`);
    const hero = await readFile(join(output, 'hero.gif'));
    const preview = await readFile(join(output, 'social-preview.png'));
    console.log(JSON.stringify({
        sourceURL,
        hero: {
            width: hero.readUInt16LE(6),
            height: hero.readUInt16LE(8),
            bytes: heroBytes
        },
        social: {
            width: preview.readUInt32BE(16),
            height: preview.readUInt32BE(20),
            bytes: preview.length
        }
    }, null, 2));
} finally {
    await browser.close();
    await rm(temporary, { recursive: true, force: true });
}
