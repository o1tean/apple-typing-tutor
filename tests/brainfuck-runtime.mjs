import assert from 'node:assert/strict';
import { BrainfuckProgram } from '../brainfuck/compiler.mjs';
import {
    createTokenArena,
    TYPE,
    uint64,
    fromPair64,
    toPair64,
    add64,
    sub64,
    mul64,
    div64,
    compare64
} from '../brainfuck/runtime.mjs';

function instance(program, optimizeLibrary = true) {
    let input = [];
    let offset = 0;
    const output = [];
    const module = new WebAssembly.Module(program.compile({ optimizeLibrary }));
    const wasm = new WebAssembly.Instance(module, {
        env: {
            read: () => input[offset++] ?? 0,
            write: value => output.push(value >>> 0)
        }
    });
    return {
        tape: new Uint32Array(wasm.exports.memory.buffer),
        run(values = []) {
            input = values;
            offset = 0;
            output.length = 0;
            wasm.exports.run();
            return [...output];
        }
    };
}

const basic = new BrainfuckProgram({ scalarCapacity: 512, memoryPages: 2 });
const a = basic.scalar('a');
const c = basic.scalar('c');
const q = basic.scalar('q');
const r = basic.scalar('r');
const array = basic.array('array', 4, [10, 20, 30, 40]);
basic.read(a);
basic.read(c);
basic.lt(q, a, c);
basic.write(q);
basic.divmod(q, r, a, c);
basic.write(q);
basic.write(r);
basic.set(a, 2);
basic.arrayGet(array, a, q);
basic.write(q);
basic.arraySet(array, a, c);
basic.arrayGet(array, a, q);
basic.write(q);
basic.writeString('a😀£');
const fast = instance(basic);
const literal = instance(basic, false);
for (const values of [[100, 7], [0, 3], [17, 1], [5, 19], [255, 16]]) {
    assert.deepEqual(fast.run(values), literal.run(values));
    assert.deepEqual(fast.tape, literal.tape, 'optimized library preserves the complete BF tape');
}
assert.throws(() => fast.run([1, 0]), WebAssembly.RuntimeError);
assert.throws(() => literal.run([1, 0]), WebAssembly.RuntimeError);
assert.match(basic.source(), /^[<>+\-.,[\]]*$/,
    'expanded source contains only Brainfuck operators');

const bounded = new BrainfuckProgram({ scalarCapacity: 512, memoryPages: 1 });
const text = bounded.string('text', '', 8);
const counter = bounded.scalar('counter', 5);
bounded.readString(text);
bounded.writeString(text);
bounded.add(counter, 1);
bounded.write(counter);
const textFast = instance(bounded);
const textLiteral = instance(bounded, false);
for (const values of [[3, 97, 0x1f600, 163], [0], [2, 0, 300]]) {
    assert.deepEqual(textFast.run(values), textLiteral.run(values));
    assert.deepEqual(textFast.tape, textLiteral.tape);
}
assert.equal(textFast.tape[counter.index], 8, 'initializers run once and state persists');
assert.throws(() => textFast.run([9]), WebAssembly.RuntimeError);
assert.throws(() => textLiteral.run([9]), WebAssembly.RuntimeError);

const jsonProgram = new BrainfuckProgram({ scalarCapacity: 512, memoryPages: 4 });
const json = createTokenArena(jsonProgram, 32);
const count = jsonProgram.scalar('inputCount');
const root = jsonProgram.scalar('root');
const found = jsonProgram.scalar('found');
const value = jsonProgram.scalar('value');
const clone = jsonProgram.scalar('clone');
jsonProgram.read(count);
json.load(count);
jsonProgram.set(root, 1);
json.field(found, root, 777);
json.get(value, 'raw', found);
jsonProgram.write(value);
json.clone(clone, root);
json.remove(clone, 777);
json.field(found, root, 777);
jsonProgram.write(found);
json.field(found, clone, 777);
jsonProgram.write(found);
const jsonFast = instance(jsonProgram);
const jsonLiteral = instance(jsonProgram, false);
const nodes = [
    [TYPE.OBJECT, 2, 0, 0, 0, 0, 0, 0, 0, 100],
    [TYPE.NUMBER, 0, 3, 777, 0, 5, 42, 0, 0, 101],
    [TYPE.OBJECT, 4, 0, 888, 0, 0, 0, 0, 0, 102],
    [TYPE.STRING, 0, 0, 999, 103, 0, 0, 0, 0, 104]
];
assert.deepEqual(jsonFast.run([nodes.length, ...nodes.flatMap(node => [...node, 0])]), [101, 2, 0]);
assert.deepEqual(jsonLiteral.run([nodes.length, ...nodes.flatMap(node => [...node, 0])]), [101, 2,
    0]);
assert.deepEqual(jsonFast.tape, jsonLiteral.tape,
    'deep clone preserves unknown fields and leaves the source tree independent');

const reusedProgram = new BrainfuckProgram({ scalarCapacity: 512, memoryPages: 1 });
const reused = createTokenArena(reusedProgram, 2);
const reusedNode = reusedProgram.scalar('reusedNode');
reused.number(reusedNode, 123);
reusedProgram.write(reusedNode);
const reuseFast = instance(reusedProgram);
const reuseLiteral = instance(reusedProgram, false);
for (const module of [reuseFast, reuseLiteral]) {
    module.tape[reused.count.index] = 2;
    module.tape[reused.freeHead.index] = 1;
    module.tape[reused.layout.base + reused.layout.stride + 4] = 2;
    assert.deepEqual(module.run(), [1]);
    assert.equal(module.tape[reused.count.index], 2);
    assert.deepEqual(module.run(), [2]);
    assert.equal(module.tape[reused.freeHead.index], 0);
    assert.throws(() => module.run(), WebAssembly.RuntimeError);
}
assert.deepEqual(reuseFast.tape, reuseLiteral.tape,
    'free nodes retain stable IDs and clear previous fields');

const procedureProgram = new BrainfuckProgram({ scalarCapacity: 2048, memoryPages: 1 });
const procedureCounter = procedureProgram.scalar('procedureCounter');
let generations = 0;
const bump = procedureProgram.reusable('bump', () => {
    generations++;
    procedureProgram._temps(1, value => {
        procedureProgram.copy(value, procedureCounter);
        procedureProgram.add(procedureCounter, 1);
        procedureProgram.write(value);
    });
});
const outer = procedureProgram.reusable('outer', () => procedureProgram._temps(1, held => {
    procedureProgram.set(held, 123);
    bump();
    procedureProgram.write(held);
}));
procedureProgram.read(procedureCounter);
procedureProgram.repeat(3, outer);
procedureProgram.write(procedureCounter);
assert.equal(generations, 1, 'reusable BF procedures generate their source once');
const proceduresFast = instance(procedureProgram);
const proceduresLiteral = instance(procedureProgram, false);
for (const initial of [0, 100, 255]) {
    const expected = [initial, 123, initial + 1, 123, initial + 2, 123, initial + 3];
    assert.deepEqual(proceduresFast.run([initial]), expected);
    assert.deepEqual(proceduresLiteral.run([initial]), expected);
    assert.deepEqual(proceduresFast.tape, proceduresLiteral.tape,
        'nested reusable procedures protect the caller scratch frame');
}

const wideProgram = new BrainfuckProgram({ scalarCapacity: 512, memoryPages: 1 });
const left = uint64(wideProgram, 'left');
const right = uint64(wideProgram, 'right');
const sum = uint64(wideProgram, 'sum');
const quotient = uint64(wideProgram, 'quotient');
const remainder = uint64(wideProgram, 'remainder');
const low = wideProgram.scalar('low');
const high = wideProgram.scalar('high');
const comparison = wideProgram.scalar('comparison');
for (const operand of [left, right]) {
    for (const digit of operand.digits) wideProgram.read(digit);
}
for (const operation of [add64, sub64, mul64]) {
    operation(wideProgram, sum, left, right);
    toPair64(wideProgram, low, high, sum);
    wideProgram.write(low);
    wideProgram.write(high);
}
compare64(wideProgram, comparison, left, right);
wideProgram.write(comparison);
div64(wideProgram, quotient, remainder, left, right);
for (const result of [quotient, remainder]) {
    toPair64(wideProgram, low, high, result);
    wideProgram.write(low);
    wideProgram.write(high);
}
const wideFast = instance(wideProgram);
const wideLiteral = instance(wideProgram, false);
const pair = value => [Number(value & 0xffffffffn), Number((value >> 32n) & 0xffffffffn)];
const bytes = value => Array.from({ length: 8 }, (_, index) =>
    Number((value >> BigInt(index * 8)) & 255n));
for (const [x, y] of [[0n, 1n], [123456789n, 7n], [0xffffffffffffffffn, 1n],
    [0xffffffffffffffffn, 0x8000000000000001n], [0x8000000000000000n, 0xffffffffffffffffn],
    [1800000000000n, 12000000n]]) {
    const expected = [...pair(x + y), ...pair(x - y), ...pair(x * y),
        x < y ? 0xffffffff : Number(x > y), ...pair(x / y), ...pair(x % y)];
    assert.deepEqual(wideFast.run([...bytes(x), ...bytes(y)]), expected);
    assert.deepEqual(wideLiteral.run([...bytes(x), ...bytes(y)]), expected);
    assert.deepEqual(wideFast.tape, wideLiteral.tape, 'wide intrinsics preserve BF semantics');
}
console.log(
    'Brainfuck runtime checks passed: genuine source, library equivalence, persistent state, bounded strings, token cloning and uint64 arithmetic.'
);
