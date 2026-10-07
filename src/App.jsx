import React, {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { TypingEngine } from '../js/engine.js';
import { CURRICULUM } from '../js/lessons.js';
import { KeyboardView, KEYBOARD_PRESETS } from '../js/keyboard.js';
import { sound } from '../js/audio.js';
import { storage } from '../js/storage.js';
import { isDialogBackdrop } from '../js/dialog.js';
import { resultCard } from '../js/share.js';
import SessionProgress from './Progress.jsx';
import PhoneDemo from './PhoneDemo.jsx';
import OfflineStatus from './OfflineStatus.jsx';
import {
    currentWord,
    formatElapsedTime,
    generateWords,
    generateWeakDrill,
    generateLessonDrill,
    lessonsForLayout,
    focusKeys,
    normalizeCustomText,
    recordSpeedSample,
    resultFeedback,
    sessionLabel,
    typingErrorMessage,
} from '../js/practice.js';

function Icon({ name, ...props }) {
    const paths = {
        mark: 'M4 9h10 M8 5v10.5c0 2.5 1.5 3.5 4 3.5h2 M19 5v14',
        keyboard:
            'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z M6 10h2 M11 10h2 M16 10h2 M7 14h10',
        settings: 'M4 7h4 M12 7h8 M4 17h8 M16 17h4 M8 4h4v6H8Z M12 14h4v6h-4Z',
        restart: 'M4.5 9a8 8 0 1 1 .5 8 M4.5 4v5h5',
        history:
            'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M9 8h6 M9 12h6 M9 16h3',
        appearance: 'M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
        sound: 'M3.5 9h4L12 5v14l-4.5-4h-4Z M16 8.5a5 5 0 0 1 0 7 M19 5.5a9 9 0 0 1 0 13',
        muted: 'M3.5 9h4L12 5v14l-4.5-4h-4Z M16 8.5l6 6 M22 8.5l-6 6',
        next: 'M9 6l6 6-6 6',
        close: 'M5.5 5.5l13 13 M18.5 5.5l-13 13',
    };
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            <path d={paths[name]} />
            {name === 'appearance' && (
                <path
                    d="M12 3.5a8.5 8.5 0 0 0 0 17Z"
                    fill="currentColor"
                    stroke="none"
                />
            )}
        </svg>
    );
}

function practice(settings) {
    const timed = settings.testMode === 'time';
    return {
        track: 'test',
        keyboardLayout: settings.keyboardLayout,
        id:
            `${settings.testMode}-${timed ? settings.testDuration : settings.testWordCount}` +
            `${settings.punctuation ? '-punctuation' : ''}${settings.numbers ? '-numbers' : ''}`,
        title: timed
            ? `${settings.testDuration} second test`
            : `${settings.testWordCount} word test`,
        lines: [generateWords(timed ? 400 : settings.testWordCount, settings)],
        duration: timed ? settings.testDuration : 0,
        options: {
            testMode: settings.testMode,
            testDuration: settings.testDuration,
            testWordCount: settings.testWordCount,
            punctuation: settings.punctuation,
            numbers: settings.numbers,
            typingMode: settings.typingMode,
        },
    };
}

function lessonExercise(track, index, preset) {
    return {
        ...lessonsForLayout(track, preset)[index],
        lines: generateLessonDrill(track, index, undefined, preset),
        keyboardLayout: preset,
        track: 'lesson',
        lessonTrack: track,
        lessonIndex: index,
    };
}

function Choice({ value, selected, children, onClick, ...props }) {
    return (
        <button
            className={`choice ${selected ? 'selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onClick(value)}
            {...props}
        >
            {children}
        </button>
    );
}

function Dialog({ title, onClose, children }) {
    const ref = useRef(null);
    const backdropPressed = useRef(false);
    useEffect(() => {
        const dialog = ref.current;
        dialog.showModal();
        dialog.querySelector('textarea')?.focus();
        return () => dialog.close();
    }, []);
    return (
        <dialog
            ref={ref}
            className="dialog"
            aria-labelledby="dialog-title"
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onPointerDown={(event) => {
                backdropPressed.current = isDialogBackdrop(event);
            }}
            onClick={(event) => {
                if (backdropPressed.current && isDialogBackdrop(event))
                    onClose();
                backdropPressed.current = false;
            }}
        >
            <div className="dialog-heading">
                <h2 id="dialog-title">{title}</h2>
                <button
                    className="icon-button"
                    aria-label="Close dialog"
                    onClick={onClose}
                >
                    <Icon name="close" />
                </button>
            </div>
            {children}
        </dialog>
    );
}

function Guidance({ engine, revision, settings, view, preset }) {
    const keyboard = useRef(null);
    const hands = useRef(null);
    useEffect(() => {
        view.current = new KeyboardView(
            keyboard.current,
            hands.current,
            null,
            preset,
        );
        return () => {
            view.current = null;
        };
    }, [view, preset]);
    useEffect(() => {
        view.current?.highlightTarget(
            engine.isComplete
                ? null
                : (engine.getCurrentChar() ??
                      (engine.mode === 'flow' ? ' ' : null)),
        );
    }, [engine, revision, view, preset]);
    return (
        <section className="guidance" aria-label="Typing guides">
            <div
                ref={hands}
                className="hands-container"
                hidden={!settings.showHands}
            />
            <div
                ref={keyboard}
                className="keyboard-container"
                hidden={!settings.showKeyboard}
                aria-hidden="true"
            />
        </section>
    );
}

const Arena = React.memo(function Arena({
    engine,
    revision,
    exercise,
    input,
    restart,
    view,
    focused,
    setFocused,
    inputFeedback,
    setInputFeedback,
}) {
    const viewport = useRef(null);
    const text = useRef(null);
    const caret = useRef(null);
    const compositionCommitted = useRef(false);
    const [capsLock, setCapsLock] = useState(false);
    const reposition = () => {
        const target = text.current?.querySelector(
            `[data-index="${engine.currentCharIndex}"]`,
        );
        if (!target || !caret.current) return;
        const rect = target.getBoundingClientRect();
        const parent = text.current.getBoundingClientRect();
        const top = rect.top - parent.top;
        const lineHeight = parseFloat(
            getComputedStyle(text.current).lineHeight,
        );
        viewport.current.scrollTop = Math.max(0, top - lineHeight);
        caret.current.style.left = `${rect.left - parent.left}px`;
        caret.current.style.top = `${top + (rect.height - lineHeight * 0.65) / 2}px`;
        caret.current.style.height = `${lineHeight * 0.65}px`;
    };
    useLayoutEffect(reposition, [revision, engine.currentCharIndex, focused]);
    useEffect(() => {
        const observer = new ResizeObserver(reposition);
        observer.observe(viewport.current);
        return () => observer.disconnect();
    }, [engine]);
    useEffect(() => {
        const field = input.current;
        const deleteInput = (event) => {
            if (event.isComposing) return;
            if (
                ['insertLineBreak', 'insertParagraph'].includes(event.inputType)
            ) {
                event.preventDefault();
                return;
            }
            if (
                !['deleteContentBackward', 'deleteWordBackward'].includes(
                    event.inputType,
                )
            )
                return;
            event.preventDefault();
            if (engine.mode === 'flow') setInputFeedback('');
            engine.handleKey({
                key: 'Backspace',
                ctrlKey: event.inputType === 'deleteWordBackward',
            });
        };
        field.addEventListener('beforeinput', deleteInput);
        return () => field.removeEventListener('beforeinput', deleteInput);
    }, [engine, input, setInputFeedback]);

    const keyDown = (event) => {
        const native = event.nativeEvent;
        if (
            native.isComposing ||
            native.keyCode === 229 ||
            event.key === 'Process'
        )
            return;
        if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            restart.current.focus();
            return;
        }
        if (
            event.metaKey ||
            ((event.ctrlKey || event.altKey) &&
                event.key !== 'Backspace' &&
                !event.getModifierState('AltGraph'))
        )
            return;
        view.current?.pressKey(event.code);
        const caps = event.getModifierState('CapsLock');
        view.current?.setCapsLock(caps);
        setCapsLock(caps);
        if (Array.from(event.key).length === 1 || event.key === 'Backspace') {
            event.preventDefault();
            if (event.key !== 'Backspace' || engine.mode === 'flow')
                setInputFeedback('');
            if (!engine.isComplete && !engine.isPaused) sound.playKey();
            engine.handleKey(native);
        }
    };
    const receiveInput = (event) => {
        if (event.nativeEvent.isComposing) return;
        if (
            compositionCommitted.current &&
            /Composition/.test(event.nativeEvent.inputType || '')
        ) {
            compositionCommitted.current = false;
            event.currentTarget.value = '';
            return;
        }
        compositionCommitted.current = event.type === 'compositionend';
        if (event.currentTarget.value) setInputFeedback('');
        for (const key of event.currentTarget.value.normalize('NFC')) {
            if (engine.isComplete || engine.isPaused) break;
            sound.playKey();
            engine.handleKey({ key: /\s/u.test(key) ? ' ' : key });
        }
        event.currentTarget.value = '';
    };
    const words = [];
    let word = [];
    engine.typedChars.forEach((item, index) => {
        word.push(
            <span
                key={index}
                data-index={index}
                className={`char ${item.status} ${item.extra ? 'extra' : ''} ${item.skipped ? 'skipped' : ''}`}
            >
                {item.char === ' ' ? '\u00a0' : item.char}
            </span>,
        );
        if (item.char === ' ' || index === engine.typedChars.length - 1) {
            words.push(
                <span className="word" key={index}>
                    {word}
                </span>,
            );
            word = [];
        }
    });
    const completedWords = engine.typedChars
        .slice(0, engine.currentCharIndex)
        .filter((item) => item.char === ' ').length;
    return (
        <>
            <div className="arena-meta">
                <span className="language">
                    {exercise.track === 'custom' || exercise.track === 'retry'
                        ? 'your text'
                        : 'english'}{' '}
                    <span className="small-dot" />
                    {engine.mode === 'flow' ? 'free flow' : 'guided'}
                </span>
                <span>
                    <span role="status">
                        {capsLock ? 'caps lock is on' : ''}
                    </span>
                    {!capsLock &&
                        (exercise.track === 'test' && !exercise.duration
                            ? `${completedWords} / ${exercise.options.testWordCount} words`
                            : exercise.track === 'lesson'
                              ? `line ${engine.currentLineIndex + 1} / ${exercise.lines.length}`
                              : 'the timer starts with your first key')}
                </span>
            </div>
            <div
                className={`arena ${focused ? 'focused' : 'unfocused'}`}
                onClick={() => input.current?.focus()}
            >
                <p className="sr-only" id="exercise-prompt">
                    Type this text: {exercise.lines[engine.currentLineIndex]}
                </p>
                <div
                    className="text-viewport"
                    ref={viewport}
                    aria-hidden="true"
                >
                    <div className="typing-text" ref={text}>
                        {words}
                        <span
                            data-index={engine.typedChars.length}
                            className="char"
                        >
                            &nbsp;
                        </span>
                        {exercise.lines[engine.currentLineIndex + 1] && (
                            <div className="next-line">
                                {exercise.lines[engine.currentLineIndex + 1]}
                            </div>
                        )}
                        <span
                            ref={caret}
                            className={`caret ${engine.isRunning ? 'moving' : ''}`}
                            hidden={!focused}
                        />
                    </div>
                </div>
                <textarea
                    ref={input}
                    className="typing-input"
                    aria-label="Typing input"
                    aria-describedby="exercise-prompt typing-help typing-feedback"
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    onCompositionStart={() => {
                        compositionCommitted.current = false;
                    }}
                    onKeyDown={keyDown}
                    onKeyUp={(event) => view.current?.releaseKey(event.code)}
                    onInput={receiveInput}
                    onCompositionEnd={receiveInput}
                    onPaste={(event) => event.preventDefault()}
                    onFocus={() => {
                        engine.resume();
                        setFocused(true);
                    }}
                    onBlur={() => {
                        engine.pause();
                        view.current?.clearPressedKeys();
                        setFocused(false);
                    }}
                />
                {!focused && (
                    <button
                        className="focus-prompt"
                        onClick={() => input.current?.focus()}
                    >
                        <Icon name="keyboard" />{' '}
                        {engine.isRunning
                            ? 'paused — click to resume'
                            : 'click here to start typing'}
                    </button>
                )}
            </div>
            <p className="arena-help" id="typing-help">
                {engine.mode === 'strict'
                    ? 'Take your time. Each correct key moves you forward.'
                    : 'Find your rhythm. Space moves to the next word; backspace corrects mistakes.'}
            </p>
            {exercise.source && (
                <p className="arena-help">
                    {exercise.author} · Public-domain quotation ·{' '}
                    <a href={exercise.source} target="_blank" rel="noreferrer">
                        Read the source
                    </a>
                </p>
            )}
            <p className="sr-only" id="typing-feedback" role="status">
                {inputFeedback}
            </p>
        </>
    );
});

function KeyHeatmap({ learning, preset }) {
    const keyboard = useRef(null);
    useEffect(() => {
        if (keyboard.current)
            new KeyboardView(keyboard.current, null, null, preset).showHeatmap(
                learning,
            );
    }, [learning, preset]);
    if (!learning || !Object.keys(learning.keys).length) return null;
    return (
        <section className="key-map" aria-label="Target-key heatmap">
            <h2>Your key map</h2>
            <p className="field-help">
                {KEYBOARD_PRESETS[preset]} · This session’s target keys,
                including skipped keys. Average reach measures time between
                strokes; pauses and backspace gaps are excluded.
            </p>
            <div
                ref={keyboard}
                className="keyboard-container"
                aria-hidden="true"
            />
            <p className="heat-legend field-help">
                <span>● Clean</span>
                <span>● Errors — stronger color means a higher rate</span>
                <span>○ Not tried</span>
            </p>
            <details>
                <summary>View key and pair details</summary>
                {['keys', 'bigrams'].map((name) => (
                    <table key={name}>
                        <caption>
                            {name === 'keys'
                                ? 'Target keys'
                                : 'Most difficult pairs'}{' '}
                            · ␣ means Space
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col">
                                    {name === 'keys' ? 'Key' : 'Pair'}
                                </th>
                                <th scope="col">Attempts</th>
                                <th scope="col">Errors</th>
                                <th scope="col">Average reach</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(learning[name])
                                .sort(
                                    (a, b) =>
                                        b[1].errors / b[1].attempts -
                                            a[1].errors / a[1].attempts ||
                                        b[1].latencyTotalMs /
                                            (b[1].latencySamples || 1) -
                                            a[1].latencyTotalMs /
                                                (a[1].latencySamples || 1),
                                )
                                .slice(0, name === 'keys' ? 95 : 12)
                                .map(([key, cell]) => (
                                    <tr key={key}>
                                        <td>{key.replaceAll(' ', '␣')}</td>
                                        <td>{cell.attempts}</td>
                                        <td>{cell.errors}</td>
                                        <td>
                                            {cell.latencySamples
                                                ? `${Math.round(cell.latencyTotalMs / cell.latencySamples)} ms`
                                                : '—'}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                ))}
            </details>
        </section>
    );
}

function Results({
    result,
    samples,
    exercise,
    onRestart,
    onRepeat,
    onPracticeMissed,
    onPracticeWeak,
    onNext,
}) {
    const [downloading, setDownloading] = useState(false);
    const [downloadMessage, setDownloadMessage] = useState('');
    const downloadCard = async () => {
        setDownloading(true);
        setDownloadMessage('');
        try {
            const blob = await resultCard(result, exercise);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `typeflow-${result.wpm}wpm.png`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setDownloadMessage('Result card downloaded.');
        } catch {
            setDownloadMessage('Could not create the result card. Try again.');
        } finally {
            setDownloading(false);
        }
    };
    const maximum = Math.max(20, ...samples.map((sample) => sample.wpm));
    const duration = result.elapsedMilliseconds;
    const points = samples
        .map(
            (sample) =>
                `${(sample.elapsedMilliseconds / duration) * 100},${100 - (sample.wpm / maximum) * 100}`,
        )
        .join(' ');
    const errors = Object.entries(result.errorsByChar)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    const feedback = resultFeedback(result, exercise);
    return (
        <section className="results" aria-label="Test results">
            <div className="result-heading">
                <div>
                    <p className="eyebrow">a little better, every day</p>
                    <h1>{feedback.heading}</h1>
                    <p className="focus-keys">{feedback.advice}</p>
                </div>
                {result.isNewBestWpm && (
                    <span className="record">personal best ↗</span>
                )}
            </div>
            <div className="result-main">
                <div className="result-primary">
                    <span>wpm</span>
                    <strong>{result.wpm}</strong>
                    <span>accuracy</span>
                    <strong>
                        {result.accuracy}
                        <small>%</small>
                    </strong>
                </div>
                <div className="chart">
                    {duration > 0 && samples.length > 0 ? (
                        <>
                            <p className="chart-caption" id="chart-description">
                                Overall WPM at each recorded time.
                                {samples.length === 1 &&
                                    ' One sample; no trend available.'}
                            </p>
                            <div className="chart-grid">
                                <div
                                    className="chart-y-axis"
                                    aria-hidden="true"
                                >
                                    {[1, 0.5, 0].map((fraction) => (
                                        <span key={fraction}>
                                            {maximum * fraction}
                                        </span>
                                    ))}
                                </div>
                                <svg
                                    viewBox="0 0 100 100"
                                    preserveAspectRatio="none"
                                    role="img"
                                    aria-label={`${samples.length} speed ${samples.length === 1 ? 'sample' : 'samples'} over ${formatElapsedTime(duration)}. Vertical axis: 0 to ${maximum} WPM.`}
                                    aria-describedby="chart-description"
                                    focusable="false"
                                >
                                    {[0, 0.5, 1].map((fraction) => (
                                        <line
                                            key={fraction}
                                            x1="0"
                                            x2="100"
                                            y1={100 - fraction * 100}
                                            y2={100 - fraction * 100}
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    ))}
                                    <polyline
                                        points={points}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    {samples.map((sample) => (
                                        <path
                                            key={sample.elapsedMilliseconds}
                                            d={`M${(sample.elapsedMilliseconds / duration) * 100} ${100 - (sample.wpm / maximum) * 100}l0 0`}
                                            stroke="var(--accent)"
                                            strokeWidth="5"
                                            strokeLinecap="round"
                                            vectorEffect="non-scaling-stroke"
                                        >
                                            <title>
                                                {formatElapsedTime(
                                                    sample.elapsedMilliseconds,
                                                )}
                                                : {sample.wpm} wpm
                                            </title>
                                        </path>
                                    ))}
                                </svg>
                                <div
                                    className="chart-x-axis"
                                    aria-hidden="true"
                                >
                                    <span>0s</span>
                                    <span>{formatElapsedTime(duration)}</span>
                                </div>
                            </div>
                            <details>
                                <summary>View speed samples</summary>
                                <p>
                                    {samples
                                        .map(
                                            (sample) =>
                                                `${formatElapsedTime(sample.elapsedMilliseconds)}: ${sample.wpm} wpm`,
                                        )
                                        .join(' · ')}
                                </p>
                            </details>
                        </>
                    ) : (
                        <p className="chart-empty">
                            {duration <= 0
                                ? 'No measured typing time.'
                                : 'No speed samples were recorded.'}
                        </p>
                    )}
                </div>
            </div>
            <div className="result-details">
                {[
                    ['test', exercise.title.replace(/^Lesson \d+: /, '')],
                    ...(exercise.track === 'lesson'
                        ? [
                              [
                                  'stars this attempt',
                                  result.saving
                                      ? 'Saving…'
                                      : result.stars == null
                                        ? '—'
                                        : `${result.stars} / 3`,
                              ],
                              [
                                  '3-star target',
                                  `${exercise.targetWpm} WPM · ${exercise.targetAccuracy}%`,
                              ],
                          ]
                        : []),
                    ['raw wpm', result.rawWpm],
                    [
                        'consistency',
                        result.consistency == null
                            ? 'Not enough data'
                            : `${result.consistency}%`,
                    ],
                    ['time', formatElapsedTime(duration)],
                    [
                        'errors / skipped',
                        `${result.errorKeystrokes} / ${result.skippedChars || 0}`,
                    ],
                ].map(([label, value]) => (
                    <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                    </div>
                ))}
            </div>
            <p className="field-help">
                WPM credits correct words and a clean unfinished word. Five
                characters count as one word. Raw WPM includes mistakes.
            </p>
            <p className="focus-keys">
                {errors.length
                    ? `Focus keys: ${errors
                          .map(
                              ([key, count]) =>
                                  `${key === ' ' ? 'space' : key} (${count})`,
                          )
                          .join(' · ')}`
                    : 'Every key in its place. No mistakes.'}
            </p>
            <KeyHeatmap
                learning={result.learning}
                preset={exercise.keyboardLayout}
            />
            {result.recordReason && (
                <p className="focus-keys">{result.recordReason}</p>
            )}
            <p className="focus-keys" role="status">
                {result.saving
                    ? 'Saving progress… You can start another test.'
                    : result.saved === false
                      ? 'Progress is in memory. Keep a backup before closing this page.'
                      : ''}
                {!result.saving && (
                    <span className="sr-only">
                        {' '}
                        {result.isNewBestWpm ? 'Personal best. ' : ''}
                        {exercise.track === 'lesson' && result.stars != null
                            ? `${result.stars} of 3 stars this attempt. `
                            : ''}
                        {result.recordReason || ''}
                    </span>
                )}
            </p>
            <div className="result-actions">
                <button className="primary-button" onClick={onRestart}>
                    {exercise.track === 'test'
                        ? 'New test'
                        : exercise.track === 'quote'
                          ? 'Next quote'
                          : 'Try again'}{' '}
                    {exercise.track !== 'test' && (
                        <Icon
                            name={
                                exercise.track === 'quote' ? 'next' : 'restart'
                            }
                        />
                    )}
                </button>
                {['test', 'quote'].includes(exercise.track) && (
                    <button className="text-button" onClick={onRepeat}>
                        Repeat this text
                    </button>
                )}
                {result.missedWords.length > 0 && (
                    <button className="text-button" onClick={onPracticeMissed}>
                        Practice missed words
                    </button>
                )}
                {onPracticeWeak && (
                    <button className="text-button" onClick={onPracticeWeak}>
                        Practice weak keys
                    </button>
                )}
                {onNext && (
                    <button className="text-button" onClick={onNext}>
                        Next lesson <Icon name="next" />
                    </button>
                )}
                <button
                    className="text-button"
                    onClick={downloadCard}
                    disabled={downloading}
                >
                    {downloading
                        ? 'Preparing result card…'
                        : 'Download result card'}
                </button>
            </div>
            <p className="field-help" aria-live="polite">
                {downloadMessage}
            </p>
        </section>
    );
}

export default function App() {
    const [settings, setSettings] = useState(() => ({
        ...storage.data.settings,
    }));
    const [exercise, setExerciseState] = useState(() =>
        storage.lastSavedRaw === null && !storage.loadFailed
            ? lessonExercise('amateur', 1, settings.keyboardLayout)
            : practice(settings),
    );
    const [phoneDemo, setPhoneDemo] = useState(
        () =>
            matchMedia('(pointer: coarse)').matches &&
            storage.lastSavedRaw === null &&
            !storage.loadFailed,
    );
    const setExercise = (next, preset = settings.keyboardLayout) => {
        setPhoneDemo(false);
        if (next.keyboardLayout && next.keyboardLayout !== preset) {
            if (next.track === 'lesson')
                next = lessonExercise(
                    next.lessonTrack,
                    next.lessonIndex,
                    preset,
                );
            else if (next.track === 'weak')
                next = {
                    ...next,
                    ...generateWeakDrill(
                        storage.getLearning(),
                        undefined,
                        preset,
                    ),
                };
        }
        setExerciseState({ ...next, keyboardLayout: preset });
    };
    const [revision, setRevision] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [lessonTrack, setLessonTrack] = useState('amateur');
    const [customText, setCustomText] = useState('');
    const [focused, setFocused] = useState(
        () => !matchMedia('(pointer: coarse)').matches,
    );
    const [inputFeedback, setInputFeedback] = useState('');
    const [result, setResult] = useState(null);
    const [recoveryMessage, setRecoveryMessage] = useState('');
    const [retryingSave, setRetryingSave] = useState(false);
    const hasResult = Boolean(result);
    const hasPendingSaves = storage.pendingLessons.length > 0;
    const activeExercise = useRef(exercise);
    useLayoutEffect(() => {
        activeExercise.current = exercise;
    }, [exercise]);
    const engine = useMemo(() => new TypingEngine(), []);
    const [stats, setStats] = useState(() => engine.getStats());
    const input = useRef(null);
    const restart = useRef(null);
    const backupButton = useRef(null);
    const keyboardView = useRef(null);
    const samples = useRef([]);
    const missedWords = useRef(new Set());

    engine.onCharTyped = (_character, correct) => {
        setRevision((value) => value + 1);
        if (engine.mode === 'strict' && correct) setInputFeedback('');
    };
    engine.onLineComplete = () => setRevision((value) => value + 1);
    engine.onError = (expected, typed) => {
        setInputFeedback(typingErrorMessage(expected, typed, engine.mode));
        sound.playError();
        const word = currentWord(engine.typedChars, engine.currentCharIndex);
        if (word) missedWords.current.add(word);
    };
    engine.onTick = (next) => {
        setStats(next);
        recordSpeedSample(samples.current, next);
    };
    engine.onComplete = async (final) => {
        setInputFeedback('');
        recordSpeedSample(samples.current, final, true);
        const completedWords = [...missedWords.current];
        setResult({ ...final, missedWords: completedWords, saving: true });
        setStats(final);
        sound.playSuccess();
        let progress;
        try {
            progress = await storage.recordLesson(
                exercise.id,
                final,
                exercise.targetWpm || 45,
                exercise.targetAccuracy || 95,
                {
                    ...exercise.options,
                    typingMode: settings.typingMode,
                    recordEligible:
                        !['custom', 'retry'].includes(exercise.track) &&
                        exercise.options?.recordEligible !== false,
                },
            );
        } catch {
            progress = { saved: false };
        }
        setSettings((current) => ({ ...current }));
        if (activeExercise.current !== exercise) return;
        setResult({
            ...final,
            ...progress,
            missedWords: completedWords,
            saving: false,
        });
    };

    useLayoutEffect(() => {
        engine.mode = settings.typingMode;
        engine.loadExercise(exercise.lines, exercise.duration || 0);
        samples.current = [];
        missedWords.current.clear();
        keyboardView.current?.clearPressedKeys();
        setResult(null);
        setInputFeedback('');
        setStats(engine.getStats());
        setRevision((value) => value + 1);
        const frame = requestAnimationFrame(() => {
            window.scrollTo(0, 0);
            if (!matchMedia('(pointer: coarse)').matches)
                input.current?.focus({ preventScroll: true });
        });
        return () => {
            cancelAnimationFrame(frame);
            engine.reset();
        };
    }, [exercise, engine]);

    useEffect(() => {
        const media = matchMedia('(prefers-color-scheme: dark)');
        const apply = () => {
            document.documentElement.dataset.palette = settings.colorPalette;
            document.documentElement.dataset.theme =
                settings.theme === 'system'
                    ? media.matches
                        ? 'dark'
                        : 'light'
                    : settings.theme;
        };
        apply();
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, [settings.theme, settings.colorPalette]);
    useEffect(() => {
        sound.setMuted(settings.soundMuted);
        sound.setVolume(settings.volume);
        sound.setProfile(settings.soundProfile);
    }, [settings.soundMuted, settings.volume, settings.soundProfile]);
    useEffect(() => {
        if (hasResult && !dialog)
            restart.current?.focus({ preventScroll: true });
    }, [hasResult, dialog]);
    useEffect(() => {
        const visibility = () => {
            if (document.hidden) {
                engine.pause();
                keyboardView.current?.clearPressedKeys();
            } else if (
                !phoneDemo &&
                !dialog &&
                document.activeElement === input.current
            )
                engine.resume();
        };
        const shortcuts = (event) => {
            if (event.isComposing || event.keyCode === 229) return;
            if (event.key === 'Escape' && !dialog) {
                event.preventDefault();
                engine.pause();
                setDialog('settings');
            } else if (event.shiftKey && event.key === 'Enter' && !dialog) {
                event.preventDefault();
                restartExercise();
            }
        };
        document.addEventListener('visibilitychange', visibility);
        window.addEventListener('keydown', shortcuts);
        return () => {
            document.removeEventListener('visibilitychange', visibility);
            window.removeEventListener('keydown', shortcuts);
        };
    }, [dialog, exercise, settings, engine, phoneDemo]);

    const openDialog = (name) => {
        engine.pause();
        if (name === 'recovery') setRecoveryMessage('');
        setDialog(name);
    };
    const closeDialog = () => {
        setDialog(null);
        requestAnimationFrame(() =>
            (result ? restart.current : input.current)?.focus({
                preventScroll: true,
            }),
        );
    };
    const updateSetting = (key, value) => {
        storage
            .setSetting(key, value)
            .then(() => setSettings((current) => ({ ...current })));
        const next = { ...settings, [key]: value };
        setSettings(next);
        if (
            [
                'testMode',
                'testDuration',
                'testWordCount',
                'punctuation',
                'numbers',
            ].includes(key)
        ) {
            setExercise(practice(next));
        } else if (key === 'typingMode') setExercise({ ...exercise });
        else if (key === 'keyboardLayout' && !result && !phoneDemo)
            setExercise({ ...exercise }, value);
    };
    const downloadBackup = () => {
        try {
            const url = URL.createObjectURL(
                new Blob([storage.exportBackup()], {
                    type: 'application/json',
                }),
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = `typeflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setRecoveryMessage(
                'Backup download started. Keep this file to preserve your progress.',
            );
        } catch {
            setRecoveryMessage(
                'Could not create the backup. Your current sessions are still in memory.',
            );
        }
    };
    const retrySaving = async () => {
        setRetryingSave(true);
        try {
            const saved = await storage.retrySave();
            setRecoveryMessage(
                saved
                    ? 'Your progress is saved on this device.'
                    : 'Saving is still unavailable. Download a backup before closing this page.',
            );
        } catch {
            setRecoveryMessage(
                'Saving is still unavailable. Download a backup before closing this page.',
            );
        } finally {
            setRetryingSave(false);
            if (document.activeElement === document.body)
                backupButton.current?.focus();
        }
    };
    const loadLesson = (track, index) => {
        setExercise(lessonExercise(track, index, settings.keyboardLayout));
        setDialog(null);
    };
    const loadQuote = () => {
        const index =
            exercise.track === 'quote'
                ? (exercise.quoteIndex + 1) % CURRICULUM.quotes.length
                : Math.floor(Math.random() * CURRICULUM.quotes.length);
        const quote = CURRICULUM.quotes[index];
        setExercise({
            track: 'quote',
            id: `quote-${quote.id}`,
            title: `quote · ${quote.author}`,
            lines: [quote.text],
            quoteIndex: index,
            author: quote.author,
            source: quote.source,
        });
    };
    const restartExercise = () => {
        if (exercise.track === 'test') setExercise(practice(settings));
        else if (exercise.track === 'quote') loadQuote();
        else if (exercise.track === 'lesson')
            loadLesson(exercise.lessonTrack, exercise.lessonIndex);
        else if (exercise.track === 'weak') practiceWeak();
        else setExercise({ ...exercise });
    };
    const repeatExercise = () =>
        setExercise({
            ...exercise,
            options: { ...exercise.options, recordEligible: false },
        });
    const practiceMissed = () =>
        setExercise({
            track: 'retry',
            id: 'missed-words',
            title: `missed words · ${result.missedWords.length}`,
            lines: [result.missedWords.join(' ')],
        });
    const weakFocus = useMemo(
        () => focusKeys(storage.getLearning()),
        [storage.data.learning],
    );
    const practiceWeak = () => {
        const drill = generateWeakDrill(
            storage.getLearning(),
            undefined,
            settings.keyboardLayout,
        );
        if (!drill.focusKeys.length) return;
        setExercise({
            ...drill,
            track: 'weak',
            id: 'weak-keys',
            title: 'Weak-key practice',
            options: { recordEligible: false },
        });
    };
    const currentDuration =
        settings.testMode === 'time'
            ? settings.testDuration
            : settings.testWordCount;
    const nextLesson =
        exercise.track === 'lesson' &&
        exercise.lessonIndex < CURRICULUM[exercise.lessonTrack].length - 1
            ? () => loadLesson(exercise.lessonTrack, exercise.lessonIndex + 1)
            : null;
    const restartLabel =
        exercise.track === 'quote' ? 'Next quote' : 'Restart test';

    return (
        <div
            className={`app ${['lesson', 'weak'].includes(exercise.track) ? 'lesson-mode' : ''}`}
        >
            <header className="header">
                <button
                    className="brand"
                    onClick={() => setExercise(practice(settings))}
                    aria-label="Typeflow home"
                >
                    <span className="brand-mark">
                        <Icon name="mark" />
                    </span>
                    <span>
                        <small>find your typing flow</small>
                        <strong>
                            typeflow<span className="brand-period">.</span>
                        </strong>
                    </span>
                </button>
                <nav className="navigation" aria-label="Practice">
                    <Choice
                        selected={exercise.track === 'test'}
                        onClick={() => setExercise(practice(settings))}
                    >
                        test
                    </Choice>
                    <Choice
                        selected={exercise.track === 'lesson'}
                        onClick={() => openDialog('lessons')}
                    >
                        learn
                    </Choice>
                    <Choice
                        selected={exercise.track === 'quote'}
                        onClick={loadQuote}
                    >
                        quote
                    </Choice>
                    <Choice
                        selected={exercise.track === 'custom'}
                        onClick={() => openDialog('custom')}
                    >
                        custom
                    </Choice>
                </nav>
                <div className="header-actions">
                    <button
                        className="icon-button"
                        aria-label="Session history"
                        title="Session history"
                        onClick={() => openDialog('history')}
                    >
                        <Icon name="history" />
                    </button>
                    <button
                        className="icon-button"
                        aria-label="Settings"
                        title="Settings (Esc)"
                        onClick={() => openDialog('settings')}
                    >
                        <Icon name="settings" />
                    </button>
                </div>
            </header>
            <main className="main">
                <div className="test-toolbar">
                    {exercise.track === 'test' ? (
                        <>
                            <div className="toolbar-group toggles">
                                <Choice
                                    selected={settings.punctuation}
                                    onClick={() =>
                                        updateSetting(
                                            'punctuation',
                                            !settings.punctuation,
                                        )
                                    }
                                >
                                    punctuation
                                </Choice>
                                <Choice
                                    selected={settings.numbers}
                                    onClick={() =>
                                        updateSetting(
                                            'numbers',
                                            !settings.numbers,
                                        )
                                    }
                                >
                                    numbers
                                </Choice>
                            </div>
                            <span className="divider" />
                            <div className="toolbar-group">
                                <Choice
                                    value="time"
                                    selected={settings.testMode === 'time'}
                                    onClick={(value) =>
                                        updateSetting('testMode', value)
                                    }
                                >
                                    time
                                </Choice>
                                <Choice
                                    value="words"
                                    selected={settings.testMode === 'words'}
                                    onClick={(value) =>
                                        updateSetting('testMode', value)
                                    }
                                >
                                    words
                                </Choice>
                            </div>
                            <span className="divider" />
                            <div
                                className="toolbar-group counts"
                                role="group"
                                aria-label={
                                    settings.testMode === 'time'
                                        ? 'Test duration'
                                        : 'Word count'
                                }
                            >
                                {(settings.testMode === 'time'
                                    ? [15, 30, 60, 120]
                                    : [10, 25, 50, 100]
                                ).map((value) => (
                                    <Choice
                                        key={value}
                                        value={value}
                                        selected={value === currentDuration}
                                        aria-label={
                                            settings.testMode === 'time'
                                                ? `${value} seconds`
                                                : `${value} words`
                                        }
                                        onClick={(value) =>
                                            updateSetting(
                                                settings.testMode === 'time'
                                                    ? 'testDuration'
                                                    : 'testWordCount',
                                                value,
                                            )
                                        }
                                    >
                                        {value}
                                    </Choice>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            {exercise.track !== 'lesson' && (
                                <span className="exercise-title">
                                    {exercise.title}
                                </span>
                            )}
                            {exercise.track === 'lesson' && (
                                <>
                                    <button
                                        className="text-button"
                                        onClick={() => openDialog('lessons')}
                                    >
                                        Change lesson
                                    </button>
                                    <button
                                        className="text-button skip-to-test"
                                        onClick={() =>
                                            setExercise(practice(settings))
                                        }
                                    >
                                        Skip to test
                                    </button>
                                </>
                            )}
                            {exercise.track === 'custom' && (
                                <button
                                    className="text-button"
                                    onClick={() => openDialog('custom')}
                                >
                                    Edit text
                                </button>
                            )}
                        </>
                    )}
                    {!result && weakFocus.length > 0 && (
                        <button className="text-button" onClick={practiceWeak}>
                            Practice weak keys
                        </button>
                    )}
                </div>
                {result ? (
                    <Results
                        result={result}
                        samples={samples.current}
                        exercise={exercise}
                        onRestart={restartExercise}
                        onRepeat={repeatExercise}
                        onPracticeMissed={practiceMissed}
                        onPracticeWeak={weakFocus.length ? practiceWeak : null}
                        onNext={nextLesson}
                    />
                ) : (
                    <section className="test" aria-label={exercise.title}>
                        <div className="test-heading">
                            <div>
                                <p className="eyebrow">
                                    {['lesson', 'weak'].includes(exercise.track)
                                        ? exercise.title
                                        : 'a moment of focus'}
                                </p>
                                <h1>
                                    {exercise.track === 'lesson'
                                        ? 'Learn touch typing.'
                                        : exercise.track === 'weak'
                                          ? 'Make the tricky keys familiar.'
                                          : engine.isRunning
                                            ? 'Stay in the flow.'
                                            : 'Just you and the keys.'}
                                </h1>
                            </div>
                            <div
                                className="live-stats"
                                role="group"
                                aria-label="Live statistics"
                                hidden={
                                    phoneDemo ||
                                    (exercise.track === 'lesson' &&
                                        !engine.isRunning)
                                }
                            >
                                <strong>
                                    <span className="sr-only">
                                        {exercise.duration
                                            ? 'Time remaining: '
                                            : 'Elapsed time: '}
                                    </span>
                                    {exercise.duration
                                        ? stats.timeRemaining
                                        : stats.elapsedSeconds}
                                    <small aria-hidden="true">s</small>
                                    <span className="sr-only"> seconds</span>
                                </strong>
                                <span>
                                    {stats.wpm}{' '}
                                    <small aria-hidden="true">wpm</small>
                                    <span className="sr-only">
                                        {' '}
                                        words per minute
                                    </span>
                                </span>
                                <span>
                                    {stats.accuracy}
                                    <small aria-hidden="true">%</small>
                                    <span className="sr-only">
                                        {' '}
                                        percent accuracy
                                    </span>
                                </span>
                            </div>
                        </div>
                        <p className="keyboard-notice">
                            Best with a physical keyboard. Connect one to follow
                            the finger guide. Onscreen keyboards do not teach
                            finger placement.
                            {!phoneDemo && (
                                <button
                                    type="button"
                                    className="text-button"
                                    onClick={() => {
                                        engine.pause();
                                        setPhoneDemo(true);
                                    }}
                                >
                                    Watch a demo
                                </button>
                            )}
                        </p>
                        {phoneDemo && (
                            <PhoneDemo
                                preset={settings.keyboardLayout}
                                paused={Boolean(dialog)}
                                onPractice={() => {
                                    setExercise(
                                        lessonExercise(
                                            'amateur',
                                            1,
                                            settings.keyboardLayout,
                                        ),
                                    );
                                    requestAnimationFrame(() =>
                                        input.current?.focus(),
                                    );
                                }}
                            />
                        )}
                        {!phoneDemo && exercise.track === 'lesson' && (
                            <aside
                                className="lesson-instructions"
                                aria-label="Lesson instructions"
                            >
                                <p>{exercise.description}</p>
                                <p>
                                    <strong>Practice keys:</strong>{' '}
                                    {exercise.keysIntroduced
                                        .map((key) =>
                                            key === ' ' ? 'Space' : key,
                                        )
                                        .join(' · ')}
                                </p>
                                <details className="lesson-goal">
                                    <summary>Lesson targets</summary>3 stars:{' '}
                                    {exercise.targetWpm} WPM ·{' '}
                                    {exercise.targetAccuracy}% accuracy · no
                                    skipped characters
                                </details>
                            </aside>
                        )}
                        {!phoneDemo && exercise.track === 'weak' && (
                            <aside
                                className="lesson-instructions"
                                aria-label="Adaptive practice instructions"
                            >
                                <p>
                                    Slow down and aim for accuracy. Your next
                                    drill changes as these keys improve.
                                </p>
                                <ul
                                    className="focus-chips"
                                    aria-label="Focus keys"
                                >
                                    {exercise.focusKeys.map((key) => (
                                        <li key={key}>
                                            <kbd>
                                                {key === ' ' ? 'Space' : key}
                                            </kbd>
                                        </li>
                                    ))}
                                </ul>
                            </aside>
                        )}
                        {!phoneDemo && (
                            <Arena
                                key={exercise.lines.join('\n')}
                                engine={engine}
                                revision={revision}
                                exercise={exercise}
                                input={input}
                                restart={restart}
                                view={keyboardView}
                                focused={focused}
                                setFocused={setFocused}
                                inputFeedback={inputFeedback}
                                setInputFeedback={setInputFeedback}
                            />
                        )}
                    </section>
                )}
                <div className="restart-row" hidden={phoneDemo}>
                    <button
                        ref={restart}
                        className="icon-button restart-button"
                        aria-label={restartLabel}
                        title={`${restartLabel} (Tab + Enter)`}
                        onClick={restartExercise}
                    >
                        <Icon
                            name={
                                exercise.track === 'quote' ? 'next' : 'restart'
                            }
                        />
                    </button>
                </div>
                {!result && !phoneDemo && (
                    <Guidance
                        engine={engine}
                        revision={revision}
                        settings={settings}
                        view={keyboardView}
                        preset={exercise.keyboardLayout}
                    />
                )}
                <div className="shortcuts" hidden={phoneDemo}>
                    <span>
                        <kbd>tab</kbd> + <kbd>enter</kbd>{' '}
                        {restartLabel.toLowerCase()}
                    </span>
                    <span>
                        <kbd>esc</kbd> settings
                    </span>
                </div>
                <p className="sr-only" role="status">
                    {result
                        ? `Test complete. ${result.wpm} words per minute, ${result.accuracy} percent accuracy.`
                        : ''}
                </p>
            </main>
            <footer className="footer">
                <span>
                    <span className="small-dot" /> made for your daily practice
                </span>
                <div>
                    <button
                        onClick={() =>
                            updateSetting('soundMuted', !settings.soundMuted)
                        }
                    >
                        <Icon name={settings.soundMuted ? 'muted' : 'sound'} />{' '}
                        sound {settings.soundMuted ? 'off' : 'on'}
                    </button>
                    <button
                        onClick={() =>
                            updateSetting(
                                'theme',
                                document.documentElement.dataset.theme ===
                                    'dark'
                                    ? 'light'
                                    : 'dark',
                            )
                        }
                    >
                        <Icon name="appearance" /> appearance
                    </button>
                    <span
                        role="status"
                        className={
                            storage.saveFailed || hasPendingSaves
                                ? ''
                                : 'local-note'
                        }
                    >
                        {storage.saveConflict
                            ? 'another tab changed saved data · this session is in memory'
                            : storage.saveFailed
                              ? 'storage unavailable · session only'
                              : hasPendingSaves
                                ? 'saving progress · session in memory'
                                : 'saved on this device'}
                    </span>
                    {(storage.saveFailed || hasPendingSaves) && (
                        <button onClick={() => openDialog('recovery')}>
                            Keep my progress
                        </button>
                    )}
                    <OfflineStatus />
                </div>
            </footer>
            {dialog && (
                <Dialog
                    key={dialog}
                    title={
                        {
                            settings: 'Make it your own',
                            lessons: 'Build your muscle memory',
                            custom: 'Your words, your practice',
                            history: 'Your recent sessions',
                            recovery: 'Keep your progress',
                        }[dialog]
                    }
                    onClose={closeDialog}
                >
                    {dialog === 'recovery' && (
                        <div>
                            <p className="field-help">
                                {storage.saveConflict
                                    ? 'Another tab changed your saved progress. Download a backup to preserve both your current sessions and the readable saved data.'
                                    : storage.saveFailed
                                      ? 'Your latest sessions are in memory. Closing or reloading this page can lose them. Download a backup to keep a copy.'
                                      : hasPendingSaves
                                        ? 'Your latest sessions are waiting to save. Download a backup to keep them while saving finishes.'
                                        : 'Your progress is saved on this device. Download a backup to keep a separate copy.'}
                            </p>
                            <p className="field-help">
                                The backup includes current progress, sessions
                                waiting to save, and readable saved data.
                            </p>
                            <div className="dialog-actions">
                                <button
                                    className="primary-button"
                                    ref={backupButton}
                                    onClick={downloadBackup}
                                >
                                    Download backup
                                </button>
                                {storage.saveFailed && (
                                    <button
                                        className="text-button"
                                        onClick={retrySaving}
                                        disabled={
                                            retryingSave || hasPendingSaves
                                        }
                                    >
                                        {hasPendingSaves
                                            ? 'Waiting to save…'
                                            : retryingSave
                                              ? 'Saving…'
                                              : 'Try saving again'}
                                    </button>
                                )}
                            </div>
                            <p className="field-help" role="status">
                                {recoveryMessage}
                            </p>
                            <details className="field-help">
                                <summary>View backup text</summary>
                                <p>
                                    If downloading is unavailable, select all
                                    this text and copy it into a file to keep
                                    your backup.
                                </p>
                                <textarea
                                    id="backup-text"
                                    aria-label="Backup JSON"
                                    rows={8}
                                    readOnly
                                    value={storage.exportBackup()}
                                />
                            </details>
                        </div>
                    )}
                    {dialog === 'settings' && (
                        <div className="settings">
                            <fieldset>
                                <legend>Keyboard layout</legend>
                                <select
                                    className="layout-select"
                                    aria-label="Keyboard layout"
                                    aria-describedby="layout-help"
                                    value={settings.keyboardLayout}
                                    onChange={(event) =>
                                        updateSetting(
                                            'keyboardLayout',
                                            event.target.value,
                                        )
                                    }
                                >
                                    {Object.entries(KEYBOARD_PRESETS).map(
                                        ([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ),
                                    )}
                                </select>
                                <p id="layout-help">
                                    Match your operating system’s input source.{' '}
                                    {settings.keyboardLayout === 'uk-iso'
                                        ? 'UK ISO uses Windows UK characters and PC modifier labels.'
                                        : 'These ANSI guides use Mac modifier labels and keep Caps Lock unchanged.'}{' '}
                                    Changing layout restarts an unfinished
                                    practice. Stars and weak-key measurements
                                    are shared across layouts.
                                </p>
                            </fieldset>
                            <fieldset>
                                <legend>Typing behavior</legend>
                                <div className="setting-choices">
                                    {[
                                        ['flow', 'Free flow'],
                                        ['strict', 'Guided'],
                                    ].map(([value, label]) => (
                                        <Choice
                                            key={value}
                                            value={value}
                                            selected={
                                                settings.typingMode === value
                                            }
                                            onClick={(value) =>
                                                updateSetting(
                                                    'typingMode',
                                                    value,
                                                )
                                            }
                                        >
                                            {label}
                                        </Choice>
                                    ))}
                                </div>
                                <p>
                                    Free flow accepts mistakes. Guided waits for
                                    the correct key. Changing behavior restarts
                                    the test.
                                </p>
                            </fieldset>
                            <fieldset>
                                <legend>Appearance</legend>
                                <div className="setting-choices">
                                    {['dark', 'light', 'system'].map(
                                        (value) => (
                                            <Choice
                                                key={value}
                                                value={value}
                                                selected={
                                                    settings.theme === value
                                                }
                                                onClick={(value) =>
                                                    updateSetting(
                                                        'theme',
                                                        value,
                                                    )
                                                }
                                            >
                                                {value}
                                            </Choice>
                                        ),
                                    )}
                                </div>
                            </fieldset>
                            <fieldset>
                                <legend>Color palette</legend>
                                <div className="setting-choices">
                                    {['Mint', 'Ocean', 'Plum'].map((label) => (
                                        <Choice
                                            key={label}
                                            value={label.toLowerCase()}
                                            selected={
                                                settings.colorPalette ===
                                                label.toLowerCase()
                                            }
                                            onClick={(value) =>
                                                updateSetting(
                                                    'colorPalette',
                                                    value,
                                                )
                                            }
                                        >
                                            {label}
                                        </Choice>
                                    ))}
                                </div>
                                <p>
                                    Each palette works with light, dark, or
                                    system appearance.
                                </p>
                            </fieldset>
                            <fieldset>
                                <legend>Keyboard sound</legend>
                                <div className="setting-choices">
                                    {['magic', 'thock', 'bubble', 'clicky'].map(
                                        (value) => (
                                            <Choice
                                                key={value}
                                                value={value}
                                                selected={
                                                    settings.soundProfile ===
                                                    value
                                                }
                                                onClick={(value) => {
                                                    updateSetting(
                                                        'soundProfile',
                                                        value,
                                                    );
                                                    sound.setProfile(value);
                                                    sound.playKey();
                                                }}
                                            >
                                                {value}
                                            </Choice>
                                        ),
                                    )}
                                </div>
                                <label className="setting-row">
                                    Enable sound
                                    <input
                                        type="checkbox"
                                        checked={!settings.soundMuted}
                                        onChange={(event) =>
                                            updateSetting(
                                                'soundMuted',
                                                !event.target.checked,
                                            )
                                        }
                                    />
                                </label>
                                <label
                                    className="volume-label"
                                    htmlFor="volume"
                                >
                                    Volume{' '}
                                    <span>
                                        {Math.round(settings.volume * 100)}%
                                    </span>
                                </label>
                                <input
                                    id="volume"
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={Math.round(settings.volume * 100)}
                                    onChange={(event) =>
                                        updateSetting(
                                            'volume',
                                            Number(event.target.value) / 100,
                                        )
                                    }
                                />
                            </fieldset>
                            <fieldset>
                                <legend>Practice guides</legend>
                                <label className="setting-row">
                                    Show keyboard
                                    <input
                                        type="checkbox"
                                        checked={settings.showKeyboard}
                                        onChange={(event) =>
                                            updateSetting(
                                                'showKeyboard',
                                                event.target.checked,
                                            )
                                        }
                                    />
                                </label>
                                <label className="setting-row">
                                    Show finger guidance
                                    <input
                                        type="checkbox"
                                        checked={settings.showHands}
                                        onChange={(event) =>
                                            updateSetting(
                                                'showHands',
                                                event.target.checked,
                                            )
                                        }
                                    />
                                </label>
                            </fieldset>
                            <fieldset>
                                <legend>Saved progress</legend>
                                <p>
                                    Keep a backup of your device-local progress,
                                    or recover sessions when saving is
                                    unavailable.
                                </p>
                                <button
                                    className="text-button"
                                    onClick={() => openDialog('recovery')}
                                >
                                    Manage saved progress
                                </button>
                            </fieldset>
                            <button
                                className="primary-button"
                                onClick={closeDialog}
                            >
                                Back to typing
                            </button>
                        </div>
                    )}
                    {dialog === 'lessons' && (
                        <>
                            <div className="setting-choices lesson-tracks">
                                <Choice
                                    value="amateur"
                                    selected={lessonTrack === 'amateur'}
                                    onClick={setLessonTrack}
                                >
                                    Foundations
                                </Choice>
                                <Choice
                                    value="pro"
                                    selected={lessonTrack === 'pro'}
                                    onClick={setLessonTrack}
                                >
                                    Advanced
                                </Choice>
                            </div>
                            <p className="field-help">
                                Earned stars carry forward across layouts.
                            </p>
                            <div className="lesson-list">
                                {lessonsForLayout(
                                    lessonTrack,
                                    settings.keyboardLayout,
                                ).map((lesson, index) => {
                                    const stars = Math.max(
                                        storage.getLessonProgress(lesson.id)
                                            ?.stars || 0,
                                        storage.getLessonProgress(lesson.id, {
                                            wpmMetric: 'words-v1',
                                        })?.stars || 0,
                                    );
                                    return (
                                        <button
                                            key={lesson.id}
                                            onClick={() =>
                                                loadLesson(lessonTrack, index)
                                            }
                                        >
                                            <span className="lesson-number">
                                                {String(index + 1).padStart(
                                                    2,
                                                    '0',
                                                )}
                                            </span>
                                            <span>
                                                <strong>
                                                    {lesson.title.replace(
                                                        /^Lesson \d+: /,
                                                        '',
                                                    )}
                                                </strong>
                                                <small>{lesson.subtitle}</small>
                                            </span>
                                            <span
                                                className="lesson-stars"
                                                role="img"
                                                aria-label={`Earned stars: ${stars} of 3`}
                                            >
                                                {'★'.repeat(stars)}
                                                {'☆'.repeat(3 - stars)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    {dialog === 'custom' && (
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                const text = normalizeCustomText(customText);
                                if (text) {
                                    setExercise({
                                        track: 'custom',
                                        id: 'custom',
                                        title: 'custom text',
                                        lines: [text],
                                    });
                                    setDialog(null);
                                }
                            }}
                        >
                            <label
                                className="field-label"
                                htmlFor="custom-text"
                            >
                                Text to practice
                            </label>
                            <textarea
                                id="custom-text"
                                rows="7"
                                maxLength="10000"
                                value={customText}
                                autoFocus
                                onChange={(event) =>
                                    setCustomText(event.target.value)
                                }
                                placeholder="Paste a passage, a paragraph, or something you want to remember."
                            />
                            <p className="field-help">
                                Up to 10,000 characters. Line breaks become
                                spaces. Invisible break markers are removed.
                            </p>
                            <div className="dialog-actions">
                                <button
                                    type="button"
                                    className="text-button"
                                    onClick={() =>
                                        setCustomText(CURRICULUM.quotes[3].text)
                                    }
                                >
                                    Try a quote
                                </button>
                                <button
                                    className="primary-button"
                                    disabled={!normalizeCustomText(customText)}
                                >
                                    Start practice
                                </button>
                            </div>
                        </form>
                    )}
                    {dialog === 'history' && (
                        <>
                            {storage.data.history.length > 0 && (
                                <SessionProgress
                                    history={storage.data.history}
                                />
                            )}
                            {storage.data.history.length > 0 && (
                                <p className="field-help">
                                    Earlier scores keep their original values.
                                    Personal bests compare scores using the same
                                    method.
                                </p>
                            )}
                            {storage.data.history.length ? (
                                <div className="history-table">
                                    <table>
                                        <caption>
                                            Last {storage.data.history.length}{' '}
                                            sessions ·{' '}
                                            {storage.saveFailed
                                                ? 'saving unavailable'
                                                : 'stored on this device'}
                                        </caption>
                                        <thead>
                                            <tr>
                                                <th scope="col">test</th>
                                                <th scope="col">wpm / raw</th>
                                                <th scope="col">accuracy</th>
                                                <th scope="col">time</th>
                                                <th scope="col">date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {storage.data.history.map(
                                                (entry, index) => (
                                                    <tr key={index}>
                                                        <td>
                                                            {sessionLabel(
                                                                entry,
                                                            )}
                                                            {entry.recordReason && (
                                                                <small className="history-note">
                                                                    {
                                                                        entry.recordReason
                                                                    }
                                                                </small>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {entry.wpm} /{' '}
                                                            {entry.rawWpm ??
                                                                '—'}
                                                            <small className="history-note">
                                                                {entry.wpmMetric ===
                                                                'words-v1'
                                                                    ? 'Correct-word scoring'
                                                                    : 'Earlier scoring'}
                                                            </small>
                                                        </td>
                                                        <td>
                                                            {entry.accuracy}%
                                                        </td>
                                                        <td>
                                                            {entry.elapsedMilliseconds !=
                                                            null
                                                                ? formatElapsedTime(
                                                                      entry.elapsedMilliseconds,
                                                                  )
                                                                : entry.elapsedSeconds !=
                                                                    null
                                                                  ? formatElapsedTime(
                                                                        entry.elapsedSeconds *
                                                                            1000,
                                                                    )
                                                                  : '—'}
                                                        </td>
                                                        <td>
                                                            {entry.date
                                                                ? new Date(
                                                                      entry.date,
                                                                  ).toLocaleDateString(
                                                                      undefined,
                                                                      {
                                                                          month: 'short',
                                                                          day: 'numeric',
                                                                      },
                                                                  )
                                                                : '—'}
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <h3>Your first session is waiting.</h3>
                                    <p>
                                        Finish a lesson or test to start
                                        tracking your progress.
                                    </p>
                                    <button
                                        className="primary-button"
                                        onClick={closeDialog}
                                    >
                                        Let's type
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </Dialog>
            )}
        </div>
    );
}
