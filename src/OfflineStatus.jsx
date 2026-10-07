import React, { useEffect, useState } from 'react';

export default function OfflineStatus() {
    const [status, setStatus] = useState('Preparing offline lessons…');

    useEffect(() => {
        if (!import.meta.env.PROD) return;
        if (!('serviceWorker' in navigator)) {
            setStatus('Offline setup unavailable');
            return;
        }
        let disposed = false;
        const cleanups = [];
        const show = (message) => {
            if (!disposed) setStatus(message);
        };
        const register = async () => {
            try {
                const registration = await navigator.serviceWorker.register(
                    new URL('sw.js', document.baseURI),
                    { updateViaCache: 'none' },
                );
                if (disposed) return;
                const update = () => {
                    if (registration.waiting) show('Update ready');
                    else if (registration.active?.state === 'activated')
                        show('Available offline');
                };
                const watch = () => {
                    const worker = registration.installing;
                    if (!worker) return;
                    const changed = () => {
                        update();
                        if (
                            worker.state === 'redundant' &&
                            !registration.active
                        )
                            show('Offline setup unavailable');
                    };
                    worker.addEventListener('statechange', changed);
                    cleanups.push(() =>
                        worker.removeEventListener('statechange', changed),
                    );
                };
                registration.addEventListener('updatefound', watch);
                cleanups.push(() =>
                    registration.removeEventListener('updatefound', watch),
                );
                watch();
                update();
            } catch {
                show('Offline setup unavailable');
            }
        };
        if (document.readyState === 'complete') register();
        else window.addEventListener('load', register, { once: true });
        return () => {
            disposed = true;
            window.removeEventListener('load', register);
            cleanups.forEach((cleanup) => cleanup());
        };
    }, []);

    if (!import.meta.env.PROD) return null;
    return (
        <details className="offline-status">
            <summary>
                <span role="status">{status}</span>
            </summary>
            <p>
                {status === 'Update ready'
                    ? 'Finish and save your session, then close all Typeflow tabs and reopen to use the update.'
                    : status === 'Available offline'
                      ? 'Lessons work without a connection. You can install Typeflow from your browser menu where supported. Keep this device’s site data to retain lessons and progress.'
                      : status === 'Preparing offline lessons…'
                        ? 'Preparing lessons for this device. Keep Typeflow online until setup finishes.'
                        : 'Open Typeflow online in a browser that supports offline apps. Setup retries on your next visit.'}
            </p>
        </details>
    );
}
