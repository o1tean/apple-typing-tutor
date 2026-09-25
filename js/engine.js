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
    this.timerId = null;
    this.timedDuration = 0; // if > 0, countdown mode (e.g. 30s)
    this.timeRemaining = 0;

    // Keystroke statistics
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
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
    this.lines = Array.isArray(lines) ? lines : [lines];
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
    this.typedChars = lineText.split('').map(char => ({
      char,
      status: 'pending',
      typed: ''
    }));
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.startTime = performance.now();
    this.lastKeystrokeTime = this.startTime;

    this.timerId = setInterval(() => {
      this.updateTick();
    }, 100);
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
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
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
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
    if (this.isComplete) return;

    // Ignore special navigation/control keys
    const ignoreKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (ignoreKeys.includes(keyEvent.key)) {
      return;
    }

    // Start on first actual keypress
    if (!this.isRunning) {
      this.start();
    }

    const now = performance.now();
    if (this.lastKeystrokeTime) {
      this.keystrokeIntervals.push(now - this.lastKeystrokeTime);
    }
    this.lastKeystrokeTime = now;

    // Backspace handling in flow mode
    if (keyEvent.key === 'Backspace') {
      if (this.mode === 'flow' && this.currentCharIndex > 0) {
        this.currentCharIndex--;
        this.typedChars[this.currentCharIndex].status = 'pending';
        this.typedChars[this.currentCharIndex].typed = '';
        this.onCharTyped(null, true, this.getCurrentChar());
      }
      return;
    }

    // Single character input
    if (keyEvent.key.length !== 1) return;

    const typedChar = keyEvent.key;
    const targetChar = this.getCurrentChar();

    if (!targetChar) return;

    this.totalKeystrokes++;

    if (this.mode === 'strict') {
      // Touch-typing tutor strict mode: must type correct char before advancing
      if (typedChar === targetChar) {
        this.correctKeystrokes++;
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
    this.onLineComplete(this.currentLineIndex, this.lines.length);

    if (this.currentLineIndex < this.lines.length) {
      this.setupCurrentLine();
      this.onCharTyped('', true, this.getCurrentChar());
    } else {
      this.finish();
    }
  }

  updateTick() {
    if (!this.isRunning || this.isPaused || this.isComplete) return;

    const stats = this.getStats();

    if (this.timedDuration > 0) {
      const elapsedSec = (performance.now() - this.startTime) / 1000;
      this.timeRemaining = Math.max(0, this.timedDuration - elapsedSec);
      if (this.timeRemaining <= 0) {
        this.finish();
        return;
      }
    }

    this.onTick(stats);
  }

  getStats() {
    const elapsedMinutes = this.startTime ? Math.max(0.005, (performance.now() - this.startTime) / 60000) : 0.005;
    const elapsedSeconds = elapsedMinutes * 60;

    // Standard typing WPM: 5 characters = 1 word
    const wpm = Math.round((this.correctKeystrokes / 5) / elapsedMinutes);
    const rawWpm = Math.round((this.totalKeystrokes / 5) / elapsedMinutes);
    const cpm = Math.round(this.correctKeystrokes / elapsedMinutes);

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
    this.endTime = performance.now();
    clearInterval(this.timerId);

    const finalStats = this.getStats();
    this.onComplete(finalStats);
  }
}
