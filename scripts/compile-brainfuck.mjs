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

function parse(source) {
    const commands = source.match(/[<>+\-.,[\]]/g) || [];
    const root = [];
    const stack = [root];
    for (let index = 0; index < commands.length; index++) {
        const command = commands[index];
        const current = stack.at(-1);
        if (command === '[') {
            const body = [];
            current.push({ command, body });
            stack.push(body);
        } else if (command === ']') {
            if (stack.length === 1) throw new SyntaxError('Unmatched Brainfuck closing bracket');
            stack.pop();
        } else if ('+-<>'.includes(command)) {
            const move = command === '<' || command === '>';
            let amount = command === '+' || command === '>' ? 1 : -1;
            while (index + 1 < commands.length &&
                (move ? '<>' : '+-').includes(commands[index + 1])) {
                amount += commands[++index] === '+' || commands[index] === '>' ? 1 : -1;
            }
            current.push({ command: move ? 'move' : 'add', amount });
        } else current.push({ command });
    }
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

export function compileBrainfuck(source) {
    if (typeof source !== 'string') throw new TypeError('Brainfuck source must be a string');
    const tree = parse(source);
    const code = [];
    const address = (offset = 0) => {
        code.push(0x20, 0);
        if (offset) code.push(0x41, ...signed(offset * 4), 0x6a);
    };
    const load = () => code.push(0x28, 2, 0);
    const store = () => code.push(0x36, 2, 0);
    const clear = () => {
        address();
        code.push(0x41, 0);
        store();
    };
    const emit = items => {
        for (const item of items) {
            if (item.command === 'move') {
                address(item.amount);
                code.push(0x21, 0);
            } else if (item.command === 'add') {
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
                    code.push(0x02, 0x40, 0x03, 0x40);
                    address();
                    load();
                    code.push(0x45, 0x0d, 1);
                    emit(item.body);
                    code.push(0x0c, 0, 0x0b, 0x0b);
                }
            }
        }
    };
    emit(tree);
    const body = [1, 2, 0x7f, ...code, 0x0b];
    return new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0,
        ...section(1, [3, 0x60, 0, 1, 0x7f, 0x60, 1, 0x7f, 0, 0x60, 0, 0]),
        ...section(2, [2, ...text('env'), ...text('read'), 0, 0,
            ...text('env'), ...text('write'), 0, 1]),
        ...section(3, [1, 2]),
        ...section(5, [1, 1, 1, 1]),
        ...section(7, [2, ...text('memory'), 2, 0, ...text('run'), 0, 2]),
        ...section(10, [1, ...unsigned(body.length), ...body])
    ]);
}
