import assert from 'node:assert/strict';
import { TypingEngine } from '../js/engine.js';
import { CURRICULUM } from '../js/lessons.js';
import { sound } from '../js/audio.js';

let now = 0;
const originalNow = performance.now;
performance.now = () => now;
const engine = new TypingEngine();
const type = text => {
  for (const key of text) engine.handleKey({ key });
};

try {
  // Every course must render the next line before its notification and finish once.
  for (const lesson of [...CURRICULUM.amateur, ...CURRICULUM.pro]) {
    let completions = 0;
    engine.onComplete = () => completions++;
    engine.onLineComplete = index => {
      if (index < engine.lines.length) {
        assert.equal(engine.typedChars.map(item => item.char).join(''), lesson.lines[index]);
        assert.equal(engine.currentCharIndex, 0);
      }
    };
    engine.loadExercise(lesson.lines);
    for (const line of lesson.lines) {
      now += 1000;
      type(line);
    }
    assert.equal(completions, 1, lesson.id);
    assert.equal(engine.getStats().accuracy, 100);
    const finished = engine.getStats();
    now += 60_000;
    assert.deepEqual(engine.getStats(), finished, 'finished statistics stay frozen');
    type('x');
    assert.equal(completions, 1);
  }
  engine.onComplete = () => {};
  engine.onLineComplete = () => {};

  engine.loadExercise(['', 'a😀b', '']);
  for (const key of ['Backspace', 'Enter', 'Delete', 'Shift', 'Tab', 'Escape', 'F1', 'ArrowLeft']) {
    engine.handleKey({ key });
  }
  for (const modifier of ['metaKey', 'ctrlKey', 'altKey', 'isComposing']) {
    engine.handleKey({ key: 'a', [modifier]: true });
  }
  assert.equal(engine.isRunning, false, 'navigation and shortcuts do not start a session');
  type('x');
  assert.equal(engine.currentCharIndex, 0, 'strict mode holds its place after mistakes');
  type('a😀b');
  assert.equal(engine.isComplete, true, 'empty lines and Unicode code points do not block completion');
  assert.equal(engine.getStats().accuracy, 75);

  // No deleted/retyped character may inflate speed; mistakes still count as attempts.
  engine.mode = 'flow';
  engine.loadExercise('abc');
  type('a');
  engine.handleKey({ key: 'Backspace' });
  type('ax');
  engine.handleKey({ key: 'Backspace' });
  type('b');
  assert.equal(engine.netCorrectChars, 2);
  assert.equal(engine.correctKeystrokes, 3);
  assert.equal(engine.getStats().accuracy, 75);
  assert.equal(engine.getStats().wpm, 80);

  for (const duration of [15, 30, 60]) {
    now = 0;
    engine.mode = 'strict';
    engine.loadExercise(['ab', 'cd'], duration);
    type('abcd');
    assert.equal(engine.isComplete, false, 'speed tests continue after exhausting the text');
    assert.equal(engine.getCurrentChar(), 'a');
    now = 1000;
    engine.updateTick();
    assert.equal(engine.getStats().timeRemaining, duration - 1);
    engine.pause();
    const paused = engine.getStats();
    now += 20_000;
    type('a');
    assert.deepEqual(engine.getStats(), paused, 'pause freezes input and elapsed time');
    engine.resume();
    now += (duration - 1) * 1000 + 250;
    type('a');
    assert.equal(engine.isComplete, true, 'expired input cannot add another keystroke');
    assert.equal(engine.totalKeystrokes, 4);
    assert.equal(engine.getStats().elapsedSeconds, duration);
    assert.equal(engine.getStats().timeRemaining, 0);
  }

  // A new exercise clears the previous countdown and typing history.
  engine.loadExercise('abcdefg');
  now += 1000;
  for (const key of 'abcdefg') {
    now += 100;
    type(key);
  }
  assert.equal(engine.timedDuration, 0);
  assert.equal(engine.getStats().consistency, 100);
  assert.equal(engine.keystrokeIntervals.length, 6, 'exclude the artificial first interval');

  // Zero volume must not create audio or ramp a zero gain back to an audible level.
  sound.setVolume(0);
  sound.playKey();
  sound.playError();
  sound.playSuccess();
  assert.equal(sound.ctx, null);

  const saved = new Map();
  globalThis.localStorage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value)
  };
  const { storage } = await import('../js/storage.js');
  const stats = engine.getStats();
  storage.recordLesson('amat-intro', stats);
  const originalProgress = { ...storage.getLessonProgress('amat-intro') };
  storage.recordLesson('custom', { ...stats, wpm: 100 });
  storage.recordLesson('speed-30', { ...stats, wpm: 80 });
  assert.deepEqual(storage.getLessonProgress('amat-intro'), originalProgress);
  assert.equal(storage.getStats().totalSessions, 3);
  assert.deepEqual(storage.load(), storage.data, 'scores survive saving and loading');

  console.log('Regression checks passed: all 22 lessons, line transitions, strict/flow input, timers, pause/resume, Unicode, sound and saved scores.');
} finally {
  engine.reset();
  performance.now = originalNow;
}
