# Typeflow

Learn touch typing with guided lessons and live finger guidance.

[**Try the live demo →**](https://o1tean.github.io/apple-typing-tutor/)

[Try version 2: Swift compiled to WebAssembly](https://o1tean.github.io/apple-typing-tutor/swift/)

[Try version 3: Brainfuck compiled to WebAssembly](https://o1tean.github.io/apple-typing-tutor/brainfuck.html)
· [Implementation and build instructions](docs/brainfuck.md)

[![Watch Typeflow guide each finger to the next key](https://raw.githubusercontent.com/o1tean/apple-typing-tutor/main/docs/media/hero.gif)](https://o1tean.github.io/apple-typing-tutor/)

[![CI](https://github.com/o1tean/apple-typing-tutor/actions/workflows/ci.yml/badge.svg)](https://github.com/o1tean/apple-typing-tutor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/o1tean/apple-typing-tutor/blob/main/LICENSE)

- Start lesson 1 immediately, then build accuracy through 22 foundation and advanced lessons.
- Follow the moving finger and keyboard guides, with a static pose when reduced motion is preferred.
- Practice with 1,189 common words, 100 public-domain quotes, timed tests or your own text; retry the words you missed.
- Use the result keyboard map to find tricky keys, then practice fresh drills that adapt as you improve.
- Track practice streaks on your device, choose a light/dark palette, and take lessons offline.

## Quick start

Use Node.js 22.12+ (or 20.19+):

```bash
npm ci
npm run dev
```

For a static production build, prepare the Swift toolchain below, run `npm run build`,
and serve `dist/`.
Tests start on the first character and pause when focus leaves the typing input.
Press Escape for settings; use Tab then Enter to restart.
Choose the keyboard layout that matches your operating-system input source in Settings.
Progress stays in this browser and is not synchronized across devices.

After the footer says **Available offline**, lessons also work without a connection.
Install Typeflow from your browser's install or Add to Home Screen menu where offered.
When an update is ready, finish and save your session, then close all Typeflow tabs and reopen.
Clearing this site's data removes saved progress and offline lessons.

[Contribute](https://github.com/o1tean/apple-typing-tutor/blob/main/CONTRIBUTING.md) ·
[Metric definitions](https://github.com/o1tean/apple-typing-tutor/blob/main/docs/metrics.md)

[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/o1tean/apple-typing-tutor?label=CodeRabbit+Reviews)](https://coderabbit.ai)

## Swift version

The second site at `/swift/` runs the application in Embedded Swift WebAssembly:
typing, lessons, adaptive practice, interface rendering, guides, settings, history,
results, sharing decisions, and progress validation/merging. A small JavaScript host
provides browser APIs: DOM commands, events, clocks, raw storage and locks, audio,
image export, and offline registration. It imports no React or product JavaScript.
Licensed content and static geometry are converted into Swift data during the build.
All three versions share the existing progress key and format.

Install the official **Swift.org 6.4.0 toolchain** and its matching
[WebAssembly SDK](https://www.swift.org/documentation/articles/wasm-getting-started.html).
Apple/Xcode Swift is a different toolchain and cannot use this SDK.
Set `TYPEFLOW_SWIFT_TOOLCHAIN` to the toolchain’s `usr` directory and
`TYPEFLOW_SWIFT_SDK` to the artifact bundle’s `wasm32-unknown-wasip1` directory.
The build script also detects Swift.org 6.4.0 on PATH; CI prepares the SDK locally.

```bash
npm run test:swift
npm run build
npm run test:swift:wasm
npm run preview
```

Open `/swift/` in the preview. For development, use `npm run dev:swift`;
rebuild after editing Swift source. Generated WebAssembly stays out of Git.
CI compiles the source with a pinned official compiler image and verifies the
SDK checksum. No Swift runtime framework or additional browser dependency is used.
Runtime data and C-library notices ship in `swift/THIRD_PARTY_LICENSES.txt`.
