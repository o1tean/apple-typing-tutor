/**
 * Apple-grade Persistence & Progress Tracker
 * Saves lesson stars, high scores, accuracy history, and user preferences.
 */

const STORAGE_KEY = 'apple_typing_tutor_data_v1';

const DEFAULT_DATA = {
  settings: {
    theme: 'dark', // 'dark', 'light', 'system'
    soundProfile: 'magic', // 'magic', 'thock', 'bubble', 'clicky'
    volume: 0.6,
    soundMuted: false,
    typingMode: 'strict', // 'strict' (TypingMe style tutor) or 'flow'
    showHands: true,
    showKeyboard: true
  },
  progress: {
    // 'amat-1': { completed: true, bestWpm: 42, bestAccuracy: 98, stars: 3, timestamp: ... }
  },
  history: [], // recent completed sessions
  stats: {
    totalSessions: 0,
    totalKeystrokes: 0,
    totalTimeSeconds: 0,
    highestWpm: 0
  }
};

class StorageManager {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) },
          progress: parsed.progress || {},
          history: parsed.history || [],
          stats: { ...DEFAULT_DATA.stats, ...(parsed.stats || {}) }
        };
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  getSetting(key) {
    return this.data.settings[key];
  }

  setSetting(key, val) {
    this.data.settings[key] = val;
    this.save();
  }

  recordLesson(lessonId, stats, targetWpm = 30, targetAccuracy = 95) {
    // Calculate stars (1 to 3) based on targets:
    // 1 star: completed
    // 2 stars: accuracy >= targetAccuracy
    // 3 stars: accuracy >= targetAccuracy && wpm >= targetWpm
    let stars = 1;
    if (stats.accuracy >= targetAccuracy) stars = 2;
    if (stats.accuracy >= targetAccuracy && stats.wpm >= targetWpm) stars = 3;

    const existing = this.data.progress[lessonId] || { bestWpm: 0, bestAccuracy: 0, stars: 0 };
    const newBestWpm = Math.max(existing.bestWpm, stats.wpm);
    const newBestAcc = Math.max(existing.bestAccuracy, stats.accuracy);
    const newStars = Math.max(existing.stars, stars);

    this.data.progress[lessonId] = {
      completed: true,
      bestWpm: newBestWpm,
      bestAccuracy: newBestAcc,
      stars: newStars,
      lastPlayed: Date.now()
    };

    // Global stats
    this.data.stats.totalSessions++;
    this.data.stats.totalKeystrokes += stats.totalKeystrokes;
    this.data.stats.totalTimeSeconds += stats.elapsedSeconds;
    this.data.stats.highestWpm = Math.max(this.data.stats.highestWpm, stats.wpm);

    this.data.history.unshift({
      lessonId,
      wpm: stats.wpm,
      accuracy: stats.accuracy,
      stars,
      date: new Date().toISOString()
    });

    if (this.data.history.length > 50) {
      this.data.history.pop();
    }

    this.save();
    return { stars, isNewBestWpm: stats.wpm > existing.bestWpm };
  }

  getLessonProgress(lessonId) {
    return this.data.progress[lessonId] || null;
  }

  getAllProgress() {
    return this.data.progress;
  }

  getStats() {
    return this.data.stats;
  }
}

export const storage = new StorageManager();
