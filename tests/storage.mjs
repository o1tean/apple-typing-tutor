import assert from 'node:assert/strict';

let saved = null;
let writes = 0;
let blocked = false;
let readBlocked = false;
let onRead = null;
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const nativeNavigator = globalThis.navigator;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: undefined });
globalThis.localStorage = {
    getItem: () => {
        if (readBlocked) throw new Error('Storage unavailable');
        const snapshot = saved;
        const callback = onRead;
        onRead = null;
        callback?.();
        return snapshot;
    },
    setItem: (key, value) => {
        if (blocked) throw new Error('Storage quota exceeded');
        writes++;
        saved = value;
    }
};
const originalWarn = console.warn;
const originalNow = Date.now;
console.warn = () => {};

try {
    const { storage } = await import('../js/storage.js');
    const reload = value => {
        saved = typeof value === 'string' ? value : JSON.stringify(value);
        storage.data = storage.load();
    };
    assert.equal(storage.getSetting('typingMode'), 'strict');
    assert.equal(storage.getSetting('showHands'), true);
    assert.equal(storage.getSetting('showKeyboard'), true);
    assert.equal(storage.getSetting('colorPalette'), 'mint');
    assert.equal(storage.getSetting('keyboardLayout'), 'mac-us');
    assert.equal(saved, null, 'first-visit defaults never write during startup');
    reload({});
    const defaults = { ...storage.data.settings };
    assert.equal(defaults.typingMode, 'flow');
    assert.equal(defaults.showHands, false);
    assert.equal(defaults.showKeyboard, false);
    assert.equal(defaults.testMode, 'time');
    assert.equal(defaults.testDuration, 30);
    assert.equal(defaults.testWordCount, 25);
    assert.equal(defaults.colorPalette, 'mint');
    assert.equal(defaults.keyboardLayout, 'mac-us');

    for (const corrupted of ['{', 'null', 'false', '7', '[]', '"bad"']) {
        reload(corrupted);
        assert.deepEqual(storage.data.settings, defaults);
        assert.equal(storage.getStats().totalSessions, 0);
        assert.deepEqual(storage.data.history, []);
    }
    reload({
        settings: {
            theme: 'pink',
            colorPalette: 'purple',
            keyboardLayout: 'unknown',
            volume: '0.2',
            soundMuted: 'false',
            typingMode: null,
            showHands: 1,
            testMode: 'invalid',
            testDuration: 1,
            testWordCount: -5,
            punctuation: 'yes',
            numbers: 0
        },
        progress: [],
        history: {},
        stats: {
            totalSessions: -1,
            totalKeystrokes: '10',
            totalTimeSeconds: null,
            highestWpm: -10,
            wordHighestWpm: Infinity
        }
    });
    assert.deepEqual(storage.data.settings, defaults);
    assert.deepEqual(storage.getStats(), {
        totalSessions: 0,
        totalKeystrokes: 0,
        totalTimeSeconds: 0,
        highestWpm: 0,
        wordHighestWpm: 0
    });
    assert.deepEqual(storage.data.history, []);

    const lesson = { completed: true, bestWpm: 80, bestAccuracy: 99, stars: 3, lastPlayed: 123 };
    const previous = {
        lessonId: 'amat-intro',
        wpm: 80,
        accuracy: 99,
        consistency: 100,
        stars: 3,
        date: '2026-10-06T00:00:00.000Z'
    };
    for (const theme of ['light', 'dark', 'system']) {
        const oldSave = {
            futureRoot: { version: 5 },
            settings: { theme, futureSetting: { layout: 'future' } },
            progress: { 'amat-intro': { ...lesson, futureProgress: [1, 2] } },
            history: [{ ...previous, futureHistory: 'keep' }],
            stats: { totalSessions: 3, highestWpm: 80, futureStats: true }
        };
        const writesBeforeLoad = writes;
        reload(oldSave);
        assert.equal(writes, writesBeforeLoad, 'old-format palette defaults never write at load');
        assert.equal(saved, JSON.stringify(oldSave), 'loading preserves the stored bytes');
        assert.equal(storage.getSetting('theme'), theme, 'old appearance choices remain intact');
        assert.equal(storage.getSetting('colorPalette'), 'mint');
        const baseline = JSON.parse(JSON.stringify(storage.data));
        for (const colorPalette of ['ocean', 'plum', 'mint']) {
            assert.equal(await storage.setSetting('colorPalette', colorPalette), true);
            assert.deepEqual(JSON.parse(saved), {
                ...baseline,
                settings: { ...baseline.settings, colorPalette }
            }, 'palette saves preserve scores, progress, history and unknown fields');
            storage.data = storage.load();
            assert.equal(storage.getSetting('colorPalette'), colorPalette);
            assert.equal(storage.getSetting('theme'), theme);
        }
        const persisted = saved;
        const writesBeforeInvalid = writes;
        for (const value of ['purple', 'MINT', null, true, {}]) {
            assert.equal(await storage.setSetting('colorPalette', value), false);
        }
        assert.equal(saved, persisted, 'invalid palette settings cannot change stored data');
        assert.equal(writes, writesBeforeInvalid);
        assert.equal(storage.getSetting('colorPalette'), 'mint');
    }
    const beforeLayouts = {
        futureRoot: { version: 7 },
        settings: { theme: 'dark', colorPalette: 'plum', futureSetting: { enabled: true } },
        progress: { 'amat-intro': { ...lesson, futureProgress: ['keep'] } },
        history: [{ ...previous, futureHistory: true }],
        stats: { totalSessions: 3, highestWpm: 80, futureStats: 'keep' }
    };
    const beforeLayoutWrites = writes;
    reload(beforeLayouts);
    assert.equal(storage.getSetting('keyboardLayout'), 'mac-us');
    assert.equal(writes, beforeLayoutWrites, 'layout defaults migrate without startup writes');
    assert.equal(saved, JSON.stringify(beforeLayouts));
    const layoutBaseline = JSON.parse(JSON.stringify(storage.data));
    for (const keyboardLayout of ['colemak', 'dvorak', 'mac-us']) {
        assert.equal(await storage.setSetting('keyboardLayout', keyboardLayout), true);
        assert.deepEqual(JSON.parse(saved), {
            ...layoutBaseline,
            settings: { ...layoutBaseline.settings, keyboardLayout }
        }, 'layout saves preserve appearance, scores, progress and unknown fields');
        storage.data = storage.load();
        assert.equal(storage.getSetting('keyboardLayout'), keyboardLayout);
    }
    const layoutSaved = saved;
    const layoutWrites = writes;
    for (const value of ['qwerty', 'COLEMAK', 'pc-us', 'mac-uk', '', null, true, {}]) {
        assert.equal(await storage.setSetting('keyboardLayout', value), false);
    }
    assert.equal(saved, layoutSaved, 'unsupported layout settings cannot write saved data');
    assert.equal(writes, layoutWrites);

    reload({
        settings: {
            theme: 'light',
            typingMode: 'strict',
            showHands: true,
            showKeyboard: true,
            volume: 0,
            testMode: 'words',
            testDuration: 120,
            testWordCount: 100,
            punctuation: true,
            numbers: true
        },
        progress: {
            'amat-intro': lesson,
            broken: false,
            bad: {
                bestWpm: 'fast',
                bestAccuracy: 150,
                stars: 4
            }
        },
        history: [null, 5, { wpm: 50 }, previous],
        stats: {
            totalSessions: 3,
            totalKeystrokes: 100,
            totalTimeSeconds: 30.5,
            highestWpm: 80
        }
    });
    assert.equal(storage.getSetting('typingMode'), 'strict');
    assert.equal(storage.getSetting('showHands'), true);
    assert.equal(storage.getSetting('volume'), 0);
    assert.equal(storage.getSetting('testWordCount'), 100);
    assert.deepEqual(storage.getLessonProgress('amat-intro'), lesson);
    assert.equal(storage.getLessonProgress('broken'), null);
    assert.equal(storage.getLessonProgress('bad').bestWpm, 0);
    assert.equal(storage.getLessonProgress('bad').bestAccuracy, 0);
    assert.equal(storage.getLessonProgress('bad').stars, 0);
    assert.deepEqual(storage.data.history, [previous]);
    assert.equal(storage.getStats().totalTimeSeconds, 30.5);
    assert.equal(storage.getStats().wordHighestWpm, 0, 'legacy saves have no word-based best');

    const stats = {
        wpm: 70,
        rawWpm: 75,
        accuracy: 98,
        consistency: 90,
        totalKeystrokes: 200,
        correctKeystrokes: 196,
        correctNonSpaceChars: 150,
        errorKeystrokes: 4,
        skippedChars: 0,
        elapsedSeconds: 30
    };
    const testSettings = {
        testMode: 'words',
        testWordCount: 25,
        punctuation: true,
        numbers: false
    };
    await storage.recordLesson('words-25', stats, 45, 95, testSettings);
    assert.equal(storage.getStats().totalSessions, 4);
    assert.equal(storage.getStats().totalKeystrokes, 300);
    assert.equal(storage.getStats().highestWpm, 80);
    assert.equal(storage.data.history[0].rawWpm, 75);
    assert.equal(storage.data.history[0].consistency, 90);
    assert.equal(storage.data.history[0].elapsedSeconds, 30);
    assert.equal(storage.data.history[0].testWordCount, 25);
    assert.equal(storage.data.history[0].correctKeystrokes, 196);
    assert.equal(storage.data.history[0].correctNonSpaceChars, 150);
    assert.equal(storage.data.history[0].recordEligible, true);
    assert.deepEqual(storage.load(), storage.data,
        'valid preferences and scores survive a round trip');
    const unmeasuredStats = { ...stats, wpmMetric: 'words-v1' };
    delete unmeasuredStats.consistency;
    for (const supplied of [unmeasuredStats, { ...unmeasuredStats, consistency: null }]) {
        await storage.recordLesson('unmeasured-consistency', supplied);
        assert.equal(Object.hasOwn(storage.data.history[0], 'consistency'), false,
            'missing or null consistency is omitted when recording');
        assert.equal(Object.hasOwn(storage.load().history[0], 'consistency'), false,
            'unavailable consistency remains omitted after reload');
    }
    for (const [key, value] of [['constructor', false], ['__proto__', {}], ['volume', Infinity], [
            'volume', -1], ['testDuration', 31], ['soundMuted', 1]]) {
        await storage.setSetting(key, value);
    }
    assert.equal(storage.getSetting('constructor'), undefined);
    assert.equal(storage.getSetting('volume'), 0);
    assert.equal(storage.getSetting('testDuration'), 120);
    assert.equal(storage.getSetting('soundMuted'), false);

    assert.equal(storage.getLessonProgress('constructor'), null);
    assert.equal(storage.getLessonProgress('__proto__'), null);
    for (const lessonId of ['__proto__', 'constructor', 'toString']) {
        await storage.recordLesson(lessonId, stats);
        assert.equal(storage.getLessonProgress(lessonId).bestWpm, 70);
    }
    assert.equal(Object.getPrototypeOf(storage.getAllProgress()), null);
    assert.deepEqual(storage.load(), storage.data,
        'prototype-sensitive IDs persist as ordinary lesson IDs');
    for (let index = 0; index < 55; index++) await storage.recordLesson('custom', stats);
    assert.equal(storage.data.history.length, 50);

    const staleTab = new storage.constructor();
    const newer = {
        schemaVersion: 2,
        futureRoot: { keys: { q: { errors: 3, latency: [150, 200] } } },
        ['__proto__']: { futureOwn: true },
        settings: { volume: 'invalid', futureSetting: { layout: 'future-layout' } },
        stats: { totalSessions: 5, highestWpm: -1, futureStats: [null, 0, false] },
        progress: Object.fromEntries(['__proto__', 'constructor'].map(id => [id, {
            ...lesson,
            timestamp: 'invalid',
            futureProgress: { id, attempts: [1, 2] }
        }])),
        history: [{
            ...previous,
            wpmMetric: 'words-v1',
            rawWpm: 'invalid',
            consistency: null,
            testWordCount: -1,
            correctKeystrokes: 'invalid',
            recordEligible: 'invalid',
            recordReason: 42,
            futureHistory: { drill: 'q', errors: [1, 4] }
        }]
    };
    const futureFields = data => ({
        version: data.schemaVersion,
        root: data.futureRoot,
        ownProto: data['__proto__'],
        settings: data.settings.futureSetting,
        stats: data.stats.futureStats,
        progress: Object.fromEntries(['__proto__', 'constructor'].map(id => [id, data
            .progress[id].futureProgress])),
        history: data.history.find(entry => entry.lessonId === previous.lessonId)
            .futureHistory
    });
    const expectedFuture = futureFields(newer);
    reload(newer);
    assert.deepEqual(futureFields(storage.data), expectedFuture, 'load preserves newer fields');
    assert.equal(storage.getSetting('volume'), defaults.volume, 'known settings remain validated');
    assert.equal(storage.getStats().highestWpm, 0, 'known stats remain validated');
    const invalidHistoryFields = ['rawWpm', 'consistency', 'testWordCount', 'correctKeystrokes',
        'recordEligible', 'recordReason'];
    for (const key of invalidHistoryFields) {
        assert.equal(Object.hasOwn(storage.data.history[0], key), false,
            `loaded invalid ${key} is removed despite preserving history extras`);
    }
    assert.equal(Object.hasOwn(storage.data.progress['__proto__'], 'timestamp'), false);
    assert.equal(Object.getPrototypeOf(storage.getAllProgress()), null);
    assert.equal(Object.getPrototypeOf(storage.data), Object.prototype);
    assert.equal({}.futureOwn, undefined,
        'preserved prototype-sensitive keys cannot pollute objects');

    await storage.setSetting('soundMuted', true);
    assert.deepEqual(futureFields(JSON.parse(saved)), expectedFuture,
        'a setting save preserves newer fields');
    await storage.recordLesson('__proto__', stats);
    assert.deepEqual(futureFields(JSON.parse(saved)), expectedFuture,
        'recording a result preserves newer fields, including that lesson\'s metadata');
    await staleTab.setSetting('theme', 'light');
    assert.deepEqual(futureFields(JSON.parse(saved)), expectedFuture,
        'a tab opened before the newer save refreshes and preserves its fields');
    assert.equal(staleTab.getStats().totalSessions, 6, 'stale saves keep the latest result');
    assert.equal(staleTab.getSetting('soundMuted'), true,
        'stale saves keep unrelated new settings');

    blocked = true;
    assert.equal((await storage.recordLesson('constructor', stats)).saved, false);
    blocked = false;
    assert.deepEqual(futureFields(JSON.parse(storage.exportBackup()).session), expectedFuture,
        'recovery backups retain unknown fields with the unsaved result');
    assert.equal(await storage.retrySave(), true);
    assert.deepEqual(futureFields(JSON.parse(saved)), expectedFuture,
        'quota recovery preserves newer fields');
    assert.equal(storage.getStats().totalSessions, 7, 'recovery records the result exactly once');
    const persistedHistory = JSON.parse(saved).history.find(entry =>
        entry.lessonId === previous.lessonId);
    for (const key of invalidHistoryFields) {
        assert.equal(Object.hasOwn(persistedHistory, key), false,
            `saving cannot restore invalid known ${key}`);
    }

    reload({ progress: { 'time-30': lesson } });
    const plain = {
        testMode: 'time',
        testDuration: 30,
        typingMode: 'flow',
        punctuation: false,
        numbers: false
    };
    const punctuated = { ...plain, punctuation: true };
    const numbered = { ...plain, numbers: true };
    const guided = { ...plain, typingMode: 'strict' };
    assert.equal((await storage.recordLesson('time-30', stats, 45, 95, plain)).isNewBestWpm, true);
    assert.equal((await storage.recordLesson('time-30-punctuation', { ...stats, wpm: 50 }, 45, 95,
        punctuated)).isNewBestWpm, true);
    assert.equal((await storage.recordLesson('time-30-numbers', { ...stats, wpm: 60 }, 45, 95,
            numbered))
        .isNewBestWpm, true);
    assert.equal((await storage.recordLesson('time-30', { ...stats, wpm: 55 }, 45, 95, guided))
        .isNewBestWpm, true);
    assert.equal(storage.getLessonProgress('time-30', plain).bestWpm, 70);
    assert.equal(storage.getLessonProgress('time-30', punctuated).bestWpm, 50);
    assert.equal(storage.getLessonProgress('time-30', numbered).bestWpm, 60);
    assert.equal(storage.getLessonProgress('time-30', guided).bestWpm, 55);
    assert.deepEqual(storage.getLessonProgress('time-30'), lesson,
        'unqualified legacy scores remain intact');
    assert.equal((await storage.recordLesson('time-30-renamed', { ...stats, wpm: 49 }, 45, 95,
            punctuated))
        .isNewBestWpm, false,
        'display ID suffixes do not create duplicate configuration buckets');
    assert.equal((await storage.recordLesson('time-30', { ...stats, wpm: 300, accuracy: 50 }, 45,
        95,
        plain)).recordEligible, false);
    assert.equal(storage.getLessonProgress('time-30', plain).bestWpm, 70);
    assert.equal(storage.getStats().highestWpm, 70);
    assert.equal((await storage.recordLesson('time-30', { ...stats, wpm: 300, skippedChars: 1 }, 45,
        95,
        plain)).stars, 0);
    assert.equal(storage.getLessonProgress('time-30', plain).bestWpm, 70);
    const wrongOnly = await storage.recordLesson('wrong-only', {
        ...stats,
        wpm: 0,
        accuracy: 0,
        correctKeystrokes: 0
    });
    assert.equal(wrongOnly.stars, 0);
    assert.equal(wrongOnly.recordEligible, false);
    assert.equal(storage.getLessonProgress('wrong-only'), null);
    const separatorsOnly = await storage.recordLesson('wrong-letters', {
        ...stats,
        wpm: 40,
        accuracy: 12.5,
        correctKeystrokes: 1,
        correctNonSpaceChars: 0
    });
    assert.equal(separatorsOnly.stars, 0,
        'correct separators alone cannot qualify wrong-only text');
    assert.equal(storage.getLessonProgress('wrong-letters'), null);
    const skippedOnly = await storage.recordLesson('skipped-only', {
        ...stats,
        wpm: 20,
        accuracy: 50,
        skippedChars: 10
    });
    assert.equal(skippedOnly.stars, 0);
    assert.equal(skippedOnly.isNewBestWpm, false);
    assert.equal(storage.getLessonProgress('skipped-only'), null);
    assert.equal((await storage.recordLesson('retry', stats, 45, 95, { recordEligible: false }))
        .isNewBestWpm, false);
    assert.equal(storage.getLessonProgress('retry'), null);
    const previousBucket = { ...storage.getLessonProgress('time-30', plain) };
    const previousHighest = storage.getStats().highestWpm;
    const practice = await storage.recordLesson('time-30', { ...stats, wpm: 500, accuracy: 100 },
        45,
        95, { ...plain, recordEligible: false });
    assert.equal(practice.stars, 0);
    assert.equal(practice.recordEligible, false);
    assert.deepEqual(storage.getLessonProgress('time-30', plain), previousBucket,
        'practice retries do not change lesson stars, accuracy, or best speed');
    assert.equal(storage.getStats().highestWpm, previousHighest);
    assert.equal((await storage.recordLesson('low-accuracy', { ...stats, accuracy: 94 }, 45, 95))
        .recordReason,
        'Records need at least 95% accuracy.');
    const sessions = storage.getStats().totalSessions;
    assert.equal(storage.data.history.length, sessions,
        'unqualified attempts stay in history and session totals');
    assert.deepEqual(storage.load(), storage.data,
        'qualified buckets and eligibility survive reload');

    const wordMetric = { wpmMetric: 'words-v1' };
    const wordStats = { ...stats, ...wordMetric };
    const legacyBuckets = { ...storage.getAllProgress() };
    const legacyHighest = storage.getStats().highestWpm;
    assert.equal((await storage.recordLesson('time-30', { ...wordStats, wpm: 50 }, 45, 95))
        .isNewBestWpm, true, 'new lesson records do not compare against legacy speeds');
    assert.equal(storage.getLessonProgress('time-30', wordMetric).bestWpm, 50);
    for (const [options, wpm] of [[plain, 60], [punctuated, 40], [guided, 45]]) {
        assert.equal((await storage.recordLesson('time-30', { ...wordStats, wpm }, 45, 95,
                options)).isNewBestWpm, true,
            'new test configurations have separate record buckets');
        assert.equal(storage.getLessonProgress('time-30', { ...options, ...wordMetric }).bestWpm,
            wpm);
    }
    assert.equal((await storage.recordLesson('time-30-renamed', { ...wordStats, wpm: 59 }, 45, 95,
        plain)).isNewBestWpm, false, 'new metric buckets still ignore display ID suffixes');
    assert.equal((await storage.recordLesson('time-30', { ...wordStats, wpm: 80 }, 45, 95, plain))
        .isNewBestWpm, true);
    assert.equal(storage.getStats().wordHighestWpm, 80);
    assert.equal(storage.getStats().highestWpm, legacyHighest,
        'a faster word-based score cannot replace the legacy global best');
    for (const [key, progress] of Object.entries(legacyBuckets)) {
        assert.deepEqual(storage.getAllProgress()[key], progress,
            'word-based records leave every legacy progress bucket unchanged');
    }
    assert.deepEqual(storage.getLessonProgress('time-30'), lesson);
    assert.equal(storage.getLessonProgress('time-30', plain).bestWpm, 70);
    assert.equal(storage.data.history[0].wpmMetric, 'words-v1');
    assert.equal(storage.data.history[0].consistency, 90);
    assert.deepEqual(storage.load(), storage.data, 'both metric families and markers reload');
    const beforeUnknownMetric = JSON.stringify(storage.data);
    for (const wpmMetric of ['words-v2', 'WORDS-v1', null, 1, {}]) {
        const unknown = await storage.recordLesson('time-30', { ...stats, wpmMetric }, 45, 95,
            plain);
        assert.equal(unknown.recordEligible, false);
        assert.equal(unknown.isNewBestWpm, false);
        assert.equal(storage.getLessonProgress('time-30', { ...plain, wpmMetric }), null,
            'unsupported metric getters cannot fall back to legacy records');
    }
    assert.equal(JSON.stringify(storage.data), beforeUnknownMetric,
        'unsupported metric results cannot change progress, history, or totals');
    assert.equal(storage.pendingLessons.length, 0);

    const totalTime = storage.getStats().totalTimeSeconds;
    const short = await storage.recordLesson('short', {
        ...stats,
        elapsedSeconds: 0,
        elapsedMilliseconds: 125
    });
    assert.equal(short.recordEligible, true, 'precise duration allows real subsecond typing');
    assert.equal(storage.getStats().totalTimeSeconds, totalTime + 0.125);
    assert.equal(storage.data.history[0].elapsedMilliseconds, 125);
    const slow = await storage.recordLesson('slow-zero-wpm', {
        wpm: 0,
        rawWpm: 0,
        accuracy: 100,
        totalKeystrokes: 2,
        correctKeystrokes: 2,
        correctNonSpaceChars: 2,
        elapsedMilliseconds: 300000
    }, 45, 95);
    assert.equal(slow.stars, 2, 'rounded-zero speed retains completion and accuracy stars');
    assert.equal(slow.recordEligible, true);
    assert.equal(slow.recordReason, null, 'rounded speed does not erase correct input');
    assert.equal(slow.isNewBestWpm, false);
    const slowProgress = storage.getLessonProgress('slow-zero-wpm');
    assert.equal(slowProgress.completed, true);
    assert.equal(slowProgress.bestAccuracy, 100);
    assert.equal(slowProgress.bestWpm, 0);
    assert.equal(slowProgress.stars, 2);
    assert.equal(storage.data.history[0].accuracy, 100);

    const roundedAccuracy = await storage.recordLesson('rounded-zero-accuracy', {
        wpm: 12,
        rawWpm: 12,
        accuracy: 0,
        totalKeystrokes: 10001,
        correctKeystrokes: 1,
        correctNonSpaceChars: 1,
        elapsedMilliseconds: 1000
    }, 45, 95);
    assert.equal(roundedAccuracy.recordReason, 'Records need at least 95% accuracy.',
        'rounded-zero accuracy does not erase the retained correct character');
    assert.equal(roundedAccuracy.stars, 1);
    assert.equal(roundedAccuracy.recordEligible, false);
    assert.equal(roundedAccuracy.isNewBestWpm, false);

    const zeroTime = await storage.recordLesson('zero-time', {
        ...stats,
        elapsedSeconds: 0,
        elapsedMilliseconds: 0
    });
    assert.equal(zeroTime.recordReason, 'The test has no measured typing time.');
    assert.equal(zeroTime.recordEligible, false);
    assert.equal(zeroTime.stars, 0, 'positive speed without measured time cannot earn stars');
    assert.equal(zeroTime.isNewBestWpm, false);
    assert.equal(storage.getLessonProgress('zero-time'), null);

    const correctZeroTime = await storage.recordLesson('correct-zero-time', {
        wpm: 0,
        accuracy: 100,
        totalKeystrokes: 1,
        correctKeystrokes: 1,
        correctNonSpaceChars: 1,
        elapsedMilliseconds: 0
    });
    assert.equal(correctZeroTime.recordReason, 'The test has no measured typing time.',
        'correct zero-time input reports missing measured time rather than missing characters');
    assert.equal(correctZeroTime.recordEligible, false);
    assert.equal(correctZeroTime.stars, 0);
    assert.equal(correctZeroTime.isNewBestWpm, false);
    assert.equal(storage.getLessonProgress('correct-zero-time'), null);

    reload({
        history: [previous, { ...previous, lessonId: 'x'.repeat(201) },
            { ...previous, date: 'invalid', recordReason: 'x'.repeat(500) },
            { ...previous, date: 'x'.repeat(65) }, {
                ...previous,
                wpmMetric: 'words-v2'
            }]
    });
    assert.equal(storage.data.history.length, 3, 'malformed oversized labels are ignored');
    assert.ok(storage.data.history.every(entry => entry.wpmMetric === undefined),
        'unknown saved metric markers are not relabeled as legacy history');
    assert.equal(storage.data.history[1].date, null);
    assert.equal(storage.data.history[1].recordReason.length, 200);
    assert.equal(storage.data.history[2].date, null);
    assert.equal((await storage.recordLesson('x'.repeat(201), stats)).recordEligible, false);
    assert.equal(storage.data.history.length, 3,
        'invalid record identifiers cannot append null entries');

    const legacyLearningSave = {
        settings: { ...defaults, theme: 'light' },
        progress: { 'amat-intro': lesson },
        history: [previous],
        stats: {
            totalSessions: 1,
            totalKeystrokes: 100,
            totalTimeSeconds: 30.5,
            highestWpm: 80
        },
        futureRoot: { preserved: true }
    };
    reload(legacyLearningSave);
    assert.equal(storage.getLearning().version, 1, 'old-format saves migrate to an empty profile');
    assert.deepEqual(Object.keys(storage.getLearning().keys), []);
    assert.deepEqual(Object.keys(storage.getLearning().bigrams), []);
    assert.deepEqual(storage.data.settings, legacyLearningSave.settings);
    assert.deepEqual(storage.getLessonProgress('amat-intro'), lesson);
    assert.deepEqual(storage.data.history, [previous]);
    assert.equal(saved, JSON.stringify(legacyLearningSave), 'migration never writes at startup');
    const firstLearning = {
        keys: {
            a: { attempts: 2, errors: 1, latencySamples: 1, latencyTotalMs: 250 },
            b: { attempts: 1, errors: 0, latencySamples: 1, latencyTotalMs: 100 }
        },
        bigrams: { ab: { attempts: 1, errors: 0, latencySamples: 1, latencyTotalMs: 100 } }
    };
    const nextLearning = {
        keys: {
            a: { attempts: 3, errors: 0, latencySamples: 2, latencyTotalMs: 200 },
            b: { attempts: 1, errors: 0, latencySamples: 1, latencyTotalMs: 100 }
        },
        bigrams: { ab: { attempts: 1, errors: 0, latencySamples: 1, latencyTotalMs: 100 } }
    };
    const learningTab = new storage.constructor();
    await storage.recordLesson('learning-one', { ...stats, learning: firstLearning });
    const firstProfile = storage.getLearning();
    await learningTab.recordLesson('learning-two', { ...stats, learning: nextLearning });
    storage.data = storage.load();
    const counters = ({ attempts, errors, latencySamples, latencyTotalMs }) => ({
        attempts,
        errors,
        latencySamples,
        latencyTotalMs
    });
    const jsonLearning = value => JSON.parse(JSON.stringify(value));
    assert.deepEqual(counters(storage.getLearning().keys.a), {
        attempts: 5,
        errors: 1,
        latencySamples: 3,
        latencyTotalMs: 450
    }, 'a second session in an older tab merges rather than replaces measured keys');
    assert.deepEqual(counters(storage.getLearning().bigrams.ab), {
        attempts: 2,
        errors: 0,
        latencySamples: 2,
        latencyTotalMs: 200
    });
    assert.ok(storage.getLearning().keys.a.recentErrorRate < firstProfile.keys.a.recentErrorRate,
        'recent weakness responds to cleaner practice');
    assert.ok(storage.getLearning().keys.a.recentLatencyMs < firstProfile.keys.a.recentLatencyMs,
        'recent reach responds to faster practice');
    assert.deepEqual(jsonLearning(storage.data.history[0].learning), nextLearning);
    assert.deepEqual(jsonLearning(storage.data.history[1].learning), firstLearning);
    assert.deepEqual(storage.data.history[2], previous);
    assert.deepEqual(storage.getLessonProgress('amat-intro'), lesson);
    assert.deepEqual(storage.data.futureRoot, legacyLearningSave.futureRoot);
    assert.equal(storage.getSetting('theme'), 'light');
    assert.deepEqual(storage.load(), storage.data,
        'measured profile and session data survive reload');

    const futureCell = {
        ...firstLearning.keys.a,
        futureCell: { lessons: ['future'] },
        recentErrorRate: 'invalid',
        recentLatencyMs: -1
    };
    const learnedHistory = {
        ...previous,
        learning: {
            ...firstLearning,
            futureSession: { layout: 'future' },
            keys: { a: { ...firstLearning.keys.a, futureCell: { retained: true } } }
        }
    };
    reload({
        history: [learnedHistory],
        learning: {
            version: 1,
            futureProfile: { layout: 'future' },
            keys: {
                a: futureCell,
                b: { ...firstLearning.keys.b, attempts: -1 },
                c: { ...firstLearning.keys.b, errors: 2 },
                d: { ...firstLearning.keys.b, latencySamples: 2 },
                e: { ...firstLearning.keys.b, latencySamples: 0 },
                ['__proto__']: firstLearning.keys.b,
                constructor: firstLearning.keys.b
            },
            bigrams: {
                ab: { ...firstLearning.bigrams.ab, futurePair: ['retained'] },
                abc: firstLearning.bigrams.ab,
                ['\u0000a']: firstLearning.bigrams.ab
            }
        }
    });
    assert.deepEqual(Object.keys(storage.getLearning().keys), ['a'],
        'invalid counts, impossible sample totals and non-key names cannot enter the profile');
    assert.deepEqual(Object.keys(storage.getLearning().bigrams), ['ab']);
    assert.equal(storage.getLearning().keys.a.recentErrorRate, 0.5);
    assert.equal(storage.getLearning().keys.a.recentLatencyMs, 250);
    assert.equal({}.attempts, undefined, 'prototype-sensitive names cannot pollute objects');
    await storage.setSetting('soundMuted', true);
    const cyclicLearning = {};
    cyclicLearning.self = cyclicLearning;
    await storage.recordLesson('untrusted-learning', {
        ...stats,
        learning: {
            ...nextLearning,
            unknown: cyclicLearning,
            keys: {
                a: { ...nextLearning.keys.a, unknown: cyclicLearning },
                b: cyclicLearning
            },
            bigrams: { ab: { ...nextLearning.bigrams.ab, unknown: cyclicLearning } }
        }
    });
    assert.equal(Object.hasOwn(storage.data.history[0].learning, 'unknown'), false);
    assert.equal(Object.hasOwn(storage.data.history[0].learning.keys.a, 'unknown'), false,
        'cyclic untrusted session extras are discarded before saving');
    assert.equal(Object.hasOwn(storage.data.history[0].learning.keys, 'b'), false);
    assert.deepEqual(storage.getLearning().futureProfile, { layout: 'future' });
    assert.deepEqual(storage.getLearning().keys.a.futureCell, futureCell.futureCell);
    assert.deepEqual(storage.getLearning().bigrams.ab.futurePair, ['retained']);
    assert.deepEqual(storage.data.history[1].learning.futureSession, { layout: 'future' });
    assert.deepEqual(storage.data.history[1].learning.keys.a.futureCell, { retained: true });
    assert.deepEqual(storage.load(), storage.data,
        'validated learning saves preserve loaded future profile, cell and session fields');
    for (const malformedMaps of [{}, { keys: [], bigrams: null }]) {
        reload({ learning: { version: 1, ...malformedMaps, futureProfile: { retained: true } } });
        assert.deepEqual(Object.keys(storage.getLearning().keys), []);
        assert.deepEqual(Object.keys(storage.getLearning().bigrams), []);
        await storage.setSetting('soundMuted', true);
        assert.deepEqual(JSON.parse(saved).learning.futureProfile, { retained: true },
            'missing or malformed known maps cannot erase unrelated future profile fields');
    }
    const futureLearning = {
        version: 2,
        keys: { future: { attempts: 'new-format' } },
        bigrams: [],
        layout: { opaque: true }
    };
    reload({ learning: futureLearning });
    await storage.setSetting('theme', 'light');
    await storage.recordLesson('future-profile', { ...stats, learning: firstLearning });
    assert.deepEqual(storage.getLearning(), futureLearning,
        'an older open tab preserves an unsupported future learning version opaquely');
    assert.deepEqual(JSON.parse(saved).learning, futureLearning);
    assert.deepEqual(jsonLearning(storage.data.history[0].learning), firstLearning,
        'a preserved future profile does not prevent saving the current session');

    for (const historyLearning of [
            {
                version: 2,
                keys: { future: ['new-format'] },
                bigrams: null,
                futureSession: { opaque: true }
            },
            { keys: [], bigrams: null, futureSession: { retained: true } }
    ]) {
        reload({
            history: [{
                ...previous,
                lessonId: 'future-history',
                learning: historyLearning
            }]
        });
        const expectedLearning = historyLearning.version === 2 ? historyLearning
            : { ...historyLearning, keys: {}, bigrams: {} };
        assert.deepEqual(jsonLearning(storage.data.history[0].learning), expectedLearning,
            'loading retains future session data while sanitizing only supported maps');
        await storage.setSetting('volume', 0.4);
        await storage.recordLesson('current-learning', { ...stats, learning: firstLearning });
        const retained = JSON.parse(saved).history.find(entry => entry.lessonId ===
            'future-history');
        assert.deepEqual(retained.learning, expectedLearning,
            'setting and result saves preserve opaque future history and unrelated session fields'
        );
    }

    reload(null);
    const storageListeners = [];
    globalThis.window = {
        addEventListener: (name, listener) => {
            assert.equal(name, 'storage');
            storageListeners.push(listener);
        }
    };
    const other = new storage.constructor();
    delete globalThis.window;
    await storage.recordLesson('tab-a', stats);
    storageListeners[0]({ key: 'unrelated' });
    assert.equal(other.getLessonProgress('tab-a'), null);
    storageListeners[0]({ key: 'apple_typing_tutor_data_v1' });
    assert.equal(other.getLessonProgress('tab-a').bestWpm, 70,
        'native storage notifications refresh clean tabs');
    await other.recordLesson('tab-b', stats);
    await storage.setSetting('theme', 'light');
    await other.setSetting('volume', 0.4);
    const shared = other.load();
    assert.equal(shared.stats.totalSessions, 2);
    assert.equal(shared.settings.theme, 'light');
    assert.equal(shared.settings.volume, 0.4);
    assert.equal(shared.progress['tab-a'].bestWpm, 70);
    assert.equal(shared.progress['tab-b'].bestWpm, 70);
    assert.deepEqual(shared.history.map(entry => entry.lessonId), ['tab-b', 'tab-a'],
        'sequential tab updates preserve scores, history, and unrelated settings');

    const staleClean = new storage.constructor();
    await other.setSetting('theme', 'dark');
    const newerSave = saved;
    assert.equal(await staleClean.retrySave(), true);
    assert.equal(saved, newerSave, 'retrying a clean tab cannot replace newer saved data');

    blocked = true;
    await assert.doesNotReject(async () => await storage.recordLesson('blocked', stats));
    assert.equal(storage.saveFailed, true, 'the UI can report unavailable persistence');
    assert.equal(storage.getLessonProgress('blocked').bestWpm, 70);
    await assert.doesNotReject(async () => await storage.setSetting('volume', 0.2));
    const retainedSessions = storage.getStats().totalSessions;
    const unsaved = JSON.stringify(storage.data);
    blocked = false;
    assert.equal(await storage.retrySave(), true);
    assert.equal(saved, unsaved, 'retry saves retained scores without recording them again');
    assert.equal(storage.getStats().totalSessions, retainedSessions);
    await storage.setSetting('volume', 0.25);
    assert.equal(storage.saveFailed, false, 'quota errors recover on the next successful save');
    assert.deepEqual(storage.load(), storage.data);
    readBlocked = true;
    assert.deepEqual(storage.load().settings, defaults);
    assert.equal(storage.saveFailed, true, 'startup read failures report session-only storage');
    const priorSave = saved;
    const unreadBackup = JSON.parse(storage.exportBackup());
    assert.equal(unreadBackup.savedReadFailed, true);
    assert.equal(Object.hasOwn(unreadBackup, 'savedRaw'), false);
    assert.equal(unreadBackup.baselineRaw, priorSave);
    assert.deepEqual(unreadBackup.session, JSON.parse(JSON.stringify(storage.data)));
    assert.equal(storage.loadFailed, true, 'export does not clear a failed-read guard');
    assert.equal(storage.saveFailed, true);
    assert.equal(saved, priorSave, 'export does not write to storage');
    readBlocked = false;
    await assert.doesNotReject(async () => await storage.recordLesson('read-recovery', stats));
    assert.equal(await storage.retrySave(), false);
    assert.equal(saved, priorSave,
        'a temporary read failure cannot overwrite unread saved progress');
    const readRecoveryBackup = JSON.parse(storage.exportBackup());
    assert.equal(readRecoveryBackup.savedReadFailed, false);
    assert.equal(readRecoveryBackup.savedRaw, priorSave);
    assert.equal(readRecoveryBackup.session.history[0].lessonId, 'read-recovery');
    assert.equal(storage.loadFailed, true, 'a successful export read cannot enable unsafe saves');
    storage.data = storage.load();
    await storage.setSetting('volume', 0.3);
    assert.equal(storage.saveFailed, false,
        'successful reload and save recover persistence status');

    readBlocked = true;
    const unreadStartup = new storage.constructor();
    await unreadStartup.recordLesson('startup-attempt', stats);
    const startupBackup = JSON.parse(unreadStartup.exportBackup());
    assert.equal(startupBackup.session.history[0].lessonId, 'startup-attempt');
    assert.equal(startupBackup.savedReadFailed, true);
    assert.equal(Object.hasOwn(startupBackup, 'baselineRaw'), false);
    const beforeStartupRetry = saved;
    readBlocked = false;
    assert.equal(await unreadStartup.retrySave(), false);
    assert.equal(saved, beforeStartupRetry, 'startup recovery cannot replace unknown old scores');
    assert.equal(JSON.parse(unreadStartup.exportBackup()).savedRaw, beforeStartupRetry);

    blocked = true;
    await storage.recordLesson('offline-attempt', stats);
    blocked = false;
    await other.setSetting('theme', 'light');
    const externalSave = saved;
    storage.refresh();
    assert.equal(storage.getLessonProgress('offline-attempt').bestWpm, 70,
        'refresh cannot discard unsaved local attempts');
    await storage.setSetting('volume', 0.7);
    assert.equal(storage.saveConflict, true);
    assert.equal(storage.saveFailed, true);
    assert.equal(saved, externalSave, 'quota recovery cannot overwrite another tab\'s new scores');
    assert.equal(storage.getLessonProgress('offline-attempt').bestWpm, 70,
        'failed/conflicting writes retain local attempts in memory');
    const localBeforeRecovery = JSON.stringify(storage.data);
    const baselineBeforeRecovery = storage.lastSavedRaw;
    assert.equal(await storage.retrySave(), false);
    assert.equal(saved, externalSave);
    assert.equal(JSON.stringify(storage.data), localBeforeRecovery,
        'a conflicting retry cannot discard retained attempts');
    const backup = JSON.parse(storage.exportBackup());
    assert.equal(backup.format, 'typeflow');
    assert.equal(backup.version, 1);
    assert.equal(Number.isFinite(Date.parse(backup.exportedAt)), true);
    assert.equal(backup.savedReadFailed, false);
    assert.equal(backup.savedRaw, externalSave,
        'backup preserves the exact externally saved snapshot');
    assert.equal(backup.baselineRaw, baselineBeforeRecovery);
    assert.equal(backup.session.progress['offline-attempt'].bestWpm, 70);
    assert.equal(backup.session.history[0].lessonId, 'offline-attempt');
    assert.equal(JSON.stringify(storage.data), localBeforeRecovery);
    assert.equal(saved, externalSave);
    assert.equal(storage.lastSavedRaw, baselineBeforeRecovery);
    assert.equal(storage.saveConflict, true, 'export leaves persistence flags intact');
    assert.equal(storage.saveFailed, true);

    reload(null);
    const queuedLocks = [];
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
            locks: {
                request: (key, callback) => new Promise((resolve, reject) => {
                    queuedLocks.push({ key, callback, resolve, reject });
                })
            }
        }
    });
    const grantLock = () => {
        const request = queuedLocks.shift();
        assert.equal(request.key, 'apple_typing_tutor_data_v1');
        try { request.resolve(request.callback()); } catch (error) { request.reject(error); }
    };
    const queued = new storage.constructor();
    const cyclic = {};
    cyclic.self = cyclic;
    const queuedLearning = structuredClone(firstLearning);
    const submittedStats = {
        ...wordStats,
        elapsedMilliseconds: 125,
        learning: queuedLearning,
        rawWpm: cyclic,
        unknown: cyclic
    };
    const submittedSettings = { ...plain, unknown: cyclic };
    const completedAt = Date.parse('2026-10-06T12:00:00.125Z');
    Date.now = () => completedAt;
    const firstQueued = queued.recordLesson('queued-a', submittedStats, 45, 95, submittedSettings);
    Date.now = originalNow;
    const secondQueued = queued.recordLesson('queued-b', {
        ...wordStats,
        wpm: 80,
        learning: nextLearning
    }, 45, 95, plain);
    const queuedOther = new storage.constructor();
    const thirdQueued = queuedOther.recordLesson('queued-c', wordStats, 45, 95, plain);
    assert.equal((await queued.recordLesson('queued-unknown', {
        ...stats,
        wpmMetric: 'words-v2'
    }, 45, 95, plain)).recordEligible, false);
    assert.equal(queued.pendingLessons.length, 2);
    assert.equal(queued.saveFailed, false, 'waiting for a lock is pending, not failed');
    assert.equal(await queued.retrySave(), false, 'queued attempts cannot be reported as saved');
    assert.equal(queuedLocks.length, 3, 'retry does not add a redundant clean write');
    const waitingBackup = JSON.parse(queued.exportBackup());
    assert.equal(waitingBackup.session.stats.totalSessions, 0);
    assert.deepEqual(waitingBackup.pendingLessons.map(entry => entry.lessonId), ['queued-a',
        'queued-b'], 'backup preserves every queued attempt without counting it twice');
    assert.equal(waitingBackup.pendingLessons[0].date, new Date(completedAt).toISOString());
    assert.equal(waitingBackup.pendingLessons[0].wpmMetric, 'words-v1');
    assert.equal(Object.hasOwn(waitingBackup.pendingLessons[0], 'rawWpm'), false);
    assert.equal(Object.hasOwn(waitingBackup.pendingLessons[0], 'unknown'), false,
        'unaccepted cyclic fields cannot break queued backups');
    assert.deepEqual(waitingBackup.pendingLessons[0].learning, firstLearning,
        'the queued backup includes the measured learning snapshot');
    assert.equal(saved, 'null', 'a queued backup cannot write or bypass the lock');
    Object.assign(submittedStats, {
        wpm: 999,
        accuracy: 0,
        totalKeystrokes: 999,
        correctKeystrokes: 0,
        elapsedMilliseconds: 999000,
        wpmMetric: 'words-v2'
    });
    Object.assign(submittedSettings, {
        testDuration: 120,
        typingMode: 'strict',
        recordEligible: false
    });
    queuedLearning.keys.a.attempts = 999;
    grantLock();
    assert.equal((await firstQueued).saved, true);
    assert.equal(queued.getLessonProgress('queued-a', { ...plain, ...wordMetric }).bestWpm, 70,
        'queued results use settings and metrics captured at completion');
    assert.equal(queued.getLessonProgress('queued-a', { ...plain, ...wordMetric }).lastPlayed,
        completedAt);
    assert.equal(queued.getLessonProgress('queued-a', plain), null,
        'queued word-based results cannot enter legacy progress');
    assert.equal(queued.getStats().totalTimeSeconds, 0.125);
    assert.equal(queued.getStats().totalKeystrokes, 200);
    assert.deepEqual(counters(queued.getLearning().keys.a), firstLearning.keys.a,
        'learning counters are captured before waiting for the existing save lock');
    const partlySaved = JSON.parse(queued.exportBackup());
    assert.equal(partlySaved.session.stats.totalSessions, 1);
    assert.deepEqual(partlySaved.pendingLessons.map(entry => entry.lessonId), ['queued-b']);
    assert.equal(partlySaved.session.history[0].date, new Date(completedAt).toISOString());
    assert.equal(partlySaved.session.history[0].wpmMetric, 'words-v1',
        'changing the submitted marker cannot retag a queued result');
    grantLock();
    assert.equal((await secondQueued).isNewBestWpm, true);
    grantLock();
    assert.equal((await thirdQueued).isNewBestWpm, false,
        'competing queued records compare against the latest locked progress');
    assert.equal(queuedOther.load().stats.totalSessions, 3);
    assert.equal(queuedOther.load().stats.highestWpm, 0);
    assert.equal(queuedOther.load().stats.wordHighestWpm, 80);
    assert.deepEqual(counters(queuedOther.load().learning.keys.a), {
        attempts: 5,
        errors: 1,
        latencySamples: 3,
        latencyTotalMs: 450
    }, 'queued sessions merge learning against the latest locked snapshot exactly once');
    assert.deepEqual(queuedOther.load().history.map(entry => entry.lessonId), ['queued-c',
        'queued-b', 'queued-a']);
    assert.equal(queued.pendingLessons.length, 0);
    assert.equal(Object.hasOwn(JSON.parse(queued.exportBackup()), 'pendingLessons'), false);

    blocked = true;
    const quotaQueued = new storage.constructor();
    const queuedFailure = quotaQueued.recordLesson('queued-quota', stats);
    grantLock();
    assert.equal((await queuedFailure).saved, false);
    assert.equal(quotaQueued.pendingLessons.length, 0,
        'incorporated failed saves are retained in session data, not duplicated as pending');
    assert.equal(JSON.parse(quotaQueued.exportBackup()).session.history[0].lessonId,
        'queued-quota');
    blocked = false;
    const queuedRetry = quotaQueued.retrySave();
    grantLock();
    assert.equal(await queuedRetry, true);
    assert.equal(quotaQueued.load().stats.totalSessions, 4,
        'retry persists a queued failed attempt exactly once');
    blocked = true;
    const queuedConflict = quotaQueued.recordLesson('queued-conflict', stats);
    grantLock();
    assert.equal((await queuedConflict).saved, false);
    blocked = false;
    const externalQueued = queuedOther.setSetting('theme', 'light');
    grantLock();
    assert.equal(await externalQueued, true);
    const externalQueuedSave = saved;
    const conflictingRetry = quotaQueued.retrySave();
    grantLock();
    assert.equal(await conflictingRetry, false);
    assert.equal(quotaQueued.saveConflict, true);
    assert.equal(saved, externalQueuedSave, 'a queued retry cannot overwrite a newer tab save');
    assert.equal(JSON.parse(quotaQueued.exportBackup()).session.history[0].lessonId,
        'queued-conflict');

    const interrupted = new storage.constructor();
    interrupted.refresh = () => { throw new Error('Unexpected processing error'); };
    const interruptedRecord = interrupted.recordLesson('queued-interrupted', stats);
    const interruptedCheck = assert.rejects(interruptedRecord, /Unexpected processing error/);
    grantLock();
    await interruptedCheck;
    assert.equal(interrupted.pendingLessons.length, 1,
        'unexpected processing errors cannot remove an unincorporated attempt');
    assert.equal(interrupted.saveFailed, true,
        'unexpected processing errors report failure instead of an endless pending save');
    assert.equal(JSON.parse(interrupted.exportBackup()).pendingLessons[0].lessonId,
        'queued-interrupted');
    const beforeInterruptedRetry = saved;
    assert.equal(await interrupted.retrySave(), false,
        'retry cannot claim an unincorporated pending attempt was saved');
    assert.equal(interrupted.saveFailed, true);
    assert.equal(saved, beforeInterruptedRetry);
    assert.equal(queuedLocks.length, 0,
        'an interrupted pending attempt cannot trigger a retry write');

    if (nativeNavigator?.locks) {
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: nativeNavigator
        });
        reload(null);
        const concurrent = new storage.constructor();
        let overlapping;
        onRead = () => { overlapping = concurrent.recordLesson('overlapping-b', stats); };
        await storage.recordLesson('overlapping-a', stats);
        await overlapping;
        assert.equal(storage.load().stats.totalSessions, 2,
            'exclusive locks preserve a competing write inside the read-to-write interval');
        assert.deepEqual(storage.load().history.map(entry => entry.lessonId), ['overlapping-b',
            'overlapping-a']);
        const [faster, slower] = await Promise.all([
            storage.recordLesson('shared-pb', { ...stats, wpm: 80 }),
            concurrent.recordLesson('shared-pb', { ...stats, wpm: 75 })
        ]);
        assert.equal(faster.isNewBestWpm, true);
        assert.equal(slower.isNewBestWpm, false, 'PB comparison uses the latest locked snapshot');
        await Promise.all([storage.setSetting('theme', 'light'), concurrent.setSetting('volume',
            0.4)]);
        const together = storage.load();
        assert.equal(together.stats.totalSessions, 4);
        assert.equal(together.progress['shared-pb'].bestWpm, 80);
        assert.equal(together.settings.theme, 'light');
        assert.equal(together.settings.volume, 0.4);
    }

    reload(null);
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
            locks: { request: async () => { throw new Error('Lock unavailable'); } }
        }
    });
    await assert.doesNotReject(() => storage.recordLesson('lock-denied', stats));
    assert.equal(storage.saveFailed, true);
    assert.equal(storage.lockFailed, true);
    assert.equal(saved, 'null', 'lock denial cannot trigger an unlocked write');
    assert.equal(storage.getLessonProgress('lock-denied').bestWpm, 70);
    assert.equal(await storage.setSetting('volume', 0.2), false);
    assert.equal(storage.getSetting('volume'), 0.2,
        'lock denial preserves preference changes in memory');
    assert.equal(await storage.retrySave(), false);
    assert.equal(saved, 'null', 'retry cannot write without an acquired lock');
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: nativeNavigator?.locks
            ? nativeNavigator : { locks: { request: async (key, callback) => callback() } }
    });
    assert.equal(await storage.retrySave(), true);
    assert.equal(storage.getStats().totalSessions, 1,
        'locked retry persists the retained attempt exactly once');
    await storage.recordLesson('lock-recovered', stats);
    assert.equal(storage.saveFailed, false);
    assert.equal(storage.getStats().totalSessions, 2,
        'recovery preserves the earlier in-memory attempt exactly once');
    assert.deepEqual(storage.load(), storage.data);
    console.log(
        'Storage checks passed: corrupt saves, validated settings, score persistence, prototype-sensitive IDs, history limit, unavailable storage, and safe recovery backups.'
    );
} finally {
    console.warn = originalWarn;
    Date.now = originalNow;
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete globalThis.navigator;
}
