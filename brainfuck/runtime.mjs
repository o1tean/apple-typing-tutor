export const TYPE = Object.freeze({ NULL: 1, BOOL: 2, NUMBER: 3, STRING: 4, OBJECT: 5, ARRAY: 6 });
export const NUMBER = Object.freeze({ FINITE: 1, NEGATIVE: 2, INTEGER: 4, BITS: 8 });
export const TOKEN_FIELDS = ['type', 'child', 'next', 'key', 'value', 'numberFlags',
    'numberLo', 'numberHi', 'fraction', 'raw', 'floatHi'];

/** Generic token structure; every traversal, selection and mutation below emits Brainfuck. */
export function createTokenArena(b, capacity = 4096, name = 'json') {
    const data = b.array(name + ':nodes', capacity + 1, [], TOKEN_FIELDS.length);
    const count = b.scalar(name + ':count');
    const freeHead = b.scalar(name + ':freeHead');
    const stack = b.array(name + ':cloneStack', capacity, [], 3);
    const arena = {
        data,
        count,
        freeHead,
        capacity,
        layout: {
            base: data.base,
            stride: data.stride,
            dataOffset: 2,
            fields: TOKEN_FIELDS,
            countIndex: count.index,
            freeHeadIndex: freeHead.index,
            capacity
        }
    };
    arena.get = (out, field, node) => {
        const index = TOKEN_FIELDS.indexOf(field);
        if (index < 0) throw new Error(`Unknown token field: ${field}`);
        b.arrayGet(data, node, out, index);
    };
    arena.set = (field, node, value) => {
        const index = TOKEN_FIELDS.indexOf(field);
        if (index < 0) throw new Error(`Unknown token field: ${field}`);
        b.arraySet(data, node, value, index);
    };
    arena.load = amount => {
        b._temps(1, valid => {
            b.lt(valid, amount, capacity + 1);
            b.if(valid, () => {
                b.copy(count, amount);
                const first = data.base + data.stride;
                b.copy({ index: first }, amount);
                b.set({ index: first + 1 }, 1);
                b.move(first);
                let code = '[-';
                for (let field = 0; field < TOKEN_FIELDS.length; field++)
                    code += (field === 0 ? '>>' : '>') + ',';
                code += '<'.repeat(TOKEN_FIELDS.length + 1) + '[-' +
                    '>'.repeat(data.stride) + '+' + '<'.repeat(data.stride) +
                    ']' +
                    '>'.repeat(data.stride) + '>+<]';
                b.raw(code, data.base);
                b._return(data);
            }, () => b.trap());
        });
    };
    arena.new = (out, type, key = 0, value = 0) => {
        b._temps(1, valid => {
            b.if(freeHead, () => {
                b.copy(out, freeHead);
                arena.get(freeHead, 'next', out);
            }, () => {
                b.lt(valid, count, capacity);
                b.if(valid, () => {
                    b.add(count, 1);
                    b.copy(out, count);
                }, () => b.trap());
            });
            for (const field of TOKEN_FIELDS) arena.set(field, out, 0);
            arena.set('type', out, type);
            arena.set('key', out, key);
            arena.set('value', out, value);
        });
    };
    arena.field = (out, parent, key) => {
        b._temps(3, (current, actual, match) => {
            arena.get(current, 'child', parent);
            b.set(out, 0);
            b.while(current, () => {
                arena.get(actual, 'key', current);
                b.eq(match, actual, key);
                b.if(match, () => {
                    b.copy(out, current);
                    b.set(current, 0);
                }, () => arena.get(current, 'next', current));
            });
        });
    };
    arena.each = (parent, callback) => {
        b._temps(3, (current, next, key) => {
            arena.get(current, 'child', parent);
            b.while(current, () => {
                arena.get(next, 'next', current);
                arena.get(key, 'key', current);
                callback(current, key);
                b.copy(current, next);
            });
        });
    };
    arena.append = (parent, node) => {
        b._temps(2, (current, next) => {
            arena.set('next', node, 0);
            arena.get(current, 'child', parent);
            b.if(current, () => {
                arena.get(next, 'next', current);
                b.while(next, () => {
                    b.copy(current, next);
                    arena.get(next, 'next', current);
                });
                arena.set('next', current, node);
            }, () => arena.set('child', parent, node));
        });
    };
    arena.remove = (parent, key) => {
        b._temps(5, (current, previous, next, actual, match) => {
            arena.get(current, 'child', parent);
            b.set(previous, 0);
            b.while(current, () => {
                arena.get(next, 'next', current);
                arena.get(actual, 'key', current);
                b.eq(match, actual, key);
                b.if(match, () => {
                    b.if(previous, () => arena.set('next', previous,
                            next),
                        () => arena.set('child', parent, next));
                    arena.set('next', current, 0);
                    b.set(current, 0);
                }, () => {
                    b.copy(previous, current);
                    b.copy(current, next);
                });
            });
        });
    };
    const cloneNode = (out, source) => b._temps(1, value => {
        arena.new(out, TYPE.NULL);
        for (const field of TOKEN_FIELDS) {
            if (field === 'child' || field === 'next') continue;
            arena.get(value, field, source);
            arena.set(field, out, value);
        }
    });
    arena.clone = (out, source) => {
        b._temps(6, (original, depth, current, destination, child, copy) => {
            b.copy(original, source);
            cloneNode(out, original);
            b.set(depth, 0);
            arena.get(child, 'child', original);
            b.if(child, () => {
                b.arraySet(stack, depth, child, 0);
                b.arraySet(stack, depth, out, 1);
                b.add(depth, 1);
            });
            b.while(depth, () => {
                b.copy(current, depth);
                b.sub(current, 1);
                b.arrayGet(stack, current, child, 0);
                b.arrayGet(stack, current, destination, 1);
                b.if(child, () => {
                    arena.get(original, 'next', child);
                    b.arraySet(stack, current, original, 0);
                    cloneNode(copy, child);
                    arena.append(destination, copy);
                    arena.get(original, 'child', child);
                    b.if(original, () => {
                        b.arraySet(stack, depth, original, 0);
                        b.arraySet(stack, depth, copy, 1);
                        b.add(depth, 1);
                    });
                }, () => b.sub(depth, 1));
            });
        });
    };
    arena.merge = (target, source) => {
        arena.each(source, (node, key) => b._temps(1, copy => {
            arena.clone(copy, node);
            arena.remove(target, key);
            arena.append(target, copy);
        }));
    };
    arena.object = out => arena.new(out, TYPE.OBJECT);
    arena.array = out => arena.new(out, TYPE.ARRAY);
    arena.number = (out, low, high = 0, flags = NUMBER.FINITE | NUMBER.INTEGER, raw = 0) => {
        arena.new(out, TYPE.NUMBER);
        arena.set('numberLo', out, low);
        arena.set('numberHi', out, high);
        arena.set('numberFlags', out, flags);
        arena.set('raw', out, raw);
    };
    arena.string = (out, handle) => arena.new(out, TYPE.STRING, 0, handle);
    arena.boolean = (out, value) => arena.new(out, TYPE.BOOL, 0, value);
    arena.setField = (parent, key, node) => {
        arena.remove(parent, key);
        arena.set('key', node, key);
        arena.append(parent, node);
    };
    return arena;
}

/** Eight bounded base-256 digits retain all unsigned 64-bit integer values. */
export function uint64(b, name, initial = 0n) {
    const value = BigInt(initial);
    if (value < 0n || value > 0xffffffffffffffffn) throw new RangeError('Invalid uint64 constant');
    return {
        digits: Array.from({ length: 8 }, (_, index) =>
            b.scalar(name + ':' + index, Number((value >> BigInt(index * 8)) & 255n)))
    };
}

export function copy64(b, out, value) {
    for (let index = 0; index < 8; index++) b.copy(out.digits[index], value.digits[index]);
}

export function fromPair64(b, out, low, high = 0) {
    b._intrinsic('wideFromPair', { out, low, high }, () => b._temps(3, (input, quotient,
        remainder) => {
        for (let word = 0; word < 2; word++) {
            b.copy(input, word ? high : low);
            for (let digit = 0; digit < 4; digit++) {
                b.divmod(quotient, remainder, input, 256);
                b.copy(out.digits[word * 4 + digit], remainder);
                b.copy(input, quotient);
            }
        }
    }));
}

export function toPair64(b, low, high, input) {
    b._intrinsic('wideToPair', { low, high, input }, () => b._temps(2, (lower, upper) => {
        b.set(lower, 0);
        b.set(upper, 0);
        for (let digit = 3; digit >= 0; digit--) {
            b.mul(lower, lower, 256);
            b.add(lower, input.digits[digit]);
            b.mul(upper, upper, 256);
            b.add(upper, input.digits[digit + 4]);
        }
        b.copy(low, lower);
        b.copy(high, upper);
    }));
}

function temporary64(b, count, callback) {
    b._temps(count * 8, (...digits) => callback(...Array.from({ length: count }, (_, index) =>
        ({ digits: digits.slice(index * 8, index * 8 + 8) }))));
}

function constant64(b, out, value) {
    const integer = BigInt(value);
    for (let index = 0; index < 8; index++)
        b.set(out.digits[index], Number((integer >> BigInt(index * 8)) & 255n));
}

export function mul64(b, out, left, right) {
    b._intrinsic('wideMul', { out, left, right }, () => temporary64(b, 2, (a, c) => {
        copy64(b, a, left);
        if (typeof right === 'number' || typeof right === 'bigint') constant64(b, c,
            right);
        else copy64(b, c, right);
        b._temps(2, (sum, carry) => {
            for (const digit of out.digits) b.set(digit, 0);
            for (let i = 0; i < 8; i++) {
                b.set(carry, 0);
                for (let j = 0; j < 8 - i; j++) {
                    b.mul(sum, a.digits[i], c.digits[j]);
                    b.add(sum, out.digits[i + j]);
                    b.add(sum, carry);
                    b.divmod(carry, out.digits[i + j], sum, 256);
                }
            }
        });
    }));
}

export function div64(b, quotient, remainder, dividend, divisor) {
    b._intrinsic('wideDiv', { quotient, remainder, dividend, divisor }, () => temporary64(b, 2, (
        input, denominator) => {
        copy64(b, input, dividend);
        if (typeof divisor === 'number' || typeof divisor === 'bigint') constant64(b,
            denominator, divisor);
        else copy64(b, denominator, divisor);
        b._temps(6, (nonzero, carry, comparison, take, bit, partial) => {
            b.set(nonzero, 0);
            for (const digit of denominator.digits) b.add(nonzero, digit);
            b.if(nonzero, () => {}, () => b.trap());
            for (const digit of quotient.digits) b.set(digit, 0);
            for (const digit of remainder.digits) b.set(digit, 0);
            for (let digit = 7; digit >= 0; digit--) {
                for (let position = 7; position >= 0; position--) {
                    b.divmod(partial, bit, input.digits[digit], 2 ** position);
                    b.divmod(partial, bit, partial, 2);
                    b.lt(carry, remainder.digits[7], 128);
                    b.not(carry, carry);
                    add64(b, remainder, remainder, remainder);
                    b.add(remainder.digits[0], bit);
                    compare64(b, comparison, remainder, denominator);
                    b.eq(take, comparison, -1);
                    b.not(take, take);
                    b.if(carry, () => b.set(take, 1));
                    b.if(take, () => {
                        sub64(b, remainder, remainder, denominator);
                        b.add(quotient.digits[digit], 2 ** position);
                    });
                }
            }
        });
    }));
}

export function compare64(b, out, left, right) {
    b._intrinsic('wideCompare', { out, left, right }, () => b._temps(3, (equal, less, active) => {
        b.set(out, 0);
        b.set(active, 1);
        for (let index = 7; index >= 0; index--) b.if(active, () => {
            b.eq(equal, left.digits[index], right.digits[index]);
            b.if(equal, () => {}, () => {
                b.lt(less, left.digits[index], right.digits[index]);
                b.if(less, () => b.set(out, -1), () => b.set(out, 1));
                b.set(active, 0);
            });
        });
    }));
}

export function add64(b, out, left, right) {
    b._intrinsic('wideAdd', { out, left, right }, () => b._temps(3, (sum, carry, small) => {
        b.set(carry, 0);
        for (let index = 0; index < 8; index++) {
            b.copy(sum, left.digits[index]);
            b.add(sum, right.digits[index]);
            b.add(sum, carry);
            b.lt(small, sum, 256);
            b.not(carry, small);
            b.if(carry, () => b.sub(sum, 256));
            b.copy(out.digits[index], sum);
        }
    }));
}

export function sub64(b, out, left, right) {
    b._intrinsic('wideSub', { out, left, right }, () => b._temps(4, (difference, borrow, operand,
        small) => {
        b.set(borrow, 0);
        for (let index = 0; index < 8; index++) {
            b.copy(operand, right.digits[index]);
            b.add(operand, borrow);
            b.lt(small, left.digits[index], operand);
            b.copy(difference, left.digits[index]);
            b.if(small, () => b.add(difference, 256));
            b.sub(difference, operand);
            b.copy(out.digits[index], difference);
            b.copy(borrow, small);
        }
    }));
}

export function writeUnsigned(b, value) {
    b._temps(5, (remaining, quotient, remainder, length, index) => {
        const digits = b.array('decimal:' + b.names.size, 10);
        b.copy(remaining, value);
        b.set(length, 0);
        b.set(index, 1);
        b.while(index, () => {
            b.divmod(quotient, remainder, remaining, 10);
            b.add(remainder, 48);
            b.arraySet(digits, length, remainder);
            b.add(length, 1);
            b.copy(remaining, quotient);
            b.truth(index, remaining);
        });
        b.write(length);
        b.while(length, () => {
            b.sub(length, 1);
            b.arrayGet(digits, length, remainder);
            b.write(remainder);
        });
    });
}
