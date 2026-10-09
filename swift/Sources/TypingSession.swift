// The browser supplies normalized Unicode scalars and monotonic milliseconds.
// Keep scoring and editing behavior aligned with js/engine.js.

struct TypingCell {
    var scalar: UInt32
    var typed: UInt32? = nil
    var status = "pending"
    var extra = false
    var skipped = false
}

struct LearningObservation {
    var attempts = 0
    var errors = 0
    var latencySamples = 0
    var latencyTotalMs: Double = 0
}

struct TypingLearning {
    var keys: [String: LearningObservation] = [:]
    var bigrams: [String: LearningObservation] = [:]
}

struct TypingError {
    let expected: UInt32?
    let typed: UInt32
}

struct TypingStats {
    let wpmMetric = "words-v1"
    let wpm: Double
    let rawWpm: Double
    let cpm: Double
    let accuracy: Double
    let consistency: Double?
    let elapsedMilliseconds: Double
    let elapsedSeconds: Double
    let timeRemaining: Double
    let totalKeystrokes: Int
    let correctKeystrokes: Int
    let correctNonSpaceChars: Int
    let errorKeystrokes: Int
    let skippedChars: Int
    let errorsByChar: [UInt32: Int]
    let learning: TypingLearning
    let missedWords: [String]
    let currentLineIndex: Int
    let totalLines: Int
}

final class TypingSession {
    private(set) var mode = "strict"
    private(set) var lines: [String] = []
    private(set) var cells: [TypingCell] = []
    private(set) var currentLine = 0
    private(set) var currentIndex = 0
    private(set) var isRunning = false
    private(set) var isPaused = false
    private(set) var isComplete = false
    private(set) var timedDuration: Double = 0
    private(set) var totalKeystrokes = 0
    private(set) var correctKeystrokes = 0
    private(set) var netCorrectChars = 0
    private(set) var completedWordChars = 0
    private(set) var correctNonSpaceChars = 0
    private(set) var netTypedChars = 0
    private(set) var errorKeystrokes = 0
    private(set) var skippedChars = 0
    private(set) var errorsByChar: [UInt32: Int] = [:]
    private(set) var learning = TypingLearning()
    private(set) var keystrokeIntervals: [Double] = []
    private(set) var lastError: TypingError? = nil
    private(set) var missedWords: [String] = []

    private var startTime: Double? = nil
    private var endTime: Double? = nil
    private var pauseTime: Double? = nil
    private var lastKeystrokeTime: Double? = nil
    private var learningPrevious: String? = nil
    private var learningLinePrevious: String? = nil
    private var learningTimingBreak = false

    var status: String {
        isComplete ? "complete" : isPaused ? "paused" : isRunning ? "running" : "idle"
    }

    var currentScalar: UInt32? {
        currentIndex < cells.count ? cells[currentIndex].scalar : nil
    }

    func initialize(lines: [String], mode: String, duration: Double) {
        reset()
        self.mode = mode
        self.lines = lines.filter { !$0.isEmpty }
        timedDuration = duration.isFinite && duration > 0 ? duration : 0
        setupLine(now: 0)
    }

    func reset() {
        cells = []
        currentLine = 0
        currentIndex = 0
        isRunning = false
        isPaused = false
        isComplete = false
        startTime = nil
        endTime = nil
        pauseTime = nil
        timedDuration = 0
        totalKeystrokes = 0
        correctKeystrokes = 0
        netCorrectChars = 0
        completedWordChars = 0
        correctNonSpaceChars = 0
        netTypedChars = 0
        errorKeystrokes = 0
        skippedChars = 0
        errorsByChar = [:]
        learning = TypingLearning()
        keystrokeIntervals = []
        lastKeystrokeTime = nil
        learningPrevious = nil
        learningLinePrevious = nil
        learningTimingBreak = false
        lastError = nil
        missedWords = []
    }

    func key(scalar: UInt32, now: Double) {
        guard !isComplete, !isPaused else { return }
        tick(now: now)
        guard !isComplete, Unicode.Scalar(scalar) != nil else { return }
        let target = currentScalar
        if target == nil && mode == "strict" { return }
        let word = currentWord()
        if !isRunning {
            isRunning = true
            startTime = now
        }
        lastError = nil
        let latency = learningTimingBreak ? nil : lastKeystrokeTime.map { now - $0 }
        learningTimingBreak = false
        if let previous = lastKeystrokeTime {
            keystrokeIntervals.append(now - previous)
            if keystrokeIntervals.count > 30 { keystrokeIntervals.removeFirst() }
        }
        lastKeystrokeTime = now
        totalKeystrokes += 1

        if mode == "strict" {
            let correct = scalar == target
            measure(target: target, error: !correct, latency: latency, advance: correct)
            if cells[currentIndex].typed == nil { netTypedChars += 1 }
            cells[currentIndex].typed = scalar
            if correct {
                correctKeystrokes += 1
                netCorrectChars += 1
                if scalar != 32 { correctNonSpaceChars += 1 }
                cells[currentIndex].status = "correct"
                currentIndex += 1
                if currentIndex >= cells.count { advanceLine(now: now) }
            } else {
                errorKeystrokes += 1
                errorsByChar[target!, default: 0] += 1
                cells[currentIndex].status = "incorrect"
                lastError = TypingError(expected: target, typed: scalar)
            }
        } else if scalar == 32 {
            submitWord(latency: latency, now: now)
        } else {
            netTypedChars += 1
            if target == 32 || target == nil {
                measure(target: target, error: true, latency: latency, advance: false)
                cells.insert(TypingCell(scalar: scalar, typed: scalar, status: "incorrect",
                    extra: true), at: currentIndex)
                currentIndex += 1
                errorKeystrokes += 1
                errorsByChar[scalar, default: 0] += 1
                lastError = TypingError(expected: target, typed: scalar)
            } else {
                let correct = scalar == target
                measure(target: target, error: !correct, latency: latency)
                if correct {
                    correctKeystrokes += 1
                    netCorrectChars += 1
                    correctNonSpaceChars += 1
                    cells[currentIndex].status = "correct"
                } else {
                    errorKeystrokes += 1
                    errorsByChar[target!, default: 0] += 1
                    cells[currentIndex].status = "incorrect"
                    lastError = TypingError(expected: target, typed: scalar)
                }
                cells[currentIndex].typed = scalar
                currentIndex += 1
                let lastWordStart = (cells.lastIndex { $0.scalar == 32 } ?? -1) + 1
                if currentIndex >= cells.count && timedDuration == 0 &&
                    currentLine == lines.count - 1 &&
                    cells[lastWordStart...].allSatisfy({ $0.status == "correct" }) {
                    advanceLine(now: now)
                }
            }
        }
        if lastError != nil && !word.isEmpty &&
            !missedWords.contains(where: { $0.utf8.elementsEqual(word.utf8) }) {
            missedWords.append(word)
        }
        tick(now: now)
    }

    func delete(word: Bool, now: Double) {
        guard !isComplete, !isPaused else { return }
        tick(now: now)
        guard !isComplete, mode == "flow", deleteBackward() else { return }
        lastError = nil
        if word {
            while currentIndex > 0 && cells[currentIndex - 1].scalar != 32 {
                if !deleteBackward() { break }
            }
        }
        tick(now: now)
    }

    func pause(now: Double) {
        guard isRunning, !isPaused else { return }
        tick(now: now)
        guard !isComplete else { return }
        pauseTime = now
        isPaused = true
    }

    func resume(now: Double) {
        guard isPaused else { return }
        startTime = startTime! + now - pauseTime!
        pauseTime = nil
        lastKeystrokeTime = nil
        isPaused = false
    }

    func tick(now: Double) {
        guard isRunning, !isPaused, !isComplete else { return }
        if timedDuration > 0 && elapsed(now: now) >= timedDuration {
            finish(now: now)
        }
    }

    func stats(now: Double) -> TypingStats {
        let seconds = elapsed(now: now)
        let minutes = seconds / 60
        let wordChars = Double(completedWordChars + wordCredit())
        let attempts = totalKeystrokes + skippedChars
        let accuracy = attempts > 0
            ? (Double(correctKeystrokes) / Double(attempts) * 1000).rounded() / 10 : 100
        var consistency: Double? = nil
        if keystrokeIntervals.count > 5 {
            let mean = keystrokeIntervals.reduce(0, +) / Double(keystrokeIntervals.count)
            if mean > 0 {
                let variance = keystrokeIntervals.reduce(0) { total, interval in
                    let difference = interval - mean
                    return total + difference * difference
                } / Double(keystrokeIntervals.count)
                consistency = max(20, min(100, (100 - variance.squareRoot() / mean * 45).rounded()))
            }
        }
        return TypingStats(
            wpm: minutes > 0 ? max(0, (wordChars / 5 / minutes).rounded()) : 0,
            rawWpm: minutes > 0 ? max(0, (Double(netTypedChars) / 5 / minutes).rounded()) : 0,
            cpm: minutes > 0 ? max(0, (wordChars / minutes).rounded()) : 0,
            accuracy: max(0, accuracy), consistency: consistency,
            elapsedMilliseconds: seconds * 1000, elapsedSeconds: seconds.rounded(),
            timeRemaining: max(0, timedDuration - seconds).rounded(.up),
            totalKeystrokes: totalKeystrokes, correctKeystrokes: correctKeystrokes,
            correctNonSpaceChars: correctNonSpaceChars, errorKeystrokes: errorKeystrokes,
            skippedChars: skippedChars, errorsByChar: errorsByChar, learning: learning,
            missedWords: missedWords,
            currentLineIndex: currentLine, totalLines: lines.count)
    }

    private func currentWord() -> String {
        guard !cells.isEmpty else { return "" }
        var start = min(currentIndex, cells.count - 1)
        if cells[start].scalar == 32 { start -= 1 }
        while start > 0 && cells[start - 1].scalar != 32 { start -= 1 }
        var end = max(0, start)
        while end < cells.count && cells[end].scalar != 32 { end += 1 }
        var word = ""
        for cell in cells[max(0, start)..<end] where !cell.extra {
            word.unicodeScalars.append(Unicode.Scalar(cell.scalar)!)
        }
        return word
    }

    private func elapsed(now: Double) -> Double {
        guard let start = startTime else { return 0 }
        let seconds = max(0, ((endTime ?? pauseTime ?? now) - start) / 1000)
        return timedDuration > 0 ? min(timedDuration, seconds) : seconds
    }

    private func setupLine(now: Double) {
        guard currentLine < lines.count else {
            finish(now: now)
            return
        }
        currentIndex = 0
        cells = lines[currentLine].unicodeScalars.map { TypingCell(scalar: $0.value) }
    }

    private func finish(now: Double) {
        guard !isComplete else { return }
        isComplete = true
        isRunning = false
        endTime = pauseTime ?? now
        isPaused = false
    }

    private func advanceLine(includeSeparator: Bool = false, now: Double) {
        learningLinePrevious = learningPrevious
        currentLine += 1
        if timedDuration > 0 && currentLine >= lines.count { currentLine = 0 }
        if currentLine < lines.count {
            completedWordChars += wordCredit(includeSeparator: includeSeparator)
            setupLine(now: now)
        } else {
            finish(now: now)
        }
    }

    private func wordCredit(includeSeparator: Bool = false) -> Int {
        var credit = 0
        var length = 0
        var clean = true
        for item in cells.prefix(currentIndex) {
            if item.scalar == 32 && !item.extra {
                if clean && item.status == "correct" { credit += length + 1 }
                length = 0
                clean = true
            } else {
                length += 1
                if item.status != "correct" || item.extra || item.skipped { clean = false }
            }
        }
        return credit + (clean ? length + (includeSeparator ? 1 : 0) : 0)
    }

    private func deleteBackward() -> Bool {
        guard currentIndex > 0 else { return false }
        let previous = cells[currentIndex - 1]
        if previous.scalar == 32 && !previous.extra {
            var start = currentIndex - 2
            while start >= 0 && cells[start].scalar != 32 { start -= 1 }
            if !cells[(start + 1)..<(currentIndex - 1)].contains(where: { $0.status == "incorrect" }) {
                return false
            }
        }
        currentIndex -= 1
        let item = cells[currentIndex]
        if item.status == "correct" {
            netCorrectChars -= 1
            if item.scalar != 32 { correctNonSpaceChars -= 1 }
        }
        if item.typed != nil { netTypedChars -= 1 }
        if item.extra {
            cells.remove(at: currentIndex)
        } else {
            cells[currentIndex].status = "pending"
            cells[currentIndex].typed = nil
            cells[currentIndex].skipped = false
        }
        while currentIndex > 0 && cells[currentIndex - 1].skipped {
            currentIndex -= 1
            cells[currentIndex].status = "pending"
            cells[currentIndex].skipped = false
        }
        if let preceding = cells.prefix(currentIndex).last(where: { !$0.extra }) {
            learningPrevious = learningKey(preceding.scalar)
        } else {
            learningPrevious = learningLinePrevious
        }
        learningTimingBreak = true
        return true
    }

    private func submitWord(latency: Double?, now: Double) {
        let firstSkipped = currentScalar
        var skipped = false
        while currentIndex < cells.count && currentScalar != 32 {
            let target = cells[currentIndex].scalar
            measure(target: target, error: true, latency: skipped ? nil : latency)
            cells[currentIndex].status = "incorrect"
            cells[currentIndex].skipped = true
            currentIndex += 1
            skippedChars += 1
            errorsByChar[target, default: 0] += 1
            skipped = true
        }
        if skipped { lastError = TypingError(expected: firstSkipped, typed: 32) }
        let separator = currentIndex < cells.count
        let followingLine = timedDuration > 0 || currentLine < lines.count - 1
        if separator || followingLine {
            measure(target: 32, error: false, latency: skipped ? nil : latency)
            correctKeystrokes += 1
            netCorrectChars += 1
            netTypedChars += 1
        } else {
            errorKeystrokes += 1
            errorsByChar[32, default: 0] += 1
            if !skipped { lastError = TypingError(expected: nil, typed: 32) }
        }
        if separator {
            cells[currentIndex].status = "correct"
            cells[currentIndex].typed = 32
            currentIndex += 1
        }
        if currentIndex >= cells.count {
            advanceLine(includeSeparator: !separator && followingLine, now: now)
        }
    }

    private func learningKey(_ scalar: UInt32?) -> String? {
        guard let scalar, scalar >= 32, scalar <= 126 else { return nil }
        let lowercase = scalar >= 65 && scalar <= 90 ? scalar + 32 : scalar
        return String(Unicode.Scalar(lowercase)!)
    }

    private func measure(target: UInt32?, error: Bool, latency: Double?, advance: Bool = true) {
        let key = learningKey(target)
        if let key {
            addObservation(to: &learning.keys, key: key, error: error, latency: latency)
            if let previous = learningPrevious {
                addObservation(to: &learning.bigrams, key: previous + key, error: error, latency: latency)
            }
        } else {
            learningTimingBreak = true
        }
        if advance { learningPrevious = key }
    }

    private func addObservation(to cells: inout [String: LearningObservation], key: String,
        error: Bool, latency: Double?) {
        var cell = cells[key] ?? LearningObservation()
        cell.attempts += 1
        if error { cell.errors += 1 }
        if let latency, latency.isFinite && latency >= 0 {
            cell.latencySamples += 1
            cell.latencyTotalMs += latency
        }
        cells[key] = cell
    }
}
