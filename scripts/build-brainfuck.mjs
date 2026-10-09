import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compileBrainfuck } from './compile-brainfuck.mjs';
import { application } from '../brainfuck/app.mjs';

export function buildBrainfuck() {
    const { program, metadata } = application();
    return { bytes: program.compile(), metadata, program };
}

export function brainfuckPlugin() {
    let building = false;
    return {
        name: 'brainfuck-webassembly',
        configResolved(config) {
            building = config.command === 'build';
        },
        async buildStart() {
            if (!building) return;
            const { bytes, metadata } = buildBrainfuck();
            this.emitFile({
                type: 'asset',
                fileName: 'typeflow-brainfuck.wasm',
                source: bytes
            });
            this.emitFile({
                type: 'asset',
                fileName: 'typeflow-brainfuck.json',
                source: JSON.stringify(metadata)
            });
        },
        configureServer(server) {
            let compiled;
            server.middlewares.use(async (request, response, next) => {
                const pathname = request.url?.split('?')[0];
                if (!['/typeflow-brainfuck.wasm', '/typeflow-brainfuck.json'].includes(
                        pathname))
                    return next();
                try {
                    const wasm = pathname.endsWith('.wasm');
                    compiled ||= buildBrainfuck();
                    const bytes = wasm ? compiled.bytes : JSON.stringify(compiled
                        .metadata);
                    response.setHeader('Content-Type', wasm ? 'application/wasm' :
                        'application/json');
                    response.end(bytes);
                } catch (error) {
                    next(error);
                }
            });
        }
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    await mkdir('.local', { recursive: true });
    const { bytes, metadata } = buildBrainfuck();
    await writeFile('.local/typeflow-brainfuck.wasm', bytes);
    await writeFile('.local/typeflow-brainfuck.json', JSON.stringify(metadata));
    const source = await readFile(new URL('../brainfuck/typing.bf', import.meta.url), 'utf8');
    await writeFile('.local/typeflow-brainfuck-kernel.wasm', compileBrainfuck(source));
    console.log(`Brainfuck application compiled to WebAssembly (${bytes.length} bytes)`);
}
