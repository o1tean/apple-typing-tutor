/** Summarize retained sessions without changing saved scores or filling activity gaps. */

const DAY_MS = 86400000;
const calendarDay = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;

export function historyProgress(history, now = new Date()) {
    const today = calendarDay(now);
    const activity = new Map();
    for (const entry of history) {
        if (typeof entry?.date !== 'string') continue;
        const date = new Date(entry.date);
        if (!Number.isFinite(date.getTime()) || date > now) continue;
        const day = calendarDay(date);
        const totals = activity.get(day) || {
            sessions: 0,
            measuredSessions: 0,
            wpm: 0,
            accuracy: 0
        };
        totals.sessions++;
        const elapsed = entry.elapsedMilliseconds ?? entry.elapsedSeconds * 1000;
        if (entry.wpmMetric === 'words-v1' && Number.isFinite(elapsed) && elapsed > 0
            && Number.isFinite(entry.wpm) && entry.wpm >= 0
            && Number.isFinite(entry.accuracy) && entry.accuracy >= 0 && entry.accuracy <= 100) {
            totals.measuredSessions++;
            totals.wpm += entry.wpm;
            totals.accuracy += entry.accuracy;
        }
        activity.set(day, totals);
    }

    let streak = 0;
    let longestStreak = 0;
    let previous = null;
    for (const day of [...activity.keys()].sort((a, b) => a - b)) {
        streak = day === previous + 1 ? streak + 1 : 1;
        longestStreak = Math.max(longestStreak, streak);
        previous = day;
    }
    const days = Array.from({ length: 14 }, (_, index) => {
        const day = today - 13 + index;
        const date = new Date(day * DAY_MS);
        const totals = activity.get(day);
        return {
            date: date.toISOString().slice(0, 10),
            label: date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC'
            }),
            sessions: totals?.sessions || 0,
            measuredSessions: totals?.measuredSessions || 0,
            wpm: totals?.measuredSessions ? totals.wpm / totals.measuredSessions : null,
            accuracy: totals?.measuredSessions ? totals.accuracy / totals.measuredSessions
                : null
        };
    });
    return { days, currentStreak: previous >= today - 1 ? streak : 0, longestStreak };
}
