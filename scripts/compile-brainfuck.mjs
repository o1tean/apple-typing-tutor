/** Compile Brainfuck with wrapping 32-bit cells to a standalone WebAssembly module. */

function unsigned(value) {
    const bytes = [];
    do {
        const byte = value & 127;
        value >>>= 7;
        bytes.push(byte | (value ? 128 : 0));
    } while (value);
    return bytes;
}

function signed(value) {
    const bytes = [];
    let more;
    do {
        const byte = value & 127;
        value >>= 7;
        more = !((value === 0 && !(byte & 64)) || (value === -1 && (byte & 64)));
        bytes.push(byte | (more ? 128 : 0));
    } while (more);
    return bytes;
}

function text(value) {
    const bytes = new TextEncoder().encode(value);
    return [...unsigned(bytes.length), ...bytes];
}

function section(id, bytes) {
    return [id, ...unsigned(bytes.length), ...bytes];
}

function parse(chunks, optimizeLibrary = true, disabledKinds = []) {
    const root = [];
    const stack = [root];
    let pending = null;
    const flush = () => {
        if (pending) stack.at(-1).push(pending);
        pending = null;
    };
    const accept = command => {
        const current = stack.at(-1);
        if (typeof command === 'object') {
            if (command.command === 'move' || command.command === 'add') {
                if (pending?.command === command.command) pending.amount += command.amount;
                else {
                    flush();
                    pending = { ...command };
                }
            } else {
                flush();
                current.push(command);
            }
        } else if (command === '[') {
            flush();
            const body = [];
            current.push({ command, body });
            stack.push(body);
        } else if (command === ']') {
            flush();
            if (stack.length === 1) throw new SyntaxError(
                'Unmatched Brainfuck closing bracket');
            stack.pop();
        } else if ('+-<>'.includes(command)) {
            const move = command === '<' || command === '>';
            accept({
                command: move ? 'move' : 'add',
                amount: command === '+' || command === '>' ? 1 : -1
            });
        } else if (command === ',' || command === '.') {
            flush();
            current.push({ command });
        }
    };
    const consume = values => {
        for (const chunk of values) {
            if (typeof chunk === 'string') {
                for (const command of chunk)
                    if ('<>+-.,[]'.includes(command)) accept(command);
            } else if (chunk.fallback) {
                if (optimizeLibrary && !disabledKinds.includes(chunk.native.kind)) accept(chunk
                    .native);
                else consume(typeof chunk.fallback === 'function' ? chunk.fallback() : chunk
                    .fallback);
            } else accept(chunk);
        }
    };
    consume(chunks);
    flush();
    if (stack.length !== 1) throw new SyntaxError('Unmatched Brainfuck opening bracket');
    return root;
}

function transfer(body) {
    let pointer = 0;
    const changes = new Map();
    for (const item of body) {
        if (item.command === 'move') pointer += item.amount;
        else if (item.command === 'add') {
            changes.set(pointer, (changes.get(pointer) || 0) + item.amount);
        } else return null;
    }
    return pointer === 0 && changes.get(0) === -1 ? changes : null;
}

export function compileBrainfuck(source, { memoryPages = 1 } = {}) {
    if (typeof source !== 'string') throw new TypeError('Brainfuck source must be a string');
    return compileBrainfuckChunks([source], { memoryPages });
}

export function compileBrainfuckChunks(chunks, {
    memoryPages = 1,
    optimizeLibrary = true,
    disabledKinds = []
} = {}) {
    if (!Number.isInteger(memoryPages) || memoryPages < 1 || memoryPages > 65536)
        throw new RangeError('Invalid Brainfuck memory size');
    const tree = parse(chunks, optimizeLibrary, disabledKinds);
    let code = [];
    let pendingMove = 0;
    const helpers = [];
    const helperCache = new Map();
    const nativeCache = new Map();
    const procedureCache = new Map();
    const address = (offset = 0) => {
        code.push(0x20, 0);
        const delta = offset + pendingMove;
        if (delta) code.push(0x41, ...signed(delta * 4), 0x6a);
    };
    const flushPointer = () => {
        if (pendingMove) {
            address();
            code.push(0x21, 0);
            pendingMove = 0;
        }
    };
    const load = () => code.push(0x28, 2, 0);
    const store = () => code.push(0x36, 2, 0);
    const clear = () => {
        address();
        code.push(0x41, 0);
        store();
    };
    const constant = value => code.push(0x41, ...signed(value));
    const at = index => constant(index * 4);
    const operand = value => {
        if (typeof value === 'number') constant(value);
        else {
            at(value.index);
            load();
        }
    };
    const absoluteStore = (index, value) => {
        at(index);
        value();
        store();
    };
    const wide = value => {
        if (typeof value === 'number' || typeof value === 'bigint') {
            let integer = BigInt.asIntN(64, BigInt(value));
            const bytes = [];
            let more;
            do {
                const byte = Number(integer & 127n);
                integer >>= 7n;
                more = !((integer === 0n && !(byte & 64)) || (integer === -1n && (byte & 64)));
                bytes.push(byte | (more ? 128 : 0));
            } while (more);
            code.push(0x42, ...bytes);
        } else {
            code.push(0x42, 0);
            for (let index = 0; index < 8; index++) {
                operand(value.digits[index]);
                code.push(0xad);
                wide(index * 8);
                code.push(0x86, 0x84);
            }
        }
    };
    const storeWide = (out, local) => {
        for (let index = 0; index < 8; index++) absoluteStore(out.digits[index].index, () => {
            code.push(0x20, local);
            wide(index * 8);
            code.push(0x88, 0xa7);
            constant(255);
            code.push(0x71);
        });
    };
    const native = item => {
        if (item.kind.startsWith('float')) {
            wide(item.left ?? item.input);
            code.push(0x21, 4);
            if (item.kind === 'floatFromUnsigned') code.push(0x20, 4, 0xba, 0xbd, 0x21, 4);
            else if (item.kind === 'floatToUnsigned') code.push(0x20, 4, 0xbf, 0xfc, 7, 0x21,
                4);
            else if (item.kind === 'floatSqrt') code.push(0x20, 4, 0xbf, 0x9f, 0xbd, 0x21, 4);
            else if (item.kind === 'floatCompare') {
                wide(item.right);
                code.push(0x21, 5);
                absoluteStore(item.out.index, () => code.push(
                    0x20, 4, 0xbf, 0x20, 5, 0xbf, 0x64,
                    0x20, 4, 0xbf, 0x20, 5, 0xbf, 0x63, 0x6b));
            } else {
                code.push(0x20, 4, 0xbf);
                wide(item.right);
                code.push(0xbf);
                const opcode = {
                    floatAdd: 0xa0,
                    floatSub: 0xa1,
                    floatMul: 0xa2,
                    floatDiv: 0xa3
                } [item.kind];
                if (!opcode) throw new Error('Unknown Brainfuck floating operation');
                code.push(opcode, 0xbd, 0x21, 4);
            }
            if (item.kind !== 'floatCompare') storeWide(item.out, 4);
        } else if (item.kind.startsWith('wide')) {
            if (item.kind === 'wideFromPair') {
                operand(item.low);
                code.push(0xad);
                operand(item.high);
                code.push(0xad);
                wide(32);
                code.push(0x86, 0x84, 0x21, 4);
                storeWide(item.out, 4);
            } else if (item.kind === 'wideToPair') {
                wide(item.input);
                code.push(0x21, 4);
                for (const [out, shift] of [[item.low, 0], [item.high, 32]])
                    absoluteStore(out.index, () => {
                        code.push(0x20, 4);
                        wide(shift);
                        code.push(0x88, 0xa7);
                    });
            } else {
                wide(item.left ?? item.dividend);
                code.push(0x21, 4);
                wide(item.right ?? item.divisor);
                code.push(0x21, 5);
                if (item.kind === 'wideCompare') absoluteStore(item.out.index, () => {
                    code.push(0x20, 4, 0x20, 5, 0x56, 0x20, 4, 0x20, 5, 0x54, 0x6b);
                });
                else if (item.kind === 'wideDiv') {
                    code.push(0x20, 4, 0x20, 5, 0x80, 0x21, 4);
                    // Preserve the dividend for the remainder before replacing local 4.
                    wide(item.dividend);
                    code.push(0x20, 5, 0x82, 0x21, 5);
                    storeWide(item.quotient, 4);
                    storeWide(item.remainder, 5);
                } else {
                    const opcode = { wideAdd: 0x7c, wideSub: 0x7d, wideMul: 0x7e } [item.kind];
                    if (!opcode) throw new Error('Unknown wide Brainfuck arithmetic');
                    code.push(0x20, 4, 0x20, 5, opcode, 0x21, 4);
                    storeWide(item.out, 4);
                }
            }
        } else if (item.kind === 'set') {
            absoluteStore(item.out.index, () => constant(item.value));
        } else if (item.kind === 'copy') {
            absoluteStore(item.out.index, () => operand(item.source));
        } else if (item.kind === 'add' || item.kind === 'sub') {
            absoluteStore(item.out.index, () => {
                operand(item.out);
                operand(item.value);
                code.push(item.kind === 'add' ? 0x6a : 0x6b);
            });
        } else if (item.kind === 'eq' || item.kind === 'mul') {
            absoluteStore(item.out.index, () => {
                operand(item.left);
                operand(item.right);
                code.push(item.kind === 'eq' ? 0x46 : 0x6c);
            });
        } else if (item.kind === 'lt') {
            absoluteStore(item.out.index, () => {
                operand(item.left);
                operand(item.right);
                code.push(0x49);
            });
        } else if (item.kind === 'divmod') {
            operand(item.dividend);
            code.push(0x21, 2);
            operand(item.divisor);
            code.push(0x21, 3);
            for (const [out, opcode] of [[item.quotient, 0x6e], [item.remainder, 0x70]])
                absoluteStore(out.index, () => code.push(0x20, 2, 0x20, 3, opcode));
        } else if (item.kind === 'arrayGet' || item.kind === 'arraySet') {
            operand(item.index);
            code.push(0x21, 2, 0x20, 2);
            constant(item.array.capacity);
            code.push(0x49, 0x45, 0x04, 0x40, 0x00, 0x0b);
            const location = () => {
                at(item.array.base + 2 + item.field);
                code.push(0x20, 2);
                constant(item.array.stride * 4);
                code.push(0x6c, 0x6a);
            };
            if (item.kind === 'arrayGet') {
                location();
                load();
                code.push(0x21, 3);
                absoluteStore(item.out.index, () => code.push(0x20, 3));
                absoluteStore(item.array.base, () => code.push(0x20, 3));
            } else {
                operand(item.value);
                code.push(0x21, 3);
                location();
                code.push(0x20, 3);
                store();
                absoluteStore(item.array.base, () => constant(0));
                absoluteStore(item.array.base + item.array.stride - 1, () => constant(0));
            }
        } else throw new Error('Unknown Brainfuck library optimization');
        const scratch = [...item.scratch].sort((a, b) => a - b);
        for (let offset = 0; offset < scratch.length;) {
            const first = scratch[offset];
            let last = first;
            while (++offset < scratch.length && scratch[offset] === last + 1) last++;
            constant(first * 4);
            constant(0);
            constant((last - first + 1) * 4);
            code.push(0xfc, 11, 0);
        }
        if (item.endPointer !== null) {
            constant(item.endPointer * 4);
            code.push(0x21, 0);
        }
    };
    const weights = new WeakMap();
    const weight = items => {
        if (!weights.has(items)) weights.set(items, items.reduce((total, item) => total +
            (item.body ? weight(item.body) + 1 : item.command === 'native' ? 50 : 1), 0
        ));
        return weights.get(items);
    };
    const helper = (items, split = false) => {
        const previous = code;
        const previousMove = pendingMove;
        code = [];
        pendingMove = 0;
        if (split) sequence(items);
        else emit(items);
        flushPointer();
        code.push(0x20, 0, 0x0b);
        const body = new Uint8Array([2, 3, 0x7f, 2, 0x7e, ...code]);
        let hash = 2166136261;
        for (const byte of body) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
        const key = body.length + ':' + hash;
        const candidates = helperCache.get(key) ?? [];
        let slot = candidates.find(index => body.every((byte, offset) => helpers[index][offset]
            === byte));
        if (slot === undefined) {
            slot = helpers.length;
            helpers.push(body);
            candidates.push(slot);
            helperCache.set(key, candidates);
        }
        code = previous;
        pendingMove = previousMove;
        flushPointer();
        code.push(0x20, 0, 0x10, ...unsigned(slot + 3), 0x21, 0);
        return slot;
    };
    const nativeHelper = item => {
        const key = JSON.stringify(item, (name, value) => {
            if (name === 'name' || name === 'endPointer') return undefined;
            if (typeof value === 'bigint') return 'bigint:' + value;
            if (name === 'scratch') return value.join(':');
            return value;
        });
        let slot = nativeCache.get(key);
        if (slot === undefined) {
            const previous = code;
            const previousMove = pendingMove;
            code = [];
            pendingMove = 0;
            native({ ...item, endPointer: null });
            code.push(0x20, 0, 0x0b);
            slot = helpers.length;
            helpers.push(new Uint8Array([2, 3, 0x7f, 2, 0x7e, ...code]));
            nativeCache.set(key, slot);
            code = previous;
            pendingMove = previousMove;
        }
        code.push(0x20, 0, 0x10, ...unsigned(slot + 3), 0x21, 0);
    };
    const sequence = items => {
        if (weight(items) <= 1000) return emit(items);
        let group = [];
        let size = 0;
        for (const item of items) {
            const itemSize = item.body ? weight(item.body) + 1 : item.command === 'native' ? 50
                : 1;
            if (group.length && size + itemSize > 1000) {
                helper(group);
                group = [];
                size = 0;
            }
            group.push(item);
            size += itemSize;
        }
        if (group.length) helper(group);
    };
    const emit = items => {
        for (const item of items) {
            if (item.command === 'native') nativeHelper(item);
            else if (item.command === 'procedure') {
                const definition = item.definition;
                let slot = procedureCache.get(definition);
                if (slot === undefined) {
                    slot = helper(parse(definition.chunks, optimizeLibrary, disabledKinds),
                        true);
                    procedureCache.set(definition, slot);
                } else {
                    flushPointer();
                    code.push(0x20, 0, 0x10, ...unsigned(slot + 3), 0x21, 0);
                }
            } else if (item.command === 'move') {
                pendingMove += item.amount;
            } else if (item.command === 'add') {
                flushPointer();
                address();
                address();
                load();
                code.push(0x41, ...signed(item.amount), 0x6a);
                store();
            } else if (item.command === ',') {
                address();
                code.push(0x10, 0);
                store();
            } else if (item.command === '.') {
                address();
                load();
                code.push(0x10, 1);
            } else {
                const changes = transfer(item.body);
                if (changes) {
                    address();
                    load();
                    code.push(0x21, 1, 0x20, 1, 0x04, 0x40);
                    for (const [offset, amount] of changes) {
                        if (offset === 0) continue;
                        // Retain net-zero destinations so invalid accesses still trap.
                        address(offset);
                        address(offset);
                        load();
                        code.push(0x20, 1, 0x41, ...signed(amount), 0x6c, 0x6a);
                        store();
                    }
                    clear();
                    code.push(0x0b);
                } else {
                    flushPointer();
                    code.push(0x02, 0x40, 0x03, 0x40);
                    address();
                    load();
                    code.push(0x45, 0x0d, 1);
                    if (weight(item.body) > 8 && weight(item.body) <= 1000) helper(item.body);
                    else sequence(item.body);
                    flushPointer();
                    code.push(0x0c, 0, 0x0b, 0x0b);
                }
            }
        }
    };
    sequence(tree);
    const body = new Uint8Array([2, 4, 0x7f, 2, 0x7e, ...code, 0x0b]);
    const concatenate = parts => {
        const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
        let offset = 0;
        for (const part of parts) {
            bytes.set(part, offset);
            offset += part.length;
        }
        return bytes;
    };
    const bodies = [body, ...helpers];
    const codeSection = concatenate([unsigned(bodies.length), ...bodies.flatMap(value => [unsigned(
        value.length), value])]);
    return concatenate([
        [
        0, 97, 115, 109, 1, 0, 0, 0,
        ...section(1, [4, 0x60, 0, 1, 0x7f, 0x60, 1, 0x7f, 0, 0x60, 0, 0,
            0x60, 1, 0x7f, 1, 0x7f]),
        ...section(2, [2, ...text('env'), ...text('read'), 0, 0,
            ...text('env'), ...text('write'), 0, 1]),
        ...section(3, [...unsigned(bodies.length), 2, ...helpers.map(() => 3)]),
        ...section(5, [1, 1, ...unsigned(memoryPages), ...unsigned(memoryPages)]),
        ...section(7, [2, ...text('memory'), 2, 0, ...text('run'), 0, 2]),
        10, ...unsigned(codeSection.length)], codeSection
    ]);
}
