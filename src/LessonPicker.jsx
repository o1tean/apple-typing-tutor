import { lessonPath, lessonsForLayout } from '../js/practice.js';

export default function LessonPicker({ track, preset, progress, onSelect }) {
    const path = lessonPath(lessonsForLayout(track, preset), progress);
    return (
        <>
            <section
                className="lesson-instructions"
                aria-label="Saved track progress"
            >
                <p>
                    <strong>
                        {path.completed} of {path.total} completed ·{' '}
                        {path.threeStar} of {path.total} with 3 stars
                    </strong>
                </p>
                <p>Saved progress shared across layouts.</p>
            </section>
            <aside
                className="lesson-path lesson-instructions"
                aria-label="Suggested lesson"
            >
                <p>Suggested lesson</p>
                <strong>{path.next.title}</strong>
                <p>{path.reason}</p>
                <button
                    className="primary-button"
                    onClick={() => onSelect(path.next.index)}
                >
                    Start suggested lesson
                </button>
            </aside>
            <div className="lesson-list">
                {path.steps.map((lesson) => (
                    <button
                        key={lesson.id}
                        onClick={() => onSelect(lesson.index)}
                    >
                        <span className="lesson-number">
                            {lesson.id === 'amat-intro'
                                ? '—'
                                : String(
                                      lesson.index +
                                          (track === 'amateur' ? 0 : 1),
                                  ).padStart(2, '0')}
                        </span>
                        <span>
                            <strong>
                                {lesson.title.replace(/^Lesson \d+: /, '')}
                            </strong>
                            <small>
                                {lesson.id === 'amat-intro'
                                    ? 'Optional introduction'
                                    : lesson.subtitle}
                            </small>
                        </span>
                        <span
                            className="lesson-stars"
                            role="img"
                            aria-label={`Earned stars: ${lesson.stars} of 3`}
                        >
                            {'★'.repeat(lesson.stars)}
                            {'☆'.repeat(3 - lesson.stars)}
                        </span>
                    </button>
                ))}
            </div>
        </>
    );
}
