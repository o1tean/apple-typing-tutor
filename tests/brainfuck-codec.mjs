import assert from 'node:assert/strict';
import { BrainfuckProgram } from '../brainfuck/compiler.mjs';
import { TokenCodec } from '../brainfuck/codec.js';
import { createTokenArena } from '../brainfuck/runtime.mjs';

const cases = [];
const check = (name, run) => cases.push({ name, run });

function fixture(capacity = 128) {
    const program = new BrainfuckProgram({ scalarCapacity: 512, memoryPages: 4 });
    const { layout } = createTokenArena(program, capacity, 'codec_check');
    const memory = new WebAssembly.Memory({ initial: program.memoryPages });
    return new TokenCodec(memory, layout);
}

function liveSnapshot(codec, roots) {
    const pending = [...roots];
    const nodes = new Map();
    while (pending.length) {
        const id = pending.pop();
        if (!id || nodes.has(id)) continue;
        nodes.set(id, codec.layout.fields.map(field => codec.field(id, field)));
        pending.push(codec.field(id, 'child'), codec.field(id, 'next'));
    }
    return nodes;
}

function allocationSnapshot(codec) {
    const count = codec.tape[codec.layout.countIndex];
    const head = codec.tape[codec.layout.freeHeadIndex];
    const links = [];
    const visited = new Set();
    for (let id = head; id; id = codec.field(id, 'next')) {
        assert.ok(id <= count && !visited.has(id), 'free list stays bounded and acyclic');
        visited.add(id);
        links.push([id, codec.field(id, 'next')]);
    }
    return { count, head, links };
}

function assertRollback(codec, root, before, live, saved) {
    assert.deepEqual(allocationSnapshot(codec), before, 'allocation transaction is restored');
    assert.deepEqual(liveSnapshot(codec, [root]), live, 'previous live nodes are untouched');
    assert.equal(JSON.stringify(codec.decode(root)), saved, 'previous data remains readable');
}

check('structural JSON preserves unknown nested fields', () => {
    const codec = fixture();
    const original = {
        futureVersion: 999,
        settings: { unknown: { enabled: false, empty: '', nothing: null } },
        results: [true, false, null, [], {}, { extension: ['value', 1.25] }]
    };
    const decoded = codec.decode(codec.encode(original));
    assert.equal(JSON.stringify(decoded), JSON.stringify(original));
    assert.equal(Object.getPrototypeOf(decoded), null);
    assert.equal(Object.getPrototypeOf(decoded.settings.unknown), null);
    assert.ok(Array.isArray(decoded.results));
});

check('prototype keys and exact UTF-16 keys and values survive', () => {
    const codec = fixture();
    const original = JSON.parse('{"__proto__":{"codecPolluted":true},' +
        '"constructor":{"prototype":"retained"},"toString":"own value",' +
        '"\\ud800":"high \\ud800","\\udc00":"low \\udc00",' +
        '"é":"composed","é":"decomposed","😀":"pair","nul\\u0000":"\\u0000"}');
    const decoded = codec.decode(codec.encode(original));
    assert.equal(JSON.stringify(decoded), JSON.stringify(original));
    assert.ok(Object.hasOwn(decoded, '__proto__'));
    assert.ok(Object.hasOwn(decoded, 'constructor'));
    assert.equal(decoded.__proto__.codecPolluted, true);
    assert.equal(Object.getPrototypeOf(decoded), null);
    assert.equal(Object.hasOwn(Object.prototype, 'codecPolluted'), false);
    assert.equal(decoded['\ud800'], 'high \ud800');
    assert.equal(decoded['\udc00'], 'low \udc00');
    assert.equal(decoded['é'], 'composed');
    assert.equal(decoded['é'], 'decomposed');
});

check('strings larger than one MiB retain every UTF-16 unit', () => {
    const codec = fixture();
    const value = 'x'.repeat(1024 * 1024 + 17) + '\ud800😀\udc00\u0000tail';
    const decoded = codec.decode(codec.encode({ unknownRaw: value }));
    assert.ok(value.length > 1024 * 1024);
    assert.equal(decoded.unknownRaw, value);
    assert.equal(JSON.stringify(decoded), JSON.stringify({ unknownRaw: value }));
});

check('numeric transport retains fractions, extrema and IEEE values', () => {
    const codec = fixture();
    const values = [0, -0, 0.1, -12.75, Number.MIN_VALUE, -Number.MIN_VALUE,
        Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_SAFE_INTEGER,
        -Number.MAX_SAFE_INTEGER, 0xffffffff, 0x100000000, 2 ** 64,
        Infinity, -Infinity, NaN];
    for (const value of values) {
        const id = codec.encode(value);
        assert.ok(Object.is(codec.decode(id), value), `exact number round trip: ${value}`);
        codec.field(id, 'raw', 0);
        assert.ok(Object.is(codec.decode(id), value),
            `IEEE fields without raw text: ${value}`);
    }
});

check('the final allocator slot is permitted and reusable', () => {
    const codec = fixture(4);
    const ids = ['one', 'two', 'three', 'four'].map(value => codec.encode(value));
    assert.deepEqual(ids, [1, 2, 3, 4]);
    assert.equal(codec.tape[codec.layout.countIndex], 4);
    assert.throws(() => codec.encode('overflow'), RangeError);
    assert.deepEqual(ids.map(id => codec.decode(id)), ['one', 'two', 'three', 'four']);
    assert.equal(codec.tape[codec.layout.countIndex], 4);
    codec.sweep([ids[0], ids[2]]);
    assert.equal(codec.encode('second reuse'), 2);
    assert.equal(codec.encode('final reuse'), 4);
    assert.equal(codec.decode(4), 'final reuse');
    assert.equal(codec.tape[codec.layout.countIndex], 4);
});

check('sweep preserves live token IDs and stable raw string handles', () => {
    const codec = fixture();
    codec.encode({ garbage: ['old', 1] });
    const first = codec.encode({ keep: [{ value: 'retained' }, false] });
    codec.encode(['discard', 'also discard']);
    const second = codec.encode({ other: 'second root' });
    const live = liveSnapshot(codec, [first, second]);
    const saved = [first, second].map(id => JSON.stringify(codec.decode(id)));
    const handle = codec.internNullable('{"unreadable":"\ud800"}');
    const empty = codec.internNullable('');
    assert.notEqual(empty, 0, 'present empty raw data differs from a missing handle');
    codec.sweep([first, second]);
    const free = allocationSnapshot(codec);
    assert.ok(free.links.length > 0);
    assert.equal(free.links.length + live.size, free.count);
    for (const [id] of free.links) assert.equal(codec.encode('replacement'), id);
    assert.equal(codec.tape[codec.layout.countIndex], free.count);
    assert.equal(codec.tape[codec.layout.freeHeadIndex], 0);
    assert.deepEqual(liveSnapshot(codec, [first, second]), live);
    assert.deepEqual([first, second].map(id => JSON.stringify(codec.decode(id))), saved);
    assert.equal(codec.internNullable('{"unreadable":"\ud800"}'), handle);
    assert.equal(codec.strings[handle], '{"unreadable":"\ud800"}');
    assert.equal(codec.internNullable(''), empty);
    assert.equal(codec.strings[empty], '');
});

check('capacity failure rolls back reused nodes and new allocations', () => {
    const codec = fixture(10);
    const root = codec.encode({ kept: { values: [1, true] }, future: 'raw' });
    codec.encode(['discard', 2]);
    codec.sweep([root]);
    const before = allocationSnapshot(codec);
    const live = liveSnapshot(codec, [root]);
    const saved = JSON.stringify(codec.decode(root));
    assert.equal(before.count, 9);
    assert.equal(before.links.length, 3);
    assert.throws(() => codec.encode([1, 2, 3, 4, 5, 6, 7]), RangeError);
    assertRollback(codec, root, before, live, saved);
    assert.equal(codec.encode(['recovered', 7]), before.head);
    assert.equal(codec.encode(42), 10, 'new allocation still reaches the final slot');
    assert.equal(JSON.stringify(codec.decode(root)), saved);
});

check('a throwing property rolls back the whole encoding transaction', () => {
    const codec = fixture(10);
    const root = codec.encode({ saved: 'yes' });
    codec.encode('free one');
    codec.encode('free two');
    codec.sweep([root]);
    const before = allocationSnapshot(codec);
    const live = liveSnapshot(codec, [root]);
    const saved = JSON.stringify(codec.decode(root));
    const failure = new Error('fixture getter failed');
    const throwing = { get value() { throw failure; } };
    assert.throws(() => codec.encode([1, throwing]), error => error === failure);
    assertRollback(codec, root, before, live, saved);
    assert.equal(codec.decode(codec.encode('usable after failure')),
        'usable after failure');
});

check('cyclic input fails safely while repeated noncyclic objects work', () => {
    const codec = fixture(16);
    const root = codec.encode({ saved: 'intact' });
    codec.encode(['discard', true]);
    codec.sweep([root]);
    const before = allocationSnapshot(codec);
    const live = liveSnapshot(codec, [root]);
    const saved = JSON.stringify(codec.decode(root));
    const cyclic = { value: 'before cycle' };
    cyclic.self = cyclic;
    assert.throws(() => codec.encode(cyclic));
    assertRollback(codec, root, before, live, saved);
    const shared = { value: 'shared without cycle' };
    assert.equal(JSON.stringify(codec.decode(codec.encode([shared, shared]))),
        JSON.stringify([shared, shared]));
    assert.equal(JSON.stringify(codec.decode(root)), saved);
});

for (const { name, run } of cases) {
    run();
    console.log(`PASS ${name}`);
}
console.log(`Brainfuck codec: ${cases.length} boundary checks passed.`);
