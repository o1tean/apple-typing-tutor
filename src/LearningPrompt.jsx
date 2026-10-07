import { latestLesson, lessonsForLayout } from '../js/practice.js';

export default function LearningPrompt({
    history,
    progress,
    learning,
    focus,
    preset,
    onLesson,
    onPractice,
}) {
    const latest = latestLesson(history, progress);
    const lesson =
        latest && lessonsForLayout(latest.track, preset)[latest.index];
    return (
        <aside
            className="learning-prompt lesson-instructions"
            aria-label="Return to learning"
        >
            {lesson && (
                <div className="learning-return">
                    <div>
                        <strong>{lesson.title}</strong>
                        <p>
                            Start a fresh drill from your latest recorded
                            lesson.
                        </p>
                    </div>
                    <button
                        className="primary-button"
                        onClick={() => onLesson(latest.track, latest.index)}
                    >
                        Continue lesson
                    </button>
                </div>
            )}
            <details>
                <summary>Suggested key practice</summary>
                <section aria-label="Learning recommendation">
                    {focus.length ? (
                        <>
                            <p>
                                Selected from recent errors and relative reach
                                times across layouts.
                            </p>
                            <p>
                                {focus
                                    .map((key) => {
                                        const cell = learning.keys[key];
                                        return `${key === ' ' ? 'Space' : key}: ${(cell.recentErrorRate * 100).toFixed(1)}% recent errors${cell.latencySamples ? `, ${Math.round(cell.recentLatencyMs)} ms recent reach` : ', no reach timing yet'}`;
                                    })
                                    .join(' · ')}
                            </p>
                            {focus.some(
                                (key) =>
                                    learning.keys[key].attempts < 5 ||
                                    (learning.keys[key].latencySamples > 0 &&
                                        learning.keys[key].latencySamples < 5),
                            ) && (
                                <p>
                                    Early suggestion — only a few observations
                                    so far.
                                </p>
                            )}
                        </>
                    ) : (
                        <p>
                            {learning.version > 1
                                ? 'Key recommendations are unavailable for this newer saved profile. Your progress is preserved.'
                                : 'No key recommendation yet. Complete a lesson or test to gather more observations.'}
                        </p>
                    )}
                </section>
            </details>
            {focus.length > 0 && (
                <button className="text-button" onClick={onPractice}>
                    Practice weak keys
                </button>
            )}
        </aside>
    );
}
