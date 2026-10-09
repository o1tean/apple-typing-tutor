import { TokenCodec } from './codec.js';
import '../css/main.css';
import '../css/keyboard.css';
import '../css/hands.css';

const schemas = {
    1: 'ss',
    2: 'ss',
    3: 'ss',
    4: 'sss',
    5: 'sss',
    6: 's',
    7: 's',
    8: 'sn',
    9: 'sn',
    10: 'sn',
    11: 'snn',
    12: 'sn',
    13: 'n',
    14: 'nn',
    15: 'n',
    16: 'sn',
    17: 'nnn',
    18: 'n',
    19: 'sss',
    20: 'ssnnn',
    21: 'ssn',
    22: 'nsn',
    23: 'sn',
    24: 'n',
    25: 'ssn',
    26: 'nn',
    27: 'ssn',
    28: 'ssnn',
    29: 's',
    30: 'nn',
    32: 'ss',
    33: 'ss',
    34: 'ssn',
    35: 'ss',
    36: 'sn',
    37: 'nsn',
    38: 'a',
    39: 'ssn',
    40: 'ss'
};
const select = selector => selector === 'window' ? [window] :
    selector === 'document' ? [document] : Array.from(document.querySelectorAll(selector));
const packets = [];
const input = [];
const timers = new Map();
const locks = new Map();
let codec;
let instance;
let activeEvent;
let busy = false;
let stopped = false;
let inputCursor = 0;
let outputWritten = 0;
let audio;
let audioGain;

function response(...values) {
    for (const value of values) input.push(value);
}

function stop(error) {
    stopped = true;
    for (const release of locks.values()) release();
    locks.clear();
    for (const timer of timers.values()) {
        clearTimeout(timer);
        clearInterval(timer);
    }
    timers.clear();
    packets.length = 0;
    input.length = 0;
    inputCursor = 0;
    output.length = 0;
    const message = document.createElement('main');
    message.className = 'variant-error';
    message.setAttribute('role', 'alert');
    const heading = document.createElement('h1');
    heading.textContent = 'The WebAssembly application stopped';
    const detail = document.createElement('p');
    detail.textContent =
        'Your saved browser data has been kept. Reloading discards changes that have not been saved.';
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'Reload page';
    reload.addEventListener('click', () => location.reload());
    const fallback = document.createElement('a');
    fallback.href = new URL('./', location.href).href;
    fallback.textContent = 'Open original version';
    message.append(heading, detail, reload, fallback);
    (document.querySelector('#root') || document.body).replaceChildren(message);
    console.error(error);
}

function run(event, value = {}, nativeEvent = null) {
    if (stopped) return;
    packets.push([event, value, nativeEvent]);
    if (busy) return;
    busy = true;
    try {
        let packetCursor = 0;
        while (packetCursor < packets.length) {
            const [id, data, original] = packets[packetCursor++];
            activeEvent = original;
            response(id, codec.encode({
                ...data,
                now: Math.round(performance.now() * 1000),
                date: Date.now()
            }));
            outputWritten = 0;
            instance.exports.run();
            if (inputCursor !== input.length && (inputCursor || outputWritten)) throw new Error(
                'Unread browser transport input');
            if (output.length) throw new Error('Incomplete browser transport output');
            input.length = 0;
            inputCursor = 0;
        }
        packets.length = 0;
    } catch (error) {
        stop(error);
    } finally {
        activeEvent = null;
        busy = false;
    }
}

function download(filename, mime, content) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function eventData(event, target) {
    const value = target.value;
    const data = {
        type: event.type,
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        isComposing: event.isComposing,
        altGraph: event.getModifierState?.('AltGraph') || false,
        capsLock: event.getModifierState?.('CapsLock') || false,
        inputType: event.inputType,
        data: event.data,
        value,
        checked: target.checked,
        dataset: { ...target.dataset },
        target: { tagName: event.target?.tagName, id: event.target?.id },
        hidden: document.hidden,
        width: innerWidth,
        height: innerHeight,
        clientX: event.clientX,
        clientY: event.clientY,
        sameTarget: event.target === target
    };
    return data;
}

function listen(selector, type, id, flags) {
    const listener = event => {
        const targets = select(selector);
        const matched = targets.find(target => target === window || target === document ||
            event.target === target || target.contains(event.target));
        if (matched) run(id, eventData(event, matched), event);
    };
    // Delegation survives markup emitted by subsequent Brainfuck transactions.
    (selector === 'window' ? window : document).addEventListener(type, listener,
        Boolean(flags & 1));
}

function play(parameters) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    const voices = parameters.voices || [];
    if (audio?.state === 'closed') {
        audio = null;
        audioGain = null;
    }
    if (!audio && voices.length) {
        const context = new Audio();
        const gain = context.createGain();
        gain.connect(context.destination);
        audio = context;
        audioGain = gain;
    }
    if (!audio) return;
    if (voices.length) void audio.resume().catch(() => {});
    const time = audio.currentTime;
    if (parameters.gain !== undefined) audioGain.gain.setValueAtTime(parameters.gain, time);
    for (const voice of voices) {
        const start = time + (voice.delay || 0);
        let source;
        if (voice.samples) {
            source = audio.createBufferSource();
            const buffer = audio.createBuffer(1, voice.samples.length, audio.sampleRate);
            buffer.copyToChannel(Float32Array.from(voice.samples), 0);
            source.buffer = buffer;
        } else {
            source = audio.createOscillator();
            source.type = voice.type || 'sine';
            source.frequency.setValueAtTime(voice.frequency, start);
            if (voice.endFrequency) source.frequency.exponentialRampToValueAtTime(
                voice.endFrequency, start + (voice.frequencyDuration ?? voice.duration));
        }
        const gain = audio.createGain();
        gain.gain.setValueAtTime(voice.attack ? 0 : voice.gain, start);
        if (voice.attack) gain.gain.linearRampToValueAtTime(voice.gain, start + voice.attack);
        gain.gain.exponentialRampToValueAtTime(voice.endGain ?? 0.0001,
            start + (voice.gainDuration ?? voice.duration));
        if (voice.filter) {
            const filter = audio.createBiquadFilter();
            filter.type = voice.filter.type;
            filter.frequency.setValueAtTime(voice.filter.frequency, start);
            if (voice.filter.q !== undefined) filter.Q.setValueAtTime(voice.filter.q, start);
            source.connect(filter);
            filter.connect(gain);
        } else source.connect(gain);
        gain.connect(audioGain);
        source.start(start);
        source.stop(start + voice.duration);
    }
}

function operate(opcode, args) {
    const [a, b, c, d, e] = args;
    switch (opcode) {
        case 1:
            select(a).forEach(node => node.innerHTML = b);
            break;
        case 2:
            select(a).forEach(node => node.insertAdjacentHTML('beforeend', b));
            break;
        case 3:
            select(a).forEach(node => node.textContent = b);
            break;
        case 4:
            select(a).forEach(node => node.setAttribute(b, c));
            break;
        case 5:
            select(a).forEach(node => node.style.setProperty(b, c));
            break;
        case 6:
            select(a).forEach(node => node.remove());
            break;
        case 7:
            select(a)[0]?.focus();
            break;
        case 8:
            select(a).forEach(node => b ? node.showModal() : node.close());
            break;
        case 9: {
            const rect = select(a)[0]?.getBoundingClientRect();
            response(codec.encode(rect?.toJSON() || null));
            break;
        }
        case 10: {
            try {
                const raw = localStorage.getItem(a);
                let value = null;
                const handle = raw === null ? 0 : codec.internNullable(raw);
                try { value = raw === null ? null : JSON.parse(raw); } catch {
                    response(0, 1, 0,
                        handle);
                    break;
                }
                try {
                    response(codec.encode(value), Number(raw !== null), 0,
                        handle);
                } catch { response(0, Number(raw !== null), 1, handle); }
            } catch { response(0, 0, 1, 0); }
            break;
        }
        case 11: {
            try {
                const raw = JSON.stringify(codec.decode(b));
                localStorage.setItem(a, raw);
                response(codec.intern(raw), 0);
            } catch { response(0, 1); }
            break;
        }
        case 12: {
            if (!navigator.locks) { run(91, { requestId: b, ok: true, available: false }); break; }
            navigator.locks.request(a, () => new Promise(resolve => {
                if (stopped) { resolve(); return; }
                locks.set(b, resolve);
                run(91, { requestId: b, ok: true, available: true });
            })).catch(() => run(91, { requestId: b, ok: false, available: true }));
            break;
        }
        case 13:
            locks.get(a)?.();
            locks.delete(a);
            break;
        case 14:
            response(codec.encode(a ? Date.now() :
                Math.round(performance.now() * 1000)));
            break;
        case 15:
            response(Math.floor(Math.random() * 0x100000000));
            break;
        case 16:
            response(Number(matchMedia(a).matches));
            break;
        case 17: {
            const previous = timers.get(a);
            if (previous) {
                clearTimeout(previous);
                clearInterval(previous);
            }
            if (b) timers.set(a, (c ? setInterval : setTimeout)(() => run(90, { requestId: a }),
                b));
            else timers.delete(a);
            break;
        }
        case 18: {
            try {
                play(codec.decode(
                    a));
            } catch { /* Audio availability does not interrupt the browser transaction. */ }
            break;
        }
        case 19:
            download(a, b, c);
            break;
        case 20: {
            const url = URL.createObjectURL(new Blob([b], { type: 'image/svg+xml' }));
            const picture = new Image();
            picture.onload = () => {
                URL.revokeObjectURL(url);
                if (stopped) return;
                const canvas = document.createElement('canvas');
                canvas.width = c;
                canvas.height = d;
                canvas.getContext('2d').drawImage(picture, 0, 0);
                canvas.toBlob(blob => {
                    if (stopped) return;
                    if (blob) download(a, 'image/png', blob);
                    run(91, { requestId: e, ok: Boolean(blob) });
                }, 'image/png');
            };
            picture.onerror = () => {
                URL.revokeObjectURL(url);
                run(91, { requestId: e, ok: false });
            };
            picture.src = url;
            break;
        }
        case 21: {
            if (!('serviceWorker' in navigator)) {
                run(92, {
                    requestId: c,
                    state: 'error'
                });
                break;
            }
            navigator.serviceWorker.register(a, { scope: b }).then(registration => {
                const report = worker => run(92, {
                    requestId: c,
                    state: worker?.state === 'redundant' ? worker.state
                        : registration.waiting ? 'waiting' : registration.active
                        ?.state ||
                        registration.installing?.state || 'unknown'
                });
                const watchInstalling = () => {
                    const worker = registration.installing;
                    worker?.addEventListener('statechange', () => report(worker));
                    report();
                };
                watchInstalling();
                registration.addEventListener('updatefound', watchInstalling);
                navigator.serviceWorker.addEventListener('controllerchange', () =>
                    report());
            }).catch(() => run(92, { requestId: c, state: 'error' }));
            break;
        }
        case 22: {
            const value = codec.decode(a);
            let result;
            if (b === 'parse') result = Date.parse(value);
            else if (b === 'utc') {
                const parts = [];
                for (let index = 0; index < Math.min(value.length, 7); index++) parts.push(
                    value[index]);
                result = Reflect.apply(Date.UTC, Date, parts);
            } else {
                const date = new Date(value);
                if (b === 'iso') result = date.toISOString();
                else if (b === 'parts') result = {
                    year: date.getFullYear(),
                    month: date.getMonth(),
                    day: date.getDate(),
                    weekday: date.getDay(),
                    offset: date.getTimezoneOffset(),
                    timestamp: date.getTime()
                };
                else result = date.toLocaleString(undefined, JSON.parse(b));
            }
            response(codec.encode(result));
            break;
        }
        case 23:
            navigator.clipboard.writeText(a).then(() => run(91, { requestId: b, ok: true })).catch(
                () => run(91, { requestId: b, ok: false }));
            break;
        case 24: {
            const text = codec.strings[a] || '';
            let length = 0;
            for (const char of text) length++;
            response(length);
            for (const char of text) response(char.codePointAt(0));
            break;
        }
        case 25:
            select(a).forEach(node => node[b] = codec.decode(c));
            break;
        case 26:
            activeEvent?.preventDefault();
            if (b) activeEvent?.stopPropagation();
            break;
        case 27:
            response(codec.encode(select(a)[0]?.[b]));
            break;
        case 28:
            listen(a, b, c, d);
            break;
        case 29:
            response(codec.intern(a));
            break;
        case 30:
            response(codec.intern(JSON.stringify(codec.decode(a))));
            break;
        case 32:
            response(codec.intern(a.normalize(b)));
            break;
        case 33: {
            const order = a.localeCompare(b);
            response(order < 0 ? 1 : order > 0 ? 2 : 0);
            break;
        }
        case 34:
            select(a).forEach(node => node.classList.toggle(b, Boolean(c)));
            break;
        case 35:
            select(a).forEach(node => node.removeAttribute(b));
            break;
        case 36: {
            const media = matchMedia(a);
            media.addEventListener('change', () => run(b, { matches: media.matches }));
            break;
        }
        case 37: {
            const number = codec.decode(a);
            response(codec.intern(b === 'fixed' ? number.toFixed(c) :
                b === 'precision' ? number.toPrecision(c) : number.toString()));
            break;
        }
        case 38:
            codec.sweep(a);
            break;
        case 39:
            download(a, b, codec.strings[c] || '');
            break;
        case 40: {
            const node = select(a)[0];
            response(codec.encode(node ? parseFloat(getComputedStyle(node)[b]) || 0 : 0));
            break;
        }
        default:
            throw new RangeError('Unknown browser primitive');
    }
}

let output = [];

function write(value) {
    outputWritten++;
    output.push(value >>> 0);
    const schema = schemas[output[0]];
    if (!schema) throw new RangeError('Invalid browser packet');
    let cursor = 1;
    const args = [];
    for (const type of schema) {
        if (cursor >= output.length) return;
        if (type === 'n') args.push(output[cursor++]);
        else {
            const count = output[cursor++];
            if (cursor + count > output.length) return;
            const points = output.slice(cursor, cursor + count);
            args.push(type === 'a' ? points :
                points.map(point => String.fromCodePoint(point)).join(''));
            cursor += count;
        }
    }
    if (cursor !== output.length) throw new Error('Invalid browser packet length');
    const opcode = output[0];
    output = [];
    operate(opcode, args);
}

try {
    const [metadata, bytes] = await Promise.all([
        fetch(new URL('../typeflow-brainfuck.json', import.meta.url)).then(response => {
            if (!response.ok) throw new Error('Missing application metadata');
            return response.json();
        }),
        fetch(new URL('../typeflow-brainfuck.wasm', import.meta.url)).then(response => {
            if (!response.ok) throw new Error('Missing WebAssembly application');
            return response.arrayBuffer();
        })
    ]);
    ({ instance } = await WebAssembly.instantiate(bytes, {
        env: {
            read: () => {
                if (inputCursor >= input.length) throw new Error(
                    'Empty browser transport input');
                return input[inputCursor++];
            },
            write
        }
    }));
    codec = new TokenCodec(instance.exports.memory, metadata.arena, metadata.strings);
    const roots = metadata.seeds.map(value => codec.encode(value));
    run(0, { roots });
} catch (error) {
    stop(error);
}
