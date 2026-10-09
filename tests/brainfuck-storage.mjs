import assert from 'node:assert/strict';
import { BrainfuckProgram } from '../brainfuck/compiler.mjs';
import { createTokenArena } from '../brainfuck/runtime.mjs';
import { createNumbers } from '../brainfuck/numbers.mjs';
import { TokenCodec } from '../brainfuck/codec.js';
import { DEFAULT_SETTINGS, DEFAULT_STATS, defineStorage } from '../brainfuck/storage.mjs';
import { migrateLearning, mergeLearning } from '../js/learning.js';

const names = [...Object.keys(DEFAULT_SETTINGS), ...Object.keys(DEFAULT_STATS), 'settings',
    'stats', 'progress', 'history', 'learning', 'completed', 'bestWpm', 'bestAccuracy', 'stars',
    'lastPlayed', 'timestamp', 'lessonId', 'wpmMetric', 'wpm', 'accuracy', 'rawWpm',
    'consistency', 'elapsedSeconds', 'elapsedMilliseconds', 'totalKeystrokes',
    'correctKeystrokes', 'correctNonSpaceChars', 'errorKeystrokes', 'skippedChars',
    'recordEligible', 'recordReason', 'date', 'version', 'keys', 'bigrams', 'attempts',
    'errors', 'latencySamples', 'latencyTotalMs', 'recentErrorRate', 'recentLatencyMs',
    'format', 'exportedAt', 'session', 'savedReadFailed', 'savedRaw', 'pendingLessons',
    'baselineRaw', 'isNewBestWpm', 'saved'
];
const strings = [...new Set([...names, 'dark', 'light', 'system', 'mint', 'ocean', 'plum',
    'mac-us', 'colemak', 'dvorak', 'uk-iso', 'magic', 'thock', 'bubble', 'clicky', 'flow',
    'strict', 'time', 'words', 'words-v1', 'typeflow',
    'No typing result was recorded.', 'Practice sessions do not qualify for records.',
    'Skipped characters do not qualify for records.', 'No correct characters were typed.',
    'The test has no measured typing time.'
])];
const ids = Object.fromEntries(strings.map((value, index) => [value, index + 1]));
const b = new BrainfuckProgram({ scalarCapacity: 32768, memoryPages: 512 });
const arena = createTokenArena(b, 131072, 'storageTest');
const defaultsRoot = b.scalar('defaultsRoot');
const handle = b.scalar('handle');
const storage = defineStorage(b, arena, {
    keys: ids,
    strings: ids,
    defaultsRoot,
    numbers: createNumbers(b, arena),
    parseDate(node, valid) {
        b.write(22);
        b.write(node);
        b.read(valid);
    },
    save(out) {
        b._temps(3, (saved, failure, result) => {
            b.set(result, 0);
            b.if(storage.saveAllowed(handle), () => {
                b.write(11);
                b.write(storage.data);
                b.read(saved);
                b.read(failure);
                storage.saved(saved, failure);
                b.not(result, failure);
            });
            arena.boolean(saved, result);
            arena.setField(out, ids.saved, saved);
        });
    }
});
const operation = b.scalar('operation');
const raw = b.scalar('raw');
const present = b.scalar('present');
const failed = b.scalar('failed');
const settingKey = b.scalar('settingKey');
const value = b.scalar('value');
const output = b.scalar('output');
const match = b.scalar('match');
const lesson = b.scalar('lesson');
const targetWpm = b.scalar('targetWpm');
const targetAccuracy = b.scalar('targetAccuracy');
const options = b.scalar('options');
const timestamp = b.scalar('timestamp');
const date = b.scalar('date');
const request = b.scalar('request');
const lockFailed = b.scalar('lockFailed');
b.read(operation);
for (const [code, body] of [
        [1, () => {
            b.read(defaultsRoot);
            b.read(raw);
            b.read(present);
            b.read(failed);
            b.read(handle);
            storage.load(raw, present, failed, handle);
        }],
        [2, () => {
            b.read(settingKey);
            b.read(value);
            storage.setSetting(settingKey, value);
        }],
        [3, () => {
            b.read(handle);
            b.copy(output, storage.saveAllowed(handle));
        }],
        [4, () => {
            b.read(handle);
            b.read(failed);
            storage.saved(handle, failed);
        }],
        [5, () => {
            b.read(value);
            b.read(handle);
            b.read(failed);
            storage.exportBackup(output, value, handle, failed);
        }],
        [6, () => {
            for (const node of [lesson, value, targetWpm, targetAccuracy, options,
                    timestamp, date]) b.read(node);
            storage.recordLesson(lesson, value, targetWpm, targetAccuracy, options,
                timestamp, date, output);
        }],
        [7, () => {
            for (const node of [request, raw, present, failed, handle, lockFailed]) b.read(
                node);
            b.set(output, 0);
            storage.applyLesson(request, raw, present, failed, handle, lockFailed, output);
        }],
        [10, () => {
            b.read(handle);
            b.read(lockFailed);
            storage.retrySave(output, handle, lockFailed);
        }],
        [11, () => {
            b.write(38);
            b.write(defaultsRoot);
            storage.retainedRoots(node => b.if(node, () => b.write(node)));
            b.write(0);
        }]
    ]) {
    b.eq(match, operation, code);
    b.if(match, body);
}

let input = [0];
let cursor = 0;
let codec;
let pending;
let savedRaw = null;
let writeBlocked = false;
let writeCount = 0;
const lockRequests = [];
const instance = new WebAssembly.Instance(new WebAssembly.Module(b.compile()), {
    env: {
        read: () => input[cursor++] ?? 0,
        write(value) {
            value >>>= 0;
            if (pending?.operation === 38) {
                if (value) pending.points.push(value);
                else {
                    codec.sweep(pending.points);
                    pending = null;
                }
                return;
            }
            if (pending?.operation === 12) {
                if (pending.length === undefined) pending.length = value;
                else if (pending.points.length < pending.length) pending.points.push(value);
                else {
                    assert.equal(String.fromCodePoint(...pending.points),
                        'apple_typing_tutor_data_v1');
                    lockRequests.push(value);
                    pending = null;
                }
                return;
            }
            if (pending?.operation === 29) {
                if (pending.length === undefined) pending.length = value;
                else pending.points.push(value);
                if (pending.points.length === pending.length) {
                    input.push(codec.intern(String.fromCodePoint(...pending.points)));
                    pending = null;
                }
                return;
            }
            if (pending) {
                if (pending.operation === 24) {
                    const points = Array.from(codec.strings[value], char => char
                        .codePointAt(0));
                    input.push(points.length, ...points);
                } else if (pending.operation === 11) {
                    if (!writeBlocked) {
                        savedRaw = JSON.stringify(codec.decode(value));
                        writeCount++;
                    }
                    input.push(savedRaw === null ? 0 : codec.intern(savedRaw),
                        Number(writeBlocked));
                } else input.push(Number(Number.isFinite(Date.parse(codec.decode(value)))));
                pending = null;
            } else if ([11, 12, 22, 24, 29, 38].includes(value)) pending = {
                operation: value,
                points: []
            };
            else throw new Error(`Unexpected storage IO operation ${value}`);
        }
    }
});
instance.exports.run();
codec = new TokenCodec(instance.exports.memory, arena.layout, strings);
const tape = new Uint32Array(instance.exports.memory.buffer);
const run = values => {
    input = values;
    cursor = 0;
    pending = null;
    instance.exports.run();
    assert.equal(cursor, input.length, 'the Brainfuck storage routine consumes its IO packet');
};
const decode = field => JSON.parse(JSON.stringify(codec.decode(tape[field.index])));
const defaults = {
    settings: DEFAULT_SETTINGS,
    stats: DEFAULT_STATS,
    progress: {},
    history: [],
    learning: { version: 1, keys: {}, bigrams: {} }
};
const defaultsId = codec.encode(defaults);
run([1, defaultsId, 0, 0, 0, 0]);
assert.equal(decode(storage.data).settings.typingMode, 'strict');
assert.equal(decode(storage.data).settings.showHands, true);
assert.equal(decode(storage.data).settings.showKeyboard, true);
run([5, codec.encode('2026-10-09T12:00:00.000Z'), 0, 1]);
assert.equal(decode(output).savedReadFailed, true);
assert.equal(decode(output).baselineRaw, null,
    'a failed backup read preserves a known empty storage baseline');

const future = {
    futureRoot: { keep: [null, 3, false] },
    settings: {
        theme: 'light',
        volume: 0.25,
        typingMode: 'unknown',
        futureSetting: { keep: true }
    },
    stats: { totalSessions: 3, totalKeystrokes: -2, totalTimeSeconds: 30.5, futureStats: [1] },
    progress: {
        lesson: {
            completed: true,
            bestWpm: 40,
            bestAccuracy: 120,
            stars: 2,
            lastPlayed: 1800000000123,
            futureProgress: { keep: 'yes' }
        }
    },
    history: [{
        lessonId: 'lesson',
        date: '2026-10-09T00:00:00.000Z',
        wpm: 40,
        accuracy: 99,
        stars: 2,
        futureHistory: [1, 2]
    }],
    learning: { version: 4, futureLearning: { keep: [1, 2] } },
    ['__proto__']: { preserved: true }
};
const futureId = codec.encode(future);
const rawHandle = codec.intern(JSON.stringify(future));
run([1, defaultsId, futureId, 1, 0, rawHandle]);
const loaded = decode(storage.data);
assert.deepEqual(loaded.futureRoot, future.futureRoot);
assert.deepEqual(loaded.settings.futureSetting, future.settings.futureSetting);
assert.deepEqual(loaded.stats.futureStats, future.stats.futureStats);
assert.deepEqual(loaded.progress.lesson.futureProgress, future.progress.lesson.futureProgress);
assert.deepEqual(loaded.history[0].futureHistory, future.history[0].futureHistory);
assert.deepEqual(loaded.learning, future.learning);
assert.deepEqual(loaded.__proto__, future.__proto__);
assert.equal(loaded.settings.theme, 'light');
assert.equal(loaded.settings.volume, 0.25);
assert.equal(loaded.settings.typingMode, 'flow');
assert.equal(loaded.stats.totalKeystrokes, 0);
assert.equal(loaded.stats.totalTimeSeconds, 30.5);
assert.equal(loaded.progress.lesson.bestAccuracy, 0);
assert.equal(loaded.progress.lesson.lastPlayed, 1800000000123);

run([2, ids.theme, codec.encode('plaid')]);
assert.equal(tape[storage.changed.index], 0);
assert.equal(decode(storage.data).settings.theme, 'light');
run([2, ids.theme, codec.encode('dark')]);
assert.equal(tape[storage.changed.index], 1);
assert.equal(decode(storage.data).settings.theme, 'dark');
assert.deepEqual(decode(storage.data).settings.futureSetting, future.settings.futureSetting);

run([4, rawHandle, 1]);
run([3, rawHandle]);
assert.equal(tape[output.index], 1, 'quota retry can write when the raw baseline is unchanged');
const conflictingRaw = codec.intern('{"newer":true}');
run([3, conflictingRaw]);
assert.equal(tape[output.index], 0, 'quota retry cannot overwrite another tab');
assert.equal(tape[storage.saveConflict.index], 1);
run([5, codec.encode('2026-10-09T12:00:00.000Z'), conflictingRaw, 0]);
const backup = decode(output);
assert.equal(backup.savedRaw, '{"newer":true}');
assert.equal(backup.baselineRaw, JSON.stringify(future));
assert.deepEqual(backup.session.futureRoot, future.futureRoot);
run([1, defaultsId, 0, 0, 1, 0]);
run([3, rawHandle]);
assert.equal(tape[output.index], 0, 'unread saved data cannot be overwritten');

const normalize = value => JSON.parse(JSON.stringify(value));
const oldProfile = {
    version: 1,
    futureProfile: { retained: true },
    keys: {
        a: {
            attempts: 40,
            errors: 12,
            latencySamples: 30,
            latencyTotalMs: 3003,
            recentErrorRate: 0.35,
            recentLatencyMs: 100.1,
            futureCell: ['keep']
        },
        b: {
            attempts: 4,
            errors: 1,
            latencySamples: 2,
            latencyTotalMs: 241.5,
            recentErrorRate: 4,
            recentLatencyMs: -1
        },
        A: { attempts: 2, errors: 0, latencySamples: 0, latencyTotalMs: 0 },
        c: { attempts: 1, errors: 2, latencySamples: 0, latencyTotalMs: 0 }
    },
    bigrams: { ab: { attempts: 4, errors: 0, latencySamples: 3, latencyTotalMs: 450.25 } }
};
const learningSession = {
    keys: {
        a: {
            attempts: 16,
            errors: 3,
            latencySamples: 7,
            latencyTotalMs: 841.4,
            discardedSessionField: true
        },
        b: { attempts: 20, errors: 1, latencySamples: 20, latencyTotalMs: 2000.2 },
        z: { attempts: 2, errors: 1, latencySamples: 0, latencyTotalMs: 0 }
    },
    bigrams: { ab: { attempts: 3, errors: 1, latencySamples: 2, latencyTotalMs: 208.6 } }
};

const nativeStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const nativeNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const nativeNow = Date.now;
const nativeWarn = console.warn;
let oracleRaw = null;
let oracleBlocked = false;
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
        getItem: () => oracleRaw,
        setItem: (key, value) => {
            if (oracleBlocked) throw new Error('Fixture quota exceeded');
            oracleRaw = value;
        }
    }
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: undefined });
console.warn = () => {};
const timestampValue = 1800000000123;
Date.now = () => timestampValue;

try {
    const { storage: original } = await import('../js/storage.js');
    const loadFixture = payload => {
        savedRaw = JSON.stringify(payload);
        oracleRaw = savedRaw;
        run([1, defaultsId, codec.encode(payload), 1, 0, codec.intern(savedRaw)]);
        original.data = original.load();
        original.pendingLessons = [];
    };
    const prepare = (lessonId, result, options = {}, speed = 30, accuracy = 95) => {
        const before = lockRequests.length;
        run([6, codec.encode(lessonId), codec.encode(result), codec.encode(speed),
            codec.encode(accuracy), codec.encode(options), codec.encode(timestampValue),
            codec.encode(new Date(timestampValue).toISOString())]);
        return lockRequests.length > before ? lockRequests.at(-1) : 0;
    };
    const apply = (id, denied = 0) => {
        const latest = savedRaw === null ? 0 : codec.encode(JSON.parse(savedRaw));
        run([7, id, latest, Number(savedRaw !== null), 0,
            savedRaw === null ? 0 : codec.intern(savedRaw), denied]);
        return decode(output);
    };
    const goodResult = {
        wpm: 41.25,
        accuracy: 99.4,
        elapsedMilliseconds: 30250,
        elapsedSeconds: 30.25,
        totalKeystrokes: 100,
        correctKeystrokes: 99,
        correctNonSpaceChars: 85,
        skippedChars: 0,
        errorKeystrokes: 1,
        rawWpm: 45.4,
        consistency: 96.2,
        learning: learningSession
    };
    for (const profile of [null, {}, oldProfile, future.learning]) {
        loadFixture({ learning: profile });
        assert.deepEqual(decode(storage.data).learning, normalize(migrateLearning(profile)),
            'Brainfuck migrates historical teaching data and preserves future profiles');
        apply(prepare('learning', goodResult));
        assert.deepEqual(decode(storage.data).learning,
            normalize(mergeLearning(profile, learningSession)),
            'weighted learning recency matches the original floating point operation order');
    }
    loadFixture({ learning: oldProfile });
    apply(prepare('incomplete', { ...goodResult, learning: { keys: learningSession.keys } }));
    assert.deepEqual(decode(storage.data).learning, normalize(migrateLearning(oldProfile)),
        'an incomplete session cannot change learning');
    const initial = { ...future, learning: oldProfile, progress: {}, history: [] };
    const cases = [
        ['lesson', goodResult, {}],
        ['lesson', { ...goodResult, wpm: 20 }, {}],
        ['lesson', { ...goodResult, accuracy: 92.5 }, {}],
        ['lesson', { ...goodResult, elapsedMilliseconds: 0 }, {}],
        ['lesson', { ...goodResult, correctKeystrokes: 0 }, {}],
        ['lesson', { ...goodResult, correctNonSpaceChars: 0 }, {}],
        ['lesson', { ...goodResult, correctKeystrokes: 101 }, {}],
        ['lesson', { ...goodResult, skippedChars: 1 }, {}],
        ['lesson', goodResult, { recordEligible: false }],
        ['lesson', { ...goodResult, wpmMetric: 'words-v1' },
            {
                testMode: 'words',
                testWordCount: 50,
                typingMode: 'strict',
                punctuation: true,
                numbers: false
            }],
        ['lesson', { ...goodResult, elapsedMilliseconds: undefined, elapsedSeconds: 10.75 },
            { testMode: 'time', testDuration: 60 }],
        ['lesson', { ...goodResult, wpmMetric: 'future' }, {}],
        ['', goodResult, {}],
        ['😀'.repeat(100), goodResult, {}],
        ['😀'.repeat(101), goodResult, {}]
    ];
    for (const [id, result, options] of cases) {
        loadFixture(initial);
        const expected = await original.recordLesson(id, result, 30, 95, options);
        const pendingId = prepare(id, result, options);
        const actual = pendingId ? apply(pendingId) : decode(output);
        assert.deepEqual(actual, normalize(expected), `record result parity for ${id}`);
        assert.deepEqual(decode(storage.data), normalize(original.data),
            'records update progress, totals, bounded history and learning exactly once');
    }

    loadFixture({
        ...initial,
        learning: future.learning,
        stats: {
            ...DEFAULT_STATS,
            totalSessions: Number.MAX_SAFE_INTEGER,
            totalKeystrokes: Number.MAX_SAFE_INTEGER - 1,
            totalTimeSeconds: Number.MAX_SAFE_INTEGER - 2
        }
    });
    const expected = await original.recordLesson('saturated', goodResult);
    assert.deepEqual(apply(prepare('saturated', goodResult)), normalize(expected));
    assert.deepEqual(decode(storage.data), normalize(original.data),
        'lifetime totals saturate and unsupported future learning remains opaque');

    loadFixture({
        ...initial,
        history: Array.from({ length: 60 }, (_, index) => ({
            lessonId: `older-${index}`,
            wpm: index,
            accuracy: 99,
            stars: 1,
            date: new Date(timestampValue - index * 60000).toISOString(),
            futureHistory: { retained: index }
        }))
    });
    const boundedExpected = await original.recordLesson('newest', goodResult);
    assert.deepEqual(apply(prepare('newest', goodResult)), normalize(boundedExpected));
    assert.deepEqual(decode(storage.data), normalize(original.data));
    assert.equal(decode(storage.data).history.length, 50,
        'history retains the newest fifty entries');

    loadFixture(initial);
    const first = prepare('first', goodResult);
    const second = prepare('second', { ...goodResult, wpm: 42.5 });
    assert.equal(decode(storage.pending).length, 2);
    run([11]);
    run([10, codec.intern(savedRaw), 0]);
    assert.equal(decode(output).saved, false, 'retry cannot erase queued lesson attempts');
    const firstApplied = apply(first);
    assert.equal(firstApplied.saved, true);
    assert.equal(decode(storage.data).progress.first.lastPlayed, timestampValue,
        'generic garbage collection preserves immutable pending timestamp roots');
    assert.deepEqual(decode(storage.pending).map(entry => entry.lessonId), ['second']);
    apply(second);
    assert.equal(decode(storage.data).history.length, 2);
    const completedWrites = writeCount;
    apply(first);
    assert.equal(tape[storage.changed.index], 0);
    assert.equal(writeCount, completedWrites, 'duplicate lock callbacks do not reapply a lesson');

    loadFixture(initial);
    writeBlocked = true;
    oracleBlocked = true;
    const quotaExpected = await original.recordLesson('quota', goodResult);
    assert.deepEqual(apply(prepare('quota', goodResult)), normalize(quotaExpected));
    assert.equal(tape[storage.saveFailed.index], 1);
    const unsaved = decode(storage.data);
    writeBlocked = false;
    oracleBlocked = false;
    run([10, codec.intern(savedRaw), 0]);
    assert.equal(decode(output).saved, true);
    assert.deepEqual(JSON.parse(savedRaw), unsaved, 'quota retry preserves the in-memory lesson');

    loadFixture(initial);
    const denied = prepare('denied', goodResult);
    const beforeDenied = writeCount;
    assert.equal(apply(denied, 1).saved, false);
    assert.equal(writeCount, beforeDenied,
        'lock denial retains a lesson without overwriting storage');
    assert.equal(decode(storage.data).history[0].lessonId, 'denied');
} finally {
    if (nativeStorage) Object.defineProperty(globalThis, 'localStorage', nativeStorage);
    else delete globalThis.localStorage;
    if (nativeNavigator) Object.defineProperty(globalThis, 'navigator', nativeNavigator);
    else delete globalThis.navigator;
    Date.now = nativeNow;
    console.warn = nativeWarn;
}
console.log(
    'Brainfuck storage: load, unknown fields, learning, records, locks, retries and backups pass.'
);
