import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { TypingEngine } from '../js/engine.js';
import '../css/main.css';
import '../css/keyboard.css';
import '../css/hands.css';

const root = createRoot(document.getElementById('root'));
if (location.pathname.endsWith('/brainfuck.html')) {
    root.render(
        <main className="app">
            <p role="status">Loading WebAssembly…</p>
        </main>,
    );
    new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = new URL('typeflow-brainfuck.js', document.baseURI).href;
        script.onerror = reject;
        script.onload = () => {
            resolve(globalThis.typeflowBrainfuck);
            delete globalThis.typeflowBrainfuck;
            script.remove();
        };
        document.head.append(script);
    })
        .then((load) => load(TypingEngine))
        .then((engine) => root.render(<App engine={engine} />))
        .catch(() => {
            root.render(
                <main className="app">
                    <p role="alert">
                        The Brainfuck WebAssembly version could not load.
                    </p>
                    <a href="./">Open the original Typeflow</a>
                </main>,
            );
        });
} else {
    root.render(<App />);
}
