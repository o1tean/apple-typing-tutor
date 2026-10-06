import assert from 'node:assert/strict';
import { TypingEngine } from '../js/engine.js';

let now = 0;
const originalNow = performance.now;
performance.now = () => now;
const engine = new TypingEngine({ mode: 'strict' });

try {
    engine.loadExercise('ab c');
    now = 100;
    engine.handleKey({ key: 'a' });
    now = 220;
    engine.handleKey({ key: 'x' });
    now = 300;
    engine.handleKey({ key: 'b' });
    now = 340;
    engine.handleKey({ key: ' ' });
    now = 400;
    engine.pause();
    now = 10000;
    engine.handleKey({ key: 'c' });
    engine.resume();
    now = 10040;
    engine.handleKey({ key: 'c' });
    assert.equal(engine.isComplete, true);
    const learning = engine.getStats().learning;
    assert.deepEqual(learning.keys.a, {
        attempts: 1,
        errors: 0,
        latencySamples: 0,
        latencyTotalMs: 0
    }, 'the first target has no invented reach interval');
    assert.deepEqual(learning.keys.b, {
        attempts: 2,
        errors: 1,
        latencySamples: 2,
        latencyTotalMs: 200
    }, 'a wrong key and guided retry belong to the target, with real stroke intervals');
    assert.equal(Object.hasOwn(learning.keys, 'x'), false,
        'the mistaken physical key does not replace the expected weak key');
    assert.deepEqual(learning.bigrams.ab, learning.keys.b,
        'guided retries remain on the same intended pair');
    assert.deepEqual(learning.keys[' '], {
        attempts: 1,
        errors: 0,
        latencySamples: 1,
        latencyTotalMs: 40
    });
    assert.deepEqual(learning.keys.c, {
        attempts: 1,
        errors: 0,
        latencySamples: 0,
        latencyTotalMs: 0
    }, 'paused input is ignored and the resumed reach excludes the pause');
    assert.deepEqual(learning.bigrams[' c'], learning.keys.c);
    now += 60000;
    assert.deepEqual(engine.getStats().learning, learning,
        'finished learning observations stay frozen');

    engine.mode = 'flow';
    engine.loadExercise('ab');
    now = 20000;
    engine.handleKey({ key: 'a' });
    now = 20100;
    engine.handleKey({ key: 'x' });
    now = 21000;
    engine.handleKey({ key: 'Backspace' });
    now = 21200;
    engine.handleKey({ key: 'b' });
    const corrected = engine.getStats().learning;
    assert.deepEqual(corrected.keys.b, {
        attempts: 2,
        errors: 1,
        latencySamples: 1,
        latencyTotalMs: 100
    }, 'deletion retains the original mistake without counting its correction gap as reach');
    assert.deepEqual(corrected.bigrams.ab, corrected.keys.b,
        'a corrected flow target restores its original pair rather than inventing bb');
    assert.equal(Object.hasOwn(corrected.keys, 'Backspace'), false);

    engine.loadExercise('abc def');
    now = 22000;
    engine.handleKey({ key: 'a' });
    now = 22150;
    engine.handleKey({ key: ' ' });
    now = 22250;
    engine.handleKey({ key: 'd' });
    const skipped = engine.getStats().learning;
    assert.deepEqual(skipped.keys.b, {
        attempts: 1,
        errors: 1,
        latencySamples: 1,
        latencyTotalMs: 150
    }, 'early Space measures the first missed target using its real stroke interval');
    assert.deepEqual(skipped.keys.c, {
        attempts: 1,
        errors: 1,
        latencySamples: 0,
        latencyTotalMs: 0
    }, 'later missed targets have errors without fabricated strokes or timing');
    assert.deepEqual(skipped.keys[' '], {
        attempts: 1,
        errors: 0,
        latencySamples: 0,
        latencyTotalMs: 0
    }, 'the actual separator does not reuse latency already assigned to a missed target');
    assert.deepEqual(skipped.bigrams.ab, skipped.keys.b);
    assert.deepEqual(skipped.bigrams.bc, skipped.keys.c);
    assert.equal(skipped.bigrams[' d'].latencyTotalMs, 100,
        'the following word begins from the actual separator');

    engine.loadExercise(['ab', 'cd']);
    for (const [index, key] of Array.from('ab cd').entries()) {
        now = 23000 + index * 100;
        engine.handleKey({ key });
    }
    assert.equal(engine.isComplete, true);
    const multiline = engine.getStats().learning;
    assert.deepEqual(multiline.keys[' '], {
        attempts: 1,
        errors: 0,
        latencySamples: 1,
        latencyTotalMs: 100
    }, 'the physical Space between lesson lines is a measured target');
    assert.equal(multiline.bigrams['b '].attempts, 1);
    assert.equal(multiline.bigrams[' c'].latencyTotalMs, 100,
        'multiline pairs retain the typed separator rather than inventing bc');
    assert.equal(Object.hasOwn(multiline.bigrams, 'bc'), false);

    engine.mode = 'strict';
    engine.loadExercise('A!');
    for (const event of [{ key: 'Shift' }, { key: 'A', metaKey: true },
            { key: 'A', isComposing: true }]) engine.handleKey(event);
    now = 30000;
    engine.handleKey({ key: 'A' });
    now = 30100;
    engine.handleKey({ key: '!' });
    assert.equal(engine.getStats().learning.keys.a.attempts, 1,
        'case shares a physical key without counting navigation or composing events');
    assert.equal(engine.getStats().learning.bigrams['a!'].latencyTotalMs, 100);
    engine.loadExercise('a市bc');
    for (const [key, time] of [['a', 31000], ['市', 31100], ['b', 32100], ['c', 32200]]) {
        now = time;
        engine.handleKey({ key });
    }
    assert.equal(engine.isComplete, true, 'non-ASCII text remains usable in guided input');
    const mixed = engine.getStats().learning;
    assert.deepEqual(mixed.keys.b, {
        attempts: 1,
        errors: 0,
        latencySamples: 0,
        latencyTotalMs: 0
    }, 'an unmapped target breaks reach timing before the next keyboard target');
    assert.equal(Object.hasOwn(mixed.bigrams, 'ab'), false,
        'an unmapped target cannot create a pair across the skipped representation');
    assert.equal(mixed.bigrams.bc.latencyTotalMs, 100,
        'consecutive mapped targets resume normal reach measurements');
    engine.loadExercise('a');
    assert.deepEqual(Object.keys(engine.getStats().learning.keys), [],
        'a new session starts without observations from the previous exercise');
    console.log(
        'Learning checks passed: target retries, intended pairs, measured reach, pause and correction exclusion.'
    );
} finally {
    engine.reset();
    performance.now = originalNow;
}
