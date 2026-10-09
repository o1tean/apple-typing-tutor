# Typeflow in Brainfuck and WebAssembly

[Open version 3](https://o1tean.github.io/apple-typing-tutor/brainfuck.html).

Version 3 runs the complete Typeflow application in WebAssembly compiled from
Brainfuck. It includes lessons, four keyboard layouts, guided and free-flow input,
adaptive key and pair practice, quotes, custom text, finger guidance, the mobile
demo, results, history, sound, backups and local progress. It shares the original
`apple_typing_tutor_data_v1` storage key and preserves unknown saved fields.

Run `npm run dev` and open `brainfuck.html`. `npm run build:brainfuck` writes
`.local/typeflow-brainfuck.wasm` and its content/transport metadata. The normal
production build includes the application and offline assets. To build the
original and Brainfuck sites without the Swift toolchain, run
`npx vite build && node scripts/build-offline.mjs`.

## Source and browser boundary

[Application macros](../brainfuck/app.mjs) generate ordinary Brainfuck for product
state, navigation, rendering, input validation, scoring, practice selection,
learning, storage validation and merges. These JavaScript generators run during
the build; they are not loaded by the browser. Content comes from the original
permissively licensed catalog at build time.

The [browser bridge](../brainfuck/browser.js) forwards native events and exposes
generic DOM, clock, random, audio, downloads, storage, Web Locks, service worker
and platform text/date/number-formatting operations. Its [JSON codec](../brainfuck/codec.js)
only carries structures, strings and exact numeric representations. It imports no
React or original product JavaScript. Brainfuck chooses every product action and
every retained JSON root; disabling the Wasm dispatcher disables navigation and
scoring.

## Dialect and compiler

The eight operators are `><+-.,[]`. Cells are wrapping unsigned 32-bit integers;
`,` and `.` exchange integers, allowing Unicode code points and wide-number
arithmetic. The tape is bounded, and invalid access traps. Each transaction starts
at pointer zero and keeps application state on the tape. JSON token IDs stay
stable across generic garbage collection.

The dependency-free [generator/compiler](../brainfuck/compiler.mjs) emits real
Wasm exporting `memory` and `run`, with only `env.read` and `env.write` imports.
It lowers repeated Brainfuck operations and reusable procedures to equivalent
Wasm helpers. Numeric operations have genuine Brainfuck implementations, checked
against native lowering, including unsigned 64-bit arithmetic and IEEE-754
addition, subtraction, multiplication, division, comparison and square root.

`application().program.sourceChunks()` yields the fully expanded eight-operator
source as a stream. Large absolute tape offsets and numeric fallbacks make this expansion
extremely large, so the checked-in build-time macros are the practical source and the
build emits Wasm directly. `brainfuck/typing.bf` remains a small compiler regression
fixture; it is not the version 3 application.

## Verification

`npm test` checks the compiler, literal Brainfuck/native equivalence, numeric
boundaries, typing transitions, storage preservation, practice, history, sound,
demo controls and structural transport. `npm run e2e` checks actual browser input,
Wasm ownership, both lesson tracks and all layouts, recommendations, result PNGs,
backups and offline behavior. Browser checks use isolated profiles.
