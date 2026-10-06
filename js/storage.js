/** Persist preferences, lesson progress, and recent results. */

const STORAGE_KEY = 'apple_typing_tutor_data_v1';

const DEFAULT_DATA = {
    settings: {
        theme: 'dark',
        soundProfile: 'magic',
        volume: 0.6,
        soundMuted: false,
        typingMode: 'flow',
        showHands: false,
        showKeyboard: false,
        testMode: 'time',
        testDuration: 30,
        testWordCount: 25,
        punctuation: false,
        numbers: false
    },
    stats: {
        totalSessions: 0,
        totalKeystrokes: 0,
        totalTimeSeconds: 0,
        highestWpm: 0,
        wordHighestWpm: 0
    }
};

const SETTING_OPTIONS = {
    theme: ['dark', 'light', 'system'],
    soundProfile: ['magic', 'thock', 'bubble', 'clicky'],
    typingMode: ['strict', 'flow'],
    testMode: ['time', 'words'],
    testDuration: [15, 30, 60, 120],
    testWordCount: [10, 25, 50, 100]
};

const TEST_SETTINGS = ['testMode', 'testDuration', 'testWordCount', 'typingMode', 'punctuation',
    'numbers'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNumber = (value, maximum = Number.MAX_SAFE_INTEGER) => Number.isFinite(value) && value >= 0
    && value <= maximum;
const number = (value, maximum) => isNumber(value, maximum) ? value : 0;
const count = (value, maximum) => Number.isSafeInteger(value) ? number(value, maximum) : 0;
const validMetric = value => value === undefined || value === 'words-v1';

function validSetting(key, value) {
    if (!Object.hasOwn(DEFAULT_DATA.settings, key)) return false;
    if (Object.hasOwn(SETTING_OPTIONS, key)) return SETTING_OPTIONS[key].includes(value);
    if (key === 'volume') return isNumber(value, 1);
    return typeof value === 'boolean';
}

function progressKey(lessonId, options, settings) {
    const prefix = options?.wpmMetric === 'words-v1' ? 'words-v1:' : '';
    if (!validSetting('testMode', options?.testMode)) return prefix + lessonId;
    const mode = options.testMode;
    const lengthKey = mode === 'time' ? 'testDuration' : 'testWordCount';
    return `${prefix}test:${JSON.stringify([
        mode,
        validSetting(lengthKey, options[lengthKey]) ? options[lengthKey] : settings[lengthKey],
        validSetting('typingMode', options.typingMode) ? options.typingMode : settings.typingMode,
        validSetting('punctuation', options.punctuation) ? options.punctuation : settings.punctuation,
        validSetting('numbers', options.numbers) ? options.numbers : settings.numbers
    ])}`;
}

function historyEntry(value) {
    if (!isObject(value) || typeof value.lessonId !== 'string' || !value.lessonId
        || value.lessonId.length > 200 || !validMetric(value.wpmMetric)) return null;

    const entry = {
        lessonId: value.lessonId,
        wpm: number(value.wpm),
        accuracy: number(value.accuracy, 100),
        stars: count(value.stars, 3),
        date: typeof value.date === 'string' && value.date.length <= 64
            && Number.isFinite(Date.parse(value.date)) ? value
            .date : null
    };
    for (const key of ['rawWpm', 'consistency', 'elapsedSeconds', 'elapsedMilliseconds']) {
        if (isNumber(value[key], key === 'consistency' ? 100 : Number.MAX_SAFE_INTEGER)) entry[
            key] = value[key];
    }
    for (const key of TEST_SETTINGS) {
        if (validSetting(key, value[key])) entry[key] = value[key];
    }
    if (value.wpmMetric === 'words-v1') entry.wpmMetric = value.wpmMetric;
    for (const key of ['totalKeystrokes', 'correctKeystrokes', 'correctNonSpaceChars',
            'errorKeystrokes', 'skippedChars']) {
        if (Number.isSafeInteger(value[key]) && isNumber(value[key])) entry[key] = value[key];
    }
    if (typeof value.recordEligible === 'boolean') entry.recordEligible = value.recordEligible;
    if (typeof value.recordReason === 'string') entry.recordReason = value.recordReason.slice(0,
        200);
    return entry;
}

class StorageManager {
    constructor() {
        this.pendingLessons = [];
        this.data = this.load();
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', event => {
                if (event.key === STORAGE_KEY || event.key === null) this.refresh();
            });
        }
    }

    load() {
        const data = {
            settings: { ...DEFAULT_DATA.settings },
            progress: Object.create(null),
            history: [],
            stats: { ...DEFAULT_DATA.stats }
        };

        let raw;
        try {
            raw = localStorage.getItem(STORAGE_KEY);
            this.lastSavedRaw = raw;
            this.loadFailed = false;
            this.saveFailed = false;
            this.saveConflict = false;
            this.lockFailed = false;
        } catch (error) {
            this.loadFailed = true;
            this.saveFailed = true;
            console.warn('Failed to read from localStorage:', error);
            return data;
        }

        try {
            const parsed = JSON.parse(raw);
            if (!isObject(parsed)) return data;

            if (isObject(parsed.settings)) {
                for (const key of Object.keys(data.settings)) {
                    if (validSetting(key, parsed.settings[key])) data.settings[key] = parsed
                        .settings[key];
                }
            }
            if (isObject(parsed.progress)) {
                for (const [lessonId, progress] of Object.entries(parsed.progress)) {
                    if (!lessonId || !isObject(progress)) continue;
                    data.progress[lessonId] = {
                        completed: progress.completed === true,
                        bestWpm: number(progress.bestWpm),
                        bestAccuracy: number(progress.bestAccuracy, 100),
                        stars: count(progress.stars, 3)
                    };
                    for (const key of ['lastPlayed', 'timestamp']) {
                        if (isNumber(progress[key])) data.progress[lessonId][key] = progress[
                            key];
                    }
                }
            }
            if (Array.isArray(parsed.history)) {
                data.history = parsed.history.map(historyEntry).filter(Boolean).slice(0, 50);
            }
            if (isObject(parsed.stats)) {
                for (const key of Object.keys(data.stats)) {
                    data.stats[key] = key === 'totalSessions' || key === 'totalKeystrokes'
                        ? count(parsed.stats[key]) : number(parsed.stats[key]);
                }
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
        }
        return data;
    }

    refresh() {
        if (this.saveFailed || this.loadFailed) return;
        const latest = this.load();
        if (!this.loadFailed) this.data = latest;
    }

    async write(change) {
        let entered = false;
        try {
            const locks = globalThis.navigator?.locks;
            if (typeof locks?.request !== 'function') {
                // ponytail: unsupported contexts use sync refresh; enable Web Locks for concurrent saves.
                entered = true;
                return change();
            }
            return await locks.request(STORAGE_KEY, () => {
                entered = true;
                this.lockFailed = false;
                return change();
            });
        } catch (error) {
            if (entered) {
                this.saveFailed = true;
                throw error;
            }
            this.lockFailed = true;
            this.saveFailed = true;
            console.warn('Failed to lock localStorage:', error);
            return change();
        }
    }

    save() {
        // Preserve unread saved scores if storage was inaccessible at startup.
        if (this.loadFailed || this.lockFailed) return false;
        try {
            if (this.saveFailed && localStorage.getItem(STORAGE_KEY) !== this.lastSavedRaw) {
                this.saveConflict = true;
                return false;
            }
            const raw = JSON.stringify(this.data);
            localStorage.setItem(STORAGE_KEY, raw);
            this.lastSavedRaw = raw;
            this.saveFailed = false;
            this.saveConflict = false;
            return true;
        } catch (error) {
            this.saveFailed = true;
            console.warn('Failed to save to localStorage:', error);
            return false;
        }
    }

    async retrySave() {
        if (this.pendingLessons.length) return false;
        if (!this.saveFailed) return true;
        return this.write(() => {
            const saved = this.saveFailed ? this.save() : true;
            return saved && this.pendingLessons.length === 0;
        });
    }

    exportBackup() {
        const backup = {
            format: 'typeflow',
            version: 1,
            exportedAt: new Date().toISOString(),
            session: this.data,
            savedReadFailed: false
        };
        if (this.pendingLessons.length) backup.pendingLessons = this.pendingLessons;
        try {
            backup.savedRaw = localStorage.getItem(STORAGE_KEY);
        } catch {
            backup.savedReadFailed = true;
        }
        if (this.lastSavedRaw !== undefined && this.lastSavedRaw !== backup.savedRaw) {
            backup.baselineRaw = this.lastSavedRaw;
        }
        return JSON.stringify(backup, null, 2);
    }

    getSetting(key) {
        return Object.hasOwn(this.data.settings, key) ? this.data.settings[key] : undefined;
    }

    async setSetting(key, value) {
        if (!validSetting(key, value)) return false;
        return this.write(() => {
            this.refresh();
            this.data.settings[key] = value;
            return this.save();
        });
    }

    async recordLesson(lessonId, stats, targetWpm = 30, targetAccuracy = 95, testSettings = {}) {
        if (typeof lessonId !== 'string' || !lessonId || lessonId.length > 200 || !isObject(
                stats) || !validMetric(stats.wpmMetric)) {
            return {
                stars: 0,
                isNewBestWpm: false,
                recordEligible: false,
                recordReason: 'No typing result was recorded.'
            };
        }

        const wpm = number(stats.wpm);
        const accuracy = number(stats.accuracy, 100);
        targetWpm = isNumber(targetWpm) ? targetWpm : 30;
        targetAccuracy = isNumber(targetAccuracy, 100) ? targetAccuracy : 95;
        const elapsedSeconds = isNumber(stats.elapsedMilliseconds)
            ? stats.elapsedMilliseconds / 1000 : number(stats.elapsedSeconds);
        const correctInput = count(stats.correctKeystrokes) > 0
            && count(stats.correctKeystrokes) <= count(stats.totalKeystrokes)
            && (!Object.hasOwn(stats, 'correctNonSpaceChars') || count(stats
                .correctNonSpaceChars) > 0);
        const skipped = count(stats.skippedChars) > 0;
        const practiceOnly = testSettings?.recordEligible === false;
        const completed = correctInput && elapsedSeconds > 0 && !skipped && !practiceOnly;
        const recordReason = elapsedSeconds <= 0 ? 'The test has no measured typing time.'
            : !correctInput ? 'No correct characters were typed.'
            : skipped ? 'Skipped characters do not qualify for records.'
            : practiceOnly ? 'Practice sessions do not qualify for records.'
            : accuracy < targetAccuracy ? `Records need at least ${targetAccuracy}% accuracy.`
            : null;
        const recordEligible = recordReason === null;
        let stars = completed ? 1 : 0;
        if (completed && accuracy >= targetAccuracy) stars = wpm >= targetWpm ? 3 : 2;

        const timestamp = Date.now();
        const entry = historyEntry({
            ...testSettings,
            lessonId,
            wpmMetric: stats.wpmMetric,
            wpm,
            accuracy,
            stars,
            rawWpm: stats.rawWpm,
            consistency: stats.consistency,
            elapsedSeconds: stats.elapsedSeconds,
            elapsedMilliseconds: stats.elapsedMilliseconds,
            totalKeystrokes: stats.totalKeystrokes,
            correctKeystrokes: stats.correctKeystrokes,
            correctNonSpaceChars: stats.correctNonSpaceChars,
            errorKeystrokes: stats.errorKeystrokes,
            skippedChars: stats.skippedChars,
            recordEligible,
            recordReason,
            date: new Date(timestamp).toISOString()
        });
        const key = progressKey(lessonId, entry, this.data.settings);
        this.pendingLessons.push(entry);
        return this.write(() => {
            this.refresh();

            const existing = this.data.progress[key] || {
                bestWpm: 0,
                bestAccuracy: 0,
                stars: 0
            };
            if (completed) {
                this.data.progress[key] = {
                    ...existing,
                    completed: true,
                    bestWpm: recordEligible ? Math.max(existing.bestWpm, wpm)
                        : existing
                        .bestWpm,
                    bestAccuracy: Math.max(existing.bestAccuracy, accuracy),
                    stars: Math.max(existing.stars, stars),
                    lastPlayed: timestamp
                };
            }

            this.data.stats.totalSessions = Math.min(Number.MAX_SAFE_INTEGER, this.data
                .stats
                .totalSessions + 1);
            this.data.stats.totalKeystrokes = Math.min(Number.MAX_SAFE_INTEGER, this
                .data.stats
                .totalKeystrokes + count(entry.totalKeystrokes));
            this.data.stats.totalTimeSeconds = Math.min(Number.MAX_SAFE_INTEGER, this
                .data.stats
                .totalTimeSeconds + elapsedSeconds);
            if (recordEligible) {
                const highest = entry.wpmMetric === 'words-v1' ? 'wordHighestWpm' :
                    'highestWpm';
                this.data.stats[highest] = Math.max(this.data.stats[highest], wpm);
            }

            this.data.history.unshift(entry);
            this.data.history.length = Math.min(this.data.history.length, 50);
            this.pendingLessons.splice(this.pendingLessons.indexOf(entry), 1);

            return {
                stars,
                isNewBestWpm: recordEligible && wpm > existing.bestWpm,
                recordEligible,
                recordReason,
                saved: this.save()
            };
        });
    }

    getLessonProgress(lessonId, options) {
        if (!validMetric(options?.wpmMetric)) return null;
        return this.data.progress[progressKey(lessonId, options, this.data.settings)] || null;
    }

    getAllProgress() {
        return this.data.progress;
    }

    getStats() {
        return this.data.stats;
    }
}

export const storage = new StorageManager();
