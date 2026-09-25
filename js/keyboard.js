/**
 * Apple Magic Keyboard & Finger Guidance Engine
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
    { code: 'ControlLeft', label: 'control', sublabel: '⌃', width: 1.25, special: 'control' },
    { code: 'OptionLeft', label: 'option', sublabel: '⌥', width: 1.25, special: 'option' },
    { code: 'MetaLeft', label: 'command', sublabel: '⌘', width: 1.5, special: 'command' },
    { code: 'Space', label: '', char: ' ', width: 5.5, special: 'space' },
    { code: 'MetaRight', label: 'command', sublabel: '⌘', width: 1.5, special: 'command' },
    { code: 'OptionRight', label: 'option', sublabel: '⌥', width: 1.25, special: 'option' }
  ]
};

// Map character to physical key code
const CHAR_TO_CODE = {
  '`': 'Backquote', '~': 'Backquote',
  '1': 'Digit1', '!': 'Digit1',
  '2': 'Digit2', '@': 'Digit2',
  '3': 'Digit3', '#': 'Digit3',
  '4': 'Digit4', '$': 'Digit4',
  '5': 'Digit5', '%': 'Digit5',
  '6': 'Digit6', '^': 'Digit6',
  '7': 'Digit7', '&': 'Digit7',
  '8': 'Digit8', '*': 'Digit8',
  '9': 'Digit9', '(': 'Digit9',
  '0': 'Digit0', ')': 'Digit0',
  '-': 'Minus', '_': 'Minus',
  '=': 'Equal', '+': 'Equal',
  'q': 'KeyQ', 'Q': 'KeyQ',
  'w': 'KeyW', 'W': 'KeyW',
  'e': 'KeyE', 'E': 'KeyE',
  'r': 'KeyR', 'R': 'KeyR',
  't': 'KeyT', 'T': 'KeyT',
  'y': 'KeyY', 'Y': 'KeyY',
  'u': 'KeyU', 'U': 'KeyU',
  'i': 'KeyI', 'I': 'KeyI',
  'o': 'KeyO', 'O': 'KeyO',
  'p': 'KeyP', 'P': 'KeyP',
  '[': 'BracketLeft', '{': 'BracketLeft',
  ']': 'BracketRight', '}': 'BracketRight',
  '\\': 'Backslash', '|': 'Backslash',
  'a': 'KeyA', 'A': 'KeyA',
  's': 'KeyS', 'S': 'KeyS',
  'd': 'KeyD', 'D': 'KeyD',
  'f': 'KeyF', 'F': 'KeyF',
  'g': 'KeyG', 'G': 'KeyG',
  'h': 'KeyH', 'H': 'KeyH',
  'j': 'KeyJ', 'J': 'KeyJ',
  'k': 'KeyK', 'K': 'KeyK',
  'l': 'KeyL', 'L': 'KeyL',
  ';': 'Semicolon', ':': 'Semicolon',
  '\'': 'Quote', '"': 'Quote',
  'z': 'KeyZ', 'Z': 'KeyZ',
  'x': 'KeyX', 'X': 'KeyX',
  'c': 'KeyC', 'C': 'KeyC',
  'v': 'KeyV', 'V': 'KeyV',
  'b': 'KeyB', 'B': 'KeyB',
  'n': 'KeyN', 'N': 'KeyN',
  'm': 'KeyM', 'M': 'KeyM',
  ',': 'Comma', '<': 'Comma',
  '.': 'Period', '>': 'Period',
  '/': 'Slash', '?': 'Slash',
  ' ': 'Space'
};

export class KeyboardView {
  constructor(containerEl, handsContainerEl, fingerHintEl) {
    this.container = containerEl;
    this.handsContainer = handsContainerEl;
    this.fingerHint = fingerHintEl;
    this.keyElements = new Map();
    this.activeTargetChar = null;
    this.capsLockActive = false;

    this.renderKeyboard();
    this.renderHands();
  }

  renderKeyboard() {
    this.container.innerHTML = '';
    const boardEl = document.createElement('div');
    boardEl.className = 'magic-keyboard';

    Object.keys(KEYBOARD_LAYOUT).forEach(rowKey => {
      const row = KEYBOARD_LAYOUT[rowKey];
      const rowEl = document.createElement('div');
      rowEl.className = 'keyboard-row';

      row.forEach(key => {
        const keyEl = document.createElement('div');
        keyEl.className = 'magic-key';
        keyEl.dataset.code = key.code;
        keyEl.style.flex = `${key.width} 0 0`;

        if (key.special) keyEl.classList.add(`key-${key.special}`);

        // Tactile bump on F and J (Apple Magic Keyboard feature)
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

  renderHands() {
    if (!this.handsContainer) return;
    this.handsContainer.innerHTML = `
      <div class="hands-display">
        <!-- Left Hand -->
        <div class="hand-wrapper hand-left" id="hand-left">
          <div class="hand-label">LEFT HAND</div>
          <svg class="hand-svg" viewBox="0 0 160 140">
            <!-- Palm -->
            <path class="palm-shape" d="M 30,85 C 30,120 70,135 110,135 C 135,135 145,115 140,85 C 135,65 110,65 105,75 C 95,80 50,75 30,85 Z" />
            <!-- Fingers -->
            <rect id="finger-left-pinky" class="finger-pill" x="20" y="38" width="16" height="52" rx="8" />
            <rect id="finger-left-ring" class="finger-pill" x="44" y="16" width="18" height="74" rx="9" />
            <rect id="finger-left-middle" class="finger-pill" x="70" y="8" width="19" height="82" rx="9.5" />
            <rect id="finger-left-index" class="finger-pill" x="97" y="18" width="18" height="72" rx="9" />
            <rect id="finger-left-thumb" class="finger-pill finger-thumb" x="120" y="65" width="18" height="48" rx="9" transform="rotate(35 125 75)" />
            <!-- Labels -->
            <text x="28" y="70" class="finger-tag">A</text>
            <text x="53" y="55" class="finger-tag">S</text>
            <text x="79" y="50" class="finger-tag">D</text>
            <text x="106" y="55" class="finger-tag">F</text>
            <text x="135" y="95" class="finger-tag">␣</text>
          </svg>
        </div>

        <!-- Dynamic Finger Instructions Indicator -->
        <div class="finger-instruction-pill" id="finger-instruction-pill">
          <span class="finger-pulse-dot"></span>
          <span class="finger-instruction-text" id="finger-hint-text">Place fingers on home row (A S D F & J K L ;)</span>
        </div>

        <!-- Right Hand -->
        <div class="hand-wrapper hand-right" id="hand-right">
          <div class="hand-label">RIGHT HAND</div>
          <svg class="hand-svg" viewBox="0 0 160 140">
            <!-- Palm -->
            <path class="palm-shape" d="M 130,85 C 130,120 90,135 50,135 C 25,135 15,115 20,85 C 25,65 50,65 55,75 C 65,80 110,75 130,85 Z" />
            <!-- Fingers -->
            <rect id="finger-right-thumb" class="finger-pill finger-thumb" x="22" y="65" width="18" height="48" rx="9" transform="rotate(-35 35 75)" />
            <rect id="finger-right-index" class="finger-pill" x="45" y="18" width="18" height="72" rx="9" />
            <rect id="finger-right-middle" class="finger-pill" x="71" y="8" width="19" height="82" rx="9.5" />
            <rect id="finger-right-ring" class="finger-pill" x="98" y="16" width="18" height="74" rx="9" />
            <rect id="finger-right-pinky" class="finger-pill" x="124" y="38" width="16" height="52" rx="8" />
            <!-- Labels -->
            <text x="25" y="95" class="finger-tag">␣</text>
            <text x="54" y="55" class="finger-tag">J</text>
            <text x="80" y="50" class="finger-tag">K</text>
            <text x="107" y="55" class="finger-tag">L</text>
            <text x="132" y="70" class="finger-tag">;</text>
          </svg>
        </div>
      </div>
    `;
  }

  highlightTarget(char) {
    this.activeTargetChar = char;
    // Clear all existing target classes
    this.container.querySelectorAll('.key-target, .key-shift-target').forEach(el => {
      el.classList.remove('key-target', 'key-shift-target', 'finger-pinky', 'finger-ring', 'finger-middle', 'finger-index', 'finger-thumb');
    });

    // Clear finger highlights in SVG
    if (this.handsContainer) {
      this.handsContainer.querySelectorAll('.finger-pill.active').forEach(el => {
        el.classList.remove('active', 'accent-pinky', 'accent-ring', 'accent-middle', 'accent-index', 'accent-thumb');
      });
    }

    if (!char) {
      if (this.fingerHint) this.fingerHint.textContent = 'Ready';
      return;
    }

    const code = CHAR_TO_CODE[char];
    const fingerInfo = FINGER_MAP[char];

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
    }

    // Highlight finger in hand diagram
    if (fingerInfo && this.handsContainer) {
      let fingerEl = null;
      if (fingerInfo.finger === 'thumb') {
        fingerEl = document.getElementById('finger-right-thumb') || document.getElementById('finger-left-thumb');
      } else {
        fingerEl = document.getElementById(`finger-${fingerInfo.hand}-${fingerInfo.finger}`);
      }

      if (fingerEl) {
        fingerEl.classList.add('active', `accent-${fingerInfo.finger}`);
      }

      const hintText = document.getElementById('finger-hint-text');
      if (hintText) {
        const charDisplay = char === ' ' ? 'Space' : `"${char}"`;
        const shiftNote = fingerInfo.shift ? ` (+ ${fingerInfo.hand === 'left' ? 'Right' : 'Left'} Shift)` : '';
        hintText.innerHTML = `<strong>${fingerInfo.label}</strong> to press <strong>${charDisplay}</strong>${shiftNote}`;
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

  setCapsLock(active) {
    this.capsLockActive = active;
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
