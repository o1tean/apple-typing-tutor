import assert from 'node:assert/strict';
import { TypingEngine } from '../js/engine.js';
import {
    currentWord,
    formatElapsedTime,
    generateWords,
    normalizeCustomText,
    recordSpeedSample,
    resultFeedback,
    sessionLabel,
    typingErrorMessage
} from '../js/practice.js';

for (const count of [10, 25, 50, 100, 400]) {
    const words = generateWords(count, {}, () => 0).split(' ');
    assert.equal(words.length, count);
    assert.ok(words.every((word, index) => word && word !== words[index - 1]));
}
const modified = generateWords(25, { punctuation: true, numbers: true }, () => 0.5);
assert.match(modified, /^[A-Z]/);
assert.match(modified, /\d+/);
assert.match(modified, /,/);
assert.ok(modified.endsWith('.'));
assert.equal(normalizeCustomText('  cafe\u0301\t\n hello\r\nworld '), 'café hello world');
assert.equal(normalizeCustomText(' \n\t'), '');
const customEngine = new TypingEngine({ mode: 'strict' });
try {
    for (const [copied, visible] of [
        ['hello\u200Bworld', 'helloworld'],
        ['re\u00ADenter', 'reenter'],
        ['\u00AD\u200B', ''],
        [' \u00AD\t hello\u200B \nworld \u200B', 'hello world'],
        ['cafe\u00AD\u0301', 'café'],
        ['cafe\u200B\u0301', 'café'],
        ['你\u200B好', '你好'],
        ['re-enter re‐enter re‑enter', 're-enter re‐enter re‑enter'],
        ['👩\u200D💻', '👩\u200D💻'],
        ['نیمه\u200Cفاصله', 'نیمه\u200Cفاصله']
    ]) {
        const cleaned = normalizeCustomText(copied);
        assert.equal(cleaned, visible, 'remove only copied layout markers before composition');
        if (!cleaned) continue;
        customEngine.loadExercise(cleaned);
        for (const key of visible) customEngine.handleKey({ key });
        assert.equal(customEngine.isComplete, true,
            'the visible cleaned passage completes guided input');
        assert.equal(customEngine.errorKeystrokes, 0);
    }
} finally {
    customEngine.reset();
}

for (const [milliseconds, label] of [
    [0, '0s'], [4, '0.004s'], [0.4, '0.0004s'], [0.004, '0.000004s'],
    [125, '0.125s'], [1234, '1.23s'], [15400, '15.4s'], [30000, '30s']
]) assert.equal(formatElapsedTime(milliseconds), label);
const shortSamples = [];
recordSpeedSample(shortSamples, { elapsedMilliseconds: 0, wpm: 0 }, true);
recordSpeedSample(shortSamples, { elapsedMilliseconds: 4, wpm: 15000 });
assert.deepEqual(shortSamples, [], 'ticks before the first observed second do not invent samples');
recordSpeedSample(shortSamples, { elapsedMilliseconds: 4, wpm: 15000 }, true);
assert.deepEqual(shortSamples, [{ elapsedMilliseconds: 4, wpm: 15000 }],
    'a positive subsecond endpoint retains its exact timestamp');
const samples = [];
recordSpeedSample(samples, { elapsedMilliseconds: 1100, wpm: 50 });
recordSpeedSample(samples, { elapsedMilliseconds: 1150, wpm: 55 });
recordSpeedSample(samples, { elapsedMilliseconds: 3400, wpm: 60 });
assert.deepEqual(samples, [
    { elapsedMilliseconds: 1100, wpm: 50 }, { elapsedMilliseconds: 3400, wpm: 60 }
], 'record one sample per observed second without filling missed seconds');
recordSpeedSample(samples, { elapsedMilliseconds: 3400, wpm: 61 }, true);
assert.deepEqual(samples.at(-1), { elapsedMilliseconds: 3400, wpm: 61 });
assert.equal(samples.length, 2, 'the final sample replaces an exactly matching tick');
recordSpeedSample(samples, { elapsedMilliseconds: 3400.1, wpm: 62 }, true);
assert.deepEqual(samples.slice(-2).map(sample => sample.elapsedMilliseconds), [3400, 3400.1],
    'timestamps that formerly rounded to the same value remain distinct');
const boundarySamples = [];
recordSpeedSample(boundarySamples, { elapsedMilliseconds: 1999, wpm: 50 });
recordSpeedSample(boundarySamples, { elapsedMilliseconds: 2000, wpm: 0 });
assert.deepEqual(boundarySamples.map(sample => sample.elapsedMilliseconds), [1999, 2000],
    'display rounding cannot suppress a sample from the next observed second');
assert.equal(boundarySamples.at(-1).wpm, 0, 'zero speed at a positive timestamp is a real sample');

const characters = Array.from('cat dog').map(char => ({ char }));
for (const index of [0, 1, 3]) assert.equal(currentWord(characters, index), 'cat');
for (const index of [4, 6, 7]) assert.equal(currentWord(characters, index), 'dog');
characters.splice(3, 0, { char: 's', extra: true });
assert.equal(currentWord(characters, 4), 'cat', 'extra letters do not enter the retry target');
assert.equal(currentWord([], 0), '');
for (const [expected, typed, mode, message] of [
    ['f', 'g', 'strict', 'Expected “f”; typed “g”. Try again.'],
    ['f', 'g', 'flow', 'Expected “f”; typed “g”. Backspace to correct it.'],
    [' ', 'g', 'flow', 'Expected Space; typed “g”. Backspace to correct it.'],
    ['f', ' ', 'strict', 'Expected “f”; typed Space. Try again.'],
    ['f', ' ', 'flow', 'Skipped characters before Space; expected “f”.'],
    [null, ' ', 'flow', 'Word submitted with mistakes.'],
    [null, 'g', 'flow', 'Extra character “g”. Backspace to remove it.'],
    ['😀', 'a', 'strict', 'Expected “😀”; typed “a”. Try again.']
]) assert.equal(typingErrorMessage(expected, typed, mode), message);
const result = {
    correctNonSpaceChars: 5,
    elapsedMilliseconds: 1000,
    skippedChars: 0,
    accuracy: 100,
    wpm: 60,
    missedWords: []
};
const lesson = { track: 'lesson', targetAccuracy: 98, targetWpm: 60 };
for (const [stats, exercise, heading, advice] of [
    [{ correctNonSpaceChars: 0, skippedChars: 5, elapsedMilliseconds: 0 }, lesson,
        'Let’s try that again.', 'Type each word before pressing Space.'],
    [{ correctNonSpaceChars: 0 }, { track: 'test' }, 'Let’s try that again.',
        'Follow the displayed text. Choose Repeat this text.'],
    [{ elapsedMilliseconds: 0 }, lesson, 'Too short to measure.',
        'Use a longer passage and try again.'],
    [{ skippedChars: 1, accuracy: 80, missedWords: ['cat'] }, lesson, 'Finish each word.',
        'Type every character before Space. Choose Practice missed words or Try again.'],
    [{ accuracy: 97, missedWords: ['cat'] }, lesson, 'Accuracy comes first.',
        'Aim for 98% accuracy. Choose Practice missed words or Try again.'],
    [{ accuracy: 94 }, { track: 'custom' }, 'Accuracy comes first.',
        'Aim for 95% accuracy. Choose Try again.'],
    [{}, { track: 'custom' }, 'Practice complete.', 'Choose Try again.'],
    [{}, { track: 'retry' }, 'Practice complete.', 'Choose Try again.'],
    [{}, { ...lesson, options: { recordEligible: false } }, 'Practice complete.',
        'Choose Try again.'],
    [{}, { track: 'quote', options: { recordEligible: false } }, 'Practice complete.',
        'Choose Repeat this text.'],
    [{ wpm: 59 }, lesson, 'Accuracy target met.',
        'Aim for 60 WPM for 3 stars. Choose Try again.'],
    [{}, lesson, 'Lesson target reached.', 'Choose Try again to reinforce these keys.'],
    [{ elapsedMilliseconds: 4, elapsedSeconds: 0, wpm: 15000 }, { track: 'test' },
        'Test complete.', 'Choose Repeat this text. You can also start a fresh passage.'],
    [{ missedWords: ['cat'] }, { track: 'quote' }, 'Test complete.',
        'Choose Practice missed words or Repeat this text. You can also start a fresh passage.']
]) assert.deepEqual(resultFeedback({ ...result, ...stats }, exercise), { heading, advice });
assert.equal(sessionLabel({ lessonId: 'custom' }), 'Custom text');
assert.equal(sessionLabel({ lessonId: 'time-30-punctuation', typingMode: 'strict' }),
    '30 seconds · guided · punctuation');
assert.equal(sessionLabel({
        lessonId: 'words-25',
        testMode: 'words',
        testWordCount: 25,
        numbers: true
    }),
    '25 words · numbers');
console.log(
    'Practice generation, custom Unicode cleanup, exact speed samples, elapsed labels, typing feedback, and result coaching checks passed.'
);
