import assert from 'node:assert/strict';
import { BrainfuckProgram } from '../brainfuck/compiler.mjs';
import { layouts, palettes, words, quotes } from '../brainfuck/content.mjs';
import { templates, keyboards, hands, cards, lessonButtons, events, listeners,
    emitTemplate, emitStatic, emitHandle } from '../brainfuck/view.mjs';
import { KEYBOARD_PRESETS, keyboardLayout } from '../js/keyboard.js';
import { CURRICULUM } from '../js/lessons.js';
import { generateLessonDrill } from '../js/practice.js';

assert.equal(words, CURRICULUM.speedWords);
assert.equal(quotes, CURRICULUM.quotes);
assert.deepEqual(layouts.map(layout => layout.id), Object.keys(KEYBOARD_PRESETS));

for (const [index, layout] of layouts.entries()) {
    const original = keyboardLayout(layout.id);
    assert.deepEqual(layout.charToCode, original.charToCode);
    const codes = Object.values(original.rows).flat().filter(key => key.code)
        .map(key => key.code);
    assert.deepEqual(Array.from(keyboards[index].matchAll(/data-code="([^"]+)"/g),
        match => match[1]), codes);
    assert.equal(new Set(Array.from(hands[index].matchAll(/id="(finger-[^"]+)"/g),
        match => match[1])).size, 11);
    assert.deepEqual(Array.from(cards[index].matchAll(/data-card-code="([^"]+)"/g),
        match => match[1]), codes);
    assert.match(cards[index], /width="1200" height="780"/);
    for (const [track, lessons] of Object.entries(layout.lessons)) {
        assert.equal(lessons.length, CURRICULUM[track].length);
        assert.equal(lessonButtons[index][track].length, lessons.length);
        for (const lesson of lessons) {
            assert.match(lessonButtons[index][track][lesson.index],
                new RegExp(`data-lesson="${lesson.id}"`));
            const lines = generateLessonDrill(track, lesson.index, () => 0.4, layout.id);
            assert(lines.flatMap(line => Array.from(line)).every(char =>
                lesson.allowed.includes(char)));
        }
    }
    for (const [char, target] of Object.entries(layout.guidance)) {
        assert.equal(target.code, original.charToCode[char]);
        assert.equal(target.finger, original.fingerMap[char].finger);
        assert.equal(target.reaches.length, original.fingerMap[char].finger === 'thumb' ?
            2 : original.fingerMap[char].shift ? 2 : 1);
        assert(target.reaches.every(reach => Number.isFinite(parseFloat(reach.angle)) &&
            Number.isFinite(parseFloat(reach.scale))));
    }
}

for (const themes of Object.values(palettes)) {
    for (const colors of Object.values(themes)) {
        for (const name of ['bg', 'surface', 'border', 'text', 'muted', 'accent', 'error']) {
            assert.match(colors[name], /^#[\da-f]{3,6}$/i);
        }
    }
}
assert.equal(new Set(Object.values(events)).size, Object.keys(events).length);
assert(listeners.every(listener => Object.values(events).includes(listener.event)));

const program = new BrainfuckProgram();
emitTemplate(program, 'custom', '#dialog');
emitStatic(program, ['Wrong view', 'Space → ␣'], program.scalar('selected', 1), '#chosen', 3);
const buffer = program.string('textBridge', '', 20);
emitHandle(program, 3, '#handle', 7, buffer);
const characters = Array.from('a😀 b', char => char.codePointAt(0));
const input = [characters.length, ...characters];
const output = [];
const instance = new WebAssembly.Instance(new WebAssembly.Module(program.compile()), {
    env: { read: () => input.shift() ?? 0, write: value => output.push(value >>> 0) }
});
instance.exports.run();
const readString = () => String.fromCodePoint(...output.splice(0, output.shift()));
assert.equal(output.shift(), 1);
assert.equal(readString(), '#dialog');
assert.equal(readString(), templates.custom);
assert.equal(output.shift(), 3);
assert.equal(readString(), '#chosen');
assert.equal(readString(), 'Space → ␣');
assert.equal(output.shift(), 24);
assert.equal(output.shift(), 7);
assert.equal(output.shift(), 3);
assert.equal(readString(), '#handle');
assert.equal(readString(), 'a😀 b');
assert.equal(output.length, 0);
console.log('Brainfuck view/content checks passed: four complete layouts, all lessons, ' +
    'guidance/card geometry, palettes and native BF UTF32 packets.');
