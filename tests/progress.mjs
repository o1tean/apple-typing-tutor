import assert from 'node:assert/strict';
import { historyProgress } from '../js/progress.js';

const originalTimezone = process.env.TZ;
const session = (date, extras = {}) => ({
    date: new Date(`${date}T12:00:00`).toISOString(),
    wpmMetric: 'words-v1',
    wpm: 40,
    accuracy: 95,
    elapsedMilliseconds: 30000,
    ...extras
});

try {
    process.env.TZ = 'Europe/Bucharest';
    const now = new Date('2026-10-07T18:00:00');
    const empty = historyProgress([], now);
    assert.equal(empty.days.length, 14);
    assert.equal(empty.days[0].date, '2026-09-24');
    assert.equal(empty.days.at(-1).date, '2026-10-07');
    assert.ok(empty.days.every(day => day.sessions === 0 && day.measuredSessions === 0
        && day.wpm === null && day.accuracy === null && day.label));
    assert.equal(empty.currentStreak, 0);
    assert.equal(empty.longestStreak, 0);

    const history = Object.freeze([
        session('2026-10-05', { wpm: 60.1, accuracy: 91.1 }),
        session('2026-10-07', { wpm: 0, accuracy: 0 }),
        session('2026-10-02'),
        session('2026-10-04', { wpmMetric: undefined, wpm: 999 }),
        session('2026-10-05', { wpm: 60.3, accuracy: 91.3 })
    ].map(Object.freeze));
    const before = JSON.stringify(history);
    const mixed = historyProgress(history, now);
    const day = date => mixed.days.find(item => item.date === date);
    assert.equal(mixed.currentStreak, 1, 'a missing yesterday breaks the current run');
    assert.equal(mixed.longestStreak, 2, 'duplicate days cannot extend a streak');
    assert.equal(day('2026-10-05').sessions, 2);
    assert.equal(day('2026-10-05').measuredSessions, 2);
    assert.ok(Math.abs(day('2026-10-05').wpm - 60.2) < 1e-10);
    assert.ok(Math.abs(day('2026-10-05').accuracy - 91.2) < 1e-10,
        'daily arithmetic means preserve precision until presentation');
    assert.equal(day('2026-10-06').wpm, null, 'missing activity is not zero WPM');
    assert.equal(day('2026-10-04').sessions, 1);
    assert.equal(day('2026-10-04').wpm, null, 'legacy activity never mixes scoring methods');
    assert.equal(day('2026-10-07').wpm, 0, 'a measured zero is retained');
    assert.equal(JSON.stringify(history), before, 'aggregation never rewrites history');

    const yesterday = historyProgress([
        session('2026-10-06'), session('2026-10-05'), session('2026-10-04'),
        session('2026-09-01'), session('2026-09-02'), session('2026-09-03'),
        session('2026-09-04')
    ], now);
    assert.equal(yesterday.currentStreak, 3, 'today is allowed to remain unfinished');
    assert.equal(yesterday.longestStreak, 4, 'retained activity beyond the chart counts');
    assert.equal(historyProgress([session('2026-10-05')], now).currentStreak, 0);

    const filtered = historyProgress([
        null, { date: null }, { date: 'invalid' },
        session('2026-10-08'),
        session('2026-10-07', { date: new Date(now.getTime() + 1).toISOString() }),
        session('2026-10-07', {
            date: now.toISOString(),
            elapsedMilliseconds: 0,
            elapsedSeconds: 30
        }),
        session('2026-10-07', {
            elapsedMilliseconds: undefined,
            elapsedSeconds: 0.125,
            wpm: 0.125
        }),
        session('2026-10-07', { elapsedMilliseconds: undefined }),
        session('2026-10-07', { wpmMetric: 'words-v2' }),
        session('2026-10-07', { accuracy: Infinity }),
        session('2026-10-07', { wpm: -1 })
    ], now);
    assert.equal(filtered.days.at(-1).sessions, 6,
        'invalid and future timestamps are excluded even within today');
    assert.equal(filtered.days.at(-1).measuredSessions, 1);
    assert.equal(filtered.days.at(-1).wpm, 0.125,
        'seconds fallback supports older measured sessions without rounding');
    assert.equal(filtered.currentStreak, 1);

    for (const [timezone, dates] of [
        ['Europe/Bucharest', ['2026-03-28', '2026-03-29', '2026-03-30']],
        ['Europe/Bucharest', ['2026-10-24', '2026-10-25', '2026-10-26']],
        ['America/New_York', ['2026-03-07', '2026-03-08', '2026-03-09']],
        ['America/New_York', ['2026-10-31', '2026-11-01', '2026-11-02']],
        ['Pacific/Auckland', ['2025-12-31', '2026-01-01', '2026-01-02']]
    ]) {
        process.env.TZ = timezone;
        const end = new Date(`${dates.at(-1)}T18:00:00`);
        const result = historyProgress(dates.map(date => session(date)), end);
        assert.equal(result.currentStreak, 3, `${timezone} uses calendar days across clocks`);
        assert.equal(result.longestStreak, 3);
        assert.deepEqual(result.days.slice(-3).map(item => item.date), dates);
        assert.equal(new Set(result.days.map(item => item.date)).size, 14);
    }
    process.env.TZ = 'America/New_York';
    const local = historyProgress([
        session('2026-10-06', { date: '2026-10-07T02:00:00.000Z' })
    ], new Date('2026-10-07T12:00:00'));
    assert.equal(local.days.at(-2).sessions, 1, 'UTC timestamps belong to the local date');
    assert.equal(local.days.at(-1).sessions, 0);
    assert.equal(local.currentStreak, 1);
    console.log(
        'Progress checks passed: dated gaps, retained streaks, scoring, precision and local DST.'
    );
} finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
}
