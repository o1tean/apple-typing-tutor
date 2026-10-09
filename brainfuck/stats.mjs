import {
    uint64,
    fromPair64,
    toPair64,
    copy64,
    sub64,
    add64,
    div64,
    compare64
} from './runtime.mjs';
import { textBuffer } from './text.mjs';

export function defineStats(b, e, arena, names, numbers) {
    const a = uint64(b, 'stats:a');
    const d = uint64(b, 'stats:d');
    const q = uint64(b, 'stats:q');
    const r = uint64(b, 'stats:r');
    const decimal = textBuffer(b, 'stats:decimal', 40);
    const fields = {};
    for (const field of ['wpm', 'rawWpm', 'cpm']) fields[field + 'Hi'] =
        b.scalar('stats:' + field + 'Hi');
    const roundNumber = (out, high, number) => b._temps(1, half => {
        numbers.constant(half, 0.5);
        numbers.addNumbers(number, number, half);
        arena.get(out, 'numberLo', number);
        arena.get(high, 'numberHi', number);
    });
    const calculate = b.reusable('brainfuck/stats.mjs:calculate', () => b._temps(10,
        (now, high, credit, compare, count, remainder, ignored, minutes, score,
            divisor) => {
            b.set(e.elapsed, 0);
            b.set(e.elapsedHi, 0);
            b.if(e.running, () => b.set(compare, 1), () => b.copy(compare, e.complete));
            b.if(compare, () => {
                b.copy(now, e.now);
                b.copy(high, e.nowHi);
                b.if(e.paused, () => {
                    b.copy(now, e.pauseAt);
                    b.copy(high, e.pauseHi);
                });
                b.if(e.complete, () => {
                    b.copy(now, e.end);
                    b.copy(high, e.endHi);
                });
                fromPair64(b, a, now, high);
                fromPair64(b, d, e.start, e.startHi);
                compare64(b, compare, a, d);
                b.eq(compare, compare, -1);
                b.if(compare, () => fromPair64(b, a, 0, 0), () => sub64(b, a, a,
                    d));
                b.if(e.duration, () => {
                    b.mul(now, e.duration, 1000000);
                    fromPair64(b, d, now, 0);
                    compare64(b, compare, a, d);
                    b.eq(compare, compare, 1);
                    b.if(compare, () => copy64(b, a, d));
                });
                toPair64(b, e.elapsed, e.elapsedHi, a);
            });
            b.mul(e.remaining, e.duration, 1000000);
            b.if(e.duration, () => b.sub(e.remaining, e.elapsed));
            b.copy(compare, e.elapsed);
            b.add(compare, e.elapsedHi);
            b.if(compare, () => {
                engineCredit(credit);
                b.add(credit, e.wordCredit);
                arena.number(minutes, e.elapsed, e.elapsedHi);
                arena.number(divisor, 1000000);
                numbers.divideNumber(minutes, minutes, divisor);
                arena.number(divisor, 60);
                numbers.divideNumber(minutes, minutes, divisor);
                for (const [field, numerator, wordUnits] of [['wpm', credit, true],
                    ['rawWpm', e.netTyped, true], ['cpm', credit, false]]) {
                    arena.number(score, numerator);
                    if (wordUnits) {
                        arena.number(divisor, 5);
                        numbers.divideNumber(score, score, divisor);
                    }
                    numbers.divideNumber(score, score, minutes);
                    roundNumber(e[field], fields[field + 'Hi'], score);
                }
            }, () => {
                for (const field of ['wpm', 'rawWpm', 'cpm']) {
                    b.set(e[field], 0);
                    b.set(fields[field + 'Hi'], 0);
                }
            });
            b.copy(count, e.total);
            b.add(count, e.skipped);
            b.if(count, () => {
                arena.number(score, e.correct);
                arena.number(divisor, count);
                numbers.divideNumber(score, score, divisor);
                arena.number(divisor, 1000);
                numbers.multiplyNumbers(score, score, divisor);
                roundNumber(e.accuracy, ignored, score);
            }, () => b.set(e.accuracy, 1000));
        }));
    const engineCredit = out => e.credit(out);
    const intervalNumber = (out, row) => b._temps(4, (index, low, high, wrapped) => {
        b.copy(index, row);
        b.eq(wrapped, e.intervalCount, 30);
        b.if(wrapped, () => {
            b.add(index, e.intervalCursor);
            b.lt(wrapped, index, 30);
            b.if(wrapped, () => {}, () => b.sub(index, 30));
        });
        b.arrayGet(e.intervals, index, low);
        b.arrayGet(e.intervals, index, high, 1);
        arena.number(out, low, high);
        numbers.divideNumber(out, out, 1000);
    });
    const consistency = b.reusable('brainfuck/stats.mjs:consistency', () => b._temps(10,
        (count, sum, mean, variance, interval, difference, score, other, compare, low) => {
            b.set(e.hasConsistency, 0);
            b.set(e.consistency, 0);
            b.lt(compare, 5, e.intervalCount);
            b.if(compare, () => {
                arena.number(count, e.intervalCount);
                arena.number(sum, 0);
                b.repeat(e.intervalCount, index => {
                    intervalNumber(interval, index);
                    numbers.addNumbers(sum, sum, interval);
                });
                numbers.divideNumber(mean, sum, count);
                arena.number(other, 0);
                numbers.compareNumbers(compare, mean, other);
                b.eq(compare, compare, 1);
                b.if(compare, () => {
                    arena.number(variance, 0);
                    b.repeat(e.intervalCount, index => {
                        intervalNumber(interval, index);
                        numbers.subtractNumbers(difference,
                            interval, mean);
                        numbers.multiplyNumbers(difference,
                            difference, difference);
                        numbers.addNumbers(variance, variance,
                            difference);
                    });
                    numbers.divideNumber(variance, variance, count);
                    numbers.sqrtNumber(score, variance);
                    numbers.divideNumber(score, score, mean);
                    arena.number(other, 45);
                    numbers.multiplyNumbers(score, score, other);
                    arena.number(other, 100);
                    numbers.subtractNumbers(score, other, score);
                    arena.number(other, 20);
                    numbers.maxNumber(score, score, other);
                    numbers.constant(other, 0.5);
                    numbers.addNumbers(score, score, other);
                    numbers.scaled(e.consistency, score, 1);
                    b.set(e.hasConsistency, 1);
                });
            });
        }));
    const number = (out, low, high = 0) => arena.number(out, low, high);
    const ratioNumber = (out, low, high, denominator) => b._temps(2,
        (numerator, divisor) => {
            arena.number(numerator, low, high);
            arena.number(divisor, denominator);
            numbers.divideNumber(out, numerator, divisor);
        });
    const snapshot = out => b._temps(7,
        (node, count, remaining, fraction, group, attempts, index) => {
            calculate();
            consistency();
            arena.object(out);
            arena.string(node, names['words-v1']);
            arena.setField(out, names.wpmMetric, node);
            for (const field of ['wpm', 'rawWpm', 'cpm']) {
                number(node, e[field], fields[field + 'Hi']);
                arena.setField(out, names[field], node);
            }
            ratioNumber(node, e.accuracy, 0, 10);
            arena.setField(out, names.accuracy, node);
            ratioNumber(node, e.elapsed, e.elapsedHi, 1000);
            arena.setField(out, names.elapsedMilliseconds, node);
            fromPair64(b, a, e.elapsed, e.elapsedHi);
            fromPair64(b, d, 500000, 0);
            // Integer rounding follows Math.round for nonnegative elapsed time.
            add64(b, a, a, d);
            div64(b, q, r, a, 1000000);
            toPair64(b, count, fraction, q);
            number(node, count);
            arena.setField(out, names.elapsedSeconds, node);
            b.divmod(count, fraction, e.remaining, 1000000);
            b.if(fraction, () => b.add(count, 1));
            number(node, count);
            arena.setField(out, names.timeRemaining, node);
            for (const [field, source] of [['totalKeystrokes', e.total],
                ['correctKeystrokes', e.correct], ['correctNonSpaceChars', e.nonSpace],
                ['errorKeystrokes', e.errors], ['skippedChars', e.skipped],
                ['currentLineIndex', e.line], ['totalLines', e.lineCount]]) {
                number(node, source);
                arena.setField(out, names[field], node);
            }
            b.if(e.hasConsistency, () => number(node, e.consistency), () => arena.new(node, 1));
            arena.setField(out, names.consistency, node);
            arena.array(group);
            b.repeat(e.missedCount, row => {
                b.arrayGet(e.missed, row, index);
                arena.string(node, index);
                arena.append(group, node);
            });
            arena.setField(out, names.missedWords, group);
            arena.object(group);
            b.repeat(e.errorCount, row => {
                b.arrayGet(e.errorMap, row, index, 0);
                b.arrayGet(e.errorMap, row, count, 1);
                decimal.clear();
                decimal.point(index);
                decimal.intern(index);
                number(node, count);
                arena.setField(group, index, node);
            });
            arena.setField(out, names.errorsByChar, group);
            arena.object(group);
            for (const [name, array] of [['keys', e.keys], ['bigrams', e.pairs]]) {
                arena.object(remaining);
                b.repeat(array.capacity, row => {
                    b.arrayGet(array, row, attempts, 0);
                    b.if(attempts, () => {
                        arena.object(node);
                        for (const [field, position] of [['attempts', 0], [
                                    'errors', 1],
                            ['latencySamples', 2]]) {
                            b.arrayGet(array, row, count, position);
                            number(index, count);
                            arena.setField(node, names[field], index);
                        }
                        b.arrayGet(array, row, count, 3);
                        b.arrayGet(array, row, fraction, 4);
                        ratioNumber(index, count, fraction, 1000);
                        arena.setField(node, names.latencyTotalMs, index);
                        decimal.clear();
                        if (name === 'bigrams') {
                            b.divmod(index, fraction, row, 128);
                            decimal.point(index);
                            decimal.point(fraction);
                        } else decimal.point(row);
                        decimal.intern(index);
                        arena.setField(remaining, index, node);
                    });
                });
                arena.setField(group, names[name], remaining);
            }
            arena.setField(out, names.learning, group);
        });
    const tick = b.reusable('brainfuck/stats.mjs:tick', () => {
        calculate();
        b.if(e.duration, () => b.if(e.remaining, () => {}, () => e.finish()));
    });
    return { calculate, consistency, snapshot, tick, fields };
}
