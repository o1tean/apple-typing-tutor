import React from 'react';
import { historyProgress } from '../js/progress.js';

function DailyTrend({ days, metric, label, maximum, unit }) {
    const x = (index) => (index / (days.length - 1)) * 100;
    const y = (day) => 100 - (day[metric] / maximum) * 100;
    return (
        <div className="chart">
            <h4>{label}</h4>
            <div className="chart-grid">
                <div className="chart-y-axis" aria-hidden="true">
                    <span>
                        {maximum}
                        {unit}
                    </span>
                    <span>0{unit}</span>
                </div>
                <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`${label} daily averages. Vertical axis: 0 to ${maximum}${unit}.`}
                    aria-describedby="progress-description"
                    focusable="false"
                >
                    {[0, 100].map((value) => (
                        <line
                            key={value}
                            x1="0"
                            x2="100"
                            y1={value}
                            y2={value}
                        />
                    ))}
                    {days.map(
                        (day, index) =>
                            day[metric] !== null && (
                                <g key={day.date}>
                                    {index > 0 &&
                                        days[index - 1][metric] !== null && (
                                            <polyline
                                                points={`${x(index - 1)},${y(days[index - 1])} ${x(index)},${y(day)}`}
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        )}
                                    <path
                                        d={`M${x(index)} ${y(day)}l0 0`}
                                        stroke="var(--accent)"
                                        strokeWidth="5"
                                        strokeLinecap="round"
                                        vectorEffect="non-scaling-stroke"
                                    >
                                        <title>
                                            {day.label}:{' '}
                                            {day[metric].toFixed(1)}
                                            {unit}
                                        </title>
                                    </path>
                                </g>
                            ),
                    )}
                </svg>
                <div className="chart-x-axis" aria-hidden="true">
                    <span>{days[0].label}</span>
                    <span>{days.at(-1).label}</span>
                </div>
            </div>
        </div>
    );
}

export default function SessionProgress({ history }) {
    const { days, currentStreak, longestStreak } = historyProgress(history);
    const measuredDays = days.filter((day) => day.measuredSessions > 0).length;
    return (
        <section className="practice-progress" aria-label="Practice progress">
            <dl className="progress-streaks">
                {[
                    ['Current streak', currentStreak],
                    ['Longest saved streak', longestStreak],
                ].map(([label, count]) => (
                    <div key={label}>
                        <dt>{label}</dt>
                        <dd>
                            {count}{' '}
                            <small>{count === 1 ? 'day' : 'days'}</small>
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="field-help">
                Consecutive local days with a recorded session. Your current
                streak stays active if you practiced today or yesterday. Based
                on retained sessions; older activity may be missing.
            </p>
            <h3>Last 14 days</h3>
            <p className="field-help" id="progress-description">
                Daily session averages across all exercises and input modes.
                Gaps mean no measured session with current scoring; they are not
                zero scores.
            </p>
            {measuredDays > 0 ? (
                <div className="progress-charts">
                    <DailyTrend
                        days={days}
                        metric="wpm"
                        label="WPM"
                        unit=""
                        maximum={Math.max(
                            20,
                            Math.ceil(
                                Math.max(...days.map((day) => day.wpm || 0)) /
                                    10,
                            ) * 10,
                        )}
                    />
                    <DailyTrend
                        days={days}
                        metric="accuracy"
                        label="Accuracy"
                        unit="%"
                        maximum={100}
                    />
                </div>
            ) : (
                <p className="field-help">
                    Finish a session with measured typing time to see daily
                    averages.
                </p>
            )}
            {measuredDays === 1 && (
                <p className="field-help">
                    One day of measured scores; no trend yet.
                </p>
            )}
            <details>
                <summary>View daily averages</summary>
                <table>
                    <caption>Daily practice · local dates</caption>
                    <thead>
                        <tr>
                            <th scope="col">Date</th>
                            <th scope="col">Sessions</th>
                            <th scope="col">WPM</th>
                            <th scope="col">Accuracy</th>
                        </tr>
                    </thead>
                    <tbody>
                        {days.map((day) => (
                            <tr key={day.date}>
                                <th scope="row">
                                    <time dateTime={day.date}>{day.label}</time>
                                </th>
                                <td>{day.sessions}</td>
                                <td>
                                    {day.wpm === null
                                        ? '—'
                                        : day.wpm.toFixed(1)}
                                </td>
                                <td>
                                    {day.accuracy === null
                                        ? '—'
                                        : `${day.accuracy.toFixed(1)}%`}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </section>
    );
}
