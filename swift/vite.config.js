import { defineConfig } from 'vite';

export default defineConfig({
    root: 'swift',
    base: './',
    publicDir: 'public',
    build: { outDir: '../dist/swift', emptyOutDir: true },
    server: { port: 5174, strictPort: true }
});
