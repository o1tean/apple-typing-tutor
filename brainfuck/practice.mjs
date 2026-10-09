import { TYPE } from './runtime.mjs';

export const PRACTICE_KEYS = [
    'layouts', 'lessons', 'amateur', 'pro', 'words', 'quotes', 'weakPools', 'focus',
    'context', 'pools', 'neighbors', 'id', 'title', 'shortTitle', 'targetWpm',
    'targetAccuracy', 'keyboardLayout', 'lessonTrack', 'lessonIndex', 'track',
    'text', 'author', 'source', 'quoteIndex', 'steps', 'stars', 'completed',
    'lastPlayed', 'lessonId', 'reason', 'total', 'threeStar', 'next', 'version',
    'keys', 'bigrams', 'attempts', 'latencySamples', 'recentErrorRate',
    'recentLatencyMs', 'homeKeys', 'fingerMap', 'hand', 'finger', 'options',
    'recordEligible', 'focusGroup', 'focusKeys', 'learningBefore',
    'testMode', 'testDuration', 'testWordCount', 'punctuation', 'numbers',
    'typingMode', 'duration'
];
export const PRACTICE_STRINGS = [
    'amateur', 'pro', 'amat-intro', 'test', 'lesson', 'quote', 'custom', 'weak',
    'keys', 'bigrams', 'weak-keys', 'weak-pairs', 'Weak-key practice', 'Pair practice',
    'custom text', 'retry', 'missed-words', 'time', 'words',
    'First lesson without a saved completion.',
    'All lessons completed. Work toward 3 stars here.',
    'All 3-star targets earned. Revisit the final lesson.'
];

/** Build-time practice macros. Every choice, loop and text mutation emits Brainfuck. */
export function definePractice(b, arena, constants) {
    let serial = 0;
    const persistent = (name = 'temporary') => b.scalar(`practice_${name}_${serial++}`);
    const cell = (value = 0) => {
        const out = persistent();
        b.set(out, value);
        return out;
    };
    const key = name => {
        if (constants.keys[name] === undefined) throw new Error(`Missing practice key: ${name}`);
        return constants.keys[name];
    };
    const textValue = text => {
        const source = constants.stringValues || constants.strings;
        if (source[text] === undefined) throw new Error(`Missing practice string: ${text}`);
        return source[text];
    };
    const read = (node, name) => {
        const out = cell();
        arena.get(out, name, node);
        return out;
    };
    const field = (node, name) => {
        const out = cell();
        arena.field(out, node, key(name));
        return out;
    };
    const eq = (left, right) => {
        const out = cell();
        b.eq(out, left, right);
        return out;
    };
    const lt = (left, right) => {
        const out = cell();
        b.lt(out, left, right);
        return out;
    };
    const not = value => eq(value, 0);
    const value = node => read(node, 'value');
    const low = node => read(node, 'numberLo');
    const at = (array, index) => {
        const out = read(array, 'child');
        const remaining = cell(index);
        b.while(remaining, () => {
            b.if(out, () => arena.get(out, 'next', out));
            b.sub(remaining, 1);
        });
        return out;
    };
    const count = array => {
        const out = cell();
        arena.each(array, () => b.add(out, 1));
        return out;
    };
    const makeString = handle => {
        const out = cell();
        arena.string(out, handle);
        return out;
    };
    const makeNumber = number => {
        const out = cell();
        arena.number(out, number);
        return out;
    };
    const setString = (parent, name, handle) =>
        arena.setField(parent, key(name), makeString(handle));
    const setNumber = (parent, name, number) =>
        arena.setField(parent, key(name), makeNumber(number));
    const setBoolean = (parent, name, boolean) => {
        const out = cell();
        arena.boolean(out, boolean);
        arena.setField(parent, key(name), out);
    };

    const text = b.string('practice_text', '', 20000);
    const lines = b.array('practice_lines', 64, [], 2);
    const lineCount = persistent('lineCount');
    const metadata = persistent('metadata');
    const focus = b.array('practice_focus', 128);
    const focusCount = persistent('focusCount');
    const pathResult = persistent('pathResult');
    const latestResult = persistent('latestResult');
    const normalizedHandle = persistent('normalizedHandle');
    const buffer = b.string('practice_buffer', '', 20000);
    const normalized = b.string('practice_normalized', '', 20000);
    const smallBuffer = b.string('practice_small', '', 512);
    const decimalBuffer = b.string('practice_decimal', '', 32);
    const comparisonBuffer = b.string('practice_compare', '', 512);
    const homeBuffer = b.string('practice_home', '', 32);
    const contextChars = b.array('practice_context_chars', 128);
    const neighborChars = b.array('practice_neighbor_chars', 128);
    const focusChars = b.array('practice_focus_chars', 128);
    const selectedLayout = persistent('selectedLayout');
    const selectedTrack = persistent('selectedTrack');
    const selectedLesson = persistent('selectedLesson');
    const selectedQuote = persistent('selectedQuote');
    const characters = persistent('characters');

    const readString = (handle, out = buffer) => {
        if (constants.readString) constants.readString(handle, out);
        else {
            b.write(24);
            b.write(handle);
            b.readString(out);
        }
        return out;
    };
    const internString = (source, out = normalizedHandle) => {
        if (constants.internString) constants.internString(source, out);
        else {
            b.write(29);
            b.writeString(source);
            b.read(out);
        }
        return out;
    };
    const appendChar = (out, char) => {
        b.if(lt(out.length, out.capacity), () => {
            b.arraySet(out.data, out.length, char);
            b.add(out.length, 1);
        }, () => b.trap());
    };
    const appendBuffer = (out, source) => {
        const char = cell();
        b.repeat(source.length, index => {
            b.arrayGet(source.data, index, char);
            appendChar(out, char);
        });
    };
    const appendLiteral = (out, literal) => {
        for (const char of literal) appendChar(out, char.codePointAt(0));
    };
    const appendHandle = (out, handle, source = buffer) => {
        readString(handle, source);
        appendBuffer(out, source);
    };
    const clearExercise = (keepFocus = false) => {
        b.set(text.length, 0);
        b.set(lineCount, 0);
        if (!keepFocus) b.set(focusCount, 0);
        arena.object(metadata);
    };
    const beginLine = () => {
        b.arraySet(lines, lineCount, text.length, 0);
    };
    const endLine = () => {
        const start = cell();
        b.arrayGet(lines, lineCount, start, 0);
        const length = cell(text.length);
        b.sub(length, start);
        b.if(length, () => {
            b.arraySet(lines, lineCount, length, 1);
            b.add(lineCount, 1);
        });
    };
    const random = amount => {
        const out = cell();
        const source = cell();
        const quotient = cell();
        b.if(amount, () => {
            b.write(15);
            b.write(0);
            b.read(source);
            b.divmod(quotient, out, source, amount);
        });
        return out;
    };
    const choose = array => at(array, random(count(array)));
    const layoutAt = index => at(field(constants.contentRoot, 'layouts'), index);
    const lessonsAt = (layoutIndex, trackIndex) => {
        const parent = field(layoutAt(layoutIndex), 'lessons');
        const out = cell();
        b.if(trackIndex, () => arena.field(out, parent, key('pro')),
            () => arena.field(out, parent, key('amateur')));
        return out;
    };
    const copyField = (target, name, source, originalName = name) => {
        const out = cell();
        arena.clone(out, field(source, originalName));
        arena.setField(target, key(name), out);
    };
    const unsignedText = (number, out = decimalBuffer) => {
        b.set(out.length, 0);
        const working = cell(number);
        const digits = b.array(`practice_digits_${serial++}`, 10);
        const digitCount = cell();
        const quotient = cell();
        const remainder = cell();
        b.if(working, () => {
            b.while(working, () => {
                b.divmod(quotient, remainder, working, 10);
                b.arraySet(digits, digitCount, remainder);
                b.add(digitCount, 1);
                b.copy(working, quotient);
            });
            b.while(digitCount, () => {
                b.sub(digitCount, 1);
                b.arrayGet(digits, digitCount, remainder);
                b.add(remainder, 48);
                appendChar(out, remainder);
            });
        }, () => appendChar(out, 48));
        return out;
    };
    const isWhitespace = char => {
        const out = cell();
        b.if(lt(8, char), () => b.if(lt(char, 14), () => b.set(out, 1)));
        b.if(lt(8191, char), () => b.if(lt(char, 8203), () => b.set(out, 1)));
        for (const code of [32, 160, 5760, 8232, 8233, 8239, 8287, 12288, 65279])
            b.if(eq(char, code), () => b.set(out, 1));
        return out;
    };

    const normalizeCustomText = handle => {
        readString(handle);
        b.set(normalized.length, 0);
        const char = cell();
        b.repeat(buffer.length, index => {
            b.arrayGet(buffer.data, index, char);
            b.if(eq(char, 173), () => {}, () =>
                b.if(eq(char, 8203), () => {}, () => appendChar(normalized, char)));
        });
        // NFC is a generic text transport operation; removal and whitespace decisions are BF.
        b.write(32);
        b.writeString(normalized);
        b.writeString('NFC');
        b.read(normalizedHandle);
        readString(normalizedHandle);
        b.set(normalized.length, 0);
        const separator = cell();
        b.repeat(buffer.length, index => {
            b.arrayGet(buffer.data, index, char);
            b.if(isWhitespace(char), () => b.set(separator, 1), () => {
                b.if(normalized.length, () => b.if(separator,
                    () => appendChar(normalized, 32)));
                appendChar(normalized, char);
                b.set(separator, 0);
            });
        });
        internString(normalized);
        return normalizedHandle;
    };

    const generateWords = (amount, punctuation = 0, includeNumbers = 0) => {
        clearExercise();
        beginLine();
        const pool = field(constants.contentRoot, 'words');
        const poolCount = count(pool);
        const previous = cell();
        const havePrevious = cell();
        const choices = cell();
        const choice = cell();
        const modEight = cell();
        const modNine = cell();
        const quotient = cell();
        const first = cell();
        const last = cell(amount);
        b.sub(last, 1);
        b.repeat(amount, index => {
            b.if(index, () => appendChar(text, 32));
            b.copy(choices, poolCount);
            b.sub(choices, havePrevious);
            b.copy(choice, random(choices));
            b.if(havePrevious, () => b.if(lt(choice, previous), () => {},
                () => b.add(choice, 1)));
            b.copy(previous, choice);
            b.set(havePrevious, 1);
            b.divmod(quotient, modNine, index, 9);
            b.divmod(quotient, modEight, index, 8);
            b.set(first, text.length);
            const numeric = cell();
            b.if(includeNumbers, () => b.copy(numeric, eq(modNine, 7)));
            b.if(numeric, () => appendBuffer(text, unsignedText(random(1000))),
                () => appendHandle(text, value(at(pool, choice))));
            b.if(punctuation, () => {
                b.if(eq(modEight, 0), () => {
                    const char = cell();
                    b.arrayGet(text.data, first, char);
                    b.if(lt(96, char), () => b.if(lt(char, 123), () => {
                        b.sub(char, 32);
                        b.arraySet(text.data, first, char);
                    }));
                });
                const fullStop = eq(modEight, 7);
                b.if(eq(index, last), () => b.set(fullStop, 1));
                b.if(fullStop, () => appendChar(text, 46),
                    () => b.if(eq(modEight, 3), () => appendChar(text, 44)));
            });
        });
        endLine();
        setString(metadata, 'track', textValue('test'));
        return text;
    };

    const generateLessonDrill = (layoutIndex, trackIndex, lessonIndex) => {
        clearExercise();
        b.copy(selectedLayout, layoutIndex);
        b.copy(selectedTrack, trackIndex);
        b.copy(selectedLesson, lessonIndex);
        const lesson = at(lessonsAt(layoutIndex, trackIndex), lessonIndex);
        b.if(lesson, () => {
            arena.clone(metadata, lesson);
            setString(metadata, 'track', textValue('lesson'));
            const trackHandle = cell(textValue('amateur'));
            b.if(trackIndex, () => b.set(trackHandle, textValue('pro')));
            setString(metadata, 'lessonTrack', trackHandle);
            setNumber(metadata, 'lessonIndex', lessonIndex);
            copyField(metadata, 'keyboardLayout', layoutAt(layoutIndex), 'id');
            const focusRoot = field(lesson, 'focus');
            const context = field(lesson, 'context');
            const pools = field(lesson, 'pools');
            const neighbors = field(lesson, 'neighbors');
            b.copy(focusCount, count(focusRoot));
            const offset = random(focusCount);
            const columns = cell();
            const remainder = cell();
            b.divmod(columns, remainder, focusCount, 4);
            b.if(remainder, () => b.add(columns, 1));
            b.if(lt(columns, 8), () => b.set(columns, 8));
            const hasSpace = cell();
            const focusPosition = cell();
            arena.each(focusRoot, entry => {
                const handle = value(entry);
                b.arraySet(focus, focusPosition, handle);
                b.add(focusPosition, 1);
                readString(handle, smallBuffer);
                const char = cell();
                b.arrayGet(smallBuffer.data, 0, char);
                b.if(eq(char, 32), () => b.set(hasSpace, 1));
            });
            const index = cell(offset);
            const keyHandle = cell();
            const keyChar = cell();
            const otherChar = cell();
            b.repeat(4, () => {
                beginLine();
                b.repeat(columns, column => {
                    b.if(column, () => appendChar(text, 32));
                    b.if(hasSpace, () => appendHandle(text, value(choose(context))), () => {
                        b.arrayGet(focus, index, keyHandle);
                        readString(keyHandle, smallBuffer);
                        b.arrayGet(smallBuffer.data, 0, keyChar);
                        const pool = at(pools, index);
                        const hasPool = count(pool);
                        const selectWord = cell();
                        b.if(hasPool, () => b.copy(selectWord, random(2)));
                        b.if(selectWord, () => appendHandle(text, value(choose(pool))), () => {
                            readString(value(choose(at(neighbors, index))), smallBuffer);
                            b.arrayGet(smallBuffer.data, 0, otherChar);
                            const pattern = random(3);
                            b.if(eq(pattern, 0), () => {
                                appendChar(text, keyChar);
                                appendChar(text, otherChar);
                                appendChar(text, keyChar);
                                appendChar(text, otherChar);
                            }, () => b.if(eq(pattern, 1), () => {
                                appendChar(text, keyChar);
                                appendChar(text, otherChar);
                                appendChar(text, otherChar);
                                appendChar(text, keyChar);
                            }, () => {
                                appendChar(text, otherChar);
                                appendChar(text, keyChar);
                                appendChar(text, otherChar);
                                appendChar(text, keyChar);
                            }));
                        });
                        b.add(index, 1);
                        b.if(eq(index, focusCount), () => b.set(index, 0));
                    });
                });
                endLine();
            });
        });
        return text;
    };

    const quote = (quoteIndex = null) => {
        clearExercise();
        const quotes = field(constants.contentRoot, 'quotes');
        b.copy(selectedQuote, quoteIndex === null ? random(count(quotes)) : quoteIndex);
        const selected = at(quotes, selectedQuote);
        b.if(selected, () => {
            beginLine();
            appendHandle(text, value(field(selected, 'text')));
            endLine();
            setString(metadata, 'track', textValue('quote'));
            setNumber(metadata, 'quoteIndex', selectedQuote);
            for (const name of ['author', 'source']) copyField(metadata, name, selected);
            b.set(normalized.length, 0);
            appendLiteral(normalized, 'quote-');
            appendHandle(normalized, value(field(selected, 'id')));
            setString(metadata, 'id', internString(normalized));
            b.set(normalized.length, 0);
            appendLiteral(normalized, 'quote · ');
            appendHandle(normalized, value(field(selected, 'author')));
            setString(metadata, 'title', internString(normalized));
        });
        return text;
    };

    const custom = handle => {
        normalizeCustomText(handle);
        clearExercise();
        beginLine();
        appendBuffer(text, normalized);
        endLine();
        setString(metadata, 'track', textValue('custom'));
        setString(metadata, 'id', textValue('custom'));
        setString(metadata, 'title', textValue('custom text'));
        return text;
    };

    const test = (settingsNode, layoutIndex) => {
        const mode = value(field(settingsNode, 'testMode'));
        const timed = eq(mode, textValue('time'));
        const duration = low(field(settingsNode, 'testDuration'));
        const wordCount = low(field(settingsNode, 'testWordCount'));
        const punctuation = value(field(settingsNode, 'punctuation'));
        const includeNumbers = value(field(settingsNode, 'numbers'));
        const amount = cell(wordCount);
        b.if(timed, () => b.set(amount, 400));
        generateWords(amount, punctuation, includeNumbers);
        const selectedCount = cell(wordCount);
        b.if(timed, () => b.copy(selectedCount, duration));
        b.set(normalized.length, 0);
        appendHandle(normalized, mode);
        appendLiteral(normalized, '-');
        appendBuffer(normalized, unsignedText(selectedCount));
        b.if(punctuation, () => appendLiteral(normalized, '-punctuation'));
        b.if(includeNumbers, () => appendLiteral(normalized, '-numbers'));
        setString(metadata, 'id', internString(normalized));
        b.set(normalized.length, 0);
        appendBuffer(normalized, unsignedText(selectedCount));
        b.if(timed, () => appendLiteral(normalized, ' second test'),
            () => appendLiteral(normalized, ' word test'));
        setString(metadata, 'title', internString(normalized));
        const elapsed = cell();
        b.if(timed, () => b.copy(elapsed, duration));
        setNumber(metadata, 'duration', elapsed);
        copyField(metadata, 'keyboardLayout', layoutAt(layoutIndex), 'id');
        const options = cell();
        arena.object(options);
        for (const name of ['testMode', 'testDuration', 'testWordCount', 'punctuation',
            'numbers', 'typingMode']) copyField(options, name, settingsNode);
        arena.setField(metadata, key('options'), options);
        return text;
    };

    const retry = missedWords => {
        clearExercise();
        beginLine();
        const position = cell();
        arena.each(missedWords, entry => {
            b.if(position, () => appendChar(text, 32));
            appendHandle(text, value(entry));
            b.add(position, 1);
        });
        endLine();
        setString(metadata, 'track', textValue('retry'));
        setString(metadata, 'id', textValue('missed-words'));
        b.set(normalized.length, 0);
        appendLiteral(normalized, 'missed words · ');
        appendBuffer(normalized, unsignedText(position));
        setString(metadata, 'title', internString(normalized));
        return text;
    };

    const nextQuote = () => {
        const next = cell(selectedQuote);
        b.add(next, 1);
        b.if(eq(next, count(field(constants.contentRoot, 'quotes'))), () => b.set(next, 0));
        return quote(next);
    };

    const focusLabel = (handle, out = normalizedHandle) => {
        readString(handle, smallBuffer);
        b.set(normalized.length, 0);
        const char = cell();
        b.repeat(smallBuffer.length, index => {
            b.if(index, () => appendLiteral(normalized, ' → '));
            b.arrayGet(smallBuffer.data, index, char);
            b.if(eq(char, 32), () => appendLiteral(normalized, 'Space'),
                () => appendChar(normalized, char));
        });
        return internString(normalized, out);
    };

    const path = (progress, layoutIndex, trackIndex) => {
        const lessons = lessonsAt(layoutIndex, trackIndex);
        arena.object(pathResult);
        const steps = cell();
        arena.array(steps);
        const completedCount = cell();
        const threeStar = cell();
        const total = cell();
        const unfinished = cell();
        const target = cell();
        const final = cell();
        const index = cell();
        arena.each(lessons, lesson => {
            const id = value(field(lesson, 'id'));
            const legacy = cell();
            arena.field(legacy, progress, id);
            b.set(normalized.length, 0);
            appendLiteral(normalized, 'words-v1:');
            appendHandle(normalized, id);
            const wordId = internString(normalized);
            const current = cell();
            arena.field(current, progress, wordId);
            const stars = low(field(legacy, 'stars'));
            const currentStars = low(field(current, 'stars'));
            b.if(lt(stars, currentStars), () => b.copy(stars, currentStars));
            const completed = cell();
            b.if(stars, () => b.set(completed, 1));
            for (const saved of [legacy, current]) {
                const savedComplete = field(saved, 'completed');
                b.if(eq(read(savedComplete, 'type'), TYPE.BOOL),
                    () => b.if(value(savedComplete), () => b.set(completed, 1)));
            }
            const step = cell();
            arena.object(step);
            for (const name of ['id', 'title', 'shortTitle', 'targetWpm', 'targetAccuracy'])
                copyField(step, name, lesson);
            setNumber(step, 'index', index);
            setNumber(step, 'stars', stars);
            setBoolean(step, 'completed', completed);
            arena.append(steps, step);
            b.if(eq(id, textValue('amat-intro')), () => {}, () => {
                b.add(total, 1);
                b.if(completed, () => b.add(completedCount, 1),
                    () => b.if(unfinished, () => {}, () => b.copy(unfinished, step)));
                b.if(eq(stars, 3), () => b.add(threeStar, 1));
                b.if(lt(stars, 3), () => b.if(target, () => {},
                    () => b.copy(target, step)));
                b.copy(final, step);
            });
            b.add(index, 1);
        });
        arena.setField(pathResult, key('steps'), steps);
        setNumber(pathResult, 'total', total);
        setNumber(pathResult, 'completed', completedCount);
        setNumber(pathResult, 'threeStar', threeStar);
        const next = cell();
        const reason = cell();
        b.if(unfinished, () => {
            b.copy(next, unfinished);
            b.set(reason, textValue('First lesson without a saved completion.'));
        }, () => b.if(target, () => {
            b.copy(next, target);
            b.set(reason, textValue('All lessons completed. Work toward 3 stars here.'));
        }, () => {
            b.copy(next, final);
            b.set(reason, textValue('All 3-star targets earned. Revisit the final lesson.'));
        }));
        const copy = cell();
        arena.clone(copy, next);
        arena.setField(pathResult, key('next'), copy);
        setString(pathResult, 'reason', reason);
        return pathResult;
    };

    const findLesson = handle => {
        const found = cell();
        const track = cell();
        const index = cell();
        for (const name of ['amateur', 'pro']) {
            const lessons = field(field(layoutAt(0), 'lessons'), name);
            const position = cell();
            arena.each(lessons, lesson => {
                b.if(eq(value(field(lesson, 'id')), handle), () => {
                    b.set(found, 1);
                    b.set(track, textValue(name));
                    b.copy(index, position);
                });
                b.add(position, 1);
            });
        }
        return { found, track, index };
    };

    const compareNumbers = (left, right) => {
        const out = cell();
        if (constants.numbers?.compareNumbers)
            constants.numbers.compareNumbers(out, left, right);
        else {
            const leftHigh = read(left, 'numberHi');
            const rightHigh = read(right, 'numberHi');
            b.if(lt(leftHigh, rightHigh), () => b.set(out, -1), () =>
                b.if(lt(rightHigh, leftHigh), () => b.set(out, 1), () => {
                    const leftLow = low(left);
                    const rightLow = low(right);
                    b.if(lt(leftLow, rightLow), () => b.set(out, -1),
                        () => b.if(lt(rightLow, leftLow), () => b.set(out, 1)));
                }));
        }
        return out;
    };

    const latest = (history, progress) => {
        b.set(latestResult, 0);
        arena.each(history, entry => b.if(latestResult, () => {}, () => {
            const found = findLesson(value(field(entry, 'lessonId')));
            b.if(found.found, () => {
                arena.object(latestResult);
                setString(latestResult, 'track', found.track);
                setNumber(latestResult, 'index', found.index);
            });
        }));
        b.if(latestResult, () => {}, () => {
            const bestTime = cell();
            const bestTrack = cell();
            const bestIndex = cell();
            arena.each(progress, (entry, id) => {
                const completed = field(entry, 'completed');
                const time = field(entry, 'lastPlayed');
                const valid = cell();
                b.if(eq(read(completed, 'type'), TYPE.BOOL), () =>
                    b.if(value(completed), () =>
                        b.if(eq(read(time, 'type'), TYPE.NUMBER), () => {
                            const flags = read(time, 'numberFlags');
                            const quotient = cell();
                            const finite = cell();
                            const negative = cell();
                            b.divmod(quotient, finite, flags, 2);
                            b.divmod(quotient, negative, quotient, 2);
                            b.if(finite, () => b.if(negative, () => {}, () => {
                                b.if(low(time), () => b.set(valid, 1));
                                b.if(read(time, 'numberHi'), () => b.set(valid, 1));
                                b.if(read(time, 'fraction'), () => b.set(valid, 1));
                            }));
                        })));
                b.if(valid, () => {
                    readString(id, smallBuffer);
                    const prefixed = cell(1);
                    const prefix = 'words-v1:';
                    b.if(lt(smallBuffer.length, prefix.length),
                        () => b.set(prefixed, 0));
                    const char = cell();
                    for (let index = 0; index < prefix.length; index++) {
                        b.arrayGet(smallBuffer.data, index, char);
                        b.if(eq(char, prefix.codePointAt(index)), () => {},
                            () => b.set(prefixed, 0));
                    }
                    const lessonId = cell(id);
                    b.if(prefixed, () => {
                        b.set(normalized.length, 0);
                        const offset = cell(prefix.length);
                        const remaining = lt(offset, smallBuffer.length);
                        b.while(remaining, () => {
                            b.arrayGet(smallBuffer.data, offset, char);
                            appendChar(normalized, char);
                            b.add(offset, 1);
                            b.lt(remaining, offset, smallBuffer.length);
                        });
                        internString(normalized, lessonId);
                    });
                    const found = findLesson(lessonId);
                    b.if(found.found, () => {
                        const newer = cell(1);
                        b.if(bestTime, () => b.copy(newer,
                            eq(compareNumbers(time, bestTime), 1)));
                        b.if(newer, () => {
                            b.copy(bestTime, time);
                            b.copy(bestTrack, found.track);
                            b.copy(bestIndex, found.index);
                        });
                    });
                });
            });
            b.if(bestTime, () => {
                arena.object(latestResult);
                setString(latestResult, 'track', bestTrack);
                setNumber(latestResult, 'index', bestIndex);
            });
        });
        return latestResult;
    };

    const positive = node => {
        const out = cell();
        for (const name of ['numberLo', 'numberHi', 'fraction'])
            b.if(read(node, name), () => b.set(out, 1));
        return out;
    };
    const before = (left, right) => {
        readString(left, smallBuffer);
        readString(right, comparisonBuffer);
        b.write(33);
        b.writeString(smallBuffer);
        b.writeString(comparisonBuffer);
        const comparison = cell();
        b.read(comparison);
        return eq(comparison, 1);
    };
    const focusKeys = (profile, limit = 3, group = 0) => {
        b.set(focusCount, 0);
        const version = field(profile, 'version');
        const valid = eq(low(version), 1);
        b.if(read(version, 'numberHi'), () => b.set(valid, 0));
        const flags = cell();
        const flagHigh = cell();
        b.divmod(flagHigh, flags, read(version, 'numberFlags'), 8);
        b.if(eq(flags, 5), () => {}, () => b.set(valid, 0));
        b.if(valid, () => {
            const source = cell();
            b.if(group, () => arena.field(source, profile, key('bigrams')),
                () => arena.field(source, profile, key('keys')));
            const slowest = cell();
            const two = cell();
            const zero = cell();
            const cutoff = cell();
            constants.numbers.constant(slowest, 1);
            constants.numbers.constant(two, 2);
            constants.numbers.constant(zero, 0);
            constants.numbers.constant(cutoff, 0.6);
            const eligible = (entry, handle) => {
                const ok = positive(field(entry, 'attempts'));
                b.if(group, () => {
                    readString(handle, smallBuffer);
                    const char = cell();
                    const nonspace = cell();
                    b.repeat(smallBuffer.length, index => {
                        b.arrayGet(smallBuffer.data, index, char);
                        b.if(isWhitespace(char), () => {}, () => b.set(nonspace, 1));
                    });
                    b.if(nonspace, () => {}, () => b.set(ok, 0));
                });
                return ok;
            };
            arena.each(source, (entry, handle) => b.if(eligible(entry, handle), () => {
                b.if(positive(field(entry, 'latencySamples')), () => {
                    const latency = field(entry, 'recentLatencyMs');
                    b.if(eq(compareNumbers(latency, slowest), 1),
                        () => b.copy(slowest, latency));
                });
            }));
            const score = entry => {
                const result = cell();
                constants.numbers.multiplyNumbers(result, two,
                    field(entry, 'recentErrorRate'));
                b.if(positive(field(entry, 'latencySamples')), () => {
                    const speed = cell();
                    constants.numbers.divideNumber(speed,
                        field(entry, 'recentLatencyMs'), slowest);
                    constants.numbers.addNumbers(result, result, speed);
                });
                return result;
            };
            const top = cell();
            const threshold = cell();
            const active = cell(1);
            const maximum = cell(limit);
            b.if(lt(128, maximum), () => b.set(maximum, 128));
            b.repeat(maximum, () => b.if(active, () => {
                const bestHandle = cell();
                const bestScore = cell(zero);
                arena.each(source, (entry, handle) => {
                    const ok = eligible(entry, handle);
                    const saved = cell();
                    b.repeat(focusCount, index => {
                        b.arrayGet(focus, index, saved);
                        b.if(eq(saved, handle), () => b.set(ok, 0));
                    });
                    b.if(ok, () => {
                        const currentScore = score(entry);
                        b.if(eq(compareNumbers(currentScore, zero), 1), () => {
                            const comparison = compareNumbers(currentScore, bestScore);
                            const preferred = eq(comparison, 1);
                            b.if(eq(comparison, 0), () =>
                                b.if(bestHandle, () => b.copy(preferred,
                                    before(handle, bestHandle)), () => b.set(preferred, 1)));
                            b.if(preferred, () => {
                                b.copy(bestScore, currentScore);
                                b.copy(bestHandle, handle);
                            });
                        });
                    });
                });
                b.if(bestHandle, () => {
                    b.if(top, () => {}, () => {
                        b.copy(top, bestScore);
                        constants.numbers.multiplyNumbers(threshold, top, cutoff);
                    });
                    b.if(eq(compareNumbers(bestScore, threshold), -1),
                    () => b.set(active, 0), () => {
                        b.arraySet(focus, focusCount, bestHandle);
                        b.add(focusCount, 1);
                    });
                }, () => b.set(active, 0));
            }));
        });
        return focus;
    };

    const weak = (profile, layoutIndex, group = 0) => {
        const limit = cell(3);
        b.if(group, () => b.set(limit, 1));
        focusKeys(profile, limit, group);
        const success = cell();
        b.if(focusCount, () => {
            b.set(success, 1);
            clearExercise(true);
            const layout = layoutAt(layoutIndex);
            const layoutFingers = field(layout, 'fingerMap');
            readString(value(field(layout, 'homeKeys')), homeBuffer);
            const contextCount = cell();
            for (let code = 97; code <= 122; code++) {
                b.arraySet(contextChars, contextCount, code);
                b.add(contextCount, 1);
            }
            const hasSpace = cell();
            const nonspaceFocus = b.array(`practice_nonspace_${serial++}`, 128);
            const nonspaceCount = cell();
            const handle = cell();
            const char = cell();
            b.repeat(focusCount, index => {
                b.arrayGet(focus, index, handle);
                readString(handle, smallBuffer);
                b.arrayGet(smallBuffer.data, 0, char);
                b.arraySet(focusChars, index, char);
                b.if(eq(char, 32), () => b.set(hasSpace, 1), () => {
                    b.arraySet(nonspaceFocus, nonspaceCount, char);
                    b.add(nonspaceCount, 1);
                    b.if(lt(char, 97), () => {
                        b.arraySet(contextChars, contextCount, char);
                        b.add(contextCount, 1);
                    }, () => b.if(lt(122, char), () => {
                        b.arraySet(contextChars, contextCount, char);
                        b.add(contextCount, 1);
                    }));
                });
            });
            const allowed = candidate => {
                const result = cell();
                b.if(lt(96, candidate), () => b.if(lt(candidate, 123),
                    () => b.set(result, 1)));
                const focused = cell();
                b.repeat(focusCount, index => {
                    b.arrayGet(focusChars, index, focused);
                    b.if(eq(candidate, focused), () => b.set(result, 1));
                });
                return result;
            };
            const other = (keyChar, keyHandle) => {
                const keyFinger = cell();
                arena.field(keyFinger, layoutFingers, keyHandle);
                const hand = value(field(keyFinger, 'hand'));
                const finger = value(field(keyFinger, 'finger'));
                const rest = cell();
                const nearbyCount = cell();
                const candidate = cell();
                b.repeat(homeBuffer.length, index => {
                    b.arrayGet(homeBuffer.data, index, candidate);
                    const ok = allowed(candidate);
                    b.if(eq(candidate, keyChar), () => b.set(ok, 0));
                    b.if(ok, () => {
                        b.set(smallBuffer.length, 1);
                        b.arraySet(smallBuffer.data, 0, candidate);
                        const candidateHandle = cell();
                        internString(smallBuffer, candidateHandle);
                        const info = cell();
                        arena.field(info, layoutFingers, candidateHandle);
                        b.if(eq(value(field(info, 'hand')), hand), () => {
                            b.arraySet(neighborChars, nearbyCount, candidate);
                            b.add(nearbyCount, 1);
                            b.if(eq(value(field(info, 'finger')), finger),
                                () => b.if(rest, () => {}, () => b.copy(rest, candidate)));
                        });
                    });
                });
                const result = cell(rest);
                b.if(rest, () => {}, () => b.if(nearbyCount,
                    () => b.arrayGet(neighborChars, random(nearbyCount), result),
                    () => b.arrayGet(contextChars, random(contextCount), result)));
                return result;
            };
            b.if(group, () => {
                b.arrayGet(focus, 0, handle);
                readString(handle, comparisonBuffer);
                b.repeat(2, () => {
                    beginLine();
                    const written = cell();
                    const separator = cell();
                    b.repeat(8, () => {
                        b.set(separator, 1);
                        const repetitions = random(2);
                        b.add(repetitions, 2);
                        b.repeat(repetitions, () => {
                            b.repeat(comparisonBuffer.length, index => {
                                b.arrayGet(comparisonBuffer.data, index, char);
                                b.if(eq(char, 32), () => b.set(separator, 1), () => {
                                    b.if(written, () => b.if(separator,
                                        () => appendChar(text, 32)));
                                    appendChar(text, char);
                                    b.set(written, 1);
                                    b.set(separator, 0);
                                });
                            });
                        });
                    });
                    endLine();
                });
            }, () => {
                const index = random(focusCount);
                b.repeat(4, () => {
                    beginLine();
                    b.repeat(8, column => {
                        b.if(column, () => appendChar(text, 32));
                        b.if(hasSpace, () => {
                            b.if(nonspaceCount, () =>
                                b.arrayGet(nonspaceFocus, random(nonspaceCount), char),
                            () => b.arrayGet(contextChars, random(contextCount), char));
                            appendChar(text, char);
                        }, () => {
                            b.arrayGet(focus, index, handle);
                            b.arrayGet(focusChars, index, char);
                            const pool = cell();
                            arena.field(pool, field(constants.contentRoot, 'weakPools'), handle);
                            const usePool = cell();
                            b.if(count(pool), () => b.copy(usePool, random(2)));
                            b.if(usePool, () => appendHandle(text, value(choose(pool))), () => {
                                const next = other(char, handle);
                                const pattern = random(3);
                                b.if(eq(pattern, 0), () => {
                                    appendChar(text, char);
                                    appendChar(text, next);
                                    appendChar(text, char);
                                    appendChar(text, next);
                                }, () => b.if(eq(pattern, 1), () => {
                                    appendChar(text, char);
                                    appendChar(text, next);
                                    appendChar(text, next);
                                    appendChar(text, char);
                                }, () => {
                                    appendChar(text, next);
                                    appendChar(text, char);
                                    appendChar(text, next);
                                    appendChar(text, char);
                                }));
                            });
                            b.add(index, 1);
                            b.if(eq(index, focusCount), () => b.set(index, 0));
                        });
                    });
                    endLine();
                });
            });
            setString(metadata, 'track', textValue('weak'));
            b.if(group, () => {
                setString(metadata, 'id', textValue('weak-pairs'));
                setString(metadata, 'title', textValue('Pair practice'));
                setString(metadata, 'focusGroup', textValue('bigrams'));
            }, () => {
                setString(metadata, 'id', textValue('weak-keys'));
                setString(metadata, 'title', textValue('Weak-key practice'));
                setString(metadata, 'focusGroup', textValue('keys'));
            });
            copyField(metadata, 'keyboardLayout', layout, 'id');
            const options = cell();
            arena.object(options);
            setBoolean(options, 'recordEligible', 0);
            arena.setField(metadata, key('options'), options);
            const focusRoot = cell();
            arena.array(focusRoot);
            b.repeat(focusCount, index => {
                b.arrayGet(focus, index, handle);
                arena.append(focusRoot, makeString(handle));
            });
            arena.setField(metadata, key('focusKeys'), focusRoot);
            const before = cell();
            arena.clone(before, profile);
            arena.setField(metadata, key('learningBefore'), before);
        });
        return success;
    };

    const repeat = () => {
        const options = field(metadata, 'options');
        b.if(eq(read(options, 'type'), TYPE.OBJECT), () => {}, () => {
            arena.object(options);
            arena.setField(metadata, key('options'), options);
        });
        setBoolean(options, 'recordEligible', 0);
        return text;
    };

    const practice = {
        text, lines, lineCount, metadata, focus, focusCount, pathResult, latestResult,
        normalizedHandle, normalized, selectedLayout, selectedTrack, selectedLesson,
        selectedQuote, characters,
        generateWords, generateLessonDrill, normalizeCustomText,
        lesson: generateLessonDrill, speed: generateWords, quote, custom, test, retry,
        nextQuote, focusLabel,
        path, latest, lessonPath: path, latestLesson: latest,
        focusKeys, weak, generateWeakDrill: weak, repeat,
        // Remaining generators share these primitives and are attached below.
        helpers: { persistent, cell, field, read, value, low, eq, lt, not, at, count,
            key, textValue, makeString, makeNumber, setString, setNumber, setBoolean,
            readString, internString, appendChar, appendBuffer, appendLiteral,
            appendHandle, clearExercise, beginLine, endLine, random, choose,
            layoutAt, lessonsAt, copyField, unsignedText, isWhitespace },
        buffers: { buffer, normalized, smallBuffer, decimalBuffer }
    };
    return practice;
}
