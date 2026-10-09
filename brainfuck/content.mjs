import { CURRICULUM } from '../js/lessons.js';
import { readFileSync } from 'node:fs';
import { KEYBOARD_PRESETS, keyboardLayout, isoEnterOutline } from '../js/keyboard.js';
import { lessonsForLayout } from '../js/practice.js';

export const tracks = [
    { id: 'amateur', label: 'Foundations' },
    { id: 'pro', label: 'Advanced' }
];
export const fingers = ['pinky', 'ring', 'middle', 'index', 'thumb'];
export const words = CURRICULUM.speedWords;
export const quotes = CURRICULUM.quotes;
export const weakPools = Object.fromEntries(Array.from('abcdefghijklmnopqrstuvwxyz', key =>
    [key, words.filter(word => word.length <= 8 && Array.from(word)
        .filter(char => char === key).length >= Math.max(2, (word.length + 1) / 3))]));
export const sessionLabels = Object.fromEntries([
    ...[...CURRICULUM.amateur, ...CURRICULUM.pro].map(lesson => [lesson.id,
        lesson.title.replace(/^Lesson \d+: /, '').replace(/ \([^)]*\)$/, '')]),
    ...quotes.map(quote => [`quote-${quote.id}`, `Quote · ${quote.author}`])
]);
export const settings = {
    theme: ['dark', 'light', 'system'],
    colorPalette: ['mint', 'ocean', 'plum'],
    keyboardLayout: Object.keys(KEYBOARD_PRESETS),
    soundProfile: ['magic', 'thock', 'bubble', 'clicky'],
    typingMode: ['strict', 'flow'],
    testMode: ['time', 'words'],
    testDuration: [15, 30, 60, 120],
    testWordCount: [10, 25, 50, 100]
};

const tokens = Object.fromEntries(Array.from(readFileSync(new URL('../css/main.css',
    import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]+)\}/g),
    ([, selector, body]) =>
    [selector.trim(), Object.fromEntries(Array.from(body.matchAll(/--([a-z-]+):\s*([^;]+);/g),
        ([, name, value]) => [name, value.trim()]))]));
export const palettes = Object.fromEntries(settings.colorPalette.map(palette =>
    [palette, Object.fromEntries(['dark', 'light'].map(theme => [theme, {
        ...tokens[':root'],
        ...(theme === 'light' ? tokens["[data-theme='light']"] : {}),
        ...tokens[`[data-palette='${palette}']`],
        ...(theme === 'light' ? tokens[`[data-palette='${palette}'][data-theme='light']`] : {})
    }]))]));

function lessons(track, preset, layout) {
    const source = lessonsForLayout(track, preset);
    return source.map((lesson, index) => {
        const ownHand = track === 'amateur' ? index <= 2 : index <= 1;
        const taught = ownHand ? [lesson] : source.slice(track === 'amateur' ? 1 : 0,
            index + 1);
        const allowed = new Set([' ', ...taught.flatMap(item => item.keysIntroduced)]);
        const current = lesson.keysIntroduced.filter(key => key !== ' ');
        const focus = current.length ? current : [' '];
        const home = Array.from(layout.homeKeys);
        return {
            ...lesson,
            index,
            track,
            number: lesson.id === 'amat-intro' ? '—' : String(index +
                Number(track === 'pro')).padStart(2, '0'),
            shortTitle: lesson.title.replace(/^Lesson \d+: /, ''),
            focus,
            allowed: [...allowed],
            context: [...allowed].filter(key => key !== ' '),
            pools: focus.map(key => words.map(word => /[A-Z]/.test(key) ?
                word.toUpperCase() : word).filter(word => word.length <= 8 &&
                Array.from(word).every(char => allowed.has(char)) &&
                Array.from(word).filter(char => char === key).length >=
                Math.max(2, (word.length + 1) / 3))),
            neighbors: focus.map(key => {
                const finger = layout.fingerMap[key];
                const rest = home.find(char => allowed.has(char) && char !== key &&
                    layout.fingerMap[char]?.hand === finger?.hand &&
                    layout.fingerMap[char]?.finger === finger?.finger);
                const nearby = home.filter(char => allowed.has(char) && char !== key &&
                    layout.fingerMap[char]?.hand === finger?.hand);
                return rest ? [rest] : nearby.length ? nearby :
                    [...allowed].filter(char => char !== ' ');
            })
        };
    });
}

function positions(rows) {
    const result = {};
    Object.values(rows).forEach((row, index) => {
        const width = row.reduce((sum, key) => sum + key.width, 0);
        let offset = 0;
        const unit = (1048 - 8 * (row.length - 1)) / width;
        let cardX = 76;
        for (const key of row) {
            if (key.code) result[key.code] = {
                row: index,
                x: (offset + key.width / 2) / width,
                card: {
                    x: cardX,
                    y: 446 + index * 50,
                    width: unit * key.width,
                    height: key.isoStem ? 92 : 42,
                    outline: key.isoStem ? isoEnterOutline(key.isoStem) : null
                }
            };
            offset += key.width;
            cardX += unit * key.width + 8;
        }
    });
    return result;
}

function guidance(layout, positions) {
    return Object.fromEntries(Object.entries(layout.charToCode).map(([char, code]) => {
        const info = layout.fingerMap[char];
        const reaches = [];
        const hands = info?.finger === 'thumb' ? ['left', 'right'] : [info?.hand];
        if (info) {
            for (const hand of hands) {
                const home = info.finger === 'thumb' ? positions.Space : positions[
                    layout.charToCode[layout.homeKeys[hand === 'left' ?
                        fingers.indexOf(info.finger) : 7 - fingers.indexOf(info.finger)]]];
                const target = positions[code];
                reaches.push({
                    hand,
                    finger: info.finger,
                    row: info.finger === 'thumb' ? 'space' :
                        ['number', 'upper', 'home', 'lower'][target.row],
                    angle: info.finger === 'thumb' ? '12deg' :
                        `${Math.max(-30, Math.min(30, (target.x - home.x) * 160 *
                            (hand === 'left' ? 1 : -1)))}deg`,
                    scale: String(info.finger === 'thumb' ? 0.9 :
                        [1.38, 1.24, 0.94, 0.8][target.row]),
                    target: char,
                    tag: char === ' ' ? '␣' : char,
                    shift: false
                });
            }
        }
        const shiftCode = info?.shift ? info.hand === 'left' ? 'ShiftRight' :
            'ShiftLeft' : '';
        if (shiftCode) reaches.push({
            hand: info.hand === 'left' ? 'right' : 'left',
            finger: 'pinky',
            row: 'shift',
            angle: '-28deg',
            scale: '0.76',
            target: 'Shift',
            tag: '⇧',
            shift: true
        });
        const row = reaches[0]?.row;
        const reach = row === 'space' ? 'press Space' : row === 'home' ?
            ['KeyG', 'KeyH'].includes(code) ? 'reach inward' : 'home row' :
            `reach ${row} row`;
        return [char, {
            code,
            finger: info?.finger || '',
            shiftCode,
            reaches,
            hint: info ? `${info.finger === 'thumb' ? 'Either thumb' : info.label} · ` +
                `${char === ' ' ? 'Space' : `"${char}"`} · ${reach}` +
                (shiftCode ? ` (+ ${info.hand === 'left' ? 'Right' : 'Left'} Shift)` : '') :
                `Type “${char}”`
        }];
    }));
}

export const layouts = Object.entries(KEYBOARD_PRESETS).map(([id, label]) => {
    const layout = keyboardLayout(id);
    const keyPositions = positions(layout.rows);
    const home = layout.homeKeys.toUpperCase();
    return {
        id,
        label,
        ...layout,
        positions: keyPositions,
        guidance: guidance(layout, keyPositions),
        restHint: `Rest your fingers on ${Array.from(home.slice(0, 4)).join(' ')} and ` +
            Array.from(home.slice(4)).join(' '),
        demoSteps: Array.from('f r f j u j F J ', key => layout.fromQwerty[key]),
        lessons: Object.fromEntries(tracks.map(track => [track.id,
            lessons(track.id, id, layout)]))
    };
});

export const content = { tracks, fingers, words, quotes, weakPools, sessionLabels,
    settings, palettes, layouts };

let selection = 0;

export function emitContent(builder, values, selected) {
    const match = builder.scalar(`contentMatch${selection++}`);
    values.forEach((value, index) => {
        builder.eq(match, selected, index);
        builder.if(match, () => builder.writeString(value));
    });
}
