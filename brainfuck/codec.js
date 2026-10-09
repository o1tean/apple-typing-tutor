/* Structural JSON transport. Product validation and merging run on the Brainfuck tape. */
export class TokenCodec {
    constructor(memory, layout, strings = []) {
        this.memory = memory;
        this.layout = layout;
        this.strings = [''];
        this.ids = new Map([['', 0]]);
        this.nullableIds = new Map();
        for (const value of strings) this.intern(value);
    }

    intern(value) {
        value = String(value);
        if (!this.ids.has(value)) {
            this.ids.set(value, this.strings.length);
            this.strings.push(value);
        }
        return this.ids.get(value);
    }

    internNullable(value) {
        if (value !== '') return this.intern(value);
        if (!this.nullableIds.has(value)) {
            this.nullableIds.set(value, this.strings.length);
            this.strings.push(value);
        }
        return this.nullableIds.get(value);
    }

    get tape() {
        return new Uint32Array(this.memory.buffer);
    }

    field(id, name, value) {
        const fieldIndex = this.layout.fields.indexOf(name);
        if (fieldIndex < 0) throw new RangeError('Unknown JSON transport field');
        const at = this.layout.base + id * this.layout.stride +
            this.layout.dataOffset + fieldIndex;
        if (value === undefined) return this.tape[at];
        this.tape[at] = value;
    }

    encode(value, key = 0) {
        const before = this.tape[this.layout.countIndex];
        const headIndex = this.layout.freeHeadIndex;
        const head = headIndex === undefined ? 0 : this.tape[headIndex];
        const allocated = [];
        this.allocated = allocated;
        try {
            return this._encode(value, key);
        } catch (error) {
            this.tape[this.layout.countIndex] = before;
            for (const [id, next] of allocated) this.field(id, 'next', next);
            if (headIndex !== undefined) this.tape[headIndex] = head;
            throw error;
        } finally {
            this.allocated = null;
        }
    }

    _encode(value, key = 0) {
        const tape = this.tape;
        const headIndex = this.layout.freeHeadIndex;
        let id = headIndex === undefined ? 0 : tape[headIndex];
        if (id) {
            const next = this.field(id, 'next');
            this.allocated.push([id, next]);
            tape[headIndex] = next;
        } else id = ++tape[this.layout.countIndex];
        if (id > this.layout.capacity) throw new RangeError('JSON transport is full');
        const at = this.layout.base + id * this.layout.stride + this.layout.dataOffset;
        tape.fill(0, at, at + this.layout.fields.length);
        this.field(id, 'key', key);
        if (value === null || value === undefined) this.field(id, 'type', 1);
        else if (typeof value === 'boolean') {
            this.field(id, 'type', 2);
            this.field(id, 'value', Number(value));
        } else if (typeof value === 'number') {
            const absolute = Math.abs(value);
            this.field(id, 'type', 3);
            this.field(id, 'numberFlags', Number(Number.isFinite(value)) |
                (Number(value < 0) << 1) | (Number(Number.isInteger(value)) << 2) | 8);
            this.field(id, 'numberLo', Math.floor(absolute) >>> 0);
            this.field(id, 'numberHi', Math.min(0xffffffff,
                Math.floor(absolute / 0x100000000)));
            this.field(id, 'fraction', Number(!Number.isInteger(value)));
            const bits = new DataView(new ArrayBuffer(8));
            bits.setFloat64(0, value, true);
            this.field(id, 'value', bits.getUint32(0, true));
            this.field(id, 'floatHi', bits.getUint32(4, true));
        } else if (typeof value === 'string') {
            this.field(id, 'type', 4);
            this.field(id, 'value', this.intern(value));
        } else {
            this.field(id, 'type', Array.isArray(value) ? 6 : 5);
            let previous = 0;
            for (const [name, child] of Object.entries(value)) {
                const next = this._encode(child, Array.isArray(value) ? 0 : this.intern(name));
                if (previous) this.field(previous, 'next', next);
                else this.field(id, 'child', next);
                previous = next;
            }
        }
        return id;
    }

    sweep(roots) {
        const tape = this.tape;
        const { base, stride, dataOffset, countIndex, freeHeadIndex, fields } = this.layout;
        const childField = fields.indexOf('child');
        const nextField = fields.indexOf('next');
        const count = tape[countIndex];
        const live = new Uint8Array(count + 1);
        const pending = roots.slice();
        while (pending.length) {
            const id = pending.pop();
            if (!id || id > count || live[id]) continue;
            live[id] = 1;
            const at = base + id * stride + dataOffset;
            pending.push(tape[at + childField], tape[at + nextField]);
        }
        let head = 0;
        for (let id = count; id > 0; id--) {
            if (live[id]) continue;
            const at = base + id * stride + dataOffset;
            tape.fill(0, at, at + fields.length);
            tape[at + nextField] = head;
            head = id;
        }
        tape[freeHeadIndex] = head;
    }

    decode(id, active = new Set()) {
        if (!id) return null;
        if (active.has(id)) throw new TypeError('Cyclic JSON transport');
        const type = this.field(id, 'type');
        if (type === 1) return null;
        if (type === 2) return Boolean(this.field(id, 'value'));
        if (type === 3) {
            if (this.field(id, 'numberFlags') & 8) {
                const bits = new DataView(new ArrayBuffer(8));
                bits.setUint32(0, this.field(id, 'value'), true);
                bits.setUint32(4, this.field(id, 'floatHi'), true);
                return bits.getFloat64(0, true);
            }
            const raw = this.field(id, 'raw');
            if (raw) return Number(this.strings[raw]);
            const value = this.field(id, 'numberHi') * 0x100000000 +
                this.field(id, 'numberLo');
            return this.field(id, 'numberFlags') & 2 ? -value : value;
        }
        if (type === 4) return this.strings[this.field(id, 'value')];
        if (type !== 5 && type !== 6) throw new TypeError('Invalid JSON transport type');
        active.add(id);
        const result = type === 6 ? [] : Object.create(null);
        let child = this.field(id, 'child');
        const siblings = new Set();
        while (child) {
            if (siblings.has(child)) throw new TypeError('Cyclic JSON transport siblings');
            siblings.add(child);
            const value = this.decode(child, active);
            if (type === 6) result.push(value);
            else Object.defineProperty(result, this.strings[this.field(child, 'key')], {
                value,
                enumerable: true,
                configurable: true,
                writable: true
            });
            child = this.field(child, 'next');
        }
        active.delete(id);
        return result;
    }
}
