import '../css/main.css';
import '../css/keyboard.css';
import '../css/hands.css';
import './swift.css';

// Browser primitives only; the WebAssembly application chooses every command.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let wasm;
let audio;
let draining = false;
const events = [];
const media = {
    dark: matchMedia('(prefers-color-scheme: dark)'),
    coarse: matchMedia('(pointer: coarse)'),
    reduced: matchMedia('(prefers-reduced-motion: reduce)')
};
const dateParts = date => ({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    epoch: date.getTime(),
    valid: Number.isFinite(date.getTime()),
    label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
});
const query = selector => document.querySelector(selector);
const blobDownload = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function dispatch(event) {
    events.push(event);
    if (draining) return 0;
    draining = true;
    let prevented = 0;
    try {
        while (events.length) {
            const next = deliver(events.shift());
            if (!prevented) prevented = next;
        }
    } finally { draining = false; }
    return prevented;
}

function deliver(event) {
    const now = new Date();
    const bytes = encoder.encode(JSON.stringify({
        ...event,
        now: performance.now(),
        epoch: now.getTime(),
        iso: now.toISOString(),
        local: dateParts(now)
    }));
    if (bytes.length >= 2147483647) throw new Error('Event exceeds module capacity.');
    const pointer = wasm.typeflow_reserve(bytes.length);
    new Uint8Array(wasm.memory.buffer, pointer, bytes.length).set(bytes);
    const prevented = wasm.typeflow_event(bytes.length);
    const result = JSON.parse(decoder.decode(new Uint8Array(wasm.memory.buffer,
        wasm.typeflow_output(), wasm.typeflow_length())));
    for (const command of result) apply(command);
    return prevented;
}

function read(command) {
    const perform = () => {
        let raw = null;
        let readFailed = false;
        try { raw = localStorage.getItem(command.key); } catch { readFailed = true; }
        dispatch({
            kind: 'storage-read',
            id: command.id,
            purpose: command.purpose,
            raw,
            readFailed
        });
    };
    if (!command.lock || !navigator.locks?.request) { perform(); return; }
    let entered = false;
    navigator.locks.request(command.key, () => {
            entered = true;
            perform();
        })
        .catch(() => {
            if (!entered) dispatch({
                kind: 'storage-read',
                id: command.id,
                purpose: command.purpose,
                raw: null,
                lockFailed: true
            });
        });
}

function play(command) {
    try {
        const Constructor = window.AudioContext || window.webkitAudioContext;
        if (!Constructor) return;
        if (!audio || audio.state === 'closed') audio = new Constructor();
        if (audio.state === 'suspended') audio.resume().catch(() => {});
        for (const note of command.notes) {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            const start = audio.currentTime + (note.delay || 0);
            oscillator.type = note.wave;
            oscillator.frequency.setValueAtTime(note.frequency, start);
            if (note.to) oscillator.frequency.exponentialRampToValueAtTime(note.to,
                start + (note.frequencyDuration || note.duration));
            gain.gain.setValueAtTime(note.attack ? 0 : Math.max(0.00001, note.volume), start);
            if (note.attack) gain.gain.linearRampToValueAtTime(note.volume, start + note.attack);
            gain.gain.exponentialRampToValueAtTime(note.end || 0.00001, start + note.duration);
            if (note.filter) {
                const filter = audio.createBiquadFilter();
                filter.type = note.filter.type;
                filter.frequency.value = note.filter.frequency;
                filter.Q.value = note.filter.q || 1;
                oscillator.connect(filter);
                filter.connect(gain);
            } else oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.start(start);
            oscillator.stop(start + (note.stop || note.duration + 0.005));
        }
    } catch { dispatch({ kind: 'io-error', operation: 'audio' }); }
}

function apply(command) {
    const node = command.selector ? query(command.selector) : null;
    switch (command.op) {
        case 'html':
            if (node) node.innerHTML = command.value;
            break;
        case 'text':
            if (node) node.textContent = command.value;
            break;
        case 'prop':
            if (node) node[command.name] = command.value;
            break;
        case 'attr':
            if (node) {
                if (command.value === null) node.removeAttribute(command.name);
                else node.setAttribute(command.name, command.value);
            }
            break;
        case 'focus':
            node?.focus({ preventScroll: true });
            break;
        case 'dialog':
            if (command.value) { if (node && !node.open) node.showModal(); } else if (node?.open)
                node.close();
            break;
        case 'scroll':
            window.scrollTo(command.x || 0, command.y || 0);
            break;
        case 'anchor': {
            const target = query(command.target);
            const parent = query(command.parent);
            const viewport = query(command.viewport);
            if (!node || !target || !parent) break;
            const rect = target.getBoundingClientRect();
            const bounds = parent.getBoundingClientRect();
            const line = parseFloat(getComputedStyle(parent).lineHeight);
            const height = line * command.height;
            node.style.left = `${rect.left - bounds.left}px`;
            node.style.top = `${rect.top - bounds.top + (rect.height - height) / 2}px`;
            node.style.height = `${height}px`;
            if (viewport) viewport.scrollTop = Math.max(0, rect.top - bounds.top - line);
            break;
        }
        case 'read':
            queueMicrotask(() => read(command));
            break;
        case 'value':
            dispatch({ kind: 'value', id: command.id, value: node?.value || '' });
            break;
        case 'write': {
            let succeeded = false;
            try {
                localStorage.setItem(command.key, command.raw);
                succeeded = true;
            } catch {}
            dispatch({ kind: 'storage-write', id: command.id, succeeded });
            break;
        }
        case 'dates':
            dispatch({
                kind: 'dates',
                id: command.id,
                values: command.values.map(value => dateParts(new Date(value))),
                offsets: command.offsets.map(offset => {
                    const date = new Date();
                    date.setDate(date.getDate() + offset);
                    return dateParts(date);
                })
            });
            break;
        case 'download':
            try {
                blobDownload(new Blob([command.value], { type: command.type }), command.name);
                dispatch({ kind: 'download-result', id: command.id, succeeded: true });
            } catch { dispatch({ kind: 'download-result', id: command.id, succeeded: false }); }
            break;
        case 'raster': {
            const source = URL.createObjectURL(new Blob([command
        .value], { type: 'image/svg+xml' }));
            const picture = new Image();
            const failed = () => {
                URL.revokeObjectURL(source);
                dispatch({ kind: 'download-result', id: command.id, succeeded: false });
            };
            picture.onerror = failed;
            picture.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = command.width;
                    canvas.height = command.height;
                    const context = canvas.getContext('2d');
                    if (!context) { failed(); return; }
                    context.drawImage(picture, 0, 0);
                    URL.revokeObjectURL(source);
                    canvas.toBlob(blob => {
                        if (blob) {
                            blobDownload(blob, command.name);
                            dispatch({
                                kind: 'download-result',
                                id: command.id,
                                succeeded: true
                            });
                        } else failed();
                    }, 'image/png');
                } catch { failed(); }
            };
            picture.src = source;
            break;
        }
        case 'audio':
            play(command);
            break;
        case 'worker': {
            if (!('serviceWorker' in navigator)) {
                dispatch({ kind: 'worker', unavailable: true });
                break;
            }
            navigator.serviceWorker.register(new URL(command.url, document
                .baseURI), { updateViaCache: 'none' }).then(registration => {
                let installing = registration.installing;
                const update = () => dispatch({
                    kind: 'worker',
                    waiting: !!registration.waiting,
                    active: registration.active?.state || '',
                    installing: installing?.state || ''
                });
                const watch = () => {
                    installing = registration.installing;
                    installing?.addEventListener('statechange', update);
                    update();
                };
                registration.addEventListener('updatefound', watch);
                watch();
            }).catch(() => dispatch({ kind: 'worker', unavailable: true }));
            break;
        }
    }
}
async function start() {
    const response = await fetch(new URL('./typeflow.wasm', import.meta.url));
    if (!response.ok) throw new Error('Could not load application module.');
    const instantiated = await WebAssembly.instantiate(await response.arrayBuffer(), {
        wasi_snapshot_preview1: {
            random_get(pointer, length) {
                const bytes = new Uint8Array(wasm.memory.buffer, pointer >>> 0, length
                    >>> 0);
                for (let offset = 0; offset < bytes.length; offset += 65536)
                    crypto.getRandomValues(bytes.subarray(offset, offset + 65536));
                return 0;
            }
        }
    });
    wasm = instantiated.instance.exports;
    const relay = event => {
        const target = event.target;
        const action = target instanceof Element ? target.closest('[data-action]') : null;
        const rect = target instanceof Element ? target.getBoundingClientRect() : null;
        const prevented = dispatch({
            kind: event.type,
            id: target.id || '',
            name: target.name || '',
            value: typeof target.value === 'string'
                ? target.value : '',
            checked: !!target.checked,
            data: event.data || '',
            inputType: event.inputType || '',
            key: event.key || '',
            code: event.code || '',
            keyCode: event.keyCode || 0,
            ctrl: !!event.ctrlKey,
            meta: !!event.metaKey,
            alt: !!event.altKey,
            shift: !!event.shiftKey,
            altGraph: !!event.getModifierState?.('AltGraph'),
            caps: !!event.getModifierState?.('CapsLock'),
            composing: !!event.isComposing,
            action: action?.dataset || {},
            open: !!target.open,
            backdrop: !!rect && target instanceof HTMLDialogElement &&
                (event.clientX < rect.left || event.clientX > rect.right ||
                    event.clientY < rect.top || event.clientY > rect.bottom)
        });
        if (prevented) event.preventDefault();
    };
    for (const name of ['click', 'change', 'input', 'beforeinput', 'keydown', 'keyup',
        'focusin', 'focusout', 'compositionstart', 'compositionend', 'paste', 'cancel',
        'pointerdown', 'submit']) document.addEventListener(name, relay, true);
    document.addEventListener('visibilitychange', () => dispatch({
        kind: 'visibility',
        hidden: document.hidden,
        active: document.activeElement?.id || ''
    }));
    window.addEventListener('storage', event => dispatch({
        kind: 'storage',
        key: event.key,
        raw: event.newValue
    }));
    window.addEventListener('resize', () => dispatch({ kind: 'resize' }));
    for (const [name, query] of Object.entries(media)) query.addEventListener('change',
        () => dispatch({ kind: 'media', name, matches: query.matches }));
    dispatch({
        kind: 'boot',
        dark: media.dark.matches,
        coarse: media.coarse.matches,
        reduced: media.reduced.matches,
        hidden: document.hidden
    });
    document.fonts?.ready.then(() => dispatch({ kind: 'resize' }));
    setInterval(() => dispatch({ kind: 'tick' }), 100);
}
start().catch(error => {
    document.getElementById('root').textContent =
        `Application unavailable: ${error.message}`;
});
