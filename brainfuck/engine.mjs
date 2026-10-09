import { writeUnsigned, uint64, fromPair64, toPair64, sub64, add64 } from './runtime.mjs';

/** Every state transition is emitted as ordinary Brainfuck, including flow word edits. */
export function defineEngine(b) {
    const scalar = name => b.scalar('engine:' + name);
    const e = Object.fromEntries([
        'mode', 'line', 'index', 'length', 'lineCount', 'duration', 'remaining',
        'running', 'paused', 'complete', 'start', 'end', 'pauseAt', 'elapsed',
        'total', 'correct', 'netCorrect', 'wordCredit', 'nonSpace', 'netTyped',
        'errors', 'skipped', 'lastTime', 'hasLastTime', 'previous', 'linePrevious',
        'nowHi', 'startHi', 'endHi', 'pauseHi', 'elapsedHi', 'lastTimeHi', 'latencyHi',
        'timingBreak', 'intervalCount', 'intervalCursor', 'wpm', 'rawWpm', 'cpm',
        'accuracy', 'consistency', 'hasConsistency', 'now', 'advanced', 'errorTarget',
        'errorTyped', 'changed', 'missedCount', 'errorCount', 'sampleCount'
    ].map(name => [name, scalar(name)]));
    e.chars = b.array('engine:chars', 32768, [], 5);
    e.keys = b.array('engine:keys', 128, [], 5);
    e.pairs = b.array('engine:pairs', 16384, [], 5);
    e.intervals = b.array('engine:intervals', 30, [], 2);
    e.errorMap = b.array('engine:errorMap', 4096, [], 2);
    e.missed = b.array('engine:missed', 4096);
    e.samples = b.array('engine:samples', 8192, [], 2);
    e.lines = b.array('engine:lines', 1024, [], 2);
    e.points = b.array('engine:points', 20000);
    e.hooks = {};
    const timeA = uint64(b, 'engine:timeA');
    const timeB = uint64(b, 'engine:timeB');
    const timeC = uint64(b, 'engine:timeC');
    const temp = (count, callback) => b._temps(count, callback);
    const get = (out, index, field = 0) => b.arrayGet(e.chars, index, out, field);
    const put = (index, field, value) => b.arraySet(e.chars, index, value, field);
    const current = out => temp(1, valid => {
        b.lt(valid, e.index, e.length);
        b.if(valid, () => get(out, e.index), () => b.set(out, 0));
    });
    const lower = value => temp(2, (less, upper) => {
        b.lt(less, 64, value);
        b.lt(upper, value, 91);
        b.mul(less, less, upper);
        b.if(less, () => b.add(value, 32));
    });
    const observation = (array, index, error, latency, timed) => temp(3,
        (value, low, high) => {
            for (const [field, increment] of [[0, 1], [1, error], [2, timed]]) {
                b.arrayGet(array, index, value, field);
                b.add(value, increment);
                b.arraySet(array, index, value, field);
            }
            b.if(timed, () => {
                b.arrayGet(array, index, low, 3);
                b.arrayGet(array, index, high, 4);
                b.copy(value, low);
                b.add(low, latency);
                b.lt(value, low, value);
                b.add(high, value);
                b.add(high, e.latencyHi);
                b.arraySet(array, index, low, 3);
                b.arraySet(array, index, high, 4);
            });
        });
    e.measure = (target, error, latency, timed, advance = 1) => temp(4,
        (key, printable, upper, pair) => {
            b.copy(key, target);
            lower(key);
            b.lt(printable, 31, key);
            b.lt(upper, key, 127);
            b.mul(printable, printable, upper);
            b.if(printable, () => {
                observation(e.keys, key, error, latency, timed);
                b.if(e.previous, () => {
                    b.mul(pair, e.previous, 128);
                    b.add(pair, key);
                    observation(e.pairs, pair, error, latency, timed);
                });
            }, () => {
                b.set(key, 0);
                b.set(e.timingBreak, 1);
            });
            b.if(advance, () => b.copy(e.previous, key));
        });
    e.getCurrentChar = current;
    e.credit = (out, includeSeparator = 0) => temp(6,
        (wordLength, clean, char, status, extra, skipped) => {
            b.set(out, 0);
            b.set(wordLength, 0);
            b.set(clean, 1);
            b.repeat(e.index, index => {
                get(char, index);
                get(status, index, 1);
                get(extra, index, 3);
                get(skipped, index, 4);
                b.eq(char, char, 32);
                b.not(extra, extra);
                b.mul(char, char, extra);
                b.if(char, () => {
                    b.eq(status, status, 1);
                    b.mul(status, status, clean);
                    b.if(status, () => {
                        b.add(out, wordLength);
                        b.add(out, 1);
                    });
                    b.set(wordLength, 0);
                    b.set(clean, 1);
                }, () => {
                    b.add(wordLength, 1);
                    b.eq(status, status, 1);
                    b.not(skipped, skipped);
                    b.mul(status, status, skipped);
                    b.mul(status, status, extra);
                    b.if(status, () => {}, () => b.set(clean, 0));
                });
            });
            b.if(clean, () => {
                b.add(out, wordLength);
                b.add(out, includeSeparator);
            });
        });
    e.reset = () => {
        for (const name of ['line', 'index', 'length', 'running', 'paused', 'complete',
            'start', 'end', 'pauseAt', 'elapsed', 'total', 'correct', 'netCorrect',
            'wordCredit', 'nonSpace', 'netTyped', 'errors', 'skipped', 'lastTime',
            'hasLastTime', 'previous', 'linePrevious', 'timingBreak', 'intervalCount',
            'intervalCursor', 'advanced', 'changed', 'missedCount', 'errorCount',
            'startHi', 'endHi', 'pauseHi', 'elapsedHi', 'lastTimeHi', 'latencyHi',
            'sampleCount', 'wpm', 'rawWpm', 'cpm', 'consistency', 'hasConsistency'])
            b.set(e[name], 0);
        b.set(e.accuracy, 1000);
        b.mul(e.remaining, e.duration, 1000000);
        for (const array of [e.keys, e.pairs]) b.repeat(array.capacity, index => {
            for (let field = 0; field < array.fields; field++) b.arraySet(array, index,
                0, field);
        });
        b.write(17);
        b.write(1);
        b.write(0);
        b.write(0);
    };
    e.setup = () => temp(3, (offset, char, within) => {
        b.arrayGet(e.lines, e.line, offset, 0);
        b.arrayGet(e.lines, e.line, e.length, 1);
        b.set(e.index, 0);
        b.repeat(e.length, index => {
            b.copy(within, offset);
            b.add(within, index);
            b.arrayGet(e.points, within, char);
            put(index, 0, char);
            for (let field = 1; field < 5; field++) put(index, field, 0);
        });
    });
    e.load = (points, lines, count, duration = 0) => {
        b.copy(e.duration, duration);
        b.copy(e.lineCount, count);
        e.reset();
        temp(3, (offset, length, char) => b.repeat(count, index => {
            b.arrayGet(lines, index, offset, 0);
            b.arrayGet(lines, index, length, 1);
            b.arraySet(e.lines, index, offset, 0);
            b.arraySet(e.lines, index, length, 1);
            b.repeat(length, character => {
                b.add(character, offset);
                b.arrayGet(points, character, char);
                b.arraySet(e.points, character, char);
                b.sub(character, offset);
            });
        }));
        e.setup();
    };
    e.startSession = () => {
        b.set(e.running, 1);
        b.copy(e.start, e.now);
        b.copy(e.startHi, e.nowHi);
        b.write(17);
        b.write(1);
        b.write(100);
        b.write(1);
    };
    e.finish = () => b.if(e.complete, () => {}, () => {
        b.set(e.complete, 1);
        b.set(e.running, 0);
        b.if(e.paused, () => b.copy(e.end, e.pauseAt), () => b.copy(e.end, e.now));
        b.if(e.paused, () => b.copy(e.endHi, e.pauseHi), () => b.copy(e.endHi, e.nowHi));
        b.set(e.paused, 0);
        b.write(17);
        b.write(1);
        b.write(0);
        b.write(0);
        e.hooks.finish?.();
    });
    e.advance = (includeSeparator = 0) => temp(2, (credit, hasLine) => {
        b.copy(e.linePrevious, e.previous);
        b.add(e.line, 1);
        b.lt(hasLine, e.line, e.lineCount);
        b.if(hasLine, () => {}, () => b.if(e.duration, () => {
            b.set(e.line, 0);
            b.set(hasLine, 1);
        }));
        b.if(hasLine, () => {
            e.credit(credit, includeSeparator);
            b.add(e.wordCredit, credit);
            e.setup();
        }, () => e.finish());
        b.set(e.advanced, 1);
        b.set(e.changed, 1);
    });
    e.error = (target, typed) => temp(5, (index, char, count, match, found) => {
        b.copy(e.errorTarget, target);
        b.copy(e.errorTyped, typed);
        b.set(found, 0);
        b.repeat(e.errorCount, row => {
            b.arrayGet(e.errorMap, row, char, 0);
            b.eq(match, char, target);
            b.if(match, () => {
                b.copy(index, row);
                b.set(found, 1);
            });
        });
        b.if(found, () => b.arrayGet(e.errorMap, index, count, 1), () => {
            b.copy(index, e.errorCount);
            b.add(e.errorCount, 1);
            b.arraySet(e.errorMap, index, target, 0);
            b.set(count, 0);
        });
        b.add(count, 1);
        b.arraySet(e.errorMap, index, count, 1);
        e.hooks.error?.(target, typed);
    });
    e.deleteBackward = out => temp(7,
        (index, char, extra, status, valid, anyError, skipped) => {
            b.set(out, 0);
            b.if(e.index, () => {
                b.copy(index, e.index);
                b.sub(index, 1);
                get(char, index);
                get(extra, index, 3);
                b.eq(char, char, 32);
                b.not(extra, extra);
                b.mul(char, char, extra);
                b.set(valid, 1);
                b.if(char, () => {
                    b.set(anyError, 0);
                    b.set(char, 1);
                    b.while(char, () => b.if(index, () => {
                        b.sub(index, 1);
                        get(extra, index);
                        b.eq(extra, extra, 32);
                        b.if(extra, () => b.set(char, 0), () => {
                            get(status, index, 1);
                            b.eq(status, status, 2);
                            b.add(anyError, status);
                        });
                    }, () => b.set(char, 0)));
                    b.truth(valid, anyError);
                });
                b.if(valid, () => {
                    b.sub(e.index, 1);
                    get(char, e.index);
                    get(status, e.index, 1);
                    get(extra, e.index, 3);
                    get(skipped, e.index, 2);
                    b.eq(status, status, 1);
                    b.if(status, () => {
                        b.sub(e.netCorrect, 1);
                        b.eq(char, char, 32);
                        b.if(char, () => {}, () => b.sub(e.nonSpace,
                            1));
                    });
                    b.if(skipped, () => b.sub(e.netTyped, 1));
                    b.if(extra, () => {
                        b.copy(index, e.index);
                        b.copy(valid, e.length);
                        b.sub(valid, index);
                        b.sub(valid, 1);
                        b.repeat(valid, row => {
                            b.copy(char, index);
                            b.add(char, row);
                            b.add(char, 1);
                            b.copy(status, char);
                            b.sub(status, 1);
                            for (let field = 0; field <
                                5; field++) {
                                get(skipped, char, field);
                                put(status, field, skipped);
                            }
                        });
                        b.sub(e.length, 1);
                    }, () => {
                        put(e.index, 1, 0);
                        put(e.index, 2, 0);
                        put(e.index, 4, 0);
                    });
                    b.copy(index, e.index);
                    b.truth(valid, index);
                    b.while(valid, () => {
                        b.copy(index, e.index);
                        b.sub(index, 1);
                        get(skipped, index, 4);
                        b.if(skipped, () => {
                            b.sub(e.index, 1);
                            put(e.index, 1, 0);
                            put(e.index, 4, 0);
                            b.truth(valid, e.index);
                        }, () => b.set(valid, 0));
                    });
                    b.copy(e.previous, e.linePrevious);
                    b.copy(index, e.index);
                    b.truth(valid, index);
                    b.while(valid, () => {
                        b.sub(index, 1);
                        get(extra, index, 3);
                        b.if(extra, () => b.truth(valid, index), () => {
                            get(e.previous, index);
                            lower(e.previous);
                            b.lt(char, 31, e.previous);
                            b.lt(status, e.previous, 127);
                            b.mul(char, char, status);
                            b.if(char, () => {}, () => b.set(e
                                .previous, 0));
                            b.set(valid, 0);
                        });
                    });
                    b.set(e.timingBreak, 1);
                    b.set(e.changed, 1);
                    b.set(out, 1);
                });
            });
        });
    e.submitWord = (latency, timed) => temp(6,
        (target, first, skipped, active, separator, following) => {
            current(first);
            b.set(skipped, 0);
            b.lt(active, e.index, e.length);
            b.while(active, () => {
                current(target);
                b.eq(separator, target, 32);
                b.if(separator, () => b.set(active, 0), () => {
                    b.if(skipped, () => e.measure(target, 1, latency, 0),
                        () => e.measure(target, 1, latency, timed));
                    put(e.index, 1, 2);
                    put(e.index, 4, 1);
                    b.add(e.index, 1);
                    b.add(e.skipped, 1);
                    e.error(target, 32);
                    b.set(skipped, 1);
                    b.lt(active, e.index, e.length);
                });
            });
            b.lt(separator, e.index, e.length);
            b.copy(following, e.line);
            b.add(following, 1);
            b.lt(following, following, e.lineCount);
            b.add(following, e.duration);
            b.copy(active, separator);
            b.add(active, following);
            b.if(active, () => {
                b.if(skipped, () => e.measure(32, 0, latency, 0),
                    () => e.measure(32, 0, latency, timed));
                b.add(e.correct, 1);
                b.add(e.netCorrect, 1);
                b.add(e.netTyped, 1);
            }, () => {
                b.add(e.errors, 1);
                e.error(32, 32);
            });
            b.if(separator, () => {
                put(e.index, 1, 1);
                put(e.index, 2, 32);
                b.add(e.index, 1);
            });
            b.lt(active, e.index, e.length);
            b.if(active, () => {}, () => {
                b.not(separator, separator);
                b.truth(following, following);
                b.mul(separator, separator, following);
                e.advance(separator);
            });
            b.set(e.changed, 1);
        });
    e.type = (typed, latency = 0, timed = 0, latencyHigh = 0) => temp(7,
        (target, correct, status, flow, extra, index, clean) => {
            b.copy(e.latencyHi, latencyHigh);
            current(target);
            b.eq(correct, typed, target);
            b.add(e.total, 1);
            b.not(flow, e.mode);
            b.if(e.mode, () => {
                b.not(status, correct);
                e.measure(target, status, latency, timed, correct);
                get(status, e.index, 2);
                b.if(status, () => {}, () => b.add(e.netTyped, 1));
                put(e.index, 2, typed);
                b.if(correct, () => {
                    b.add(e.correct, 1);
                    b.add(e.netCorrect, 1);
                    b.eq(status, typed, 32);
                    b.if(status, () => {}, () => b.add(e.nonSpace, 1));
                    put(e.index, 1, 1);
                    b.add(e.index, 1);
                    b.lt(status, e.index, e.length);
                    b.if(status, () => {}, () => e.advance());
                }, () => {
                    b.add(e.errors, 1);
                    put(e.index, 1, 2);
                    e.error(target, typed);
                });
            }, () => {
                b.eq(status, typed, 32);
                b.if(status, () => e.submitWord(latency, timed), () => {
                    b.add(e.netTyped, 1);
                    b.eq(extra, target, 32);
                    b.not(status, target);
                    b.add(extra, status);
                    b.if(extra, () => {
                        e.measure(target, 1, latency, timed, 0);
                        b.copy(index, e.length);
                        b.copy(status, e.length);
                        b.sub(status, e.index);
                        b.repeat(status, row => {
                            b.copy(extra, index);
                            b.sub(extra, row);
                            b.sub(extra, 1);
                            b.copy(clean, extra);
                            b.add(clean, 1);
                            for (let field = 0; field <
                                5; field++) {
                                get(status, extra, field);
                                put(clean, field, status);
                            }
                        });
                        put(e.index, 0, typed);
                        put(e.index, 1, 2);
                        put(e.index, 2, typed);
                        put(e.index, 3, 1);
                        put(e.index, 4, 0);
                        b.add(e.length, 1);
                        b.add(e.index, 1);
                        b.add(e.errors, 1);
                        e.error(typed, typed);
                    }, () => {
                        b.not(status, correct);
                        e.measure(target, status, latency, timed);
                        b.if(correct, () => {
                            b.add(e.correct, 1);
                            b.add(e.netCorrect, 1);
                            b.add(e.nonSpace, 1);
                            put(e.index, 1, 1);
                        }, () => {
                            b.add(e.errors, 1);
                            put(e.index, 1, 2);
                            e.error(target, typed);
                        });
                        put(e.index, 2, typed);
                        b.add(e.index, 1);
                        b.eq(status, e.index, e.length);
                        b.not(flow, e.duration);
                        b.mul(status, status, flow);
                        b.copy(flow, e.line);
                        b.add(flow, 1);
                        b.eq(flow, flow, e.lineCount);
                        b.mul(status, status, flow);
                        b.if(status, () => {
                            b.set(clean, 1);
                            b.copy(index, e.index);
                            b.truth(status, index);
                            b.while(status, () => {
                                b.sub(index, 1);
                                get(target, index);
                                b.eq(target, target,
                                    32);
                                b.if(target, () => b
                                    .set(status, 0),
                                    () => {
                                        get(target,
                                            index,
                                            1);
                                        b.eq(target,
                                            target,
                                            1);
                                        b.mul(clean,
                                            clean,
                                            target
                                        );
                                        b.truth(status,
                                            index
                                        );
                                    });
                            });
                            b.if(clean, () => e.advance());
                        });
                    });
                });
            });
            b.set(e.changed, 1);
        });
    e.key = (typed, now) => temp(3, (latency, timed, blocked) => {
        b.copy(e.now, now);
        b.copy(blocked, e.complete);
        b.add(blocked, e.paused);
        b.if(blocked, () => {}, () => {
            e.hooks.tick?.();
            b.if(e.complete, () => {}, () => {
                b.if(e.running, () => {}, () => e.startSession());
                fromPair64(b, timeA, now, e.nowHi);
                fromPair64(b, timeB, e.lastTime, e.lastTimeHi);
                sub64(b, timeC, timeA, timeB);
                toPair64(b, latency, e.latencyHi, timeC);
                b.not(timed, e.timingBreak);
                b.mul(timed, timed, e.hasLastTime);
                b.if(e.hasLastTime, () => {
                    b.arraySet(e.intervals, e.intervalCursor,
                        latency);
                    b.arraySet(e.intervals, e.intervalCursor, e
                        .latencyHi, 1);
                    b.add(e.intervalCursor, 1);
                    b.eq(blocked, e.intervalCursor, 30);
                    b.if(blocked, () => b.set(e.intervalCursor, 0));
                    b.lt(blocked, e.intervalCount, 30);
                    b.if(blocked, () => b.add(e.intervalCount, 1));
                });
                b.set(e.timingBreak, 0);
                b.copy(e.lastTime, now);
                b.copy(e.lastTimeHi, e.nowHi);
                b.set(e.hasLastTime, 1);
                e.type(typed, latency, timed, e.latencyHi);
                e.hooks.tick?.();
            });
        });
    });
    e.pause = now => b.if(e.running, () => b.if(e.paused, () => {}, () => {
        b.copy(e.now, now);
        e.hooks.tick?.();
        b.if(e.complete, () => {}, () => {
            b.copy(e.pauseAt, now);
            b.copy(e.pauseHi, e.nowHi);
            b.set(e.paused, 1);
        });
    }));
    e.resume = now => b.if(e.paused, () => temp(1, gap => {
        fromPair64(b, timeA, now, e.nowHi);
        fromPair64(b, timeB, e.pauseAt, e.pauseHi);
        sub64(b, timeC, timeA, timeB);
        fromPair64(b, timeA, e.start, e.startHi);
        add64(b, timeA, timeA, timeC);
        toPair64(b, e.start, e.startHi, timeA);
        b.set(e.paused, 0);
        b.set(e.hasLastTime, 0);
        b.set(e.lastTime, 0);
        b.set(e.lastTimeHi, 0);
        b.set(e.latencyHi, 0);
    }));
    e.writeInteger = value => writeUnsigned(b, value);
    return e;
}
