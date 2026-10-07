import { mergeLearning } from '../js/learning.js';
import { focusKeys, focusLabel, practiceObservation } from '../js/practice.js';

export default function PracticeResults({
    exercise,
    result,
    onNext,
    onLesson,
    actionRef,
}) {
    const group = exercise.focusGroup;
    const profile = mergeLearning(exercise.learningBefore, result.learning);
    const next = focusKeys(profile, group === 'keys' ? 3 : 1, group);
    const same =
        next.length === exercise.focusKeys.length &&
        next.every((key) => exercise.focusKeys.includes(key));
    return (
        <section className="key-map" aria-label="Practice focus results">
            <h2>Your practice focus</h2>
            <p className="field-help">
                Earlier: weighted recent observations across layouts. This
                drill: this attempt only.
            </p>
            <table>
                <thead>
                    <tr>
                        <th scope="col">Target</th>
                        <th scope="col">Earlier recent</th>
                        <th scope="col">This drill</th>
                    </tr>
                </thead>
                <tbody>
                    {exercise.focusKeys.map((key) => (
                        <tr key={key}>
                            <th scope="row">{focusLabel(key)}</th>
                            <td>
                                {practiceObservation(
                                    exercise.learningBefore[group][key],
                                    true,
                                )}
                            </td>
                            <td>
                                {practiceObservation(
                                    result.learning?.[group]?.[key],
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="field-help">
                Reach excludes pauses and backspace gaps. A short drill is not
                proof of mastery.
            </p>
            <div className="learning-return">
                <div>
                    <p>
                        {next.length
                            ? `Next focus: ${next.map(focusLabel).join(' · ')}`
                            : 'No focus suggested. Choose a lesson or try again.'}
                    </p>
                    {next.length > 0 && (
                        <p className="field-help">
                            Recent errors and relative reach times{' '}
                            {same
                                ? 'still suggest this focus.'
                                : 'now suggest a different focus.'}{' '}
                            Based on earlier observations plus this drill.
                        </p>
                    )}
                </div>
                <button
                    ref={actionRef}
                    className="primary-button"
                    onClick={() => (next.length ? onNext(profile) : onLesson())}
                >
                    {next.length ? 'Start next drill' : 'Choose a lesson'}
                </button>
            </div>
        </section>
    );
}
