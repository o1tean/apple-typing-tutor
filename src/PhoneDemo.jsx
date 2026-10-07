import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardView } from '../js/keyboard.js';

const STEPS = Array.from('f r f j u j F J ');

export default function PhoneDemo({ onPractice, paused = false }) {
    const keyboard = useRef(null);
    const hands = useRef(null);
    const view = useRef(null);
    const media = useMemo(
        () => matchMedia('(prefers-reduced-motion: reduce)'),
        [],
    );
    const [reducedMotion, setReducedMotion] = useState(media.matches);
    const [playing, setPlaying] = useState(!media.matches);
    const [hidden, setHidden] = useState(() => document.hidden);
    const [index, setIndex] = useState(0);
    const target = STEPS[index];

    useEffect(() => {
        view.current = new KeyboardView(keyboard.current, hands.current);
        return () => {
            view.current = null;
        };
    }, []);

    useEffect(() => {
        view.current?.highlightTarget(target);
    }, [target]);

    useEffect(() => {
        const motionChanged = () => {
            setReducedMotion(media.matches);
            if (media.matches) setPlaying(false);
        };
        const visibilityChanged = () => setHidden(document.hidden);
        media.addEventListener('change', motionChanged);
        document.addEventListener('visibilitychange', visibilityChanged);
        return () => {
            media.removeEventListener('change', motionChanged);
            document.removeEventListener('visibilitychange', visibilityChanged);
        };
    }, [media]);

    useEffect(() => {
        if (!playing || reducedMotion || paused || hidden) return;
        const timer = setInterval(
            () => setIndex((current) => (current + 1) % STEPS.length),
            1100,
        );
        return () => clearInterval(timer);
    }, [playing, reducedMotion, paused, hidden]);

    const nextKey = () => {
        setPlaying(false);
        setIndex((current) => (current + 1) % STEPS.length);
    };

    return (
        <section className="phone-demo" aria-label="Finger demo">
            <h2>Finger demo</h2>
            <p>Reach, then return home.</p>
            <p className="demo-letters" aria-hidden="true">
                {STEPS.map((letter, position) => (
                    <span
                        key={position}
                        className={
                            position === index
                                ? 'current'
                                : position < index
                                  ? 'complete'
                                  : ''
                        }
                    >
                        {letter === ' ' ? '␣' : letter}
                    </span>
                ))}
            </p>
            <p className="demo-target">
                Key:{' '}
                <output aria-label="Demo target" aria-live="off">
                    {target === ' ' ? 'Space' : target}
                </output>
            </p>
            <div className="demo-actions">
                {!reducedMotion && (
                    <button
                        type="button"
                        className="text-button"
                        onClick={() => setPlaying((current) => !current)}
                    >
                        {playing ? 'Pause demo' : 'Play demo'}
                    </button>
                )}
                <button type="button" className="text-button" onClick={nextKey}>
                    Next key
                </button>
                <button
                    type="button"
                    className="primary-button"
                    onClick={onPractice}
                >
                    Try this lesson
                </button>
            </div>
            <div ref={hands} className="hands-container" />
            <div
                ref={keyboard}
                className="keyboard-container"
                aria-hidden="true"
            />
            <p className="field-help">
                {reducedMotion && 'Reduced motion: use Next key to explore. '}
                This demo does not save progress.
            </p>
        </section>
    );
}
