import assert from 'node:assert/strict';
import { TypingEngine } from '../js/engine.js';
import { CURRICULUM } from '../js/lessons.js';
import { sound } from '../js/audio.js';

let now = 0;
const originalNow = performance.now;
performance.now = () => now;
const engine = new TypingEngine();
const type = text => {
    for (const key of text) engine.handleKey({ key });
};

try {
    // Every course must render the next line before its notification and finish once.
    for (const lesson of [...CURRICULUM.amateur, ...CURRICULUM.pro]) {
        let completions = 0;
        engine.onComplete = () => completions++;
        engine.onLineComplete = index => {
            if (index < engine.lines.length) {
                assert.equal(engine.typedChars.map(item => item.char).join(''), lesson.lines[
                    index]);
                assert.equal(engine.currentCharIndex, 0);
            }
        };
        engine.loadExercise(lesson.lines);
        for (const line of lesson.lines) {
            now += 1000;
            type(line);
        }
        assert.equal(completions, 1, lesson.id);
        assert.equal(engine.getStats().accuracy, 100);
        const finished = engine.getStats();
        now += 60_000;
        assert.deepEqual(engine.getStats(), finished, 'finished statistics stay frozen');
        type('x');
        assert.equal(completions, 1);
    }
    engine.onComplete = () => {};
    engine.onLineComplete = () => {};

    engine.loadExercise(['', 'a😀b', '']);
    for (const key of ['Backspace', 'Enter', 'Delete', 'Shift', 'Tab', 'Escape', 'F1',
        'ArrowLeft']) {
        engine.handleKey({ key });
    }
    for (const modifier of ['metaKey', 'ctrlKey', 'altKey', 'isComposing']) {
        engine.handleKey({ key: 'a', [modifier]: true });
    }
    engine.handleKey({ key: 'a', keyCode: 229, isComposing: false });
    assert.equal(engine.isRunning, false, 'navigation and shortcuts do not start a session');
    assert.equal(engine.currentCharIndex, 0, 'IME boundary keys do not advance the target');
    assert.equal(engine.totalKeystrokes, 0, 'IME boundary keys do not change accuracy');
    type('x');
    assert.equal(engine.currentCharIndex, 0, 'strict mode holds its place after mistakes');
    type('a😀b');
    assert.equal(engine.isComplete, true,
        'empty lines and Unicode code points do not block completion');
    assert.equal(engine.getStats().accuracy, 75);

    engine.mode = 'flow';
    engine.loadExercise('市a');
    engine.handleKey({ key: 's', keyCode: 229, isComposing: false });
    assert.equal(engine.isRunning, false, 'IME opening keys wait for committed input');
    type('市');
    engine.handleKey({ key: 'Backspace', keyCode: 229, isComposing: false });
    assert.equal(engine.currentCharIndex, 1, 'IME boundary deletion cannot remove committed input');
    type('a');
    assert.equal(engine.isComplete, true, 'real committed characters succeed after IME boundaries');
    assert.equal(engine.getStats().accuracy, 100);

    // No deleted/retyped character may inflate speed; mistakes still count as attempts.
    engine.mode = 'flow';
    engine.loadExercise('abc');
    type('a');
    engine.handleKey({ key: 'Backspace' });
    type('ax');
    engine.handleKey({ key: 'Backspace' });
    type('b');
    now += 300;
    assert.equal(engine.netCorrectChars, 2);
    assert.equal(engine.getStats().correctNonSpaceChars, 2,
        'nonspace progress counts retained input after correction');
    assert.equal(engine.correctKeystrokes, 3);
    assert.equal(engine.getStats().accuracy, 75);
    assert.equal(engine.getStats().wpm, 80);
    assert.equal(engine.getStats().rawWpm, 80,
        'deleted and retyped input cannot inflate retained raw speed');

    engine.mode = 'strict';
    engine.loadExercise('ab');
    type('xxa');
    assert.equal(engine.netTypedChars, 1, 'strict retries replace the same target slot');
    assert.equal(engine.getStats().rawWpm, engine.getStats().wpm);
    assert.equal(engine.errorKeystrokes, 2);
    assert.equal(engine.getStats().accuracy, 33.3);
    type('x');
    now += 60_000;
    assert.equal(engine.getStats().cpm, 1,
        'guided rejection cannot remove the accepted clean prefix from word credit');
    assert.equal(engine.getStats().accuracy, 25);
    engine.mode = 'flow';

    // Space submits a short word without shifting the following word's targets.
    engine.loadExercise('cat dog fox');
    type('c ');
    assert.equal(engine.getCurrentChar(), 'd');
    assert.equal(engine.skippedChars, 2);
    assert.equal(engine.errorKeystrokes, 0, 'missing targets do not invent physical errors');
    assert.equal(engine.netTypedChars, 2, 'skipped placeholders do not count as retained input');
    assert.equal(engine.getStats().accuracy, 50, 'missing targets count against accuracy');
    assert.deepEqual(engine.errorsByChar, { a: 1, t: 1 });
    assert.deepEqual(engine.typedChars.slice(1, 3).map(item => item.status), ['incorrect',
        'incorrect']);
    engine.handleKey({ key: 'Backspace' });
    assert.equal(engine.currentCharIndex, 1, 'reopen a short incorrect word at its actual input');
    assert.equal(engine.netCorrectChars, 1);
    type('at dog ');
    assert.equal(engine.getCurrentChar(), 'f');
    const correctWordBoundary = engine.currentCharIndex;
    engine.handleKey({ key: 'Backspace' });
    assert.equal(engine.currentCharIndex, correctWordBoundary,
        'completed correct words stay locked');
    assert.equal(engine.netCorrectChars, 8,
        'repairing skipped characters cannot count deleted spaces twice');
    assert.equal(engine.getStats().correctNonSpaceChars, 6);
    assert.equal(engine.totalKeystrokes, 9);
    assert.equal(engine.getStats().accuracy, 81.8,
        'repairing a word retains historical skipped errors');

    engine.loadExercise('cat');
    type('c ');
    assert.equal(engine.isComplete, true, 'Space can submit a short final word');
    assert.equal(engine.netCorrectChars, 1,
        'final word submission cannot invent a target separator');
    assert.equal(engine.correctKeystrokes, 1);
    assert.equal(engine.errorKeystrokes, 1);
    assert.equal(engine.skippedChars, 2);
    assert.equal(engine.netTypedChars, 1, 'submission-only final Space does not inflate raw speed');

    engine.loadExercise('cat dog');
    type('cat dox');
    assert.equal(engine.isComplete, false, 'an incorrect final word remains editable');
    engine.handleKey({ key: 'Backspace' });
    type('g');
    assert.equal(engine.isComplete, true, 'correcting the final word completes the test');
    assert.equal(engine.netCorrectChars, 7);
    assert.equal(engine.errorKeystrokes, 1, 'the final correction retains its error history');

    engine.loadExercise('cat dog');
    type('cat doxs');
    assert.equal(engine.isComplete, false, 'a final incorrect word accepts visible overflow');
    assert.equal(engine.typedChars.at(-1).extra, true);
    engine.handleKey({ key: 'Backspace' });
    engine.handleKey({ key: 'Backspace' });
    type('g');
    assert.equal(engine.isComplete, true);
    assert.equal(engine.typedChars.map(item => item.char).join(''), 'cat dog');

    engine.loadExercise('cat dog');
    type('cxt dog');
    assert.equal(engine.isComplete, true, 'past submitted mistakes do not block completion');
    engine.loadExercise('cat dog');
    type('cat dox ');
    assert.equal(engine.isComplete, true, 'Space can explicitly submit an incorrect final word');

    engine.loadExercise('one two three');
    type('   ');
    assert.equal(engine.isComplete, true);
    assert.equal(engine.getStats().accuracy, 14.3);
    assert.ok(engine.getStats().accuracy < 95,
        'skipping every word cannot satisfy the accuracy target');

    engine.loadExercise('one two');
    type('xxx xxx ');
    assert.equal(engine.isComplete, true);
    assert.equal(engine.correctKeystrokes, 1);
    assert.equal(engine.getStats().correctNonSpaceChars, 0,
        'correct separators alone do not qualify as successful target input');

    // Net speed credits clean words/prefixes; raw speed retains real input.
    for (const [target, entered, credit, retained] of [
        ['cat dog', 'cat dog', 7, 7],
        ['cat dog', 'cat dox ', 4, 7],
        ['cat dog', 'cxt dog', 3, 7],
        ['cat dog', 'cats dog', 3, 8],
        ['cat dog', 'c dog', 3, 5],
        ['cat dog', 'xxx xxx ', 0, 7],
        ['cat dog', '  ', 0, 1],
        ['cat dog', 'cat d', 5, 5],
        ['cat dog', 'cat x', 4, 5],
        ['cat dog', 'cat', 3, 3],
        ['cat  dog', 'cat  dog', 8, 8],
        ['  cat dog ', '  cat dog ', 10, 10],
        ['😀a b', '😀a b', 4, 4],
        [['cat', 'dog'], 'cat dog', 7, 7],
        [['cat', 'dog'], 'cxt dog', 3, 7],
        [['cat', 'dog'], ' dog', 3, 4],
        [['cat ', 'dog'], 'cat dog', 7, 7]
    ]) {
        engine.loadExercise(target);
        const keys = Array.from(entered);
        type(keys.shift());
        now += 60_000;
        type(keys.join(''));
        const measured = engine.getStats();
        assert.equal(measured.wpmMetric, 'words-v1');
        assert.equal(measured.cpm, credit, `${entered}: clean word credit`);
        assert.equal(measured.wpm, Math.round(credit / 5));
        assert.equal(engine.netTypedChars, retained, `${entered}: retained raw input`);
        assert.equal(measured.rawWpm, Math.round(retained / 5));
    }
    engine.loadExercise('cat dog');
    type('c');
    now += 60_000;
    type('xt ');
    assert.equal(engine.getStats().cpm, 0);
    for (let deletion = 0; deletion < 3; deletion++) engine.handleKey({ key: 'Backspace' });
    assert.equal(engine.getStats().cpm, 1, 'reopening and correcting restores a clean prefix');
    type('at dog');
    assert.equal(engine.getStats().cpm, 7, 'a corrected word restores net word credit');
    assert.equal(engine.getStats().accuracy, 90, 'word correction keeps historical mistakes');

    engine.loadExercise('cat dog', 60);
    type('c');
    now += 30_000;
    type('at d');
    assert.equal(engine.getStats().cpm, 10, 'a clean timed prefix earns partial credit');
    type('x');
    assert.equal(engine.getStats().cpm, 8, 'an incorrect timed prefix earns no word credit');
    engine.handleKey({ key: 'Backspace' });
    assert.equal(engine.getStats().cpm, 10);
    now += 30_000;
    engine.updateTick();
    assert.equal(engine.isComplete, true);
    assert.equal(engine.getStats().cpm, 5, 'the final clean timed prefix stays credited');

    engine.loadExercise(['hi', 'no'], 120);
    type('h');
    now += 60_000;
    type('i no ');
    assert.equal(engine.currentLineIndex, 0);
    assert.equal(engine.getStats().cpm, 6, 'timed loop banks each discarded line once');
    type('h');
    assert.equal(engine.getStats().cpm, 7, 'a fresh pool prefix adds to earlier credit');
    type('x ');
    assert.equal(engine.getStats().cpm, 6, 'a dirty virtual line separator earns no credit');

    // Overflow letters belong to their word, and deleting them restores target alignment.
    engine.loadExercise('cat dog');
    type('cats ');
    assert.equal(engine.getCurrentChar(), 'd');
    assert.equal(engine.typedChars[3].extra, true);
    assert.equal(engine.netTypedChars, 5, 'retained overflow letters count toward raw speed');
    assert.equal(engine.errorKeystrokes, 1);
    assert.deepEqual(engine.errorsByChar, { s: 1 }, 'overflow feedback identifies the extra glyph');
    engine.handleKey({ key: 'Backspace' });
    engine.handleKey({ key: 'Backspace' });
    assert.equal(engine.getCurrentChar(), ' ');
    assert.equal(engine.typedChars.map(item => item.char).join(''), 'cat dog');
    assert.equal(engine.netTypedChars, 3, 'deleted overflow and separator leave raw speed');
    type(' dog');
    assert.equal(engine.isComplete, true);
    assert.equal(engine.netCorrectChars, 7);

    for (const modifier of ['ctrlKey', 'altKey']) {
        engine.loadExercise('cat dog fox');
        type('cxt ');
        engine.handleKey({ key: 'Backspace', [modifier]: true });
        assert.equal(engine.currentCharIndex, 0,
            'word deletion can reopen the previous incorrect word');
        assert.equal(engine.netCorrectChars, 0);
        type('ca');
        engine.handleKey({ key: 'Backspace', [modifier]: true });
        assert.equal(engine.currentCharIndex, 0, 'word deletion clears the current word');
        assert.equal(engine.netCorrectChars, 0);
        assert.equal(engine.errorKeystrokes, 1, 'corrections retain physical error history');
    }

    engine.loadExercise(['a😀', 'bc']);
    type('a😀');
    assert.equal(engine.currentLineIndex, 0, 'flow line transitions wait for their word separator');
    type(' bc');
    assert.equal(engine.isComplete, true);
    assert.equal(engine.netCorrectChars, 5);
    assert.equal(engine.netTypedChars, 5, 'line transition spaces count as retained input');
    assert.equal(engine.getStats().correctNonSpaceChars, 4,
        'nonspace progress survives line transitions');

    engine.loadExercise(['hi', 'no'], 15);
    type('hix no ');
    assert.equal(engine.currentLineIndex, 0, 'flow timed pools loop through separated lines');
    assert.equal(engine.getCurrentChar(), 'h');
    assert.equal(engine.totalKeystrokes, 7);
    assert.equal(engine.errorKeystrokes, 1);
    assert.equal(engine.netCorrectChars, 6);
    now += 15_001;
    type('h');
    assert.equal(engine.isComplete, true);
    assert.equal(engine.totalKeystrokes, 7, 'flow overflow handling must respect the deadline');

    for (const duration of [15, 30, 60]) {
        now = 0;
        engine.mode = 'strict';
        engine.loadExercise(['ab', 'cd'], duration);
        type('abcd');
        assert.equal(engine.isComplete, false, 'speed tests continue after exhausting the text');
        assert.equal(engine.getCurrentChar(), 'a');
        now = 1000;
        engine.updateTick();
        assert.equal(engine.getStats().timeRemaining, duration - 1);
        engine.pause();
        const paused = engine.getStats();
        now += 20_000;
        type('a');
        assert.deepEqual(engine.getStats(), paused, 'pause freezes input and elapsed time');
        engine.resume();
        now += (duration - 1) * 1000 + 250;
        type('a');
        assert.equal(engine.isComplete, true, 'expired input cannot add another keystroke');
        assert.equal(engine.totalKeystrokes, 4);
        assert.equal(engine.getStats().elapsedSeconds, duration);
        assert.equal(engine.getStats().elapsedMilliseconds, duration * 1000);
        assert.equal(engine.getStats().timeRemaining, 0);
    }

    now = 0;
    engine.loadExercise('ab');
    type('a');
    const zeroTime = engine.getStats();
    assert.deepEqual([zeroTime.wpm, zeroTime.rawWpm, zeroTime.cpm], [0, 0, 0],
        'speed stays zero until there is positive measured typing time');
    now = 125;
    type('b');
    assert.equal(engine.getStats().elapsedSeconds, 0);
    assert.equal(engine.getStats().elapsedMilliseconds, 125,
        'subsecond results retain their precise duration');
    const quickResult = engine.getStats();
    assert.deepEqual([quickResult.wpm, quickResult.rawWpm, quickResult.cpm], [192, 192, 960],
        'subsecond rates use the same measured duration as the result');
    now += 1000;
    assert.deepEqual(engine.getStats(), quickResult);

    // Missing interval measurements cannot imply a perfectly consistent rhythm.
    for (const [label, delays, expected] of [
        ['no input', [], null],
        ['one character', [0], null],
        ['six uneven characters', [0, 1, 1000, 1, 1000, 1], null],
        ['seven uniform characters', [0, 100, 100, 100, 100, 100, 100], 100],
        ['seven uneven characters', [0, 1, 1000, 1, 1000, 1, 1000], 55],
        ['seven zero-time characters', [0, 0, 0, 0, 0, 0, 0], null]
    ]) {
        engine.loadExercise('abcdefg');
        delays.forEach((delay, index) => {
            now += delay;
            type('abcdefg' [index]);
        });
        assert.equal(engine.getStats().consistency, expected, label);
    }
    engine.loadExercise('abcdefgh');
    type('a');
    now += 1;
    type('b');
    now += 1000;
    type('c');
    engine.pause();
    now += 20_000;
    type('d');
    engine.resume();
    now += 100;
    type('d');
    assert.deepEqual(engine.keystrokeIntervals, [1, 1000],
        'paused input and the first resumed key do not create rhythm intervals');
    for (const [key, delay] of [['e', 1], ['f', 1000], ['g', 1]]) {
        now += delay;
        type(key);
    }
    assert.equal(engine.getStats().consistency, null,
        'a pause can leave seven characters with too few measured intervals');
    now += 1000;
    type('h');
    assert.deepEqual(engine.keystrokeIntervals, [1, 1000, 1, 1000, 1, 1000]);
    assert.equal(engine.getStats().consistency, 55,
        'enough measured intervals after resuming restore the unchanged score');

    // A new exercise clears the previous countdown and typing history.
    engine.loadExercise('abcdefg');
    now += 1000;
    for (const key of 'abcdefg') {
        now += 100;
        type(key);
    }
    assert.equal(engine.timedDuration, 0);
    assert.equal(engine.getStats().consistency, 100);
    assert.equal(engine.keystrokeIntervals.length, 6, 'exclude the artificial first interval');

    engine.loadExercise('a'.repeat(40));
    for (const key of 'a'.repeat(40)) {
        now += 100;
        type(key);
    }
    assert.equal(engine.keystrokeIntervals.length, 30,
        'retain only intervals used by the consistency score');
    for (const invalidDuration of [NaN, Infinity, -30]) {
        engine.loadExercise('a', invalidDuration);
        assert.equal(engine.timedDuration, 0, 'invalid durations cannot create endless countdowns');
        type('a');
        assert.equal(engine.isComplete, true);
    }

    // Zero volume must not create audio or ramp a zero gain back to an audible level.
    sound.setVolume(0);
    sound.playKey();
    sound.playError();
    sound.playSuccess();
    assert.equal(sound.ctx, null);

    const saved = new Map();
    globalThis.localStorage = {
        getItem: key => saved.get(key) ?? null,
        setItem: (key, value) => saved.set(key, value)
    };
    const { storage } = await import('../js/storage.js');
    engine.loadExercise('ab');
    type('a');
    now += 300;
    type('b');
    const stats = engine.getStats();
    await storage.recordLesson('amat-intro', stats);
    const originalProgress = { ...storage.getLessonProgress('amat-intro', stats) };
    await storage.recordLesson('custom', { ...stats, wpm: 100 });
    await storage.recordLesson('speed-30', { ...stats, wpm: 80 });
    assert.deepEqual(storage.getLessonProgress('amat-intro', stats), originalProgress);
    assert.equal(storage.getStats().totalSessions, 3);
    assert.deepEqual(storage.load(), storage.data, 'scores survive saving and loading');

    console.log(
        'Regression checks passed: all 22 lessons, word submission and corrections, overflow, word deletion, line transitions, timers, pause/resume, measured consistency, Unicode, sound and saved scores.'
    );
} finally {
    engine.reset();
    performance.now = originalNow;
}
