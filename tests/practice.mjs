import assert from 'node:assert/strict';
import { TypingEngine } from '../js/engine.js';
import { CURRICULUM } from '../js/lessons.js';
import { mergeLearning } from '../js/learning.js';
import {
    currentWord,
    focusKeys,
    formatElapsedTime,
    generateLessonDrill,
    generateWeakDrill,
    generateWords,
    lessonsForLayout,
    latestLesson,
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
    [{ elapsedMilliseconds: 4, elapsedSeconds: 0, wpm: 15000 }, { track: 'test' },
        'Test complete.', 'Choose Repeat this text. You can also start a fresh passage.'],
    [{ missedWords: ['cat'] }, { track: 'quote' }, 'Test complete.',
        'Choose Practice missed words or Repeat this text. You can also start a fresh passage.']
]) assert.deepEqual(resultFeedback({ ...result, ...stats }, exercise), { heading, advice });
for (const nextLabel of ['Next lesson', 'Choose a lesson']) {
    assert.deepEqual(resultFeedback(result, lesson, nextLabel), {
        heading: 'Lesson target reached.',
        advice: `Select “${nextLabel}” to keep learning.`,
        advance: true
    });
}
const history = ['words-10', 'unknown-lesson', 'pro-3', 'amat-2']
    .map(lessonId => ({ lessonId, futureField: true }));
const originalHistory = JSON.stringify(history);
assert.deepEqual(latestLesson(history), { track: 'pro', index: 2 });
assert.equal(JSON.stringify(history), originalHistory, 'continuation never rewrites history');
assert.equal(latestLesson([]), null);
assert.equal(latestLesson([{ lessonId: 'words-10' }]), null);
assert.deepEqual(latestLesson([{ lessonId: 'amat-intro' }]), { track: 'amateur', index: 0 });
assert.deepEqual(latestLesson([{ lessonId: 'amat-11' }]), { track: 'amateur', index: 11 });
const oldProgress = {
    'amat-1': { completed: true, lastPlayed: 100, future: 'keep' },
    'words-v1:pro-2': { completed: true, lastPlayed: 200 },
    'words-v1:pro-3': { completed: false, lastPlayed: 300 },
    'unknown': { completed: true, lastPlayed: 400 },
    'amat-2': { completed: true, lastPlayed: Infinity },
    'amat-3': { completed: true }
};
const progressBefore = structuredClone(oldProgress);
assert.deepEqual(latestLesson([{ lessonId: 'words-10' }], oldProgress), { track: 'pro', index: 1 },
    'dated completed progress survives history eviction');
assert.deepEqual(latestLesson([{ lessonId: 'amat-intro' }], oldProgress), {
    track: 'amateur',
    index: 0
}, 'retained attempts take priority, including unfinished targets');
assert.equal(latestLesson([], { 'amat-1': { completed: true } }), null,
    'undated progress cannot invent which lesson was latest');
assert.deepEqual(oldProgress, progressBefore, 'continuation preserves both progress formats');
assert.equal(sessionLabel({ lessonId: 'custom' }), 'Custom text');
for (const lessonId of ['quote-0', 'quote-3', 'quote-99', 'quote-999']) {
    const entry = { lessonId, wpm: 80, accuracy: 99 };
    const before = { ...entry };
    assert.equal(sessionLabel(entry), 'Quote · legacy selection',
        'old numeric selections cannot inherit an unrelated new quote author');
    assert.deepEqual(entry, before, 'history labels never rewrite saved quote IDs or scores');
}
const quote = CURRICULUM.quotes[0];
const originalQuotes = CURRICULUM.quotes;
CURRICULUM.quotes = [...originalQuotes].reverse();
try {
    assert.equal(sessionLabel({ lessonId: `quote-${quote.id}` }), `Quote · ${quote.author}`,
        'source identities keep the right author after the corpus is reordered');
} finally {
    CURRICULUM.quotes = originalQuotes;
}
assert.equal(sessionLabel({ lessonId: 'quote-bartlett-unavailable-source' }), 'Quote · practice');
assert.equal(sessionLabel({ lessonId: 'time-30-punctuation', typingMode: 'strict' }),
    '30 seconds · guided · punctuation');
assert.equal(sessionLabel({
        lessonId: 'words-25',
        testMode: 'words',
        testWordCount: 25,
        numbers: true
    }),
    '25 words · numbers');

for (const key of ['q', ';', '7', ' ']) {
    const profile = {
        version: 1,
        keys: {
            [key]: {
                attempts: 40,
                errors: 36,
                latencySamples: 40,
                latencyTotalMs: 36000,
                recentErrorRate: 0.9,
                recentLatencyMs: 900
            }
        },
        bigrams: {}
    };
    const before = JSON.stringify(profile);
    const variants = [];
    for (const value of [0, 0.5, 0.999]) {
        const drill = generateWeakDrill(profile, () => value);
        assert.ok(drill.focusKeys.includes(key), 'observed weak keys remain eligible for practice');
        const text = drill.lines.join('');
        assert.ok(text.length > 0);
        assert.ok(Array.from(text).filter(char => char === key).length / text.length >= 1 / 3,
            `weak ${JSON.stringify(key)} occupies at least a third of all characters, including spaces`
        );
        assert.deepEqual(generateWeakDrill(profile, () => value), drill,
            'an injected random source gives a reproducible drill');
        variants.push(text);
    }
    assert.notEqual(variants[0], variants[2], 'fresh random choices vary the practiced text');
    assert.equal(JSON.stringify(profile), before, 'generating practice never mutates learned data');
}
for (const track of ['amateur', 'pro']) {
    const introduced = new Set([' ']);
    for (const [index, item] of CURRICULUM[track].entries()) {
        const before = JSON.stringify(item);
        assert.ok(item.keysIntroduced.every(key => Array.from(key).length === 1),
            'lesson generation uses explicit introduced characters');
        for (const key of item.keysIntroduced) introduced.add(key);
        const ownHand = ['amat-intro', 'amat-1', 'amat-2', 'pro-1', 'pro-2'].includes(item.id);
        const available = ownHand ? new Set([' ', ...item.keysIntroduced]) : introduced;
        const first = generateLessonDrill(track, index, () => 0);
        const retry = generateLessonDrill(track, index, () => 0.999);
        assert.ok(first.join('').length > 0 && retry.join('').length > 0);
        for (const lines of [first, retry]) {
            assert.ok(Array.from(lines.join('')).every(key => available.has(key)),
                `${item.id} cannot practice a character outside its introduced keys`);
        }
        assert.notDeepEqual(first, retry, `${item.id} retries are generated instead of memorized`);
        assert.equal(JSON.stringify(item), before,
            'lesson IDs, targets and definitions stay intact');
    }
}
const weakProfile = {
    version: 1,
    keys: {
        q: {
            attempts: 40,
            errors: 36,
            latencySamples: 40,
            latencyTotalMs: 36000,
            recentErrorRate: 0.9,
            recentLatencyMs: 900
        },
        w: {
            attempts: 40,
            errors: 12,
            latencySamples: 40,
            latencyTotalMs: 20000,
            recentErrorRate: 0.3,
            recentLatencyMs: 500
        }
    },
    bigrams: {}
};
assert.deepEqual(focusKeys(weakProfile), ['q']);
const improved = mergeLearning(weakProfile, {
    keys: {
        q: { attempts: 25, errors: 0, latencySamples: 25, latencyTotalMs: 1250 }
    },
    bigrams: {}
});
assert.deepEqual(focusKeys(improved), ['w'],
    'cleaner and faster recent practice rotates the old focus out toward the next weak key');
assert.equal(improved.keys.q.errors, 36, 'rotation preserves lifetime errors');

for (const [preset, left, right, inner, upper, lower, rest] of [
    ['colemak', 'arst', 'neio', 'dh', 'qwfpgjluy;', 'zxcvbkm,.', 't'],
    ['dvorak', 'aoeu', 'htns', 'id', "',.pyfgcrl", ';qjkxbmwv', 'u']
]) {
    const amateur = lessonsForLayout('amateur', preset);
    const pro = lessonsForLayout('pro', preset);
    assert.deepEqual(amateur[1].keysIntroduced, Array.from(left + ' '));
    assert.deepEqual(amateur[2].keysIntroduced, Array.from(right + ' '));
    assert.deepEqual(amateur[4].keysIntroduced, Array.from(inner));
    assert.deepEqual(pro[3].keysIntroduced, Array.from(upper));
    assert.deepEqual(pro[4].keysIntroduced, Array.from(lower));
    assert.ok(amateur[0].description.includes(Array.from(left).join(' ').toUpperCase()));
    assert.ok(amateur[0].description.includes(Array.from(right).join(' ').toUpperCase()));
    assert.ok(amateur[1].description.includes(`${left[3].toUpperCase()} with Left Index`));
    for (const track of ['amateur', 'pro']) {
        const originals = JSON.stringify(CURRICULUM[track]);
        const introduced = new Set([' ']);
        for (const [index, item] of lessonsForLayout(track, preset).entries()) {
            const original = CURRICULUM[track][index];
            for (const key of ['id', 'targetWpm', 'targetAccuracy']) {
                assert.equal(item[key], original[key],
                    'layout choices preserve lesson identity and targets');
            }
            if (index > (track === 'amateur' ? 9 : 4)) {
                assert.deepEqual(item, original,
                    'alphabet, capitals, numbers and punctuation remain actual target characters'
                );
            }
            for (const key of item.keysIntroduced) introduced.add(key);
            const ownHand = track === 'amateur' ? index <= 2 : index <= 1;
            const allowed = ownHand ? new Set([' ', ...item.keysIntroduced]) : introduced;
            const first = generateLessonDrill(track, index, () => 0, preset);
            const retry = generateLessonDrill(track, index, () => 0.999, preset);
            for (const lines of [first, retry]) {
                assert.ok(lines.join('').length > 0);
                assert.ok(Array.from(lines.join('')).every(key => allowed.has(key)),
                    `${preset} ${item.id} stays within introduced keys`);
            }
            assert.notDeepEqual(first, retry, 'mapped retries remain fresh');
        }
        assert.equal(JSON.stringify(CURRICULUM[track]), originals);
    }
    const profile = { version: 1, keys: { p: { ...weakProfile.keys.q } }, bigrams: {} };
    const before = JSON.stringify(profile);
    const weak = generateWeakDrill(profile, () => 0.999, preset);
    assert.deepEqual(new Set(weak.lines.join('').replaceAll(' ', '')), new Set([rest, 'p']),
        `${preset} upper-left index drills return to the mapped home key`);
    assert.equal(JSON.stringify(profile), before);
}
assert.equal(lessonsForLayout('amateur'), CURRICULUM.amateur);
assert.equal(lessonsForLayout('pro', 'invalid'), CURRICULUM.pro);
assert.deepEqual(lessonsForLayout('missing'), []);
for (const track of ['amateur', 'pro']) {
    const originals = JSON.stringify(CURRICULUM[track]);
    for (const [index, item] of lessonsForLayout(track, 'uk-iso').entries()) {
        const original = CURRICULUM[track][index];
        if (item.id !== 'pro-9') assert.equal(item, original);
        else {
            assert.deepEqual(item, {
                ...original,
                description: item.description,
                keysIntroduced: [...original.keysIntroduced, '#', '@', '|', '~']
            }, 'UK symbols preserve lesson identity, targets and existing keys');
            assert.match(item.description, /right pinky on the home row for #/);
            assert.match(item.description, /~ or @ with your right pinky and Left Shift/);
            assert.match(item.description, /left pinky for \\; add Right Shift for \|/);
            const first = generateLessonDrill(track, index, () => 0, 'uk-iso');
            const retry = generateLessonDrill(track, index, () => 0.999, 'uk-iso');
            assert.notDeepEqual(first, retry);
            for (const lines of [first, retry]) {
                const text = lines.join(' ');
                for (const key of '#@|~') assert.ok(text.includes(key));
                assert.match(text, /^[\x20-\x7e]+$/, 'UK lessons keep ASCII learning metrics');
            }
        }
    }
    assert.equal(JSON.stringify(CURRICULUM[track]), originals);
}
assert.equal(sessionLabel({ lessonId: 'amat-4' }), 'Inner Reach');
assert.equal(sessionLabel({ lessonId: 'amat-9' }), 'Bottom Row Right');
console.log(
    'Practice generation, layout curriculum, custom Unicode cleanup, exact speed samples, elapsed labels, typing feedback, and result coaching checks passed.'
);
