import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const release = 'swift-6.4.0-RELEASE';
const configuredToolchain = process.env.TYPEFLOW_SWIFT_TOOLCHAIN;
const compiler = configuredToolchain ? join(configuredToolchain, 'bin/swiftc') : 'swiftc';
const targetInfo = spawnSync(compiler, ['-print-target-info'], { encoding: 'utf8' });
if (targetInfo.error || targetInfo.status !== 0) {
    console.error('Install Swift.org 6.4.0 and set TYPEFLOW_SWIFT_TOOLCHAIN to its usr directory.');
    process.exit(1);
}
const info = JSON.parse(targetInfo.stdout);
if (info.swiftCompilerTag !== release) {
    console.error('This build requires the Swift.org 6.4.0 toolchain, not Apple/Xcode Swift. ' +
        'Set TYPEFLOW_SWIFT_TOOLCHAIN to the matching toolchain usr directory.');
    process.exit(1);
}
const toolchain = configuredToolchain || dirname(dirname(info.paths.runtimeResourcePath));
const cache = join(root, '.local/swift-build');
mkdirSync(cache, { recursive: true });

function run(command, args) {
    const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}

if (process.argv.includes('--test')) {
    const executable = join(cache, 'typing-session-checks');
    const nativeSDK = process.platform === 'darwin' ? process.env.SDKROOT ||
        spawnSync('xcrun', ['--show-sdk-path'], { encoding: 'utf8' }).stdout?.trim() : null;
    if (process.platform === 'darwin' && !nativeSDK) {
        throw new Error('Install the macOS Command Line Tools or set SDKROOT to the macOS SDK.');
    }
    run(compiler, [...(nativeSDK ? ['-sdk', nativeSDK] : []),
        '-module-cache-path', join(cache, 'native-module-cache'),
        'swift/Sources/TypingSession.swift', 'swift/Tests/TypingSessionChecks.swift',
        '-o', executable]);
    run(executable, []);
} else {
    const sdk = process.env.TYPEFLOW_SWIFT_SDK || join(root, '.local/swift-sdk',
        `${release}_wasm.artifactbundle`, `${release}_wasm`, 'wasm32-unknown-wasip1');
    const resources = join(sdk, 'swift.xctoolchain/usr/lib/swift');
    if (!existsSync(join(resources, 'embedded/Swift.swiftmodule'))) {
        console.error('Install the matching Swift.org 6.4.0 Wasm SDK and set TYPEFLOW_SWIFT_SDK ' +
            'to its wasm32-unknown-wasip1 directory. See ' +
            'https://www.swift.org/documentation/articles/wasm-getting-started.html');
        process.exit(1);
    }
    const sourceDirectory = join(root, 'swift/Sources');
    const sources = readdirSync(sourceDirectory).filter(name => name.endsWith('.swift'))
        .sort().map(name => join(sourceDirectory, name));
    const object = join(cache, 'typeflow.o');
    const output = join(root, 'swift/typeflow.wasm');
    const exportedFunctions = ['input', 'output', 'length', 'capacity', 'load', 'key',
        'delete', 'pause', 'resume', 'tick', 'snapshot', 'render'];
    run(compiler, ['-enable-experimental-feature', 'Embedded',
        '-enable-experimental-feature', 'Extern', '-wmo', '-Osize', '-parse-as-library',
        '-target', 'wasm32-unknown-none-wasm', '-resource-dir', resources,
        '-module-cache-path', join(cache, 'wasm-module-cache'), '-c', ...sources, '-o', object]);
    run(join(toolchain, 'bin/wasm-ld'), ['--no-entry', '--strip-all', '--export-memory',
        ...exportedFunctions.map(name => `--export=typeflow_${name}`), object,
        join(resources, 'embedded/wasm32-unknown-none-wasm/libswiftUnicodeDataTables.a'),
        join(sdk, 'WASI.sdk/lib/wasm32-wasip1/libc.a'),
        join(sdk, 'swift.xctoolchain/usr/lib/clang/lib/wasip1/libclang_rt.builtins-wasm32.a'),
        '-o', output]);
    console.log(`Swift compiled to WebAssembly (${statSync(output).size} bytes)`);
}
