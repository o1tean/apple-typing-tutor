import {
    latestLesson,
    lessonsForLayout,
    focusLabel,
    practiceObservation,
} from '../js/practice.js';

export default function LearningPrompt({
    history,
    progress,
    learning,
    focus,
    pairFocus,
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
            {[
                ['keys', focus, 'key'],
                ['bigrams', pairFocus, 'pair'],
            ].map(([group, targets, label]) => (
                <div key={group}>
                    <details>
                        <summary>Suggested {label} practice</summary>
                        <section
                            aria-label={
                                group === 'keys'
                                    ? 'Learning recommendation'
                                    : 'Pair recommendation'
                            }
                        >
                            {targets.length ? (
                                <>
                                    <p>
                                        Selected from recent errors and relative
                                        reach times across layouts.
                                    </p>
                                    <p>
                                        {targets
                                            .map(
                                                (key) =>
                                                    `${focusLabel(key)}: ${practiceObservation(learning[group][key], true)}`,
                                            )
                                            .join(' · ')}
                                    </p>
                                </>
                            ) : (
                                <p>
                                    {learning.version > 1
                                        ? 'Recommendations are unavailable for this newer saved profile. Your progress is preserved.'
                                        : `No ${label} recommendation yet. Complete a lesson or test to gather more observations.`}
                                </p>
                            )}
                        </section>
                    </details>
                    {targets.length > 0 && (
                        <button
                            className="text-button"
                            onClick={() => onPractice(group)}
                        >
                            {group === 'keys'
                                ? 'Practice weak keys'
                                : `Practice this pair: ${focusLabel(targets[0])}`}
                        </button>
                    )}
                </div>
            ))}
        </aside>
    );
}
