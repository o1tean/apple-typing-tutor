import assert from 'node:assert/strict';
import { BrainfuckProgram } from '../brainfuck/compiler.mjs';
import { createTokenArena } from '../brainfuck/runtime.mjs';
import { TokenCodec } from '../brainfuck/codec.js';
import { defineEngine } from '../brainfuck/engine.mjs';
import { defineDemo } from '../brainfuck/demo.mjs';
import { content } from '../brainfuck/content.mjs';

const b = new BrainfuckProgram({ scalarCapacity: 8192, memoryPages: 256 });
const engine = defineEngine(b);
const arena = createTokenArena(b, 50000, 'demo_test');
const strings = [''];
const ids = new Map([['', 0]]);
const intern = value => {
    if (!ids.has(value)) {
        ids.set(value, strings.length);
        strings.push(value);
    }
    return ids.get(value);
};
const keys = new Proxy({}, { get: (_target, name) => intern(name) });
const gather = value => {
    if (typeof value === 'string') intern(value);
    else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            intern(key);
            gather(child);
        }
    }
};
gather(content);
const state = Object.fromEntries(['demo', 'demoIndex', 'demoPlaying', 'layout',
    'dialog', 'focused'].map(name => [name, b.scalar('state:' + name)]));
const root = b.scalar('contentRoot');
const operation = b.scalar('operation');
const guides = b.scalar('guideCalls');
const lesson = b.scalar('lessonCalled');
const demo = defineDemo(b, arena, {
    engine,
    state,
    keys,
    contentRoot: root,
    guides: () => b.add(guides, 1),
    loadLesson: () => b.set(lesson, 1)
});
b.read(operation);
b.read(root);
let arg = 0;
const argument = () => {
    const value = b.scalar('arg:' + arg++);
    b.read(value);
    return value;
};
const branch = (id, action) => {
    const match = b.scalar('match:' + id);
    b.eq(match, operation, id);
    b.if(match, action);
};
branch(0, () => {
    b.set(engine.running, 1);
    b.set(engine.complete, 0);
    b.set(engine.paused, 0);
    demo.initialize(argument(), argument(), argument());
});
branch(1, demo.show);
branch(2, () => demo.tick(argument()));
branch(3, demo.toggle);
branch(4, demo.next);
branch(5, () => demo.motionChanged(argument()));
branch(6, () => {
    b.copy(state.dialog, argument());
    demo.dialogChanged();
});
branch(7, () => demo.visibilityChanged(argument()));
branch(8, () => {
    b.copy(state.layout, argument());
    demo.layoutChanged();
});
branch(9, demo.practice);
branch(10, demo.exit);
branch(11, demo.resize);

const queue = [];
let packet = [];
let codec;
let coarse = true;
let reduced = false;
const html = new Map();
const texts = new Map();
const properties = new Map();
const classes = new Map();
const timers = new Map();
const schemas = {
    1: 'ss',
    3: 'ss',
    7: 's',
    16: 'sn',
    17: 'nnn',
    24: 'n',
    25: 'ssn',
    34: 'ssn',
    36: 'sn'
};
const operate = (opcode, args) => {
    const [a, c, d] = args;
    if (opcode === 1) html.set(a, c);
    else if (opcode === 3) texts.set(a, c);
    else if (opcode === 7) properties.set('focus', a);
    else if (opcode === 16) queue.push(Number(a === '(pointer: coarse)' ? coarse : reduced));
    else if (opcode === 17) timers.set(a, { duration: c, repeat: d });
    else if (opcode === 24) {
        const chars = Array.from(codec.strings[a], char => char.codePointAt(0));
        queue.push(chars.length, ...chars);
    } else if (opcode === 25) properties.set(a + '/' + c, codec.decode(d));
    else if (opcode === 34) classes.set(a + '/' + c, Boolean(d));
};
const write = value => {
    packet.push(value);
    const schema = schemas[packet[0]];
    assert.ok(schema, 'No storage or unsupported operations in demo: ' + packet[0]);
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
        read: () => {
            assert.ok(queue.length);
            return queue.shift();
        },
        write
    }
});
codec = new TokenCodec(instance.exports.memory, arena.layout, strings.slice(1));
const contentId = codec.encode(content);
const scalar = value => new Uint32Array(instance.exports.memory.buffer)[value.index];
const run = (id, ...args) => {
    queue.push(id, contentId, ...args);
    instance.exports.run();
    assert.equal(queue.length, 0);
    assert.equal(packet.length, 0);
};

run(0, 0, 0, 0);
assert.equal(scalar(demo.active), 1);
assert.equal(scalar(engine.paused), 1);
assert.equal(texts.get('#bf-demo-target'), 'f');
assert.equal(timers.get(2).duration, 1100);
assert.equal(html.get('#bf-hands'), '');
assert.equal(classes.get('#bf-hands/hands-container'), false);
run(2, 1);
assert.equal(texts.get('#bf-demo-target'), 'f');
run(2, 2);
assert.equal(texts.get('#bf-demo-target'), 'Space');
run(2, 2);
assert.equal(texts.get('#bf-demo-target'), 'r');
run(3);
assert.equal(timers.get(2).duration, 0);
run(2, 2);
assert.equal(texts.get('#bf-demo-target'), 'r');
run(4);
assert.equal(texts.get('#bf-demo-target'), 'Space');
assert.equal(texts.get('#bf-demo-toggle'), 'Play demo');
run(3);
run(2, 2);
assert.equal(texts.get('#bf-demo-target'), 'f');
run(6, 1);
assert.equal(timers.get(2).duration, 0);
run(2, 2);
assert.equal(texts.get('#bf-demo-target'), 'f');
run(6, 0);
assert.equal(timers.get(2).duration, 1100);
run(2, 2);
assert.equal(texts.get('#bf-demo-target'), 'Space');
run(7, 1);
assert.equal(timers.get(2).duration, 0);
run(2, 2);
assert.equal(texts.get('#bf-demo-target'), 'Space');
run(7, 0);
assert.equal(timers.get(2).duration, 1100);
run(2, 2);
assert.equal(texts.get('#bf-demo-target'), 'j');
run(5, 1);
assert.equal(properties.get('#bf-demo-toggle/hidden'), true);
assert.equal(timers.get(2).duration, 0);
run(2, 2);
assert.equal(texts.get('#bf-demo-target'), 'j');
run(5, 0);
assert.equal(properties.get('#bf-demo-toggle/hidden'), false);
assert.equal(texts.get('#bf-demo-toggle'), 'Play demo');
assert.equal(timers.get(2).duration, 0);
run(3);
assert.equal(timers.get(2).duration, 1100);
const oldIndex = scalar(demo.index);
run(8, 1);
assert.equal(scalar(demo.index), oldIndex);
assert.equal(texts.get('#bf-demo-target'), content.layouts[1].demoSteps[oldIndex]);
run(11);
assert.equal(scalar(demo.index), oldIndex);
run(9);
assert.equal(scalar(demo.active), 0);
assert.equal(scalar(lesson), 1);
assert.equal(timers.get(2).duration, 0);
assert.equal(properties.get('focus'), '#bf-input');
assert.equal(classes.get('#bf-hands/hands-container'), true);
run(0, 1, 0, 0);
assert.equal(scalar(demo.active), 0);
run(0, 0, 1, 0);
assert.equal(scalar(demo.active), 0);
coarse = false;
run(0, 0, 0, 0);
assert.equal(scalar(demo.active), 0);
coarse = true;
reduced = true;
run(0, 0, 0, 0);
assert.equal(scalar(demo.active), 1);
assert.equal(scalar(demo.playing), 0);
assert.equal(timers.get(2).duration, 0);
for (let index = 0; index < 16; index++) run(4);
assert.equal(scalar(demo.index), 0);
assert.ok(scalar(guides) > 20);
console.log('Brainfuck demo WASM controls passed: startup, timer/manual steps, ' +
    'pause/play, dialogs, visibility, reduced motion, layout/resize, unique guides, ' +
    'lesson handoff, and no storage operations.');
