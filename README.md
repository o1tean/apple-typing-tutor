# TypeFlow

A focused touch typing tutor with an Apple-inspired interface. Floating controls and dialogs use a CSS interpretation of Liquid Glass: translucent materials, soft reflections, rounded edges, and gentle press feedback. The exercise itself stays clear and readable.

## Run locally

TypeFlow uses browser JavaScript modules, so it needs a web server rather than opening `index.html` directly.

With Python 3 installed:

```bash
python3 -m http.server 3000
```

Or run `npm start`. No package installation is required. Open [TypeFlow](http://localhost:3000).

With Node.js installed, run the regression checks:

```bash
npm test
```

## Practice

- **Learn and Advanced:** 22 exercises covering the home row, letters, capitals, numbers, punctuation, and code.
- **Speed test:** a 30-second sprint that starts with your first keystroke.
- **Custom:** practice your own passage or try a quote.
- **Guided mode:** waits for the correct key. **Free flow:** allows mistakes and Backspace corrections.
- Live speed, accuracy, elapsed time, finger guidance, and an onscreen keyboard with opposite-hand Shift hints.
- Completion rings, focus keys, and locally saved stars and best scores.

Settings include light and dark appearances, four synthesized keyboard sounds, volume, and optional hand and keyboard guides. All assets are local; no external font or audio downloads are needed.

Glass materials fall back to opaque surfaces when unsupported or when reduced transparency or higher contrast is requested. Reduced motion disables animations and transitions. Dialogs use native focus management and keyboard navigation.

## Shortcuts

- **Tab, then Enter:** restart the exercise.
- **Shift + Enter:** restart directly.
- **Escape:** open lessons or close the current dialog.
