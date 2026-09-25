#  TypeFlow — Apple-Grade Touch Typing Tutor

> An ultra-refined touch typing tutor inspired by [TypingMe](https://www.typingme.com/), completely redesigned and engineered with Apple Human Interface Guidelines, macOS Sequoia aesthetics, and modern interaction design.

---

## ✨ Why It’s 10x Better Than TypingMe

| Feature | Legacy TypingMe (2012) |  TypeFlow (Modern Apple UX) |
|---|---|---|
| **Visual Design** | Cluttered with banner ads (728x90, 300x600), dated serif/sans font, harsh yellow/cyan boxes. | **Pristine Apple Silicon / macOS Sequoia frosted glass**, San Francisco typography, dark/light mode. |
| **Interactive Keyboard** | Static low-res raster image of a generic keyboard. | **Hardware-accurate Apple Magic Keyboard** with physical key depression, 3D keycaps, tactile F & J bumps, and Caps Lock LED. |
| **Finger Guidance** | Static diagram with no live cues. | **Live SVG Hands Visualizer** with color-coded fingers and dynamic indicator (e.g. *Left Index → F*, *Right Pinky → P (+ Left Shift)*). |
| **Sound Experience** | Silent typing. | **Synthesized Web Audio Acoustic Engine** reproducing realistic Apple Magic Keyboard scissor switches, mechanical thocks, and Apple glass chimes. |
| **Caret & Flow** | Jumpy HTML cursor, full screen turn orange on error. | **Smooth floating spring caret**, non-jarring soft error shake, real-time WPM ticker, and fluid flow mode. |
| **Lesson Progression** | Static PHP pages requiring full page reloads. | **Seamless Single Page App (SPA)** with auto-advance, drawer navigation, and instant replay (`Tab + Enter`). |
| **Analytics & Rewards** | Basic completion time in seconds. | **Apple Fitness-style Activity Rings** (Speed, Accuracy, Consistency), 3-Star mastery ratings, and error heatmap. |
| **Course Breadth** | Amateur & Pro PHP lessons. | **Full Amateur & Pro tracks**, 15s/30s/60s timed speed tests, and Custom Text / Quote practice. |

---

## 🚀 Quick Start

You can run TypeFlow directly in any modern browser without any build step:

### Option 1: Open Directly in Browser
Double-click `index.html` or open it with Safari, Chrome, or Arc:
```bash
open /Users/o1tean/apple-typing-tutor/index.html
```

### Option 2: Run Local Web Server
```bash
cd /Users/o1tean/apple-typing-tutor
python3 -m http.server 3000
```
Then navigate to: **`http://localhost:3000`**

---

## 🎯 Key Features

### 1. Hardware-Accurate Apple Magic Keyboard
- True-to-life Apple key proportions, command `⌘`, option `⌥`, control `⌃`, shift `⇧`, and return `⏎` keys.
- **Physical Key Depression**: Keys physically depress on physical keypress.
- **Opposite-Hand Shift Mechanics**: Prompts the correct shift key based on touch typing standards (Right Shift for Left hand keys, Left Shift for Right hand keys).
- **Tactile Homing Bumps**: Visual tactile bumps on `F` and `J` keys.

### 2. Apple Activity Rings & Diagnostics
- **Speed Ring (Red)**: Tracks your WPM against target lesson benchmarks.
- **Accuracy Ring (Green)**: Real-time accuracy percentage.
- **Consistency Ring (Cyan)**: Analyzes cadence and timing variance between keystrokes.
- **Focus Keys Breakdown**: Highlights problem keys that caused errors.

### 3. Pure Web Audio Acoustic Synthesis
- **Magic Scissor**: Authentic low-travel crisp click of Apple Magic Keyboard.
- **Mechanical Thock**: Deep, creamy custom mechanical switches.
- **Soft Bubble**: Waterdrop pop for calming focus sessions.
- **Apple Glass Chime**: Harmonic chord played on lesson completion.
- Zero audio file downloads required — runs 100% offline.

### 4. Comprehensive Touch Typing Curriculum
- **Amateur Course (Lessons 1 – 11)**: Home row (`asdf`, `jkl;`), upper row, lower row, simple punctuation, and final graduation.
- **Pro Course (Lessons 1 – 10)**: All letters, shift capitals, top number row (`1-0`), professional punctuation (`"`, `'`, `-`, `()`), developer brackets (`{ } [ ] < > / \ = +`), and Steve Jobs keynote prose.
- **Speed Test**: 15s, 30s, and 60s sprints with top 100 English words.
- **Custom Text**: Paste your own paragraphs, code files, or literary quotes.

---

## ⌨️ Keyboard Shortcuts

- <kbd>Tab</kbd> + <kbd>Enter</kbd> — Instant restart current lesson
- <kbd>Esc</kbd> — Open/close Curriculum drawer & modals
- <kbd>Shift</kbd> + <kbd>Enter</kbd> — Quick restart
