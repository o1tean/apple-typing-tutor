import { TYPE, uint64, fromPair64, toPair64, add64, mul64, div64 } from './runtime.mjs';
import { textBuffer } from './text.mjs';
import { emitTemplate, trendCharts } from './view.mjs';

/** History decisions and charts execute as Brainfuck, including local-day grouping. */
export function defineHistory(b, arena, constants) {
    let serial = 0;
    const numbers = constants.numbers;
    const scalar = name => b.scalar(`history_${name}_${serial++}`);
    const cell = (value = 0) => {
        const out = scalar('temporary');
        b.set(out, value);
        return out;
    };
    const key = name => constants.keys[name];
    const strings = constants.stringValues || constants.strings;
    const field = (node, name) => {
        const out = cell();
        arena.field(out, node, key(name));
        return out;
    };
    const read = (node, name) => {
        const out = cell();
        arena.get(out, name, node);
        return out;
    };
    const value = node => read(node, 'value');
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
    const number = literal => {
        const out = cell();
        numbers.constant(out, literal);
        return out;
    };
    const math = (method, left, right) => {
        const out = cell();
        numbers[method](out, left, right);
        return out;
    };
    const compare = (left, right) => math('compareNumbers', left, right);
    const finitePositive = (node, allowZero = false) => {
        const valid = cell();
        b.if(eq(read(node, 'type'), TYPE.NUMBER), () => {
            const flags = read(node, 'numberFlags');
            const quotient = cell();
            const finite = cell();
            const negative = cell();
            b.divmod(quotient, finite, flags, 2);
            b.divmod(quotient, negative, quotient, 2);
            b.if(finite, () => b.if(negative, () => {}, () => {
                if (allowZero) b.set(valid, 1);
                else b.if(eq(compare(node, number(0)), 1), () => b.set(
                    valid, 1));
            }));
        });
        return valid;
    };
    const output = textBuffer(b, 'history_output', 180000);
    const scratch = textBuffer(b, 'history_scratch', 12000);
    const idText = textBuffer(b, 'history_id', 512);
    const labelText = textBuffer(b, 'history_label', 512);
    const legacyCountText = textBuffer(b, 'history_legacy_count', 512);
    const coordinate = textBuffer(b, 'history_coordinate', 100);
    const dayText = textBuffer(b, 'history_day_text', 100);
    const activity = b.array('history_activity', 1001, [], 6);
    const activityCount = scalar('activityCount');
    const days = b.array('history_days', 14, [], 7);
    const currentStreak = scalar('currentStreak');
    const longestStreak = scalar('longestStreak');
    const measuredDays = scalar('measuredDays');
    const today = scalar('today');
    const rowCount = scalar('rowCount');
    const html = (selector, buffer) => {
        if (constants.html) constants.html(selector, buffer);
        else {
            b.write(1);
            b.writeString(selector);
            b.writeString(buffer);
        }
    };
    const appendHtml = (selector, buffer) => {
        b.write(2);
        b.writeString(selector);
        b.writeString(buffer);
    };
    const text = (selector, buffer) => {
        if (constants.text) constants.text(selector, buffer);
        else {
            b.write(3);
            b.writeString(selector);
            b.writeString(buffer);
        }
    };
    const attribute = (selector, name, buffer) => {
        b.write(4);
        b.writeString(selector);
        b.writeString(name);
        b.writeString(buffer);
    };
    const date = (node, method) => {
        const out = cell();
        b.write(22);
        b.write(node);
        b.writeString(method);
        b.write(0);
        b.read(out);
        return out;
    };
    const format = (node, digits = 0, method = 'fixed', trim = false) => {
        const handle = cell();
        b.write(37);
        b.write(node);
        b.writeString(method);
        b.write(digits);
        b.read(handle);
        scratch.read(handle);
        if (trim) {
            const decimal = cell();
            const exponent = cell(scratch.length);
            const char = cell();
            b.repeat(scratch.length, index => {
                b.arrayGet(scratch.data, index, char);
                b.if(eq(char, 46), () => {
                    b.copy(decimal, index);
                    b.add(decimal, 1);
                });
                b.if(eq(char, 101), () => b.copy(exponent, index));
            });
            b.if(decimal, () => {
                const end = cell(exponent);
                const index = cell(end);
                b.sub(index, 1);
                b.arrayGet(scratch.data, index, char);
                const more = eq(char, 48);
                b.while(more, () => {
                    b.sub(end, 1);
                    b.sub(index, 1);
                    b.arrayGet(scratch.data, index, char);
                    b.eq(more, char, 48);
                });
                b.if(eq(char, 46), () => b.sub(end, 1));
                const source = cell(exponent);
                const target = cell(end);
                const tail = lt(source, scratch.length);
                b.while(tail, () => {
                    b.arrayGet(scratch.data, source, char);
                    b.arraySet(scratch.data, target, char);
                    b.add(source, 1);
                    b.add(target, 1);
                    b.lt(tail, source, scratch.length);
                });
                b.copy(scratch.length, target);
            });
        }
        return scratch;
    };
    const appendNumber = (node, digits = 0, method = 'string', trim = false) =>
        output.copy(format(node, digits, method, trim));
    const setNumber = (parent, name, amount) => {
        const node = cell();
        arena.number(node, amount);
        arena.setField(parent, key(name), node);
    };
    const count = root => {
        const out = cell();
        arena.each(root, () => b.add(out, 1));
        return out;
    };
    const calendarDay = parts => {
        const fields = cell();
        arena.array(fields);
        for (const name of ['year', 'month', 'day']) {
            const copy = cell();
            arena.clone(copy, field(parts, name));
            arena.set('key', copy, 0);
            arena.append(fields, copy);
        }
        const stamp = date(fields, 'utc');
        const absolute = cell(stamp);
        const negative = eq(compare(stamp, number(0)), -1);
        b.if(negative, () => numbers.subtractNumbers(absolute, number(0), stamp));
        const amount = cell();
        numbers.ratio(amount, absolute, number(86400000), 1);
        const out = cell(100000000);
        b.if(negative, () => b.sub(out, amount), () => b.add(out, amount));
        return out;
    };
    const timestamp = day => {
        const difference = cell(day);
        const negative = lt(day, 100000000);
        b.if(negative, () => {
            b.set(difference, 100000000);
            b.sub(difference, day);
        }, () => b.sub(difference, 100000000));
        const wide = uint64(b, `history_stamp_${serial++}`);
        const factor = uint64(b, `history_day_factor_${serial++}`, 86400000n);
        fromPair64(b, wide, difference, 0);
        mul64(b, wide, wide, factor);
        const low = cell();
        const high = cell();
        toPair64(b, low, high, wide);
        const out = cell();
        const flags = cell(5);
        b.if(negative, () => b.set(flags, 7));
        arena.number(out, low, high, flags);
        return out;
    };
    const elapsed = entry => {
        const out = field(entry, 'elapsedMilliseconds');
        const missing = eq(read(out, 'type'), TYPE.NULL);
        b.if(out, () => {}, () => b.set(missing, 1));
        b.if(missing, () => {
            b.set(out, 0);
            const seconds = field(entry, 'elapsedSeconds');
            b.if(eq(read(seconds, 'type'), TYPE.NUMBER),
                () => numbers.multiplyNumbers(out, seconds, number(1000)));
        });
        return out;
    };
    const progress = (history, now) => {
        b.set(activityCount, 0);
        b.set(currentStreak, 0);
        b.set(longestStreak, 0);
        b.set(measuredDays, 0);
        b.copy(today, calendarDay(date(now, 'parts')));
        arena.each(history, entry => {
            const savedDate = field(entry, 'date');
            b.if(eq(read(savedDate, 'type'), TYPE.STRING), () => {
                const parts = date(savedDate, 'parts');
                const stamp = field(parts, 'timestamp');
                const flags = read(stamp, 'numberFlags');
                const quotient = cell();
                const finite = cell();
                b.divmod(quotient, finite, flags, 2);
                b.if(finite, () => b.if(eq(compare(stamp, now), 1), () => {},
                    () => {
                        const day = calendarDay(parts);
                        const index = cell(activityCount);
                        const existing = cell();
                        b.repeat(activityCount, position => {
                            b.arrayGet(activity, position,
                                existing, 0);
                            b.if(eq(existing, day), () => b
                                .copy(index, position));
                        });
                        b.if(eq(index, activityCount), () => {
                            b.arraySet(activity, index, day, 0);
                            b.arraySet(activity, index, 0, 1);
                            b.arraySet(activity, index, 0, 2);
                            b.arraySet(activity, index, number(
                                0), 3);
                            b.arraySet(activity, index, number(
                                0), 4);
                            b.arraySet(activity, index, 0, 5);
                            b.add(activityCount, 1);
                        });
                        const sessions = cell();
                        b.arrayGet(activity, index, sessions, 1);
                        b.add(sessions, 1);
                        b.arraySet(activity, index, sessions, 1);
                        const wpm = field(entry, 'wpm');
                        const accuracy = field(entry, 'accuracy');
                        const valid = eq(value(field(entry,
                            'wpmMetric')), strings['words-v1']);
                        b.if(finitePositive(elapsed(entry)), () => {},
                            () => b.set(valid, 0));
                        b.if(finitePositive(wpm, true), () => {}, () =>
                            b.set(valid, 0));
                        b.if(finitePositive(accuracy, true), () => {},
                            () => b.set(valid, 0));
                        b.if(eq(compare(accuracy, number(100)), 1),
                            () => b.set(valid, 0));
                        b.if(valid, () => {
                            const measured = cell();
                            b.arrayGet(activity, index,
                                measured, 2);
                            b.add(measured, 1);
                            b.arraySet(activity, index,
                                measured, 2);
                            for (const [member, node] of [[3,
                                    wpm], [4, accuracy]]) {
                                const total = cell();
                                b.arrayGet(activity, index,
                                    total, member);
                                numbers.addNumbers(total, total,
                                    node);
                                b.arraySet(activity, index,
                                    total, member);
                            }
                        });
                    }));
            });
        });
        const previous = cell();
        const streak = cell();
        const havePrevious = cell();
        b.repeat(activityCount, () => {
            const minimum = cell(0xffffffff);
            const selected = cell();
            const actual = cell();
            const used = cell();
            b.repeat(activityCount, index => {
                b.arrayGet(activity, index, actual, 0);
                b.arrayGet(activity, index, used, 5);
                b.if(used, () => {}, () => b.if(lt(actual, minimum), () => {
                    b.copy(minimum, actual);
                    b.copy(selected, index);
                }));
            });
            b.arraySet(activity, selected, 1, 5);
            const adjacent = cell(previous);
            b.add(adjacent, 1);
            const consecutive = eq(adjacent, minimum);
            b.if(havePrevious, () => {}, () => b.set(consecutive, 0));
            b.if(consecutive, () => b.add(streak, 1), () => b.set(streak, 1));
            b.if(lt(longestStreak, streak), () => b.copy(longestStreak, streak));
            b.copy(previous, minimum);
            b.set(havePrevious, 1);
        });
        const yesterday = cell(today);
        b.sub(yesterday, 1);
        b.if(havePrevious, () => b.if(lt(previous, yesterday), () => {},
            () => b.copy(currentStreak, streak)));
        b.repeat(14, index => {
            const day = cell(today);
            b.sub(day, 13);
            b.add(day, index);
            b.arraySet(days, index, day, 0);
            for (let member = 1; member < 5; member++) b.arraySet(days, index, 0,
                member);
            const actual = cell();
            b.repeat(activityCount, saved => {
                b.arrayGet(activity, saved, actual, 0);
                b.if(eq(actual, day), () => {
                    const sessions = cell();
                    const measured = cell();
                    b.arrayGet(activity, saved, sessions, 1);
                    b.arrayGet(activity, saved, measured, 2);
                    b.arraySet(days, index, sessions, 1);
                    b.arraySet(days, index, measured, 2);
                    b.if(measured, () => {
                        b.add(measuredDays, 1);
                        const divisor = cell();
                        arena.number(divisor, measured);
                        for (const member of [3, 4]) {
                            const total = cell();
                            b.arrayGet(activity, saved, total,
                                member);
                            numbers.divideNumber(total, total,
                                divisor);
                            b.arraySet(days, index, total,
                                member);
                        }
                    });
                });
            });
            const stamp = timestamp(day);
            const dateString = value(date(stamp, 'iso'));
            dayText.read(dateString);
            b.set(dayText.length, 10);
            const handle = cell();
            dayText.intern(handle);
            b.arraySet(days, index, handle, 6);
            b.copy(handle, value(date(stamp,
                '{"month":"short","day":"numeric","timeZone":"UTC"}')));
            b.arraySet(days, index, handle, 5);
        });
        return { days, currentStreak, longestStreak, measuredDays, today };
    };

    const startsWith = (buffer, literal) => {
        const match = cell(1);
        b.if(lt(buffer.length, literal.length), () => b.set(match, 0));
        const char = cell();
        for (let index = 0; index < literal.length; index++) {
            b.arrayGet(buffer.data, index, char);
            b.if(eq(char, literal.codePointAt(index)), () => {}, () => b.set(match, 0));
        }
        return match;
    };
    const contains = (buffer, literal) => {
        const found = cell();
        const char = cell();
        b.repeat(buffer.length, offset => {
            const end = cell(offset);
            b.add(end, literal.length);
            b.if(lt(buffer.length, end), () => {}, () => {
                const match = cell(1);
                for (let index = 0; index < literal.length; index++) {
                    const at = cell(offset);
                    b.add(at, index);
                    b.arrayGet(buffer.data, at, char);
                    b.if(eq(char, literal.codePointAt(index)), () => {},
                        () => b.set(match, 0));
                }
                b.if(match, () => b.set(found, 1));
            });
        });
        return found;
    };
    const sessionLabel = entry => {
        const id = value(field(entry, 'lessonId'));
        idText.read(id);
        labelText.clear();
        const known = cell();
        arena.field(known, field(constants.contentRoot, 'sessionLabels'), id);
        b.if(eq(id, strings.custom), () => labelText.literal('Custom text'),
            () => b.if(eq(id, strings['missed-words']), () => labelText.literal(
                    'Missed words'),
                () => b.if(known, () => labelText.handle(value(known)),
                    () => b.if(startsWith(idText, 'quote-'), () => {
                        const legacy = cell(1);
                        b.if(eq(idText.length, 6), () => b.set(legacy, 0));
                        const char = cell();
                        b.repeat(idText.length, index => b.if(lt(index, 6), () => {},
                            () => {
                                b.arrayGet(idText.data, index, char);
                                b.if(lt(char, 48), () => b.set(legacy, 0));
                                b.if(lt(57, char), () => b.set(legacy, 0));
                            }));
                        b.if(legacy, () => labelText.literal(
                                'Quote · legacy selection'),
                            () => labelText.literal('Quote · practice'));
                    }, () => {
                        const mode = value(field(entry, 'testMode'));
                        const legacyMode = cell();
                        const countStart = cell();
                        for (const [prefix, name] of [['time-', 'time'], ['speed-',
                                    'time'],
                ['words-', 'words']]) b.if(startsWith(idText, prefix), () => {
                            b.set(legacyMode, strings[name]);
                            b.set(countStart, prefix.length);
                        });
                        legacyCountText.clear();
                        const char = cell();
                        const cursor = cell(countStart);
                        const more = cell();
                        b.if(countStart, () => b.copy(more, lt(cursor, idText.length)));
                        b.while(more, () => {
                            b.arrayGet(idText.data, cursor, char);
                            const digit = cell(1);
                            b.if(lt(char, 48), () => b.set(digit, 0));
                            b.if(lt(57, char), () => b.set(digit, 0));
                            b.if(digit, () => {
                                legacyCountText.point(char);
                                b.add(cursor, 1);
                                b.lt(more, cursor, idText.length);
                            }, () => b.set(more, 0));
                        });
                        b.if(eq(cursor, countStart), () => b.set(legacyMode, 0));
                        b.if(mode, () => {}, () => b.copy(mode, legacyMode));
                        b.if(mode, () => {
                            const amount = cell();
                            b.if(eq(mode, strings.time), () => b.copy(amount,
                                    field(entry, 'testDuration')), () => b
                                .copy(amount,
                                    field(entry, 'testWordCount')));
                            const actual = cell();
                            b.if(amount, () => b.copy(actual, finitePositive(
                                amount)));
                            b.if(actual, () => labelText.copy(format(amount, 0,
                                    'string')),
                                () => b.if(legacyCountText.length, () =>
                                    labelText.copy(legacyCountText),
                                    () => labelText.literal('undefined')));
                            b.if(eq(mode, strings.time), () => labelText
                                .literal(' seconds'),
                                () => labelText.literal(' words'));
                            b.if(eq(value(field(entry, 'typingMode')), strings
                                    .strict),
                                () => labelText.literal(' · guided'));
                            for (const name of ['punctuation', 'numbers']) {
                                const enabled = value(field(entry, name));
                                b.if(contains(idText, `-${name}`), () => b.set(
                                    enabled, 1));
                                b.if(enabled, () => labelText.literal(
                                    ` · ${name}`));
                            }
                        }, () => b.repeat(idText.length, index => {
                            b.arrayGet(idText.data, index, char);
                            b.if(eq(char, 45), () => labelText.point(32),
                                () => labelText.point(char));
                        }));
                    }))));
        return labelText;
    };

    const elapsedText = entry => {
        const milliseconds = elapsed(entry);
        scratch.clear();
        b.if(milliseconds, () => {
            b.if(finitePositive(milliseconds), () => {
                const seconds = math('divideNumber', milliseconds, number(
                    1000));
                const digits = cell(2);
                b.if(eq(compare(seconds, number(1)), -1), () => b.set(digits,
                    3));
                format(seconds, digits, 'fixed', true);
                const zero = startsWith(scratch, '0');
                b.if(eq(scratch.length, 1), () => b.if(zero,
                    () => format(seconds, 3, 'precision', true)));
                scratch.literal('s');
            }, () => scratch.literal('0s'));
        }, () => scratch.literal('—'));
        return scratch;
    };

    const roundedMaximum = node => {
        const input = uint64(b, `history_max_input_${serial++}`);
        const ten = uint64(b, `history_max_ten_${serial++}`, 10n);
        const one = uint64(b, `history_max_one_${serial++}`, 1n);
        const quotient = uint64(b, `history_max_quotient_${serial++}`);
        const remainder = uint64(b, `history_max_remainder_${serial++}`);
        fromPair64(b, input, read(node, 'numberLo'), read(node, 'numberHi'));
        div64(b, quotient, remainder, input, ten);
        const more = read(node, 'fraction');
        for (const digit of remainder.digits) b.if(digit, () => b.set(more, 1));
        b.if(more, () => add64(b, quotient, quotient, one));
        mul64(b, quotient, quotient, ten);
        const low = cell();
        const high = cell();
        toPair64(b, low, high, quotient);
        const rounded = cell();
        arena.number(rounded, low, high);
        const out = cell();
        numbers.maxNumber(out, number(20), rounded);
        return out;
    };
    const fixedCoordinate = scaled => {
        coordinate.clear();
        const whole = cell();
        const decimal = cell();
        b.divmod(whole, decimal, scaled, 1000000);
        coordinate.unsigned(whole);
        b.if(decimal, () => {
            coordinate.literal('.');
            const divisor = cell(100000);
            const digit = cell();
            const rest = cell();
            b.repeat(6, () => {
                b.divmod(digit, rest, decimal, divisor);
                b.add(digit, 48);
                coordinate.point(digit);
                b.copy(decimal, rest);
                b.divmod(divisor, rest, divisor, 10);
            });
            const index = cell(coordinate.length);
            b.sub(index, 1);
            const last = cell();
            b.arrayGet(coordinate.data, index, last);
            const trim = eq(last, 48);
            b.while(trim, () => {
                b.sub(coordinate.length, 1);
                b.sub(index, 1);
                b.arrayGet(coordinate.data, index, last);
                b.eq(trim, last, 48);
            });
        });
        return coordinate;
    };
    const renderProgress = () => {
        emitTemplate(b, 'progress', '#bf-history-progress');
        for (const [selector, amount] of [['#bf-current-streak', currentStreak],
            ['#bf-longest-streak', longestStreak]]) {
            output.clear();
            output.unsigned(amount);
            output.literal(' <small>');
            b.if(eq(amount, 1), () => output.literal('day'), () => output.literal('days'));
            output.literal('</small>');
            html(selector, output);
        }
        b.if(measuredDays, () => {
            html('#bf-progress-charts', trendCharts.join(''));
            const maxWpm = number(0);
            const measured = cell();
            const mean = cell();
            b.repeat(14, index => {
                b.arrayGet(days, index, measured, 2);
                b.if(measured, () => {
                    b.arrayGet(days, index, mean, 3);
                    numbers.maxNumber(maxWpm, maxWpm, mean);
                });
            });
            const maximum = roundedMaximum(maxWpm);
            for (const [metric, member, unit, cap] of [['wpm', 3, '', maximum],
                ['accuracy', 4, '%', number(100)]]) {
                output.clear();
                appendNumber(cap, 0, 'fixed');
                output.literal(unit);
                text(`#bf-${metric}-max`, output);
                output.clear();
                output.literal(metric === 'wpm' ? 'WPM' : 'Accuracy');
                output.literal(' daily averages. Vertical axis: 0 to ');
                appendNumber(cap, 0, 'fixed');
                output.literal(`${unit}.`);
                attribute(`#bf-trend-${metric}`, 'aria-label', output);
                const first = cell();
                const last = cell();
                b.arrayGet(days, 0, first, 5);
                b.arrayGet(days, 13, last, 5);
                output.read(first);
                text(`#bf-${metric}-first-day`, output);
                output.read(last);
                text(`#bf-${metric}-last-day`, output);
                output.clear();
                const previousMeasured = cell();
                const previousX = cell();
                const previousY = cell();
                b.repeat(14, index => {
                    b.arrayGet(days, index, measured, 2);
                    b.if(measured, () => {
                        b.arrayGet(days, index, mean, member);
                        const x = cell();
                        const quotient = cell();
                        b.mul(x, index, 100000000);
                        b.divmod(x, quotient, x, 13);
                        const y = cell();
                        numbers.ratio(y, mean, cap, 100000000);
                        const inverted = cell(100000000);
                        b.sub(inverted, y);
                        output.literal('<g>');
                        b.if(previousMeasured, () => {
                            output.literal(
                                '<polyline points="');
                            output.copy(fixedCoordinate(
                                previousX));
                            output.literal(',');
                            output.copy(fixedCoordinate(
                                previousY));
                            output.literal(' ');
                            output.copy(fixedCoordinate(x));
                            output.literal(',');
                            output.copy(fixedCoordinate(
                                inverted));
                            output.literal(
                                '" vector-effect="non-scaling-stroke"></polyline>'
                            );
                        });
                        output.literal('<path d="M');
                        output.copy(fixedCoordinate(x));
                        output.literal(' ');
                        output.copy(fixedCoordinate(inverted));
                        output.literal(
                            'l0 0" stroke="var(--accent)" stroke-width="5" '
                            +
                            'stroke-linecap="round" vector-effect="non-scaling-stroke"><title>'
                        );
                        const label = cell();
                        b.arrayGet(days, index, label, 5);
                        output.handle(label, true);
                        output.literal(': ');
                        appendNumber(mean, 1, 'fixed');
                        output.literal(`${unit}</title></path></g>`);
                        b.copy(previousX, x);
                        b.copy(previousY, inverted);
                    });
                    b.copy(previousMeasured, measured);
                });
                html(`#bf-trend-points-${metric}`, output);
            }
        }, () => {
            b.write(34);
            b.writeString('#bf-progress-charts');
            b.writeString('progress-charts');
            b.write(0);
            html('#bf-progress-charts', '<p class="field-help">Finish a session ' +
                'with measured typing time to see daily averages.</p>');
        });
        b.if(eq(measuredDays, 1), () => {
                b.write(35);
                b.writeString('#bf-progress-note');
                b.writeString('hidden');
                text('#bf-progress-note', 'One day of measured scores; no trend yet.');
            },
            () => text('#bf-progress-note', ''));
        output.clear();
        b.repeat(14, index => {
            const label = cell();
            const date = cell();
            const sessions = cell();
            const measured = cell();
            const mean = cell();
            b.arrayGet(days, index, label, 5);
            b.arrayGet(days, index, date, 6);
            b.arrayGet(days, index, sessions, 1);
            b.arrayGet(days, index, measured, 2);
            output.literal('<tr><th scope="row"><time datetime="');
            output.handle(date, true);
            output.literal('">');
            output.handle(label, true);
            output.literal('</time></th><td>');
            output.unsigned(sessions);
            output.literal('</td>');
            for (const [member, unit] of [[3, ''], [4, '%']]) {
                output.literal('<td>');
                b.if(measured, () => {
                    b.arrayGet(days, index, mean, member);
                    appendNumber(mean, 1, 'fixed');
                    output.literal(unit);
                }, () => output.literal('—'));
                output.literal('</td>');
            }
            output.literal('</tr>');
        });
        html('#bf-daily-rows', output);
    };

    const renderHistory = (history, now, saveFailed = 0, target = '#bf-dialog-body') => {
        b.copy(rowCount, count(history));
        b.if(rowCount, () => {
            emitTemplate(b, 'history', target);
            progress(history, now);
            renderProgress();
            output.clear();
            output.literal('Last ');
            output.unsigned(rowCount);
            output.literal(' sessions · ');
            b.if(saveFailed, () => output.literal('saving unavailable'),
                () => output.literal('stored on this device'));
            text('#bf-history-caption', output);
            html('#bf-history-rows', '');
            arena.each(history, entry => {
                output.clear();
                output.literal('<tr><td>');
                output.copy(sessionLabel(entry), true);
                const reason = value(field(entry, 'recordReason'));
                b.if(reason, () => {
                    output.literal('<small class="history-note">');
                    output.handle(reason, true);
                    output.literal('</small>');
                });
                output.literal('</td><td>');
                appendNumber(field(entry, 'wpm'));
                output.literal(' / ');
                const raw = field(entry, 'rawWpm');
                b.if(eq(read(raw, 'type'), TYPE.NUMBER), () => appendNumber(
                        raw),
                    () => output.literal('—'));
                output.literal('<small class="history-note">');
                b.if(eq(value(field(entry, 'wpmMetric')), strings['words-v1']),
                    () => output.literal('Correct-word scoring'),
                    () => output.literal('Earlier scoring'));
                output.literal('</small></td><td>');
                appendNumber(field(entry, 'accuracy'));
                output.literal('%</td><td>');
                output.copy(elapsedText(entry));
                output.literal('</td><td>');
                const savedDate = field(entry, 'date');
                b.if(eq(read(savedDate, 'type'), TYPE.STRING), () =>
                    output.handle(value(date(savedDate,
                            '{"month":"short","day":"numeric"}')),
                        true), () => output.literal('—'));
                output.literal('</td></tr>');
                appendHtml('#bf-history-rows', output);
            });
        }, () => emitTemplate(b, 'emptyHistory', target));
        return { days, currentStreak, longestStreak, measuredDays, rowCount };
    };
    return {
        renderHistory,
        historyProgress: progress,
        sessionLabel,
        elapsedText,
        days,
        currentStreak,
        longestStreak,
        measuredDays,
        rowCount,
        output
    };
}
