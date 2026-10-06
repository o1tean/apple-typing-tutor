# Typeflow

Learn touch typing with guided lessons and live finger guidance.

[**Try the live demo →**](https://o1tean.github.io/apple-typing-tutor/)

[![Watch Typeflow guide each finger to the next key](https://raw.githubusercontent.com/o1tean/apple-typing-tutor/main/docs/media/hero.gif)](https://o1tean.github.io/apple-typing-tutor/)

[![CI](https://github.com/o1tean/apple-typing-tutor/actions/workflows/ci.yml/badge.svg)](https://github.com/o1tean/apple-typing-tutor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/o1tean/apple-typing-tutor/blob/main/LICENSE)

- Start lesson 1 immediately, then build accuracy through 22 foundation and advanced lessons.
- Follow the moving finger and keyboard guides, with a static pose when reduced motion is preferred.
- Practice with timed tests, word tests, quotes, or your own text; retry the words you missed.
- Keep progress on your device, with light/dark appearance, keyboard sounds and reduced motion support.

## Quick start

Use Node.js 22.12+ (or 20.19+):

```bash
npm ci
npm run dev
```

For a static production build, run `npm run build` and serve `dist/`.
Tests start on the first character and pause when focus leaves the typing input.
Press Escape for settings; use Tab then Enter to restart.
Progress stays in this browser and is not synchronized across devices.

[Contribute](https://github.com/o1tean/apple-typing-tutor/blob/main/CONTRIBUTING.md) ·
[Metric definitions](https://github.com/o1tean/apple-typing-tutor/blob/main/docs/metrics.md) ·
[Design notes](https://github.com/o1tean/apple-typing-tutor/blob/main/docs/design-notes.md)

[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/o1tean/apple-typing-tutor?label=CodeRabbit+Reviews)](https://coderabbit.ai)
