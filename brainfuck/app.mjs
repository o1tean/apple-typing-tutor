import { BrainfuckProgram } from './compiler.mjs';
import {
    createTokenArena,
    TYPE,
    uint64,
    fromPair64,
    toPair64,
    copy64,
    sub64,
    add64,
    mul64,
    div64,
    compare64
} from './runtime.mjs';
import { defineEngine } from './engine.mjs';
import { textBuffer } from './text.mjs';
import { defineStorage, DEFAULT_SETTINGS, DEFAULT_STATS, STORAGE_KEY } from './storage.mjs';
import { definePractice } from './practice.mjs';
import { createNumbers } from './numbers.mjs';
import { defineStats } from './stats.mjs';
import { defineHistory } from './history.mjs';
import { defineResults } from './results.mjs';
import { defineDemo } from './demo.mjs';
import { defineSound } from './sound.mjs';
import { content, layouts, tracks, settings as choices } from './content.mjs';
import {
    templates,
    events,
    messages,
    keyboards,
    hands,
    lessonButtons,
    testCounts,
    cards,
    speedChart,
    emitTemplate,
    emitText,
    emitAttribute,
    emitStatic,
    emitListeners
} from './view.mjs';

export function application() {
    const b = new BrainfuckProgram({ scalarCapacity: 131072, memoryPages: 2304 });
    const engine = defineEngine(b);
    const text = textBuffer(b, 'ui', 160000);
    const selector = textBuffer(b, 'selector', 1000);
    const inputText = textBuffer(b, 'input', 50000);
    const roots = b.array('transport:roots', 8192);
    const rootCount = b.scalar('transport:rootCount');
    const arena = createTokenArena(b, 1048576);
    const strings = [''];
    const ids = new Map([['', 0]]);
    const intern = value => {
        value = String(value);
        if (!ids.has(value)) {
            ids.set(value, strings.length);
            strings.push(value);
        }
        return ids.get(value);
    };
    const names = new Proxy({}, { get: (_target, key) => intern(key) });
    const gather = value => {
        if (typeof value === 'string') intern(value);
        else if (value && typeof value === 'object')
            for (const [key, child] of Object.entries(value)) {
                intern(key);
                gather(child);
            }
    };
    const defaults = {
        settings: DEFAULT_SETTINGS,
        stats: DEFAULT_STATS,
        progress: {},
        history: [],
        learning: { version: 1, keys: {}, bigrams: {} }
    };
    gather(content);
    gather(defaults);
    const s = Object.fromEntries(['event', 'payload', 'content', 'defaults', 'persistent',
        'dialog', 'layout', 'track', 'lesson', 'quote', 'demo', 'demoIndex', 'demoPlaying',
        'focused', 'result', 'date', 'settingKey', 'settingValue', 'settingRequest',
        'custom', 'pendingResult', 'elapsed', 'wpm', 'rawWpm', 'cpm', 'accuracy',
        'stars', 'recordEligible', 'lastSampleSecond', 'learningBefore', 'weakGroup',
        'caps', 'composition', 'tab', 'viewChanged', 'raw', 'present', 'readFailed',
        'backup', 'request', 'theme', 'palette', 'nextFocus', 'geometry', 'requests',
        'activeEntry', 'continueTrack', 'continueLesson', 'suggestedLesson', 'backdrop',
        'pngEntry', 'generation'
    ].map(name => [name, b.scalar('app:' + name)]));
    const field = (out, root, key) => arena.field(out, root, names[key]);
    const value = (out, root, key, member = 'value') => {
        field(out, root, key);
        arena.get(out, member, out);
    };
    const listItem = (out, root, index) => b._temps(2, (at, more) => {
        arena.get(out, 'child', root);
        b.copy(at, index);
        b.truth(more, at);
        b.while(more, () => {
            arena.get(out, 'next', out);
            b.sub(at, 1);
            b.truth(more, at);
        });
    });
    const equal = (left, right, body, otherwise) => b._temps(1, match => {
        b.eq(match, left, right);
        b.if(match, body, otherwise);
    });
    const property = (target, name, node) => {
        b.write(25);
        b.writeString(target);
        b.writeString(name);
        b.write(node);
    };
    const booleanProperty = (target, name, flag) => b._temps(1, node => {
        arena.boolean(node, flag);
        property(target, name, node);
    });
    const textHandle = (target, handle) => {
        text.read(handle);
        text.emit(3, target);
    };
    const handleProperty = (target, name, handle) => b._temps(1, node => {
        arena.string(node, handle);
        property(target, name, node);
    });
    const textField = (target, root, key) => b._temps(1, handle => {
        value(handle, root, key);
        textHandle(target, handle);
    });
    const integerText = (target, number) => {
        text.clear();
        text.unsigned(number);
        text.emit(3, target);
    };
    const classToggle = (target, name, flag) => {
        b.write(34);
        b.writeString(target);
        b.writeString(name);
        b.write(flag);
    };
    const removeAttribute = (target, name) => {
        b.write(35);
        b.writeString(target);
        b.writeString(name);
    };
    const style = (target, name, string) => {
        b.write(5);
        b.writeString(target);
        b.writeString(name);
        b.writeString(string);
    };
    const attrBuffer = (target, name, buffer) => {
        b.write(4);
        b.writeString(target);
        b.writeString(name);
        b.writeString(buffer);
    };
    const focus = target => {
        b.write(7);
        b.writeString(target);
    };
    const cancel = (stop = 0) => {
        b.write(26);
        b.write(s.event);
        b.write(stop);
    };
    const datePrimitive = (out, node, method) => {
        b.write(22);
        b.write(node);
        b.writeString(method);
        b.write(0);
        b.read(out);
    };
    const storageRead = () => {
        b.write(10);
        b.writeString(STORAGE_KEY);
        b.write(0);
        b.read(s.raw);
        b.read(s.present);
        b.read(s.readFailed);
        b.read(s.request);
    };
    let storage;
    let numbers;
    const constants = {
        keys: names,
        strings: names,
        stringValues: names,
        defaultsRoot: s.defaults,
        parseDate(node, valid) {
            b._temps(2, (parsed, flags) => {
                datePrimitive(parsed, node, 'parse');
                arena.get(flags, 'numberFlags', parsed);
                b.divmod(parsed, valid, flags, 2);
            });
        },
        progressKey(out, id, entry, preferences) {
            b._temps(2, (metric, handle) => {
                value(metric, entry, 'wpmMetric');
                arena.get(handle, 'value', id);
                text.clear();
                equal(metric, names['words-v1'], () => text.literal('words-v1:'));
                text.handle(handle);
                text.intern(handle);
                arena.string(out, handle);
            });
        },
        accuracyReason(out, target) {
            text.clear();
            text.literal('Aim for ');
            text.unsigned(target);
            text.literal('% accuracy before chasing a record.');
            b._temps(1, handle => {
                text.intern(handle);
                arena.string(out, handle);
            });
        },
        save(out) {
            b._temps(3, (raw, failed, allowed) => {
                storageRead();
                b.copy(allowed, storage.saveAllowed(s.request));
                b.if(s.readFailed, () => b.set(allowed, 0));
                b.if(s.present, () => b.if(s.raw, () => {}, () => b.set(allowed, 0)));
                b.set(failed, 1);
                b.if(allowed, () => {
                    b.write(11);
                    b.writeString(STORAGE_KEY);
                    b.write(storage.data);
                    b.write(0);
                    b.read(raw);
                    b.read(failed);
                    storage.saved(raw, failed);
                }, () => storage.saved(0, 1));
                b.not(raw, failed);
                arena.boolean(failed, raw);
                arena.setField(out, names.saved, failed);
            });
        }
    };
    // Numeric helpers are generated Brainfuck; the JSON bridge only carries representations.
    numbers = createNumbers(b, arena);
    constants.numbers = numbers;
    storage = defineStorage(b, arena, constants);
    const sound = defineSound(b, arena, { storage, keys: names, numbers });
    const practice = definePractice(b, arena, {
        keys: names,
        stringValues: names,
        contentRoot: s.content,
        numbers,
        readString(handle, buffer) {
            b.write(24);
            b.write(handle);
            b.readString(buffer);
        },
        internString(buffer, out) {
            b.write(29);
            b.writeString(buffer);
            b.read(out);
        }
    });
    const metadata = practice.metadata;
    const statistics = defineStats(b, engine, arena, names, numbers);
    const history = defineHistory(b, arena, {
        keys: names,
        stringValues: names,
        contentRoot: s.content,
        numbers
    });
    const results = defineResults(b, arena, {
        engine,
        state: s,
        practice,
        storage,
        numbers,
        keys: names,
        contentRoot: s.content,
        metadata,
        wpmHigh: statistics.fields.wpmHi
    });
    for (const name of ['render', 'download', 'focusPrimary'])
        results[name] = b.reusable('results:' + name, results[name]);
    for (const name of ['playKey', 'playError', 'playSuccess', 'sync'])
        sound[name] = b.reusable('sound:' + name, sound[name]);
    let demo;
    const setting = (out, key, member = 'value') => b._temps(1, preferences => {
        field(preferences, storage.data, 'settings');
        value(out, preferences, key, member);
    });
    const updateIdentity = b.reusable('brainfuck/app.mjs:updateIdentity', () => b._temps(3, (preset,
        layoutsNode, node) => {
        setting(preset, 'keyboardLayout');
        b.set(s.layout, 0);
        // Layout identity comes from the ordered build-time catalog, independent of labels.
        layouts.forEach((layout, index) => equal(preset, names[layout.id],
            () => b.set(s.layout, index)));
        setting(preset, 'typingMode');
        b.eq(engine.mode, preset, names.strict);
    }));
    const applyAppearance = b.reusable('brainfuck/app.mjs:applyAppearance', () => b._temps(3, (
        theme, palette, dark) => {
        setting(theme, 'theme');
        setting(palette, 'colorPalette');
        equal(theme, names.system, () => {
            b.write(16);
            b.writeString('(prefers-color-scheme: dark)');
            b.write(0);
            b.read(dark);
            b.if(dark, () => b.set(theme, names.dark), () => b.set(theme, names
                .light));
        });
        text.read(theme);
        attrBuffer('html', 'data-theme', text);
        text.read(palette);
        attrBuffer('html', 'data-palette', text);
    }));
    const saveStatus = b.reusable('brainfuck/app.mjs:saveStatus', () => b._temps(2, (bad,
        pending) => {
        b.copy(bad, storage.saveFailed);
        b.add(bad, storage.loadFailed);
        b.add(bad, storage.lockFailed);
        b.add(bad, storage.saveConflict);
        arena.get(pending, 'child', storage.pending);
        b.add(bad, pending);
        b.if(bad, () => emitText(b, '#bf-save-state', 'progress is in memory'),
            () => emitText(b, '#bf-save-state', 'saved on this device'));
        b.not(bad, bad);
        booleanProperty('#bf-recovery-button', 'hidden', bad);
    }));
    const guides = b.reusable('brainfuck/app.mjs:guides', () => b._temps(5, (layoutNode, guidances,
        point, handle, guide) => {
        field(layoutNode, s.content, 'layouts');
        listItem(layoutNode, layoutNode, s.layout);
        field(guidances, layoutNode, 'guidance');
        classToggle('.key-target', 'key-target', 0);
        classToggle('.key-shift-target', 'key-shift-target', 0);
        classToggle('.finger-pill.active', 'active', 0);
        classToggle('.finger-pill.shift-active', 'shift-active', 0);
        for (const finger of content.fingers) classToggle('.magic-key', 'finger-' +
            finger, 0);
        removeAttribute('.finger-pill', 'data-target-key');
        removeAttribute('.finger-pill', 'data-reach-row');
        style('.finger-pill', '--reach-angle', '0deg');
        style('.finger-pill', '--reach-scale', '1');
        for (const layout of layouts) equal(s.layout, layouts.indexOf(layout), () => {
            const home = [...Array.from(layout.homeKeys.toUpperCase())];
            for (const [hand, chars] of [['left', home.slice(0, 4)],
                ['right', home.slice(4).reverse()]]) {
                [...chars, '␣'].forEach((char, index) => emitText(b,
                    `#finger-${hand}-${content.fingers[index]} .finger-tag`,
                    char));
            }
        });
        b.if(s.demo, () => {
            field(point, layoutNode, 'demoSteps');
            listItem(point, point, s.demoIndex);
            arena.get(handle, 'value', point);
        }, () => {
            engine.getCurrentChar(point);
            text.clear();
            text.point(point);
            text.intern(handle);
        });
        arena.field(guide, guidances, handle);
        b.if(guide, () => {
            value(handle, guide, 'code');
            selector.clear();
            selector.literal('[data-code="');
            selector.handle(handle, true);
            selector.literal('"]');
            b.write(34);
            b.writeString(selector);
            b.writeString('key-target');
            b.write(1);
            value(handle, guide, 'finger');
            text.clear();
            text.literal('finger-');
            text.handle(handle);
            b.write(34);
            b.writeString(selector);
            b.writeString(text);
            b.write(1);
            value(handle, guide, 'shiftCode');
            b.if(handle, () => {
                selector.clear();
                selector.literal('[data-code="');
                selector.handle(handle, true);
                selector.literal('"]');
                b.write(34);
                b.writeString(selector);
                b.writeString('key-shift-target');
                b.write(1);
            });
            textField('#finger-hint-text', guide, 'hint');
            field(point, guide, 'reaches');
            arena.each(point, reach => b._temps(2, (valueNode, actual) => {
                selector.clear();
                selector.literal('#finger-');
                value(actual, reach, 'hand');
                selector.handle(actual);
                selector.literal('-');
                value(actual, reach, 'finger');
                selector.handle(actual);
                b.write(34);
                b.writeString(selector);
                value(actual, reach, 'shift');
                b.if(actual,
                    () => b.writeString('shift-active'), () => b
                    .writeString('active'));
                b.write(1);
                for (const [attribute, key] of [['data-reach-row',
                            'row'],
                    ['data-target-key', 'target']]) {
                    value(actual, reach, key);
                    text.read(actual);
                    b.write(4);
                    b.writeString(selector);
                    b.writeString(attribute);
                    b.writeString(text);
                }
                for (const [propertyName, key] of [['--reach-angle',
                            'angle'],
                    ['--reach-scale', 'scale']]) {
                    value(actual, reach, key);
                    text.read(actual);
                    b.write(5);
                    b.writeString(selector);
                    b.writeString(propertyName);
                    b.writeString(text);
                }
                selector.literal(' .finger-tag');
                value(actual, reach, 'tag');
                text.read(actual);
                b.write(3);
                b.writeString(selector);
                b.writeString(text);
            }));
        }, () => textField('#finger-hint-text', layoutNode, 'restHint'));
    }));
    const typedView = b.reusable('brainfuck/app.mjs:typedView', () => b._temps(5, (char, status,
        extra, skipped, next) => {
        emitText(b, '#bf-text', '');
        text.clear();
        text.literal('<span class="word">');
        b.repeat(engine.length, index => {
            b.arrayGet(engine.chars, index, char, 0);
            b.arrayGet(engine.chars, index, status, 1);
            b.arrayGet(engine.chars, index, extra, 3);
            b.arrayGet(engine.chars, index, skipped, 4);
            text.literal('<span class="char');
            equal(status, 1, () => text.literal(' correct'));
            equal(status, 2, () => text.literal(' incorrect'));
            b.if(extra, () => text.literal(' extra'));
            b.if(skipped, () => text.literal(' skipped'));
            text.literal('" data-index="');
            text.unsigned(index);
            text.literal('">');
            equal(char, 32, () => text.literal('&nbsp;'), () => text
                .escapePoint(char));
            text.literal('</span>');
            equal(char, 32, () => text.literal('</span><span class="word">'));
            b.lt(next, 140000, text.length);
            b.if(next, () => {
                text.literal('</span>');
                text.emit(2, '#bf-text');
                text.clear();
                text.literal('<span class="word">');
            });
        });
        text.literal('</span><span class="char" data-index="');
        text.unsigned(engine.length);
        text.literal('"></span><span class="caret" id="bf-caret"></span>');
        text.emit(2, '#bf-text');
        text.clear();
        text.literal('Type this text: ');
        b.repeat(engine.length, index => {
            b.arrayGet(engine.chars, index, extra, 3);
            b.if(extra, () => {}, () => {
                b.arrayGet(engine.chars, index, char, 0);
                text.point(char);
            });
        });
        text.emit(3, '#exercise-prompt');
        text.clear();
        text.literal('line ');
        b.copy(next, engine.line);
        b.add(next, 1);
        text.unsigned(next);
        text.literal(' / ');
        text.unsigned(engine.lineCount);
        text.emit(3, '#bf-position');
        guides();
        reposition();
    }));
    const reposition = b.reusable('brainfuck/app.mjs:reposition', () => b._temps(8, (target, parent,
        lineHeight, top, left, height, node, handle) => {
        selector.clear();
        selector.literal('#bf-text [data-index="');
        selector.unsigned(engine.index);
        selector.literal('"]');
        b.write(9);
        b.writeString(selector);
        b.write(0);
        b.read(target);
        b.if(target, () => {
            b.write(9);
            b.writeString('#bf-text');
            b.write(0);
            b.read(parent);
            b.write(40);
            b.writeString('#bf-text');
            b.writeString('lineHeight');
            b.read(lineHeight);
            field(top, target, 'top');
            field(node, parent, 'top');
            numbers.subtractNumbers(top, top, node);
            field(left, target, 'left');
            field(node, parent, 'left');
            numbers.subtractNumbers(left, left, node);
            numbers.constant(node, 0.65);
            numbers.multiplyNumbers(height, lineHeight, node);
            field(node, target, 'height');
            numbers.subtractNumbers(node, node, height);
            arena.number(handle, 2);
            numbers.divideNumber(node, node, handle);
            numbers.addNumbers(top, top, node);
            for (const [name, value] of [['left', left], ['top', top], [
                    'height', height]]) {
                text.clear();
                numbers.format(text, value, 2, true);
                text.literal('px');
                b.write(5);
                b.writeString('#bf-caret');
                b.writeString(name);
                b.writeString(text);
            }
            field(top, target, 'top');
            field(node, parent, 'top');
            numbers.subtractNumbers(top, top, node);
            numbers.subtractNumbers(top, top, lineHeight);
            arena.number(node, 0);
            numbers.maxNumber(top, top, node);
            property('#bf-arena .text-viewport', 'scrollTop', top);
        });
    }));
    const liveView = b.reusable('brainfuck/app.mjs:liveView', () => {
        integerText('#bf-wpm', engine.wpm);
        b._temps(2, (whole, fraction) => {
            b.divmod(whole, fraction, engine.accuracy, 10);
            text.clear();
            text.unsigned(whole);
            b.if(fraction, () => {
                text.literal('.');
                text.unsigned(fraction);
            });
            text.emit(3, '#bf-accuracy');
            b.if(engine.duration, () => b.copy(whole, engine.remaining),
                () => b.copy(whole, engine.elapsed));
            b.divmod(whole, fraction, whole, 1000000);
            b.if(engine.duration, () => b.if(fraction, () => b.add(whole, 1)));
            integerText('#bf-time', whole);
        });
    });
    const load = b.reusable('brainfuck/app.mjs:load', () => {
        demo.exit();
        b.set(s.demo, 0);
        b.set(s.result, 0);
        b.set(s.activeEntry, 0);
        b.add(s.generation, 1);
        b.set(s.recordEligible, 1);
        updateIdentity();
        b._temps(2, (preferences, layout) => {
            field(preferences, storage.data, 'settings');
            field(layout, preferences, 'keyboardLayout');
            arena.clone(layout, layout);
            arena.setField(metadata, names.keyboardLayout, layout);
        });
        b._temps(1, duration => {
            value(duration, metadata, 'duration', 'numberLo');
            engine.load(practice.text.data, practice.lines, practice.lineCount,
                duration);
        });
        b.copy(s.persistent, arena.count);
        emitTemplate(b, 'test', '#bf-body');
        emitTemplate(b, 'arena', '#bf-session');
        textField('#bf-heading', metadata, 'title');
        b._temps(2, (title, handle) => {
            value(handle, metadata, 'title');
            text.read(handle);
            b.write(4);
            b.writeString('#bf-test');
            b.writeString('aria-label');
            b.writeString(text);
            value(title, metadata, 'track');
            b.eq(title, title, names.lesson);
            classToggle('#bf-app', 'lesson-mode', title);
        });
        b._temps(2, (track, title) => {
            value(track, metadata, 'track');
            equal(track, names.lesson, () => {
                emitTemplate(b, 'lessonToolbar', '#bf-toolbar');
                emitTemplate(b, 'lessonInstructions', '#bf-instructions');
                textField('#bf-lesson-description', metadata,
                    'description');
                field(title, metadata, 'keysIntroduced');
                text.clear();
                arena.each(title, node => {
                    arena.get(title, 'value', node);
                    text.handle(title);
                    text.literal(' ');
                });
                text.emit(3, '#bf-practice-keys');
                text.clear();
                value(title, metadata, 'targetWpm', 'numberLo');
                text.unsigned(title);
                text.literal(' WPM · ');
                value(title, metadata, 'targetAccuracy', 'numberLo');
                text.unsigned(title);
                text.literal('% accuracy');
                text.emit(3, '#bf-lesson-goal');
            }, () => equal(track, names.test, () => {
                emitTemplate(b, 'testToolbar', '#bf-toolbar');
                setting(title, 'testMode');
                equal(title, names.time, () => emitText(b,
                        '#bf-test-counts', ''),
                    () => emitText(b, '#bf-test-counts', ''));
                equal(title, names.time, () => {
                    b.write(1);
                    b.writeString('#bf-test-counts');
                    b.writeString(testCounts.time);
                }, () => {
                    b.write(1);
                    b.writeString('#bf-test-counts');
                    b.writeString(testCounts.words);
                });
                setting(title, 'testMode');
                equal(title, names.time,
                    () => emitAttribute(b, '#bf-test-counts',
                        'aria-label', 'Test duration'),
                    () => emitAttribute(b, '#bf-test-counts',
                        'aria-label', 'Word count'));
                preferenceChoices();
            }, () => {
                equal(track, names.custom, () => emitTemplate(b,
                        'customToolbar', '#bf-toolbar'),
                    () => emitTemplate(b, 'exerciseToolbar',
                        '#bf-toolbar'));
                textField('#bf-exercise-title', metadata, 'title');
                equal(track, names.weak, () => {
                    classToggle('#bf-app', 'lesson-mode', 1);
                    emitTemplate(b, 'adaptiveInstructions',
                        '#bf-instructions');
                    text.clear();
                    field(title, metadata, 'focusKeys');
                    arena.each(title, key => {
                        arena.get(title, 'value', key);
                        text.literal('<li>');
                        text.handle(title, true);
                        text.literal('</li>');
                    });
                    text.emit(1, '#bf-focus-chips');
                });
            }));
            equal(track, names.quote, () => {
                booleanProperty('#bf-quote-source', 'hidden', 0);
                text.clear();
                text.literal('By ');
                value(title, metadata, 'author');
                text.handle(title, true);
                text.literal(' · <a href="');
                value(title, metadata, 'source');
                text.handle(title, true);
                text.literal(
                    '" target="_blank" rel="noopener noreferrer">Read source</a>'
                );
                text.emit(1, '#bf-quote-source');
            });
        });
        emitStatic(b, keyboards, s.layout, '#bf-keyboard');
        emitStatic(b, hands, s.layout, '#bf-hands');
        b._temps(1, visible => {
            setting(visible, 'showHands');
            b.not(visible, visible);
            booleanProperty('#bf-hands', 'hidden', visible);
            setting(visible, 'showKeyboard');
            b.not(visible, visible);
            booleanProperty('#bf-keyboard', 'hidden', visible);
        });
        typedView();
        liveView();
        b.if(engine.duration, () => emitText(b, '#bf-time-label', 'Time remaining: '),
            () => emitText(b, '#bf-time-label', 'Elapsed time: '));
        b.if(engine.mode, () => emitText(b, '#bf-mode-label', 'guided'),
            () => emitText(b, '#bf-mode-label', 'free flow'));
        b.if(engine.mode, () => emitText(b, '#typing-help', messages.guidedHelp),
            () => emitText(b, '#typing-help', messages.flowHelp));
        b._temps(1, track => {
            value(track, metadata, 'track');
            b.eq(track, track, names.test);
            b.if(track, learningPrompt, () => emitText(b, '#bf-learning', ''));
            b.not(track, track);
            booleanProperty('#bf-learning', 'hidden', track);
        });
        booleanProperty('#bf-guidance', 'hidden', 0);
        focus('#bf-input');
    });
    const newTest = b.reusable('brainfuck/app.mjs:newTest', () => b._temps(1, preferences => {
        field(preferences, storage.data, 'settings');
        practice.test(preferences, s.layout);
        load();
    }));
    const lesson = b.reusable('brainfuck/app.mjs:lesson', () => {
        practice.lesson(s.layout, s.track,
            s.lesson);
        load();
    });
    const close = b.reusable('brainfuck/app.mjs:close', () => {
        b.write(8);
        b.writeString('#bf-modal');
        b.write(0);
        emitText(b, '#bf-dialog', '');
        b.set(s.dialog, 0);
        b.if(s.result, results.focusPrimary, () => b.if(s.demo, () => {}, () => {
            engine.resume(engine.now);
            focus('#bf-input');
        }));
        demo.dialogChanged();
    });
    const queueSetting = (key, node) => b._temps(3, (request, copy, fieldNode) => {
        arena.object(request);
        arena.number(fieldNode, key);
        arena.setField(request, names.settingKey, fieldNode);
        arena.clone(copy, node);
        arena.setField(request, names.settingValue, copy);
        arena.set('key', request, request);
        arena.append(s.requests, request);
        b.copy(s.persistent, arena.count);
        b.write(12);
        b.writeString(STORAGE_KEY);
        b.write(request);
    });
    const updatePreferences = b.reusable('brainfuck/app.mjs:updatePreferences', () => b._temps(2, (
        flag, node) => {
        updateIdentity();
        applyAppearance();
        saveStatus();
        sound.sync();
        setting(flag, 'showHands');
        b.not(flag, flag);
        booleanProperty('#bf-hands', 'hidden', flag);
        setting(flag, 'showKeyboard');
        b.not(flag, flag);
        booleanProperty('#bf-keyboard', 'hidden', flag);
        setting(flag, 'soundMuted');
        b.if(flag, () => emitText(b, '#bf-sound-state', 'off'),
            () => emitText(b, '#bf-sound-state', 'on'));
    }));
    const preferenceChoices = b.reusable('brainfuck/app.mjs:preferenceChoices', () => b._temps(3, (
        preferences, valueNode, flag) => {
        field(preferences, storage.data, 'settings');
        for (const [key, options] of Object.entries({
                ...choices,
                punctuation: [false,
                    true],
                numbers: [false, true]
            })) {
            value(valueNode, preferences, key, typeof options[0] === 'number' ?
                'numberLo' : 'value');
            for (const option of options) {
                const wanted = typeof option === 'number' ? option : typeof option ===
                    'boolean' ? Number(option) : names[option];
                b.eq(flag, valueNode, wanted);
                selector.clear();
                selector.literal('[data-name="' + key + '"]');
                if (typeof option !== 'boolean') selector.literal('[data-value="' +
                    option + '"]');
                else if (!option) continue;
                b.write(4);
                b.writeString(selector);
                b.writeString('aria-pressed');
                b.if(flag, () => b.writeString('true'), () => b.writeString('false'));
                b.write(34);
                b.writeString(selector);
                b.writeString('selected');
                b.write(flag);
            }
        }
    }));
    const chooser = b.reusable('brainfuck/app.mjs:chooser', () => b._temps(4, (progress, path, node,
        handle) => {
        emitTemplate(b, 'lessons', '#bf-dialog-body');
        field(progress, storage.data, 'progress');
        practice.path(progress, s.layout, s.track);
        b.copy(path, practice.pathResult);
        value(node, path, 'completed', 'numberLo');
        text.clear();
        text.unsigned(node);
        text.literal(' of ');
        value(node, path, 'total', 'numberLo');
        text.unsigned(node);
        text.literal(' completed · ');
        value(node, path, 'threeStar', 'numberLo');
        text.unsigned(node);
        text.literal(' of ');
        value(node, path, 'total', 'numberLo');
        text.unsigned(node);
        text.literal(' with 3 stars');
        text.emit(3, '#bf-track-progress');
        field(node, path, 'next');
        textField('#bf-suggested-title', node, 'title');
        textField('#bf-suggested-reason', path, 'reason');
        for (const [layoutIndex, layout] of layouts.entries()) equal(s.layout,
            layoutIndex, () => {
                for (const [trackIndex, track] of tracks.entries()) equal(s.track,
                    trackIndex, () => {
                        b.write(1);
                        b.writeString('#bf-lesson-list');
                        b.writeString(lessonButtons[layoutIndex][track.id].join(
                            ''));
                    });
            });
        field(node, path, 'steps');
        arena.each(node, step => b._temps(3, (id, stars, flag) => {
            value(id, step, 'id');
            value(stars, step, 'stars', 'numberLo');
            selector.clear();
            selector.literal('[data-lesson="');
            selector.handle(id, true);
            selector.literal('"] .lesson-stars');
            text.clear();
            text.literal('Earned stars: ');
            text.unsigned(stars);
            text.literal(' of 3');
            b.write(4);
            b.writeString(selector);
            b.writeString('aria-label');
            b.writeString(text);
            text.clear();
            for (let i = 0; i < 3; i++) {
                b.lt(flag, i, stars);
                b.if(flag, () => text.literal('★'), () => text.literal(
                    '☆'));
            }
            b.write(3);
            b.writeString(selector);
            b.writeString(text);
        }));
        for (const [index, track] of tracks.entries()) b._temps(1, selected => {
            b.eq(selected, s.track, index);
            selector.clear();
            selector.literal('[data-event="track"][data-value="' + track.id +
                '"]');
            b.write(4);
            b.writeString(selector);
            b.writeString('aria-pressed');
            b.if(selected, () => b.writeString('true'), () => b.writeString(
                'false'));
            b.write(34);
            b.writeString(selector);
            b.writeString('selected');
            b.write(selected);
        });
    }));
    const settingsView = b.reusable('brainfuck/app.mjs:settingsView', () => {
        emitTemplate(b, 'settings', '#bf-dialog-body');
        b._temps(3, (preferences, node, flag) => {
            field(preferences, storage.data, 'settings');
            for (const [key, options] of Object.entries(choices)) {
                value(node, preferences, key, typeof options[0] === 'number' ?
                    'numberLo' : 'value');
                for (const option of options) {
                    b.eq(flag, node, typeof option === 'number' ? option : names[
                        option]);
                    selector.clear();
                    selector.literal('[data-name="' + key + '"][data-value="');
                    selector.literal(String(option));
                    selector.literal('"]');
                    b.write(4);
                    b.writeString(selector);
                    b.writeString('aria-pressed');
                    b.if(flag, () => b.writeString('true'), () => b.writeString(
                        'false'));
                }
            }
            field(node, preferences, 'keyboardLayout');
            property('#bf-layout', 'value', node);
            for (const [key, target] of [['showHands', '#bf-show-hands'],
                ['showKeyboard', '#bf-show-keyboard'], ['soundMuted', '#bf-enable-sound']]) {
                value(flag, preferences, key);
                if (key === 'soundMuted') b.not(flag, flag);
                booleanProperty(target, 'checked', flag);
            }
            field(node, preferences, 'volume');
            numbers.scaled(flag, node, 100);
            text.clear();
            text.unsigned(flag);
            text.literal('%');
            text.emit(3, '#bf-volume-label');
            arena.number(node, flag);
            property('#volume', 'value', node);
            equal(s.layout, 3, () => emitText(b, '#layout-help', messages.layoutHelp
                    .iso),
                () => emitText(b, '#layout-help', messages.layoutHelp.ansi));
        });
        preferenceChoices();
    });
    const backup = b.reusable('brainfuck/app.mjs:backup', () => b._temps(3, (date, raw, handle) => {
        datePrimitive(date, s.date, 'iso');
        storageRead();
        storage.exportBackup(s.backup, date, s.request, s.readFailed);
        b.write(30);
        b.write(s.backup);
        b.write(0);
        b.read(handle);
        handleProperty('#backup-text', 'value', handle);
        b.copy(s.backup, handle);
    }));
    const recovery = b.reusable('brainfuck/app.mjs:recovery', () => {
        emitTemplate(b, 'recovery', '#bf-dialog-body');
        b._temps(2, (hidden, pending) => {
            b.not(hidden, storage.saveFailed);
            booleanProperty('#bf-retry-save', 'hidden', hidden);
            arena.get(pending, 'child', storage.pending);
            b.truth(pending, pending);
            booleanProperty('#bf-retry-save', 'disabled', pending);
            b.if(pending, () => emitText(b, '#bf-retry-save', 'Waiting to save…'));
        });
        b.if(storage.saveConflict, () => emitText(b, '#bf-recovery-advice', messages
                .recovery.conflict),
            () => b.if(storage.saveFailed, () => emitText(b, '#bf-recovery-advice',
                    messages.recovery.failed),
                () => emitText(b, '#bf-recovery-advice', messages.recovery.saved)));
        backup();
    });
    const observationText = (cell, recent = false) => b._temps(4,
        (errors, attempts, latency, rate) => {
            field(attempts, cell, 'attempts');
            value(rate, cell, 'attempts', 'numberLo');
            b.if(rate, () => {
                if (recent) {
                    field(errors, cell, 'recentErrorRate');
                    numbers.scaled(rate, errors, 1000);
                } else {
                    field(errors, cell, 'errors');
                    numbers.ratio(rate, errors, attempts, 1000);
                }
                b.divmod(errors, attempts, rate, 10);
                text.unsigned(errors);
                text.literal('.');
                text.unsigned(attempts);
                text.literal(recent ? '% recent errors, ' : '% errors, ');
                value(rate, cell, 'latencySamples', 'numberLo');
                b.if(rate, () => {
                    if (recent) {
                        field(latency, cell, 'recentLatencyMs');
                        numbers.scaled(rate, latency, 1);
                    } else {
                        field(latency, cell, 'latencyTotalMs');
                        field(attempts, cell, 'latencySamples');
                        numbers.ratio(rate, latency, attempts, 1);
                    }
                    text.unsigned(rate);
                    text.literal(recent ? ' ms recent reach' : ' ms reach');
                }, () => text.literal('no reach timing yet'));
            }, () => text.literal('No observations yet.'));
        });
    const learningPrompt = b.reusable('brainfuck/app.mjs:learningPrompt', () => b._temps(5, (
        profile, history, progress, node, handle) => {
        emitTemplate(b, 'learningPrompt', '#bf-learning');
        field(profile, storage.data, 'learning');
        field(history, storage.data, 'history');
        field(progress, storage.data, 'progress');
        practice.latest(history, progress);
        b.if(practice.latestResult, () => {
            booleanProperty('#bf-learning-return', 'hidden', 0);
            value(s.continueTrack, practice.latestResult, 'track');
            value(s.continueLesson, practice.latestResult, 'index', 'numberLo');
            field(node, s.content, 'layouts');
            listItem(node, node, s.layout);
            field(node, node, 'lessons');
            arena.field(node, node, s.continueTrack);
            listItem(node, node, s.continueLesson);
            textField('#bf-latest-lesson', node, 'title');
        });
        for (const [groupIndex, group] of ['keys', 'bigrams'].entries()) {
            practice.focusKeys(profile, groupIndex ? 1 : 3, groupIndex);
            text.clear();
            b.if(practice.focusCount, () => {
                b.arrayGet(practice.focus, 0, handle);
                field(node, profile, group);
                arena.field(node, node, handle);
                text.literal('<p><strong>');
                practice.focusLabel(handle, progress);
                text.handle(progress, true);
                text.literal('</strong> · ');
                observationText(node, true);
                text.literal('</p><p>');
                text.literal(messages.recommendation);
                text.literal('</p>');
                booleanProperty('#bf-practice-' + group, 'hidden', 0);
                if (groupIndex) {
                    selector.clear();
                    selector.literal('Practice this pair: ');
                    selector.handle(progress);
                    selector.emit(3, '#bf-practice-bigrams');
                }
            }, () => text.literal(
                'Not enough observations yet. Finish a lesson to get a recommendation.'
            ));
            text.emit(1, '#bf-recommendation-' + group);
        }
    }));
    const resultView = b.reusable('brainfuck/app.mjs:resultView', () => {
        booleanProperty('#bf-learning', 'hidden', 1);
        booleanProperty('#bf-guidance', 'hidden', 1);
        results.render();
        saveStatus();
    });
    engine.hooks.tick = b.reusable('engine:hook:tick', () => {
        statistics.tick();
        results.recordSpeedSample(false);
        liveView();
    });
    engine.hooks.error = (expected, typed) => b._temps(5, (start, end, char, handle, found) => {
        sound.playError();
        b.copy(start, engine.index);
        b.lt(found, start, engine.length);
        b.if(found, () => b.arrayGet(engine.chars, start, char), () => b.set(char, 32));
        equal(char, 32, () => b.if(start, () => b.sub(start, 1)));
        b.truth(found, start);
        b.while(found, () => {
            b.copy(end, start);
            b.sub(end, 1);
            b.arrayGet(engine.chars, end, char);
            equal(char, 32, () => b.set(found, 0), () => {
                b.sub(start, 1);
                b.truth(found, start);
            });
        });
        text.clear();
        b.copy(end, start);
        b.lt(found, end, engine.length);
        b.while(found, () => {
            b.arrayGet(engine.chars, end, char);
            equal(char, 32, () => b.set(found, 0), () => {
                b.arrayGet(engine.chars, end, char, 3);
                b.if(char, () => {}, () => {
                    b.arrayGet(engine.chars, end, char);
                    text.point(char);
                });
                b.add(end, 1);
                b.lt(found, end, engine.length);
            });
        });
        b.if(text.length, () => {
            text.intern(handle);
            b.set(found, 0);
            b.repeat(engine.missedCount, index => {
                b.arrayGet(engine.missed, index, char);
                equal(char, handle, () => b.set(found, 1));
            });
            b.if(found, () => {}, () => {
                b.arraySet(engine.missed, engine.missedCount, handle);
                b.add(engine.missedCount, 1);
            });
        });
        text.clear();
        text.literal('Expected “');
        text.point(expected);
        text.literal('”; typed “');
        text.point(typed);
        text.literal('”. ');
        b.if(engine.mode, () => text.literal('Try again.'), () => text.literal(
            'Backspace to correct it.'));
        text.emit(3, '#typing-feedback');
    });
    engine.hooks.finish = b.reusable('engine:hook:finish', () => b._temps(6, (id, target, accuracy,
        options, preferences, date) => {
        sound.playSuccess();
        statistics.snapshot(s.result);
        results.recordSpeedSample(true);
        field(id, metadata, 'id');
        field(target, metadata, 'targetWpm');
        b.if(target, () => {}, () => arena.number(target, 45));
        field(accuracy, metadata, 'targetAccuracy');
        b.if(accuracy, () => {}, () => arena.number(accuracy, 95));
        field(options, metadata, 'options');
        b.if(options, () => arena.clone(options, options),
            () => arena.object(options));
        field(preferences, storage.data, 'settings');
        field(preferences, preferences, 'typingMode');
        arena.clone(date, preferences);
        arena.setField(options, names.typingMode, date);
        value(date, metadata, 'track');
        equal(date, names.custom, () => {
            arena.boolean(date, 0);
            arena.setField(options, names.recordEligible, date);
        });
        equal(date, names.retry, () => {
            arena.boolean(date, 0);
            arena.setField(options, names.recordEligible, date);
        });
        datePrimitive(date, s.date, 'iso');
        storage.recordLesson(id, s.result, target, accuracy, options, s.date, date, s
            .pendingResult);
        b.copy(s.activeEntry, storage.lastPrepared);
        arena.merge(s.result, s.pendingResult);
        arena.boolean(id, 1);
        arena.setField(s.result, names.saving, id);
        b.copy(s.persistent, arena.count);
        resultView();
    }));
    const open = name => {
        engine.pause(engine.now);
        emitTemplate(b, 'dialog', '#bf-dialog');
        emitText(b, '#dialog-title', messages.dialogTitles[name]);
        b.set(s.dialog, names[name]);
        if (name === 'settings') settingsView();
        if (name === 'lessons') chooser();
        if (name === 'custom') emitTemplate(b, 'custom', '#bf-dialog-body');
        if (name === 'recovery') recovery();
        if (name === 'history') b._temps(1, records => {
            field(records, storage.data, 'history');
            history.renderHistory(records, s.date, storage.saveFailed);
        });
        b.write(8);
        b.writeString('#bf-modal');
        b.write(1);
        demo.dialogChanged();
    };
    demo = defineDemo(b, arena, {
        engine,
        state: s,
        keys: names,
        strings: names,
        contentRoot: s.content,
        metadata,
        guides,
        loadLesson() {
            b.set(s.track, 0);
            b.set(s.lesson, 1);
            lesson();
        }
    });
    b.read(s.event);
    b.read(s.payload);
    value(engine.now, s.payload, 'now', 'numberLo');
    field(s.date, s.payload, 'date');
    value(engine.nowHi, s.payload, 'now', 'numberHi');
    const handle = (event, body) => equal(s.event, events[event] ?? event, body);
    handle(0, () => b._temps(3, (roots, raw, flag) => {
        field(roots, s.payload, 'roots');
        listItem(s.content, roots, 0);
        listItem(s.defaults, roots, 1);
        arena.get(s.content, 'numberLo', s.content);
        arena.get(s.defaults, 'numberLo', s.defaults);
        storage.initialize();
        arena.object(s.requests);
        storageRead();
        storage.load(s.raw, s.present, s.readFailed, s.request);
        b.if(s.present, () => b.if(s.raw, () => {}, () => b.set(storage.loadFailed,
            1)));
        emitTemplate(b, 'shell');
        emitListeners(b);
        applyAppearance();
        updateIdentity();
        b.write(36);
        b.writeString('(prefers-color-scheme: dark)');
        b.write(93);
        b.write(21);
        b.writeString('./sw.js');
        b.writeString('./');
        b.write(0);
        b.if(s.present, newTest, () => b.if(s.readFailed, newTest, () => {
            b.set(s.track, 0);
            b.set(s.lesson, 1);
            lesson();
        }));
        updatePreferences();
        demo.initialize(s.present, storage.loadFailed);
    }));
    handle('test', newTest);
    handle('lessons', () => open('lessons'));
    handle('settings', () => open('settings'));
    handle('custom', () => open('custom'));
    handle('recovery', () => open('recovery'));
    handle('history', () => open('history'));
    handle('demo', demo.show);
    handle('demoToggle', demo.toggle);
    handle('demoNext', demo.next);
    handle('demoPractice', demo.practice);
    handle('close', close);
    handle('track', () => b._temps(1, node => {
        field(node, s.payload, 'dataset');
        value(node, node, 'value');
        equal(node, names.pro, () => b.set(s.track, 1), () => b.set(s.track, 0));
        chooser();
    }));
    handle('lesson', () => b._temps(2, (dataset, node) => {
        field(dataset, s.payload, 'dataset');
        value(node, dataset, 'track');
        equal(node, names.pro, () => b.set(s.track, 1), () => b.set(s.track, 0));
        value(node, dataset, 'value');
        inputText.read(node);
        b.set(s.lesson, 0);
        b.repeat(inputText.length, index => {
            b.arrayGet(inputText.data, index, node);
            b.sub(node, 48);
            b.mul(s.lesson, s.lesson, 10);
            b.add(s.lesson, node);
        });
        close();
        lesson();
    }));
    handle('nextLesson', () => {
        b.add(s.lesson, 1);
        lesson();
    });
    handle('quote', () => {
        practice.quote(s.quote);
        b.add(s.quote, 1);
        load();
    });
    handle('customStart', () => b._temps(1, node => {
        cancel();
        value(node, s.payload, 'value');
        b.write(27);
        b.writeString('#custom-text');
        b.writeString('value');
        b.write(0);
        b.read(node);
        arena.get(s.custom, 'value', node);
        practice.custom(s.custom);
        b.if(practice.text.length, () => {
            close();
            load();
        });
    }));
    handle('customInput', () => b._temps(1, node => {
        value(node, s.payload, 'value');
        inputText.read(node);
        b.not(node, inputText.length);
        booleanProperty('#bf-custom-start', 'disabled', node);
    }));
    handle('customQuote', () => b._temps(2, (node, handle) => {
        field(node, s.content, 'quotes');
        listItem(node, node, 0);
        field(node, node, 'text');
        property('#custom-text', 'value', node);
        booleanProperty('#bf-custom-start', 'disabled', 0);
        focus('#custom-text');
    }));
    handle('setting', () => b._temps(6, (dataset, key, node, valueNode, flag, char) => {
        field(dataset, s.payload, 'dataset');
        value(key, dataset, 'name');
        field(node, dataset, 'value');
        b.if(node, () => {}, () => field(node, s.payload, 'value'));
        arena.get(flag, 'value', node);
        equal(flag, names.toggle, () => {
            text.read(key);
            text.intern(flag);
            b._temps(1, prefs => {
                field(prefs, storage.data, 'settings');
                arena.field(valueNode, prefs, key);
                arena.get(valueNode, 'value', valueNode);
                b.not(valueNode, valueNode);
                arena.boolean(node, valueNode);
            });
        });
        for (const name of ['showHands', 'showKeyboard', 'soundEnabled'])
            equal(key, names[name], () => {
                value(flag, s.payload, 'checked');
                if (name === 'soundEnabled') {
                    b.not(flag, flag);
                    b.set(key, names.soundMuted);
                }
                arena.boolean(node, flag);
            });
        for (const name of ['testDuration', 'testWordCount', 'volume'])
            equal(key, names[name], () => {
                arena.get(flag, 'value', node);
                inputText.read(flag);
                b.set(valueNode, 0);
                b.repeat(inputText.length, index => {
                    b.arrayGet(inputText.data, index, char);
                    b.sub(char, 48);
                    b.mul(valueNode, valueNode, 10);
                    b.add(valueNode, char);
                });
                arena.number(node, valueNode);
                if (name === 'volume') {
                    arena.number(valueNode, 100);
                    numbers.divideNumber(node, node, valueNode);
                }
            });
        queueSetting(key, node);
    }));
    handle('mute', () => b._temps(2, (flag, node) => {
        setting(flag, 'soundMuted');
        b.not(flag, flag);
        arena.boolean(node, flag);
        queueSetting(names.soundMuted, node);
    }));
    handle('appearance', () => b._temps(2, (theme, node) => {
        setting(theme, 'theme');
        equal(theme, names.dark, () => arena.string(node, names.light),
            () => arena.string(node, names.dark));
        queueSetting(names.theme, node);
    }));
    handle('suggested', () => b._temps(2, (progress, next) => {
        field(progress, storage.data, 'progress');
        practice.path(progress, s.layout, s.track);
        field(next, practice.pathResult, 'next');
        value(s.lesson, next, 'index', 'numberLo');
        close();
        lesson();
    }));
    handle('continue', () => {
        equal(s.continueTrack, names.pro, () => b.set(s.track, 1), () => b.set(s.track, 0));
        b.copy(s.lesson, s.continueLesson);
        lesson();
    });
    const weak = (group, projected = false) => b._temps(2, (profile, success) => {
        if (projected) b.copy(profile, results.projectedLearning);
        else field(profile, storage.data, 'learning');
        b.copy(success, practice.weak(profile, s.layout, group));
        b.if(success, () => {
            b.set(s.weakGroup, group);
            load();
        });
    });
    handle('weak', () => weak(0));
    handle('pair', () => weak(1));
    handle('nextDrill', () => weak(s.weakGroup, true));
    const repeat = b.reusable('brainfuck/app.mjs:repeat', () => b._temps(3, (track, profile,
        node) => {
        value(track, metadata, 'track');
        equal(track, names.weak, () => b.if(s.result, () => {
            arena.clone(profile, results.projectedLearning);
            arena.setField(metadata, names.learningBefore, profile);
        }));
        practice.repeat();
        load();
    }));
    handle('repeat', repeat);
    handle('missed', () => b._temps(3, (words, node, handle) => {
        arena.array(words);
        b.repeat(engine.missedCount, index => {
            b.arrayGet(engine.missed, index, handle);
            arena.string(node, handle);
            arena.append(words, node);
        });
        practice.retry(words);
        load();
    }));
    const restart = b.reusable('brainfuck/app.mjs:restart', () => b._temps(1, track => {
        value(track, metadata, 'track');
        equal(track, names.test, newTest, () => equal(track, names.lesson, lesson,
            () => equal(track, names.quote, () => {
                    practice.nextQuote();
                    load();
                },
                () => equal(track, names.weak, () => b.if(s.result, repeat,
                    () => weak(s.weakGroup)), load))));
    }));
    handle('restart', restart);
    handle('download', results.download);
    handle('backup', () => {
        backup();
        b.write(39);
        b.writeString('typeflow-backup.json');
        b.writeString('application/json');
        b.write(s.backup);
        emitText(b, '#bf-recovery-status',
            'Backup download started. Keep this file to preserve your progress.');
    });
    handle('retrySave', () => b._temps(2, (request, node) => {
        arena.object(request);
        arena.boolean(node, 1);
        arena.setField(request, names.retry, node);
        arena.set('key', request, request);
        arena.append(s.requests, request);
        b.copy(s.persistent, arena.count);
        b.write(12);
        b.writeString(STORAGE_KEY);
        b.write(request);
    }));
    handle(91, () => b._temps(6, (request, ok, lockFailed, own, key, node) => {
        value(request, s.payload, 'requestId', 'numberLo');
        value(ok, s.payload, 'ok');
        b.not(lockFailed, ok);
        b.lt(node, request, 0x40000000);
        b.if(node, () => {
            arena.field(own, s.requests, request);
            storageRead();
            b.if(own, () => {
                field(node, own, 'retry');
                b.if(node, () => {
                    storage.retrySave(s.pendingResult, s
                        .request, lockFailed);
                    value(ok, s.pendingResult, 'saved');
                    b.if(ok,
                        () => emitText(b,
                            '#bf-recovery-status',
                            'Your progress is saved on this device.'
                        ),
                        () => emitText(b,
                            '#bf-recovery-status',
                            'Saving is still unavailable. Keep a backup of your progress.'
                        ));
                }, () => {
                    storage.refresh(s.raw, s.present, s
                        .readFailed, s.request);
                    b.copy(storage.lockFailed, lockFailed);
                    value(key, own, 'settingKey', 'numberLo');
                    field(node, own, 'settingValue');
                    storage.setSetting(key, node);
                    arena.object(node);
                    constants.save(node);
                    b.copy(s.persistent, arena.count);
                    updatePreferences();
                    equal(key, names.soundProfile, sound
                        .preview);
                    b.if(s.dialog, () => equal(s.dialog, names
                        .settings, settingsView));
                    for (const name of ['testMode',
                            'testDuration', 'testWordCount',
                        'punctuation', 'numbers']) equal(key, names[name], newTest);
                    equal(key, names.typingMode, () => b.if(s
                        .result, () => {
                            value(node, metadata,
                                'track');
                            equal(node, names.weak,
                                repeat, load);
                        }, load));
                    equal(key, names.keyboardLayout, () => b.if(
                        s.result, () => {}, () => {
                            b.if(s.demo, demo
                                .layoutChanged,
                                () => {
                                    value(node,
                                        metadata,
                                        'track');
                                    equal(node,
                                        names
                                        .lesson,
                                        lesson,
                                        load);
                                });
                        }));
                });
                arena.remove(s.requests, request);
            }, () => {
                storage.applyLesson(request, s.raw, s.present, s
                    .readFailed, s.request,
                    lockFailed, s.pendingResult);
                equal(request, s.activeEntry, () => {
                    arena.merge(s.result, s.pendingResult);
                    arena.boolean(node, 0);
                    arena.setField(s.result, names.saving,
                        node);
                    b.copy(s.persistent, arena.count);
                    resultView();
                });
            });
            b.write(13);
            b.write(request);
            b.copy(s.persistent, arena.count);
            saveStatus();
        }, () => results.downloadComplete(ok, request));
    }));
    handle(90, () => b._temps(1, request => {
        value(request, s.payload, 'requestId', 'numberLo');
        equal(request, 2,
            () => demo.tick(request), () => {
                engine.hooks.tick();
                b.if(engine.complete, () => {}, liveView);
            });
    }));
    handle('inputFocus', () => {
        b.set(s.focused, 1);
        classToggle('#bf-arena', 'unfocused', 0);
        booleanProperty('#bf-focus-prompt', 'hidden', 1);
        b.if(s.demo, () => {}, () => engine.resume(engine.now));
    });
    handle('inputBlur', () => {
        b.set(s.focused, 0);
        engine.pause(engine.now);
        classToggle('#bf-arena', 'unfocused', 1);
        booleanProperty('#bf-focus-prompt', 'hidden', 0);
    });
    handle('focus', () => focus('#bf-input'));
    handle('paste', () => {
        cancel();
        emitText(b, '#typing-feedback',
            'Paste is unavailable while typing. Use Custom text to practice a passage.');
    });
    handle('compositionStart', () => b.set(s.composition, 1));
    const receiveInput = b.reusable('brainfuck/app.mjs:receiveInput', () => b._temps(4, (node,
        handle, point, blocked) => {
        value(node, s.payload, 'isComposing');
        b.add(node, s.composition);
        b.if(node, () => {}, () => {
            value(handle, s.payload, 'value');
            inputText.read(handle);
            b.write(32);
            b.writeString(inputText);
            b.writeString('NFC');
            b.read(handle);
            inputText.read(handle);
            emitText(b, '#typing-feedback', '');
            b.repeat(inputText.length, index => {
                b.arrayGet(inputText.data, index, point);
                for (const space of [9, 10, 11, 12, 13, 32, 160, 5760,
                        8192, 8193, 8194,
                    8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279
                        ])
                    equal(point, space, () => b.set(point, 32));
                b.if(engine.complete, () => {}, () => b.if(engine
                    .paused, () => {}, sound.playKey));
                engine.key(point, engine.now);
            });
            arena.string(node, names['']);
            property('#bf-input', 'value', node);
            b.if(engine.complete, () => {}, () => {
                typedView();
                liveView();
            });
        });
    }));
    handle('compositionEnd', () => {
        b.set(s.composition, 0);
        receiveInput();
    });
    handle('keydown', () => b._temps(6, (key, control, alt, blocked, flag, point) => {
        value(key, s.payload, 'key');
        inputText.read(key);
        value(control, s.payload, 'ctrlKey');
        value(alt, s.payload, 'altKey');
        value(blocked, s.payload, 'metaKey');
        value(flag, s.payload, 'isComposing');
        b.add(blocked, flag);
        value(flag, s.payload, 'keyCode', 'numberLo');
        equal(flag, 229, () => b.set(blocked, 1));
        b.add(blocked, s.composition);
        equal(key, names.Process, () => b.set(blocked, 1));
        equal(key, names.Tab, () => b.if(blocked, () => {}, () => {
            value(flag, s.payload, 'shiftKey');
            b.if(flag, () => {}, () => {
                cancel();
                focus('#bf-restart-row button');
                b.set(s.tab, 1);
            });
        }));
        value(s.caps, s.payload, 'capsLock');
        b.if(s.caps,
            () => emitText(b, '#bf-caps-notice', 'caps lock is on'),
            () => emitText(b, '#bf-caps-notice', ''));
        classToggle('[data-code="CapsLock"]', 'caps-active', s.caps);
        value(flag, s.payload, 'code');
        selector.clear();
        selector.literal('[data-code="');
        selector.handle(flag, true);
        selector.literal('"]');
        b.if(blocked, () => {}, () => {
            b.write(34);
            b.writeString(selector);
            b.writeString('key-pressed');
            b.write(1);
        });
        equal(key, names.Backspace, () => {
            cancel();
            b.if(blocked, () => {}, () => b.if(engine.mode, () => {}, () => {
                emitText(b, '#typing-feedback', '');
                engine.deleteBackward(flag);
                b.add(control, alt);
                b.if(control, () => b.while(flag, () => {
                    b.if(engine.index, () => {
                        b.copy(point, engine
                            .index);
                        b.sub(point, 1);
                        b.arrayGet(engine.chars,
                            point, point);
                        b.eq(point, point, 32);
                        b.if(point, () => b.set(
                                flag, 0),
                            () => engine
                            .deleteBackward(
                                flag));
                    }, () => b.set(flag, 0));
                }));
                typedView();
            }));
        }, () => {
            b.add(control, alt);
            value(flag, s.payload, 'altGraph');
            b.if(flag, () => b.set(control, 0));
            b.add(blocked, control);
            equal(inputText.length, 1, () => b.if(blocked, () => {}, () => {
                cancel();
                b.arrayGet(inputText.data, 0, point);
                emitText(b, '#typing-feedback', '');
                b.if(engine.complete, () => {}, () => b.if(engine
                    .paused, () => {}, sound.playKey));
                engine.key(point, engine.now);
                b.if(engine.complete, () => {}, typedView);
                liveView();
            }));
        });
    }));
    handle('keyup', () => b._temps(1, code => {
        value(code, s.payload, 'code');
        selector.clear();
        selector.literal('[data-code="');
        selector.handle(code, true);
        selector.literal('"]');
        b.write(34);
        b.writeString(selector);
        b.writeString('key-pressed');
        b.write(0);
    }));
    handle('input', receiveInput);
    handle('beforeInput', () => b._temps(4, (kind, composing, removed, char) => {
        value(composing, s.payload, 'isComposing');
        b.add(composing, s.composition);
        b.if(composing, () => {}, () => {
            value(kind, s.payload, 'inputType');
            for (const name of ['insertLineBreak', 'insertParagraph'])
                equal(kind, names[name], () => cancel());
            for (const name of ['deleteContentBackward', 'deleteWordBackward'])
                equal(kind, names[name], () => {
                    cancel();
                    b.if(engine.mode, () => {}, () => {
                        emitText(b, '#typing-feedback', '');
                        engine.deleteBackward(removed);
                        if (name === 'deleteWordBackward') b.while(
                            removed, () => {
                                b.if(engine.index, () => {
                                    b.copy(char, engine
                                        .index);
                                    b.sub(char, 1);
                                    b.arrayGet(engine
                                        .chars,
                                        char, char);
                                    b.eq(char, char,
                                        32);
                                    b.if(char, () => b
                                        .set(
                                            removed,
                                            0),
                                        () => engine
                                        .deleteBackward(
                                            removed)
                                    );
                                }, () => b.set(removed,
                                    0));
                            });
                        typedView();
                        engine.hooks.tick();
                    });
                });
        });
    }));
    handle('globalKey', () => b._temps(4, (key, shift, blocked, node) => {
        value(key, s.payload, 'key');
        value(shift, s.payload, 'shiftKey');
        value(blocked, s.payload, 'isComposing');
        value(node, s.payload, 'keyCode', 'numberLo');
        equal(node, 229, () => b.set(blocked, 1));
        b.add(blocked, s.composition);
        b.if(blocked, () => {}, () => {
            equal(key, names.Escape, () => {
                cancel();
                b.if(s.dialog, close, () => open('settings'));
            });
            equal(key, names.Enter, () => b.if(s.dialog, () => {}, () => {
                b.add(shift, s.tab);
                b.if(shift, () => {
                    cancel();
                    b.set(s.tab, 0);
                    restart();
                });
            }));
            equal(key, names.Tab, () => {}, () => equal(key, names.Enter,
                () => {}, () => b.set(s.tab, 0)));
        });
    }));
    const backdrop = out => b._temps(5, (rect, x, y, edge, outside) => {
        value(out, s.payload, 'sameTarget');
        b.if(out, () => {
            b.write(9);
            b.writeString('#bf-modal');
            b.write(0);
            b.read(rect);
            field(x, s.payload, 'clientX');
            field(y, s.payload, 'clientY');
            b.set(out, 0);
            for (const [point, side, comparison] of [[x, 'left', -1], [x, 'right',
                        1],
                [y, 'top', -1], [y, 'bottom', 1]]) {
                field(edge, rect, side);
                numbers.compareNumbers(outside, point, edge);
                b.eq(outside, outside, comparison);
                b.add(out, outside);
            }
        });
    });
    handle('dialogPointer', () => backdrop(s.backdrop));
    handle('dialogClick', () => b._temps(1, outside => {
        backdrop(outside);
        b.if(s.backdrop, () => b.if(outside, close));
        b.set(s.backdrop, 0);
    }));
    handle('visibility', () => b._temps(2, (hidden, resume) => {
        value(hidden, s.payload, 'hidden');
        demo.visibilityChanged(hidden);
        b.if(hidden, () => {
                engine.pause(engine.now);
                classToggle('.key-pressed', 'key-pressed', 0);
            },
            () => {
                demo.mayResume(resume);
                b.if(resume, () => engine.resume(engine.now));
            });
    }));
    handle('resize', () => b.if(s.demo, demo.resize, reposition));
    handle('dialogCancel', () => {
        cancel();
        close();
    });
    handle(93, applyAppearance);
    handle(94, () => b._temps(1, matches => {
        value(matches, s.payload, 'matches');
        demo.motionChanged(matches);
    }));
    handle(92, () => b._temps(1, state => {
        value(state, s.payload, 'state');
        for (const [name, key] of [['activated', 'ready'], ['waiting', 'update'], [
                'error', 'failed']])
            equal(state, names[name], () => {
                emitText(b, '#bf-offline-state', messages.offline[key][0]);
                emitText(b, '#bf-offline-description', messages.offline[key][1]);
            });
    }));
    b.set(rootCount, 0);
    const keepRoot = root => {
        b.arraySet(roots, rootCount, root);
        b.add(rootCount, 1);
    };
    for (const root of [s.content, s.defaults, metadata, s.result, s.pendingResult, s.requests])
        keepRoot(root);
    storage.retainedRoots(keepRoot);
    results.retainedRoots(keepRoot);
    b.write(38);
    b.write(rootCount);
    b.repeat(rootCount, index => b._temps(1, root => {
        b.arrayGet(roots, index, root);
        b.write(root);
    }));
    return {
        program: b,
        metadata: {
            arena: arena.layout,
            strings: strings.slice(1),
            seeds: [content, defaults]
        },
        engine,
        state: s,
        arena
    };
}
