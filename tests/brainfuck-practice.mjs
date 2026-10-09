import assert from 'node:assert/strict';
import { BrainfuckProgram } from '../brainfuck/compiler.mjs';
import { createTokenArena } from '../brainfuck/runtime.mjs';
import { TokenCodec } from '../brainfuck/codec.js';
import { createNumbers } from '../brainfuck/numbers.mjs';
import { content, layouts, words, quotes, tracks } from '../brainfuck/content.mjs';
import { definePractice, PRACTICE_KEYS, PRACTICE_STRINGS } from '../brainfuck/practice.mjs';
import { DEFAULT_SETTINGS } from '../brainfuck/storage.mjs';
import { lessonPath, latestLesson, focusKeys } from '../js/practice.js';

const extra = [
    'keyboardLayout', 'lessonTrack', 'lessonIndex', 'quoteIndex', 'track', 'options',
    'recordEligible', 'focusGroup', 'learningBefore', 'focusKeys', 'steps', 'stars',
    'completed', 'lastPlayed', 'lessonId', 'reason', 'total', 'threeStar', 'next',
    'version', 'keys', 'bigrams', 'attempts', 'errors', 'latencySamples',
    'recentErrorRate', 'recentLatencyMs', 'duration', 'lesson', 'test', 'quote',
    'custom', 'weak', 'retry', 'weak-keys', 'weak-pairs', 'Weak-key practice',
    'Pair practice', 'custom text', 'First lesson without a saved completion.',
    'All lessons completed. Work toward 3 stars here.',
    'All 3-star targets earned. Revisit the final lesson.'
];
const allStrings = new Set([...extra, ...PRACTICE_KEYS, ...PRACTICE_STRINGS]);
const collect = value => {
    if (typeof value === 'string') allStrings.add(value);
    else if (value && typeof value === 'object') {
        for (const [name, child] of Object.entries(value)) {
            if (!Array.isArray(value)) allStrings.add(name);
            collect(child);
        }
    }
};
collect(content);
collect(DEFAULT_SETTINGS);
const strings = ['', ...Array.from(allStrings).filter(Boolean)];
const ids = Object.fromEntries(strings.map((text, index) => [text, index]));
const b = new BrainfuckProgram({ scalarCapacity: 8192, memoryPages: 256 });
const arena = createTokenArena(b, 80000, 'practice_test');
const operation = b.scalar('operation');
const contentRoot = b.scalar('contentRoot');
const numbers = createNumbers(b, arena);
const practice = definePractice(b, arena, { keys: ids, stringValues: ids, contentRoot, numbers });
b.read(operation);
b.read(contentRoot);
let serial = 0;
const argument = () => {
    const out = b.scalar(`argument_${serial++}`);
    b.read(out);
    return out;
};
const branch = (id, emit) => {
    const match = b.scalar(`branch_${id}`);
    b.eq(match, operation, id);
    b.if(match, emit);
};
branch(1, () => practice.speed(argument(), argument(), argument()));
branch(2, () => practice.lesson(argument(), argument(), argument()));
branch(3, () => practice.custom(argument()));
branch(4, () => practice.quote(argument()));
branch(5, () => practice.path(argument(), argument(), argument()));
branch(6, () => practice.latest(argument(), argument()));
branch(7, () => practice.focusKeys(argument(), argument(), argument()));
branch(8, () => practice.weak(argument(), argument(), argument()));
branch(9, () => practice.repeat());
branch(10, () => practice.test(argument(), argument()));
branch(11, () => practice.retry(argument()));
branch(12, () => practice.focusLabel(argument()));
branch(13, () => practice.nextQuote());

const queue = [];
const packets = [];
const schemas = { 15: 'n', 24: 'n', 29: 's', 32: 'ss', 33: 'ss', 37: 'nsn' };
let codec;
let randomState = 123456789;
const operate = (opcode, args) => {
    if (opcode === 15) {
        randomState ^= randomState << 13;
        randomState ^= randomState >>> 17;
        randomState ^= randomState << 5;
        queue.push(randomState >>> 0);
    } else if (opcode === 24) {
        const chars = Array.from(codec.strings[args[0]], char => char.codePointAt(0));
        queue.push(chars.length, ...chars);
    } else if (opcode === 29) queue.push(codec.intern(args[0]));
    else if (opcode === 32) queue.push(codec.intern(args[0].normalize(args[1])));
    else if (opcode === 33) {
        const comparison = args[0].localeCompare(args[1]);
        queue.push(comparison < 0 ? 1 : comparison > 0 ? 2 : 0);
    } else if (opcode === 37) {
        const value = codec.decode(args[0]);
        const text = args[1] === 'fixed' ? value.toFixed(args[2]) :
            args[1] === 'precision' ? value.toPrecision(args[2]) : String(value);
        queue.push(codec.intern(text));
    }
};
const write = value => {
    packets.push(value);
    const schema = schemas[packets[0]];
    assert.ok(schema, `Unexpected practice transport opcode ${packets[0]}`);
    let cursor = 1;
    const args = [];
    for (const type of schema) {
        if (cursor >= packets.length) return;
        if (type === 'n') args.push(packets[cursor++]);
        else {
            const length = packets[cursor++];
            if (cursor + length > packets.length) return;
            args.push(packets.slice(cursor, cursor + length)
                .map(code => String.fromCodePoint(code)).join(''));
            cursor += length;
        }
    }
    assert.equal(cursor, packets.length);
    const opcode = packets[0];
    packets.length = 0;
    operate(opcode, args);
};
const { instance } = await WebAssembly.instantiate(b.compile(), { env: {
    read: () => {
        assert.ok(queue.length, 'Brainfuck requested missing input');
        return queue.shift();
    }, write
} });
codec = new TokenCodec(instance.exports.memory, arena.layout, strings.slice(1));
const root = codec.encode(content);
const tape = () => new Uint32Array(instance.exports.memory.buffer);
const arrayValue = (array, index, field = 0) =>
    tape()[array.base + index * array.stride + 2 + field];
const scalar = value => tape()[value.index];
const exerciseLines = () => Array.from({ length: scalar(practice.lineCount) }, (_, line) => {
    const offset = arrayValue(practice.lines, line, 0);
    const length = arrayValue(practice.lines, line, 1);
    return Array.from({ length }, (_, index) => String.fromCodePoint(
        arrayValue(practice.text.data, offset + index))).join('');
});
const run = (id, ...args) => {
    queue.push(id, root, ...args);
    instance.exports.run();
    assert.equal(queue.length, 0);
    assert.equal(packets.length, 0);
    return exerciseLines();
};

for (const punctuation of [0, 1]) {
    for (const numbers of [0, 1]) {
        const [text] = run(1, 50, punctuation, numbers);
        const items = text.split(' ');
        assert.equal(items.length, 50);
        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            if (punctuation) {
                assert.equal(/[.,]$/.test(item), index % 8 === 3 || index % 8 === 7 ||
                    index === items.length - 1);
                if (index % 8 === 0 && !(numbers && index % 9 === 7))
                    assert.match(item, /^[A-Z]/);
            }
            const word = item.replace(/[.,]$/, '').toLowerCase();
            if (numbers && index % 9 === 7) assert.match(word, /^\d{1,3}$/);
            else assert.ok(words.includes(word));
            if (index && !(numbers && (index % 9 === 7 || (index - 1) % 9 === 7)))
                assert.notEqual(word, items[index - 1].replace(/[.,]$/, '').toLowerCase());
        }
    }
}
for (let layoutIndex = 0; layoutIndex < layouts.length; layoutIndex++) {
    for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
        const track = tracks[trackIndex].id;
        for (const [lessonIndex, lesson] of layouts[layoutIndex].lessons[track].entries()) {
            let lines;
            try { lines = run(2, layoutIndex, trackIndex, lessonIndex); }
            catch (error) {
                throw new Error(`Brainfuck drill ${layouts[layoutIndex].id}/${lesson.id} failed`,
                    { cause: error });
            }
            assert.equal(lines.length, 4);
            for (const line of lines) {
                assert.equal(line.split(' ').length, Math.max(8, Math.ceil(lesson.focus.length / 4)));
                for (const char of line) assert.ok(lesson.allowed.includes(char),
                    `${layouts[layoutIndex].id}/${lesson.id} disallowed ${char}`);
            }
            const metadata = codec.decode(scalar(practice.metadata));
            assert.equal(metadata.id, lesson.id);
            assert.equal(metadata.track, 'lesson');
            assert.equal(metadata.lessonTrack, track);
            assert.equal(metadata.keyboardLayout, layouts[layoutIndex].id);
        }
    }
}
assert.deepEqual(run(3, codec.intern(' \u00ADa\u200B\te\u0301\n\u00A0b\u2028😀  ')),
    ['a é b 😀']);
assert.deepEqual(run(3, codec.intern('\u00AD\u200B \t\n')), []);
for (const index of [0, 53, 99]) {
    assert.deepEqual(run(4, index), [quotes[index].text]);
    const metadata = codec.decode(scalar(practice.metadata));
    assert.equal(metadata.id, `quote-${quotes[index].id}`);
    assert.equal(metadata.title, `quote · ${quotes[index].author}`);
    assert.equal(metadata.source, quotes[index].source);
}
assert.deepEqual(run(13), [quotes[0].text]);
const repeated = exerciseLines();
run(9);
assert.deepEqual(exerciseLines(), repeated);
assert.equal(codec.decode(scalar(practice.metadata)).options.recordEligible, false);
assert.deepEqual(run(11, codec.encode(['weather', 'é😀', 'words'])), ['weather é😀 words']);
assert.equal(codec.decode(scalar(practice.metadata)).title, 'missed words · 3');
run(12, codec.intern(' a'));
assert.equal(codec.strings[scalar(practice.normalizedHandle)], 'Space → a');
for (const testMode of ['time', 'words']) {
    const settings = { ...DEFAULT_SETTINGS, testMode, testDuration: 15, testWordCount: 10,
        punctuation: true, numbers: true, typingMode: 'strict' };
    const [text] = run(10, codec.encode(settings), 3);
    assert.equal(text.split(' ').length, testMode === 'time' ? 400 : 10);
    const metadata = codec.decode(scalar(practice.metadata));
    assert.equal(metadata.id, testMode === 'time' ? 'time-15-punctuation-numbers' :
        'words-10-punctuation-numbers');
    assert.equal(metadata.title, testMode === 'time' ? '15 second test' : '10 word test');
    assert.equal(metadata.duration, testMode === 'time' ? 15 : 0);
    assert.equal(metadata.keyboardLayout, 'uk-iso');
    assert.deepEqual({ ...metadata.options }, Object.fromEntries(['testMode', 'testDuration',
        'testWordCount', 'punctuation', 'numbers', 'typingMode'].map(name =>
        [name, settings[name]])));
}
const progress = {
    'amat-1': { stars: 2, completed: true, lastPlayed: 1700000000000 },
    'words-v1:amat-1': { stars: 3, completed: false, lastPlayed: 1800000000000 },
    'amat-3': { stars: 0, completed: true, lastPlayed: 1900000000000 }
};
const progressNode = codec.encode(progress);
run(5, progressNode, 0, 0);
const actualPath = codec.decode(scalar(practice.pathResult));
const expectedPath = lessonPath(layouts[0].lessons.amateur, progress);
for (const field of ['total', 'completed', 'threeStar', 'reason'])
    assert.equal(actualPath[field], expectedPath[field]);
assert.equal(actualPath.next.index, expectedPath.next.index);
assert.deepEqual(actualPath.steps.map(({ id, index, stars, completed }) =>
    ({ id, index, stars, completed })), expectedPath.steps.map(({ id, index, stars, completed }) =>
    ({ id, index, stars, completed })));
for (const history of [[], [{ lessonId: 'unrelated' }], [{ lessonId: 'pro-3' }]]) {
    run(6, codec.encode(history), progressNode);
    assert.deepEqual({ ...codec.decode(scalar(practice.latestResult)) },
        latestLesson(history, progress));
}
const observation = (rate, reach, attempts = 20, samples = 20) => ({
    attempts, errors: Math.round(rate * attempts), latencySamples: samples,
    latencyTotalMs: reach * samples, recentErrorRate: rate, recentLatencyMs: reach
});
const profiles = [
    { version: 1, keys: { a: observation(1, 0, 20, 0),
        b: observation(0, 300), c: observation(0.4, 150) }, bigrams: {} },
    { version: 1, keys: { ' ': observation(1, 200), a: observation(1, 200),
        '-': observation(1, 200) }, bigrams: { st: observation(0, 400),
        er: observation(0.3, 120), '  ': observation(1, 400) } },
    { version: 1, keys: { y: observation(0.6, 0, 20, 0),
        c: observation(1, 0, 20, 0), a: observation(1, 0, 20, 0) }, bigrams: {} },
    { version: 1, keys: { a: observation(1e-14, 0, 20, 0) }, bigrams: {} },
    { version: 1, keys: { a: observation(0, 9007199254740991, 1, 1),
        b: observation(0, 4503599627370495.5, 1, 1),
        c: observation(0.1, 4503599627370495.5, 1, 1) },
        bigrams: {} },
    { version: 2, keys: { a: observation(1, 500) }, bigrams: {} },
    { version: 1.5, keys: { a: observation(1, 500) }, bigrams: {} }
];
const focused = () => Array.from({ length: scalar(practice.focusCount) }, (_, index) =>
    codec.strings[arrayValue(practice.focus, index)]);
for (const profile of profiles) {
    const node = codec.encode(profile);
    for (const group of [0, 1]) {
        const limit = group ? 1 : 3;
        run(7, node, limit, group);
        assert.deepEqual(focused(), focusKeys(profile, limit, group ? 'bigrams' : 'keys'));
    }
}
for (const group of [0, 1]) {
    for (let layout = 0; layout < layouts.length; layout++) {
        const profile = profiles[1];
        const lines = run(8, codec.encode(profile), layout, group);
        const metadata = codec.decode(scalar(practice.metadata));
        assert.equal(lines.length, group ? 2 : 4);
        assert.deepEqual(metadata.focusKeys,
            focusKeys(profile, group ? 1 : 3, group ? 'bigrams' : 'keys'));
        assert.equal(metadata.options.recordEligible, false);
        assert.deepEqual(JSON.parse(JSON.stringify(metadata.learningBefore)), profile);
        for (const line of lines) {
            assert.ok(line.length);
            assert.equal(line, line.trim());
            assert.ok(!line.includes('  '));
        }
        if (group) for (const line of lines) for (const word of line.split(' '))
            assert.ok(['stst', 'ststst'].includes(word));
    }
}
console.log('Brainfuck practice checks passed: speed options, all 88 lesson/layout drills, ' +
    'Unicode custom normalization, quote/retry/repeat metadata, progress path, latest lesson, ' +
    'exact adaptive ranking and key/pair drills.');
