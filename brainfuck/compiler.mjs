import { compileBrainfuckChunks } from '../scripts/compile-brainfuck.mjs';

const cell = value => value && typeof value.index === 'number';

/** Build-time macros only: the resulting application contains the eight Brainfuck operators. */
export class BrainfuckProgram {
    constructor({ scalarCapacity = 2048, memoryPages = 64 } = {}) {
        this.pointer = 0;
        this.code = [];
        this.initializers = [];
        this.names = new Set();
        this.nextScalar = 256;
        this.nextArray = scalarCapacity;
        this.scalarCapacity = scalarCapacity;
        this.memoryPages = memoryPages;
        this.scratch = Array.from({ length: 255 }, (_, index) => ({ index: 255 - index }));
        this.initialized = { index: 0 };
        this.activeIntrinsic = null;
        this.intrinsicFrames = new Map();
    }

    scalar(name, initial = 0) {
        if (this.names.has(name)) throw new Error(`Duplicate Brainfuck name: ${name}`);
        if (this.nextScalar >= this.scalarCapacity) throw new RangeError(
            'Scalar arena is full');
        this.names.add(name);
        const value = { name, index: this.nextScalar++ };
        if (initial) this.initializers.push(() => this.set(value, initial));
        return value;
    }

    array(name, capacity, values = [], fields = 1) {
        if (!Number.isInteger(capacity) || capacity < 0 || !Number.isInteger(fields) || fields <
            1)
            throw new RangeError('Invalid Brainfuck array dimensions');
        if (this.names.has(name)) throw new Error(`Duplicate Brainfuck name: ${name}`);
        this.names.add(name);
        const array = { name, capacity, fields, stride: fields + 3, base: this.nextArray };
        this.nextArray += (capacity + 1) * array.stride;
        if (this.nextArray * 4 > this.memoryPages * 65536)
            throw new RangeError('Brainfuck tape is full');
        for (const [index, value] of values.entries()) {
            if (index >= capacity) throw new RangeError('Initial array exceeds capacity');
            if (value) this.initializers.push(() => this.arraySet(array, index, value));
        }
        return array;
    }

    scratchArray(name, capacity, fields = 1) {
        if (this.names.has(name)) throw new Error(`Duplicate Brainfuck name: ${name}`);
        const stride = fields + 3;
        if (this.nextScalar + (capacity + 1) * stride >= this.scalarCapacity)
            throw new RangeError('Scalar arena cannot hold the scratch array');
        this.names.add(name);
        const value = { name, capacity, fields, stride, base: this.nextScalar };
        this.nextScalar += (capacity + 1) * stride;
        return value;
    }

    string(name, text = '', capacity = Array.from(text).length) {
        const points = Array.from(text, char => char.codePointAt(0));
        return {
            data: this.array(name, capacity, points),
            length: this.scalar(name + ':length', points.length),
            capacity
        };
    }

    _temps(count, callback) {
        if (this.scratch.length < count) throw new RangeError(
            'Brainfuck scratch arena is full');
        const values = Array.from({ length: count }, () => this.scratch.pop());
        for (let active = this.activeIntrinsic; active; active = active.parent)
            for (const value of values) active.scratch.add(value.index);
        try {
            return callback(...values);
        } finally {
            this.scratch.push(...values.reverse());
        }
    }

    move(target) {
        const index = cell(target) ? target.index : target;
        this.code.push({ command: 'move', amount: index - this.pointer });
        this.pointer = index;
    }

    raw(source, endingPointer = this.pointer) {
        if (/[^<>+\-.,[\]\s]/.test(source)) throw new Error('Raw source must be Brainfuck');
        this.code.push(source);
        this.pointer = endingPointer;
    }

    set(out, value) {
        if (cell(value)) return this.copy(out, value);
        if (!Number.isFinite(value) || !Number.isInteger(value))
            throw new TypeError('Brainfuck scalar constants must be finite integers');
        return this._intrinsic('set', { out, value }, () => this._set(out, value));
    }

    _set(out, value) {
        this.move(out);
        this.code.push('[-]');
        const unsigned = value >>> 0;
        if (unsigned <= 256) this.code.push('+'.repeat(unsigned));
        else if (unsigned >= 0xffffff00) this.code.push('-'.repeat(0x100000000 - unsigned));
        else this._temps(1, temporary => {
            const digits = [];
            for (let number = unsigned; number; number = Math.floor(number / 256))
                digits.unshift(number % 256);
            for (const digit of digits) {
                this.set(temporary, 0);
                this.move(out);
                this.code.push('[-');
                this.move(temporary);
                this.code.push('+'.repeat(256));
                this.move(out);
                this.code.push(']');
                this._transfer(out, temporary, 1);
                this.move(out);
                this.code.push('+'.repeat(digit));
            }
        });
    }

    _transfer(out, source, factor = 1) {
        this.move(source);
        this.code.push('[-');
        this.move(out);
        this.code.push((factor >= 0 ? '+' : '-').repeat(Math.abs(factor)));
        this.move(source);
        this.code.push(']');
    }

    copy(out, source) {
        if (!cell(source)) return this.set(out, source);
        if (out.index === source.index) return;
        this._intrinsic('copy', { out, source }, () => this._temps(1, temporary => {
            this.set(out, 0);
            this.set(temporary, 0);
            this.move(source);
            this.code.push('[-');
            this.move(out);
            this.code.push('+');
            this.move(temporary);
            this.code.push('+');
            this.move(source);
            this.code.push(']');
            this._transfer(source, temporary);
        }));
    }

    add(out, value) {
        if (!cell(value) && Math.abs(value) <= 256) {
            this.move(out);
            this.code.push((value >= 0 ? '+' : '-').repeat(Math.abs(value)));
        } else this._intrinsic('add', { out, value }, () => this._temps(1, temporary => {
            this.copy(temporary, value);
            this._transfer(out, temporary);
        }));
    }

    sub(out, value) {
        if (!cell(value)) return this.add(out, -value);
        this._intrinsic('sub', { out, value }, () => this._temps(1, temporary => {
            this.copy(temporary, value);
            this._transfer(out, temporary, -1);
        }));
    }

    mul(out, left, right) {
        this._intrinsic('mul', { out, left, right }, () => this._temps(2, (input, counter) => {
            this.copy(input, left);
            this.copy(counter, right);
            this.set(out, 0);
            if (!cell(right) && Math.abs(right) <= 65536) this._transfer(out, input,
                right);
            else this.while(counter, () => {
                this.add(out, input);
                this.sub(counter, 1);
            });
        }));
    }

    eq(out, left, right) {
        this._intrinsic('eq', { out, left, right }, () => this._temps(1, difference => {
            this.copy(difference, left);
            this.sub(difference, right);
            this.set(out, 1);
            this.if(difference, () => this.set(out, 0));
        }));
    }

    not(out, value) {
        this.eq(out, value, 0);
    }

    truth(out, value) {
        this._temps(1, input => {
            this.copy(input, value);
            this.set(out, 0);
            this.if(input, () => this.set(out, 1));
        });
    }

    lt(out, left, right) {
        this._intrinsic('lt', { out, left, right }, () => this._temps(2, (a, b) => {
            this.copy(a, left);
            this.copy(b, right);
            this.while(a, () => {
                this.sub(a, 1);
                this.if(b, () => this.sub(b, 1), () => this.set(a, 0));
            });
            this.truth(out, b);
        }));
    }

    divmod(quotient, remainder, dividend, divisor) {
        this._intrinsic('divmod', { quotient, remainder, dividend, divisor }, () =>
            this._temps(3, (value, denominator, more) => {
                this.copy(value, dividend);
                this.copy(denominator, divisor);
                this.if(denominator, () => {
                    this.set(quotient, 0);
                    this.lt(more, value, denominator);
                    this.not(more, more);
                    this.while(more, () => {
                        this.sub(value, denominator);
                        this.add(quotient, 1);
                        this.lt(more, value, denominator);
                        this.not(more, more);
                    });
                    this.copy(remainder, value);
                }, () => this.trap());
            }));
    }

    if (condition, yes, no = () => {}) {
        this._temps(2, (flag, otherwise) => {
            this.copy(flag, condition);
            this.set(otherwise, 1);
            this.while(flag, () => {
                this.set(flag, 0);
                this.set(otherwise, 0);
                yes();
            });
            this.while(otherwise, () => {
                this.set(otherwise, 0);
                no();
            });
        });
    }

    while (condition, body) {
        this.move(condition);
        this.code.push('[');
        body();
        this.move(condition);
        this.code.push(']');
    }

    repeat(count, body) {
        this._temps(2, (remaining, index) => {
            this.copy(remaining, count);
            this.set(index, 0);
            this.while(remaining, () => {
                body(index);
                this.add(index, 1);
                this.sub(remaining, 1);
            });
        });
    }

    define(name, body) {
        if (typeof body !== 'function') throw new TypeError(
            'A Brainfuck function needs a body');
        return (...args) => body(this, ...args);
    }

    reusable(name, body) {
        if (typeof body !== 'function') throw new TypeError(
            'A Brainfuck procedure needs a body');
        const definition = { name, chunks: null, generating: false };
        return () => {
            if (definition.generating) throw new Error(
                'Recursive Brainfuck procedures need an explicit tape stack');
            if (!definition.chunks) {
                const scratch = Array.from({ length: 255 }, (_, index) =>
                    this.scalar('procedure:' + name + ':' + index)).reverse();
                const previous = {
                    code: this.code,
                    pointer: this.pointer,
                    scratch: this.scratch,
                    active: this.activeIntrinsic
                };
                this.code = [];
                this.pointer = 0;
                this.scratch = scratch;
                this.activeIntrinsic = null;
                definition.generating = true;
                try {
                    body();
                    this.move(0);
                    definition.chunks = this.code;
                } finally {
                    this.code = previous.code;
                    this.pointer = previous.pointer;
                    this.scratch = previous.scratch;
                    this.activeIntrinsic = previous.active;
                    definition.generating = false;
                }
            }
            this.move(0);
            this.code.push({
                native: { command: 'procedure', definition },
                fallback: definition.chunks
            });
        };
    }

    read(out) {
        this.move(out);
        this.code.push(',');
    }

    write(value) {
        if (cell(value)) {
            this.move(value);
            this.code.push('.');
        } else this._temps(1, temporary => {
            this.set(temporary, value);
            this.write(temporary);
        });
    }

    trap() {
        this.move(0);
        this.code.push('<+>');
    }

    _array(array, index, body, field = 0) {
        if (!Number.isInteger(field) || field < 0 || field >= array.fields)
            throw new RangeError('Invalid Brainfuck array field');
        if (!cell(index)) {
            if (!Number.isInteger(index) || index < 0 || index >= array.capacity)
                throw new RangeError('Brainfuck array index is out of bounds');
            body({ index: array.base + index * array.stride + 2 + field });
            return;
        }
        this._temps(1, valid => {
            this.lt(valid, index, array.capacity);
            this.if(valid, () => body(null), () => this.trap());
        });
    }

    _seek(array, index, carryValue = false) {
        const stride = array.stride;
        this.copy({ index: array.base }, index);
        this.move(array.base);
        // The outer loop advances with its remaining count into the next row.
        let code = '[-[-' + '>'.repeat(stride) + '+' +
            '<'.repeat(stride) + ']';
        if (carryValue) {
            code += '>'.repeat(stride - 1) + '[-' + '>'.repeat(stride) +
                '+' + '<'.repeat(stride) + ']' + '>';
        } else code += '>'.repeat(stride);
        code += '>+<]';
        this.raw(code, array.base);
    }

    _return(array) {
        const stride = array.stride;
        this.raw('>[-<[-' + '<'.repeat(stride) + '+' + '>'.repeat(stride) + ']' +
            '<'.repeat(stride - 1) + ']<', array.base);
    }

    arrayGet(array, index, out, field = 0) {
        this._intrinsic('arrayGet', { array, index, out, field }, () => this._array(array,
            index, direct => {
                if (direct) return this.copy(out, direct);
                this._seek(array, index);
                const position = 2 + field;
                const temporary = array.stride - 1;
                this.raw('>'.repeat(position) + '[-' + '>'.repeat(temporary - position)
                    +
                    '+' + '<'.repeat(temporary) + '+' + '>'.repeat(position) + ']' +
                    '>'.repeat(temporary - position) + '[-' +
                    '<'.repeat(temporary - position) + '+' +
                    '>'.repeat(temporary - position) + ']' + '<'.repeat(temporary),
                    array.base);
                this._return(array);
                this.copy(out, { index: array.base });
            }, field), !cell(index));
    }

    arraySet(array, index, value, field = 0) {
        this._intrinsic('arraySet', { array, index, value, field }, () => this._array(array,
            index, direct => {
                if (direct) return this.copy(direct, value);
                this.copy({ index: array.base + array.stride - 1 }, value);
                this._seek(array, index, true);
                const position = 2 + field;
                const temporary = array.stride - 1;
                this.raw('>'.repeat(position) + '[-]' + '>'.repeat(temporary - position)
                    +
                    '[-' + '<'.repeat(temporary - position) + '+' +
                    '>'.repeat(temporary - position) + ']' + '<'.repeat(temporary),
                    array.base);
                this._return(array);
            }, field), !cell(index));
    }

    _streamString(value, read) {
        this._temps(1, valid => {
            this.lt(valid, value.length, value.capacity + 1);
            this.if(valid, () => {
                const array = value.data;
                const stride = array.stride;
                this.copy({ index: array.base }, value.length);
                this.move(array.base);
                this.raw('[-' + '>>' + (read ? ',' : '.') + '<<[-' +
                    '>'.repeat(stride) + '+' + '<'.repeat(stride) + ']' +
                    '>'.repeat(stride) + '>+<]', array.base);
                this._return(array);
            }, () => this.trap());
        });
    }

    readString(value) {
        this.read(value.length);
        this._streamString(value, true);
    }

    writeString(value) {
        if (typeof value !== 'string') {
            this.write(value.length);
            this._streamString(value, false);
            return;
        }
        const points = Array.from(value, char => char.codePointAt(0));
        this.write(points.length);
        this._temps(1, output => {
            this.set(output, 0);
            let previous = 0;
            for (const point of points) {
                this.add(output, point - previous);
                this.write(output);
                previous = point;
            }
        });
    }

    _intrinsic(kind, operands, fallback, skip = false) {
        if (skip) return fallback();
        const pointer = this.pointer;
        const frameKey = this.scratch.map(value => value.index).join(':');
        if (!this.intrinsicFrames.has(frameKey)) this.intrinsicFrames.set(frameKey, {
            values: this.scratch.slice(),
            indices: this.scratch.map(value => value.index)
        });
        const frame = this.intrinsicFrames.get(frameKey);
        const scratch = frame.values;
        let cleanup = scratch;
        if (kind === 'set') {
            const value = operands.value >>> 0;
            cleanup = value <= 256 || value >= 0xffffff00 ? [] : scratch.slice(-1);
        } else if (kind === 'copy') cleanup = scratch.slice(-1);
        else if (kind === 'add' || kind === 'sub') cleanup = scratch.slice(-2);
        else if (kind === 'eq' || kind === 'mul') cleanup = scratch.slice(-4);
        const expand = () => {
            const previous = {
                code: this.code,
                pointer: this.pointer,
                scratch: this.scratch,
                active: this.activeIntrinsic
            };
            this.code = [];
            this.pointer = pointer;
            this.scratch = scratch.slice();
            this.activeIntrinsic = null;
            try {
                fallback();
                for (const value of cleanup) this._set(value, 0);
                this.move(pointer);
                return this.code;
            } finally {
                this.code = previous.code;
                this.pointer = previous.pointer;
                this.scratch = previous.scratch;
                this.activeIntrinsic = previous.active;
            }
        };
        this.code.push({
            native: {
                command: 'native',
                kind,
                ...operands,
                scratch: cleanup === scratch ? frame.indices : cleanup.map(value =>
                    value.index),
                endPointer: pointer
            },
            fallback: expand
        });
    }

    chunks() {
        const body = this.code;
        const bodyPointer = this.pointer;
        this.code = [];
        this.pointer = 0;
        this._temps(1, needsInitialization => {
            this.not(needsInitialization, this.initialized);
            this.if(needsInitialization, () => {
                for (const initialize of this.initializers) initialize();
                this.set(this.initialized, 1);
            });
        });
        this.move(0);
        const chunks = [...this.code, ...body];
        this.code = body;
        this.pointer = bodyPointer;
        return chunks;
    }

    * sourceChunks(size = 65536) {
        function* expand(chunks) {
            for (const chunk of chunks) {
                if (typeof chunk === 'string') yield chunk;
                else if (chunk.fallback) yield* expand(typeof chunk.fallback === 'function'
                    ? chunk.fallback() : chunk.fallback);
                else {
                    const character = chunk.amount >= 0 ? '>' : '<';
                    for (let remaining = Math.abs(chunk.amount); remaining > 0; remaining -=
                        size)
                        yield character.repeat(Math.min(size, remaining));
                }
            }
        }
        yield* expand(this.chunks());
    }

    source() {
        return [...this.sourceChunks()].join('');
    }

    compile({ optimizeLibrary = true, disabledKinds = [] } = {}) {
        return compileBrainfuckChunks(this.chunks(), {
            memoryPages: this.memoryPages,
            optimizeLibrary,
            disabledKinds
        });
    }
}
