/**
 * Mac-style keyboard and finger guidance.
 */

import { FINGER_MAP } from './lessons.js';

export const KEYBOARD_LAYOUT = {
    row1: [
        { code: 'Backquote', label: '`', shiftLabel: '~', width: 1 },
        { code: 'Digit1', label: '1', shiftLabel: '!', width: 1 },
        { code: 'Digit2', label: '2', shiftLabel: '@', width: 1 },
        { code: 'Digit3', label: '3', shiftLabel: '#', width: 1 },
        { code: 'Digit4', label: '4', shiftLabel: '$', width: 1 },
        { code: 'Digit5', label: '5', shiftLabel: '%', width: 1 },
        { code: 'Digit6', label: '6', shiftLabel: '^', width: 1 },
        { code: 'Digit7', label: '7', shiftLabel: '&', width: 1 },
        { code: 'Digit8', label: '8', shiftLabel: '*', width: 1 },
        { code: 'Digit9', label: '9', shiftLabel: '(', width: 1 },
        { code: 'Digit0', label: '0', shiftLabel: ')', width: 1 },
        { code: 'Minus', label: '-', shiftLabel: '_', width: 1 },
        { code: 'Equal', label: '=', shiftLabel: '+', width: 1 },
        { code: 'Backspace', label: 'delete', width: 1.5, special: 'delete' }
  ],
    row2: [
        { code: 'Tab', label: 'tab', width: 1.5, special: 'tab' },
        { code: 'KeyQ', label: 'Q', char: 'q', width: 1 },
        { code: 'KeyW', label: 'W', char: 'w', width: 1 },
        { code: 'KeyE', label: 'E', char: 'e', width: 1 },
        { code: 'KeyR', label: 'R', char: 'r', width: 1 },
        { code: 'KeyT', label: 'T', char: 't', width: 1 },
        { code: 'KeyY', label: 'Y', char: 'y', width: 1 },
        { code: 'KeyU', label: 'U', char: 'u', width: 1 },
        { code: 'KeyI', label: 'I', char: 'i', width: 1 },
        { code: 'KeyO', label: 'O', char: 'o', width: 1 },
        { code: 'KeyP', label: 'P', char: 'p', width: 1 },
        { code: 'BracketLeft', label: '[', shiftLabel: '{', width: 1 },
        { code: 'BracketRight', label: ']', shiftLabel: '}', width: 1 },
        { code: 'Backslash', label: '\\', shiftLabel: '|', width: 1 }
  ],
    row3: [
        { code: 'CapsLock', label: 'caps lock', width: 1.75, special: 'caps' },
        { code: 'KeyA', label: 'A', char: 'a', width: 1 },
        { code: 'KeyS', label: 'S', char: 's', width: 1 },
        { code: 'KeyD', label: 'D', char: 'd', width: 1 },
        { code: 'KeyF', label: 'F', char: 'f', width: 1, bump: true },
        { code: 'KeyG', label: 'G', char: 'g', width: 1 },
        { code: 'KeyH', label: 'H', char: 'h', width: 1 },
        { code: 'KeyJ', label: 'J', char: 'j', width: 1, bump: true },
        { code: 'KeyK', label: 'K', char: 'k', width: 1 },
        { code: 'KeyL', label: 'L', char: 'l', width: 1 },
        { code: 'Semicolon', label: ';', shiftLabel: ':', width: 1 },
        { code: 'Quote', label: '\'', shiftLabel: '"', width: 1 },
        { code: 'Enter', label: 'return', width: 1.75, special: 'return' }
  ],
    row4: [
        { code: 'ShiftLeft', label: 'shift', width: 2.25, special: 'shift' },
        { code: 'KeyZ', label: 'Z', char: 'z', width: 1 },
        { code: 'KeyX', label: 'X', char: 'x', width: 1 },
        { code: 'KeyC', label: 'C', char: 'c', width: 1 },
        { code: 'KeyV', label: 'V', char: 'v', width: 1 },
        { code: 'KeyB', label: 'B', char: 'b', width: 1 },
        { code: 'KeyN', label: 'N', char: 'n', width: 1 },
        { code: 'KeyM', label: 'M', char: 'm', width: 1 },
        { code: 'Comma', label: ',', shiftLabel: '<', width: 1 },
        { code: 'Period', label: '.', shiftLabel: '>', width: 1 },
        { code: 'Slash', label: '/', shiftLabel: '?', width: 1 },
        { code: 'ShiftRight', label: 'shift', width: 2.25, special: 'shift' }
  ],
    row5: [
        {
            code: 'ControlLeft',
            label: 'control',
            sublabel: '⌃',
            width: 1.25,
            special: 'control'
        },
        { code: 'AltLeft', label: 'option', sublabel: '⌥', width: 1.25, special: 'option' },
        {
            code: 'MetaLeft',
            label: 'command',
            sublabel: '⌘',
            width: 1.5,
            special: 'command'
        },
        { code: 'Space', label: '', char: ' ', width: 5.5, special: 'space' },
        {
            code: 'MetaRight',
            label: 'command',
            sublabel: '⌘',
            width: 1.5,
            special: 'command'
        },
        { code: 'AltRight', label: 'option', sublabel: '⌥', width: 1.25, special: 'option' }
  ]
};

// Map character to physical key code
const CHAR_TO_CODE = {
    '`': 'Backquote',
    '~': 'Backquote',
    '1': 'Digit1',
    '!': 'Digit1',
    '2': 'Digit2',
    '@': 'Digit2',
    '3': 'Digit3',
    '#': 'Digit3',
    '4': 'Digit4',
    '$': 'Digit4',
    '5': 'Digit5',
    '%': 'Digit5',
    '6': 'Digit6',
    '^': 'Digit6',
    '7': 'Digit7',
    '&': 'Digit7',
    '8': 'Digit8',
    '*': 'Digit8',
    '9': 'Digit9',
    '(': 'Digit9',
    '0': 'Digit0',
    ')': 'Digit0',
    '-': 'Minus',
    '_': 'Minus',
    '=': 'Equal',
    '+': 'Equal',
    'q': 'KeyQ',
    'Q': 'KeyQ',
    'w': 'KeyW',
    'W': 'KeyW',
    'e': 'KeyE',
    'E': 'KeyE',
    'r': 'KeyR',
    'R': 'KeyR',
    't': 'KeyT',
    'T': 'KeyT',
    'y': 'KeyY',
    'Y': 'KeyY',
    'u': 'KeyU',
    'U': 'KeyU',
    'i': 'KeyI',
    'I': 'KeyI',
    'o': 'KeyO',
    'O': 'KeyO',
    'p': 'KeyP',
    'P': 'KeyP',
    '[': 'BracketLeft',
    '{': 'BracketLeft',
    ']': 'BracketRight',
    '}': 'BracketRight',
    '\\': 'Backslash',
    '|': 'Backslash',
    'a': 'KeyA',
    'A': 'KeyA',
    's': 'KeyS',
    'S': 'KeyS',
    'd': 'KeyD',
    'D': 'KeyD',
    'f': 'KeyF',
    'F': 'KeyF',
    'g': 'KeyG',
    'G': 'KeyG',
    'h': 'KeyH',
    'H': 'KeyH',
    'j': 'KeyJ',
    'J': 'KeyJ',
    'k': 'KeyK',
    'K': 'KeyK',
    'l': 'KeyL',
    'L': 'KeyL',
    ';': 'Semicolon',
    ':': 'Semicolon',
    '\'': 'Quote',
    '"': 'Quote',
    'z': 'KeyZ',
    'Z': 'KeyZ',
    'x': 'KeyX',
    'X': 'KeyX',
    'c': 'KeyC',
    'C': 'KeyC',
    'v': 'KeyV',
    'V': 'KeyV',
    'b': 'KeyB',
    'B': 'KeyB',
    'n': 'KeyN',
    'N': 'KeyN',
    'm': 'KeyM',
    'M': 'KeyM',
    ',': 'Comma',
    '<': 'Comma',
    '.': 'Period',
    '>': 'Period',
    '/': 'Slash',
    '?': 'Slash',
    ' ': 'Space'
};

export const KEYBOARD_PRESETS = {
    'mac-us': 'Mac US · QWERTY',
    colemak: 'Colemak · US ANSI',
    dvorak: 'Dvorak · US ANSI',
    'uk-iso': 'UK QWERTY · ISO'
};

// Standard Colemak and US Dvorak character positions; Caps Lock stays unchanged.
export function keyboardLayout(preset = 'mac-us') {
    const characters = {
        colemak: ['`1234567890-=', 'qwfpgjluy;[]\\', "arstdhneio'", 'zxcvbkm,./'],
        dvorak: ['`1234567890[]', "',.pyfgcrl/=\\", 'aoeuidhtns-', ';qjkxbmwvz']
    } [preset];
    const usKeys = Object.values(KEYBOARD_LAYOUT).flat();
    const shifted = char => usKeys.find(key => key.code === CHAR_TO_CODE[char])
        ?.shiftLabel || char.toUpperCase();
    const charToCode = {},
        fingerMap = {},
        fromQwerty = {};
    const rows = Object.fromEntries(Object.entries(KEYBOARD_LAYOUT).map(([name, row], rowIndex) => {
        let index = 0;
        return [name, row.map(key => {
            const original = key.char ?? (key.label.length === 1 ? key.label
                : null);
            if (original === null) return { ...key };
            const pair = preset === 'uk-iso' ? {
                '`': '`¬',
                '2': '2"',
                '3': '3£',
                "'": "'@",
                '\\': '#~'
            } [original] : null;
            const char = pair?.[0] ?? characters?.[rowIndex]?.[index++] ??
                original;
            const shift = pair?.[1] ?? shifted(char);
            charToCode[char] = key.code;
            fingerMap[char] = { ...FINGER_MAP[original] };
            fromQwerty[original] = char;
            if (shift !== char) {
                charToCode[shift] = key.code;
                fingerMap[shift] = { ...fingerMap[char], shift: true };
                fromQwerty[shifted(original)] = shift;
            }
            return {
                ...key,
                char,
                label: char === ' ' ? '' : char.toUpperCase(),
                shiftLabel: shift === char.toUpperCase() ? undefined : shift
            };
        })];
    }));
    if (preset === 'uk-iso') {
        const backslash = rows.row2.pop();
        const enter = rows.row3.pop();
        rows.row2.push({ ...enter, label: '↵', width: 1, isoStem: 0.75 });
        rows.row3.push(backslash, { width: 0.75 });
        rows.row4[0].width = 1.25;
        rows.row4.splice(1, 0, {
            code: 'IntlBackslash',
            label: '\\',
            char: '\\',
            shiftLabel: '|',
            width: 1
        });
        for (const char of ['\\', '|']) {
            charToCode[char] = 'IntlBackslash';
            fingerMap[char] = { ...FINGER_MAP.z, shift: char === '|' };
        }
        rows.row1.at(-1).label = 'backspace';
        rows.row5 = [
            ['ControlLeft', 'ctrl'], ['MetaLeft', 'win'], ['AltLeft', 'alt'], ['Space', ''],
            ['AltRight', 'alt gr'], ['MetaRight', 'win'], ['ContextMenu', 'menu'],
            ['ControlRight', 'ctrl']
        ].map(([code, label]) => ({
            code,
            label,
            width: code === 'Space' ? 5.75 : 1.25,
            special: code === 'Space' ? 'space' : 'control'
        }));
    }
    return {
        rows,
        charToCode,
        fingerMap,
        fromQwerty,
        homeKeys: Array.from('asdfjkl;', char => fromQwerty[char]).join('')
    };
}

export function isoEnterOutline(stem) {
    return [[0, 0], [1, 0], [1, 1], [1 - stem, 1], [1 - stem, 0.5], [0, 0.5]];
}

export function keyMeasurements(learning, preset = 'mac-us') {
    const { charToCode } = keyboardLayout(preset);
    const cells = new Map();
    for (const [char, cell] of Object.entries(learning?.keys || {})) {
        const code = Object.hasOwn(charToCode, char) ? charToCode[char] : null;
        if (!code) continue;
        const combined = cells.get(code) || {
            attempts: 0,
            errors: 0,
            latencySamples: 0,
            latencyTotalMs: 0
        };
        for (const field of Object.keys(combined)) combined[field] += cell[field];
        cells.set(code, combined);
    }
    return cells;
}

export class KeyboardView {
    constructor(containerEl, handsContainerEl, fingerHintEl, preset = 'mac-us') {
        this.container = containerEl;
        this.handsContainer = handsContainerEl;
        this.fingerHint = fingerHintEl;
        this.preset = preset;
        this.layout = keyboardLayout(preset);
        const home = this.layout.homeKeys.toUpperCase();
        this.restHint =
            `Rest your fingers on ${Array.from(home.slice(0, 4)).join(' ')} and ${Array.from(home.slice(4)).join(' ')}`;
        this.keyElements = new Map();
        this.keyPositions = new Map();

        this.renderKeyboard();
        this.renderHands();
        this.fingerHint = this.handsContainer?.querySelector('#finger-hint-text') ||
            fingerHintEl;
    }

    renderKeyboard() {
        this.container.innerHTML = '';
        const boardEl = document.createElement('div');
        boardEl.className = 'magic-keyboard';

        Object.values(this.layout.rows).forEach((row, rowIndex) => {
            const width = row.reduce((total, key) => total + key.width, 0);
            let offset = 0;
            const rowEl = document.createElement('div');
            rowEl.className = 'keyboard-row';

            row.forEach(key => {
                if (!key.code) {
                    const spacer = document.createElement('div');
                    spacer.className = 'keyboard-spacer';
                    spacer.style.flex = `${key.width} 0 0`;
                    rowEl.appendChild(spacer);
                    offset += key.width;
                    return;
                }
                this.keyPositions.set(key.code, {
                    row: rowIndex,
                    x: (offset + key.width / 2) / width
                });
                offset += key.width;
                const keyEl = document.createElement('div');
                keyEl.className = 'magic-key';
                keyEl.dataset.code = key.code;
                keyEl.style.flex = `${key.width} 0 0`;

                if (key.special) keyEl.classList.add(`key-${key.special}`);
                if (key.isoStem) {
                    keyEl.classList.add('key-iso-enter');
                    const outline = document.createElementNS(
                        'http://www.w3.org/2000/svg', 'svg');
                    outline.setAttribute('class', 'iso-enter-outline');
                    outline.setAttribute('viewBox', '0 0 1 1');
                    outline.setAttribute('preserveAspectRatio', 'none');
                    outline.setAttribute('aria-hidden', 'true');
                    const shape = document.createElementNS(outline.namespaceURI,
                        'polygon');
                    shape.setAttribute('points', isoEnterOutline(key.isoStem)
                        .map(point => point.join(','))
                        .join(' '));
                    shape.setAttribute('vector-effect', 'non-scaling-stroke');
                    outline.appendChild(shape);
                    keyEl.appendChild(outline);
                }

                // The bumps stay on the physical index-finger home keys.
                if (key.bump) {
                    const bumpEl = document.createElement('span');
                    bumpEl.className = 'tactile-bump';
                    keyEl.appendChild(bumpEl);
                }

                // CapsLock green LED indicator
                if (key.code === 'CapsLock') {
                    const ledEl = document.createElement('span');
                    ledEl.className = 'caps-led';
                    keyEl.appendChild(ledEl);
                }

                const labelContainer = document.createElement('div');
                labelContainer.className = 'key-labels';

                if (key.shiftLabel) {
                    const shiftSpan = document.createElement('span');
                    shiftSpan.className = 'key-shift-label';
                    shiftSpan.textContent = key.shiftLabel;
                    labelContainer.appendChild(shiftSpan);
                }

                const mainSpan = document.createElement('span');
                mainSpan.className = 'key-main-label';
                mainSpan.textContent = key.label;
                labelContainer.appendChild(mainSpan);

                if (key.sublabel) {
                    const subSpan = document.createElement('span');
                    subSpan.className = 'key-sub-label';
                    subSpan.textContent = key.sublabel;
                    labelContainer.appendChild(subSpan);
                }

                keyEl.appendChild(labelContainer);
                rowEl.appendChild(keyEl);
                this.keyElements.set(key.code, keyEl);
            });

            boardEl.appendChild(rowEl);
        });

        this.container.appendChild(boardEl);
    }

    showHeatmap(learning) {
        const cells = keyMeasurements(learning, this.preset);
        for (const [code, element] of this.keyElements) {
            const cell = cells.get(code);
            element.classList.toggle('key-measured', Boolean(cell?.attempts));
            if (!cell?.attempts) {
                element.title = 'Not tried in this session';
                continue;
            }
            const rate = cell.errors / cell.attempts;
            element.style.setProperty('--key-heat', rate ? 'var(--error)' : 'var(--accent)');
            element.style.setProperty('--key-heat-strength',
                `${rate ? Math.round(12 + rate * 30) : 22}%`);
            const label = code === 'Space' ? 'Space' : element.querySelector('.key-main-label')
                .textContent;
            const reach = cell.latencySamples ?
                `${Math.round(cell.latencyTotalMs / cell.latencySamples)} ms average reach` :
                'reach not measured';
            element.title =
                `${label}: ${cell.errors} ${cell.errors === 1 ? 'error' : 'errors'} · ${cell.attempts} attempts · ${reach}`;
        }
    }

    renderHands() {
        if (!this.handsContainer) return;
        const fingers = [
            {
                name: 'pinky',
                x: 23,
                y: 81,
                path: 'M19 119 10 80C6 63 27 58 32 75L46 117Q34 112 19 119Z',
                joint: 'M20 99 32 95'
            },
            {
                name: 'ring',
                x: 49,
                y: 53,
                path: 'M50 117 36 51C32 33 55 28 60 47L77 109Q64 105 50 117Z',
                joint: 'M47 82 60 79'
            },
            {
                name: 'middle',
                x: 83,
                y: 39,
                path: 'M81 107 69 36C66 17 90 14 94 33L108 106Q95 101 81 107Z',
                joint: 'M79 73 92 71'
            },
            {
                name: 'index',
                x: 128,
                y: 55,
                path: 'M116 110 114 53C112 34 135 30 139 49L154 126Q134 111 116 110Z',
                joint: 'M124 86 137 83'
            },
            {
                name: 'thumb',
                x: 188,
                y: 117,
                path: 'M155 153 181 109C190 94 209 104 201 121L183 158Q171 167 155 153Z',
                joint: 'M168 137 179 144'
            }
    ];
        this.handsContainer.innerHTML = `
      <div class="hands-display">
        ${['left', 'right'].map(hand => {
          const left = hand === 'left';
          const home = Array.from(this.layout.homeKeys.toUpperCase());
          const letters = [...(left ? home.slice(0, 4) : home.slice(4).reverse()), '␣'];
          const description = fingers.slice(0, 4).map((finger, index) =>
              `${finger.name} ${letters[index] === ';' ? 'semicolon' : letters[index]}`).join(', ');
          return `<div class="hand-wrapper hand-${hand}">
            <svg class="hand-svg" viewBox="0 -18 220 244" role="img"
              aria-label="${left ? 'Left' : 'Right'} hand: ${description}; thumb Space.">
              <g transform="${left ? '' : 'translate(220 0) scale(-1 1)'}">
                <path class="hand-outline" d="M57 220C58 199 39 188 30 166C24 153 22 137 19 119L10 80C6 63 27 58 32 75L47 119Q52 124 50 117L36 51C32 33 55 28 60 47L77 109Q82 115 81 107L69 36C66 17 90 14 94 33L108 106Q113 114 116 110L114 53C112 34 135 30 139 49L154 126C158 138 163 140 168 131L181 109C190 94 209 104 201 121L183 158Q172 186 149 200L149 220" />
                ${fingers.map((finger, index) => `
                  <g id="finger-${hand}-${finger.name}" class="finger-pill"
                    data-home-key="${letters[index]}">
                    <path class="finger-shape" d="${finger.path}" />
                    <path class="finger-joint" d="${finger.joint}" />
                    <rect class="finger-nail" x="${finger.x - 9}" y="${finger.y - 12}" width="18" height="23" rx="7" />
                    <text class="finger-tag" x="${finger.x}" y="${finger.y + 5}"
                      transform="${left ? '' : `translate(${finger.x * 2} 0) scale(-1 1)`}">${letters[index]}</text>
                    ${finger.name === 'index' ? `<path class="home-bump" d="M${finger.x - 4} ${finger.y + 8}h8" />` : ''}
                  </g>`).join('')}
                <path class="hand-detail" d="M48 139Q79 127 112 137M119 131Q137 149 136 178M62 204Q97 211 134 204" />
              </g>
            </svg>
            <div class="hand-label">${left ? 'Left' : 'Right'} hand <span>${(left ? home.slice(0, 4) : home.slice(4)).join(' ')}</span></div>
          </div>`;
        }).join('')}
        <div class="finger-instructions">
          <p class="finger-instruction-text" id="finger-hint-text">${this.restHint}</p>
          <p class="hand-rest-note">Reach for the next key, then return home · Feel the bumps under your index fingers</p>
        </div>
      </div>
    `;
    }

    reachFinger(hand, name, code, char, shift = false) {
        const finger = this.handsContainer?.querySelector(`#finger-${hand}-${name}`);
        if (!finger) return;
        const target = this.keyPositions.get(code);
        const home = this.keyPositions.get(this.layout.charToCode[finger.dataset.homeKey
            .toLowerCase()]);
        const row = shift ? 'shift' : name === 'thumb' ? 'space' : ['number', 'upper', 'home',
            'lower'][target.row];
        // Illustrative reach follows the target and home key's physical positions.
        const angle = shift ? -28 : name === 'thumb' ? 12 :
            Math.max(-30, Math.min(30, (target.x - home.x) * 160 * (hand === 'left' ? 1 : -1)));
        const scale = shift ? 0.76 : name === 'thumb' ? 0.9 : [1.38, 1.24, 0.94, 0.8][target
            .row];
        finger.style.setProperty('--reach-angle', `${angle}deg`);
        finger.style.setProperty('--reach-scale', scale);
        finger.dataset.reachRow = row;
        finger.dataset.targetKey = shift ? 'Shift' : char;
        finger.querySelector('.finger-tag').textContent = shift ? '⇧' : char === ' ' ? '␣' :
            char;
        finger.classList.add(shift ? 'shift-active' : 'active', `accent-${name}`);
        return row;
    }

    highlightTarget(char) {
        // Clear all existing target classes
        this.container.querySelectorAll('.key-target, .key-shift-target').forEach(el => {
            el.classList.remove('key-target', 'key-shift-target', 'finger-pinky',
                'finger-ring', 'finger-middle', 'finger-index', 'finger-thumb');
        });

        // Clear finger highlights in SVG
        if (this.handsContainer) {
            this.handsContainer.querySelectorAll(
                '.finger-pill.active, .finger-pill.shift-active').forEach(el => {
                el.classList.remove('active', 'shift-active', 'accent-pinky',
                    'accent-ring', 'accent-middle', 'accent-index', 'accent-thumb');
                el.style.removeProperty('--reach-angle');
                el.style.removeProperty('--reach-scale');
                delete el.dataset.reachRow;
                delete el.dataset.targetKey;
                el.querySelector('.finger-tag').textContent = el.dataset.homeKey;
            });
        }

        if (this.fingerHint) this.fingerHint.textContent = char ? `Type “${char}”` : this
            .restHint;
        if (!char) {
            return;
        }

        const code = this.layout.charToCode[char];
        const fingerInfo = this.layout.fingerMap[char];

        if (code && this.keyElements.has(code)) {
            const el = this.keyElements.get(code);
            el.classList.add('key-target');

            if (fingerInfo) {
                el.classList.add(`finger-${fingerInfo.finger}`);
            }
        }

        // Opposite-hand Shift key handling
        if (fingerInfo && fingerInfo.shift) {
            // Touch-typing rule: if typing with left hand, hold Right Shift; if right hand, hold Left Shift!
            const shiftKey = fingerInfo.hand === 'left' ? 'ShiftRight' : 'ShiftLeft';
            const shiftEl = this.keyElements.get(shiftKey);
            if (shiftEl) {
                shiftEl.classList.add('key-shift-target');
            }
            this.reachFinger(fingerInfo.hand === 'left' ? 'right' : 'left', 'pinky',
                shiftKey, char, true);
        }

        // Highlight finger in hand diagram
        if (fingerInfo && this.handsContainer) {
            const hands = fingerInfo.finger === 'thumb' ? ['left', 'right'] : [fingerInfo.hand];
            const rows = hands.map(hand => this.reachFinger(hand, fingerInfo.finger, code,
                char));

            const hintText = this.fingerHint;
            if (hintText) {
                const charDisplay = char === ' ' ? 'Space' : `"${char}"`;
                const shiftNote = fingerInfo.shift ?
                    ` (+ ${fingerInfo.hand === 'left' ? 'Right' : 'Left'} Shift)` : '';
                const reach = rows[0] === 'space' ? 'press Space' : rows[0] === 'home' ? [
                        'KeyG',
                        'KeyH'].includes(code) ? 'reach inward' : 'home row' :
                    `reach ${rows[0]} row`;
                hintText.textContent =
                    `${fingerInfo.finger === 'thumb' ? 'Either thumb' : fingerInfo.label} · ${charDisplay} · ${reach}${shiftNote}`;
            }
        }
    }

    pressKey(code) {
        const el = this.keyElements.get(code);
        if (el) {
            el.classList.add('key-pressed');
        }
    }

    releaseKey(code) {
        const el = this.keyElements.get(code);
        if (el) {
            el.classList.remove('key-pressed');
        }
    }

    clearPressedKeys() {
        this.container.querySelectorAll('.key-pressed').forEach(el => {
            el.classList.remove('key-pressed');
        });
    }

    setCapsLock(active) {
        const capsEl = this.keyElements.get('CapsLock');
        if (capsEl) {
            if (active) {
                capsEl.classList.add('caps-active');
            } else {
                capsEl.classList.remove('caps-active');
            }
        }
    }
}
