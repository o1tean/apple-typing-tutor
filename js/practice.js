import { CURRICULUM } from './lessons.js';

export function generateWords(count, options = {}, random = Math.random) {
    const pool = CURRICULUM.speedWords;
    let previous = -1;
    const words = Array.from({ length: count }, (_, index) => {
        // Pick from the other words directly instead of retrying a random draw.
        let choice = Math.floor(random() * (pool.length - (previous >= 0 ? 1 : 0)));
        if (previous >= 0 && choice >= previous) choice++;
        previous = choice;
        let word = options.numbers && index % 9 === 7
            ? String(Math.floor(random() * 1000)) : pool[choice];
        if (options.punctuation) {
            if (index % 8 === 0) word = word[0].toUpperCase() + word.slice(1);
            if (index % 8 === 7 || index === count - 1) word += '.';
            else if (index % 8 === 3) word += ',';
        }
        return word;
    });
    return words.join(' ');
}

export function normalizeCustomText(text) {
    return text.replace(/[\u00AD\u200B]/gu, '').normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export function recordSpeedSample(samples, stats, final = false) {
    const milliseconds = stats.elapsedMilliseconds;
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
    const previous = samples.at(-1);
    const second = Math.floor(milliseconds / 1000);
    if (!final && (second === 0 || second === Math.floor(
            (previous?.elapsedMilliseconds ?? 0) / 1000))) return;
    const sample = { elapsedMilliseconds: milliseconds, wpm: stats.wpm };
    if (final && previous?.elapsedMilliseconds === milliseconds)
        samples[samples.length - 1] = sample;
    else samples.push(sample);
}

export function formatElapsedTime(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '0s';
    const seconds = milliseconds / 1000;
    const rounded = Number(seconds.toFixed(seconds < 1 ? 3 : 2));
    return `${rounded || Number(seconds.toPrecision(3))}s`;
}

export function currentWord(characters, index) {
    let start = Math.min(index, characters.length - 1);
    if (characters[start]?.char === ' ') start--;
    while (start > 0 && characters[start - 1].char !== ' ') start--;
    let end = Math.max(0, start);
    while (end < characters.length && characters[end].char !== ' ') end++;
    return characters.slice(Math.max(0, start), end)
        .filter(item => !item.extra).map(item => item.char).join('');
}

export function typingErrorMessage(expected, typed, mode) {
    const key = character => character === ' ' ? 'Space' : `“${character}”`;
    if (expected === null) return typed === ' ' ? 'Word submitted with mistakes.'
        : `Extra character ${key(typed)}. Backspace to remove it.`;
    if (mode === 'flow' && typed === ' ')
        return `Skipped characters before Space; expected ${key(expected)}.`;
    return `Expected ${key(expected)}; typed ${key(typed)}. ${mode === 'strict'
        ? 'Try again.' : 'Backspace to correct it.'}`;
}

export function resultFeedback(result, exercise) {
    const repeat = ['test', 'quote'].includes(exercise.track) ? 'Repeat this text' : 'Try again';
    const retry = result.missedWords.length
        ? `Choose Practice missed words or ${repeat}.` : `Choose ${repeat}.`;
    const targetAccuracy = exercise.targetAccuracy || 95;
    if (result.correctNonSpaceChars <= 0) return {
        heading: 'Let’s try that again.',
        advice: result.skippedChars > 0 ? 'Type each word before pressing Space.'
            : `Follow the displayed text. ${retry}`
    };
    if (result.elapsedMilliseconds <= 0) return {
        heading: 'Too short to measure.',
        advice: 'Use a longer passage and try again.'
    };
    if (result.skippedChars > 0) return {
        heading: 'Finish each word.',
        advice: `Type every character before Space. ${retry}`
    };
    if (result.accuracy < targetAccuracy) return {
        heading: 'Accuracy comes first.',
        advice: `Aim for ${targetAccuracy}% accuracy. ${retry}`
    };
    if (['custom', 'retry'].includes(exercise.track) || exercise.options?.recordEligible === false)
        return { heading: 'Practice complete.', advice: retry };
    if (exercise.track === 'lesson') return result.wpm < exercise.targetWpm ? {
        heading: 'Accuracy target met.',
        advice: `Aim for ${exercise.targetWpm} WPM for 3 stars. Choose Try again.`
    } : {
        heading: 'Lesson target reached.',
        advice: 'Choose Try again to reinforce these keys.'
    };
    return {
        heading: 'Test complete.',
        advice: `${retry} You can also start a fresh passage.`
    };
}

export function sessionLabel(entry) {
    if (entry.lessonId === 'custom') return 'Custom text';
    if (entry.lessonId === 'missed-words') return 'Missed words';
    const quote = CURRICULUM.quotes.find(item => `quote-${item.id}` === entry.lessonId);
    if (quote) return `Quote · ${quote.author}`;
    if (/^quote-\d+$/.test(entry.lessonId)) return 'Quote · legacy selection';
    if (entry.lessonId.startsWith('quote-')) return 'Quote · practice';
    const lesson = [...CURRICULUM.amateur, ...CURRICULUM.pro]
        .find(item => item.id === entry.lessonId);
    if (lesson) return lesson.title.replace(/^Lesson \d+: /, '');
    const legacyTest = /^(time|words|speed)-(\d+)/.exec(entry.lessonId);
    const mode = entry.testMode || (legacyTest?.[1] === 'speed' ? 'time' : legacyTest?.[1]);
    if (!mode) return entry.lessonId.replaceAll('-', ' ');
    const count = mode === 'time' ? entry.testDuration : entry.testWordCount;
    return [
        `${count || legacyTest?.[2]} ${mode === 'time' ? 'seconds' : 'words'}`,
        entry.typingMode === 'strict' && 'guided',
        (entry.punctuation || entry.lessonId.includes('-punctuation')) && 'punctuation',
        (entry.numbers || entry.lessonId.includes('-numbers')) && 'numbers',
    ].filter(Boolean).join(' · ');
}
