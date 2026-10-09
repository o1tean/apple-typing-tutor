import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBrainfuckEngine } from '../js/brainfuck-engine.js';
import { TypingEngine } from '../js/engine.js';

const BrainfuckEngine = createBrainfuckEngine(TypingEngine);
const module = new WebAssembly.Module(await readFile(new URL(
    '../.local/typeflow-brainfuck.wasm', import.meta.url)));
const originalNow = performance.now;
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
let now = 0;
performance.now = () => now;
globalThis.setInterval = () => 1;
globalThis.clearInterval = () => {};

const stateFields = ['mode', 'lines', 'currentLineIndex', 'currentCharIndex', 'typedChars',
    'isRunning', 'isPaused', 'isComplete', 'startTime', 'endTime', 'pauseTime', 'timerId',
    'timedDuration', 'timeRemaining', 'totalKeystrokes', 'correctKeystrokes',
    'netCorrectChars', 'completedWordChars', 'correctNonSpaceChars', 'netTypedChars',
    'errorKeystrokes', 'skippedChars', 'errorsByChar', 'keystrokeIntervals',
    'lastKeystrokeTime', 'learning', 'learningPrevious', 'learningLinePrevious',
    'learningTimingBreak'
];

function snapshot(engine) {
    return structuredClone(Object.fromEntries(stateFields.map(name => [name, engine[name]])));
}

function compareSequence(label, mode, lines, duration, commands) {
    now = 0;
    const reference = new TypingEngine({ mode });
    const compiled = new BrainfuckEngine({ mode }, module);
    const events = [[], []];
    for (const [index, engine] of [reference, compiled].entries()) {
        for (const name of ['onCharTyped', 'onLineComplete', 'onComplete', 'onError',
                'onTick']) {
            engine[name] = (...args) => events[index].push(structuredClone({
                name,
                args,
                state: snapshot(engine)
            }));
        }
        engine.loadExercise(lines, duration);
    }

    function compare(step) {
        const context = `${label}, ${step}`;
        assert.deepEqual(compiled.getStats(), reference.getStats(), `${context}: statistics`);
        assert.deepEqual(snapshot(compiled), snapshot(reference), `${context}: state`);
        assert.deepEqual(events[1], events[0], `${context}: callback order and state`);
        assert.equal(compiled.getWordCredit(true), reference.getWordCredit(true),
            `${context}: virtual separator credit`);
        events[0].length = events[1].length = 0;
    }
    compare('loaded');
    for (const [index, command] of commands.entries()) {
        const event = typeof command === 'string' ? { key: command } : command;
        now += event.wait ?? 123;
        for (const engine of [reference, compiled]) {
            if (event.call) engine[event.call](...(event.args || []));
            else engine.handleKey(event);
        }
        compare(`input ${index + 1}: ${event.key || event.call}`);
    }
    reference.reset();
    compiled.reset();
    compare('reset');
}

try {
    compareSequence('strict retries and Unicode', 'strict', ['a😀b', ' £¬'], 0,
        ['x', 'a', '市', '😀', 'b', ' ', 'x', '£', '¬', 'Backspace', 'q']);
    compareSequence('strict NUL retries', 'strict', 'a', 0, ['\0', '\0', 'a']);
    compareSequence('flow NUL deletion', 'flow', '\0a', 0,
        ['\0', 'Backspace', '\0', 'a']);
    compareSequence('input boundaries', 'strict', 'a市', 0, [
        { key: 'ArrowLeft' }, { key: 'a', metaKey: true }, { key: 'a', ctrlKey: true },
        { key: 'a', altKey: true }, { key: 'a', isComposing: true },
        { key: 'a', keyCode: 229 },
        {
            key: 'a',
            ctrlKey: true,
            altKey: true,
            getModifierState: key => key ===
                'AltGraph'
        },
        { key: '市', isComposing: true }, { key: '市' }
    ]);
    compareSequence('flow skipped words and deletion', 'flow', 'cat dog fox', 0,
        ['c', ' ', 'Backspace', 'a', 't', ' ', 'Backspace', 'd', 'x', ' ',
            'Backspace', 'Backspace', 'o', 'g', ' ', 'f', 'o', 'x'
        ]);
    compareSequence('flow overflow and final correction', 'flow', 'cat dog', 0,
        ['c', 'a', 't', 's', ' ', 'Backspace', 'Backspace', ' ', 'd', 'o', 'x',
            's', 'Backspace', 'Backspace', 'g', 'Backspace'
        ]);
    compareSequence('flow explicit final submission', 'flow', 'cat', 0, ['c', ' ']);
    compareSequence('flow empty submitted words', 'flow', 'one two three', 0,
        [' ', ' ', ' ', 'x']);
    compareSequence('flow word backspace', 'flow', 'cat dog fox', 0,
        ['c', 'x', 't', ' ', { key: 'Backspace', ctrlKey: true }, 'c', 'a', 't', ' ',
            'd', 'o', { key: 'Backspace', altKey: true }, 'd', 'o', 'g', ' ',
            { key: 'Backspace', ctrlKey: true }, 'f', 'o', 'x'
        ]);
    compareSequence('flow long-word backspace', 'flow', 'a'.repeat(64) + ' b', 0,
        [...'a'.repeat(64), { key: 'Backspace', ctrlKey: true }, ...'a'.repeat(64),
            ' ', 'Backspace', 'b'
        ]);
    compareSequence('flow Unicode and line boundary', 'flow', ['a😀', '市£'], 0,
        ['a', '😀', ' ', '市', '¬', 'Backspace', '£']);
    compareSequence('strict timed loop and deadline', 'strict', ['ab', 'cd'], 2,
        ['a', 'b', 'c', 'd', 'a', { key: 'b', wait: 1800 }, 'c']);
    compareSequence('flow timed loop and deadline', 'flow', ['hi', 'no'], 2,
        ['h', 'i', ' ', 'n', 'o', ' ', 'x', { key: 'h', wait: 1800 }, 'i']);
    compareSequence('pause and reach timing', 'strict', 'abcdefgh', 10,
        ['a', 'b', { call: 'pause' }, { key: 'x', wait: 5000 }, { call: 'updateTick' },
            { call: 'resume' }, 'c', 'd', 'e', 'f', 'g', 'h', { call: 'updateTick' }
        ]);
    compareSequence('pause before start and reset/reload', 'flow', ['ab', 'cd'], 0,
        [{ call: 'pause' }, 'a', { call: 'pause' }, { call: 'reset' },
            { call: 'loadExercise', args: [[' £😀', 'z'], 0] }, ' ', '£', '😀', ' ', 'z'
        ]);
    compareSequence('empty and filtered exercises', 'strict', ['', 3, ''], -1,
        ['a', { call: 'loadExercise', args: [['', 'x', null], NaN] }, 'x']);

    let seed = 20261009;
    const random = size => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed % size;
    };
    for (let sequence = 0; sequence < 24; sequence++) {
        const mode = sequence % 2 ? 'flow' : 'strict';
        const commands = [];
        for (let index = 0; index < 60; index++) {
            const choice = random(12);
            commands.push(choice < 9 ? {
                key: ['a', 'b', 'c', ' ', '😀', '£', 'Backspace', 'Backspace', 'x'][choice],
                wait: random(200) + 1,
                ...(choice === 7 ? { ctrlKey: true } : {})
            } : { call: ['pause', 'resume', 'updateTick'][choice - 9] });
        }
        compareSequence(`deterministic mixed sequence ${sequence + 1}`, mode,
            ['ab c😀', '£ ba'], sequence % 3 ? 0 : 3, commands);
    }
    console.log('Brainfuck/Wasm engine parity: 40 deterministic scenarios passed.');
} finally {
    performance.now = originalNow;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
}
