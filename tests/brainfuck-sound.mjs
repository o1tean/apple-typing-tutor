import assert from 'node:assert/strict';
import { BrainfuckProgram } from '../brainfuck/compiler.mjs';
import { createTokenArena } from '../brainfuck/runtime.mjs';
import { createNumbers } from '../brainfuck/numbers.mjs';
import { TokenCodec } from '../brainfuck/codec.js';
import { defineSound, SOUND_PROFILES } from '../brainfuck/sound.mjs';

const strings = ['settings', 'volume', 'soundMuted', 'soundProfile', 'voices', 'gain',
    'type', 'frequency', 'endFrequency', 'frequencyDuration', 'endGain', 'gainDuration',
    'duration', 'filter', 'q', 'delay', 'attack', 'triangle', 'sine', 'sawtooth',
    'bandpass', 'lowpass', 'magic', 'thock', 'bubble', 'clicky'];
const keys = Object.fromEntries(strings.map((value, index) => [value, index + 1]));
const b = new BrainfuckProgram({ scalarCapacity: 8192 });
const arena = createTokenArena(b, 16384);
const storage = { data: b.scalar('soundTest:data') };
const numbers = createNumbers(b, arena);
const sound = defineSound(b, arena, { storage, keys, numbers });
const operation = b.scalar('soundTest:operation');
const match = b.scalar('soundTest:match');
b.read(operation);
b.read(storage.data);
for (const [code, method] of [[1, sound.playKey], [2, sound.playError],
        [3, sound.playSuccess], [4, sound.preview], [5, sound.sync]]) {
    b.eq(match, operation, code);
    b.if(match, method);
}
let input = [0, 0];
let cursor = 0;
let packet = false;
let randomPacket = false;
let codec;
let random = 0x80000000;
const played = [];
const instance = new WebAssembly.Instance(new WebAssembly.Module(b.compile()), {
    env: {
        read: () => input[cursor++] ?? 0,
        write(value) {
            if (packet) {
                played.push(JSON.parse(JSON.stringify(codec.decode(value >>> 0))));
                packet = false;
            } else if (randomPacket) {
                assert.equal(value, 0,
                    'the random primitive consumes its required argument');
                input.push(random);
                randomPacket = false;
            } else if (value === 15) randomPacket = true;
            else {
                assert.equal(value, 18,
                    'Brainfuck emits the generic native audio primitive');
                packet = true;
            }
        }
    }
});
instance.exports.run();
codec = new TokenCodec(instance.exports.memory, arena.layout, strings);
const run = (operation, settings = {}) => {
    played.length = 0;
    input = [operation, codec.encode({
        settings: {
            soundProfile: 'magic',
            volume: 0.6,
            soundMuted: false,
            ...settings
        }
    })];
    cursor = 0;
    instance.exports.run();
    assert.equal(cursor, input.length, 'audio consumes its random and event input');
    assert.equal(packet, false);
    assert.equal(randomPacket, false);
    return played;
};

for (const [profile, specification] of Object.entries(SOUND_PROFILES)) {
    const result = run(1, { soundProfile: profile, volume: 0.25 });
    assert.equal(result.length, 1);
    assert.deepEqual(result[0], { gain: 0.25, voices: specification.voices },
        `${profile} preserves oscillator, envelope and native filter parameters`);
}
for (const [profile, range] of [['magic', 0.12], ['thock', 0.1]]) {
    for (const sample of [0, 0x40000000, 0xffffffff]) {
        random = sample;
        const result = run(1, { soundProfile: profile })[0];
        const jitter = 1 + (sample / 0x100000000 - 0.5) * range;
        assert.deepEqual(result.voices.map(voice => voice.frequency),
            SOUND_PROFILES[profile].voices.map(voice => voice.frequency * jitter),
            'pitch variation is computed on the Brainfuck tape');
    }
}
random = 0x80000000;
assert.deepEqual(run(1, { soundProfile: 'unknown' })[0].voices, SOUND_PROFILES.magic.voices,
    'unknown profiles fall back to the scissor sound');
assert.deepEqual(run(4, { soundProfile: 'bubble' })[0].voices, SOUND_PROFILES.bubble.voices,
    'settings preview uses the currently selected profile');
for (const operation of [1, 2, 3, 4]) {
    assert.deepEqual(run(operation, { soundMuted: true }), [], 'muting emits no voices');
    assert.deepEqual(run(operation, { volume: 0 }), [], 'zero volume emits no voices');
}
assert.deepEqual(run(5, { soundMuted: true }), [{ gain: 0, voices: [] }],
    'mute synchronizes the master gain even while a chime is playing');
assert.deepEqual(run(5, { volume: 0.35 }), [{ gain: 0.35, voices: [] }]);
assert.deepEqual(run(1, { volume: -1 }), [], 'volume clamps at zero');
assert.equal(run(1, { volume: 5 })[0].gain, 1, 'volume clamps at one');
for (const volume of [NaN, Infinity, -Infinity, null, 'loud']) {
    assert.equal(run(1, { volume })[0].gain, 0.6, 'nonfinite/non-numeric volume uses default');
}
const error = run(2)[0];
assert.equal(error.voices.length, 1);
assert.equal(error.voices[0].type, 'sawtooth');
assert.equal(error.voices[0].frequency, 160);
assert.equal(error.voices[0].endFrequency, 90);
assert.equal(error.voices[0].gainDuration, 0.12);
assert.equal(error.voices[0].duration, 0.13);
const success = run(3)[0];
assert.deepEqual(success.voices.map(voice => voice.frequency), [523.25, 659.25, 783.99, 1046.5]);
assert.deepEqual(success.voices.map(voice => voice.delay), [0, 0.08, 0.16, 0.24]);
assert.ok(success.voices.every(voice => voice.attack === 0.02 && voice.gainDuration === 0.8
    && voice.duration === 0.85));
console.log('Brainfuck sound: four profiles, pitch variation, mute/volume and chimes pass.');
