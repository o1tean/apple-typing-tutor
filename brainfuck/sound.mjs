import { TYPE } from './runtime.mjs';

// Build-time oscillator descriptions from the original Web Audio synthesis.
export const SOUND_PROFILES = {
    magic: {
        jitter: 0.12,
        voices: [
            {
                type: 'triangle',
                frequency: 3200,
                endFrequency: 800,
                frequencyDuration: 0.018,
                gain: 0.45,
                endGain: 0.001,
                gainDuration: 0.022,
                duration: 0.025,
                filter: { type: 'bandpass', frequency: 3500, q: 3 }
            },
            {
                type: 'sine',
                frequency: 380,
                endFrequency: 90,
                frequencyDuration: 0.035,
                gain: 0.35,
                endGain: 0.001,
                gainDuration: 0.04,
                duration: 0.042
            }
    ]
    },
    thock: {
        jitter: 0.1,
        voices: [
            {
                type: 'triangle',
                frequency: 260,
                endFrequency: 60,
                frequencyDuration: 0.05,
                gain: 0.7,
                endGain: 0.001,
                gainDuration: 0.06,
                duration: 0.065,
                filter: { type: 'lowpass', frequency: 1400 }
            }
    ]
    },
    bubble: {
        voices: [
            {
                type: 'sine',
                frequency: 450,
                endFrequency: 900,
                frequencyDuration: 0.03,
                gain: 0.5,
                endGain: 0.001,
                gainDuration: 0.05,
                duration: 0.055
            }
    ]
    },
    clicky: {
        voices: [
            {
                type: 'sawtooth',
                frequency: 4800,
                endFrequency: 1200,
                frequencyDuration: 0.015,
                gain: 0.35,
                endGain: 0.001,
                gainDuration: 0.02,
                duration: 0.022
            }
    ]
    }
};
const ERROR = {
    voices: [
        {
            type: 'sawtooth',
            frequency: 160,
            endFrequency: 90,
            frequencyDuration: 0.1,
            gain: 0.35,
            endGain: 0.001,
            gainDuration: 0.12,
            duration: 0.13
        }
]
};
const SUCCESS = {
    voices: [523.25, 659.25, 783.99, 1046.5].map((frequency, index) => ({
        type: 'sine',
        frequency,
        delay: index * 0.08,
        attack: 0.02,
        gain: 0.25,
        endGain: 0.001,
        gainDuration: 0.8,
        duration: 0.85
    }))
};

/** Emit audio choices as Brainfuck; the browser only schedules the native voices. */
export function defineSound(b, arena, { storage, keys, numbers, stringValues = keys }) {
    const field = (out, parent, name) => arena.field(out, parent, keys[name]);
    const setNumber = (parent, name, value) => b._temps(1, node => {
        numbers.constant(node, value);
        arena.setField(parent, keys[name], node);
    });
    const setString = (parent, name, value) => b._temps(1, node => {
        arena.string(node, stringValues[value]);
        arena.setField(parent, keys[name], node);
    });
    const volume = (out, settings) => b._temps(6, (raw, type, flags, finite, ignored,
        comparison) => {
        field(raw, settings, 'volume');
        numbers.constant(out, 0.6);
        arena.get(type, 'type', raw);
        b.eq(type, type, TYPE.NUMBER);
        b.if(type, () => {
            arena.get(flags, 'numberFlags', raw);
            b.divmod(ignored, finite, flags, 2);
            b.if(finite, () => {
                arena.clone(out, raw);
                numbers.constant(ignored, 0);
                numbers.compare(comparison, out, ignored);
                b.eq(comparison, comparison, -1);
                b.if(comparison, () => arena.clone(out, ignored));
                numbers.constant(ignored, 1);
                numbers.compare(comparison, out, ignored);
                b.eq(comparison, comparison, 1);
                b.if(comparison, () => arena.clone(out, ignored));
            });
        });
        field(raw, settings, 'soundMuted');
        arena.get(type, 'type', raw);
        b.eq(type, type, TYPE.BOOL);
        b.if(type, () => {
            arena.get(flags, 'value', raw);
            b.if(flags, () => numbers.constant(out, 0));
        });
    });
    const emit = (profile, master) => b._temps(5, (payload, voices, voice,
        pitch, node) => {
        arena.object(payload);
        arena.array(voices);
        arena.setField(payload, keys.voices, voices);
        arena.clone(node, master);
        arena.setField(payload, keys.gain, node);
        if (profile.jitter) {
            b.write(15);
            b.write(0);
            b.read(pitch);
            arena.number(node, pitch);
            numbers.constant(pitch, 0x100000000);
            numbers.divide(pitch, node, pitch);
            numbers.constant(node, 0.5);
            numbers.subtract(pitch, pitch, node);
            numbers.constant(node, profile.jitter);
            numbers.multiply(pitch, pitch, node);
            numbers.constant(node, 1);
            numbers.add(pitch, node, pitch);
        }
        for (const specification of profile.voices) {
            arena.object(voice);
            for (const [name, value] of Object.entries(specification)) {
                if (name === 'filter') {
                    arena.object(node);
                    for (const [filterName, filterValue] of Object.entries(value)) {
                        if (typeof filterValue === 'number') setNumber(node, filterName,
                            filterValue);
                        else setString(node, filterName, filterValue);
                    }
                    arena.setField(voice, keys.filter, node);
                } else if (typeof value === 'string') setString(voice, name, value);
                else if (name === 'frequency' && profile.jitter) {
                    numbers.constant(node, value);
                    numbers.multiply(node, node, pitch);
                    arena.setField(voice, keys.frequency, node);
                } else setNumber(voice, name, value);
            }
            arena.append(voices, voice);
        }
        b.write(18);
        b.write(payload);
    });
    const play = body => b._temps(4, (settings, master, zero, enabled) => {
        field(settings, storage.data, 'settings');
        volume(master, settings);
        numbers.constant(zero, 0);
        numbers.compare(enabled, master, zero);
        b.eq(enabled, enabled, 1);
        b.if(enabled, () => body(settings, master));
    });
    const playKey = () => play((settings, master) => b._temps(3, (profile, selection,
        match) => {
        field(profile, settings, 'soundProfile');
        arena.get(profile, 'value', profile);
        b.set(selection, 0);
        const profiles = Object.entries(SOUND_PROFILES);
        profiles.forEach(([name], index) => {
            b.eq(match, profile, stringValues[name]);
            b.if(match, () => b.set(selection, index));
        });
        profiles.forEach(([, specification], index) => {
            b.eq(match, selection, index);
            b.if(match, () => emit(specification, master));
        });
    }));
    return {
        playKey,
        preview: playKey,
        playError: () => play((settings, master) => emit(ERROR, master)),
        playSuccess: () => play((settings, master) => emit(SUCCESS, master)),
        sync: () => b._temps(2, (settings, master) => {
            field(settings, storage.data, 'settings');
            volume(master, settings);
            emit({ voices: [] }, master);
        })
    };
}
