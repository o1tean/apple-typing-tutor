import assert from 'node:assert/strict';
import { BrainfuckProgram } from '../brainfuck/compiler.mjs';
import { createTokenArena } from '../brainfuck/runtime.mjs';
import { createNumbers } from '../brainfuck/numbers.mjs';
import { TokenCodec } from '../brainfuck/codec.js';
import { content } from '../brainfuck/content.mjs';
import { defineHistory } from '../brainfuck/history.mjs';
import { historyProgress } from '../js/progress.js';
import { formatElapsedTime, sessionLabel } from '../js/practice.js';

process.env.TZ = 'Europe/Bucharest';
const strings = [''];
const ids = new Map([['', 0]]);
const intern = value => {
    if (!ids.has(value)) {
        ids.set(value, strings.length);
        strings.push(value);
    }
    return ids.get(value);
};
const names = new Proxy({}, { get: (_target, name) => intern(name) });
const collect = value => {
    if (typeof value === 'string') intern(value);
    else if (value && typeof value === 'object')
        for (const [key, child] of Object.entries(value)) {
            intern(key);
            collect(child);
        }
};
collect(content);
const b = new BrainfuckProgram({ scalarCapacity: 32768, memoryPages: 512 });
const arena = createTokenArena(b, 100000, 'history_test');
const operation = b.scalar('operation');
const contentRoot = b.scalar('contentRoot');
const historyRoot = b.scalar('historyRoot');
const now = b.scalar('now');
const entry = b.scalar('entry');
const result = b.string('history_test_result', '', 12000);
const numbers = createNumbers(b, arena);
const history = defineHistory(b, arena, {
    keys: names,
    stringValues: names,
    contentRoot,
    numbers
});
b.read(operation);
b.read(contentRoot);
const match = b.scalar('match');
b.eq(match, operation, 1);
b.if(match, () => {
    b.read(historyRoot);
    b.read(now);
    history.renderHistory(historyRoot, now);
});
b.eq(match, operation, 2);
b.if(match, () => {
    b.read(entry);
    const value = history.elapsedText(entry);
    b.copy(result.length, value.length);
    const char = b.scalar('elapsedChar');
    b.repeat(value.length, index => {
        b.arrayGet(value.data, index, char);
        b.arraySet(result.data, index, char);
    });
});
b.eq(match, operation, 3);
b.if(match, () => {
    b.read(entry);
    const value = history.sessionLabel(entry);
    b.copy(result.length, value.length);
    const char = b.scalar('labelChar');
    b.repeat(value.length, index => {
        b.arrayGet(value.data, index, char);
        b.arraySet(result.data, index, char);
    });
});
const queue = [];
let packet = [];
let codec;
const html = new Map();
const htmlWrites = [];
const texts = new Map();
const attributes = new Map();
const schemas = {
    1: 'ss',
    2: 'ss',
    3: 'ss',
    4: 'sss',
    22: 'nsn',
    24: 'n',
    29: 's',
    34: 'ssn',
    35: 'ss',
    37: 'nsn'
};
const operate = (opcode, args) => {
    const [a, c, d] = args;
    if (opcode === 1 || opcode === 2) {
        htmlWrites.push({ opcode, selector: a, value: c });
        html.set(a, opcode === 1 ? c : (html.get(a) || '') + c);
    } else if (opcode === 3) texts.set(a, c);
    else if (opcode === 4) attributes.set(`${a}/${c}`, d);
    else if (opcode === 35) attributes.delete(`${a}/${c}`);
    else if (opcode === 24) {
        const chars = Array.from(codec.strings[a], char => char.codePointAt(0));
        queue.push(chars.length, ...chars);
    } else if (opcode === 29) queue.push(codec.intern(a));
    else if (opcode === 37) {
        const number = codec.decode(a);
        queue.push(codec.intern(c === 'fixed' ? number.toFixed(d) :
            c === 'precision' ? number.toPrecision(d) : String(number)));
    } else if (opcode === 22) {
        const value = codec.decode(a);
        const date = new Date(value);
        let result;
        if (c === 'utc') result = Date.UTC(...value);
        else if (c === 'parts') result = {
            year: date.getFullYear(),
            month: date.getMonth(),
            day: date.getDate(),
            timestamp: date.getTime()
        };
        else if (c === 'iso') result = date.toISOString();
        else result = date.toLocaleString(undefined, JSON.parse(c));
        queue.push(codec.encode(result));
    }
};
const write = value => {
    packet.push(value);
    const schema = schemas[packet[0]];
    assert.ok(schema, `Unexpected history transport opcode ${packet[0]}`);
    let cursor = 1;
    const args = [];
    for (const type of schema) {
        if (cursor >= packet.length) return;
        if (type === 'n') args.push(packet[cursor++]);
        else {
            const count = packet[cursor++];
            if (cursor + count > packet.length) return;
            args.push(packet.slice(cursor, cursor + count)
                .map(code => String.fromCodePoint(code)).join(''));
            cursor += count;
        }
    }
    assert.equal(cursor, packet.length);
    const opcode = packet[0];
    packet = [];
    operate(opcode, args);
};
const { instance } = await WebAssembly.instantiate(b.compile(), {
    env: {
        read: () => { assert.ok(queue.length); return queue.shift(); },
        write
    }
});
codec = new TokenCodec(instance.exports.memory, arena.layout, strings.slice(1));
const root = codec.encode(content);
const tape = () => new Uint32Array(instance.exports.memory.buffer);
const scalar = value => tape()[value.index];
const arrayValue = (array, index, member = 0) =>
    tape()[array.base + index * array.stride + 2 + member];
const resultText = () => Array.from({ length: scalar(result.length) }, (_, index) =>
    String.fromCodePoint(arrayValue(result.data, index))).join('');
const run = (operation, ...args) => {
    queue.push(operation, root, ...args);
    instance.exports.run();
    assert.equal(queue.length, 0);
    assert.equal(packet.length, 0);
};
const session = (date, wpm = 40, accuracy = 90, extra = {}) => ({
    lessonId: 'amat-1',
    date,
    wpm,
    accuracy,
    wpmMetric: 'words-v1',
    elapsedMilliseconds: 30000,
    stars: 2,
    ...extra
});
const sessions = [
    session('2026-10-07T08:00:00Z', 60, 100), session('2026-10-06T21:30:00Z'),
    session('2026-10-06T08:00:00Z', 30, 95), session('2026-10-04T08:00:00Z'),
    session('2026-10-04T07:00:00Z', 999, 1, { elapsedMilliseconds: 0 }),
    session('2026-10-03T08:00:00Z'), session('2026-10-02T08:00:00Z'),
    session('2026-09-29T08:00:00Z', 900, 5, { wpmMetric: undefined }),
    session(null, 800, 1), session('2026-10-08T08:00:00Z', 700, 1)
];
const date = new Date('2026-10-07T09:00:00Z');
const maxRows = () => {
    const sessions = Array.from({ length: 1000 }, (_, index) => session(
        new Date(date.getTime() - (index % 14) * 86400000).toISOString(),
        40 + index % 25, 90 + index % 11, {
            rawWpm: 50 + index % 25,
            recordReason: `Saved session ${index} <retained>`,
            futureSession: { index, values: ['keep', true] }
        }));
    const saved = codec.encode(sessions);
    const original = codec.decode(saved);
    const writesBefore = htmlWrites.length;
    try {
        run(1, saved, codec.encode(date.getTime()));
    } catch (error) {
        error.message += ` (history output ${scalar(history.output.length)}` +
            `/${history.output.data.capacity}, tokens ${scalar(arena.count)})`;
        throw error;
    }
    const table = html.get('#bf-history-rows');
    const rows = table.match(/<tr>[\s\S]*?<\/tr>/g) || [];
    assert.equal(rows.length, 1000, 'Every retained session has a complete table row');
    assert.ok(table.length > 180000, 'The retained table exceeds the previous output cap');
    assert.equal(table, rows.join(''), 'The table contains only complete rows');
    for (const [index, row] of rows.entries()) {
        assert.ok(row.includes(`Saved session ${index} &lt;retained&gt;`));
        assert.ok(row.includes(`<td>${sessions[index].wpm} / ${sessions[index].rawWpm}<small`));
        assert.ok(row.includes(`<td>${sessions[index].accuracy}%</td><td>30s</td>`));
        assert.ok(row.endsWith(new Date(sessions[index].date).toLocaleString(
            undefined, { month: 'short', day: 'numeric' }) + '</td></tr>'));
    }
    const writes = htmlWrites.slice(writesBefore).filter(write =>
        write.selector === '#bf-history-rows');
    assert.deepEqual(writes.filter(write => write.opcode === 1),
        [{ opcode: 1, selector: '#bf-history-rows', value: '' }]);
    assert.equal(writes.filter(write => write.opcode === 2).length, 1000);
    assert.ok(writes.every(write => write.value.length < history.output.data.capacity));
    assert.deepEqual(codec.decode(saved), original, 'Rendering preserves every saved field');
    const expected = historyProgress(sessions, date);
    assert.equal(scalar(history.currentStreak), expected.currentStreak);
    assert.equal(scalar(history.longestStreak), expected.longestStreak);
    for (const [index, day] of expected.days.entries()) {
        assert.equal(arrayValue(history.days, index, 1), day.sessions);
        assert.equal(arrayValue(history.days, index, 2), day.measuredSessions);
        assert.equal(codec.decode(arrayValue(history.days, index, 3)), day.wpm);
        assert.equal(codec.decode(arrayValue(history.days, index, 4)), day.accuracy);
    }
    assert.equal(texts.get('#bf-history-caption'),
        'Last 1000 sessions · stored on this device');
    console.log(
        `Brainfuck maximum history passed: ${rows.length} rows, ${table.length} characters.`
    );
};
if (process.argv.includes('--max-rows')) {
    maxRows();
    process.exit(0);
}
run(1, codec.encode(sessions), codec.encode(date.getTime()));
const expected = historyProgress(sessions, date);
assert.equal(scalar(history.currentStreak), expected.currentStreak);
assert.equal(scalar(history.longestStreak), expected.longestStreak);
const actualDays = expected.days.map((_, index) => ({
    date: codec.strings[arrayValue(history.days, index, 6)],
    label: codec.strings[arrayValue(history.days, index, 5)],
    sessions: arrayValue(history.days, index, 1),
    measuredSessions: arrayValue(history.days, index, 2),
    wpm: codec.decode(arrayValue(history.days, index, 3)),
    accuracy: codec.decode(arrayValue(history.days, index, 4))
}));
assert.deepEqual(actualDays, expected.days);
assert.equal(texts.get('#bf-history-caption'), 'Last 10 sessions · stored on this device');
assert.match(html.get('#bf-current-streak'), /^2 <small>days<\/small>$/);
assert.match(html.get('#bf-longest-streak'), /^3 <small>days<\/small>$/);
assert.equal((html.get('#bf-history-rows').match(/<tr>/g) || []).length, 10);
assert.equal((html.get('#bf-daily-rows').match(/<tr>/g) || []).length, 14);
for (const metric of ['wpm', 'accuracy']) {
    const chart = html.get(`#bf-trend-points-${metric}`);
    assert.equal((chart.match(/<path /g) || []).length, 5);
    assert.equal((chart.match(/<polyline /g) || []).length, 3);
}
for (const milliseconds of [0, 0.00001, 0.1, 1, 100, 999, 1000, 1234, 10000, NaN]) {
    run(2, codec.encode({ elapsedMilliseconds: milliseconds }));
    assert.equal(resultText(), formatElapsedTime(milliseconds));
}
for (const entry of [
        { lessonId: 'custom' }, { lessonId: 'missed-words' }, { lessonId: 'amat-1' },
        { lessonId: 'quote-franklin' }, { lessonId: 'quote-9' }, { lessonId: 'quote-unknown' },
        { lessonId: 'time-30-punctuation-numbers', typingMode: 'strict' },
        { lessonId: 'speed-15' }, {
            lessonId: 'words-10',
            testWordCount: 25,
            testMode: 'words'
        },
        { lessonId: 'time-123456789123456789' }, { lessonId: 'future-kind', testMode: 'time' },
        { lessonId: 'future-kind' }
]) {
    run(3, codec.encode(entry));
    assert.equal(resultText(), sessionLabel(entry));
}
run(2, codec.encode({ elapsedMilliseconds: null }));
assert.equal(resultText(), '—');
run(2, codec.encode({ elapsedSeconds: 0.0001 }));
assert.equal(resultText(), formatElapsedTime(0.1));
for (const sessions of [
    [session('2026-10-06T08:00:00Z', 40.05, 90.05),
        session('2026-10-06T09:00:00Z', 60.07, 99.01)],
    [session('2026-10-06T08:00:00Z', 9007199254740991, 100),
        session('2026-10-06T09:00:00Z', 9007199254740990, 90)],
    [session('1960-10-06T08:00:00Z', 40, 90)],
    [session('2026-10-06T08:00:00Z', 40, 90, { wpmMetric: undefined })]
]) {
    run(1, codec.encode(sessions), codec.encode(date.getTime()));
    const expected = historyProgress(sessions, date);
    assert.equal(scalar(history.currentStreak), expected.currentStreak);
    assert.equal(scalar(history.longestStreak), expected.longestStreak);
    for (let index = 0; index < 14; index++) {
        assert.equal(codec.decode(arrayValue(history.days, index, 3)), expected.days[index].wpm);
        assert.equal(codec.decode(arrayValue(history.days, index, 4)), expected.days[index]
            .accuracy);
    }
}
run(1, codec.encode([]), codec.encode(date.getTime()));
assert.match(html.get('#bf-dialog-body'), /Your first session is waiting/);
maxRows();
console.log('Brainfuck history checks passed: retained rows, exact daily aggregates, local ' +
    'streaks, chart gaps, session labels, and sub-millisecond elapsed time.');
