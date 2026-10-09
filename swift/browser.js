import '../css/main.css';
import '../css/keyboard.css';
import '../css/hands.css';
import './swift.css';
import { storage } from '../js/storage.js';
import { KeyboardView, KEYBOARD_PRESETS } from '../js/keyboard.js';
import { CURRICULUM } from '../js/lessons.js';
import { sound } from '../js/audio.js';
import { resultCard } from '../js/share.js';
import { mergeLearning } from '../js/learning.js';
import {
    generateLessonDrill,
    lessonsForLayout,
    generateWords,
    generateWeakDrill,
    focusKeys,
    focusLabel,
    practiceObservation,
    normalizeCustomText,
    formatElapsedTime,
    typingErrorMessage,
    resultFeedback,
    lessonPath,
    sessionLabel
} from '../js/practice.js';

const root = document.getElementById('root');
const decoder = new TextDecoder();
const encoder = new TextEncoder();
let wasm;

async function start() {
    const response = await fetch(new URL('./typeflow.wasm', import.meta.url));
    if (!response.ok) throw new Error('Could not load the Swift application.');
    ({ instance: { exports: wasm } } = await WebAssembly.instantiate(await response
        .arrayBuffer(), {
            wasi_snapshot_preview1: {
                random_get(pointer, length) {
                    const bytes = new Uint8Array(wasm.memory.buffer, pointer >>> 0, length
                        >>> 0);
                    for (let offset = 0; offset < bytes.length; offset += 65536)
                        crypto.getRandomValues(bytes.subarray(offset, offset + 65536));
                    return 0;
                }
            }
        }));
    const read = () => decoder.decode(new Uint8Array(wasm.memory.buffer,
        wasm.typeflow_output(), wasm.typeflow_length()));
    const html = region => { wasm.typeflow_render(region, performance.now()); return read(); };
    const snapshot = () => {
        wasm.typeflow_snapshot(performance.now());
        return JSON.parse(
            read());
    };
    root.innerHTML = html(0);
    const $ = selector => root.querySelector(selector);
    const field = $('.typing-input');
    const settings = { ...storage.data.settings };
    let exercise, stats, result, guide, run = 0,
        completedRun = -1,
        lessonTrack = 'amateur';
    let compositionCommitted = false;
    let nextProfile;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const palette = () => {
        document.documentElement.dataset.theme = settings.theme === 'system'
            ? media.matches ? 'dark' : 'light' : settings.theme;
        document.documentElement.dataset.palette = settings.colorPalette;
        sound.setMuted(settings.soundMuted);
        sound.setVolume(settings.volume);
        sound.setProfile(settings.soundProfile);
    };
    media.addEventListener('change', palette);
    palette();
    for (const [value, title] of Object.entries(KEYBOARD_PRESETS))
        $('[name="keyboardLayout"]').add(new Option(title, value));
    for (const control of $('#settings-dialog').querySelectorAll('[name]')) {
        if (control.type === 'checkbox') control.checked = settings[control.name];
        else control.value = settings[control.name];
    }
    const saveState = saved => {
        $('#recovery').hidden = saved && !storage.saveFailed && !storage.loadFailed;
        if ($('#save-status')) $('#save-status').textContent = saved ?
            'Progress saved on this device.'
            : 'Progress is pending. Export a backup or retry saving.';
    };
    const reposition = () => {
        const target = $(`#passage [data-index="${stats?.currentIndex || 0}"]`);
        const caret = $('#passage .caret');
        if (!target || !caret) return;
        const rect = target.getBoundingClientRect();
        const parent = $('#passage').getBoundingClientRect();
        const height = parseFloat(getComputedStyle($('#passage')).lineHeight);
        caret.style.left = `${rect.left - parent.left}px`;
        caret.style.top = `${rect.top - parent.top + (rect.height - height * 0.65) / 2}px`;
        caret.style.height = `${height * 0.65}px`;
        caret.hidden = document.activeElement !== field;
        $('.text-viewport').scrollTop = Math.max(0, rect.top - parent.top - height);
    };
    new ResizeObserver(reposition).observe($('.text-viewport'));
    const recommendation = () => {
        const profile = storage.getLearning();
        const keys = focusKeys(profile);
        const pairs = focusKeys(profile, 1, 'bigrams');
        $('[data-action="weak"]').disabled = !keys.length;
        $('[data-action="pairs"]').disabled = !pairs.length;
        $('#recommendation').textContent = keys.length ? keys.map(key =>
                `${focusLabel(key)}: ${practiceObservation(profile.keys[key], true)}`).join(
                ' · ')
            : 'Complete a lesson to receive practice suggestions.';
    };
    const load = next => {
        const text = encoder.encode(next.lines.join('\n'));
        if (text.length >= wasm.typeflow_capacity()) throw new Error(
            'This passage is too long.');
        for (const dialog of root.querySelectorAll('dialog[open]')) dialog.close();
        run++;
        exercise = {
            ...next,
            keyboardLayout: settings.keyboardLayout,
            typingMode: settings
                .typingMode
        };
        result = null;
        const pointer = wasm.typeflow_input();
        new Uint8Array(wasm.memory.buffer, pointer, text.length).set(text);
        wasm.typeflow_load(text.length, settings.typingMode === 'strict' ? 1 : 0, next
            .duration || 0);
        $('#exercise').hidden = false;
        $('#results').hidden = true;
        $('#results').innerHTML = '';
        $('#exercise-title').textContent = next.title;
        $('#exercise-kind').textContent = next.track === 'lesson' ? 'Guided lesson' :
            'Typing practice';
        $('#instructions').textContent = next.description || '';
        $('#lesson-goal').textContent = next.targetAccuracy
            ?
            `Aim for ${next.targetAccuracy}% accuracy and ${next.targetWpm} WPM. Take your time.`
            : '';
        $('#quote-source').replaceChildren();
        if (next.source) {
            const link = document.createElement('a');
            link.href = next.source;
            link.textContent = 'Read the public-domain source';
            link.target = '_blank';
            link.rel = 'noreferrer';
            $('#quote-source').append(`${next.author} · `, link);
        }
        guide = new KeyboardView($('#keyboard'), $('#hands'), null, exercise
            .keyboardLayout);
        $('#keyboard').hidden = !settings.showKeyboard;
        $('#hands').hidden = !settings.showHands;
        $('#typing-feedback').textContent = '';
        $('#typing-help').textContent = settings.typingMode === 'strict'
            ? 'Take your time. Each correct key moves you forward.'
            :
            'Find your rhythm. Space moves to the next word; backspace corrects mistakes.';
        $('#mode-label').textContent = settings.typingMode === 'strict' ? 'english · guided'
            : 'english · free flow';
        recommendation();
        update(true);
        field.focus({ preventScroll: true });
    };
    const lesson = (track, index) => load({
        ...lessonsForLayout(track, settings.keyboardLayout)[index],
        lines: generateLessonDrill(track, index, undefined, settings.keyboardLayout),
        track: 'lesson',
        lessonTrack: track,
        lessonIndex: index
    });
    const test = () => load({
        track: 'test',
        id: `${settings.testMode}-${settings.testMode === 'time'
        ? settings.testDuration : settings.testWordCount}`,
        title: settings.testMode === 'time'
            ? `${settings.testDuration} second test`
            : `${settings.testWordCount} word test`,
        lines: [generateWords(settings.testMode === 'time' ? 400 : settings
            .testWordCount, settings)],
        duration: settings.testMode === 'time' ? settings.testDuration : 0,
        options: { ...settings }
    });
    const weak = (group, profile = storage.getLearning()) => {
        const drill = generateWeakDrill(profile, undefined, settings.keyboardLayout, group);
        if (!drill.focusKeys.length) return;
        load({
            ...drill,
            track: 'weak',
            focusGroup: group,
            id: group === 'keys' ? 'weak-keys' : 'weak-pairs',
            title: group === 'keys' ? 'Weak-key practice' : 'Pair practice',
            options: { recordEligible: false }
        });
    };
    const comparison = () => {
        if (exercise.track !== 'weak') return;
        nextProfile = mergeLearning(exercise.learningBefore, result.learning);
        const targets = focusKeys(nextProfile, exercise.focusGroup === 'keys' ? 3 : 1,
            exercise.focusGroup);
        const section = $('#practice-comparison');
        section.hidden = false;
        const heading = document.createElement('h2');
        heading.textContent = 'Your practice focus';
        const scope = document.createElement('p');
        scope.textContent =
            'Earlier: weighted recent observations. This drill: this attempt only.';
        const table = document.createElement('table');
        for (const row of [['Target', 'Earlier recent', 'This drill'], ...exercise.focusKeys
                .map(key => [focusLabel(key), practiceObservation(exercise
                        .learningBefore[exercise.focusGroup][key], true),
                    practiceObservation(result.learning[exercise.focusGroup][key])])]) {
            const tr = table.insertRow();
            row.forEach(value => {
                const cell = document.createElement(table.rows.length === 1 ? 'th' :
                    'td');
                if (cell.tagName === 'TH') cell.scope = 'col';
                cell.textContent = value;
                tr.append(cell);
            });
        }
        const note = document.createElement('p');
        note.textContent =
            `Next focus: ${targets.map(focusLabel).join(', ')}. Recent errors and relative reach times suggest this focus. Reach excludes pauses and backspace gaps. A short drill is not proof of mastery.`;
        section.append(heading, scope, table, note);
    };
    const complete = async () => {
        if (completedRun === run) return;
        completedRun = run;
        const captured = run;
        result = { ...stats, keyboardLayout: exercise.keyboardLayout };
        $('#exercise').hidden = true;
        $('#results').hidden = false;
        $('#results').innerHTML = html(2);
        const feedback = resultFeedback(result, exercise);
        $('#results h1').textContent = feedback.heading;
        $('#coaching').textContent = feedback.advice;
        comparison();
        new KeyboardView($('#result-keyboard'), null, null, exercise.keyboardLayout)
            .showHeatmap(result.learning);
        const next = $('#results [data-action="next"]');
        next.hidden = !['lesson', 'weak'].includes(exercise.track);
        next.textContent = exercise.track === 'weak' ? 'Start next drill' :
            'Next lesson';
        $('#results [data-action="missed"]').hidden = !result.missedWords.length;
        (next.hidden ? $('#results [data-action="repeat"]') : next).focus();
        sound.playSuccess();
        try {
            const saved = await storage.recordLesson(exercise.id, result, exercise
                .targetWpm || 45,
                exercise.targetAccuracy || 95, {
                    ...exercise.options,
                    typingMode: exercise.typingMode
                });
            if (captured === run) saveState(saved.saved !== false);
        } catch (error) {
            if (captured === run) {
                saveState(false);
                $('#save-status').textContent = error.message;
            }
        }
    };

    function update(passage = false) {
        stats = snapshot();
        if (stats.status === 'complete') { complete(); return; }
        if (passage) {
            $('#passage').innerHTML = html(1);
            $('#typing-feedback').textContent = stats.typed === null ? ''
                : typingErrorMessage(stats.expected, stats.typed, exercise.typingMode);
        }
        $('#exercise-prompt').textContent =
            `Type this text: ${exercise.lines[stats.currentLineIndex] || ''}`;
        $('#live-wpm').textContent = stats.wpm;
        $('#live-accuracy').textContent = `${stats.accuracy}%`;
        $('#live-time').textContent = exercise.duration ? `${stats.timeRemaining}s` :
            formatElapsedTime(stats.elapsedMilliseconds);
        $('#position').textContent = `line ${stats.currentLineIndex + 1} / ${stats.totalLines} · ${stats.status === 'idle'
            ? 'start with your first key' : stats.status}`;
        $('#arena').classList.toggle('focused', document.activeElement === field);
        $('#arena').classList.toggle('unfocused', document.activeElement !== field);
        $('#focus-prompt').hidden = document.activeElement === field;
        $('#focus-prompt').textContent = stats.status === 'paused' ? 'Paused — click to resume'
            : 'Click here to start typing';
        guide?.highlightTarget(stats.currentChar ?? (settings.typingMode === 'flow' ? ' ' :
            null));
        reposition();
    }
    const open = name => $(`#${name}-dialog`).showModal();
    const showLessons = () => {
        const lessons = lessonsForLayout(lessonTrack, settings.keyboardLayout);
        const path = lessonPath(lessons, storage.getAllProgress());
        $('#lesson-path').textContent =
            `${path.completed} completed · ${path.threeStar} with three stars`;
        $('#lesson-list').replaceChildren(...lessons.map((item, index) => {
            const button = document.createElement('button');
            button.className = 'lesson-item';
            button.dataset.lesson = index;
            button.textContent = item.title;
            return button;
        }));
        open('lessons');
    };
    root.addEventListener('click', async event => {
        const button = event.target.closest('button');
        if (!button) return;
        try {
            if (button.dataset.lesson !== undefined) {
                lesson(lessonTrack, Number(
                    button.dataset.lesson));
                return;
            }
            if (button.dataset.track) {
                lessonTrack = button.dataset.track;
                $('#lessons-dialog').close();
                showLessons();
                return;
            }
            switch (button.dataset.action) {
                case 'close':
                    button.closest('dialog').close();
                    break;
                case 'lessons':
                    showLessons();
                    break;
                case 'settings':
                    open('settings');
                    break;
                case 'custom':
                    open('custom');
                    break;
                case 'custom-start': {
                    const text = normalizeCustomText($('#custom-text').value);
                    if (text) load({
                        track: 'custom',
                        id: 'custom',
                        title: 'Custom text',
                        lines: [text],
                        options: { recordEligible: false }
                    });
                    break;
                }
                case 'test':
                    test();
                    break;
                case 'quote': {
                    const quote = CURRICULUM.quotes[Math.floor(Math.random() *
                        CURRICULUM.quotes.length)];
                    load({
                        ...quote,
                        track: 'quote',
                        id: `quote-${quote.id}`,
                        title: `Quote · ${quote.author}`,
                        lines: [quote
                            .text]
                    });
                    break;
                }
                case 'weak':
                    weak('keys');
                    break;
                case 'pairs':
                    weak('bigrams');
                    break;
                case 'next':
                    if (exercise.track === 'weak') weak(exercise.focusGroup,
                        nextProfile);
                    else if (exercise.lessonIndex + 1 < CURRICULUM[exercise
                            .lessonTrack].length)
                        lesson(exercise.lessonTrack, exercise.lessonIndex + 1);
                    else showLessons();
                    break;
                case 'repeat':
                    load({
                        ...exercise,
                        learningBefore: exercise.track === 'weak'
                            ? mergeLearning(exercise.learningBefore, result
                                .learning) : exercise.learningBefore,
                        options: {
                            ...exercise.options,
                            recordEligible: false
                        }
                    });
                    break;
                case 'missed':
                    load({
                        track: 'retry',
                        id: 'missed-words',
                        title: 'Missed words',
                        lines: [result.missedWords.join(' ')],
                        options: { recordEligible: false }
                    });
                    break;
                case 'back':
                case 'restart':
                    if (exercise.track === 'lesson') lesson(exercise.lessonTrack,
                        exercise.lessonIndex);
                    else load({
                        ...exercise,
                        options: {
                            ...exercise.options,
                            recordEligible: false
                        }
                    });
                    break;
                case 'backup':
                    download(new Blob([storage
                    .exportBackup()], { type: 'application/json' }),
                        'typeflow-backup.json');
                    break;
                case 'retry-save':
                    saveState(await storage.retrySave());
                    break;
                case 'card':
                    download(await resultCard(result, exercise),
                        'typeflow-result.png');
                    break;
                case 'history': {
                    const container = $('#history-content');
                    container.replaceChildren();
                    if (!storage.data.history.length) container.textContent =
                        'Complete a session to see your history.';
                    for (const entry of storage.data.history) {
                        const p = document.createElement('p');
                        p.textContent =
                            `${sessionLabel(entry)} · ${entry.wpm} WPM · ${entry.accuracy}% · ${new Date(entry.date).toLocaleDateString()}`;
                        container.append(p);
                    }
                    open('history');
                    break;
                }
            }
        } catch (error) { $('#typing-feedback').textContent = error.message; }
    });
    for (const dialog of root.querySelectorAll('dialog')) dialog.addEventListener('close',
        () => {
            if (!root.querySelector('dialog[open]') && !$('#exercise').hidden) field
                .focus();
        });
    $('#settings-dialog').addEventListener('change', async event => {
        const control = event.target;
        const value = control.type === 'checkbox' ? control.checked : [
                'testDuration', 'testWordCount'].includes(control.name)
            ? Number(control.value) : control.value;
        settings[control.name] = value;
        palette();
        if (['keyboardLayout', 'typingMode'].includes(control.name)) {
            const wasOpen = $('#settings-dialog').open;
            if (exercise.track === 'lesson') lesson(exercise.lessonTrack, exercise
                .lessonIndex);
            else if (exercise.track === 'weak') weak(exercise.focusGroup);
            else load({ ...exercise });
            if (wasOpen) open('settings');
        }
        $('#keyboard').hidden = !settings.showKeyboard;
        $('#hands').hidden = !settings.showHands;
        saveState(await storage.setSetting(control.name, value));
    });
    const receive = event => {
        if (event.isComposing) return;
        if (compositionCommitted && /Composition/.test(event.inputType || '')) {
            compositionCommitted = false;
            field.value = '';
            return;
        }
        compositionCommitted = event.type === 'compositionend';
        for (const char of field.value.normalize('NFC')) wasm.typeflow_key(/\s/u.test(char)
            ? 32 : char.codePointAt(0), performance.now());
        field.value = '';
        update(true);
    };
    field.addEventListener('input', receive);
    field.addEventListener('compositionend', receive);
    field.addEventListener('compositionstart', () => { compositionCommitted = false; });
    field.addEventListener('paste', event => event.preventDefault());
    field.addEventListener('beforeinput', event => {
        if (event.isComposing) return;
        if (['deleteContentBackward', 'deleteWordBackward', 'insertLineBreak',
                'insertParagraph'].includes(event.inputType)) {
            event.preventDefault();
            if (event.inputType.startsWith('delete')) wasm.typeflow_delete(event
                .inputType === 'deleteWordBackward' ? 1 : 0, performance.now());
            update(true);
        }
    });
    field.addEventListener('keydown', event => {
        if (event.isComposing || event.keyCode === 229 || event.metaKey || ((event
                    .ctrlKey || event.altKey)
                && event.key !== 'Backspace' && !event.getModifierState('AltGraph')))
            return;
        if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            $('[data-action="restart"]').focus();
            return;
        }
        guide.pressKey(event.code);
        guide.setCapsLock(event.getModifierState('CapsLock'));
        if (Array.from(event.key).length === 1 || event.key === 'Backspace') {
            event.preventDefault();
            if (event.key === 'Backspace') wasm.typeflow_delete(event.ctrlKey || event
                .altKey ? 1 : 0, performance.now());
            else {
                sound.playKey();
                wasm.typeflow_key(event.key.codePointAt(0), performance.now());
            }
            update(true);
        }
    });
    field.addEventListener('keyup', event => guide.releaseKey(event.code));
    field.addEventListener('focus', () => {
        wasm.typeflow_resume(performance.now());
        update(true);
    });
    field.addEventListener('blur', () => {
        wasm.typeflow_pause(performance.now());
        guide.clearPressedKeys();
        update();
    });
    $('#arena').addEventListener('click', () => field.focus());
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            wasm.typeflow_pause(performance.now());
            guide.clearPressedKeys();
            update();
        } else if (document.activeElement === field && !root
            .querySelector('dialog[open]')) {
            wasm.typeflow_resume(performance.now());
            update();
        }
    });
    window.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !root.querySelector('dialog[open]')) open(
            'settings');
    });
    $('#keyboard-notice').hidden = !matchMedia('(pointer: coarse)').matches;
    saveState(!storage.saveFailed);
    lesson('amateur', 1);
    setInterval(() => {
        wasm.typeflow_tick(performance.now());
        update();
    }, 100);
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register(
                '../sw.js', { scope: '../' });
            await navigator.serviceWorker.ready;
            const offline = $('#offline-status');
            const check = () => {
                offline.textContent = registration.waiting ?
                    'Update ready — close all Typeflow tabs to apply'
                    : registration.active ? 'Available offline' :
                    'Preparing offline lessons…';
            };
            check();
            registration.addEventListener('updatefound', () => registration.installing
                ?.addEventListener('statechange', check));
        } catch { $('#offline-status').textContent = 'Offline lessons unavailable'; }
    }
}

function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

start().catch(error => {
    root.replaceChildren();
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = `${error.message} Please reload to try again.`;
    root.append(message);
});
