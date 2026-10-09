import assert from 'node:assert/strict';
import { BrainfuckProgram } from '../brainfuck/compiler.mjs';
import { createTokenArena } from '../brainfuck/runtime.mjs';
import { createNumbers } from '../brainfuck/numbers.mjs';
import { defineEngine } from '../brainfuck/engine.mjs';
import { defineStats } from '../brainfuck/stats.mjs';
import { TokenCodec } from '../brainfuck/codec.js';
import { TypingEngine } from '../js/engine.js';

const strings = ['words-v1', 'wpmMetric', 'wpm', 'rawWpm', 'cpm', 'accuracy',
    'elapsedMilliseconds', 'elapsedSeconds', 'timeRemaining', 'totalKeystrokes',
    'correctKeystrokes', 'correctNonSpaceChars', 'errorKeystrokes', 'skippedChars',
    'currentLineIndex', 'totalLines', 'consistency', 'missedWords', 'errorsByChar',
    'learning', 'keys', 'bigrams', 'attempts', 'errors', 'latencySamples', 'latencyTotalMs'];
const names = Object.fromEntries(strings.map((name, index) => [name, index + 1]));
const b = new BrainfuckProgram({ scalarCapacity: 2048, memoryPages: 128 });
const e = defineEngine(b);
const arena = createTokenArena(b, 8192);
const stats = defineStats(b, e, arena, names, createNumbers(b, arena));
const output = b.scalar('statsTest:output');
const command = b.scalar('statsTest:command');
const typed = b.scalar('statsTest:typed');
const match = b.scalar('statsTest:match');
b.read(command);
b.eq(match, command, 1);
b.if(match, () => {
    b.read(typed);
    b.read(e.now);
    b.read(e.nowHi);
    e.key(typed, e.now);
});
for (const [code, method] of [[2, 'pause'], [3, 'resume']]) {
    b.eq(match, command, code);
    b.if(match, () => {
        b.read(e.now);
        b.read(e.nowHi);
        e[method](e.now);
    });
}
stats.snapshot(output);
b.write(99);
b.write(output);
let codec;
let input = [];
let pending = null;
let root = 0;
const bytes = b.compile();
const { instance } = await WebAssembly.instantiate(bytes, {
    env: {
        read: () => input.shift() ?? 0,
        write(value) {
            value >>>= 0;
            if (!pending) { pending = { op: value, values: [] }; return; }
            pending.values.push(value);
            if (pending.op === 99) {
                root = value;
                pending = null;
            } else if (pending.op === 29 && pending.values.length ===
                pending.values[0] + 1) {
                input.push(codec.intern(String.fromCodePoint(...pending.values.slice(1))));
                pending = null;
            } else if (pending.op === 17 && pending.values.length === 3) pending = null;
            else if (pending.op !== 29 && pending.op !== 17) throw new Error(
                'Unexpected stats IO ' + pending
                .op);
        }
    }
});
codec = new TokenCodec(instance.exports.memory, arena.layout, strings);
const tape = codec.tape;
const put = (array, row, field, value) => {
    tape[array.base + row * array.stride + 2 + field] = value;
};
const putInterval = (row, milliseconds) => {
    const value = BigInt(Math.round(milliseconds * 1000));
    put(e.intervals, row, 0, Number(value & 0xffffffffn));
    put(e.intervals, row, 1, Number(value >> 32n));
};
const pair = (name, microseconds) => {
    const value = BigInt(microseconds);
    tape[e[name].index] = Number(value & 0xffffffffn);
    tape[e[name === 'pauseAt' ? 'pauseHi' : name === 'elapsed' ? 'elapsedHi' : name + 'Hi']
        .index] = Number(value >> 32n);
};
const cases = [
    { elapsed: 0, chars: '', index: 0, total: 0 },
    { elapsed: 1, chars: 'a', index: 1, total: 1 },
    { elapsed: 1501, chars: 'alpha beta', index: 8, total: 8, errors: 1 },
    {
        elapsed: 60_000_000,
        chars: 'alpha beta',
        index: 10,
        total: 15,
        errors: 5,
        completed: 100
    },
    { elapsed: 24_000_000, chars: 'abcdefghijklmnopqrstuvw', index: 23, total: 23 },
    { elapsed: 5_400_000_123, chars: 'alpha beta', index: 10, total: 500, completed: 40000 },
    {
        elapsed: 123_456_789,
        chars: 'bad clean',
        index: 9,
        total: 12,
        errors: 1,
        skipped: 2,
        bad: [1]
    },
    { elapsed: 45_000_000, duration: 30, chars: 'alpha', index: 5, total: 5 },
    {
        elapsed: 2_000_000,
        chars: 'alpha',
        index: 5,
        total: 5,
        intervals: [100, 100, 100, 100,
            100]
    },
    {
        elapsed: 2_000_000,
        chars: 'alpha',
        index: 5,
        total: 5,
        intervals: [100, 100, 100, 100,
            100, 100]
    },
    { elapsed: 2_000_000, chars: 'alpha', index: 5, total: 5, intervals: [0, 0, 0, 0, 0, 0] },
    {
        elapsed: 40_000_000_000,
        chars: 'alpha',
        index: 5,
        total: 5,
        intervals: [100, 5_400_000, 70, 1000, 250, 333]
    },
    {
        elapsed: 2_000_000,
        chars: 'alpha',
        index: 5,
        total: 5,
        intervals: [1, 2, 3, 4, 5,
        10000]
    },
    {
        elapsed: 2_000_000,
        chars: 'alpha',
        index: 5,
        total: 5,
        intervals: Array.from({ length: 45 }, (_, index) => index < 15 ? 10000 : 100 + index *
            3),
        missed: ['alpha', 'beta', '😀']
    }
];
for (const fixture of cases) {
    codec.sweep([]);
    for (const cell of Object.values(e))
        if (cell && typeof cell.index === 'number') tape[cell.index] = 0;
    for (const array of [e.chars, e.keys, e.pairs, e.intervals, e.errorMap, e.missed])
        tape.fill(0, array.base, array.base + (array.capacity + 1) * array.stride);
    const original = new TypingEngine();
    original.lines = [fixture.chars || 'a'];
    original.setupCurrentLine();
    original.currentCharIndex = fixture.index;
    original.typedChars.forEach((item, index) => {
        item.status = fixture.bad?.includes(index) ?
            'incorrect' : 'correct';
    });
    original.startTime = 1000.5;
    original.endTime = original.startTime + fixture.elapsed / 1000;
    original.timedDuration = fixture.duration || 0;
    original.totalKeystrokes = fixture.total;
    original.correctKeystrokes = fixture.total - (fixture.errors || 0);
    original.correctNonSpaceChars = fixture.index;
    original.netTypedChars = fixture.total;
    original.completedWordChars = fixture.completed || 0;
    original.errorKeystrokes = fixture.errors || 0;
    original.skippedChars = fixture.skipped || 0;
    original.keystrokeIntervals = fixture.intervals || [];
    tape[e.complete.index] = 1;
    pair('start', 1000500);
    pair('end', 1000500 + fixture.elapsed);
    for (const [field, value] of Object.entries({
            length: Array.from(fixture.chars).length,
            index: fixture.index,
            lineCount: 1,
            duration: fixture.duration || 0,
            total: fixture.total,
            correct: original.correctKeystrokes,
            nonSpace: fixture.index,
            netTyped: fixture.total,
            wordCredit: fixture.completed || 0,
            errors: fixture.errors || 0,
            skipped: fixture.skipped || 0
        }))
        tape[e[field].index] = value;
    for (const [index, char] of Array.from(fixture.chars).entries()) {
        put(e.chars, index, 0, char.codePointAt(0));
        put(e.chars, index, 1, fixture.bad?.includes(index) ? 2 : 1);
    }
    const intervals = (fixture.intervals || []).slice(-30);
    tape[e.intervalCount.index] = intervals.length;
    intervals.forEach((interval, index) => putInterval(index, interval));
    tape[e.missedCount.index] = fixture.missed?.length || 0;
    fixture.missed?.forEach((word, index) => put(e.missed, index, 0, codec.intern(word)));
    instance.exports.run();
    const actual = JSON.parse(JSON.stringify(codec.decode(root)));
    const expected = JSON.parse(JSON.stringify(original.getStats()));
    for (const field of Object.keys(expected)) {
        if (field === 'elapsedMilliseconds') {
            assert.ok(Math.abs(actual[field] - expected[field]) < 1e-9,
                `elapsed fractional transport: ${fixture.elapsed}`);
        } else assert.deepEqual(actual[field], expected[field],
            `${field}, elapsed ${fixture.elapsed}`);
    }
    assert.deepEqual(actual.missedWords, fixture.missed || []);
}
const savedNow = performance.now;
const savedInterval = globalThis.setInterval;
const savedClearInterval = globalThis.clearInterval;
let clock = 0;
performance.now = () => clock;
globalThis.setInterval = () => 1;
globalThis.clearInterval = () => {};
try {
    for (const gaps of [[100, 5_400_000, 70, 1000, 250, 333],
        Array.from({ length: 40 }, (_, index) => index < 10 ? 5_400_000 : 100 + index * 7)]) {
        codec.sweep([]);
        for (const cell of Object.values(e))
            if (cell && typeof cell.index === 'number') tape[cell.index] = 0;
        for (const array of [e.chars, e.keys, e.pairs, e.intervals, e.errorMap, e.missed])
            tape.fill(0, array.base, array.base + (array.capacity + 1) * array.stride);
        const line = 'a'.repeat(gaps.length + 2);
        tape[e.mode.index] = 1;
        tape[e.length.index] = line.length;
        tape[e.lineCount.index] = 1;
        for (let index = 0; index < line.length; index++) put(e.chars, index, 0, 97);
        const original = new TypingEngine();
        original.loadExercise(line);
        clock = 1000;
        for (const gap of [0, ...gaps]) {
            clock += gap;
            original.handleKey({ key: 'a' });
            codec.sweep([]);
            const micros = BigInt(Math.round(clock * 1000));
            input = [1, 97, Number(micros & 0xffffffffn), Number(micros >> 32n)];
            instance.exports.run();
            const actual = JSON.parse(JSON.stringify(codec.decode(root)));
            const expected = JSON.parse(JSON.stringify(original.getStats()));
            assert.deepEqual(actual.learning, expected.learning,
                '64-bit inter-key learning latency');
            assert.equal(actual.consistency, expected.consistency,
                'chronological 64-bit rolling intervals');
        }
        assert.ok(tape[e.lastTimeHi.index] > 0, 'long sessions retain the high timestamp word');
        const expectedIntervals = original.keystrokeIntervals;
        const cursor = tape[e.intervalCount.index] === 30 ? tape[e.intervalCursor.index] : 0;
        const actualIntervals = expectedIntervals.map((_, index) => {
            const row = (cursor + index) % 30;
            const base = e.intervals.base + row * e.intervals.stride + 2;
            return (tape[base + 1] * 0x100000000 + tape[base]) / 1000;
        });
        assert.deepEqual(actualIntervals, expectedIntervals);
        original.pause();
        let micros = BigInt(Math.round(clock * 1000));
        input = [2, Number(micros & 0xffffffffn), Number(micros >> 32n)];
        codec.sweep([]);
        instance.exports.run();
        clock += 5_400_000;
        original.resume();
        micros = BigInt(Math.round(clock * 1000));
        input = [3, Number(micros & 0xffffffffn), Number(micros >> 32n)];
        codec.sweep([]);
        instance.exports.run();
        assert.equal(tape[e.lastTimeHi.index], 0, 'resume resets the high timestamp word');
        assert.equal(tape[e.hasLastTime.index], 0);
    }
} finally {
    performance.now = savedNow;
    globalThis.setInterval = savedInterval;
    globalThis.clearInterval = savedClearInterval;
}
console.log(
    'Brainfuck statistics passed: zero/fractional/long timing, word credit, rolling consistency, bounds and missed words.'
);
