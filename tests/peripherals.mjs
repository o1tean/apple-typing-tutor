import assert from 'node:assert/strict';
import { sound } from '../js/audio.js';
import {
    KEYBOARD_LAYOUT,
    KEYBOARD_PRESETS,
    KeyboardView,
    keyboardLayout,
    keyMeasurements,
    isoEnterOutline
} from '../js/keyboard.js';
import { CURRICULUM } from '../js/lessons.js';
import { TypingEngine } from '../js/engine.js';
import { readSessionLearning } from '../js/learning.js';
import { isDialogBackdrop } from '../js/dialog.js';
import { generateLessonDrill } from '../js/practice.js';

const dialog = {
    getBoundingClientRect: () => ({ left: 103, top: 24, right: 643, bottom: 780 })
};
for (const [clientX, clientY] of [[113, 84], [103, 84], [643, 84], [113, 24], [113, 780],
    [103, 24], [643, 780]]) {
    assert.equal(isDialogBackdrop({ target: dialog, currentTarget: dialog, clientX, clientY }),
        false, 'dialog padding and border edges stay open');
}
for (const [clientX, clientY] of [[102, 84], [644, 84], [113, 23], [113, 781]]) {
    assert.equal(isDialogBackdrop({ target: dialog, currentTarget: dialog, clientX, clientY }),
        true, 'a click outside each dialog side is a backdrop click');
}
assert.equal(isDialogBackdrop({
    target: {},
    currentTarget: {
        getBoundingClientRect: () => {
            throw new Error(
                'child has no backdrop');
        }
    },
    clientX: 0,
    clientY: 0
}), false, 'dialog child clicks never count as backdrop clicks');

for (const [input, expected] of [[-1, 0], [2, 1], [NaN, 0.6], [Infinity, 0.6], ['bad', 0.6]]) {
    sound.setVolume(input);
    assert.equal(sound.volume, expected, 'audio volume stays finite and within range');
}

globalThis.window = {};
sound.ensureContext();
assert.equal(sound.ctx, null, 'unsupported audio is harmless');
let contextsCreated = 0;
const parameter = () => ({
    values: [],
    setValueAtTime(value, time) { this.values.push({ value, time }); },
    linearRampToValueAtTime(value, time) { this.values.push({ value, time }); },
    exponentialRampToValueAtTime(value, time) { this.values.push({ value, time }); }
});
const audioNode = () => ({
    gain: parameter(),
    frequency: parameter(),
    Q: parameter(),
    connections: [],
    connect(target) { this.connections.push(target); },
    start() {},
    stop(time) { this.stopTime = time; }
});
window.AudioContext = class {
    constructor() {
        contextsCreated++;
        this.state = 'running';
        this.currentTime = 0;
        this.destination = {};
        this.gains = [];
        this.voices = [];
    }
    createGain() {
        const node = audioNode();
        this.gains.push(node);
        return node;
    }
    createOscillator() {
        const node = audioNode();
        this.voices.push(node);
        return node;
    }
    createBiquadFilter() { return audioNode(); }
};
sound.ensureContext();
const previousOutput = sound.masterGain;
sound.ctx.state = 'closed';
sound.ensureContext();
assert.equal(contextsCreated, 2, 'a closed audio context is replaced');
assert.notEqual(sound.masterGain, previousOutput, 'the output belongs to the new context');
const output = sound.masterGain;
sound.playSuccess();
assert.equal(sound.ctx.voices.length, 4);
assert.ok(sound.ctx.gains.slice(1).every(gain => gain.connections.includes(output)),
    'all scheduled completion voices pass through the same output');
sound.ctx.currentTime = 0.3;
assert.ok(sound.ctx.voices.every(voice => voice.stopTime > sound.ctx.currentTime));
sound.setMuted(true);
assert.deepEqual(output.gain.values.at(-1), { value: 0, time: 0.3 },
    'mute silences the output while the scheduled chime is still playing');
sound.setVolume(0.25);
assert.equal(output.gain.values.at(-1).value, 0, 'volume adjustments preserve mute');
sound.setMuted(false);
assert.equal(output.gain.values.at(-1).value, 0.25, 'unmute uses the current output volume');
const firstEnvelope = sound.ctx.gains[1].gain.values.map(entry => entry.value);
const nextVoiceGain = sound.ctx.gains.length;
sound.playSuccess();
assert.deepEqual(sound.ctx.gains[nextVoiceGain].gain.values.map(entry => entry.value),
    firstEnvelope,
    'voice envelopes remain fixed when the master volume changes');
sound.setVolume(0);
assert.equal(output.gain.values.at(-1).value, 0, 'zero volume silences ongoing voices');
sound.setVolume(0.6);
for (const profile of ['magic', 'thock', 'bubble', 'clicky']) {
    sound.setProfile(profile);
    sound.playKey();
}
sound.playError();
assert.deepEqual(sound.ctx.gains.filter(gain => gain.connections.includes(sound.ctx.destination)),
    [output], 'key and error profiles share the controllable output');
delete globalThis.window;

const originalKeyboard = JSON.stringify(KEYBOARD_LAYOUT);
const printable = Array.from({ length: 95 }, (_, index) => String.fromCharCode(index + 32));
for (const [preset, home] of [['mac-us', 'asdfjkl;'], ['colemak', 'arstneio'],
    ['dvorak', 'aoeuhtns'], ['uk-iso', 'asdfjkl;']]) {
    const layout = keyboardLayout(preset);
    assert.equal(layout.homeKeys, home, `${preset}: physical home positions`);
    assert.deepEqual(Object.keys(layout.charToCode).sort(),
        [...printable, ...(preset === 'uk-iso' ? ['£', '¬'] : [])].sort(),
        `${preset}: every printable ASCII target has guidance`);
    assert.deepEqual(Object.keys(layout.fromQwerty).sort(), [...printable].sort(),
        `${preset}: translated drills include shifted punctuation`);
    assert.equal(new Set(Object.values(layout.fromQwerty)).size, 95,
        `${preset}: translation has no duplicate or lost characters`);
    const keys = Object.values(layout.rows).flat().filter(key => key.code);
    assert.equal(new Set(keys.map(key => key.code)).size, keys.length,
        `${preset}: each physical key renders exactly once`);
    assert.deepEqual(keys.filter(key => key.bump).map(key => key.code), ['KeyF', 'KeyJ']);
    assert.equal(keys.find(key => key.code === 'CapsLock').label, 'caps lock');
    assert.equal(keys.find(key => key.code === 'MetaLeft').label,
        preset === 'uk-iso' ? 'win' : 'command');
    assert.equal(keys.find(key => key.code === 'AltLeft').label,
        preset === 'uk-iso' ? 'alt' : 'option');
}
assert.deepEqual(Object.keys(KEYBOARD_PRESETS), ['mac-us', 'colemak', 'dvorak', 'uk-iso']);
assert.deepEqual(keyboardLayout('unknown'), keyboardLayout(), 'unknown layouts use Mac US');
assert.equal(keyboardLayout('colemak').fromQwerty[':'], 'O');
assert.equal(keyboardLayout('dvorak').fromQwerty.Q, '"');
assert.equal(keyboardLayout('dvorak').fromQwerty['?'], 'Z');
const iso = keyboardLayout('uk-iso');
assert.deepEqual(iso.rows.row5.map(key => key.code), ['ControlLeft', 'MetaLeft', 'AltLeft',
    'Space', 'AltRight', 'MetaRight', 'ContextMenu', 'ControlRight']);
assert.equal(iso.rows.row5.find(key => key.code === 'AltRight').label, 'alt gr');
assert.equal(iso.rows.row2.at(-1).code, 'Enter');
assert.equal(iso.rows.row2.at(-1).width, 1);
assert.equal(iso.rows.row2.at(-1).isoStem, 0.75);
assert.equal(iso.rows.row3.at(-2).code, 'Backslash');
assert.deepEqual(iso.rows.row3.at(-1), { width: 0.75 }, 'the Enter foot reserves a non-key space');
assert.equal(iso.rows.row4[0].width, 1.25);
assert.equal(iso.rows.row4[1].code, 'IntlBackslash');
assert.deepEqual(Object.values(iso.rows).map(row => row.reduce((sum, key) => sum + key.width, 0)),
    [14.5, 14.5, 14.5, 14.5, 14.5], 'ISO rows retain physical alignment');
assert.deepEqual(isoEnterOutline(iso.rows.row2.at(-1).isoStem),
    [[0, 0], [1, 0], [1, 1], [0.25, 1], [0.25, 0.5], [0, 0.5]],
    'HTML and PNG share one L outline with a lower-left cutout');
for (const [code, label, shiftLabel] of [['Digit2', '2', '"'], ['Digit3', '3', '£'],
    ['Backquote', '`', '¬'], ['Quote', "'", '@'], ['Backslash', '#', '~'],
    ['IntlBackslash', '\\', '|']]) {
    const key = Object.values(iso.rows).flat().find(key => key.code === code);
    assert.equal(key.label, label, `${code}: UK unshifted output`);
    assert.equal(key.shiftLabel, shiftLabel, `${code}: UK shifted output`);
}
const ukEngine = new TypingEngine();
ukEngine.loadExercise(['£¬#']);
for (const key of '£¬#') ukEngine.handleKey({ key, code: iso.charToCode[key] });
assert.equal(ukEngine.isComplete, true, 'UK non-ASCII symbols can be typed and scored');
const ukLearning = ukEngine.getStats().learning;
assert.deepEqual(Object.keys(ukLearning.keys), ['#'], 'learning remains limited to ASCII targets');
assert.deepEqual(Object.keys(readSessionLearning({
        ...ukLearning,
        keys: {
            ...ukLearning.keys,
            '£': ukLearning.keys['#'],
            '¬': ukLearning.keys[
                '#']
        }
    }).keys), ['#'],
    'the existing persisted learning format still excludes non-ASCII observations');
ukEngine.reset();
keyboardLayout('colemak').rows.row3[4].label = 'changed';
assert.equal(JSON.stringify(KEYBOARD_LAYOUT), originalKeyboard, 'derived rows preserve the base');
const observations = {
    keys: {
        t: { attempts: 3, errors: 1, latencySamples: 2, latencyTotalMs: 140 },
        T: { attempts: 2, errors: 0, latencySamples: 1, latencyTotalMs: 90 },
        'é': { attempts: 1, errors: 0, latencySamples: 0, latencyTotalMs: 0 }
    }
};
const observedBefore = JSON.stringify(observations);
assert.deepEqual(keyMeasurements(observations, 'colemak').get('KeyF'), {
        attempts: 5,
        errors: 1,
        latencySamples: 3,
        latencyTotalMs: 230
    },
    'session measurements combine case at the selected layout’s physical key');
assert.equal(keyMeasurements(observations, 'colemak').size, 1);
assert.equal(keyMeasurements(observations).has('KeyT'), true, 'legacy defaults remain US');
assert.equal(JSON.stringify(observations), observedBefore,
    'heatmap aggregation preserves observations');

// Guidance must stay inside its own container, including shifted keys and Space.
const element = (homeKey = '') => {
    const classes = new Set();
    const styles = new Map();
    const tag = { textContent: homeKey };
    return {
        dataset: { homeKey },
        style: {
            setProperty: (name, value) => styles.set(name, String(value)),
            removeProperty: name => styles.delete(name)
        },
        querySelector: selector => selector === '.finger-tag' ? tag : null,
        classList: {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name))
        },
        classes,
        styles,
        tag
    };
};
const finger = element('A');
const key = element();
const shift = element();
const thumb = element('␣');
const leftThumb = element('␣');
const shiftFinger = element(';');
const hint = { textContent: '' };
const view = Object.create(KeyboardView.prototype);
view.layout = keyboardLayout();
view.restHint = 'Rest your fingers on A S D F and J K L ;';
view.container = { querySelectorAll: () => [key, shift] };
view.handsContainer = {
    querySelectorAll: () => [finger, thumb, leftThumb, shiftFinger],
    querySelector: selector => ({
        '#finger-left-pinky': finger,
        '#finger-right-thumb': thumb,
        '#finger-left-thumb': leftThumb,
        '#finger-right-pinky': shiftFinger
    })[selector]
};
view.fingerHint = hint;
view.keyElements = new Map([['KeyA', key], ['ShiftRight', shift], ['Space', element()]]);
view.keyPositions = new Map([
    ['KeyA', { row: 2, x: 0.2 }],
    ['Semicolon', { row: 2, x: 0.8 }],
    ['ShiftRight', { row: 3, x: 0.92 }],
    ['Space', { row: 4, x: 0.5 }]
]);
view.highlightTarget('A');
assert.ok(finger.classes.has('active'));
assert.ok(shift.classes.has('key-shift-target'));
assert.ok(shiftFinger.classes.has('shift-active'), 'the opposite pinky holds Shift');
assert.equal(finger.dataset.reachRow, 'home');
assert.equal(shiftFinger.dataset.reachRow, 'shift');
assert.equal(shiftFinger.tag.textContent, '⇧', 'the reaching pinky labels Shift');
assert.ok(shiftFinger.styles.has('--reach-angle'), 'the Shift cue includes a finger reach');
assert.equal(hint.textContent, 'Left Pinky · "A" · home row (+ Right Shift)');
view.highlightTarget(' ');
assert.ok(thumb.classes.has('active'));
assert.ok(leftThumb.classes.has('active'), 'either thumb can press Space');
assert.ok(!shiftFinger.classes.has('shift-active'), 'Space clears the previous Shift cue');
assert.equal(thumb.dataset.reachRow, 'space');
assert.equal(finger.styles.size, 0, 'the previous finger returns to its home pose');
assert.equal(shiftFinger.tag.textContent, ';', 'the previous Shift finger restores its home key');
assert.equal(hint.textContent, 'Either thumb · Space · press Space');
view.highlightTarget(null);
assert.ok(!thumb.classes.has('active'), 'completion clears finger highlights');
assert.ok(!key.classes.has('key-target'), 'completion clears the target key');
for (const item of [finger, thumb, leftThumb, shiftFinger]) {
    assert.equal(item.styles.size, 0, 'completion restores every home pose');
    assert.equal(item.dataset.targetKey, undefined, 'completion clears target labels');
    assert.equal(item.tag.textContent, item.dataset.homeKey);
}
view.pressKey('KeyA');
view.pressKey('ShiftRight');
view.clearPressedKeys();
assert.ok(!key.classes.has('key-pressed') && !shift.classes.has('key-pressed'),
    'focus loss or restart can clear keys whose keyup event was missed');

for (const [preset, char, code, hand, name, row, shifted] of [
    ['mac-us', 'F', 'KeyF', 'left', 'index', 'home', true],
    ['colemak', 't', 'KeyF', 'left', 'index', 'home', false],
    ['colemak', 'N', 'KeyJ', 'right', 'index', 'home', true],
    ['colemak', 'f', 'KeyE', 'left', 'middle', 'upper', false],
    ['colemak', 'd', 'KeyG', 'left', 'index', 'home', false],
    ['colemak', ':', 'KeyP', 'right', 'pinky', 'upper', true],
    ['dvorak', 'u', 'KeyF', 'left', 'index', 'home', false],
    ['dvorak', 'i', 'KeyG', 'left', 'index', 'home', false],
    ['dvorak', 'd', 'KeyH', 'right', 'index', 'home', false],
    ['dvorak', '"', 'KeyQ', 'left', 'pinky', 'upper', true],
    ['dvorak', '<', 'KeyW', 'left', 'ring', 'upper', true],
    ['dvorak', '{', 'Minus', 'right', 'pinky', 'number', true],
    ['dvorak', ':', 'KeyZ', 'left', 'pinky', 'lower', true],
    ['dvorak', 'Z', 'Slash', 'right', 'pinky', 'lower', true],
    ['uk-iso', '\\', 'IntlBackslash', 'left', 'pinky', 'lower', false],
    ['uk-iso', '|', 'IntlBackslash', 'left', 'pinky', 'lower', true],
    ['uk-iso', '#', 'Backslash', 'right', 'pinky', 'home', false],
    ['uk-iso', '~', 'Backslash', 'right', 'pinky', 'home', true],
    ['uk-iso', '@', 'Quote', 'right', 'pinky', 'home', true],
    ['uk-iso', '"', 'Digit2', 'left', 'ring', 'number', true],
    ['uk-iso', '£', 'Digit3', 'left', 'middle', 'number', true],
    ['uk-iso', '¬', 'Backquote', 'left', 'pinky', 'number', true]
]) {
    const layout = keyboardLayout(preset);
    const fingers = new Map();
    for (const [side, homes] of [['left', layout.homeKeys.slice(0, 4)],
        ['right', Array.from(layout.homeKeys.slice(4)).reverse().join('')]]) {
        ['pinky', 'ring', 'middle', 'index', 'thumb'].forEach((fingerName, index) =>
            fingers.set(`#finger-${side}-${fingerName}`, element(homes[index]?.toUpperCase() ||
                '␣')));
    }
    const guide = Object.create(KeyboardView.prototype);
    guide.layout = layout;
    guide.keyElements = new Map(Object.values(layout.rows).flat().filter(key => key.code).map(
        key => [key.code,
element()]));
    guide.keyPositions = new Map(Object.values(layout.rows).flatMap((keys, index) =>
        keys.map((key, column) => [key.code, { row: index, x: column / keys.length }])));
    guide.container = { querySelectorAll: () => [...guide.keyElements.values()] };
    guide.handsContainer = {
        querySelectorAll: () => [...fingers.values()],
        querySelector: selector => fingers.get(selector)
    };
    guide.fingerHint = { textContent: '' };
    guide.highlightTarget(char);
    const target = fingers.get(`#finger-${hand}-${name}`);
    assert.ok(guide.keyElements.get(code).classes.has('key-target'), `${preset} ${char}: code`);
    assert.ok(target.classes.has('active'), `${preset} ${char}: finger`);
    assert.equal(target.dataset.reachRow, row, `${preset} ${char}: reach row`);
    const opposite = hand === 'left' ? 'Right' : 'Left';
    assert.equal(guide.keyElements.get(`Shift${opposite}`).classes.has('key-shift-target'), shifted,
        `${preset} ${char}: opposite-hand Shift`);
    assert.equal(guide.fingerHint.textContent.includes('reach inward'), ['KeyG', 'KeyH'].includes(
            code),
        `${preset} ${char}: inward cue follows position, not the letters G/H`);
    guide.renderHands();
    assert.ok(guide.handsContainer.innerHTML.includes(`index ${layout.homeKeys[3].toUpperCase()}`),
        `${preset}: hand descriptions name the actual home key`);
}

for (const track of ['amateur', 'pro']) {
    const introduced = new Set([' ']);
    for (const [index, lesson] of CURRICULUM[track].entries()) {
        const newKeys = lesson.keysIntroduced.filter(char => char.length === 1 && !introduced.has(
            char));
        newKeys.forEach(char => introduced.add(char));
        if (lesson.keysIntroduced.includes('Capitals')) {
            [...introduced].forEach(char => introduced.add(char.toUpperCase()));
        }
        const characters = new Set(generateLessonDrill(track, index, () => 0.25).join(' '));
        assert.ok([...characters].every(char => introduced.has(char)),
            `${lesson.id}: only introduced keys`);
        assert.ok(newKeys.every(char => characters.has(char)),
            `${lesson.id}: each new key is practiced`);
        if (['amat-intro', 'amat-1', 'amat-2', 'pro-1', 'pro-2'].includes(lesson.id)) {
            const handKeys = new Set([' ', ...lesson.keysIntroduced]);
            assert.ok([...characters].every(char => handKeys.has(char)),
                `${lesson.id}: home-hand drills stay inside their own introduced keys`);
        }
    }
}

console.log(
    'Peripheral checks passed: dialog bounds, safe volume, audio context recovery, scoped keyboard guidance and home-row drills.'
);
