import { readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';
import { expect, test } from '@playwright/test';

const project = fileURLToPath(new URL('../../', import.meta.url));
const storageKey = 'apple_typing_tutor_data_v1';
const applications = [
    { name: 'Swift', route: './swift/', html: 'swift/index.html' },
    { name: 'Brainfuck', route: './brainfuck.html', html: 'brainfuck.html' }
];
const input = page => page.getByRole('textbox', { name: 'Typing input', exact: true });
const resultView = page => page.getByRole('region', { name: 'Test results', exact: true });
const savedBytes = page => page.evaluate(key => localStorage.getItem(key), storageKey);
const passage = async page => (await page.locator('.typing-text .word').allTextContents())
    .join('').replace(/\u00a0/g, ' ');
const dialogWithHeading = (page, name) => page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name, exact: true })
});

function walk(node, visit) {
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'string') visit(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(child => walk(child, visit));
        else if (value && typeof value === 'object') walk(value, visit);
    }
}

async function auditHost(entry, visited = new Set()) {
    const filename = resolve(entry);
    const local = relative(project, filename).replaceAll('\\', '/');
    expect(local, 'Browser imports must remain inside this project.').not.toMatch(/^\.\./);
    expect(local, 'The language app may not import the original product implementation.')
        .not.toMatch(/^(?:src|js)\//);
    if (visited.has(filename)) return visited;
    visited.add(filename);
    const source = await readFile(filename, 'utf8');
    const imports = [];
    const productSymbols = new Set([
        'React', 'ReactDOM', 'createRoot', 'TypingEngine', 'BrainfuckEngine',
        'KeyboardView', 'StorageManager', 'CURRICULUM', 'generateLessonDrill',
        'generateWeakDrill', 'resultFeedback', 'historyProgress', 'lessonPath',
        'mergeLearning', 'practiceObservation'
    ]);
    walk(parseAst(source, { lang: extname(filename) === '.jsx' ? 'jsx' : 'js' }, local),
        node => {
            expect(node.type, `${local}: JSX belongs to the original React app.`)
                .not.toMatch(/^JSX/);
            if (node.type === 'Identifier')
                expect(productSymbols.has(node.name),
                    `${local}: product symbol ${node.name}`)
                .toBe(false);
            if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration']
                .includes(node.type) && node.source) imports.push(node.source.value);
            if (node.type === 'ImportExpression') {
                expect(typeof node.source.value,
                        `${local}: computed imports hide the boundary.`)
                    .toBe('string');
                imports.push(node.source.value);
            }
            if (['CallExpression', 'NewExpression'].includes(node.type)) {
                expect(['eval', 'Function', 'require'].includes(node.callee?.name),
                    `${local}: runtime code generation is not browser I/O.`).toBe(false);
                if (node.callee?.type === 'MemberExpression'
                    && node.callee.property?.name === 'createElement')
                    expect(node.arguments[0]?.value,
                        `${local}: do not inject runtime scripts.`)
                    .not.toBe('script');
            }
        });
    for (const specifier of imports) {
        expect(specifier, `${local}: only local browser infrastructure and assets are allowed.`)
            .toMatch(/^\.{1,2}\//);
        const target = resolve(dirname(filename), specifier.split(/[?#]/)[0]);
        if (/\.(?:css|wasm|svg|woff2?)$/.test(target)) continue;
        expect(extname(target), `${local}: unexpected runtime dependency ${specifier}`)
            .toMatch(/^\.(?:m?js|jsx)$/);
        await auditHost(target, visited);
    }
    return visited;
}

test('language browser entry points have no React or product JavaScript import closure',
    async () => {
        test.setTimeout(60000);
        for (const app of applications) {
            const html = await readFile(resolve(project, app.html), 'utf8');
            const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
            expect(scripts.length, `${app.name} needs an auditable module entry.`)
                .toBeGreaterThan(0);
            for (const [, attributes, body] of scripts) {
                expect(body.trim(),
                        `${app.name}: inline application JavaScript is forbidden.`)
                    .toBe('');
                const source = attributes.match(/\bsrc=["']([^"']+)["']/)?.[1];
                expect(source, `${app.name}: a script must declare its local source.`)
                    .toBeTruthy();
                expect(source).not.toMatch(/^(?:https?:)?\/\//);
                await auditHost(source.startsWith('/') ? resolve(project, source.slice(1))
                    : resolve(project, dirname(app.html), source));
            }
        }
    });

function savedPractice(layout = 'mac-us') {
    const strongest = {
        attempts: 40,
        errors: 36,
        latencySamples: 40,
        latencyTotalMs: 36000,
        recentErrorRate: 0.8,
        recentLatencyMs: 900,
        futureCell: ['keep']
    };
    const next = {
        attempts: 40,
        errors: 12,
        latencySamples: 40,
        latencyTotalMs: 20000,
        recentErrorRate: 0.3,
        recentLatencyMs: 500
    };
    return {
        futureRoot: { keep: true },
        settings: {
            keyboardLayout: layout,
            typingMode: 'strict',
            theme: 'light',
            colorPalette: 'mint',
            soundMuted: true,
            soundProfile: 'magic',
            volume: 0.5,
            showHands: true,
            showKeyboard: true,
            testMode: 'words',
            testWordCount: 10,
            testDuration: 60,
            punctuation: false,
            numbers: false,
            futureSetting: ['keep']
        },
        progress: {
            'amat-intro': { completed: true, stars: 3 },
            'amat-1': { completed: true, stars: 1, futureProgress: ['keep'] },
            'words-v1:amat-1': { completed: true, stars: 3 },
            'amat-2': { completed: false, stars: 2 },
            'words-v1:amat-4': { completed: true, stars: 3 },
            'pro-1': { completed: true, stars: 3 },
            'words-v1:pro-3': { completed: true, stars: 2 }
        },
        history: [{
            lessonId: 'amat-1',
            wpm: 35,
            accuracy: 98,
            stars: 2,
            date: '2026-10-06T12:00:00Z',
            futureHistory: ['keep']
        }],
        stats: { totalSessions: 1, futureStats: ['keep'] },
        learning: {
            version: 1,
            futureLearning: ['keep'],
            keys: { q: { ...strongest }, w: { ...next } },
            bigrams: { qz: { ...strongest }, wv: { ...next } }
        }
    };
}

async function visit(page, app, saved) {
    if (saved) await page.addInitScript(({ key, value }) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }, { key: storageKey, value: JSON.stringify(saved) });
    await page.goto(app.route);
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
}

async function openLessons(page, track) {
    await page.getByRole('button', { name: /^(?:learn|Lessons)$/ }).click();
    const dialog = dialogWithHeading(page, 'Build your muscle memory');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: track, exact: true }).click();
    return dialog;
}

async function custom(page, text) {
    await page.getByRole('button', { name: /^(?:custom|Custom text)$/ }).click();
    await page.getByRole('textbox', { name: 'Text to practice', exact: true }).fill(text);
    await page.getByRole('button', { name: /^(?:Start practice|Start custom text)$/ }).click();
    await expect(input(page)).toBeFocused();
}

async function finish(page, lines = 1, firstOffset = 0) {
    const previous = JSON.parse(await savedBytes(page))?.history?.length || 0;
    for (let line = 0; line < lines; line++) {
        const text = await passage(page);
        expect(text.length).toBeGreaterThan(0);
        await input(page).focus();
        await input(page).pressSequentially(text.slice(line === 0 ? firstOffset : 0), {
            delay: 3
        });
    }
    await expect(resultView(page)).toBeVisible();
    await expect.poll(async () => JSON.parse(await savedBytes(page))?.history?.length || 0)
        .toBe(previous + 1);
}

function expectPreserved(after, before) {
    expect(after.futureRoot).toEqual(before.futureRoot);
    expect(after.settings.futureSetting).toEqual(before.settings.futureSetting);
    expect(after.progress).toMatchObject(before.progress);
    expect(after.stats.futureStats).toEqual(before.stats.futureStats);
    expect(after.history.at(-1)).toEqual(before.history[0]);
    expect(after.learning.futureLearning).toEqual(before.learning.futureLearning);
    expect(after.learning.keys.q.futureCell).toEqual(['keep']);
    expect(after.learning.bigrams.qz.futureCell).toEqual(['keep']);
}

async function observeWasm(page) {
    await page.addInitScript(() => {
        const audit = window.languageAudit = {
            modules: [],
            calls: {},
            blocked: false,
            blockedCalls: 0
        };
        const wrap = (instance, imports) => {
            const exports = instance.exports;
            const names = Object.keys(exports);
            audit.modules.push(names);
            const observed = Object.fromEntries(Object.entries(exports).map(([name,
                value]) => [name, typeof value === 'function' ? (...
                args) => {
                audit.calls[name] = (audit.calls[name] || 0) + 1;
                if (audit.blocked &&
                    /(?:^|_)(?:event|dispatch)$|^run$/.test(name)) {
                    audit.blockedCalls++;
                    if (name === 'run') {
                        imports.env.read();
                        imports.env.read();
                    }
                    return 0;
                }
                return value(...args);
                } : value]));
            return new Proxy(instance, {
                get: (target, property) => property === 'exports'
                    ? observed : Reflect.get(target, property, target)
            });
        };
        for (const name of ['instantiate', 'instantiateStreaming']) {
            const original = WebAssembly[name];
            WebAssembly[name] = async function(...args) {
                const result = await original.apply(this, args);
                return result.instance ? {
                        ...result,
                        instance: wrap(result
                            .instance, args[1])
                    }
                    : wrap(result, args[1]);
            };
        }
    });
}

for (const app of applications) {
    test.describe(`${app.name} full language application`, () => {
        test.use({ timezoneId: 'Europe/Bucharest', locale: 'en-GB' });
        const errors = new WeakMap();
        const scripts = new WeakMap();
        test.beforeEach(async ({ page }) => {
            const messages = [];
            const sources = [];
            errors.set(page, messages);
            scripts.set(page, sources);
            page.on('pageerror', error => messages.push(error.message));
            page.on('console', message => {
                if (message.type() === 'error') messages.push(message
                    .text());
            });
            page.on('response', response => {
                if (response.status() === 200 && response.request()
                    .resourceType() === 'script') sources.push(
                    response.text().then(source => ({
                        url: response
                            .url(),
                        source
                    }))
                    .catch(error => ({
                        url: response.url(),
                        error: error.message
                    })));
            });
        });
        test.afterEach(async ({ page }) => {
            expect(errors.get(page)).toEqual([]);
            expect(scripts.get(page).length,
                    'Inspect at least one loaded browser script.')
                .toBeGreaterThan(0);
            for (const { url, source, error } of await Promise.all(scripts.get(
                    page))) {
                expect(error, `Could not inspect loaded script ${url}`)
                    .toBeUndefined();
                expect(new URL(url).pathname).not.toMatch(/\/(?:src|js)\//);
                expect(source, `React runtime loaded from ${url}`).not.toMatch(
                    /react\.transitional\.element|__REACT_DEVTOOLS_GLOBAL_HOOK__|react-dom\/client/
                );
            }
        });

        test('WebAssembly owns navigation and native-input scoring, without a JavaScript fallback',
            async ({ page }) => {
                await observeWasm(page);
                const loading = page.waitForResponse(response => /\.wasm(?:\?|$)/
                    .test(response.url()));
                await visit(page, app);
                const module = await loading;
                expect(module.ok()).toBe(true);
                expect(module.headers()['content-type']).toContain(
                    'application/wasm');
                expect(Array.from((await module.body()).subarray(0, 8)))
                    .toEqual([0, 97, 115, 109, 1, 0, 0, 0]);
                const names = await page.evaluate(() => window.languageAudit.modules
                    .flat());
                expect(names.some(name => /(?:^|_)(?:event|dispatch)$|^run$/.test(
                            name)),
                        'The WASM module must expose application dispatch, not only typing arithmetic.'
                    )
                    .toBe(true);
                await page.evaluate(() => { window.languageAudit.blocked = true; });
                await page.getByRole('button', { name: 'Settings', exact: true })
                    .click();
                await expect(page.getByRole('dialog')).toHaveCount(0);
                expect(await page.evaluate(() => window.languageAudit.blockedCalls))
                    .toBeGreaterThan(0);
                await page.evaluate(() => {
                    window.languageAudit.blocked =
                        false;
                });
                await page.getByRole('button', { name: 'Settings', exact: true })
                    .click();
                await expect(dialogWithHeading(page, 'Make it your own'))
                    .toBeVisible();
                await page.keyboard.press('Escape');
                await custom(page, 'ab ba');
                await page.evaluate(() => { window.languageAudit.blocked = true; });
                await input(page).pressSequentially('x');
                await expect(page.locator('.typing-text .char.incorrect'))
                    .toHaveCount(0);
                await expect(page.locator('.typing-text .char.correct'))
                    .toHaveCount(0);
                expect(await savedBytes(page)).toBeNull();
                await page.evaluate(() => {
                    window.languageAudit.blocked =
                        false;
                });
                await input(page).fill('');
                const before = await page.evaluate(() => ({
                    ...window.languageAudit
                    .calls
                }));
                await input(page).pressSequentially('axb ba', { delay: 20 });
                await expect(resultView(page)).toBeVisible();
                await expect.poll(async () => JSON.parse(await savedBytes(page))
                        ?.history?.length)
                    .toBe(1);
                const saved = JSON.parse(await savedBytes(page));
                expect(saved.history[0]).toMatchObject({
                    wpmMetric: 'words-v1',
                    typingMode: 'strict',
                    errorKeystrokes: 1,
                    skippedChars: 0
                });
                expect(saved.history[0].accuracy).toBe(83.3);
                expect(saved.history[0].wpm).toBeGreaterThan(0);
                expect(saved.history[0].learning.keys.b.errors).toBe(1);
                const after = await page.evaluate(() => window.languageAudit.calls);
                expect(Object.entries(after).some(([name, count]) =>
                        /(?:^|_)(?:event|dispatch)$|^run$/.test(name) && count >
                        (before[name] || 0)))
                    .toBe(true);
            });

        test.describe('phone learning', () => {
            test.use({ hasTouch: true, viewport: { width: 375, height: 812 } });
            test('autoplay pauses for controls and dialogs without saving a typing session',
                async ({ page }) => {
                    await page.clock.install({
                        time: new Date(
                            '2026-10-07T09:00:00Z')
                    });
                    await page.clock.pauseAt(new Date(
                        '2026-10-07T09:01:00Z'));
                    await visit(page, app);
                    await page.clock.runFor(32);
                    const demo = page.getByRole(
                        'region', { name: 'Finger demo', exact: true });
                    const target = demo.getByLabel(
                        'Demo target', { exact: true });
                    await expect(demo).toBeVisible();
                    await expect(target).toHaveText('f');
                    await expect(input(page)).toBeHidden();
                    await page.clock.runFor(1100);
                    await expect(target).toHaveText('Space');
                    await demo.getByRole('button', {
                        name: 'Pause demo',
                        exact: true
                    }).tap();
                    await page.clock.runFor(5000);
                    await expect(target).toHaveText('Space');
                    await demo.getByRole('button', {
                        name: 'Next key',
                        exact: true
                    }).tap();
                    await expect(target).toHaveText('r');
                    await expect(demo.locator('#finger-left-index'))
                        .toHaveAttribute('data-reach-row', 'upper');
                    await demo.getByRole('button', {
                        name: 'Play demo',
                        exact: true
                    }).tap();
                    await page.getByRole('button', {
                        name: 'Settings',
                        exact: true
                    }).tap();
                    await page.clock.runFor(5000);
                    await page.keyboard.press('Escape');
                    await expect(target).toHaveText('r');
                    expect(await savedBytes(page)).toBeNull();
                    await demo.getByRole(
                            'button', {
                                name: 'Try this lesson',
                                exact: true
                            })
                        .tap();
                    await page.clock.runFor(32);
                    await expect(demo).toBeHidden();
                    await expect(input(page)).toBeVisible();
                    const first = (await passage(page))[0];
                    await input(page).pressSequentially(first);
                    await expect(page.locator('.typing-text .char.correct'))
                        .toHaveCount(1);
                    expect(await savedBytes(page)).toBeNull();
                });

            test('reduced motion makes finger guidance manual and preserves opposite-hand Shift',
                async ({ page }) => {
                    await page.emulateMedia({ reducedMotion: 'reduce' });
                    await page.clock.install({
                        time: new Date(
                            '2026-10-07T09:00:00Z')
                    });
                    await page.clock.pauseAt(new Date(
                        '2026-10-07T09:01:00Z'));
                    await visit(page, app);
                    await page.clock.runFor(32);
                    const demo = page.getByRole(
                        'region', { name: 'Finger demo', exact: true });
                    const target = demo.getByLabel(
                        'Demo target', { exact: true });
                    await expect(demo).toContainText(
                        'Reduced motion: use Next key');
                    await expect(demo.getByRole(
                            'button', { name: /Play demo|Pause demo/ }))
                        .toHaveCount(0);
                    await page.clock.runFor(10000);
                    await expect(target).toHaveText('f');
                    for (const letter of ['Space', 'r', 'Space', 'f',
                            'Space', 'j', 'Space',
                        'u', 'Space', 'j', 'Space', 'F', 'Space', 'J']) {
                        await demo.getByRole('button', {
                            name: 'Next key',
                            exact: true
                        }).tap();
                        await expect(target).toHaveText(letter);
                        if (letter === 'F' || letter === 'J') await expect(
                                demo.locator(
                                    `[data-code="${letter === 'F' ? 'ShiftRight' : 'ShiftLeft'}"]`
                                ))
                            .toHaveClass(/key-shift-target/);
                    }
                    expect(await savedBytes(page)).toBeNull();
                });
        });

        for (const [layout, left, right] of [
            ['mac-us', 'asdf', 'jkl;'], ['colemak', 'arst', 'neio'],
            ['dvorak', 'aoeu', 'htns'], ['uk-iso', 'asdf', 'jkl;']
        ]) {
            test(`${layout} continues learning and merges both lesson tracks without writing saved data`,
                async ({ page }) => {
                    const saved = savedPractice(layout);
                    await visit(page, app, saved);
                    const returning = page.locator(
                        '[aria-label="Return to learning"]');
                    await expect(returning).toContainText(
                        'Lesson 1: Left Hand Home');
                    await returning.getByRole('button', {
                            name: 'Continue lesson',
                            exact: true
                        })
                        .click();
                    expect([...await passage(page)].every(key => `${left} `
                            .includes(key)))
                        .toBe(true);
                    await expect(input(page)).toBeFocused();
                    let dialog = await openLessons(page, 'Foundations');
                    await expect(dialog.getByRole(
                            'region', { name: 'Saved track progress' }))
                        .toContainText('3 of 11 completed · 2 of 11 with 3 stars');
                    const first = dialog.locator('.lesson-list button')
                        .filter({ hasText: 'Left Hand Home' });
                    await expect(first.getByRole(
                            'img', { name: 'Earned stars: 3 of 3' }))
                        .toBeVisible();
                    await expect(dialog.locator('.lesson-list button')).toHaveCount(
                        12);
                    await expect(dialog.locator('.lesson-list button:disabled'))
                        .toHaveCount(0);
                    await expect(dialog.locator('.lesson-list button')
                        .filter({ hasText: 'Basic Position' })).toContainText(
                        'Optional introduction');
                    await expect(dialog.getByRole(
                            'complementary', { name: 'Suggested lesson' }))
                        .toContainText('Lesson 3: Home Row Words');
                    await dialog.getByRole('button', {
                        name: 'Advanced',
                        exact: true
                    }).click();
                    await expect(dialog.getByRole(
                            'region', { name: 'Saved track progress' }))
                        .toContainText('2 of 10 completed · 1 of 10 with 3 stars');
                    await expect(dialog.getByRole(
                            'complementary', { name: 'Suggested lesson' }))
                        .toContainText('Lesson 2: Right Hand Home');
                    await dialog.getByRole(
                            'button', {
                                name: 'Start suggested lesson',
                                exact: true
                            })
                        .click();
                    expect([...await passage(page)].every(key => `${right} `
                            .includes(key)))
                        .toBe(true);
                    await expect(page.locator('.hands-container')).toBeVisible();
                    await expect(page.locator('.keyboard-container')).toBeVisible();
                    expect(await savedBytes(page)).toBe(JSON.stringify(saved));
                    await page.reload();
                    dialog = await openLessons(page, 'Advanced');
                    await expect(dialog.getByRole(
                            'region', { name: 'Saved track progress' }))
                        .toContainText('2 of 10 completed');
                    expect(await savedBytes(page)).toBe(JSON.stringify(saved));
                });
        }

        test('history has local-day streaks, honest score gaps and accessible daily averages',
            async ({ page }) => {
                await page.clock.setFixedTime(new Date('2026-10-07T09:00:00Z'));
                const saved = savedPractice();
                const session = (date, wpm, extra = {}) => ({
                    lessonId: 'amat-1',
                    date,
                    wpm,
                    rawWpm: wpm + 5,
                    accuracy: 90,
                    wpmMetric: 'words-v1',
                    elapsedMilliseconds: 30000,
                    ...extra
                });
                saved.history = [
                    session('2026-10-07T08:00:00Z', 60, { futureHistory: ['keep'] }),
                    session('2026-10-06T08:00:00Z', 40),
                    session('2026-10-04T08:00:00Z', 30),
                    session('2026-10-03T08:00:00Z', 20),
                    session('2026-10-02T08:00:00Z', 10),
                    session('2026-09-29T08:00:00Z', 900, { wpmMetric: undefined }),
                    session('2026-10-04T07:00:00Z', 999, { elapsedMilliseconds: 0 })
                ];
                await visit(page, app, saved);
                await page.getByRole(
                    'button', { name: /^(?:Session history|History)$/ }).click();
                const dialog = dialogWithHeading(page, 'Your recent sessions');
                const progress = dialog.getByRole(
                    'region', { name: 'Practice progress' });
                await expect(progress.locator('dl > div')
                        .filter({ hasText: 'Current streak' }))
                    .toContainText('2 days');
                await expect(progress.locator('dl > div')
                    .filter({ hasText: 'Longest saved streak' })).toContainText(
                    '3 days');
                for (const label of ['WPM', 'Accuracy']) {
                    const chart = progress.getByRole('img', {
                        name: new RegExp(
                            `^${label} daily averages`)
                    });
                    await expect(chart).toBeVisible();
                    await expect(chart.locator('path')).toHaveCount(5);
                    await expect(chart.locator('polyline')).toHaveCount(3);
                }
                await progress.getByText('View daily averages', { exact: true })
                    .click();
                const daily = progress.getByRole(
                    'table', { name: 'Daily practice · local dates' });
                const day = date => daily.getByRole('row').filter({
                    has: page.locator(`time[datetime="${date}"]`)
                });
                await expect(day('2026-10-05').getByRole('cell')).toHaveText(['0',
                    '—', '—']);
                await expect(day('2026-10-04').getByRole('cell'))
                    .toHaveText(['2', '30.0', '90.0%']);
                await expect(day('2026-09-29').getByRole('cell')).toHaveText(['1',
                    '—', '—']);
                await expect(dialog.getByRole('table', { name: /^Last 7 sessions/ })
                    .getByRole('row')).toHaveCount(8);
                await expect(dialog).toContainText('Earlier scoring');
                expect(await savedBytes(page)).toBe(JSON.stringify(saved));
            });

        test('lesson results expose coaching, stars, a measured speed chart, key details and a real PNG',
            async ({ page }) => {
                await visit(page, app);
                await finish(page, 4);
                const result = resultView(page);
                await expect(result).toContainText('stars this attempt');
                await expect(result).toContainText('3-star target');
                await expect(result.getByRole('button', {
                        name: 'Next lesson',
                        exact: true
                    }))
                    .toBeFocused();
                await expect(result.getByText('personal best ↗', { exact: true }))
                    .toBeVisible();
                await expect(result.getByRole(
                    'img', { name: /speed samples? over/ })).toBeVisible();
                await result.getByText('View speed samples', { exact: true })
                    .click();
                await expect(result).toContainText(
                    'Overall WPM at each recorded time.');
                const heatmap = result.getByRole(
                    'region', { name: 'Target-key heatmap' });
                await expect(heatmap).toBeVisible();
                await heatmap.getByText(
                    'View key and pair details', { exact: true }).click();
                await expect(heatmap.getByRole('table', { name: /^Target keys/ }))
                    .toBeVisible();
                await expect(heatmap.getByRole(
                        'table', { name: /^Most difficult pairs/ }))
                    .toBeVisible();
                const before = await savedBytes(page);
                const downloading = page.waitForEvent('download');
                await result.getByRole('button', {
                        name: 'Download result card',
                        exact: true
                    })
                    .click();
                const download = await downloading;
                expect(await download.failure()).toBeNull();
                const png = await readFile(await download.path());
                expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13,
                    10, 26, 10]);
                expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200,
                    780]);
                expect(png.length).toBeGreaterThan(10000);
                await expect(result.getByText(
                        'Result card downloaded.', { exact: true }))
                    .toBeVisible();
                expect(await savedBytes(page)).toBe(before);
            });

        test('test options, practice-only repeats, attributed quotes and normalized custom text remain available',
            async ({ page }) => {
                const saved = savedPractice();
                await visit(page, app, saved);
                for (const option of ['punctuation', 'numbers']) {
                    const button = page.getByRole('button', {
                        name: option,
                        exact: true
                    });
                    await button.click();
                    await expect(button).toHaveAttribute('aria-pressed', 'true');
                }
                const generated = await passage(page);
                expect(generated).toMatch(/\d/);
                expect(generated).toMatch(/[.,]/);
                expect(generated.split(' ')).toHaveLength(10);
                await finish(page);
                const afterTest = JSON.parse(await savedBytes(page));
                expect(afterTest.history[0]).toMatchObject({
                    lessonId: 'words-10-punctuation-numbers',
                    recordEligible: true,
                    wpmMetric: 'words-v1'
                });
                expect(afterTest.stats.wordHighestWpm).toBe(afterTest.history[0]
                    .wpm);
                await resultView(page).getByRole(
                        'button', { name: 'Repeat this text', exact: true })
                    .click();
                expect(await passage(page)).toBe(generated);
                await finish(page);
                const afterRepeat = JSON.parse(await savedBytes(page));
                expect(afterRepeat.history[0].recordEligible).toBe(false);
                expect(afterRepeat.progress).toEqual(afterTest.progress);
                expect(afterRepeat.stats.wordHighestWpm).toBe(afterTest.stats
                    .wordHighestWpm);
                await expect(resultView(page)).toContainText(
                    'Practice sessions do not qualify for records.');
                await page.getByRole('button', { name: /^(?:quote|Quotes)$/ })
                    .click();
                const quote = await passage(page);
                expect(quote.length).toBeGreaterThan(20);
                const source = page.getByRole('link', { name: /(?:read|source)/i })
                    .filter({ hasNotText: /React|Swift|Brainfuck/i });
                await expect(source).toBeVisible();
                expect(new URL(await source.getAttribute('href')).protocol).toBe(
                    'https:');
                const beforeCustom = await savedBytes(page);
                await custom(page, '  café\nco\u00ADop\u200Ber  ');
                expect(await passage(page)).toBe('café cooper');
                expect(await savedBytes(page)).toBe(beforeCustom);
            });

        test('key and pair observations explain the next focus and preserve unknown saved fields',
            async ({ page }) => {
                const saved = savedPractice();
                await visit(page, app, saved);
                for (const [summary, region, action, target, lines, next] of [
                    ['Suggested key practice', 'Learning recommendation', 'Practice weak keys',
                        'q', 4, 'w'],
                    ['Suggested pair practice', 'Pair recommendation', 'Practice this pair: q → z',
                        'q → z', 2, 'w → v']
                ]) {
                    await page.getByText(summary, { exact: true }).click();
                    const recommendation = page.getByRole('region', {
                        name: region,
                        exact: true
                    });
                    await expect(recommendation).toContainText('80.0%');
                    await expect(recommendation).toContainText('900 ms');
                    await expect(recommendation).toContainText('across layouts');
                    await page.getByRole('button', { name: action, exact: true })
                        .click();
                    await finish(page, lines);
                    const comparison = page.getByRole(
                        'region', { name: 'Practice focus results' });
                    await expect(comparison).toContainText(
                        'This drill: this attempt only.');
                    await expect(comparison).toContainText(
                        'A short drill is not proof of mastery.');
                    const row = comparison.getByRole('row').filter({
                        has: page.getByRole('rowheader', {
                            name: target,
                            exact: true
                        })
                    });
                    await expect(row.getByRole('cell').first())
                        .toHaveText('80.0% recent errors, 900 ms recent reach');
                    await expect(row.getByRole('cell').nth(1)).toContainText(
                        '0.0% errors');
                    await expect(comparison).toContainText(`Next focus: ${next}`);
                    await expect(comparison).toContainText(
                        'now suggest a different focus.');
                    await expect(comparison.getByRole(
                            'button', { name: 'Start next drill', exact: true }
                        ))
                        .toBeFocused();
                    await expect.poll(async () => JSON.parse(await savedBytes(page))
                            .history.length)
                        .toBe(lines === 4 ? 2 : 3);
                    const after = JSON.parse(await savedBytes(page));
                    expectPreserved(after, saved);
                    expect(after.history[0].recordEligible).toBe(false);
                    await page.getByRole('button', {
                        name: 'Typeflow home',
                        exact: true
                    }).click();
                }
            });

        test('sound, appearance, guide controls and readable backups retain progress',
            async ({ page }) => {
                const saved = savedPractice();
                await page.emulateMedia({ colorScheme: 'dark' });
                await visit(page, app, saved);
                await page.getByRole('button', { name: 'Settings', exact: true })
                    .click();
                const settings = dialogWithHeading(page, 'Make it your own');
                const sound = settings.getByRole('group', {
                    name: 'Keyboard sound',
                    exact: true
                });
                const profiles = sound.getByRole(
                    'combobox', { name: 'Sound profile', exact: true });
                for (const profile of ['magic', 'thock', 'bubble', 'clicky']) {
                    if (await profiles.count()) {
                        await profiles.selectOption(profile);
                        await expect(profiles).toHaveValue(profile);
                    } else {
                        const choice = sound.getByRole('button', {
                            name: profile,
                            exact: true
                        });
                        await choice.click();
                        await expect(choice).toHaveAttribute('aria-pressed',
                            'true');
                    }
                }
                const mute = sound.getByRole('checkbox', {
                    name: 'Mute sound',
                    exact: true
                });
                if (await mute.count()) await mute.uncheck();
                else await sound.getByRole('checkbox', {
                    name: 'Enable sound',
                    exact: true
                }).check();
                await sound.getByRole('slider', { name: /^Volume/ }).fill('25');
                const appearance = settings.getByRole(
                    'combobox', { name: 'Appearance', exact: true });
                if (await appearance.count()) {
                    await appearance.selectOption('system');
                    await expect(appearance).toHaveValue('system');
                } else await settings.getByRole('group', {
                        name: 'Appearance',
                        exact: true
                    })
                    .getByRole('button', { name: 'system', exact: true }).click();
                const palette = settings.getByRole(
                    'combobox', { name: /^(?:Palette|Color palette)$/ });
                if (await palette.count()) {
                    await palette.selectOption('plum');
                    await expect(palette).toHaveValue('plum');
                } else await settings.getByRole('group', {
                        name: 'Color palette',
                        exact: true
                    })
                    .getByRole('button', { name: 'Plum', exact: true }).click();
                await settings.getByRole('checkbox', {
                        name: 'Show keyboard',
                        exact: true
                    })
                    .uncheck();
                await settings.getByRole(
                        'checkbox', { name: /^(?:Show hands|Show finger guidance)$/ }
                    )
                    .uncheck();
                await expect(page.locator('html')).toHaveAttribute('data-theme',
                    'dark');
                await expect(page.locator('html')).toHaveAttribute('data-palette',
                    'plum');
                await expect.poll(async () => JSON.parse(await savedBytes(page))
                        .settings)
                    .toMatchObject({
                        soundProfile: 'clicky',
                        soundMuted: false,
                        volume: 0.25,
                        theme: 'system',
                        colorPalette: 'plum',
                        showKeyboard: false,
                        showHands: false
                    });
                const changed = JSON.parse(await savedBytes(page));
                expectPreserved(changed, saved);
                expect(changed.history).toEqual(saved.history);
                expect(changed.stats).toMatchObject(saved.stats);
                await settings.getByRole('button', {
                        name: 'Manage saved progress',
                        exact: true
                    })
                    .click();
                const recovery = dialogWithHeading(page, 'Keep your progress');
                await recovery.getByText('View backup text', { exact: true })
                    .click();
                const backup = JSON.parse(await recovery.getByRole(
                        'textbox', { name: 'Backup JSON' })
                    .inputValue());
                expect(JSON.stringify(backup)).toContain('futureRoot');
                expect(JSON.stringify(backup)).toContain('futureCell');
                const before = await savedBytes(page);
                await page.keyboard.press('Escape');
                await page.reload();
                await expect(page.locator('html')).toHaveAttribute('data-palette',
                    'plum');
                await expect(page.locator('.keyboard-container')).toBeHidden();
                await expect(page.locator('.hands-container')).toBeHidden();
                expect(await savedBytes(page)).toBe(before);
                await page.emulateMedia({ colorScheme: 'light' });
                await expect(page.locator('html')).toHaveAttribute('data-theme',
                    'light');
            });
    });
}
