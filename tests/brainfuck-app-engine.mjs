import assert from 'node:assert/strict';
import { BrainfuckProgram } from '../brainfuck/compiler.mjs';
import { defineEngine } from '../brainfuck/engine.mjs';
import { TypingEngine } from '../js/engine.js';

const b = new BrainfuckProgram({ scalarCapacity: 4096, memoryPages: 128 });
const e = defineEngine(b);
const command = b.scalar('command');
const inputChar = b.scalar('inputChar');
const match = b.scalar('match');
const removed = b.scalar('removed');
b.read(command);
b.eq(match, command, 0);
b.if(match, () => {
    b.read(e.mode);
    b.read(e.lineCount);
    b.read(e.duration);
    e.reset();
    b._temps(3, (length, offset, char) => {
        b.set(offset, 0);
        b.repeat(e.lineCount, line => {
            b.read(length);
            b.arraySet(e.lines, line, offset, 0);
            b.arraySet(e.lines, line, length, 1);
            b.repeat(length, () => {
                b.read(char);
                b.arraySet(e.points, offset, char);
                b.add(offset, 1);
            });
        });
    });
    e.setup();
});
b.eq(match, command, 1);
b.if(match, () => {
    b.read(inputChar);
    b.read(e.now);
    b.read(e.nowHi);
    e.key(inputChar, e.now);
});
b.eq(match, command, 2);
b.if(match, () => e.deleteBackward(removed));
let input = [];
let cursor = 0;
const instance = new WebAssembly.Instance(new WebAssembly.Module(b.compile()), {
    env: { read: () => input[cursor++], write: () => {} }
});
const tape = new Uint32Array(instance.exports.memory.buffer);
const run = values => {
    input = values;
    cursor = 0;
    instance.exports.run();
    assert.equal(cursor, input.length);
};
const scalar = value => tape[value.index];
const row = (array, index, field) => tape[array.base + index * array.stride + 2 + field];
const snapshot = () => ({
    currentLineIndex: scalar(e.line),
    currentCharIndex: scalar(e.index),
    isComplete: Boolean(scalar(e.complete)),
    totalKeystrokes: scalar(e.total),
    correctKeystrokes: scalar(e.correct),
    netCorrectChars: scalar(e.netCorrect),
    completedWordChars: scalar(e.wordCredit),
    correctNonSpaceChars: scalar(e.nonSpace),
    netTypedChars: scalar(e.netTyped),
    errorKeystrokes: scalar(e.errors),
    skippedChars: scalar(e.skipped),
    typedChars: Array.from({ length: scalar(e.length) }, (_, index) => ({
        char: String.fromCodePoint(row(e.chars, index, 0)),
        status: ['pending', 'correct', 'incorrect'][row(e.chars, index, 1)],
        typed: row(e.chars, index, 2) ? String.fromCodePoint(row(e.chars, index,
            2)) : '',
        ...(row(e.chars, index, 3) ? { extra: true } : {}),
        ...(row(e.chars, index, 4) ? { skipped: true } : {})
    }))
});
const compare = original => {
    for (const [key, value] of Object.entries(snapshot()))
        assert.deepEqual(value, original[key], key);
};
let scenarios = 0;
for (const [mode, lines, keys] of [
    ['strict', ['ab ba', 'café'], ['x', 'a', 'b', ' ', 'b', 'a', 'c', 'a', 'f', 'é']],
    ['strict', ['😀 a'], ['x', '😀', ' ', 'a']],
    ['flow', ['cat dog'], ['c', ' ', 'Backspace', 'a', 't', ' ', 'Backspace', 'd',
        'o', 'x', 'y', 'Backspace', 'Backspace', 'g']],
    ['flow', ['one two', 'three'], ['o', 'x', ' ', 't', 'w', 'o', ' ', 't', 'h', 'r', 'e', 'e']],
    ['flow', ['ab cd'], [' ', 'Backspace', 'a', 'b', ' ', 'c', 'd']],
    ['flow', ['abc'], ['x', 'y', 'z', ' ']]
]) {
    const original = new TypingEngine({ mode });
    original.loadExercise(lines);
    run([0, Number(mode === 'strict'), lines.length, 0,
        ...lines.flatMap(line => [Array.from(line).length,
            ...Array.from(line, char => char.codePointAt(0))])]);
    compare(original);
    let now = 1000;
    for (const key of keys) {
        if (key === 'Backspace') {
            original.deleteBackward();
            run([2]);
        } else {
            original.typeCharacter(key, now / 1000);
            run([1, key.codePointAt(0), now, 0]);
            now += 110000;
        }
        compare(original);
        scenarios++;
    }
    original.reset();
}
console.log(`Full Brainfuck engine: ${scenarios} actual-Wasm state transitions match Typeflow`);
