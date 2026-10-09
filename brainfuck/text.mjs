/** UTF32 construction macros; escaping and formatting execute on the Brainfuck tape. */
export function textBuffer(b, name, capacity = 30000) {
    const value = b.string(name, '', capacity);
    const digits = b.array(name + ':digits', 20);
    value.clear = () => b.set(value.length, 0);
    value.point = point => {
        b.arraySet(value.data, value.length, point);
        b.add(value.length, 1);
    };
    value.literal = text => {
        for (const char of Array.from(text)) value.point(char.codePointAt(0));
    };
    value.unsigned = number => b._temps(4, (remaining, quotient, remainder, count) => {
        b.copy(remaining, number);
        b.set(count, 0);
        b.set(quotient, 1);
        b.while(quotient, () => {
            b.divmod(quotient, remainder, remaining, 10);
            b.add(remainder, 48);
            b.arraySet(digits, count, remainder);
            b.add(count, 1);
            b.copy(remaining, quotient);
        });
        b.while(count, () => {
            b.sub(count, 1);
            b.arrayGet(digits, count, remainder);
            value.point(remainder);
        });
    });
    value.escapePoint = point => b._temps(2, (match, escaped) => {
        b.set(escaped, 0);
        for (const [code, text] of [[38, '&amp;'], [60, '&lt;'], [62, '&gt;'],
            [34, '&quot;'], [39, '&#39;']]) {
            b.eq(match, point, code);
            b.if(match, () => {
                value.literal(text);
                b.set(escaped, 1);
            });
        }
        b.if(escaped, () => {}, () => value.point(point));
    });
    value.handle = (handle, escape = false) => b._temps(3, (length, point, room) => {
        b.write(24);
        b.write(handle);
        b.read(length);
        b.repeat(length, () => {
            b.read(point);
            b.lt(room, value.length, capacity - 6);
            b.if(room, () => escape ? value.escapePoint(point) : value.point(
                point));
        });
    });
    value.read = handle => {
        value.clear();
        value.handle(handle);
    };
    value.copy = (other, escape = false) => b._temps(1, point => {
        b.repeat(other.length, index => {
            b.arrayGet(other.data, index, point);
            if (escape) value.escapePoint(point);
            else value.point(point);
        });
    });
    value.intern = out => {
        b.write(29);
        b.writeString(value);
        b.read(out);
    };
    value.emit = (opcode, target) => {
        b.write(opcode);
        b.writeString(target);
        b.writeString(value);
    };
    return value;
}
