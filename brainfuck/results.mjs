import { textBuffer } from './text.mjs';
import { uint64, fromPair64, toPair64, div64 } from './runtime.mjs';
import { layouts } from './content.mjs';
import { templates, cards, keyboards, speedChart, emitTemplate, emitStatic,
    emitText, emitAttribute } from './view.mjs';

/** Build-time macros. Result decisions, arithmetic and markup execute as Brainfuck. */
export function defineResults(b, arena, { engine: e, state, practice, storage,
    numbers, keys, contentRoot, metadata, wpmHigh = 0 }) {
    const text = textBuffer(b, 'results:text', 300000);
    const formatted = textBuffer(b, 'results:formatted', 128);
    const selector = textBuffer(b, 'results:selector', 512);
    const label = textBuffer(b, 'results:label', 2048);
    const samples = b.array('results:samples', e.samples.capacity, [], 4);
    const ranked = b.array('results:ranked', 95);
    const errorsUsed = b.array('results:errorsUsed', 5);
    const projectedLearning = b.scalar('results:projectedLearning');
    const advance = b.scalar('results:advance');
    const hasNext = b.scalar('results:hasNext');
    const resultLayout = b.scalar('results:layout');
    const physical = b.scalar('results:physical');
    const downloadSerial = b.scalar('results:downloadSerial');
    const downloadGeneration = b.scalar('results:downloadGeneration');
    const time = uint64(b, 'results:time');
    const quotient = uint64(b, 'results:quotient');
    const remainder = uint64(b, 'results:remainder');
    const field = (out, root, name) => arena.field(out, root, keys[name]);
    const value = (out, root, name, part = 'value') => {
        field(out, root, name); arena.get(out, part, out);
    };
    const equal = (left, right, yes, no) => b._temps(1, flag => {
        b.eq(flag, left, right); b.if(flag, yes, no);
    });
    // The host collects unreachable tokens after the complete Brainfuck transaction.
    const temporary = body => body();
    const property = (target, name, node) => {
        b.write(25); b.writeString(target); b.writeString(name); b.write(node);
    };
    const booleanProperty = (target, name, flag) => b._temps(1, node => {
        arena.boolean(node, flag); property(target, name, node);
    });
    const attribute = (target, name, buffer = text) => {
        b.write(4); b.writeString(target); b.writeString(name); b.writeString(buffer);
    };
    const dynamicAttribute = (name, buffer = text) => {
        b.write(4); b.writeString(selector); b.writeString(name); b.writeString(buffer);
    };
    const focus = target => { b.write(7); b.writeString(target); };
    const appendNumber = (node, digits = 0, trim = true, out = text) => {
        numbers.format(formatted, node, digits, trim); out.copy(formatted);
    };
    const numberText = (target, node, digits = 0) => {
        text.clear(); appendNumber(node, digits); text.emit(3, target);
    };
    const appendField = (root, name, out = text, escape = false) => b._temps(1, handle => {
        value(handle, root, name); out.handle(handle, escape);
    });
    const appendElapsed = (milliseconds, out = text) => b._temps(4,
        (seconds, divisor, small, zero) => {
            numbers.constant(divisor, 1000); numbers.divideNumber(seconds, milliseconds, divisor);
            numbers.constant(divisor, 1); numbers.compareNumbers(small, seconds, divisor);
            numbers.constant(divisor, 0); numbers.compareNumbers(zero, seconds, divisor);
            equal(zero, 1, () => {
                equal(small, -1, () => numbers.format(formatted, seconds, 3, true),
                    () => numbers.format(formatted, seconds, 2, true));
                // The engine clock is integral microseconds; retain a nonzero sub-ms time.
                equal(formatted.length, 1, () => b._temps(1, char => {
                    b.arrayGet(formatted.data, 0, char);
                    equal(char, 48, () => numbers.format(formatted, seconds, 6, true));
                }));
                out.copy(formatted);
            }, () => out.literal('0'));
            out.literal('s');
        });
    const button = (label, event, primary = false, id = '') => text.literal(
        `<button type="button" data-event="${event}" class="${primary ? 'primary' : 'text'}-button"` +
        `${id ? ` id="${id}"` : ''}>${label}</button>`);
    const layoutNode = out => {
        const { at } = practice.helpers;
        field(out, contentRoot, 'layouts'); b.copy(out, at(out, resultLayout));
    };
    const chooseLayout = () => b._temps(1, preset => {
        value(preset, metadata, 'keyboardLayout'); b.set(resultLayout, 0);
        layouts.forEach((layout, index) => equal(preset, keys[layout.id],
            () => b.set(resultLayout, index)));
    });

    const recordSpeedSample = (final = false) => b._temps(9,
        (valid, second, previousSecond, ignored, last, low, high, take, same) => {
            b.truth(valid, e.elapsed); b.if(e.elapsedHi, () => b.set(valid, 1));
            b.if(valid, () => {
                fromPair64(b, time, e.elapsed, e.elapsedHi);
                div64(b, quotient, remainder, time, 1000000);
                toPair64(b, second, ignored, quotient);
                b.set(previousSecond, 0); b.set(same, 0);
                b.if(e.sampleCount, () => {
                    b.copy(last, e.sampleCount); b.sub(last, 1);
                    b.arrayGet(samples, last, low, 0); b.arrayGet(samples, last, high, 1);
                    b.eq(same, low, e.elapsed); b.eq(take, high, e.elapsedHi); b.mul(same, same, take);
                    fromPair64(b, time, low, high);
                    div64(b, quotient, remainder, time, 1000000);
                    toPair64(b, previousSecond, ignored, quotient);
                });
                if (final) b.set(take, 1);
                else {
                    b.eq(take, second, previousSecond); b.not(take, take);
                    b.if(second, () => {}, () => b.set(take, 0));
                }
                b.if(take, () => {
                    b.copy(last, e.sampleCount);
                    if (final) b.if(same, () => b.sub(last, 1));
                    b.lt(valid, last, samples.capacity);
                    b.if(valid, () => {}, () => b.set(last, samples.capacity - 1));
                    b.arraySet(samples, last, e.elapsed, 0); b.arraySet(samples, last, e.elapsedHi, 1);
                    b.arraySet(samples, last, e.wpm, 2); b.arraySet(samples, last, wpmHigh, 3);
                    if (final) b.if(state.result, () => {
                        field(low, state.result, 'wpm'); arena.get(high, 'numberHi', low);
                        arena.get(low, 'numberLo', low); b.arraySet(samples, last, low, 2);
                        b.arraySet(samples, last, high, 3);
                    });
                    b.copy(e.sampleCount, last); b.add(e.sampleCount, 1);
                });
            });
        });

    const observation = (cell, recent = false) => b._temps(9,
        (attempts, errors, timed, total, rate, number, flag, sparse, low) => {
            field(attempts, cell, 'attempts'); field(errors, cell, 'errors');
            field(timed, cell, 'latencySamples'); numbers.constant(number, 0);
            numbers.compareNumbers(flag, attempts, number);
            equal(flag, 1, () => {
                if (recent) field(rate, cell, 'recentErrorRate');
                else numbers.divideNumber(rate, errors, attempts);
                numbers.constant(number, 100); numbers.multiplyNumbers(rate, rate, number);
                appendNumber(rate, 1, false); text.literal(recent ? '% recent errors, ' : '% errors, ');
                numbers.constant(number, 0); numbers.compareNumbers(flag, timed, number);
                equal(flag, 1, () => {
                    if (recent) field(total, cell, 'recentLatencyMs');
                    else {
                        field(total, cell, 'latencyTotalMs'); numbers.divideNumber(total, total, timed);
                    }
                    appendNumber(total); text.literal(recent ? ' ms recent reach' : ' ms reach');
                }, () => text.literal('no reach timing yet'));
                if (!recent) {
                    text.literal(' · '); appendNumber(errors); text.literal('/'); appendNumber(attempts);
                    text.literal(' errors · '); appendNumber(timed); text.literal(' timed');
                }
                numbers.constant(number, 5); numbers.compareNumbers(sparse, attempts, number);
                b.eq(sparse, sparse, -1); numbers.compareNumbers(low, timed, number);
                equal(flag, 1, () => equal(low, -1, () => b.set(sparse, 1)));
                b.if(sparse, () => text.literal(' · few observations'));
            }, () => text.literal('No observations yet.'));
        });

    const feedback = () => b._temps(11,
        (track, node, target, flag, valid, next, count, index, record, failed, duration) => {
            b.set(advance, 0); b.set(hasNext, 0); value(track, metadata, 'track');
            equal(track, keys.lesson, () => {
                layoutNode(node); field(node, node, 'lessons'); value(target, metadata, 'lessonTrack');
                arena.field(node, node, target); b.copy(count, practice.helpers.count(node));
                value(index, metadata, 'lessonIndex', 'numberLo'); b.add(index, 1);
                b.lt(hasNext, index, count);
            });
            text.clear(); text.literal('Choose ');
            b.if(e.missedCount, () => text.literal('Practice missed words or '));
            b.eq(flag, track, keys.test); b.eq(valid, track, keys.quote); b.add(flag, valid);
            b.if(flag, () => text.literal('Repeat this text.'), () => text.literal('Try again.'));
            label.clear(); label.copy(text);
            emitText(b, '#bf-result-heading', 'Test complete.');
            text.clear(); text.copy(label); text.literal(' You can also start a fresh passage.');
            equal(track, keys.lesson, () => {
                field(target, metadata, 'targetWpm'); field(node, state.result, 'wpm');
                numbers.compareNumbers(flag, node, target);
                equal(flag, -1, () => {
                    emitText(b, '#bf-result-heading', 'Accuracy target met.');
                    text.clear(); text.literal('Aim for '); appendNumber(target);
                    text.literal(' WPM for 3 stars. Choose Try again.');
                }, () => {
                    b.set(advance, 1); emitText(b, '#bf-result-heading', 'Lesson target reached.');
                    text.clear(); text.literal('Select “');
                    b.if(hasNext, () => text.literal('Next lesson'), () => text.literal('Choose a lesson'));
                    text.literal('” to keep learning.');
                });
            });
            field(node, metadata, 'options'); field(record, node, 'recordEligible');
            arena.get(node, 'type', record); arena.get(record, 'value', record);
            b.eq(failed, track, keys.custom); b.eq(flag, track, keys.retry); b.add(failed, flag);
            equal(node, 2, () => b.if(record, () => {}, () => b.set(failed, 1)));
            b.if(failed, () => {
                b.set(advance, 0); emitText(b, '#bf-result-heading', 'Practice complete.');
                text.clear(); text.copy(label);
            });
            equal(track, keys.weak, () => {
                b.set(advance, 0); emitText(b, '#bf-result-heading', 'Practice complete.');
                text.clear(); text.literal('Review your focus below.');
            });
            field(target, metadata, 'targetAccuracy');
            b.if(target, () => {}, () => numbers.constant(target, 95));
            numbers.constant(node, 0); numbers.compareNumbers(flag, target, node);
            equal(flag, 0, () => numbers.constant(target, 95));
            field(node, state.result, 'accuracy'); numbers.compareNumbers(flag, node, target);
            equal(flag, -1, () => {
                b.set(advance, 0); emitText(b, '#bf-result-heading', 'Accuracy comes first.');
                text.clear(); text.literal('Aim for '); appendNumber(target);
                text.literal('% accuracy. '); text.copy(label);
            });
            b.if(e.skipped, () => {
                b.set(advance, 0); emitText(b, '#bf-result-heading', 'Finish each word.');
                text.clear(); text.literal('Type every character before Space. '); text.copy(label);
            });
            b.truth(duration, e.elapsed); b.if(e.elapsedHi, () => b.set(duration, 1));
            b.if(duration, () => {}, () => {
                b.set(advance, 0); emitText(b, '#bf-result-heading', 'Too short to measure.');
                text.clear(); text.literal('Use a longer passage and try again.');
            });
            b.if(e.nonSpace, () => {}, () => {
                b.set(advance, 0); emitText(b, '#bf-result-heading', 'Let’s try that again.');
                text.clear(); b.if(e.skipped,
                    () => text.literal('Type each word before pressing Space.'),
                    () => { text.literal('Follow the displayed text. '); text.copy(label); });
            });
            text.emit(3, '#bf-result-advice');
            equal(track, keys.lesson, () => {
                text.clear(); b.if(advance, () => b.if(hasNext,
                    () => button('Next lesson', 'nextLesson', true, 'bf-result-primary'),
                    () => button('Choose a lesson', 'lessons', true, 'bf-result-primary')),
                () => button('Try again', 'restart', true, 'bf-result-primary'));
                text.emit(1, '#bf-lesson-action');
            });
        });

    const comparison = () => b._temps(9,
        (before, observed, original, group, cell, handle, same, found, count) => {
            emitTemplate(b, 'practiceResults', '#bf-practice-comparison');
            field(before, metadata, 'learningBefore'); field(observed, state.result, 'learning');
            value(group, metadata, 'focusGroup'); arena.field(before, before, group);
            arena.field(observed, observed, group); field(original, metadata, 'focusKeys');
            text.clear();
            arena.each(original, key => temporary(() => {
                arena.get(handle, 'value', key); text.literal('<tr><th scope="row">');
                practice.focusLabel(handle, cell); text.handle(cell, true); text.literal('</th><td>');
                arena.field(cell, before, handle); observation(cell, true); text.literal('</td><td>');
                arena.field(cell, observed, handle); observation(cell); text.literal('</td></tr>');
            }));
            text.emit(1, '#bf-comparison-rows');
            equal(group, keys.bigrams, () => practice.focusKeys(projectedLearning, 1, 1),
                () => practice.focusKeys(projectedLearning, 3, 0));
            b.copy(count, practice.helpers.count(original)); b.eq(same, count, practice.focusCount);
            text.clear();
            b.if(practice.focusCount, () => {
                text.literal('Next focus: ');
                b.repeat(practice.focusCount, index => {
                    b.if(index, () => text.literal(' · ')); b.arrayGet(practice.focus, index, handle);
                    practice.focusLabel(handle, cell); text.handle(cell);
                    b.set(found, 0); arena.each(original, key => {
                        arena.get(cell, 'value', key); equal(cell, handle, () => b.set(found, 1));
                    });
                    b.if(found, () => {}, () => b.set(same, 0));
                });
            }, () => {
                text.literal('No focus suggested. Choose a lesson or try again.');
                emitText(b, '#bf-next-drill', 'Choose a lesson');
                emitAttribute(b, '#bf-next-drill', 'data-event', 'lessons');
            });
            text.emit(3, '#bf-next-focus'); text.clear();
            b.if(practice.focusCount, () => {
                text.literal('Recent errors and relative reach times ');
                b.if(same, () => text.literal('still suggest this focus.'),
                    () => text.literal('now suggest a different focus.'));
                text.literal(' Based on earlier observations plus this drill.');
            });
            text.emit(3, '#bf-next-focus-advice');
        });

    const speed = () => b._temps(13,
        (duration, maximum, node, low, high, sampleTime, sampleWpm, x, y, factor,
            divisor, flag, checkpoint) => {
            field(duration, state.result, 'elapsedMilliseconds');
            b.truth(flag, e.elapsed); b.if(e.elapsedHi, () => b.set(flag, 1));
            b.if(flag, () => b.copy(flag, e.sampleCount), () => {});
            b.if(flag, () => {
                b.write(1); b.writeString('#bf-result-chart'); b.writeString(speedChart);
                numbers.constant(maximum, 20);
                b.repeat(e.sampleCount, index => {
                    b.arrayGet(samples, index, low, 2); b.arrayGet(samples, index, high, 3);
                    arena.number(node, low, high); numbers.compareNumbers(flag, node, maximum);
                    equal(flag, 1, () => b.copy(maximum, node));
                });
                numberText('#bf-speed-max', maximum);
                numbers.constant(divisor, 2); numbers.divideNumber(node, maximum, divisor);
                numberText('#bf-speed-half', node, 1);
                text.clear(); appendElapsed(duration); text.emit(3, '#bf-speed-duration');
                equal(e.sampleCount, 1, () => emitText(b, '#bf-sample-note', ' One sample; no trend available.'));
                text.clear(); text.unsigned(e.sampleCount); text.literal(' speed ');
                equal(e.sampleCount, 1, () => text.literal('sample'), () => text.literal('samples'));
                text.literal(' over '); appendElapsed(duration); text.literal('. Vertical axis: 0 to ');
                appendNumber(maximum); text.literal(' WPM.'); attribute('#bf-speed-chart', 'aria-label');
                const coordinates = index => {
                    b.arrayGet(samples, index, low, 0); b.arrayGet(samples, index, high, 1);
                    arena.number(sampleTime, low, high); numbers.constant(divisor, 1000);
                    numbers.divideNumber(sampleTime, sampleTime, divisor);
                    b.arrayGet(samples, index, low, 2); b.arrayGet(samples, index, high, 3);
                    arena.number(sampleWpm, low, high); numbers.constant(factor, 100);
                    numbers.divideNumber(x, sampleTime, duration); numbers.multiplyNumbers(x, x, factor);
                    numbers.divideNumber(y, sampleWpm, maximum); numbers.multiplyNumbers(y, y, factor);
                    numbers.subtractNumbers(y, factor, y);
                };
                text.clear(); b.repeat(e.sampleCount, index => temporary(() => {
                    coordinates(index); b.if(index, () => text.literal(' '));
                    appendNumber(x, 6); text.literal(','); appendNumber(y, 6);
                })); attribute('#bf-speed-line', 'points');
                b.repeat(e.sampleCount, index => temporary(() => {
                    coordinates(index); text.clear(); text.literal('<path d="M');
                    appendNumber(x, 6); text.literal(' '); appendNumber(y, 6);
                    text.literal('l0 0" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" ' +
                        'vector-effect="non-scaling-stroke"><title>');
                    appendElapsed(sampleTime); text.literal(': '); appendNumber(sampleWpm);
                    text.literal(' wpm</title></path>'); text.emit(2, '#bf-speed-points');
                }));
                text.clear(); b.repeat(e.sampleCount, index => temporary(() => {
                    coordinates(index); b.if(index, () => text.literal(' · '));
                    appendElapsed(sampleTime); text.literal(': '); appendNumber(sampleWpm); text.literal(' wpm');
                })); text.emit(3, '#bf-speed-samples');
            }, () => {
                text.clear(); text.literal('<p class="chart-empty">');
                b.truth(flag, e.elapsed); b.if(e.elapsedHi, () => b.set(flag, 1));
                b.if(flag, () => text.literal('No speed samples were recorded.'),
                    () => text.literal('No measured typing time.'));
                text.literal('</p>'); text.emit(1, '#bf-result-chart');
            });
        });

    const collectPhysical = () => b._temps(7,
        (learning, mapping, code, previous, total, old, node) => {
            arena.object(physical); field(learning, state.result, 'learning'); field(learning, learning, 'keys');
            layoutNode(mapping); field(mapping, mapping, 'charToCode');
            arena.each(learning, (cell, key) => {
                arena.field(code, mapping, key); arena.get(code, 'value', code);
                b.if(code, () => {
                    arena.field(previous, physical, code);
                    b.if(previous, () => {}, () => arena.object(previous));
                    for (const name of ['attempts', 'errors', 'latencySamples', 'latencyTotalMs']) {
                        field(total, cell, name); field(old, previous, name);
                        b.if(old, () => {}, () => numbers.constant(old, 0));
                        numbers.addNumbers(node, total, old); arena.setField(previous, keys[name], node);
                    }
                    arena.setField(physical, code, previous);
                });
            });
        });
    const heat = (card = false) => b._temps(8,
        (attempts, errors, total, timed, rate, strength, number, flag) => {
            if (!card) emitAttribute(b, '#bf-heatmap [data-code]', 'title', 'Not tried in this session');
            arena.each(physical, (cell, code) => temporary(() => {
                field(attempts, cell, 'attempts'); field(errors, cell, 'errors');
                numbers.constant(number, 0); numbers.compareNumbers(flag, attempts, number);
                equal(flag, 1, () => {
                    selector.clear(); selector.literal(card ? '#bf-card [data-card-code="' : '#bf-heatmap [data-code="');
                    selector.handle(code); selector.literal(card ? '"] .card-key-heat' : '"]');
                    numbers.divideNumber(rate, errors, attempts);
                    numbers.compareNumbers(flag, errors, number);
                    text.clear(); equal(flag, 1, () => text.literal('var(--error)'),
                        () => text.literal('var(--accent)'));
                    if (card) {
                        dynamicAttribute('fill'); dynamicAttribute('stroke');
                        text.clear(); text.literal('2'); dynamicAttribute('stroke-width');
                    } else {
                        b.write(34); b.writeString(selector); b.writeString('key-measured'); b.write(1);
                        b.write(5); b.writeString(selector); b.writeString('--key-heat'); b.writeString(text);
                    }
                    equal(flag, 1, () => {
                        numbers.constant(number, card ? 0.30 : 30);
                        numbers.multiplyNumbers(strength, rate, number);
                        numbers.constant(number, card ? 0.12 : 12);
                        numbers.addNumbers(strength, strength, number);
                    }, () => numbers.constant(strength, card ? 0.22 : 22));
                    text.clear(); appendNumber(strength, card ? 6 : 0);
                    if (card) dynamicAttribute('fill-opacity');
                    else {
                        text.literal('%'); b.write(5); b.writeString(selector);
                        b.writeString('--key-heat-strength'); b.writeString(text);
                        text.clear(); equal(code, keys.Space, () => text.literal('Space'),
                            () => text.handle(code)); text.literal(': '); appendNumber(errors);
                        numbers.constant(number, 1); numbers.compareNumbers(flag, errors, number);
                        equal(flag, 0, () => text.literal(' error · '), () => text.literal(' errors · '));
                        appendNumber(attempts); text.literal(' attempts · ');
                        field(timed, cell, 'latencySamples'); numbers.constant(number, 0);
                        numbers.compareNumbers(flag, timed, number);
                        equal(flag, 1, () => {
                            field(total, cell, 'latencyTotalMs'); numbers.divideNumber(total, total, timed);
                            appendNumber(total); text.literal(' ms average reach');
                        }, () => text.literal('reach not measured'));
                        dynamicAttribute('title');
                    }
                });
            }));
        });

    const keyMap = () => b._temps(12,
        (learning, group, count, best, bestHandle, bestRate, currentRate, rate,
            left, right, selected, flag) => {
            field(learning, state.result, 'learning'); field(group, learning, 'keys');
            arena.get(count, 'child', group);
            b.if(count, () => {
                emitTemplate(b, 'keyMap', '#bf-result-key-map');
                emitStatic(b, keyboards, resultLayout, '#bf-heatmap');
                text.clear(); layoutNode(group); appendField(group, 'label');
                text.literal(' · This session’s target keys, including skipped keys. Average reach measures ' +
                    'time between strokes; pauses and backspace gaps are excluded.');
                text.emit(3, '#bf-key-map-label'); collectPhysical(); heat();
                for (const [name, limit] of [['keys', 95], ['bigrams', 12]]) {
                    field(group, learning, name); b.set(count, 0); text.clear();
                    b.repeat(limit, () => {
                        b.set(best, 0); b.set(bestHandle, 0);
                        arena.each(group, (cell, key) => temporary(() => {
                            b.set(selected, 0); b.repeat(count, index => {
                                b.arrayGet(ranked, index, flag); equal(flag, key, () => b.set(selected, 1));
                            });
                            b.if(selected, () => {}, () => {
                                field(left, cell, 'errors'); field(right, cell, 'attempts');
                                numbers.divideNumber(currentRate, left, right);
                                b.if(best, () => {
                                    field(left, best, 'errors'); field(right, best, 'attempts');
                                    numbers.divideNumber(bestRate, left, right);
                                    numbers.compareNumbers(flag, currentRate, bestRate);
                                    equal(flag, 0, () => {
                                        field(left, cell, 'latencyTotalMs'); field(right, cell, 'latencySamples');
                                        numbers.constant(rate, 1); numbers.maxNumber(right, right, rate);
                                        numbers.divideNumber(currentRate, left, right);
                                        field(left, best, 'latencyTotalMs'); field(right, best, 'latencySamples');
                                        numbers.maxNumber(right, right, rate); numbers.divideNumber(bestRate, left, right);
                                        numbers.compareNumbers(flag, currentRate, bestRate);
                                    });
                                }, () => b.set(flag, 1));
                                equal(flag, 1, () => { b.copy(best, cell); b.copy(bestHandle, key); });
                            });
                        }));
                        b.if(best, () => temporary(() => {
                            b.arraySet(ranked, count, bestHandle); b.add(count, 1);
                            text.literal('<tr><td>');
                            b.write(24); b.write(bestHandle); b.read(selected);
                            b.repeat(selected, () => {
                                b.read(flag); equal(flag, 32, () => text.literal('␣'), () => text.escapePoint(flag));
                            });
                            text.literal('</td><td>'); field(left, best, 'attempts'); appendNumber(left);
                            text.literal('</td><td>'); field(left, best, 'errors'); appendNumber(left);
                            text.literal('</td><td>'); field(left, best, 'latencySamples');
                            numbers.constant(right, 0); numbers.compareNumbers(flag, left, right);
                            equal(flag, 1, () => {
                                field(right, best, 'latencyTotalMs'); numbers.divideNumber(left, right, left);
                                appendNumber(left); text.literal(' ms');
                            }, () => text.literal('—'));
                            text.literal('</td></tr>');
                        }));
                    }); text.emit(1, '#bf-key-map-' + name);
                }
            });
        });

    const focusErrors = () => b._temps(7, (best, count, point, chosen, used, flag, total) => {
        text.clear(); b.set(total, 0);
        b.repeat(5, () => {
            b.set(best, 0); b.set(chosen, 0);
            b.repeat(e.errorCount, index => {
                b.arrayGet(e.errorMap, index, point, 0); b.arrayGet(e.errorMap, index, count, 1);
                b.set(used, 0); b.repeat(total, row => {
                    b.arrayGet(errorsUsed, row, flag); equal(flag, point, () => b.set(used, 1));
                });
                b.lt(flag, best, count); b.if(used, () => b.set(flag, 0));
                b.if(flag, () => { b.copy(best, count); b.copy(chosen, point); });
            });
            b.if(best, () => {
                b.if(total, () => text.literal(' · '), () => text.literal('Focus keys: '));
                equal(chosen, 32, () => text.literal('space'), () => text.point(chosen));
                text.literal(' ('); text.unsigned(best); text.literal(')');
                b.arraySet(errorsUsed, total, chosen); b.add(total, 1);
            });
        });
        b.if(total, () => {}, () => text.literal('Every key in its place. No mistakes.'));
        text.emit(3, '#bf-result-focus');
    });

    const details = () => b._temps(4, (track, node, flag, low) => {
        value(track, metadata, 'track'); text.clear();
        text.literal('<div><span>test</span><strong>'); appendField(metadata, 'shortTitle', text, true);
        field(node, metadata, 'shortTitle'); b.if(node, () => {}, () => appendField(metadata, 'title', text, true));
        text.literal('</strong></div>');
        equal(track, keys.lesson, () => {
            text.literal('<div><span>stars this attempt</span><strong>');
            value(flag, state.result, 'saving'); b.if(flag, () => text.literal('Saving…'), () => {
                field(node, state.result, 'stars'); arena.get(flag, 'type', node);
                equal(flag, 3, () => { appendNumber(node); text.literal(' / 3'); }, () => text.literal('—'));
            });
            text.literal('</strong></div><div><span>3-star target</span><strong>');
            field(node, metadata, 'targetWpm'); appendNumber(node); text.literal(' WPM · ');
            field(node, metadata, 'targetAccuracy'); appendNumber(node); text.literal('%</strong></div>');
        });
        text.literal('<div><span>raw wpm</span><strong>'); field(node, state.result, 'rawWpm'); appendNumber(node);
        text.literal('</strong></div><div><span>consistency</span><strong>');
        field(node, state.result, 'consistency'); arena.get(flag, 'type', node);
        equal(flag, 3, () => { appendNumber(node); text.literal('%'); }, () => text.literal('Not enough data'));
        text.literal('</strong></div><div><span>time</span><strong>');
        field(node, state.result, 'elapsedMilliseconds'); appendElapsed(node);
        text.literal('</strong></div><div><span>errors / skipped</span><strong>');
        text.unsigned(e.errors); text.literal(' / '); text.unsigned(e.skipped);
        text.literal('</strong></div>'); text.emit(1, '#bf-result-details');
        text.clear(); appendField(state.result, 'recordReason'); text.emit(3, '#bf-record-reason');
        value(flag, state.result, 'saving'); b.if(flag,
            () => emitText(b, '#bf-result-save', 'Saving progress… You can start another test.'), () => {
                value(flag, state.result, 'saved'); b.if(flag,
                    () => emitText(b, '#bf-result-save', 'Progress saved on this device.'),
                    () => emitText(b, '#bf-result-save', 'Progress is in memory. Keep a backup before closing this page.'));
            });
        value(flag, state.result, 'isNewBestWpm'); b.not(flag, flag);
        booleanProperty('#bf-personal-best', 'hidden', flag);
    });

    const actions = () => b._temps(4, (track, node, flag, profile) => {
        value(track, metadata, 'track'); text.clear();
        equal(track, keys.lesson, () => {
            b.if(advance, () => button('Try again', 'restart'));
        }, () => equal(track, keys.test, () => {
            button('New test', 'restart', true); button('Repeat this text', 'repeat');
        }, () => equal(track, keys.quote, () => {
            button('Next quote', 'restart', true); button('Repeat this text', 'repeat');
        }, () => equal(track, keys.weak, () => button('Try again', 'restart'),
            () => button('Try again', 'restart', true)))));
        b.if(e.missedCount, () => text.literal(templates.missedButton));
        field(profile, storage.data, 'learning'); practice.focusKeys(profile, 3, 0);
        b.if(practice.focusCount, () => text.literal(templates.weakButton));
        equal(track, keys.lesson, () => b.if(advance, () => {}, () =>
            b.if(hasNext, () => button('Next lesson', 'nextLesson'))));
        text.literal(templates.downloadButton); text.emit(1, '#bf-result-actions');
        downloadPending(flag);
        booleanProperty('[data-event="download"]', 'disabled', flag);
        b.if(flag, () => emitText(b, '#bf-download-status', 'Preparing result card…'));
    });

    const focusPrimary = () => b.if(state.result, () => b._temps(1, track => {
        value(track, metadata, 'track');
        equal(track, keys.lesson, () => focus('#bf-result-primary'),
            () => equal(track, keys.weak, () => focus('#bf-next-drill'),
                () => focus('#bf-result-actions button')));
    }));

    const render = () => b._temps(5, (track, before, learning, checkpoint, saved) => {
        chooseLayout(); value(track, metadata, 'track'); b.set(projectedLearning, 0);
        equal(track, keys.weak, () => {
            field(before, metadata, 'learningBefore'); field(learning, state.result, 'learning');
            storage.mergeLearning(projectedLearning, before, learning);
        });
        emitTemplate(b, 'results', '#bf-body');
        feedback(); equal(track, keys.weak, comparison);
        field(saved, state.result, 'wpm'); numberText('#bf-result-wpm', saved);
        field(saved, state.result, 'accuracy'); numberText('#bf-result-accuracy', saved, 1);
        speed(); details(); focusErrors(); keyMap(); actions(); focusPrimary();
    });

    const downloadPending = out => b._temps(1, matches => {
        b.truth(out, state.pngEntry); b.eq(matches, downloadGeneration, state.generation);
        b.mul(out, out, matches); b.truth(matches, state.result); b.mul(out, out, matches);
    });

    const download = () => b.if(state.result, () => temporary(() => b._temps(8,
        (node, preferences, palette, theme, matched, root, svg, handle) => {
            b.add(downloadSerial, 1);
            equal(downloadSerial, 0xc0000000, () => b.set(downloadSerial, 1));
            b.copy(state.pngEntry, downloadSerial); b.add(state.pngEntry, 0x40000000);
            b.copy(downloadGeneration, state.generation);
            chooseLayout(); emitStatic(b, cards, resultLayout, '#bf-card-host');
            field(preferences, storage.data, 'settings'); value(palette, preferences, 'colorPalette');
            value(theme, preferences, 'theme'); equal(theme, keys.system, () => {
                b.write(16); b.writeString('(prefers-color-scheme: dark)'); b.write(0); b.read(matched);
                b.if(matched, () => b.set(theme, keys.dark), () => b.set(theme, keys.light));
            });
            field(root, contentRoot, 'palettes'); arena.field(root, root, palette);
            arena.field(root, root, theme); text.clear();
            for (const name of ['bg', 'surface', 'border', 'text', 'muted', 'accent', 'error']) {
                text.literal('--' + name + ':'); appendField(root, name); text.literal(';');
            }
            attribute('#bf-card', 'style');
            text.clear(); appendField(metadata, 'title'); text.emit(3, '#bf-card-title');
            field(node, state.result, 'wpm'); numberText('#bf-card-wpm', node);
            field(node, state.result, 'accuracy'); text.clear(); appendNumber(node, 1);
            text.literal('%'); text.emit(3, '#bf-card-accuracy');
            field(node, state.result, 'elapsedMilliseconds'); text.clear(); appendElapsed(node);
            text.emit(3, '#bf-card-time'); collectPhysical(); heat(true);
            emitText(b, '#bf-download-status', 'Preparing result card…');
            booleanProperty('[data-event="download"]', 'disabled', 1);
            b.write(27); b.writeString('#bf-card'); b.writeString('outerHTML'); b.write(0); b.read(svg);
            arena.get(handle, 'value', svg); text.read(handle);
            b.write(20); b.writeString('typeflow-result.png'); b.writeString(text);
            b.write(1200); b.write(780); b.write(state.pngEntry);
        })));
    const downloadComplete = (ok, requestId) => equal(requestId, state.pngEntry,
        () => b._temps(1, current => {
            downloadPending(current); b.set(state.pngEntry, 0);
            b.if(current, () => {
                booleanProperty('[data-event="download"]', 'disabled', 0);
                b.if(ok, () => emitText(b, '#bf-download-status', 'Result card downloaded.'),
                    () => emitText(b, '#bf-download-status', 'Could not create the result card. Try again.'));
            });
        }));
    const retainedRoots = writeId => writeId(projectedLearning);
    return { render, focusPrimary, download, downloadComplete, recordSpeedSample, projectedLearning,
        advance, hasNext, observation, samples, retainedRoots };
}
