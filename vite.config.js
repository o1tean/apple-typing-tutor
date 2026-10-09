import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { brainfuckPlugin } from './scripts/build-brainfuck.mjs';

export default defineConfig({
    base: './',
    plugins: [react(), brainfuckPlugin()],
    build: {
        manifest: true,
        modulePreload: false,
        rollupOptions: { input: ['index.html', 'brainfuck.html'] }
    },
    server: { port: 5173, strictPort: true }
});
