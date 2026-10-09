import { layouts, tracks, settings, palettes } from './content.mjs';

export const DOM = {
    html: 1,
    append: 2,
    text: 3,
    attr: 4,
    style: 5,
    remove: 6,
    focus: 7,
    dialog: 8,
    geometry: 9,
    download: 19,
    png: 20
};

export const events = Object.fromEntries([
    'test', 'lessons', 'quote', 'custom', 'history', 'settings', 'close', 'restart',
    'repeat', 'missed', 'weak', 'pair', 'nextLesson', 'nextDrill', 'suggested', 'lesson',
    'track', 'setting', 'backup', 'retrySave', 'recovery', 'demo', 'demoToggle',
    'demoNext', 'demoPractice', 'focus', 'download', 'mute', 'appearance', 'continue',
    'customStart', 'customInput', 'customQuote', 'keydown', 'keyup', 'input',
    'inputFocus', 'inputBlur', 'paste', 'compositionStart', 'compositionEnd',
    'dialogCancel', 'dialogPointer', 'dialogClick', 'visibility', 'resize', 'globalKey',
    'beforeInput'
].map((name, index) => [name, index + 1]));

export const listeners = [
    ...Object.keys(events).slice(0, 30).map(name => ({
        selector: `${name === 'setting' ? 'button' : ''}[data-event="${name}"]`,
        type: 'click',
        event: events[name],
        flags: 0
    })),
    {
        selector: 'form[data-event="customStart"]',
        type: 'submit',
        event: events.customStart,
        flags: 0
    },
    {
        selector: '[data-event="customInput"]',
        type: 'input',
        event: events.customInput,
        flags: 0
    },
    {
        selector: '[data-event="customQuote"]',
        type: 'click',
        event: events.customQuote,
        flags: 0
    },
    {
        selector: 'select[data-event="setting"],input[data-event="setting"]',
        type: 'change',
        event: events.setting,
        flags: 0
    },
    { selector: '#volume', type: 'input', event: events.setting, flags: 0 },
    ...['keydown', 'keyup', 'input', 'paste', 'compositionStart', 'compositionEnd']
        .map(name => ({
        selector: '#bf-input',
        type: name.toLowerCase(),
        event: events[name],
        flags: 0
    })),
    { selector: '#bf-input', type: 'focus', event: events.inputFocus, flags: 1 },
    { selector: '#bf-input', type: 'blur', event: events.inputBlur, flags: 1 },
    { selector: '#bf-input', type: 'beforeinput', event: events.beforeInput, flags: 0 },
    { selector: '#bf-modal', type: 'cancel', event: events.dialogCancel, flags: 1 },
    { selector: '#bf-modal', type: 'pointerdown', event: events.dialogPointer, flags: 0 },
    { selector: '#bf-modal', type: 'click', event: events.dialogClick, flags: 0 },
    { selector: 'document', type: 'visibilitychange', event: events.visibility, flags: 0 },
    { selector: 'window', type: 'resize', event: events.resize, flags: 0 },
    { selector: 'document', type: 'keydown', event: events.globalKey, flags: 0 }
];

const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const paths = {
    mark: 'M4 9h10 M8 5v10.5c0 2.5 1.5 3.5 4 3.5h2 M19 5v14',
    keyboard: 'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z M6 10h2 M11 10h2 M16 10h2 M7 14h10',
    settings: 'M4 7h4 M12 7h8 M4 17h8 M16 17h4 M8 4h4v6H8Z M12 14h4v6h-4Z',
    restart: 'M4.5 9a8 8 0 1 1 .5 8 M4.5 4v5h5',
    history: 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M9 8h6 M9 12h6 M9 16h3',
    appearance: 'M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
    sound: 'M3.5 9h4L12 5v14l-4.5-4h-4Z M16 8.5a5 5 0 0 1 0 7 M19 5.5a9 9 0 0 1 0 13',
    muted: 'M3.5 9h4L12 5v14l-4.5-4h-4Z M16 8.5l6 6 M22 8.5l-6 6',
    next: 'M9 6l6 6-6 6',
    close: 'M5.5 5.5l13 13 M18.5 5.5l-13 13'
};

export function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
        `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ` +
        `focusable="false"><path d="${paths[name]}"></path>` +
        (name === 'appearance' ? '<path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" ' +
            'fill="currentColor" stroke="none"></path>' : '') + '</svg>';
}

function button(label, event, attributes = '') {
    return `<button type="button" data-event="${event}" ${attributes}>${label}</button>`;
}

function choice(label, event, value = '', name = '') {
    return button(escape(label), event, `class="choice" aria-pressed="false" ` +
        `data-value="${escape(value)}" data-name="${escape(name)}"`);
}

function settingChoices(name, options, labels = options) {
    return '<div class="setting-choices">' + options.map((value, index) =>
        choice(labels[index], 'setting', value, name)).join('') + '</div>';
}

export function keyboardHTML(layout) {
    return '<div class="magic-keyboard">' + Object.values(layout.rows).map(row =>
        '<div class="keyboard-row">' + row.map(key => {
            if (!key.code) return `<div class="keyboard-spacer" style="flex:${key.width} ` +
                '0 0"></div>';
            const outline = key.isoStem ? '<svg class="iso-enter-outline" ' +
                'viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">' +
                `<polygon points="${layout.positions[key.code].card.outline.map(point =>
                    point.join(',')).join(' ')}" vector-effect="non-scaling-stroke">` +
                '</polygon></svg>' : '';
            return `<div class="magic-key${key.special ? ` key-${key.special}` : ''}` +
                `${key.isoStem ? ' key-iso-enter' : ''}" data-code="${key.code}" ` +
                `style="flex:${key.width} 0 0">${outline}` +
                (key.bump ? '<span class="tactile-bump"></span>' : '') +
                (key.code === 'CapsLock' ? '<span class="caps-led"></span>' : '') +
                '<div class="key-labels">' +
                (key.shiftLabel ? `<span class="key-shift-label">${escape(key.shiftLabel)}`
                    +
                    '</span>' : '') +
                `<span class="key-main-label">${escape(key.label)}</span>` +
                (key.sublabel ? `<span class="key-sub-label">${escape(key.sublabel)}` +
                    '</span>' : '') + '</div></div>';
        }).join('') + '</div>').join('') + '</div>';
}

const fingerShapes = [
    ['pinky', 23, 81, 'M19 119 10 80C6 63 27 58 32 75L46 117Q34 112 19 119Z',
        'M20 99 32 95'],
    ['ring', 49, 53, 'M50 117 36 51C32 33 55 28 60 47L77 109Q64 105 50 117Z',
        'M47 82 60 79'],
    ['middle', 83, 39, 'M81 107 69 36C66 17 90 14 94 33L108 106Q95 101 81 107Z',
        'M79 73 92 71'],
    ['index', 128, 55, 'M116 110 114 53C112 34 135 30 139 49L154 126Q134 111 116 110Z',
        'M124 86 137 83'],
    ['thumb', 188, 117, 'M155 153 181 109C190 94 209 104 201 121L183 158Q171 167 155 153Z',
        'M168 137 179 144']
];
const handOutline =
    'M57 220C58 199 39 188 30 166C24 153 22 137 19 119L10 80C6 63 27 58 32 75L47 119Q52 124 50 117L36 51C32 33 55 28 60 47L77 109Q82 115 81 107L69 36C66 17 90 14 94 33L108 106Q113 114 116 110L114 53C112 34 135 30 139 49L154 126C158 138 163 140 168 131L181 109C190 94 209 104 201 121L183 158Q172 186 149 200L149 220';

export function handsHTML(layout) {
    const home = Array.from(layout.homeKeys.toUpperCase());
    return '<div class="hands-display">' + ['left', 'right'].map(hand => {
            const left = hand === 'left';
            const letters = [...(left ? home.slice(0, 4) : home.slice(4).reverse()), '␣'];
            const description = fingerShapes.slice(0, 4).map(([finger], index) =>
                `${finger} ${letters[index] === ';' ? 'semicolon' : letters[index]}`).join(
                ', ');
            return `<div class="hand-wrapper hand-${hand}"><svg class="hand-svg" ` +
                'viewBox="0 -18 220 244" role="img" ' +
                `aria-label="${left ? 'Left' : 'Right'} hand: ${escape(description)}; ` +
                'thumb Space.">' +
                `<g transform="${left ? '' : 'translate(220 0) scale(-1 1)'}">` +
                `<path class="hand-outline" d="${handOutline}"></path>` +
                fingerShapes.map(([name, x, y, path, joint], index) =>
                    `<g id="finger-${hand}-${name}" class="finger-pill accent-${name}" ` +
                    `data-home-key="${escape(letters[index])}">` +
                    `<path class="finger-shape" d="${path}"></path>` +
                    `<path class="finger-joint" d="${joint}"></path>` +
                    `<rect class="finger-nail" x="${x - 9}" y="${y - 12}" width="18" ` +
                    'height="23" rx="7"></rect>' +
                    `<text class="finger-tag" x="${x}" y="${y + 5}" ` +
                    `transform="${left ? '' : `translate(${x * 2} 0) scale(-1 1)`}">` +
                    `${escape(letters[index])}</text>` +
                    (name === 'index' ? `<path class="home-bump" d="M${x - 4} ${y + 8}` +
                        'h8"></path>' : '') + '</g>').join('') +
                '<path class="hand-detail" d="M48 139Q79 127 112 137M119 131Q137 149 136 178' +
                'M62 204Q97 211 134 204"></path></g></svg>' +
                `<div class="hand-label">${left ? 'Left' : 'Right'} hand <span>` +
                `${escape((left ? home.slice(0, 4) : home.slice(4)).join(' '))}</span>` +
                '</div></div>';
        }).join('') + '<div class="finger-instructions">' +
        '<p class="finger-instruction-text" id="finger-hint-text">' +
        `${escape(layout.restHint)}</p><p class="hand-rest-note">` +
        'Reach for the next key, then return home · Feel the bumps under your index fingers' +
        '</p></div></div>';
}

export const keyboards = layouts.map(keyboardHTML);
export const hands = layouts.map(handsHTML);
export const lessonButtons = layouts.map(layout => Object.fromEntries(tracks.map(track => [track.id,
    layout.lessons[track.id].map(lesson => button(
        `<span class="lesson-number">${lesson.number}</span><span><strong>` +
        `${escape(lesson.shortTitle)}</strong><small>` +
        `${escape(lesson.id === 'amat-intro' ? 'Optional introduction' : lesson.subtitle)}`
        +
        '</small></span><span class="lesson-stars" role="img" ' +
        'aria-label="Earned stars: 0 of 3">☆☆☆</span>', 'lesson',
        `data-track="${track.id}" data-value="${lesson.index}" ` +
        `data-lesson="${lesson.id}"`))])));

export const cards = layouts.map(layout => {
    const colors = palettes.mint.dark;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="780" ' +
        'viewBox="0 0 1200 780" id="bf-card" ' +
        `style="${['bg', 'surface', 'border', 'text', 'muted', 'accent', 'error'].map(name =>
            `--${name}:${colors[name]}`).join(';')}">` +
        '<rect width="1200" height="780" fill="var(--bg)"></rect>' +
        `<path d="${paths.mark}" transform="translate(60 56) scale(2)" ` +
        'stroke="var(--accent)" stroke-width="2.25" stroke-linecap="round" ' +
        'stroke-linejoin="round" fill="none"></path>' +
        '<g fill="var(--text)" font-family="sans-serif"><text x="120" y="94" ' +
        'font-size="44">Typeflow</text><text x="60" y="138" font-size="22" ' +
        'fill="var(--muted)">Learn touch typing, one key at a time.</text>' +
        '<text x="60" y="183" font-size="19" fill="var(--muted)" ' +
        'font-family="monospace" id="bf-card-title"></text><text x="60" y="288" ' +
        'font-size="86" fill="var(--accent)" font-family="monospace" ' +
        'id="bf-card-wpm"></text><text x="450" y="288" font-size="66" ' +
        'font-family="monospace" id="bf-card-accuracy"></text><text x="875" y="288" ' +
        'font-size="38" font-family="monospace" id="bf-card-time"></text>' +
        '<g font-size="18" font-family="monospace" fill="var(--muted)">' +
        '<text x="60" y="326">WPM</text><text x="450" y="326">ACCURACY</text>' +
        '<text x="875" y="326">TIME</text></g><text x="60" y="385" font-size="23">' +
        `Your session key map · ${escape(layout.label)}</text>` +
        '<g font-size="17"><text x="60" y="415" fill="var(--accent)">● Clean</text>' +
        '<text x="185" y="415" fill="var(--error)">● Errors · stronger color means a ' +
        'higher rate</text><text x="605" y="415" fill="var(--muted)">○ Not tried</text>' +
        '</g></g><rect x="60" y="430" width="1080" height="270" rx="18" ' +
        'fill="var(--surface)"></rect>' + Object.values(layout.rows).flat().filter(key =>
            key.code).map(key => {
            const geometry = layout.positions[key.code].card;
            const attributes = key.isoStem ? `points="${geometry.outline.map(([x, y]) =>
                `${geometry.x + x * geometry.width},${geometry.y + y * geometry.height}`)
                .join(' ')}"` : `x="${geometry.x}" y="${geometry.y}" ` +
                `width="${geometry.width}" height="42" rx="7"`;
            const tag = key.isoStem ? 'polygon' : 'rect';
            return `<g data-card-code="${key.code}"><${tag} ${attributes} ` +
                `fill="var(--bg)"></${tag}><${tag} ${attributes} fill="var(--accent)" `
                +
                'fill-opacity="0" stroke="var(--border)" stroke-width="1" ' +
                `class="card-key-heat"></${tag}><text x="${geometry.x + geometry.width / 2}" `
                +
                `y="${geometry.y + 27}" text-anchor="middle" font-family="monospace" ` +
                `font-size="${key.special ? 13 : 18}" fill="var(--text)">` +
                `${escape(key.code === 'Space' ? 'space' : key.label)}</text></g>`;
        }).join('') + '<text x="60" y="746" font-size="20" font-family="monospace" ' +
        'fill="var(--muted)">https://o1tean.github.io/apple-typing-tutor/</text></svg>';
});

export const templates = {
    shell: `<div class="app lesson-mode" id="bf-app"><header class="header">` +
        button(`<span class="brand-mark">${icon('mark')}</span><span>` +
            '<small>find your typing flow</small><strong>typeflow' +
            '<span class="brand-period">.</span></strong></span>', 'test',
            'class="brand" aria-label="Typeflow home"') +
        '<nav class="navigation" aria-label="Practice">' + ['test', 'learn', 'quote', 'custom']
        .map(name => choice(name,
            name === 'learn' ? 'lessons' : name)).join('') +
        '</nav><div class="header-actions">' +
        button(icon('history'), 'history',
            'class="icon-button" aria-label="Session history" title="Session history"') +
        button(icon('settings'), 'settings',
            'class="icon-button" aria-label="Settings" title="Settings (Esc)"') +
        '</div></header><main class="main"><div class="test-toolbar" id="bf-toolbar">' +
        '</div><div id="bf-learning"></div><div id="bf-body"></div>' +
        '<div class="restart-row" id="bf-restart-row">' +
        button(icon('restart'), 'restart', 'class="icon-button restart-button" ' +
            'aria-label="Restart test" title="Restart test (Tab + Enter)"') +
        '</div><section class="guidance" aria-label="Typing guides" id="bf-guidance">' +
        '<div class="hands-container" id="bf-hands"></div>' +
        '<div class="keyboard-container" id="bf-keyboard" aria-hidden="true"></div>' +
        '</section><div class="shortcuts" id="bf-shortcuts"><span><kbd>tab</kbd> + ' +
        '<kbd>enter</kbd> <span id="bf-restart-help">restart test</span></span><span>' +
        '<kbd>esc</kbd> settings</span></div><p class="sr-only" role="status" ' +
        'id="bf-announcement"></p></main><footer class="footer"><span>' +
        '<span class="small-dot"></span> made for your daily practice</span><div>' +
        button(`${icon('sound')} sound <span id="bf-sound-state">on</span>`, 'mute') +
        button(`${icon('appearance')} appearance`, 'appearance') +
        '<span role="status" class="local-note" id="bf-save-state">saved on this device' +
        '</span>' + button('Keep my progress', 'recovery', 'id="bf-recovery-button" hidden') +
        '<details class="offline-status"><summary><span role="status" ' +
        'id="bf-offline-state">Preparing offline lessons…</span></summary>' +
        '<p id="bf-offline-description">Preparing lessons for this device. Keep Typeflow ' +
        'online until setup finishes.</p></details></div></footer><div id="bf-dialog">' +
        '</div><div id="bf-card-host" hidden aria-hidden="true"></div></div>',

    testToolbar: '<div class="toolbar-group toggles">' +
        choice('punctuation', 'setting', 'toggle', 'punctuation') +
        choice('numbers', 'setting', 'toggle', 'numbers') +
        '</div><span class="divider"></span><div class="toolbar-group">' +
        choice('time', 'setting', 'time', 'testMode') +
        choice('words', 'setting', 'words', 'testMode') +
        '</div><span class="divider"></span><div class="toolbar-group counts" ' +
        'role="group" id="bf-test-counts"></div>',

    lessonToolbar: button('Change lesson', 'lessons', 'class="text-button"') +
        button('Skip to test', 'test', 'class="text-button skip-to-test"'),

    customToolbar: '<span class="exercise-title" id="bf-exercise-title"></span>' +
        button('Edit text', 'custom', 'class="text-button"'),

    exerciseToolbar: '<span class="exercise-title" id="bf-exercise-title"></span>',

    test: '<section class="test" id="bf-test"><div class="test-heading"><div>' +
        '<p class="eyebrow" id="bf-eyebrow"></p><h1 id="bf-heading"></h1></div>' +
        '<div class="live-stats" role="group" aria-label="Live statistics" ' +
        'id="bf-live-stats"><strong><span class="sr-only" id="bf-time-label">' +
        'Elapsed time: </span><span id="bf-time">0</span><small aria-hidden="true">s' +
        '</small><span class="sr-only"> seconds</span></strong><span>' +
        '<span id="bf-wpm">0</span> <small aria-hidden="true">wpm</small>' +
        '<span class="sr-only"> words per minute</span></span><span>' +
        '<span id="bf-accuracy">100</span><small aria-hidden="true">%</small>' +
        '<span class="sr-only"> percent accuracy</span></span></div></div>' +
        '<p class="keyboard-notice">Best with a physical keyboard. Connect one to follow ' +
        'the finger guide. Onscreen keyboards do not teach finger placement. ' +
        button('Watch a demo', 'demo', 'class="text-button" id="bf-watch-demo"') +
        '</p><div id="bf-instructions"></div><div id="bf-session"></div></section>',

    lessonInstructions: '<aside class="lesson-instructions" aria-label="Lesson ' +
        'instructions"><p id="bf-lesson-description"></p><p><strong>Practice keys:' +
        '</strong> <span id="bf-practice-keys"></span></p><details class="lesson-goal">' +
        '<summary>Lesson targets</summary>3 stars: <span id="bf-lesson-goal"></span>' +
        '</details></aside>',

    adaptiveInstructions: '<aside class="lesson-instructions" aria-label="Adaptive ' +
        'practice instructions"><p>Slow down and aim for accuracy. Your next drill ' +
        'changes as you improve.</p><ul class="focus-chips" id="bf-focus-chips"></ul>' +
        '</aside>',

    arena: '<div class="arena-meta"><span class="language" id="bf-language">english ' +
        '<span class="small-dot"></span> <span id="bf-mode-label">guided</span></span>' +
        '<span><span role="status" id="bf-caps-notice"></span><span id="bf-position">' +
        '</span></span></div><div class="arena focused" data-event="focus" id="bf-arena">' +
        '<p class="sr-only" id="exercise-prompt"></p><div class="text-viewport" ' +
        'aria-hidden="true"><div class="typing-text" id="bf-text"></div></div>' +
        '<textarea class="typing-input" aria-label="Typing input" ' +
        'aria-describedby="exercise-prompt typing-help typing-feedback" ' +
        'autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" ' +
        'data-event="typing" id="bf-input"></textarea>' +
        button(`${icon('keyboard')} <span id="bf-focus-label">click here to start typing` +
            '</span>', 'focus', 'class="focus-prompt" id="bf-focus-prompt" hidden') +
        '</div><p class="arena-help" id="typing-help">Take your time. Each correct key ' +
        'moves you forward.</p><p class="arena-help" id="bf-quote-source" hidden></p>' +
        '<p class="sr-only" id="typing-feedback" role="status"></p>',

    phoneDemo: '<section class="phone-demo" aria-label="Finger demo"><h2>Finger demo' +
        '</h2><p>Reach, then return home.</p><p class="demo-letters" aria-hidden="true" ' +
        'id="bf-demo-letters"></p><p class="demo-target">Key: <output ' +
        'aria-label="Demo target" aria-live="off" id="bf-demo-target"></output></p>' +
        '<div class="demo-actions">' +
        button('Pause demo', 'demoToggle', 'class="text-button" id="bf-demo-toggle"') +
        button('Next key', 'demoNext', 'class="text-button"') +
        button('Try this lesson', 'demoPractice', 'class="primary-button"') +
        '</div><div class="hands-container" id="bf-demo-hands"></div>' +
        '<div class="keyboard-container" aria-hidden="true" id="bf-demo-keyboard">' +
        '</div><p class="field-help" id="bf-demo-help">This demo does not save progress.' +
        '</p></section>',

    learningPrompt: '<aside class="learning-prompt lesson-instructions" ' +
        'aria-label="Return to learning"><div class="learning-return" ' +
        'id="bf-learning-return" hidden><div><strong id="bf-latest-lesson"></strong>' +
        '<p>Start a fresh drill from your latest recorded lesson.</p></div>' +
        button('Continue lesson', 'continue', 'class="primary-button"') + '</div>' + ['keys',
            'bigrams'].map((group, index) => '<div><details><summary>Suggested ' +
            `${index ? 'pair' : 'key'} practice</summary><section aria-label="` +
            `${index ? 'Pair recommendation' : 'Learning recommendation'}" ` +
            `id="bf-recommendation-${group}"></section></details>` +
            button(index ? 'Practice this pair' : 'Practice weak keys', index ? 'pair' :
                'weak', `class="text-button" id="bf-practice-${group}" hidden`) +
            '</div>').join('') + '</aside>',

    dialog: '<dialog class="dialog" aria-labelledby="dialog-title" id="bf-modal">' +
        '<div class="dialog-heading"><h2 id="dialog-title"></h2>' +
        button(icon('close'), 'close', 'class="icon-button" aria-label="Close dialog"') +
        '</div><div id="bf-dialog-body"></div></dialog>',

    settings: '<div class="settings"><fieldset><legend>Keyboard layout</legend>' +
        '<select class="layout-select" aria-label="Keyboard layout" ' +
        'aria-describedby="layout-help" data-event="setting" ' +
        'data-name="keyboardLayout" id="bf-layout">' + layouts.map(layout =>
            `<option value="${layout.id}">${escape(layout.label)}</option>`).join('') +
        '</select><p id="layout-help"></p></fieldset><fieldset><legend>Typing behavior' +
        '</legend>' + settingChoices('typingMode', [...settings.typingMode].reverse(),
        ['Free flow', 'Guided']) + '<p>Free flow accepts mistakes. Guided waits for the ' +
        'correct key. Changing behavior restarts the test.</p></fieldset><fieldset>' +
        '<legend>Appearance</legend>' + settingChoices('theme', settings.theme) +
        '</fieldset><fieldset><legend>Color palette</legend>' +
        settingChoices('colorPalette', settings.colorPalette, ['Mint', 'Ocean', 'Plum']) +
        '<p>Each palette works with light, dark, or system appearance.</p></fieldset>' +
        '<fieldset><legend>Keyboard sound</legend>' +
        settingChoices('soundProfile', settings.soundProfile) +
        '<label class="setting-row">Enable sound<input type="checkbox" ' +
        'data-event="setting" data-name="soundEnabled" id="bf-enable-sound"></label>' +
        '<label class="volume-label" for="volume">Volume <span id="bf-volume-label">' +
        '60%</span></label><input id="volume" type="range" min="0" max="100" ' +
        'data-event="setting" data-name="volume"></fieldset><fieldset><legend>' +
        'Practice guides</legend><label class="setting-row">Show keyboard' +
        '<input type="checkbox" data-event="setting" data-name="showKeyboard" ' +
        'id="bf-show-keyboard"></label><label class="setting-row">Show finger guidance' +
        '<input type="checkbox" data-event="setting" data-name="showHands" ' +
        'id="bf-show-hands"></label></fieldset><fieldset><legend>Saved progress</legend>' +
        '<p>Keep a backup of your device-local progress, or recover sessions when saving ' +
        'is unavailable.</p>' + button('Manage saved progress', 'recovery',
            'class="text-button"') + '</fieldset>' + button('Back to typing', 'close',
            'class="primary-button"') + '</div>',

    custom: '<form data-event="customStart"><label class="field-label" ' +
        'for="custom-text">Text to practice</label><textarea id="custom-text" rows="7" ' +
        'maxlength="10000" autofocus data-event="customInput" placeholder="Paste a ' +
        'passage, a paragraph, or something you want to remember."></textarea>' +
        '<p class="field-help">Up to 10,000 characters. Line breaks become spaces. ' +
        'Invisible break markers are removed.</p><div class="dialog-actions">' +
        button('Try a quote', 'customQuote', 'class="text-button"') +
        '<button type="submit" class="primary-button" id="bf-custom-start">' +
        'Start practice</button></div></form>',

    lessons: '<div class="setting-choices lesson-tracks">' + tracks.map(track =>
            choice(track.label, 'track', track.id)).join('') +
        '</div><section class="lesson-instructions" aria-label="Saved track progress">' +
        '<p><strong id="bf-track-progress"></strong></p><p>Saved progress shared across ' +
        'layouts.</p></section><aside class="lesson-path lesson-instructions" ' +
        'aria-label="Suggested lesson"><p>Suggested lesson</p><strong ' +
        'id="bf-suggested-title"></strong><p id="bf-suggested-reason"></p>' +
        button('Start suggested lesson', 'suggested', 'class="primary-button"') +
        '</aside><div class="lesson-list" id="bf-lesson-list"></div>',

    recovery: '<div><p class="field-help" id="bf-recovery-advice"></p>' +
        '<p class="field-help">The backup includes current progress, sessions waiting ' +
        'to save, and readable saved data.</p><div class="dialog-actions">' +
        button('Download backup', 'backup', 'class="primary-button" id="bf-backup"') +
        button('Try saving again', 'retrySave', 'class="text-button" ' +
            'id="bf-retry-save" hidden') + '</div><p class="field-help" role="status" ' +
        'id="bf-recovery-status"></p><details class="field-help"><summary>' +
        'View backup text</summary><p>If downloading is unavailable, select all this ' +
        'text and copy it into a file to keep your backup.</p><textarea id="backup-text" ' +
        'aria-label="Backup JSON" rows="8" readonly></textarea></details></div>',

    emptyHistory: '<div class="empty-state"><h3>Your first session is waiting.</h3>' +
        '<p>Finish a lesson or test to start tracking your progress.</p>' +
        button("Let's type", 'close', 'class="primary-button"') + '</div>',

    history: '<div id="bf-history-progress"></div><p class="field-help">Earlier scores ' +
        'keep their original values. Personal bests compare scores using the same method.' +
        '</p><div class="history-table"><table><caption id="bf-history-caption">' +
        '</caption><thead><tr><th scope="col">test</th><th scope="col">wpm / raw</th>' +
        '<th scope="col">accuracy</th><th scope="col">time</th><th scope="col">date' +
        '</th></tr></thead><tbody id="bf-history-rows"></tbody></table></div>',

    progress: '<section class="practice-progress" aria-label="Practice progress">' +
        '<dl class="progress-streaks"><div><dt>Current streak</dt>' +
        '<dd id="bf-current-streak"></dd></div><div><dt>Longest saved streak</dt>' +
        '<dd id="bf-longest-streak"></dd></div></dl><p class="field-help">Consecutive ' +
        'local days with a recorded session. Your current streak stays active if you ' +
        'practiced today or yesterday. Based on retained sessions; older activity may ' +
        'be missing.</p><h3>Last 14 days</h3><p class="field-help" ' +
        'id="progress-description">Daily session averages across all exercises and ' +
        'input modes. Gaps mean no measured session with current scoring; they are not ' +
        'zero scores.</p><div class="progress-charts" id="bf-progress-charts"></div>' +
        '<p class="field-help" id="bf-progress-note" hidden></p><details><summary>' +
        'View daily averages</summary><table><caption>Daily practice · local dates' +
        '</caption><thead><tr><th scope="col">Date</th><th scope="col">Sessions</th>' +
        '<th scope="col">WPM</th><th scope="col">Accuracy</th></tr></thead>' +
        '<tbody id="bf-daily-rows"></tbody></table></details></section>',

    results: '<section class="results" aria-label="Test results"><div ' +
        'class="result-heading"><div><p class="eyebrow">a little better, every day</p>' +
        '<h1 id="bf-result-heading"></h1><p class="focus-keys" id="bf-result-advice">' +
        '</p></div><div id="bf-lesson-action"></div><span class="record" ' +
        'id="bf-personal-best" hidden>personal best ↗</span></div>' +
        '<div id="bf-practice-comparison"></div><div class="result-main">' +
        '<div class="result-primary"><span>wpm</span><strong id="bf-result-wpm">' +
        '</strong><span>accuracy</span><strong><span id="bf-result-accuracy"></span>' +
        '<small>%</small></strong></div><div class="chart" id="bf-result-chart"></div>' +
        '</div><div class="result-details" id="bf-result-details"></div>' +
        '<p class="field-help">WPM credits correct words and a clean unfinished word. ' +
        'Five characters count as one word. Raw WPM includes mistakes.</p>' +
        '<p class="focus-keys" id="bf-result-focus"></p><div id="bf-result-key-map">' +
        '</div><p class="focus-keys" id="bf-record-reason"></p>' +
        '<p class="focus-keys" role="status" id="bf-result-save"></p>' +
        '<div class="result-actions" id="bf-result-actions"></div>' +
        '<p class="field-help" aria-live="polite" id="bf-download-status"></p></section>',

    keyMap: '<section class="key-map" aria-label="Target-key heatmap"><h2>Your key map' +
        '</h2><p class="field-help" id="bf-key-map-label"></p>' +
        '<div class="keyboard-container" aria-hidden="true" ' +
        'id="bf-heatmap"></div><p class="heat-legend field-help"><span>● Clean</span>' +
        '<span>● Errors — stronger color means a higher rate</span><span>○ Not tried</span>' +
        '</p><details><summary>View key and pair details</summary>' + ['keys', 'bigrams'].map((
                group, index) => '<table><caption>' +
            `${index ? 'Most difficult pairs' : 'Target keys'} · ␣ means Space</caption>` +
            `<thead><tr><th scope="col">${index ? 'Pair' : 'Key'}</th>` +
            '<th scope="col">Attempts</th><th scope="col">Errors</th>' +
            '<th scope="col">Average reach</th></tr></thead>' +
            `<tbody id="bf-key-map-${group}"></tbody></table>`).join('') +
        '</details></section>',

    practiceResults: '<section class="key-map" aria-label="Practice focus results">' +
        '<h2>Your practice focus</h2><p class="field-help">Earlier: weighted recent ' +
        'observations across layouts. This drill: this attempt only.</p><table><thead>' +
        '<tr><th scope="col">Target</th><th scope="col">Earlier recent</th>' +
        '<th scope="col">This drill</th></tr></thead><tbody id="bf-comparison-rows">' +
        '</tbody></table><p class="field-help">Reach excludes pauses and backspace gaps. ' +
        'A short drill is not proof of mastery.</p><div class="learning-return"><div>' +
        '<p id="bf-next-focus"></p><p class="field-help" id="bf-next-focus-advice">' +
        '</p></div>' + button('Start next drill', 'nextDrill', 'class="primary-button" ' +
            'id="bf-next-drill"') + '</div></section>',

    caret: '<span data-index="0" class="char">&nbsp;</span><span class="caret" ' +
        'id="bf-caret"></span>',
    downloadButton: button('Download result card', 'download', 'class="text-button"'),
    weakButton: button('Practice weak keys', 'weak', 'class="text-button"'),
    missedButton: button('Practice missed words', 'missed', 'class="text-button"'),
    repeatButton: button('Repeat this text', 'repeat', 'class="text-button"'),
    newTestButton: button('New test', 'restart', 'class="primary-button"'),
    nextQuoteButton: button(`Next quote ${icon('next')}`, 'restart', 'class="primary-button"'),
    retryButton: button(`Try again ${icon('restart')}`, 'restart', 'class="text-button"'),
    nextLessonButton: button(`Next lesson ${icon('next')}`, 'nextLesson', 'class="text-button"')
};

export const testCounts = {
    time: settings.testDuration.map(value => button(value, 'setting',
        `class="choice" aria-pressed="false" aria-label="${value} seconds" ` +
        `data-name="testDuration" data-value="${value}"`)).join(''),
    words: settings.testWordCount.map(value => button(value, 'setting',
        `class="choice" aria-pressed="false" aria-label="${value} words" ` +
        `data-name="testWordCount" data-value="${value}"`)).join('')
};

export const trendCharts = ['wpm', 'accuracy'].map(metric => {
    const label = metric === 'wpm' ? 'WPM' : 'Accuracy';
    return `<div class="chart"><h4>${label}</h4><div class="chart-grid">` +
        `<div class="chart-y-axis" aria-hidden="true"><span id="bf-${metric}-max">` +
        `</span><span>0${metric === 'accuracy' ? '%' : ''}</span></div>` +
        '<svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" ' +
        `aria-label="${label} daily averages." aria-describedby="progress-description" ` +
        `focusable="false" id="bf-trend-${metric}">` +
        '<line x1="0" x2="100" y1="0" y2="0"></line>' +
        '<line x1="0" x2="100" y1="100" y2="100"></line>' +
        `<g id="bf-trend-points-${metric}"></g></svg><div class="chart-x-axis" ` +
        `aria-hidden="true"><span id="bf-${metric}-first-day"></span>` +
        `<span id="bf-${metric}-last-day"></span></div></div></div>`;
});

export const speedChart = '<p class="chart-caption" id="chart-description">Overall ' +
    'WPM at each recorded time.<span id="bf-sample-note"></span></p>' +
    '<div class="chart-grid"><div class="chart-y-axis" aria-hidden="true">' +
    '<span id="bf-speed-max"></span><span id="bf-speed-half"></span><span>0</span>' +
    '</div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" ' +
    'aria-describedby="chart-description" focusable="false" id="bf-speed-chart">' + [0, 50, 100]
    .map(y => `<line x1="0" x2="100" y1="${y}" y2="${y}" ` +
        'vector-effect="non-scaling-stroke"></line>').join('') +
    '<polyline id="bf-speed-line" vector-effect="non-scaling-stroke"></polyline>' +
    '<g id="bf-speed-points"></g></svg><div class="chart-x-axis" aria-hidden="true">' +
    '<span>0s</span><span id="bf-speed-duration"></span></div></div><details>' +
    '<summary>View speed samples</summary><p id="bf-speed-samples"></p></details>';

export const messages = {
    dialogTitles: {
        settings: 'Make it your own',
        lessons: 'Build your muscle memory',
        custom: 'Your words, your practice',
        history: 'Your recent sessions',
        recovery: 'Keep your progress'
    },
    offline: {
        ready: ['Available offline', 'Lessons work without a connection. You can install ' +
            'Typeflow from your browser menu where supported. Keep this device’s site ' +
            'data to retain lessons and progress.'],
        update: ['Update ready', 'Finish and save your session, then close all Typeflow ' +
            'tabs and reopen to use the update.'],
        preparing: ['Preparing offline lessons…', 'Preparing lessons for this device. ' +
            'Keep Typeflow online until setup finishes.'],
        failed: ['Offline setup unavailable', 'Open Typeflow online in a browser that ' +
            'supports offline apps. Setup retries on your next visit.']
    },
    layoutHelp: {
        ansi: 'Match your operating system’s input source. These ANSI guides use Mac ' +
            'modifier labels and keep Caps Lock unchanged. Changing layout restarts an ' +
            'unfinished practice. Stars and weak-key measurements are shared across layouts.',
        iso: 'Match your operating system’s input source. UK ISO uses Windows UK characters ' +
            'and PC modifier labels. Changing layout restarts an unfinished practice. ' +
            'Stars and weak-key measurements are shared across layouts.'
    },
    keyMap: ' · This session’s target keys, including skipped keys. Average reach measures ' +
        'time between strokes; pauses and backspace gaps are excluded.',
    lessonReasons: [
        'First lesson without a saved completion.',
        'All lessons completed. Work toward 3 stars here.',
        'All 3-star targets earned. Revisit the final lesson.'
    ],
    recommendation: 'Selected from recent errors and relative reach times across layouts.',
    futureProfile: 'Recommendations are unavailable for this newer saved profile. Your ' +
        'progress is preserved.',
    guidedHelp: 'Take your time. Each correct key moves you forward.',
    flowHelp: 'Find your rhythm. Space moves to the next word; backspace corrects mistakes.',
    recovery: {
        conflict: 'Another tab changed your saved progress. Download a backup to preserve ' +
            'both your current sessions and the readable saved data.',
        failed: 'Your latest sessions are in memory. Closing or reloading this page can ' +
            'lose them. Download a backup to keep a copy.',
        pending: 'Your latest sessions are waiting to save. Download a backup to keep ' +
            'them while saving finishes.',
        saved: 'Your progress is saved on this device. Download a backup to keep a ' +
            'separate copy.'
    }
};

export function emitTemplate(builder, name, target = '#root', opcode = DOM.html) {
    if (!Object.hasOwn(templates, name)) throw new Error(`Unknown view template: ${name}`);
    builder.write(opcode);
    builder.writeString(target);
    builder.writeString(templates[name]);
}

export function emitText(builder, target, value) {
    builder.write(DOM.text);
    builder.writeString(target);
    builder.writeString(value);
}

export function emitAttribute(builder, target, name, value) {
    builder.write(DOM.attr);
    builder.writeString(target);
    builder.writeString(name);
    builder.writeString(value);
}

export function emitListeners(builder) {
    for (const listener of listeners) {
        builder.write(28);
        builder.writeString(listener.selector);
        builder.writeString(listener.type);
        builder.write(listener.event);
        builder.write(listener.flags);
    }
}

let selection = 0;

export function emitStatic(builder, values, selected, target, opcode = DOM.html) {
    const match = builder.scalar(`viewMatch${selection++}`);
    values.forEach((value, index) => {
        builder.eq(match, selected, index);
        builder.if(match, () => {
            builder.write(opcode);
            builder.writeString(target);
            builder.writeString(value);
        });
    });
}

export function emitHandle(builder, opcode, target, handle, buffer) {
    builder.write(24);
    builder.write(handle);
    builder.readString(buffer);
    builder.write(opcode);
    builder.writeString(target);
    builder.writeString(buffer);
}
