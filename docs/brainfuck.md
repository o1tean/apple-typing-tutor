# Typeflow in Brainfuck and WebAssembly

[Open version 3](https://o1tean.github.io/apple-typing-tutor/brainfuck.html).

The typing kernel is written in [Brainfuck](../brainfuck/typing.bf) and compiled
directly to WebAssembly during `npm run build`. Run `npm run dev` and open
`brainfuck.html` to use it locally. `npm run build:brainfuck` also writes the
standalone module to `.local/typeflow-brainfuck.wasm`.

To build only the original and Brainfuck sites without the Swift toolchain, run
`npx vite build && node scripts/build-offline.mjs`.

Brainfuck controls strict/flow input decisions, cursor movement, keystroke
counters, skipped targets, deletion permissions and correct-word credit.
The shared React interface and JavaScript browser host handle rendering,
keyboard events, character records, timers, fractional speed statistics,
learning observations and persistence. This is a Brainfuck typing kernel with
a browser host, rather than a claim that React or browser APIs are Brainfuck.
Lessons, guides, layouts, adaptive practice, results and offline behavior use
the same interface as the original. Both versions share existing local progress.

## Dialect and compiler

The eight Brainfuck operators are unchanged. Cells are wrapping unsigned
32-bit integers, so Unicode code points and counters above 255 remain distinct.
The tape contains 16,384 cells; invalid memory accesses trap. `run()` resets the
pointer to cell zero. `,` reads an integer from the host and `.` writes one;
they are not limited to UTF-8 bytes. Labels contain no Brainfuck operators.

The dependency-free [compiler](../scripts/compile-brainfuck.mjs) emits a real
WebAssembly binary exporting `memory` and `run`, with imports `env.read` and
`env.write`. It rejects unmatched brackets, combines adjacent arithmetic and
pointer moves, and optimizes clear/transfer loops. Other loops run as WebAssembly
control flow. Only the bundled program runs in the website; there is no arbitrary
program execution interface.

## Kernel protocol

Each transaction clears the first 64 tape cells, then supplies 18 integers:

| Cell | Input |
| --- | --- |
| 0 | Command: type 1, delete 2, scan credit 3, skip 4, separator 5 |
| 1–8 | Cursor, total, correct, net correct, correct non-space, net typed, errors, skipped |
| 9–13 | Flow flag, target code point or −1, input code point, status, typed-present flag |
| 14–17 | Extra/separator flag, following-line flag, virtual separator flag, record count |

For command 3, each record follows as target code point, status, extra flag and
skipped flag. Status is pending 0, correct 1 or incorrect 2. Output is the eight
updated state values followed by action, word credit and deletion-blocked flag.
Type actions are correct 1, incorrect 2, extra 3 and submit-space 4.

`npm test` checks compiler behavior and compares engine state, statistics and
callback ordering against the original through deterministic input histories.
Browser checks cover the actual module download, typing, corrections, preserved
progress, offline reload and loading failure. A failed module load presents an
accessible link to the original version.
