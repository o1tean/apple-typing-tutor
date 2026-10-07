import { CURRICULUM } from './lessons.js';
import { migrateLearning } from './learning.js';
import { keyboardLayout } from './keyboard.js';

export function lessonsForLayout(track, preset = 'mac-us') {
    const lessons = ['amateur', 'pro'].includes(track) ? CURRICULUM[track] : [];
    if (preset === 'uk-iso') return lessons.map(lesson => lesson.id !== 'pro-9' ? lesson : {
        ...lesson,
        description: 'UK ISO: use your right pinky on the home row for #. '
            + 'Type ~ or @ with your right pinky and Left Shift. '
            + 'Reach down with your left pinky for \\; add Right Shift for |.',
        keysIntroduced: [...lesson.keysIntroduced, '#', '@', '|', '~']
    });
    if (!['colemak', 'dvorak'].includes(preset)) return lessons;
    const layout = keyboardLayout(preset);
    const home = Array.from(layout.homeKeys, key => key.toUpperCase());
    const rest = `Rest your fingers on ${home.slice(0, 4).join(' ')} and `
        + `${home.slice(4).join(' ')}; feel the bumps on ${home[3]} and ${home[4]}.`;
    return lessons.map((lesson, index) => {
        if (index > (track === 'amateur' ? 9 : 4)) return lesson;
        const keysIntroduced = lesson.keysIntroduced.map(key => layout.fromQwerty[key]);
        const keys = keysIntroduced.filter(key => key !== ' ');
        const names = keys.map(key => key.toUpperCase()).join(', ');
        const instructions = keys.map(key => `${key.toUpperCase()} with ${layout.fingerMap[key]
            .label}`).join(', ');
        return {
            ...lesson,
            title: lesson.title.replace(/\([^)]*\)/, `(${names})`),
            subtitle: `Keys: ${keys.map(key => key.toUpperCase()).join(' ')}`,
            description: (lesson.id === 'amat-intro' ? '' : `Use ${instructions}. `) + rest
                + (keysIntroduced.includes(' ') ? ' Press Space with either thumb.' : ''),
            keysIntroduced
        };
    });
}

export function focusKeys(profile, limit = 3) {
    if (profile?.version !== 1) return [];
    const cells = Object.entries(migrateLearning(profile).keys).filter(([, cell]) => cell.attempts >
        0);
    const slowest = Math.max(1, ...cells.filter(([, cell]) => cell.latencySamples > 0)
        .map(([, cell]) => cell.recentLatencyMs));
    const ranked = cells.map(([key, cell]) => ({
        key,
        score: 2 * cell.recentErrorRate + (cell.latencySamples > 0 ? cell
            .recentLatencyMs / slowest : 0)
    })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.key.localeCompare(b
        .key));
    return ranked.filter(item => item.score >= (ranked[0]?.score || 0) * 0.6)
        .slice(0, Math.max(0, limit)).map(item => item.key);
}

function drillLines(focus, allowed, random, layout) {
    if (!focus.length) return [];
    const columns = Math.max(8, Math.ceil(focus.length / 4));
    const choose = items => items[Math.floor(random() * items.length)];
    const context = Array.from(allowed).filter(key => key !== ' ');
    if (!context.length) return [];
    if (focus.includes(' ')) {
        const letters = focus.filter(key => key !== ' ');
        return Array.from({ length: 4 }, () => Array.from({ length: columns }, () =>
            choose(letters.length ? letters : context)).join(' '));
    }
    const home = Array.from(layout.homeKeys);
    const pools = focus.map(key => CURRICULUM.speedWords.map(word => /[A-Z]/.test(key)
        ? word.toUpperCase() : word).filter(word => word.length <= 8 &&
        Array.from(word).every(char => allowed.has(char)) &&
        Array.from(word).filter(char => char === key).length >= Math.max(2, (word.length +
            1) / 3)));
    const offset = Math.floor(random() * focus.length);
    return Array.from({ length: 4 }, (_, line) => Array.from({ length: columns }, (_, column) => {
        const index = (offset + line * columns + column) % focus.length;
        const key = focus[index];
        if (pools[index].length && random() < 0.5) return choose(pools[index]);
        const finger = layout.fingerMap[key];
        const rest = home.find(char => allowed.has(char) && char !== key &&
            layout.fingerMap[char]?.hand === finger?.hand && layout.fingerMap[char]
            ?.finger ===
            finger?.finger);
        const nearby = home.filter(char => allowed.has(char) && char !== key &&
            layout.fingerMap[char]?.hand === finger?.hand);
        const other = rest || choose(nearby.length ? nearby : context);
        // Two focused characters per four-character reach survive the separating Space.
        return choose([key + other + key + other, key + other + other + key,
            other + key + other + key]);
    }).join(' '));
}

export function generateWeakDrill(profile, random = Math.random, preset = 'mac-us') {
    const keys = focusKeys(profile);
    return {
        lines: drillLines(keys, new Set([...Array.from('abcdefghijklmnopqrstuvwxyz'), ...keys]),
            random, keyboardLayout(preset)),
        focusKeys: keys
    };
}

export function generateLessonDrill(track, index, random = Math.random, preset = 'mac-us') {
    const lessons = lessonsForLayout(track, preset);
    const lesson = lessons?.[index];
    if (!lesson || !Number.isInteger(index)) return [];
    const ownHand = track === 'amateur' ? index <= 2 : index <= 1;
    const taught = ownHand ? [lesson] : lessons.slice(track === 'amateur' ? 1 : 0, index + 1);
    const allowed = new Set([' ', ...taught.flatMap(item => item.keysIntroduced)]);
    const current = lesson.keysIntroduced.filter(key => key !== ' ');
    return drillLines(current.length ? current : [' '], allowed, random, keyboardLayout(preset));
}

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
    if (lesson) return lesson.title.replace(/^Lesson \d+: /, '').replace(/ \([^)]*\)$/, '');
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
