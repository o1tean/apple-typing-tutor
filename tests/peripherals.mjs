import assert from 'node:assert/strict';
import { sound } from '../js/audio.js';
import { KeyboardView } from '../js/keyboard.js';
import { CURRICULUM } from '../js/lessons.js';
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
