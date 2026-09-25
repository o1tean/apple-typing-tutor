/**
 * Apple-grade Typing Engine
 * Supports Strict (TypingMe touch typing tutor) & Flow modes,
 * Smooth floating caret interpolation, line progression, and precision metrics.
 */

export class TypingEngine {
  constructor(options = {}) {
    this.mode = options.mode || 'strict'; // 'strict' or 'flow'
    this.lines = [];
    this.currentLineIndex = 0;
    this.currentCharIndex = 0;
    this.typedChars = []; // Array of { char, status: 'correct'|'incorrect'|'pending', typed }

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
    this.errorKeystrokes = 0;
    this.errorsByChar = {}; // { 's': 3, 'a': 1 }
    this.keystrokeIntervals = [];
    this.lastKeystrokeTime = null;

    // Callbacks
    this.onCharTyped = options.onCharTyped || (() => {});
    this.onTick = options.onTick || (() => {});
    this.onLineComplete = options.onLineComplete || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
  }

  loadExercise(lines, timedDuration = 0) {
    this.reset();
    this.lines = (Array.isArray(lines) ? lines : [lines]).filter(line => typeof line === 'string' && line.length > 0);
    this.timedDuration = timedDuration;
    this.timeRemaining = timedDuration;
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
    this.errorKeystrokes = 0;
    this.errorsByChar = {};
    this.keystrokeIntervals = [];
    this.lastKeystrokeTime = null;
  }

  getCurrentChar() {
    if (this.currentCharIndex < this.typedChars.length) {
      return this.typedChars[this.currentCharIndex].char;
    }
    return null;
  }

  handleKey(keyEvent) {
    if (this.isComplete || this.isPaused || keyEvent.isComposing ||
        keyEvent.metaKey || ((keyEvent.ctrlKey || keyEvent.altKey) && !keyEvent.getModifierState?.('AltGraph'))) return;

    // Check the deadline before accepting another keystroke.
    if (this.isRunning) this.updateTick();
    if (this.isComplete) return;

    // Backspace handling in flow mode
    if (keyEvent.key === 'Backspace') {
      if (this.mode === 'flow' && this.currentCharIndex > 0) {
        this.currentCharIndex--;
        if (this.typedChars[this.currentCharIndex].status === 'correct') this.netCorrectChars--;
        this.typedChars[this.currentCharIndex].status = 'pending';
        this.typedChars[this.currentCharIndex].typed = '';
        this.onCharTyped(null, true, this.getCurrentChar());
        this.updateTick();
      }
      return;
    }

    // Single character input
    if (Array.from(keyEvent.key).length !== 1) return;

    const typedChar = keyEvent.key;
    const targetChar = this.getCurrentChar();

    if (!targetChar) return;

    if (!this.isRunning) this.start();
    const now = performance.now();
    if (this.lastKeystrokeTime !== null) {
      this.keystrokeIntervals.push(now - this.lastKeystrokeTime);
    }
    this.lastKeystrokeTime = now;

    this.totalKeystrokes++;

    if (this.mode === 'strict') {
      // Touch-typing tutor strict mode: must type correct char before advancing
      if (typedChar === targetChar) {
        this.correctKeystrokes++;
        this.netCorrectChars++;
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
      // Flow mode: advance always, can backspace
      const isCorrect = typedChar === targetChar;
      if (isCorrect) {
        this.correctKeystrokes++;
        this.netCorrectChars++;
        this.typedChars[this.currentCharIndex].status = 'correct';
      } else {
        this.errorKeystrokes++;
        this.errorsByChar[targetChar] = (this.errorsByChar[targetChar] || 0) + 1;
        this.typedChars[this.currentCharIndex].status = 'incorrect';
        this.onError(targetChar, typedChar);
      }
      this.typedChars[this.currentCharIndex].typed = typedChar;
      this.currentCharIndex++;

      if (this.currentCharIndex >= this.typedChars.length) {
        this.advanceLine();
      } else {
        this.onCharTyped(typedChar, isCorrect, this.getCurrentChar());
      }
    }

    this.updateTick();
  }

  advanceLine() {
    this.currentLineIndex++;
    // Timed tests continue through the word pool until their deadline.
    if (this.timedDuration > 0 && this.currentLineIndex >= this.lines.length) {
      this.currentLineIndex = 0;
    }

    if (this.currentLineIndex < this.lines.length) {
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
      Math.max(0, ((this.endTime ?? this.pauseTime ?? performance.now()) - this.startTime) / 1000);
    if (this.timedDuration > 0) elapsedSeconds = Math.min(this.timedDuration, elapsedSeconds);
    this.timeRemaining = Math.max(0, this.timedDuration - elapsedSeconds);
    const elapsedMinutes = Math.max(0.005, elapsedSeconds / 60);

    // Standard typing WPM: 5 characters = 1 word
    const wpm = Math.round((this.netCorrectChars / 5) / elapsedMinutes);
    const rawWpm = Math.round((this.totalKeystrokes / 5) / elapsedMinutes);
    const cpm = Math.round(this.netCorrectChars / elapsedMinutes);

    const accuracy = this.totalKeystrokes > 0
      ? Math.round((this.correctKeystrokes / this.totalKeystrokes) * 1000) / 10
      : 100;

    // Consistency score (0-100%): based on variance of keystroke intervals
    let consistency = 100;
    if (this.keystrokeIntervals.length > 5) {
      const intervals = this.keystrokeIntervals.slice(-30);
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      const cv = stdDev / (mean || 1); // coefficient of variation
      consistency = Math.max(20, Math.min(100, Math.round(100 - cv * 45)));
    }

    return {
      wpm: Math.max(0, wpm),
      rawWpm: Math.max(0, rawWpm),
      cpm: Math.max(0, cpm),
      accuracy: Math.max(0, accuracy),
      consistency,
      elapsedSeconds: Math.round(elapsedSeconds),
      timeRemaining: Math.ceil(this.timeRemaining),
      totalKeystrokes: this.totalKeystrokes,
      correctKeystrokes: this.correctKeystrokes,
      errorKeystrokes: this.errorKeystrokes,
      errorsByChar: this.errorsByChar,
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
