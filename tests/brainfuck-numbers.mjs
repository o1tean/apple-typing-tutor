import assert from 'node:assert/strict';
import { BrainfuckProgram } from '../brainfuck/compiler.mjs';
import { createTokenArena, TYPE, NUMBER } from '../brainfuck/runtime.mjs';
import { createNumbers } from '../brainfuck/numbers.mjs';

const b = new BrainfuckProgram({ scalarCapacity: 2048, memoryPages: 4 });
const arena = createTokenArena(b, 32);
const numbers = createNumbers(b, arena);
const op = b.scalar('op');
const a = b.scalar('a');
const c = b.scalar('c');
const result = b.scalar('result');
b.read(op);
b.read(a);
b.read(c);
for (const [id, method] of ['addNumbers', 'subtractNumbers', 'multiplyNumbers', 'divideNumber',
        'compareNumbers', 'sqrtNumber'].entries()) {
    b._temps(1, matched => {
        b.eq(matched, op, id);
        b.if(matched, () => numbers[method](result, a, c));
    });
}
b.write(result);

const fields = Object.fromEntries(arena.layout.fields.map((field, index) => [field, index]));
const bits = value => {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value, true);
    return [view.getUint32(0, true), view.getUint32(4, true)];
};
const instances = [];
for (const fallback of [false, true]) {
    const output = [];
    let input = [];
    const bytes = b.compile({
        disabledKinds: fallback ? ['floatAdd', 'floatSub', 'floatMul',
            'floatDiv', 'floatCompare', 'floatFromUnsigned', 'floatToUnsigned',
            'floatSqrt'] : []
    });
    const { instance } = await WebAssembly.instantiate(bytes, {
        env: {
            read: () => input.shift() ??
                0,
            write: value => output.push(value >>> 0)
        }
    });
    const tape = new Uint32Array(instance.exports.memory.buffer);
    const index = (node, field) => arena.layout.base + node * arena.layout.stride + arena.layout
        .dataOffset + fields[field];
    const seed = (node, value) => {
        const [low, high] = bits(value);
        tape[index(node, 'type')] = TYPE.NUMBER;
        tape[index(node, 'value')] = low;
        tape[index(node, 'floatHi')] = high;
        tape[index(node, 'numberFlags')] = NUMBER.FINITE | NUMBER.BITS;
    };
    const run = (operation, left, right) => {
        tape[arena.count.index] = 2;
        tape[arena.freeHead.index] = 0;
        seed(1, left);
        seed(2, right);
        input = [operation, 1, 2];
        output.length = 0;
        instance.exports.run();
        if (operation === 4) return output[0] | 0;
        const node = output[0];
        return [tape[index(node, 'value')], tape[index(node, 'floatHi')]];
    };
    instances.push({
        run,
        metadata: () => ({
            flags: tape[index(output[0], 'numberFlags')],
            fraction: tape[index(output[0], 'fraction')]
        }),
        label: fallback ? 'Brainfuck IEEE fallback' : 'native equivalent'
    });
    console.log(`${fallback ? 'Fallback' : 'Native'} numeric module: ${bytes.length} bytes.`);
}
const cases = [[0, 0], [1, 1], [1, 3], [0.1, 0.2], [1e-200, 1e-210], [1e200, 1e100], [Number
    .MAX_SAFE_INTEGER, 20], [Number.MIN_VALUE, 2], [2 ** -1022, 3], [-2.5, 1.25], [1, -1], [
    -0, 0], [1e-20, 1], [1.23456789012345, 3.987654321098765], [Infinity, 2], [-Infinity,
    Infinity], [NaN, 1], [Number.MAX_VALUE, Number.MAX_VALUE]];
let seed = 7231;
for (let index = 0; index < 256; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = (seed / 2 ** 32) * 10 ** ((seed % 400) - 200);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const y = (seed / 2 ** 32) * 10 ** ((seed % 400) - 200);
    cases.push([index & 1 ? -x : x, index & 2 ? -y : y]);
}
for (const instance of instances) {
    for (const [left, right] of cases) {
        const results = [left + right, left - right, left * right, left / right, (left > right) - (
            left < right), Math.sqrt(left)];
        for (let op = 0; op < 6; op++) {
            const actual = instance.run(op, left, right);
            if (Number.isNaN(results[op])) {
                assert.equal((actual[1] >>> 20) & 2047, 2047);
                assert.ok(actual[0] || (actual[1] & 1048575));
                continue;
            }
            assert.deepEqual(actual, op === 4 ? results[op] : bits(results[op]),
                `${instance.label}: op ${op}, ${left}, ${right}`);
            if (op !== 4) {
                const finite = Number.isFinite(results[op]);
                const integer = finite && Number.isInteger(results[op]);
                assert.deepEqual(instance.metadata(), {
                    flags: NUMBER.BITS | (finite ? NUMBER.FINITE : 0) |
                        (integer ? NUMBER.INTEGER : 0) | (results[op] < 0 ? NUMBER.NEGATIVE
                            : 0),
                    fraction: Number(finite && !integer)
                });
            }
        }
    }
}
console.log(
    'Numeric checks passed: IEEE-754 binary64 arithmetic, square roots, subnormals, nonfinite values and signed comparisons.'
);
