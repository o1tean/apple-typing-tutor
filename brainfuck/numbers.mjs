import {
    TYPE,
    NUMBER,
    uint64,
    copy64,
    fromPair64,
    toPair64,
    add64,
    sub64,
    mul64,
    div64,
    compare64
} from './runtime.mjs';

const BIAS = 2048;

export function createNumbers(b, arena, name = 'numbers') {
    const wide = id => uint64(b, name + ':' + id);
    const w = {
        a: wide('a'),
        c: wide('c'),
        result: wide('result'),
        integer: wide('integer'),
        mA: wide('mA'),
        mB: wide('mB'),
        quotient: wide('quotient'),
        remainder: wide('remainder'),
        temporary: wide('temporary'),
        zero: uint64(b, name + ':zero'),
        one: uint64(b, name + ':one', 1n),
        hidden: uint64(b, name + ':hidden', 1n << 52n),
        guardHidden: uint64(b, name + ':guardHidden', 1n << 55n),
        guardCarry: uint64(b, name + ':guardCarry', 1n << 56n),
        roundedCarry: uint64(b, name + ':roundedCarry', 1n << 53n),
        sign: uint64(b, name + ':sign', 1n << 63n)
    };
    const eA = b.scalar(name + ':exponentA');
    const eB = b.scalar(name + ':exponentB');
    const signA = b.scalar(name + ':signA');
    const signB = b.scalar(name + ':signB');
    const product = b.scratchArray(name + ':product', 16);

    const zero = (out, value) => {
        b._temps(1, sum => {
            b.set(sum, 0);
            for (const digit of value.digits) b.add(sum, digit);
            b.not(out, sum);
        });
    };
    const constantBits = (out, number) => {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setFloat64(0, number, true);
        fromPair64(b, out, view.getUint32(0, true), view.getUint32(4, true));
    };
    const unpack = (bits, mantissa, exponent, sign) => {
        b._temps(3, (low, high, ignored) => {
            toPair64(b, low, high, bits);
            b.divmod(exponent, high, high, 1048576);
            b.divmod(sign, exponent, exponent, 2048);
            b.if(exponent, () => b.add(high, 1048576), () => b.set(exponent, 1));
            fromPair64(b, mantissa, low, high);
            b.add(exponent, BIAS);
        });
    };
    const right = (value, amount, jam = false) => {
        b._temps(5, (remaining, empty, sticky, low, ignored) => {
            b.copy(remaining, amount);
            b.set(sticky, 0);
            b.while(remaining, () => {
                zero(empty, value);
                b.if(empty, () => b.set(remaining, 0), () => {
                    div64(b, value, w.remainder, value, 2);
                    if (jam) {
                        toPair64(b, low, ignored, w.remainder);
                        b.if(low, () => b.set(sticky, 1));
                    }
                    b.sub(remaining, 1);
                });
            });
            if (jam) b.if(sticky, () => {
                b.divmod(ignored, low, value.digits[0], 2);
                b.if(low, () => {}, () => b.add(value.digits[0], 1));
            });
        });
    };
    const round = (mantissa, exponent, out) => {
        b._temps(8, (small, count, guard, ignored, bit, take, low, high) => {
            b.lt(small, exponent, BIAS + 1);
            b.if(small, () => {
                b.set(count, BIAS + 1);
                b.sub(count, exponent);
                right(mantissa, count, true);
                b.set(exponent, BIAS + 1);
            });
            b.divmod(ignored, guard, mantissa.digits[0], 8);
            div64(b, mantissa, w.remainder, mantissa, 8);
            b.divmod(ignored, bit, mantissa.digits[0], 2);
            b.lt(take, 4, guard);
            b.eq(small, guard, 4);
            b.if(small, () => b.if(bit, () => b.set(take, 1)));
            b.if(take, () => add64(b, mantissa, mantissa, w.one));
            compare64(b, small, mantissa, w.roundedCarry);
            b.eq(take, small, -1);
            b.not(take, take);
            b.if(take, () => {
                right(mantissa, 1);
                b.add(exponent, 1);
            });
            zero(take, mantissa);
            b.if(take, () => b.set(exponent, BIAS + 1));
            b.lt(small, exponent, BIAS + 2047);
            b.if(small, () => {
                b.copy(high, exponent);
                b.sub(high, BIAS);
                b.eq(take, high, 1);
                b.if(take, () => {
                    compare64(b, take, mantissa, w.hidden);
                    b.eq(take, take, -1);
                    b.if(take, () => b.set(high, 0));
                });
                b.mul(count, high, 1048576);
                toPair64(b, low, high, mantissa);
                b.divmod(ignored, high, high, 1048576);
                b.add(high, count);
                fromPair64(b, out, low, high);
            }, () => fromPair64(b, out, 0, 0x7ff00000));
        });
    };
    const normalise = (mantissa, exponent) => {
        b._temps(2, (small, empty) => {
            compare64(b, small, mantissa, w.hidden);
            b.eq(small, small, -1);
            zero(empty, mantissa);
            b.if(empty, () => b.set(small, 0));
            b.while(small, () => {
                mul64(b, mantissa, mantissa, 2);
                b.sub(exponent, 1);
                compare64(b, small, mantissa, w.hidden);
                b.eq(small, small, -1);
            });
        });
    };
    const applySign = (bits, sign) => b.if(sign, () => add64(b, bits, bits, w.sign));
    const classify = (input, infinite, nan, negative) => b._temps(4, (low, high, exponent,
        fraction) => {
        toPair64(b, low, high, input);
        b.divmod(exponent, fraction, high, 1048576);
        b.divmod(negative, exponent, exponent, 2048);
        b.truth(fraction, fraction);
        b.if(low, () => b.set(fraction, 1));
        b.eq(infinite, exponent, 2047);
        b.set(nan, 0);
        b.if(infinite, () => b.if(fraction, () => {
            b.set(nan, 1);
            b.set(infinite, 0);
        }));
    });
    const unsignedFloat = (out, value) => b._intrinsic('floatFromUnsigned', { out, input: value },
        () => {
            copy64(b, w.mA, value);
            b.set(eA, BIAS + 1078);
            b._temps(2, (empty, comparison) => {
                zero(empty, w.mA);
                b.if(empty, () => copy64(b, out, w.zero), () => {
                    compare64(b, comparison, w.mA, w.guardCarry);
                    b.eq(comparison, comparison, -1);
                    b.not(comparison, comparison);
                    b.while(comparison, () => {
                        right(w.mA, 1, true);
                        b.add(eA, 1);
                        compare64(b, comparison, w.mA, w.guardCarry);
                        b.eq(comparison, comparison, -1);
                        b.not(comparison, comparison);
                    });
                    compare64(b, comparison, w.mA, w.guardHidden);
                    b.eq(comparison, comparison, -1);
                    b.while(comparison, () => {
                        mul64(b, w.mA, w.mA, 2);
                        b.sub(eA, 1);
                        compare64(b, comparison, w.mA, w.guardHidden);
                        b.eq(comparison, comparison, -1);
                    });
                    round(w.mA, eA, out);
                });
            });
        });
    const floatUnsigned = (out, input) => b._intrinsic('floatToUnsigned', { out, input }, () => {
        unpack(input, w.mA, eA, signA);
        b._temps(2, (small, shift) => {
            b.if(signA, () => copy64(b, out, w.zero), () => {
                b.lt(small, eA, BIAS + 1087);
                b.if(small, () => {
                    b.lt(small, eA, BIAS + 1075);
                    b.if(small, () => {
                        b.set(shift, BIAS + 1075);
                        b.sub(shift, eA);
                        right(w.mA, shift);
                    }, () => {
                        b.copy(shift, eA);
                        b.sub(shift, BIAS + 1075);
                        b.repeat(shift, () => mul64(b, w.mA,
                            w.mA, 2));
                    });
                    copy64(b, out, w.mA);
                }, () => {
                    for (const digit of out.digits) b.set(digit,
                        255);
                });
            });
        });
        b._temps(3, (infinite, nan, negative) => {
            classify(input, infinite, nan, negative);
            b.if(nan, () => copy64(b, out, w.zero));
        });
    });
    const load = (out, node) => {
        if (typeof node === 'number') return constantBits(out, node);
        b._temps(4, (flags, hasBits, low, high) => {
            arena.get(flags, 'numberFlags', node);
            b.divmod(flags, hasBits, flags, NUMBER.BITS);
            b.divmod(hasBits, flags, flags, 2);
            b.if(flags, () => {
                arena.get(low, 'value', node);
                arena.get(high, 'floatHi', node);
                fromPair64(b, out, low, high);
            }, () => {
                arena.get(low, 'numberLo', node);
                arena.get(high, 'numberHi', node);
                fromPair64(b, w.integer, low, high);
                unsignedFloat(out, w.integer);
                arena.get(flags, 'numberFlags', node);
                b.divmod(hasBits, flags, flags, NUMBER.NEGATIVE);
                b.divmod(flags, hasBits, hasBits, 2);
                applySign(out, hasBits);
            });
        });
    };
    const add = (out, left, other, subtract = false) => {
        unpack(left, w.mA, eA, signA);
        unpack(other, w.mB, eB, signB);
        if (subtract) b.not(signB, signB);
        mul64(b, w.mA, w.mA, 8);
        mul64(b, w.mB, w.mB, 8);
        b._temps(5, (small, shift, same, comparison, sign) => {
            b.lt(small, eA, eB);
            b.if(small, () => {
                copy64(b, w.temporary, w.mA);
                copy64(b, w.mA, w.mB);
                copy64(b, w.mB, w.temporary);
                b.copy(shift, eA);
                b.copy(eA, eB);
                b.copy(eB, shift);
                b.copy(shift, signA);
                b.copy(signA, signB);
                b.copy(signB, shift);
            });
            b.copy(shift, eA);
            b.sub(shift, eB);
            right(w.mB, shift, true);
            b.eq(same, signA, signB);
            b.copy(sign, signA);
            b.if(same, () => {
                add64(b, w.mA, w.mA, w.mB);
                compare64(b, comparison, w.mA, w.guardCarry);
                b.eq(comparison, comparison, -1);
                b.not(comparison, comparison);
                b.if(comparison, () => {
                    right(w.mA, 1, true);
                    b.add(eA, 1);
                });
            }, () => {
                compare64(b, comparison, w.mA, w.mB);
                b.eq(small, comparison, -1);
                b.if(small, () => {
                    sub64(b, w.mA, w.mB, w.mA);
                    b.copy(sign, signB);
                }, () => sub64(b, w.mA, w.mA, w.mB));
                zero(small, w.mA);
                b.if(small, () => b.set(sign, 0));
                compare64(b, comparison, w.mA, w.guardHidden);
                b.eq(comparison, comparison, -1);
                b.if(small, () => b.set(comparison, 0));
                b.while(comparison, () => {
                    b.eq(small, eA, BIAS + 1);
                    b.if(small, () => b.set(comparison, 0), () => {
                        mul64(b, w.mA, w.mA, 2);
                        b.sub(eA, 1);
                        compare64(b, comparison, w.mA, w
                            .guardHidden);
                        b.eq(comparison, comparison, -1);
                    });
                });
            });
            round(w.mA, eA, out);
            applySign(out, sign);
        });
    };
    const divide = (out, left, other) => {
        unpack(left, w.mA, eA, signA);
        unpack(other, w.mB, eB, signB);
        b._temps(5, (emptyA, emptyB, sign, comparison, take) => {
            zero(emptyA, w.mA);
            zero(emptyB, w.mB);
            b.eq(sign, signA, signB);
            b.not(sign, sign);
            b.if(emptyB, () => {
                b.if(emptyA, () => fromPair64(b, out, 0, 0x7ff80000),
                    () => fromPair64(b, out, 0, 0x7ff00000));
            }, () => b.if(emptyA, () => copy64(b, out, w.zero), () => {
                normalise(w.mA, eA);
                normalise(w.mB, eB);
                b.add(eA, 1023 + BIAS);
                b.sub(eA, eB);
                compare64(b, comparison, w.mA, w.mB);
                b.eq(take, comparison, -1);
                b.if(take, () => {
                    mul64(b, w.mA, w.mA, 2);
                    b.sub(eA, 1);
                });
                sub64(b, w.mA, w.mA, w.mB);
                copy64(b, w.quotient, w.one);
                b.repeat(55, () => {
                    mul64(b, w.quotient, w.quotient, 2);
                    mul64(b, w.mA, w.mA, 2);
                    compare64(b, comparison, w.mA, w.mB);
                    b.eq(take, comparison, -1);
                    b.not(take, take);
                    b.if(take, () => {
                        sub64(b, w.mA, w.mA, w.mB);
                        add64(b, w.quotient, w.quotient, w
                            .one);
                    });
                });
                zero(take, w.mA);
                b.not(take, take);
                b.if(take, () => {
                    b.divmod(comparison, take, w.quotient.digits[0],
                        2);
                    b.if(take, () => {}, () => b.add(w.quotient
                        .digits[0], 1));
                });
                round(w.quotient, eA, out);
            }));
            applySign(out, sign);
        });
    };
    const multiply = (out, left, other) => {
        unpack(left, w.mA, eA, signA);
        unpack(other, w.mB, eB, signB);
        b._temps(7, (empty, sign, carry, sum, digit, sticky, comparison) => {
            zero(empty, w.mA);
            b.if(empty, () => copy64(b, out, w.zero), () => {
                zero(empty, w.mB);
                b.if(empty, () => copy64(b, out, w.zero), () => {
                    normalise(w.mA, eA);
                    normalise(w.mB, eB);
                    b.add(eA, eB);
                    b.sub(eA, BIAS + 1023);
                    for (let index = 0; index < 16; index++) b.arraySet(
                        product, index, 0);
                    for (let i = 0; i < 8; i++) {
                        b.set(carry, 0);
                        for (let j = 0; j < 8; j++) {
                            b.mul(sum, w.mA.digits[i], w.mB.digits[j]);
                            b.arrayGet(product, i + j, digit);
                            b.add(sum, digit);
                            b.add(sum, carry);
                            b.divmod(carry, digit, sum, 256);
                            b.arraySet(product, i + j, digit);
                        }
                        b.arraySet(product, i + 8, carry);
                    }
                    b.set(sticky, 0);
                    for (let index = 0; index < 6; index++) {
                        b.arrayGet(product, index, digit);
                        b.if(digit, () => b.set(sticky, 1));
                    }
                    for (let index = 0; index < 8; index++)
                        b.arrayGet(product, index + 6, w.quotient
                            .digits[index]);
                    right(w.quotient, 1, true);
                    b.if(sticky, () => {
                        b.divmod(comparison, digit, w.quotient
                            .digits[0], 2);
                        b.if(digit, () => {}, () => b.add(w
                            .quotient.digits[0], 1));
                    });
                    compare64(b, comparison, w.quotient, w.guardCarry);
                    b.eq(comparison, comparison, -1);
                    b.not(comparison, comparison);
                    b.if(comparison, () => {
                        right(w.quotient, 1, true);
                        b.add(eA, 1);
                    });
                    round(w.quotient, eA, out);
                });
            });
            b.eq(sign, signA, signB);
            b.not(sign, sign);
            applySign(out, sign);
        });
    };
    const soft = (kind, out, left, other) => b._intrinsic(kind, { out, left, right: other }, () => {
        b._temps(10, (infA, nanA, negA, infB, nanB, negB, special, sign, empty, both) => {
            classify(left, infA, nanA, negA);
            classify(other, infB, nanB, negB);
            b.copy(special, nanA);
            b.add(special, nanB);
            const nan = () => fromPair64(b, out, 0, 0x7ff80000);
            const infinity = () => {
                fromPair64(b, out, 0, 0x7ff00000);
                applySign(out, sign);
            };
            const signedZero = () => {
                copy64(b, out, w.zero);
                applySign(out, sign);
            };
            b.if(special, nan, () => {
                b.copy(special, infA);
                b.add(special, infB);
                b.if(special, () => {
                    if (kind === 'floatAdd' || kind ===
                        'floatSub') {
                        if (kind === 'floatSub') b.not(negB, negB);
                        b.copy(sign, negA);
                        b.if(infA, () => b.if(infB, () => {
                            b.eq(both, negA, negB);
                            b.if(both, infinity, nan);
                        }, infinity), () => {
                            b.copy(sign,
                                negB);
                            infinity();
                        });
                    } else {
                        b.eq(sign, negA, negB);
                        b.not(sign, sign);
                        if (kind === 'floatDiv') b.if(infA,
                            () => b.if(infB, nan, infinity),
                            signedZero);
                        else {
                            b.if(infA, () => {
                                unpack(other, w.mA, eA,
                                    signA);
                                zero(empty, w.mA);
                            }, () => {
                                unpack(left, w.mA, eA,
                                    signA);
                                zero(empty, w.mA);
                            });
                            b.if(empty, nan, infinity);
                        }
                    }
                }, () => {
                    if (kind === 'floatAdd') add(out, left, other);
                    else if (kind === 'floatSub') add(out, left,
                        other, true);
                    else if (kind === 'floatDiv') divide(out, left,
                        other);
                    else if (kind === 'floatMul') multiply(out,
                        left, other);
                });
            });
        });
    });
    const squareRoot = (out, input) => b._intrinsic('floatSqrt', { out, input }, () => {
        b._temps(9, (infinite, nan, negative, empty, parity, ignored, pair, take,
            sticky) => {
            classify(input, infinite, nan, negative);
            unpack(input, w.mA, eA, signA);
            zero(empty, w.mA);
            b.if(empty, () => copy64(b, out, input), () => {
                b.add(nan, negative);
                b.if(nan, () => fromPair64(b, out, 0, 0x7ff80000), () =>
                    b.if(infinite, () => copy64(b, out, input), () => {
                        normalise(w.mA, eA);
                        b.divmod(ignored, parity, eA, 2);
                        b.if(parity, () => {}, () => mul64(b, w.mA,
                            w.mA, 2));
                        b.add(eA, BIAS + 1023);
                        b.divmod(eA, ignored, eA, 2);
                        copy64(b, w.quotient, w.zero);
                        copy64(b, w.mB, w.zero);
                        const step = () => {
                            mul64(b, w.mB, w.mB, 4);
                            fromPair64(b, w.temporary, pair);
                            add64(b, w.mB, w.mB, w.temporary);
                            mul64(b, w.temporary, w.quotient,
                                4);
                            add64(b, w.temporary, w.temporary, w
                                .one);
                            compare64(b, take, w.mB, w
                                .temporary);
                            b.eq(take, take, -1);
                            b.not(take, take);
                            mul64(b, w.quotient, w.quotient, 2);
                            b.if(take, () => {
                                sub64(b, w.mB, w.mB, w
                                    .temporary);
                                add64(b, w.quotient, w
                                    .quotient, w.one
                                );
                            });
                        };
                        b.repeat(27, () => {
                            div64(b, w.temporary, w
                                .remainder, w.mA, 1n <<
                                52n);
                            toPair64(b, pair, ignored, w
                                .temporary);
                            mul64(b, w.mA, w.remainder, 4);
                            step();
                        });
                        b.set(pair, 0);
                        b.repeat(29, step);
                        zero(sticky, w.mB);
                        b.not(sticky, sticky);
                        b.if(sticky, () => {
                            b.divmod(ignored, parity, w
                                .quotient.digits[0], 2);
                            b.if(parity, () => {}, () => b
                                .add(w.quotient.digits[
                                    0], 1));
                        });
                        round(w.quotient, eA, out);
                    }));
            });
        });
    });
    const finish = (out, bits) => b._temps(8, (low, high, absHigh, exponent, ignored, flags,
        fraction, sign) => {
        toPair64(b, low, high, bits);
        b.divmod(ignored, absHigh, high, 0x80000000);
        fromPair64(b, w.temporary, low, absHigh);
        floatUnsigned(w.integer, w.temporary);
        arena.new(out, TYPE.NUMBER);
        arena.set('value', out, low);
        arena.set('floatHi', out, high);
        toPair64(b, low, absHigh, w.integer);
        arena.set('numberLo', out, low);
        arena.set('numberHi', out, absHigh);
        b.divmod(exponent, ignored, high, 1048576);
        b.divmod(sign, exponent, exponent, 2048);
        b.set(flags, NUMBER.BITS);
        b.if(sign, () => {
            arena.get(low, 'value', out);
            b.divmod(ignored, absHigh, high, 0x80000000);
            b.truth(ignored, absHigh);
            b.if(low, () => b.set(ignored, 1));
            b.if(ignored, () => b.add(flags, NUMBER.NEGATIVE));
        });
        b.lt(fraction, exponent, 2047);
        b.if(fraction, () => {
            b.add(flags, NUMBER.FINITE);
            b.lt(fraction, exponent, 1075);
            b.if(fraction, () => {
                unsignedFloat(w.temporary, w.integer);
                applySign(w.temporary, sign);
                compare64(b, fraction, w.temporary, bits);
                b.truth(fraction, fraction);
            }, () => b.set(fraction, 0));
            b.if(fraction, () => {}, () => b.add(flags, NUMBER.INTEGER));
        }, () => b.set(fraction, 0));
        arena.set('numberFlags', out, flags);
        arena.set('fraction', out, fraction);
    });
    const binary = (kind, out, left, other) => {
        load(w.a, left);
        load(w.c, other);
        soft(kind, w.result, w.a, w.c);
        finish(out, w.result);
    };
    const compareNumbers = (out, left, other) => {
        load(w.a, left);
        load(w.c, other);
        b._intrinsic('floatCompare', { out, left: w.a, right: w.c }, () => {
            b._temps(7, (lo, hi, negA, negB, same, emptyA, emptyB) => {
                toPair64(b, lo, hi, w.a);
                b.divmod(negA, hi, hi, 0x80000000);
                fromPair64(b, w.a, lo, hi);
                toPair64(b, lo, hi, w.c);
                b.divmod(negB, hi, hi, 0x80000000);
                fromPair64(b, w.c, lo, hi);
                b.eq(same, negA, negB);
                b.if(same, () => {
                    compare64(b, out, w.a, w.c);
                    b.if(negA, () => b.mul(out, out, -1));
                }, () => b.if(negA, () => b.set(out, -1), () => b.set(
                    out, 1)));
                zero(emptyA, w.a);
                zero(emptyB, w.c);
                b.if(emptyA, () => b.if(emptyB, () => b.set(out, 0)));
                classify(w.a, emptyA, emptyB, same);
                b.if(emptyB, () => b.set(out, 0));
                classify(w.c, emptyA, emptyB, same);
                b.if(emptyB, () => b.set(out, 0));
            });
        });
    };
    const unsignedResult = out => {
        floatUnsigned(w.integer, w.result);
        b._temps(1, high => {
            toPair64(b, out, high, w.integer);
            b.if(high, () => b.set(out, -1));
        });
    };
    const api = {
        addNumbers: (out, left, other) => binary('floatAdd', out, left, other),
        subtractNumbers: (out, left, other) => binary('floatSub', out, left, other),
        multiplyNumbers: (out, left, other) => binary('floatMul', out, left, other),
        divideNumber: (out, left, other) => binary('floatDiv', out, left, other),
        sqrtNumber(out, node) {
            load(w.a, node);
            squareRoot(w.result, w.a);
            finish(out, w.result);
        },
        compareNumbers,
        constant(out, number) {
            constantBits(w.result, number);
            finish(out, w.result);
        },
        maxNumber(out, left, other) {
            b._temps(1, comparison => {
                compareNumbers(comparison, left, other);
                b.eq(comparison, comparison, -1);
                b.if(comparison, () => arena.clone(out, other), () => arena.clone(out,
                    left));
            });
        },
        scaled(out, node, scale) {
            load(w.a, node);
            constantBits(w.c, scale);
            soft('floatMul', w.result, w.a, w.c);
            unsignedResult(out);
        },
        ratio(out, left, other, scale = 1e9) {
            load(w.a, left);
            load(w.c, other);
            soft('floatDiv', w.result, w.a, w.c);
            copy64(b, w.a, w.result);
            constantBits(w.c, scale);
            soft('floatMul', w.result, w.a, w.c);
            unsignedResult(out);
        },
        format(buffer, node, digits = 0, trim = false) {
            b._temps(4, (handle, index, char, keep) => {
                b.write(37);
                b.write(node);
                b.writeString('fixed');
                b.write(digits);
                b.read(handle);
                b.write(24);
                b.write(handle);
                b.readString(buffer);
                if (trim && digits) {
                    b.copy(index, buffer.length);
                    b.sub(index, 1);
                    b.arrayGet(buffer.data, index, char);
                    b.eq(keep, char, 48);
                    b.while(keep, () => {
                        b.sub(buffer.length, 1);
                        b.sub(index, 1);
                        b.arrayGet(buffer.data, index, char);
                        b.eq(keep, char, 48);
                    });
                    b.eq(keep, char, 46);
                    b.if(keep, () => b.sub(buffer.length, 1));
                }
            });
        }
    };
    api.add = api.addNumbers;
    api.subtract = api.subtractNumbers;
    api.multiply = api.multiplyNumbers;
    api.divide = api.divideNumber;
    api.compare = api.compareNumbers;
    api.max = api.maxNumber;
    api.scale = (node, scale, out) => api.scaled(out, node, scale);
    return api;
}
