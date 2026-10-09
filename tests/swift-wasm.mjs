import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { TypingEngine } from '../js/engine.js';

let wasm;
const module = new WebAssembly.Module(await readFile(new URL('../swift/typeflow.wasm', import.meta
    .url)));
({ exports: wasm } = new WebAssembly.Instance(module, {
    wasi_snapshot_preview1: {
        random_get(pointer, length) {
            const bytes = new Uint8Array(wasm.memory.buffer, pointer >>> 0, length >>> 0);
            for (let offset = 0; offset < bytes.length; offset += 65536)
                webcrypto.getRandomValues(bytes.subarray(offset, offset + 65536));
            return 0;
        }
    }
}));
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const read = () => decoder.decode(new Uint8Array(wasm.memory.buffer,
    wasm.typeflow_output(), wasm.typeflow_length()));
const native = () => { wasm.typeflow_snapshot(now); return JSON.parse(read()); };
let now = 1000;
const originalNow = performance.now;
performance.now = () => now;
const engine = new TypingEngine();
let checks = 0;

function compare(label) {
    const actual = native();
    for (const [key, expected] of Object.entries(engine.getStats())) {
        if (typeof expected === 'number') assert.ok(Math.abs(actual[key] - expected) < 0.00001,
            label + ': ' + key + ' Swift=' + actual[key] + ' JS=' + expected);
        else assert.deepEqual(actual[key], JSON.parse(JSON.stringify(expected)), label + ': ' +
            key);
    }
    assert.equal(actual.currentChar, engine.getCurrentChar(), label + ': current character');
    assert.equal(actual.currentIndex, engine.currentCharIndex, label + ': cursor');
    assert.equal(actual.status, engine.isComplete ? 'complete' : engine.isPaused ? 'paused'
        : engine.isRunning ? 'running' : 'idle', label + ': state');
    checks++;
}

function load(lines, mode = 'flow', duration = 0) {
    lines = Array.isArray(lines) ? lines : [lines];
    engine.mode = mode;
    engine.loadExercise(lines, duration);
    const bytes = encoder.encode(lines.join('\n'));
    const pointer = wasm.typeflow_input();
    new Uint8Array(wasm.memory.buffer, pointer, bytes.length).set(bytes);
    wasm.typeflow_load(bytes.length, mode === 'strict' ? 1 : 0, duration);
    compare('load');
}

function type(text) {
    for (const key of text) {
        now += 123;
        engine.handleKey({ key });
        wasm.typeflow_key(key.codePointAt(0), now);
        compare('type ' + key);
    }
}

function remove(word = false) {
    now += 49;
    engine.handleKey({ key: 'Backspace', ctrlKey: word });
    wasm.typeflow_delete(word ? 1 : 0, now);
    compare(word ? 'delete word' : 'delete character');
}
try {
    for (const [target, entered] of [
        ['cat dog', 'cat dog'], ['cat dog', 'cat dox '], ['cat dog', 'cxt dog'],
        ['cat dog', 'cats dog'], ['cat dog', 'c dog'], ['cat dog', 'xxx xxx '],
        ['cat dog', '  '], ['cat dog', 'cat d'], ['cat dog', 'cat x'],
        ['cat  dog', 'cat  dog'], ['  cat dog ', '  cat dog '],
        ['😀a b', '😀a b'], [['cat', 'dog'], 'cat dog'],
        [['cat', 'dog'], 'cxt dog'], [['cat', 'dog'], ' dog'],
        [['cat ', 'dog'], 'cat dog'], ['a\u0301 b', 'a\u0301 b']
    ]) {
        load(target);
        type(entered);
    }
    load('cat dog fox');
    type('c ');
    remove();
    type('at doxs');
    remove(true);
    type('dog fox');
    load('abc');
    type('a');
    remove();
    type('ax');
    remove();
    type('bc');
    load(['', 'a😀b', ''], 'strict');
    type('xa市😀zb');
    load('ab ab ab ab', 'strict');
    type('ab ab ');
    engine.pause();
    wasm.typeflow_pause(now);
    compare('pause');
    now += 60000;
    compare('pause excludes inactive time');
    type('a');
    engine.resume();
    wasm.typeflow_resume(now);
    compare('resume');
    type('ab ab');
    load('abc', 'strict', 1);
    type('a');
    now += 1000;
    engine.updateTick();
    wasm.typeflow_tick(now);
    compare('deadline');
    type('b');
    load(['ab'], 'strict', 2);
    type('abab');
    now += 2000;
    engine.updateTick();
    wasm.typeflow_tick(now);
    compare('repeating timed lesson');
    // Swift escapes user text and JSON strings before they reach the browser.
    load('<>&"\\😀', 'strict');
    type('x');
    assert.deepEqual(native().missedWords, ['<>&"\\😀']);
    wasm.typeflow_render(1, now);
    assert.ok(read().includes('&lt;') && read().includes('&amp;') && read().includes('&quot;'));
    assert.ok(!read().includes('<>&'));
    wasm.typeflow_render(0, now);
    assert.ok(read().includes('aria-label="Typing input"'));
    wasm.typeflow_render(2, now);
    assert.ok(read().includes('Download result card'));
    load('<'.repeat(12000));
    for (let index = 0; index < 20000; index++) wasm.typeflow_key(120, now + index);
    wasm.typeflow_render(1, now + 20000);
    assert.ok(wasm.typeflow_length() > 1048576, 'long input grows the output buffer');
    assert.equal((read().match(/ extra/g) || []).length, 8000);
    console.log('Swift WebAssembly matches the original engine (' + checks +
        ' state comparisons).');
} finally {
    engine.reset();
    performance.now = originalNow;
}
