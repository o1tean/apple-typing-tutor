export const STORAGE_KEY = 'apple_typing_tutor_data_v1';

export const DEFAULT_SETTINGS = {
    theme: 'dark',
    colorPalette: 'mint',
    keyboardLayout: 'mac-us',
    soundProfile: 'magic',
    volume: 0.6,
    soundMuted: false,
    typingMode: 'flow',
    showHands: false,
    showKeyboard: false,
    testMode: 'time',
    testDuration: 30,
    testWordCount: 25,
    punctuation: false,
    numbers: false
};

export const DEFAULT_STATS = {
    totalSessions: 0,
    totalKeystrokes: 0,
    totalTimeSeconds: 0,
    highestWpm: 0,
    wordHighestWpm: 0
};

const OPTIONS = {
    theme: ['dark', 'light', 'system'],
    colorPalette: ['mint', 'ocean', 'plum'],
    keyboardLayout: ['mac-us', 'colemak', 'dvorak', 'uk-iso'],
    soundProfile: ['magic', 'thock', 'bubble', 'clicky'],
    typingMode: ['strict', 'flow'],
    testMode: ['time', 'words'],
    testDuration: [15, 30, 60, 120],
    testWordCount: [10, 25, 50, 100]
};

const TYPE = { NULL: 1, BOOL: 2, NUMBER: 3, STRING: 4, OBJECT: 5, ARRAY: 6 };

export function defineStorage(b, arena, constants) {
    let serial = 0;
    const persistent = () => b.scalar(`storage_${serial++}`);
    const cell = (value = 0) => {
        const result = persistent();
        b.set(result, value);
        return result;
    };
    const key = name => constants.keys[name];
    const field = (object, name) => {
        const result = cell();
        arena.field(result, object, key(name));
        return result;
    };
    const read = (node, name) => {
        const result = cell();
        arena.get(result, name, node);
        return result;
    };
    const eq = (left, right) => {
        const result = cell();
        b.eq(result, left, right);
        return result;
    };
    const kind = (node, type) => eq(read(node, 'type'), type);
    const replace = (parent, name, node) => {
        const copy = cell();
        arena.clone(copy, node);
        arena.set('key', copy, key(name));
        arena.remove(parent, key(name));
        arena.append(parent, copy);
    };
    const make = (type, value = 0) => {
        const result = cell();
        arena.new(result, type, 0, value);
        return result;
    };
    const integer = value => {
        const result = make(TYPE.NUMBER);
        arena.set('numberFlags', result, 5);
        arena.set('numberLo', result, typeof value === 'number' ? value >>> 0 : value);
        if (typeof value === 'number') arena.set('numberHi', result,
            Math.floor(value / 0x100000000));
        return result;
    };
    const textBuffer = b.array('storage_text', 201);
    const textLength = cell();
    const readText = handle => {
        b.write(24);
        b.write(handle);
        const wireLength = cell();
        b.read(wireLength);
        b.set(textLength, 0);
        const char = cell();
        const within = cell();
        const append = value => {
            b.lt(within, textLength, 201);
            b.if(within, () => b.arraySet(textBuffer, textLength, value));
            b.add(textLength, 1);
        };
        b.repeat(wireLength, () => {
            b.read(char);
            const astral = cell();
            b.lt(astral, 65535, char);
            b.if(astral, () => {
                const high = cell();
                const low = cell();
                b.sub(char, 65536);
                b.divmod(high, low, char, 1024);
                b.add(high, 0xd800);
                b.add(low, 0xdc00);
                append(high);
                append(low);
            }, () => append(char));
        });
    };
    const internText = length => {
        const handle = cell();
        const char = cell();
        b.write(29);
        b.write(length);
        b.repeat(length, index => {
            b.arrayGet(textBuffer, index, char);
            b.write(char);
        });
        b.read(handle);
        return handle;
    };
    const rawString = handle => {
        const node = cell();
        b.if(handle, () => arena.new(node, TYPE.STRING, 0, handle),
            () => arena.new(node, TYPE.NULL));
        return node;
    };
    const builder = b.array('storage_string_builder', 512);
    const builderLength = persistent();
    const appendText = handle => {
        readText(handle);
        const char = cell();
        b.repeat(textLength, index => {
            b.arrayGet(textBuffer, index, char);
            b.arraySet(builder, builderLength, char);
            b.add(builderLength, 1);
        });
    };
    const appendLiteral = text => {
        for (const char of text) {
            b.arraySet(builder, builderLength, char.codePointAt(0));
            b.add(builderLength, 1);
        }
    };
    const finishText = out => {
        const char = cell();
        b.write(29);
        b.write(builderLength);
        b.repeat(builderLength, index => {
            b.arrayGet(builder, index, char);
            b.write(char);
        });
        b.read(out);
    };
    const appendUnsigned = value => {
        const digits = b.array(`storage_digits_${serial++}`, 10);
        const length = cell();
        const remaining = cell();
        const more = cell(1);
        const quotient = cell();
        const digit = cell();
        b.copy(remaining, value);
        b.while(more, () => {
            b.divmod(quotient, digit, remaining, 10);
            b.add(digit, 48);
            b.arraySet(digits, length, digit);
            b.add(length, 1);
            b.copy(remaining, quotient);
            b.truth(more, remaining);
        });
        b.while(length, () => {
            b.sub(length, 1);
            b.arrayGet(digits, length, digit);
            b.arraySet(builder, builderLength, digit);
            b.add(builderLength, 1);
        });
    };
    const validNumber = (node, integerOnly = false, maximum) => {
        const valid = cell();
        b.if(kind(node, TYPE.NUMBER), () => {
            const flags = read(node, 'numberFlags');
            const finite = cell();
            const rest = cell();
            const negative = cell();
            const whole = cell();
            b.divmod(rest, finite, flags, 2);
            b.divmod(whole, negative, rest, 2);
            b.if(finite, () => b.if(negative, () => {}, () => {
                const high = read(node, 'numberHi');
                b.lt(valid, high, 2097152);
                if (integerOnly) {
                    const integerBit = cell();
                    b.divmod(rest, integerBit, whole, 2);
                    b.if(integerBit, () => {}, () => b.set(valid, 0));
                }
                if (maximum !== undefined) {
                    b.if(high, () => b.set(valid, 0));
                    const low = read(node, 'numberLo');
                    b.if(eq(low, maximum), () => b.if(read(node,
                            'fraction'),
                        () => b.set(valid, 0)));
                    const excessive = cell();
                    b.lt(excessive, maximum, low);
                    b.if(excessive, () => b.set(valid, 0));
                }
            }));
        });
        return valid;
    };
    const validSetting = (name, node) => {
        const valid = cell();
        if (OPTIONS[name]) {
            for (const value of OPTIONS[name]) {
                if (typeof value === 'number') {
                    b.if(validNumber(node, true), () => b.if(eq(read(node, 'numberHi'), 0),
                        () => b.if(eq(read(node, 'numberLo'), value), () => b.set(valid,
                            1))));
                } else b.if(kind(node, TYPE.STRING), () => b.if(eq(read(node, 'value'),
                    constants.strings[value]), () => b.set(valid, 1)));
            }
        } else if (name === 'volume') b.copy(valid, validNumber(node, false, 1));
        else b.copy(valid, kind(node, TYPE.BOOL));
        return valid;
    };
    const atMost = (left, right) => {
        const valid = cell();
        const leftHigh = read(left, 'numberHi');
        const rightHigh = read(right, 'numberHi');
        b.lt(valid, leftHigh, rightHigh);
        b.if(eq(leftHigh, rightHigh), () => {
            const larger = cell();
            b.lt(larger, read(right, 'numberLo'), read(left, 'numberLo'));
            b.if(larger, () => {}, () => b.set(valid, 1));
        });
        return valid;
    };
    const zero = node => {
        const valid = cell(1);
        for (const name of ['numberLo', 'numberHi', 'fraction']) {
            b.if(read(node, name), () => b.set(valid, 0));
        }
        return valid;
    };
    const math = (name, ...args) => {
        const aliases = {
            divide: 'divideNumber',
            compare: 'compareNumbers',
            max: 'maxNumber',
            add: 'addNumbers',
            multiply: 'multiplyNumbers',
            subtract: 'subtractNumbers'
        };
        const operation = constants.numbers?.[name] || constants.numbers?.[aliases[name]];
        if (!operation) throw new Error(`Brainfuck storage needs numeric helper ${name}`);
        operation(...args);
    };
    const saturatedAdd = (out, left, right) => {
        const maximum = integer(Number.MAX_SAFE_INTEGER);
        const sum = cell();
        const order = cell();
        math('add', sum, left, right);
        math('compare', order, sum, maximum);
        b.if(eq(order, 1), () => arena.clone(out, maximum), () => arena.clone(out, sum));
    };
    const sanitizeLearning = (raw, out, preserveUnknown = true, migrate = false) => {
        b.set(out, 0);
        const validRoot = kind(raw, TYPE.OBJECT);
        if (!preserveUnknown) {
            for (const name of ['keys', 'bigrams']) b.if(kind(field(raw, name), TYPE.OBJECT),
                () => {}, () => b.set(validRoot, 0));
        }
        b.if(validRoot, () => {
            const newer = cell();
            const version = field(raw, 'version');
            if (preserveUnknown) b.if(validNumber(version, true), () => {
                b.lt(newer, 1, read(version, 'numberLo'));
                b.if(read(version, 'numberHi'), () => b.set(newer, 1));
            });
            b.if(newer, () => {
                if (preserveUnknown) arena.clone(out, raw);
            }, () => {
                if (preserveUnknown) arena.clone(out, raw);
                else arena.new(out, TYPE.OBJECT);
                for (const [group, length] of [['keys', 1], ['bigrams', 2]]) {
                    const source = field(raw, group);
                    const clean = make(TYPE.OBJECT);
                    b.if(kind(source, TYPE.OBJECT), () => arena.each(source, (
                        entry,
                        entryKey) => {
                        readText(entryKey);
                        const valid = eq(textLength, length);
                        const char = cell();
                        const before = cell();
                        const after = cell();
                        for (let index = 0; index <
                            length; index++) {
                            b.arrayGet(textBuffer, index, char);
                            b.lt(before, char, 32);
                            b.lt(after, 126, char);
                            b.if(before, () => b.set(valid, 0));
                            b.if(after, () => b.set(valid, 0));
                            b.lt(before, 64, char);
                            b.lt(after, char, 91);
                            b.if(before, () => b.if(after, () => b
                                .set(valid, 0)));
                        }
                        b.if(kind(entry, TYPE.OBJECT), () => {},
                            () => b.set(valid, 0));
                        const attempts = field(entry, 'attempts');
                        const errors = field(entry, 'errors');
                        const samples = field(entry,
                            'latencySamples');
                        const total = field(entry,
                            'latencyTotalMs');
                        for (const number of [attempts, errors,
                                samples]) {
                            b.if(validNumber(number, true),
                                () => {}, () => b.set(valid, 0));
                        }
                        b.if(validNumber(total), () => {}, () => b
                            .set(valid, 0));
                        b.if(atMost(errors, attempts), () => {},
                            () => b.set(valid, 0));
                        b.if(atMost(samples, attempts), () => {},
                            () => b.set(valid, 0));
                        b.if(zero(samples), () => b.if(zero(total),
                            () => {},
                            () => b.set(valid, 0)));
                        b.if(valid, () => {
                            const copy = cell();
                            if (preserveUnknown) arena
                                .clone(copy, entry);
                            else {
                                arena.new(copy, TYPE
                                    .OBJECT);
                                for (const name of [
                                        'attempts',
                                        'errors',
                                        'latencySamples',
                                        'latencyTotalMs']) replace(copy, name, field(entry, name));
                            }
                            if (migrate) {
                                for (const [name, numerator,
                                        denominator, maximum
                                        ] of [
                                        ['recentErrorRate', errors, attempts, 1],
                                        ['recentLatencyMs', total, samples, undefined]]) {
                                    const recent = field(
                                        entry, name);
                                    b.if(validNumber(recent,
                                            false,
                                            maximum),
                                        () => replace(
                                            copy, name,
                                            recent),
                                        () => {
                                            const
                                                fallback =
                                                cell();
                                            b.if(zero(
                                                    denominator
                                                ),
                                                () =>
                                                b
                                                .copy(
                                                    fallback,
                                                    integer(
                                                        0
                                                    )
                                                ),
                                                () =>
                                                math(
                                                    'divide',
                                                    fallback,
                                                    numerator,
                                                    denominator
                                                )
                                            );
                                            replace(copy,
                                                name,
                                                fallback
                                            );
                                        });
                                }
                            }
                            arena.set('key', copy,
                                entryKey);
                            arena.append(clean, copy);
                        });
                    }));
                    replace(out, group, clean);
                }
                if (migrate) replace(out, 'version', integer(1));
            });
        });
    };
    const pendingMetadata = b.array('storage_pending_metadata', arena.capacity + 1, [], 4);
    const state = {
        data: persistent(),
        pending: persistent(),
        loadFailed: persistent(),
        saveFailed: persistent(),
        saveConflict: persistent(),
        lockFailed: persistent(),
        lastSaved: persistent(),
        hasBaseline: persistent(),
        changed: persistent(),
        lastPrepared: persistent(),
        lastApplied: persistent(),
        validNumber,
        validSetting
    };
    state.retainedRoots = writeId => {
        writeId(state.data);
        writeId(state.pending);
        arena.each(state.pending, node => {
            for (const column of [0, 1]) {
                const retained = cell();
                b.arrayGet(pendingMetadata, node, retained, column);
                writeId(retained);
            }
        });
    };
    state.migrateLearning = (out, raw) => {
        sanitizeLearning(raw, out, true, true);
        b.if(out, () => {}, () => {
            arena.new(out, TYPE.OBJECT);
            replace(out, 'version', integer(1));
            for (const name of ['keys', 'bigrams']) replace(out, name, make(TYPE
                .OBJECT));
        });
    };
    state.mergeLearning = (out, raw, rawSession) => {
        state.migrateLearning(out, raw);
        const version = field(out, 'version');
        const current = eq(read(version, 'numberLo'), 1);
        b.if(read(version, 'numberHi'), () => b.set(current, 0));
        b.if(current, () => {
            const session = cell();
            sanitizeLearning(rawSession, session, false);
            b.if(session, () => {
                for (const group of ['keys', 'bigrams']) {
                    const target = field(out, group);
                    arena.each(field(session, group), (entry, entryKey) => {
                        const previous = cell();
                        arena.field(previous, target, entryKey);
                        b.if(previous, () => {}, () => {
                            arena.new(previous, TYPE.OBJECT);
                            for (const name of ['attempts',
                                    'errors',
                                    'latencySamples',
                                    'latencyTotalMs']) replace(previous, name, integer(0));
                            for (const [name, numerator,
                                    denominator] of [
                                    ['recentErrorRate', field(entry, 'errors'),
                                        field(entry, 'attempts')],
                                    ['recentLatencyMs', field(entry, 'latencyTotalMs'),
                                        field(entry, 'latencySamples')]]) {
                                const recent = cell();
                                b.if(zero(denominator), () => b
                                    .copy(recent, integer(
                                        0)),
                                    () => math('divide',
                                        recent, numerator,
                                        denominator));
                                replace(previous, name, recent);
                            }
                        });
                        const merged = cell();
                        arena.clone(merged, previous);
                        for (const name of ['attempts', 'errors',
                                'latencySamples',
                                'latencyTotalMs']) {
                            const sum = cell();
                            saturatedAdd(sum, field(previous, name),
                                field(entry, name));
                            replace(merged, name, sum);
                        }
                        for (const [name, numerator, denominator,
                                maximum] of [
                                ['recentErrorRate', field(entry, 'errors'),
                                    field(entry, 'attempts'), integer(1)],
                                ['recentLatencyMs', field(entry, 'latencyTotalMs'),
                                    field(entry, 'latencySamples'),
                                    integer(Number.MAX_SAFE_INTEGER)]]) {
                            b.if(zero(denominator), () => {}, () => {
                                const recent = cell();
                                const order = cell();
                                const weight = cell();
                                math('compare', order,
                                    denominator, integer(20)
                                );
                                b.if(eq(order, -1),
                                    () => math('divide',
                                        weight, denominator,
                                        integer(20)),
                                    () => b.copy(weight,
                                        integer(1)));
                                const complement = cell();
                                const weightedOld = cell();
                                const sessionRate = cell();
                                const weightedSession = cell();
                                math('subtract', complement,
                                    integer(1), weight);
                                math('multiply', weightedOld,
                                    field(previous, name),
                                    complement);
                                math('divide', sessionRate,
                                    numerator, denominator);
                                math('multiply',
                                    weightedSession,
                                    sessionRate, weight);
                                math('add', recent, weightedOld,
                                    weightedSession);
                                math('compare', order, recent,
                                    maximum);
                                b.if(eq(order, 1), () => b.copy(
                                    recent, maximum));
                                replace(merged, name, recent);
                            });
                        }
                        arena.remove(target, entryKey);
                        arena.set('key', merged, entryKey);
                        arena.append(target, merged);
                    });
                }
            });
        });
    };
    state.progressKey = (out, lessonId, options, settings) => {
        b.set(builderLength, 0);
        const metric = field(options, 'wpmMetric');
        b.if(metric, () => b.if(eq(read(metric, 'value'), constants.strings['words-v1']),
            () => appendLiteral('words-v1:')));
        const mode = field(options, 'testMode');
        b.if(validSetting('testMode', mode), () => {
            appendLiteral('test:["');
            appendText(read(mode, 'value'));
            appendLiteral('",');
            for (const [modeName, lengthKey] of [['time', 'testDuration'],
                    ['words', 'testWordCount']]) {
                b.if(eq(read(mode, 'value'), constants.strings[modeName]), () => {
                    const length = field(options, lengthKey);
                    b.if(validSetting(lengthKey, length), () => {},
                        () => b.copy(length, field(settings, lengthKey)));
                    appendUnsigned(read(length, 'numberLo'));
                });
            }
            appendLiteral(',"');
            const typing = field(options, 'typingMode');
            b.if(validSetting('typingMode', typing), () => {},
                () => b.copy(typing, field(settings, 'typingMode')));
            appendText(read(typing, 'value'));
            appendLiteral('"');
            for (const name of ['punctuation', 'numbers']) {
                const boolean = field(options, name);
                b.if(validSetting(name, boolean), () => {},
                    () => b.copy(boolean, field(settings, name)));
                appendLiteral(',');
                b.if(read(boolean, 'value'), () => appendLiteral('true'),
                    () => appendLiteral('false'));
            }
            appendLiteral(']');
        }, () => appendText(read(lessonId, 'value')));
        finishText(out);
    };
    state.accuracyReason = (out, target) => {
        b.set(builderLength, 0);
        appendLiteral('Records need at least ');
        const raw = read(target, 'raw');
        b.if(raw, () => appendText(raw), () => appendUnsigned(read(target, 'numberLo')));
        appendLiteral('% accuracy.');
        const handle = cell();
        finishText(handle);
        arena.string(out, handle);
    };
    state.initialize = () => {
        arena.clone(state.data, constants.defaultsRoot);
        arena.new(state.pending, TYPE.ARRAY);
    };
    state.load = (raw, present, failed, rawHandle) => {
        arena.clone(state.data, constants.defaultsRoot);
        b.copy(state.loadFailed, failed);
        b.copy(state.saveFailed, failed);
        b.set(state.saveConflict, 0);
        b.set(state.lockFailed, 0);
        b.if(failed, () => {}, () => {
            b.copy(state.lastSaved, rawHandle);
            b.set(state.hasBaseline, 1);
            b.if(present, () => b.if(kind(raw, TYPE.OBJECT), () => {
                const loaded = cell();
                arena.clone(loaded, raw);
                const settings = field(raw, 'settings');
                const defaults = field(constants.defaultsRoot, 'settings');
                const cleaned = cell();
                b.if(kind(settings, TYPE.OBJECT), () => arena.clone(cleaned,
                        settings),
                    () => arena.clone(cleaned, defaults));
                for (const name of Object.keys(DEFAULT_SETTINGS)) {
                    const value = field(settings, name);
                    b.if(validSetting(name, value), () => replace(cleaned,
                            name, value),
                        () => replace(cleaned, name, field(defaults,
                            name)));
                }
                replace(loaded, 'settings', cleaned);

                const stats = field(raw, 'stats');
                const defaultStats = field(constants.defaultsRoot, 'stats');
                const cleanedStats = cell();
                b.if(kind(stats, TYPE.OBJECT), () => arena.clone(
                        cleanedStats, stats),
                    () => arena.clone(cleanedStats, defaultStats));
                for (const name of Object.keys(DEFAULT_STATS)) {
                    const value = field(stats, name);
                    b.if(validNumber(value, name === 'totalSessions' || name
                            ===
                            'totalKeystrokes'), () => replace(
                            cleanedStats, name, value),
                        () => replace(cleanedStats, name, field(
                            defaultStats, name)));
                }
                replace(loaded, 'stats', cleanedStats);

                const progress = field(raw, 'progress');
                const cleanedProgress = make(TYPE.OBJECT);
                b.if(kind(progress, TYPE.OBJECT), () => arena.each(progress,
                    (entry, entryKey) => {
                        b.if(entryKey, () => b.if(kind(entry, TYPE
                            .OBJECT), () => {
                            const cleanedEntry = cell();
                            arena.clone(cleanedEntry,
                                entry);
                            const complete = field(
                                entry, 'completed');
                            const completed = make(TYPE
                                .BOOL);
                            b.if(kind(complete, TYPE
                                    .BOOL), () =>
                                arena.set('value',
                                    completed,
                                    read(complete,
                                        'value')));
                            replace(cleanedEntry,
                                'completed',
                                completed);
                            for (const [name,
                                maximum] of [['bestWpm',
                                        undefined],
                                ['bestAccuracy', 100], ['stars', 3]]) {
                                const value = field(
                                    entry, name);
                                b.if(validNumber(value,
                                        name ===
                                        'stars',
                                        maximum),
                                    () => replace(
                                        cleanedEntry,
                                        name, value
                                    ),
                                    () => replace(
                                        cleanedEntry,
                                        name,
                                        integer(0)));
                            }
                            for (const name of [
                                    'lastPlayed',
                                    'timestamp']) {
                                const value = field(
                                    entry, name);
                                b.if(validNumber(value),
                                    () => {},
                                    () => arena
                                    .remove(
                                        cleanedEntry,
                                        key(name)));
                            }
                            arena.set('key',
                                cleanedEntry,
                                entryKey);
                            arena.append(
                                cleanedProgress,
                                cleanedEntry);
                        }));
                    }));
                replace(loaded, 'progress', cleanedProgress);

                const history = field(raw, 'history');
                const cleanHistory = make(TYPE.ARRAY);
                const retained = cell();
                b.if(kind(history, TYPE.ARRAY), () => arena.each(history,
                    entry => {
                        const valid = kind(entry, TYPE.OBJECT);
                        const lessonId = field(entry, 'lessonId');
                        b.if(kind(lessonId, TYPE.STRING), () => {
                            readText(read(lessonId,
                                'value'));
                            b.if(textLength, () => {}, () =>
                                b.set(valid, 0));
                            const excessive = cell();
                            b.lt(excessive, 200,
                                textLength);
                            b.if(excessive, () => b.set(
                                valid, 0));
                        }, () => b.set(valid, 0));
                        const metric = field(entry, 'wpmMetric');
                        b.if(metric, () => b.if(kind(metric, TYPE
                                .STRING), () => b.if(eq(
                                    read(metric, 'value'),
                                    constants.strings[
                                        'words-v1']),
                                () => {},
                                () => b.set(valid, 0)),
                            () => b.set(valid, 0)));
                        const within = cell();
                        b.lt(within, retained, 50);
                        b.if(within, () => b.if(valid, () => {
                            const copy = cell();
                            arena.clone(copy, entry);
                            for (const [name,
                                maximum] of [['wpm',
                                        undefined], [
                                        'accuracy', 100
                                        ],
                                ['stars', 3]]) {
                                const value = field(
                                    entry, name);
                                b.if(validNumber(value,
                                        name ===
                                        'stars',
                                        maximum),
                                    () => replace(
                                        copy, name,
                                        value),
                                    () => replace(
                                        copy, name,
                                        integer(0)));
                            }
                            for (const [name, maximum,
                                    whole] of [[
                                        'rawWpm',
                                        undefined, false
                                        ],
                                ['consistency', 100, false], ['elapsedSeconds', undefined, false],
                                ['elapsedMilliseconds', undefined, false], ['totalKeystrokes',
                                    undefined, true], ['correctKeystrokes', undefined, true],
                                ['correctNonSpaceChars', undefined, true], ['errorKeystrokes',
                                    undefined, true], ['skippedChars', undefined, true]]) {
                                b.if(validNumber(field(
                                            entry,
                                            name),
                                        whole,
                                        maximum),
                                    () => {},
                                    () => arena
                                    .remove(copy,
                                        key(name)));
                            }
                            for (const name of [
                                    'testMode',
                                    'testDuration',
                                    'testWordCount',
                                'typingMode', 'punctuation', 'numbers']) {
                                b.if(validSetting(name,
                                        field(entry,
                                            name)),
                                    () => {},
                                    () => arena
                                    .remove(copy,
                                        key(name)));
                            }
                            b.if(kind(field(entry,
                                        'recordEligible'
                                    ), TYPE
                                    .BOOL),
                                () => {},
                                () => arena.remove(
                                    copy, key(
                                        'recordEligible'
                                    )));
                            const reason = field(entry,
                                'recordReason');
                            b.if(kind(reason, TYPE
                                    .STRING),
                                () => {
                                    readText(read(
                                        reason,
                                        'value'
                                    ));
                                    const
                                        excessive =
                                        cell();
                                    b.lt(excessive,
                                        200,
                                        textLength
                                    );
                                    b.if(excessive,
                                        () =>
                                        replace(
                                            copy,
                                            'recordReason',
                                            make(
                                                TYPE
                                                .STRING,
                                                internText(
                                                    200
                                                )
                                            )
                                        ));
                                }, () => arena
                                .remove(copy, key(
                                    'recordReason'
                                )));
                            const date = field(entry,
                                'date');
                            const dateValid = kind(date,
                                TYPE.STRING);
                            b.if(dateValid, () => {
                                readText(read(
                                    date,
                                    'value'
                                ));
                                const
                                    excessive =
                                    cell();
                                b.lt(excessive,
                                    64,
                                    textLength
                                );
                                b.if(excessive,
                                    () => b
                                    .set(
                                        dateValid,
                                        0),
                                    () =>
                                    constants
                                    .parseDate(
                                        date,
                                        dateValid
                                    ));
                            });
                            b.if(dateValid, () => {},
                                () => replace(copy,
                                    'date', make(
                                        TYPE.NULL)));
                            const learning = cell();
                            sanitizeLearning(field(
                                    entry,
                                    'learning'),
                                learning);
                            b.if(learning, () =>
                                replace(copy,
                                    'learning',
                                    learning),
                                () => arena.remove(
                                    copy, key(
                                        'learning'))
                            );
                            arena.append(cleanHistory,
                                copy);
                            b.add(retained, 1);
                        }));
                    }));
                replace(loaded, 'history', cleanHistory);
                const learning = cell();
                sanitizeLearning(field(raw, 'learning'), learning, true,
                    true);
                b.if(learning, () => replace(loaded, 'learning', learning),
                    () => replace(loaded, 'learning', field(constants
                        .defaultsRoot, 'learning')));
                b.copy(state.data, loaded);
            }), () => {
                const settings = field(state.data, 'settings');
                replace(settings, 'typingMode', make(TYPE.STRING, constants
                    .strings.strict));
                replace(settings, 'showHands', make(TYPE.BOOL, 1));
                replace(settings, 'showKeyboard', make(TYPE.BOOL, 1));
            });
        });
    };
    state.setSetting = (settingKey, value) => {
        b.set(state.changed, 0);
        const settings = field(state.data, 'settings');
        for (const name of Object.keys(DEFAULT_SETTINGS)) {
            b.if(eq(settingKey, key(name)), () => b.if(validSetting(name, value), () => {
                replace(settings, name, value);
                b.set(state.changed, 1);
            }));
        }
    };
    state.saveAllowed = latest => {
        const allowed = cell(1);
        b.if(state.loadFailed, () => b.set(allowed, 0));
        b.if(state.lockFailed, () => b.set(allowed, 0));
        b.if(state.saveFailed, () => b.if(eq(latest, state.lastSaved), () => {}, () => {
            b.set(state.saveConflict, 1);
            b.set(allowed, 0);
        }));
        return allowed;
    };
    state.saved = (raw, failed) => {
        b.copy(state.saveFailed, failed);
        b.if(failed, () => {}, () => {
            b.copy(state.lastSaved, raw);
            b.set(state.hasBaseline, 1);
            b.set(state.saveConflict, 0);
        });
    };
    state.recordLesson = (lessonId, result, targetWpm, targetAccuracy, options, timestamp,
        date, out) => {
        const valid = kind(lessonId, TYPE.STRING);
        b.if(valid, () => {
            readText(read(lessonId, 'value'));
            b.if(textLength, () => {}, () => b.set(valid, 0));
            const excessive = cell();
            b.lt(excessive, 200, textLength);
            b.if(excessive, () => b.set(valid, 0));
        });
        b.if(kind(result, TYPE.OBJECT), () => {}, () => b.set(valid, 0));
        const metric = field(result, 'wpmMetric');
        b.if(metric, () => b.if(kind(metric, TYPE.STRING), () => b.if(eq(read(metric,
                'value'), constants.strings['words-v1']), () => {}, () => b.set(
                valid, 0)),
            () => b.set(valid, 0)));
        arena.new(out, TYPE.OBJECT);
        replace(out, 'stars', integer(0));
        replace(out, 'isNewBestWpm', make(TYPE.BOOL, 0));
        replace(out, 'recordEligible', make(TYPE.BOOL, 0));
        replace(out, 'recordReason', make(TYPE.STRING,
            constants.strings['No typing result was recorded.']));
        b.set(state.changed, 0);
        b.if(valid, () => {
            const sanitized = (parent, name, whole = false, maximum) => {
                const original = field(parent, name);
                const value = cell();
                b.if(validNumber(original, whole, maximum), () => b.copy(value,
                        original),
                    () => b.copy(value, integer(0)));
                return value;
            };
            const wpm = sanitized(result, 'wpm');
            const accuracy = sanitized(result, 'accuracy', false, 100);
            const speedTarget = cell();
            const accuracyTarget = cell();
            b.if(validNumber(targetWpm), () => b.copy(speedTarget, targetWpm),
                () => b.copy(speedTarget, integer(30)));
            b.if(validNumber(targetAccuracy, false, 100),
                () => b.copy(accuracyTarget, targetAccuracy),
                () => b.copy(accuracyTarget, integer(95)));
            const elapsed = cell();
            const milliseconds = field(result, 'elapsedMilliseconds');
            b.if(validNumber(milliseconds), () => math('divide', elapsed, milliseconds,
                integer(1000)), () => b.copy(elapsed, sanitized(result,
                'elapsedSeconds')));
            const correct = sanitized(result, 'correctKeystrokes', true);
            const total = sanitized(result, 'totalKeystrokes', true);
            const correctInput = cell(1);
            b.if(zero(correct), () => b.set(correctInput, 0));
            b.if(atMost(correct, total), () => {}, () => b.set(correctInput, 0));
            const nonspace = field(result, 'correctNonSpaceChars');
            b.if(nonspace, () => b.if(zero(sanitized(result, 'correctNonSpaceChars',
                    true)),
                () => b.set(correctInput, 0)));
            const skipped = sanitized(result, 'skippedChars', true);
            const noSkip = zero(skipped);
            const practiceOnly = cell();
            const requestedEligibility = field(options, 'recordEligible');
            b.if(kind(requestedEligibility, TYPE.BOOL), () => b.if(eq(read(
                requestedEligibility,
                'value'), 0), () => b.set(practiceOnly, 1)));
            const completed = cell(1);
            b.if(correctInput, () => {}, () => b.set(completed, 0));
            b.if(zero(elapsed), () => b.set(completed, 0));
            b.if(noSkip, () => {}, () => b.set(completed, 0));
            b.if(practiceOnly, () => b.set(completed, 0));
            const recordReason = make(TYPE.NULL);
            const recordEligible = cell(1);
            const order = cell();
            math('compare', order, accuracy, accuracyTarget);
            b.if(eq(order, -1), () => {
                state.accuracyReason(recordReason, accuracyTarget);
                b.set(recordEligible, 0);
            });
            const reason = message => {
                b.copy(recordReason, make(TYPE.STRING, constants.strings[message]));
                b.set(recordEligible, 0);
            };
            b.if(practiceOnly, () => reason(
                'Practice sessions do not qualify for records.'));
            b.if(noSkip, () => {}, () => reason(
                'Skipped characters do not qualify for records.'));
            b.if(correctInput, () => {}, () => reason(
                'No correct characters were typed.'));
            b.if(zero(elapsed), () => reason('The test has no measured typing time.'));
            const stars = cell();
            b.if(completed, () => {
                b.set(stars, 1);
                math('compare', order, accuracy, accuracyTarget);
                b.if(eq(order, -1), () => {}, () => {
                    b.set(stars, 2);
                    math('compare', order, wpm, speedTarget);
                    b.if(eq(order, -1), () => {}, () => b.set(stars,
                        3));
                });
            });
            const entry = make(TYPE.OBJECT);
            replace(entry, 'lessonId', lessonId);
            replace(entry, 'wpm', wpm);
            replace(entry, 'accuracy', accuracy);
            replace(entry, 'stars', integer(stars));
            replace(entry, 'date', date);
            b.if(metric, () => replace(entry, 'wpmMetric', metric));
            for (const name of ['testMode', 'testDuration', 'testWordCount',
                    'typingMode',
                    'punctuation', 'numbers']) {
                const value = field(options, name);
                b.if(validSetting(name, value), () => replace(entry, name, value));
            }
            for (const [name, maximum, whole] of [['rawWpm', undefined, false],
                    ['consistency', 100, false], ['elapsedSeconds', undefined, false],
                    ['elapsedMilliseconds', undefined, false], ['totalKeystrokes', undefined,
                        true], ['correctKeystrokes', undefined, true], ['correctNonSpaceChars',
                        undefined, true], ['errorKeystrokes', undefined, true],
                    ['skippedChars', undefined, true]]) {
                const value = field(result, name);
                b.if(validNumber(value, whole, maximum), () => replace(entry, name,
                    value));
            }
            replace(entry, 'recordEligible', make(TYPE.BOOL, recordEligible));
            b.if(kind(recordReason, TYPE.STRING), () => replace(entry, 'recordReason',
                recordReason));
            const learning = cell();
            sanitizeLearning(field(result, 'learning'), learning, false);
            b.if(learning, () => replace(entry, 'learning', learning));
            const pending = cell();
            arena.clone(pending, entry);
            b.if(state.pending, () => {}, () => arena.new(state.pending, TYPE.ARRAY));
            arena.append(state.pending, pending);
            const progressId = cell();
            state.progressKey(progressId, lessonId, entry, field(state.data,
                'settings'));
            b.arraySet(pendingMetadata, pending, timestamp, 0);
            b.arraySet(pendingMetadata, pending, elapsed, 1);
            b.arraySet(pendingMetadata, pending, progressId, 2);
            b.arraySet(pendingMetadata, pending, completed, 3);
            b.copy(state.lastPrepared, pending);
            replace(out, 'stars', integer(stars));
            replace(out, 'recordEligible', make(TYPE.BOOL, recordEligible));
            replace(out, 'recordReason', recordReason);
            b.write(12);
            b.writeString(STORAGE_KEY);
            b.write(pending);
        });
    };
    state.refresh = (latest, present, readFailed, rawHandle) => {
        b.if(state.saveFailed, () => {}, () => b.if(state.loadFailed, () => {}, () => {
            const retained = cell();
            b.copy(retained, state.data);
            state.load(latest, present, readFailed, rawHandle);
            b.if(readFailed, () => b.copy(state.data, retained));
        }));
    };
    state.applyLesson = (pending, latest, present, readFailed, rawHandle, lockFailed, out) => {
        b.set(state.changed, 0);
        const found = cell();
        arena.each(state.pending, node => b.if(eq(node, pending), () => b.set(found, 1)));
        b.if(found, () => {
            b.if(kind(out, TYPE.OBJECT), () => {}, () => arena.new(out, TYPE.OBJECT));
            const entry = pending;
            const timestamp = cell();
            const elapsed = cell();
            const progressId = cell();
            const completed = cell();
            b.arrayGet(pendingMetadata, pending, timestamp, 0);
            b.arrayGet(pendingMetadata, pending, elapsed, 1);
            b.arrayGet(pendingMetadata, pending, progressId, 2);
            b.arrayGet(pendingMetadata, pending, completed, 3);
            const wpm = field(entry, 'wpm');
            const accuracy = field(entry, 'accuracy');
            const stars = read(field(entry, 'stars'), 'numberLo');
            const recordEligible = read(field(entry, 'recordEligible'), 'value');
            const recordReason = field(entry, 'recordReason');
            b.if(recordReason, () => {}, () => b.copy(recordReason, make(TYPE.NULL)));
            const metric = field(entry, 'wpmMetric');
            const learning = field(entry, 'learning');
            const total = field(entry, 'totalKeystrokes');
            b.if(validNumber(total, true), () => {}, () => b.copy(total, integer(0)));
            const order = cell();
            b.copy(state.lockFailed, lockFailed);
            b.if(lockFailed, () => b.set(state.saveFailed, 1));
            state.refresh(latest, present, readFailed, rawHandle);
            const profile = cell();
            state.mergeLearning(profile, field(state.data, 'learning'), learning);
            replace(state.data, 'learning', profile);
            const progress = field(state.data, 'progress');
            const existing = cell();
            arena.field(existing, progress, progressId);
            b.if(existing, () => {}, () => {
                arena.new(existing, TYPE.OBJECT);
                replace(existing, 'bestWpm', integer(0));
                replace(existing, 'bestAccuracy', integer(0));
                replace(existing, 'stars', integer(0));
            });
            const best = field(existing, 'bestWpm');
            const newBest = cell();
            b.if(recordEligible, () => {
                math('compare', order, wpm, best);
                b.if(eq(order, 1), () => b.set(newBest, 1));
            });
            b.if(completed, () => {
                const updated = cell();
                arena.clone(updated, existing);
                replace(updated, 'completed', make(TYPE.BOOL, 1));
                const maximum = cell();
                b.if(recordEligible, () => {
                    math('max', maximum, best, wpm);
                    replace(updated, 'bestWpm', maximum);
                });
                math('max', maximum, field(existing, 'bestAccuracy'), accuracy);
                replace(updated, 'bestAccuracy', maximum);
                math('max', maximum, field(existing, 'stars'), integer(stars));
                replace(updated, 'stars', maximum);
                replace(updated, 'lastPlayed', timestamp);
                arena.remove(progress, progressId);
                arena.set('key', updated, progressId);
                arena.append(progress, updated);
            });
            const totals = field(state.data, 'stats');
            const sum = cell();
            for (const [name, increment] of [['totalSessions', integer(1)],
                    ['totalKeystrokes', total], ['totalTimeSeconds', elapsed]]) {
                saturatedAdd(sum, field(totals, name), increment);
                replace(totals, name, sum);
            }
            b.if(recordEligible, () => {
                const name = cell(constants.keys.highestWpm);
                b.if(metric, () => b.if(eq(read(metric, 'value'), constants
                        .strings['words-v1']),
                    () => b.set(name, constants.keys.wordHighestWpm)));
                const previous = cell();
                arena.field(previous, totals, name);
                math('max', sum, previous, wpm);
                arena.remove(totals, name);
                const copy = cell();
                arena.clone(copy, sum);
                arena.set('key', copy, name);
                arena.append(totals, copy);
            });
            const history = field(state.data, 'history');
            const first = read(history, 'child');
            const historyEntry = cell();
            arena.clone(historyEntry, entry);
            arena.set('next', historyEntry, first);
            arena.set('child', history, historyEntry);
            const count = cell();
            arena.each(history, node => {
                b.add(count, 1);
                b.if(eq(count, 50), () => arena.set('next', node, 0));
            });
            const preceding = cell();
            arena.each(state.pending, node => {
                b.if(eq(node, pending), () => {
                    const next = read(node, 'next');
                    b.if(preceding, () => arena.set('next', preceding,
                            next),
                        () => arena.set('child', state.pending,
                            next));
                }, () => b.copy(preceding, node));
            });
            replace(out, 'stars', integer(stars));
            replace(out, 'isNewBestWpm', make(TYPE.BOOL, newBest));
            replace(out, 'recordEligible', make(TYPE.BOOL, recordEligible));
            replace(out, 'recordReason', recordReason);
            b.set(state.changed, 1);
            b.copy(state.lastApplied, pending);
            constants.save(out);
        });
    };
    state.retrySave = (out, latestRaw, lockFailed) => {
        arena.new(out, TYPE.OBJECT);
        replace(out, 'saved', make(TYPE.BOOL, 0));
        b.if(read(state.pending, 'child'), () => {}, () => {
            b.if(state.saveFailed, () => {
                b.copy(state.lockFailed, lockFailed);
                b.if(lockFailed, () => {}, () => b.if(state.saveAllowed(
                        latestRaw),
                    () => constants.save(out)));
            }, () => replace(out, 'saved', make(TYPE.BOOL, 1)));
        });
    };
    state.exportBackup = (out, exportedAt, savedRaw, failed) => {
        arena.new(out, TYPE.OBJECT);
        replace(out, 'format', make(TYPE.STRING, constants.strings.typeflow));
        replace(out, 'version', integer(1));
        replace(out, 'exportedAt', exportedAt);
        replace(out, 'session', state.data);
        replace(out, 'savedReadFailed', make(TYPE.BOOL, failed));
        b.if(failed, () => {}, () => replace(out, 'savedRaw', rawString(savedRaw)));
        b.if(read(state.pending, 'child'), () => replace(out, 'pendingLessons', state.pending));
        b.if(state.hasBaseline, () => b.if(failed,
            () => replace(out, 'baselineRaw', rawString(state.lastSaved)),
            () => b.if(eq(savedRaw, state.lastSaved), () => {},
                () => replace(out, 'baselineRaw', rawString(state.lastSaved)))));
    };
    return state;
}
