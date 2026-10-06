![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/o1tean/apple-typing-tutor?utm_source=oss&utm_medium=github&utm_campaign=o1tean%2Fapple-typing-tutor&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

# Typeflow

A React typing test and tutor inspired by Monkeytype's focused practice flow.
Built with Vite, with local lesson data, synthesized audio, and device-local progress.

## Run

Requires Node.js 22.12+ (or 20.19+).

```bash
npm install
npm run dev
```

Open [Typeflow](http://localhost:5173). For a production build, run `npm run build`;
`npm run preview` serves that build locally. Deploy the generated `dist` directory
on any static host.

## Practice

- Timed tests: 15, 30, 60, or 120 seconds, starting on your first character.
- Word tests: 10, 25, 50, or 100 words, with optional punctuation and numbers.
- Free flow submits words with Space, displays extra/missing letters, and supports
  Backspace and Ctrl/Option + Backspace correction. Guided mode waits for the right key.
- 22 foundation and advanced lessons, quotes, and custom text up to 10,000 characters.
- Live WPM and accuracy; results include raw speed, consistency, errors, skipped
  characters, speed samples, and recent history.
- Repeat the same passage or practice the words you missed from your results.
- Optional keyboard and finger guides, four keyboard sounds, adjustable volume,
  and light, dark, or system appearance.
- Lesson instructions, introduced keys, and explicit WPM/accuracy star targets.

Tests pause when the typing input loses focus or the page is hidden. Click the
text to resume. Paste is disabled inside the test; use Custom to paste a passage.
Custom text removes copied soft hyphens and zero-width spaces, normalizes Unicode,
and joins whitespace into spaces. Visible hyphens and joining characters used by
emoji and scripts are preserved. Lessons retain their original lines and indentation.

WPM credits characters in correct words, including their separators, and a clean
unfinished word, divided by five and measured elapsed minutes. Incorrect or skipped
words earn no WPM credit. Subsecond attempts use their measured duration; speed stays
zero until time has actually elapsed.
The speed graph shows overall WPM at recorded times, with exact timestamps,
enlargeable axis labels, and keyboard-accessible sample values. A single sample
has no trend; zero-time attempts have no plot. Short durations remain visible
in results and history.
Raw WPM includes retained incorrect and extra characters; deleted input and
skipped placeholders do not inflate it.
Accuracy counts incorrect attempts and skipped target characters as errors.
Skipped characters are also reported separately. Backspacing never removes historical
errors; correcting a word restores its WPM credit. Consistency uses the variation in
the latest 30 keystroke intervals. It shows “Not enough data” until at least six
intervals with positive measured time are available; pauses do not count as intervals.
Progress and preferences use the existing local-storage key for compatibility;
data stays in this browser and is not synchronized across devices.
Earlier scores keep their original values and are labeled in history. Personal bests
compare the same scoring method; earned lesson stars carry forward. Result stars
describe the current attempt.

Records require correct input, no skipped characters, measured typing time,
and the exercise's accuracy target. Rounded-zero speed or accuracy does not erase
retained correct input. Lesson stars recognize completion, then the accuracy target,
then the speed target; zero-time attempts earn no stars. Test records distinguish duration or word
count, punctuation, numbers, and typing behavior. Custom text and repeated
passages are practice sessions, retained in history without personal-best records.
If storage is unavailable, the app keeps the current session in memory and shows
that it cannot save. Open **Keep my progress**, or **Settings → Saved progress**,
to download a JSON backup. **View backup text** provides a selectable copy when
downloads are unavailable. The backup keeps current progress and the exact readable
saved snapshot separately. **Try saving again** preserves conflicting or unread
saved data; backups are export-only and do not merge or overwrite records.
Completed tests show results immediately while saving continues. Backups also
include completed attempts waiting for a write lock, with their original completion
time and test settings. Later save results do not replace a restarted test or move
focus out of an open dialog.
Native [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request)
serialize saves across tabs. Browsers without this API refresh before writing;
failed writes never overwrite newer data from another tab. Mute and volume control
the shared audio output, including clicks and chimes already playing.

The ongoing audit and improvement rounds are tracked in [IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md).
Course examples and current accessibility standards informing the interface are
documented in [DESIGN_RESEARCH.md](DESIGN_RESEARCH.md).

## Shortcuts

- **Tab, then Enter** or **Shift + Enter:** restart.
- **Escape:** open settings or close a dialog.
- **Ctrl/Option + Backspace:** delete the current word in free flow.

## Checks and code style

```bash
npm test
npm run build
```

The dependency-free checks cover typing, all lessons, word submission/correction,
Unicode, deadlines, pause/resume, word generation, corrupt saves, and audio/guidance.
Native dialogs manage focus; clicking their padding or dragging outside keeps them open.
Controls have visible keyboard focus. Typing errors, Caps Lock, and resolved lesson
results expose text status feedback without announcing the ticking statistics.
Reduced motion and higher contrast preferences are respected. Assistive-technology
behavior still needs testing with an actual screen reader.

Use [CS50 style50](https://github.com/cs50/style50) for supported source files:

```bash
python3 -m venv /tmp/typeflow-style50
/tmp/typeflow-style50/bin/pip install style50
PATH="/tmp/typeflow-style50/bin:$PATH" style50 -i js/*.js css/*.css index.html vite.config.js
PATH="/tmp/typeflow-style50/bin:$PATH" style50 -o score js/*.js css/*.css index.html vite.config.js
```

Style50 does not safely parse JSX or recognize `.mjs`. React components follow
consistent four-space indentation separately; `.mjs` tests can be checked as
`.js` copies. Do not run its standard JS formatter on JSX.
