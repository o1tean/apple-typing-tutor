# Contributing to Typeflow

Typeflow teaches touch typing. Read [AGENTS.md](AGENTS.md) for durable rules and
[PLANS.md](PLANS.md) for the current launch criteria and next round.

Use Node.js 22.12+ (or 20.19+), then run `npm ci` and `npm run dev`.
Keep changes focused on an observed visitor experience; reproduce bugs before
fixing their shared cause.

## Verification

Run these gates once for each final commit:

```bash
npm test
npm run build
npm run e2e
npm run format:check
```

Playwright uses isolated contexts and fixtures, never a personal browser profile.
For UI changes, capture and inspect 375px and 1440px screenshots in light and dark.
Logic changes and bug fixes need a regression test. A reversible cosmetic change
does not need a test that merely repeats its implementation.

## Formatting

[CS50 style50](https://github.com/cs50/style50) checks supported JavaScript, CSS,
and HTML:

```bash
python3 -m venv /tmp/typeflow-style50
/tmp/typeflow-style50/bin/pip install style50
PATH="/tmp/typeflow-style50/bin:$PATH" style50 -o score js/*.js css/*.css index.html vite.config.js
```

Use `style50 -i` on those same files when formatting is needed. Check each edited
`.mjs` file through a temporary `.js` copy; style50 does not recognize `.mjs`.
Do not run style50's JavaScript formatter on JSX.

The pinned Prettier development dependency formats `.jsx` and SVG files only.
The committed `.prettierrc` uses four-space indentation, single quotes, and an
HTML-parser override for `*.svg`. `npm run format:check` covers only those files.
Use `npx prettier --write` with the specific JSX or SVG files you changed.

Keep machine-specific setup in gitignored `LOCAL_NOTES.md`. Do not create
`AGENTS.override.md`, which replaces the shared rules. Keep temporary QA hooks
out of production source, and never restore `.checkpoints` over tracked files.
