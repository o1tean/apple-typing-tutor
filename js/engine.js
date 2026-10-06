/** Typing state, word submission, line progression, and measured test statistics. */

import { readSessionLearning } from './learning.js';

export class TypingEngine {
    constructor(options = {}) {
        this.mode = options.mode || 'strict'; // 'strict' or 'flow'
        this.lines = [];
        this.currentLineIndex = 0;
        this.currentCharIndex = 0;
        this.typedChars = []; // Target characters and their input status.

        this.isRunning = false;
        this.isPaused = false;
        this.isComplete = false;

        // Time tracking
        this.startTime = null;
        this.endTime = null;
        this.pauseTime = null;
        this.timerId = null;
        this.timedDuration = 0; // if > 0, countdown mode (e.g. 30s)
        this.timeRemaining = 0;

        // Keystroke statistics
        this.totalKeystrokes = 0;
        this.correctKeystrokes = 0;
        this.netCorrectChars = 0;
        this.completedWordChars = 0;
        this.correctNonSpaceChars = 0;
        this.netTypedChars = 0;
        this.errorKeystrokes = 0;
        this.skippedChars = 0;
        this.errorsByChar = {}; // { 's': 3, 'a': 1 }
        this.keystrokeIntervals = [];
        this.lastKeystrokeTime = null;
        this.learning = { keys: Object.create(null), bigrams: Object.create(null) };
        this.learningPrevious = this.learningLinePrevious = null;
        this.learningSnapshot = null;
        this.learningTimingBreak = false;

        // Callbacks
        this.onCharTyped = options.onCharTyped || (() => {});
        this.onTick = options.onTick || (() => {});
        this.onLineComplete = options.onLineComplete || (() => {});
        this.onComplete = options.onComplete || (() => {});
        this.onError = options.onError || (() => {});
    }

    loadExercise(lines, timedDuration = 0) {
        this.reset();
        this.lines = (Array.isArray(lines) ? lines : [lines]).filter(line => typeof line ===
            'string' && line.length > 0);
        this.timedDuration = Number.isFinite(timedDuration) && timedDuration > 0 ? timedDuration
            : 0;
        this.timeRemaining = this.timedDuration;
        this.setupCurrentLine();
    }

    setupCurrentLine() {
        if (this.currentLineIndex >= this.lines.length) {
            this.finish();
            return;
        }

        const lineText = this.lines[this.currentLineIndex];
        this.currentCharIndex = 0;
        this.typedChars = Array.from(lineText).map(char => ({
            char,
            status: 'pending',
            typed: ''
        }));
    }

    start() {
        if (this.isRunning || this.isPaused || this.isComplete) return;
        this.isRunning = true;
        this.isPaused = false;
        this.startTime = performance.now();

        this.timerId = setInterval(() => {
            this.updateTick();
        }, 100);
    }

    pause() {
        if (!this.isRunning || this.isPaused) return;
        this.updateTick();
        if (this.isComplete) return;
        this.pauseTime = performance.now();
        this.isPaused = true;
    }

    resume() {
        if (!this.isPaused) return;
        this.startTime += performance.now() - this.pauseTime;
        this.pauseTime = null;
        this.lastKeystrokeTime = null;
        this.isPaused = false;
    }

    reset() {
        clearInterval(this.timerId);
        this.timerId = null;
        this.isRunning = false;
        this.isPaused = false;
        this.isComplete = false;
        this.currentLineIndex = 0;
        this.currentCharIndex = 0;
        this.typedChars = [];
        this.startTime = null;
        this.endTime = null;
        this.pauseTime = null;
        this.timedDuration = 0;
        this.timeRemaining = 0;
        this.totalKeystrokes = 0;
        this.correctKeystrokes = 0;
        this.netCorrectChars = 0;
        this.completedWordChars = 0;
        this.correctNonSpaceChars = 0;
        this.netTypedChars = 0;
        this.errorKeystrokes = 0;
        this.skippedChars = 0;
        this.errorsByChar = {};
        this.keystrokeIntervals = [];
        this.lastKeystrokeTime = null;
        this.learning = { keys: Object.create(null), bigrams: Object.create(null) };
        this.learningPrevious = this.learningLinePrevious = null;
        this.learningSnapshot = null;
        this.learningTimingBreak = false;
    }

    measureLearning(target, error, latency, advance = true) {
        const key = typeof target === 'string' && /^[\x20-\x7e]$/.test(target) ? target
            .toLowerCase() : null;
        if (key !== null) {
            const pairs = [['keys', key]];
            if (this.learningPrevious !== null) pairs.push(['bigrams', this.learningPrevious +
                key]);
            for (const [name, id] of pairs) {
                const cell = this.learning[name][id] ||= {
                    attempts: 0,
                    errors: 0,
                    latencySamples: 0,
                    latencyTotalMs: 0
                };
                cell.attempts++;
                cell.errors += Number(error);
                if (Number.isFinite(latency) && latency >= 0) {
                    cell.latencySamples++;
                    cell.latencyTotalMs += latency;
                }
            }
            this.learningSnapshot = null;
        } else this.learningTimingBreak = true;
        if (advance) this.learningPrevious = key;
    }

    getCurrentChar() {
        if (this.currentCharIndex < this.typedChars.length) {
            return this.typedChars[this.currentCharIndex].char;
        }
        return null;
    }

    handleKey(keyEvent) {
        const wordBackspace = keyEvent.key === 'Backspace' && (keyEvent.ctrlKey || keyEvent
            .altKey);
        if (this.isComplete || this.isPaused || keyEvent.isComposing ||
            keyEvent.keyCode === 229 || keyEvent.metaKey ||
            ((keyEvent.ctrlKey || keyEvent.altKey) && !wordBackspace &&
                !keyEvent.getModifierState?.('AltGraph'))) return;

        // Check the deadline before accepting another keystroke.
        if (this.isRunning) this.updateTick();
        if (this.isComplete) return;

        // Backspace handling in flow mode
        if (keyEvent.key === 'Backspace') {
            if (this.mode === 'flow' && this.deleteBackward()) {
                if (wordBackspace) {
                    while (this.currentCharIndex > 0 && this.typedChars[this.currentCharIndex -
                            1].char !== ' ') {
                        this.deleteBackward();
                    }
                }
                this.onCharTyped(null, true, this.getCurrentChar());
                this.updateTick();
            }
            return;
        }

        // Single character input
        if (Array.from(keyEvent.key).length !== 1) return;

        const typedChar = keyEvent.key;
        const targetChar = this.getCurrentChar();

        if (targetChar === null && this.mode === 'strict') return;

        if (!this.isRunning) this.start();
        const now = performance.now();
        const latency = this.lastKeystrokeTime === null || this.learningTimingBreak ? null
            : now - this.lastKeystrokeTime;
        this.learningTimingBreak = false;
        if (this.lastKeystrokeTime !== null) {
            this.keystrokeIntervals.push(now - this.lastKeystrokeTime);
            if (this.keystrokeIntervals.length > 30) this.keystrokeIntervals.shift();
        }
        this.lastKeystrokeTime = now;

        this.totalKeystrokes++;

        if (this.mode === 'strict') {
            this.measureLearning(targetChar, typedChar !== targetChar, latency, typedChar ===
                targetChar);
            if (!this.typedChars[this.currentCharIndex].typed) this.netTypedChars++;
            // Touch-typing tutor strict mode: must type correct char before advancing
            if (typedChar === targetChar) {
                this.correctKeystrokes++;
                this.netCorrectChars++;
                if (typedChar !== ' ') this.correctNonSpaceChars++;
                this.typedChars[this.currentCharIndex].status = 'correct';
                this.typedChars[this.currentCharIndex].typed = typedChar;
                this.currentCharIndex++;

                // Check line completion
                if (this.currentCharIndex >= this.typedChars.length) {
                    this.advanceLine();
                } else {
                    this.onCharTyped(typedChar, true, this.getCurrentChar());
                }
            } else {
                // Mistake
                this.errorKeystrokes++;
                this.errorsByChar[targetChar] = (this.errorsByChar[targetChar] || 0) + 1;
                this.typedChars[this.currentCharIndex].status = 'incorrect';
                this.typedChars[this.currentCharIndex].typed = typedChar;
                this.onError(targetChar, typedChar);
                this.onCharTyped(typedChar, false, targetChar);
            }
        } else {
            // Flow input stays inside a word until Space submits it.
            if (typedChar === ' ') {
                this.submitWord(latency);
                this.updateTick();
                return;
            }
            this.netTypedChars++;
            if (targetChar === ' ' || targetChar === null) {
                this.measureLearning(targetChar, true, latency, false);
                this.typedChars.splice(this.currentCharIndex, 0, {
                    char: typedChar,
                    status: 'incorrect',
                    typed: typedChar,
                    extra: true
                });
                this.currentCharIndex++;
                this.errorKeystrokes++;
                this.errorsByChar[typedChar] = (this.errorsByChar[typedChar] || 0) + 1;
                this.onError(targetChar, typedChar);
                this.onCharTyped(typedChar, false, this.getCurrentChar());
                this.updateTick();
                return;
            }
            const isCorrect = typedChar === targetChar;
            this.measureLearning(targetChar, !isCorrect, latency);
            if (isCorrect) {
                this.correctKeystrokes++;
                this.netCorrectChars++;
                this.correctNonSpaceChars++;
                this.typedChars[this.currentCharIndex].status = 'correct';
            } else {
                this.errorKeystrokes++;
                this.errorsByChar[targetChar] = (this.errorsByChar[targetChar] || 0) + 1;
                this.typedChars[this.currentCharIndex].status = 'incorrect';
                this.onError(targetChar, typedChar);
            }
            this.typedChars[this.currentCharIndex].typed = typedChar;
            this.currentCharIndex++;

            if (this.currentCharIndex >= this.typedChars.length && this.timedDuration === 0 &&
                this.currentLineIndex === this.lines.length - 1 && this.typedChars.slice(
                    this.typedChars.findLastIndex(item => item.char === ' ') + 1).every(item =>
                    item.status === 'correct')) {
                this.advanceLine();
            } else {
                this.onCharTyped(typedChar, isCorrect, this.getCurrentChar());
            }
        }

        this.updateTick();
    }

    deleteBackward() {
        if (this.currentCharIndex === 0) return false;
        const previous = this.typedChars[this.currentCharIndex - 1];
        if (previous.char === ' ' && !previous.extra) {
            let wordStart = this.currentCharIndex - 2;
            while (wordStart >= 0 && this.typedChars[wordStart].char !== ' ') wordStart--;
            const previousWord = this.typedChars.slice(wordStart + 1, this.currentCharIndex -
                1);
            if (!previousWord.some(item => item.status === 'incorrect')) return false;
        }

        this.currentCharIndex--;
        const item = this.typedChars[this.currentCharIndex];
        if (item.status === 'correct') {
            this.netCorrectChars--;
            if (item.char !== ' ') this.correctNonSpaceChars--;
        }
        if (item.typed) this.netTypedChars--;
        if (item.extra) {
            this.typedChars.splice(this.currentCharIndex, 1);
        } else {
            item.status = 'pending';
            item.typed = '';
            delete item.skipped;
        }
        // Reopening a short word places the caret after its actual input.
        while (this.currentCharIndex > 0 && this.typedChars[this.currentCharIndex - 1]
            .skipped) {
            const skipped = this.typedChars[--this.currentCharIndex];
            skipped.status = 'pending';
            delete skipped.skipped;
        }
        const preceding = this.typedChars.slice(0, this.currentCharIndex).findLast(item => !item
            .extra)?.char;
        this.learningPrevious = preceding === undefined ? this.learningLinePrevious
            : /^[\x20-\x7e]$/.test(preceding) ? preceding.toLowerCase() : null;
        this.learningTimingBreak = true;
        return true;
    }

    submitWord(latency = null) {
        const firstSkipped = this.getCurrentChar();
        let skipped = false;
        while (this.currentCharIndex < this.typedChars.length && this.getCurrentChar() !==
            ' ') {
            const item = this.typedChars[this.currentCharIndex++];
            this.measureLearning(item.char, true, skipped ? null : latency);
            item.status = 'incorrect';
            item.skipped = true;
            this.skippedChars++;
            this.errorsByChar[item.char] = (this.errorsByChar[item.char] || 0) + 1;
            skipped = true;
        }
        if (skipped) this.onError(firstSkipped, ' ');

        const hasSeparator = this.currentCharIndex < this.typedChars.length;
        const hasFollowingLine = this.timedDuration > 0 || this.currentLineIndex < this.lines
            .length - 1;
        if (hasSeparator || hasFollowingLine) {
            this.measureLearning(' ', false, skipped ? null : latency);
            this.correctKeystrokes++;
            this.netCorrectChars++;
            this.netTypedChars++;
        } else {
            this.errorKeystrokes++;
            this.errorsByChar[' '] = (this.errorsByChar[' '] || 0) + 1;
            if (!skipped) this.onError(null, ' ');
        }
        if (hasSeparator) {
            const separator = this.typedChars[this.currentCharIndex++];
            separator.status = 'correct';
            separator.typed = ' ';
        }
        if (this.currentCharIndex >= this.typedChars.length)
            this.advanceLine(!hasSeparator && hasFollowingLine);
        else this.onCharTyped(' ', !skipped, this.getCurrentChar());
    }

    getWordCredit(includeSeparator = false) {
        let credit = 0;
        let wordLength = 0;
        let clean = true;
        for (let index = 0; index < this.currentCharIndex; index++) {
            const item = this.typedChars[index];
            if (item.char === ' ' && !item.extra) {
                if (clean && item.status === 'correct') credit += wordLength + 1;
                wordLength = 0;
                clean = true;
            } else {
                wordLength++;
                if (item.status !== 'correct' || item.extra || item.skipped) clean = false;
            }
        }
        return credit + (clean ? wordLength + Number(includeSeparator) : 0);
    }

    advanceLine(includeSeparator = false) {
        this.learningLinePrevious = this.learningPrevious;
        this.currentLineIndex++;
        // Timed tests continue through the word pool until their deadline.
        if (this.timedDuration > 0 && this.currentLineIndex >= this.lines.length) {
            this.currentLineIndex = 0;
        }

        if (this.currentLineIndex < this.lines.length) {
            this.completedWordChars += this.getWordCredit(includeSeparator);
            this.setupCurrentLine();
            this.onLineComplete(this.currentLineIndex, this.lines.length);
            this.onCharTyped('', true, this.getCurrentChar());
        } else {
            this.onLineComplete(this.currentLineIndex, this.lines.length);
            this.finish();
        }
    }

    updateTick() {
        if (!this.isRunning || this.isPaused || this.isComplete) return;

        const stats = this.getStats();

        if (this.timedDuration > 0) {
            if (this.timeRemaining <= 0) {
                this.finish();
                return;
            }
        }

        this.onTick(stats);
    }

    getStats() {
        let elapsedSeconds = this.startTime === null ? 0 :
            Math.max(0, ((this.endTime ?? this.pauseTime ?? performance.now()) - this.startTime)
                / 1000);
        if (this.timedDuration > 0) elapsedSeconds = Math.min(this.timedDuration,
            elapsedSeconds);
        this.timeRemaining = Math.max(0, this.timedDuration - elapsedSeconds);
        const elapsedMinutes = elapsedSeconds / 60;
        const wordChars = this.completedWordChars + this.getWordCredit();

        // Five characters in clean words or the current clean prefix make one word.
        const wpm = elapsedMinutes > 0 ? Math.round((wordChars / 5) / elapsedMinutes)
            : 0;
        const rawWpm = elapsedMinutes > 0 ? Math.round((this.netTypedChars / 5) /
            elapsedMinutes) : 0;
        const cpm = elapsedMinutes > 0 ? Math.round(wordChars / elapsedMinutes) : 0;

        const accuracyAttempts = this.totalKeystrokes + this.skippedChars;
        const accuracy = accuracyAttempts > 0
            ? Math.round((this.correctKeystrokes / accuracyAttempts) * 1000) / 10
            : 100;

        // Consistency is unavailable until enough measured intervals support a score.
        let consistency = null;
        if (this.keystrokeIntervals.length > 5) {
            const intervals = this.keystrokeIntervals.slice(-30);
            const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            if (mean > 0) {
                const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
                    intervals.length;
                const stdDev = Math.sqrt(variance);
                const cv = stdDev / mean; // coefficient of variation
                consistency = Math.max(20, Math.min(100, Math.round(100 - cv * 45)));
            }
        }

        return {
            wpmMetric: 'words-v1',
            wpm: Math.max(0, wpm),
            rawWpm: Math.max(0, rawWpm),
            cpm: Math.max(0, cpm),
            accuracy: Math.max(0, accuracy),
            consistency,
            elapsedMilliseconds: elapsedSeconds * 1000,
            elapsedSeconds: Math.round(elapsedSeconds),
            timeRemaining: Math.ceil(this.timeRemaining),
            totalKeystrokes: this.totalKeystrokes,
            correctKeystrokes: this.correctKeystrokes,
            correctNonSpaceChars: this.correctNonSpaceChars,
            errorKeystrokes: this.errorKeystrokes,
            skippedChars: this.skippedChars,
            errorsByChar: this.errorsByChar,
            learning: this.learningSnapshot ||= readSessionLearning(this.learning),
            currentLineIndex: this.currentLineIndex,
            totalLines: this.lines.length
        };
    }

    finish() {
        if (this.isComplete) return;
        this.isComplete = true;
        this.isRunning = false;
        this.endTime = this.pauseTime ?? performance.now();
        this.isPaused = false;
        clearInterval(this.timerId);
        this.timerId = null;

        const finalStats = this.getStats();
        this.onComplete(finalStats);
    }
}
