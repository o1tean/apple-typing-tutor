import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compileBrainfuck } from './compile-brainfuck.mjs';

export async function buildBrainfuck() {
    const source = await readFile(new URL('../brainfuck/typing.bf', import.meta.url), 'utf8');
    return compileBrainfuck(source);
}

async function browserHost() {
    const source = await readFile(new URL('../js/brainfuck-engine.js', import.meta.url),
        'utf8');
    return source + '\nglobalThis.typeflowBrainfuck = loadBrainfuck;\n';
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
            this.emitFile({
                type: 'asset',
                fileName: 'typeflow-brainfuck.wasm',
                source: await buildBrainfuck()
            });
            this.emitFile({
                type: 'asset',
                fileName: 'typeflow-brainfuck.js',
                source: await browserHost()
            });
        },
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                const pathname = request.url?.split('?')[0];
                if (!['/typeflow-brainfuck.wasm', '/typeflow-brainfuck.js'].includes(
                        pathname))
                    return next();
                try {
                    const wasm = pathname.endsWith('.wasm');
                    const bytes = wasm ? await buildBrainfuck() : await browserHost();
                    response.setHeader('Content-Type', wasm ? 'application/wasm' :
                        'text/javascript');
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
    const bytes = await buildBrainfuck();
    await writeFile('.local/typeflow-brainfuck.wasm', bytes);
    console.log(`Brainfuck compiled to WebAssembly (${bytes.length} bytes)`);
}
