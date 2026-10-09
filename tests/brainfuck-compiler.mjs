import assert from 'node:assert/strict';
import { compileBrainfuck } from '../scripts/compile-brainfuck.mjs';

function program(source, input = []) {
    const output = [];
    let index = 0;
    const bytes = compileBrainfuck(source);
    assert.ok(WebAssembly.validate(bytes), 'the compiler emits a valid WebAssembly module');
    const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
        env: {
            read: () => input[index++] ?? 0,
            write: value => output.push(value)
        }
    });
    return { ...instance.exports, output, tape: new Uint32Array(instance.exports.memory.buffer) };
}

assert.throws(() => compileBrainfuck('['), SyntaxError);
assert.throws(() => compileBrainfuck(']'), SyntaxError);
assert.throws(() => compileBrainfuck('[][[]'), SyntaxError);
assert.throws(() => compileBrainfuck(null), TypeError);

const empty = program('ignored letters');
empty.run();
assert.equal(empty.memory.buffer.byteLength, 65536);
assert.throws(() => empty.memory.grow(1), RangeError, 'the tape cannot silently expand');

const echo = program(',.,.,.', [0x1f600, 300, 0]);
echo.run();
assert.deepEqual(echo.output, [0x1f600, 300, 0],
    'input and output preserve Unicode and wide values');

const wrapping = program('-.' + '+'.repeat(65) + '.');
wrapping.run();
assert.deepEqual(wrapping.output, [-1, 64],
    'cells wrap at 32 bits and constants use signed LEB128');

const clear = program(',[-].', [-1]);
clear.run();
assert.deepEqual(clear.output, [0], 'clear loops handle a full-width wrapping cell');

const nested = program('++[>+++[>+<-]<-]>>.');
nested.run();
assert.deepEqual(nested.output, [6], 'nested loops compile with correct branch depths');
const nestedOutput = program('++[>++[.-]<-]');
nestedOutput.run();
assert.deepEqual(nestedOutput.output, [2, 1, 2, 1], 'nested general loops preserve output order');

const skip = program('[>+>+<<-]>.');
skip.run();
assert.deepEqual(skip.output, [0], 'a zero source skips transfer loops');

const transfer = program(',[->++>---<<]>.>.', [0x1f600]);
transfer.run();
assert.deepEqual(transfer.output, [0x1f600 * 2, -0x1f600 * 3]);
assert.equal(transfer.tape[0], 0, 'affine transfer clears its source');

const fullTransfer = program(',[->+<]>.', [-1]);
fullTransfer.run();
assert.deepEqual(fullTransfer.output, [-1],
    'affine transfers avoid billions of wrapping iterations');

const repeated = program('+>++.');
repeated.run();
repeated.run();
assert.deepEqual(repeated.output, [2, 4]);
assert.deepEqual([...repeated.tape.slice(0, 3)], [2, 4, 0],
    'each call starts at cell zero while preserving the instance tape');
const independent = program('+>++.');
independent.run();
assert.deepEqual(independent.output, [2], 'instances have independent state');

for (const source of ['<+', '<+-', '>'.repeat(16384) + '.', '+[->+<]' +
    '>'.repeat(16383) + '+[->+<]', '+[-<+>]', '+[-<+->]']) {
    assert.throws(() => program(source).run(), WebAssembly.RuntimeError,
        'invalid tape access traps, including optimized or net-zero changes');
}
const skipOutside = program('[-<+>]');
skipOutside.run();
assert.equal(skipOutside.tape[0], 0, 'a skipped transfer does not touch an invalid destination');

console.log(
    'Brainfuck compiler checks passed: valid WebAssembly, loops, Unicode, wrapping, optimized transfers and tape bounds.'
);
