let session = TypingSession()
let bufferCapacity = 1_048_576
let inputBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferCapacity)
var outputCapacity = 65_536
var outputBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: outputCapacity)
var outputLength: Int32 = 0

func inputText(_ count: Int32) -> String {
    guard count >= 0, count < bufferCapacity else { return "" }
    return String(decoding: UnsafeBufferPointer(start: inputBuffer, count: Int(count)), as: UTF8.self)
}

func output(_ text: String) {
    let bytes = Array(text.utf8)
    if bytes.count > outputCapacity {
        let capacity = max(bytes.count, outputCapacity * 2)
        let replacement = UnsafeMutablePointer<UInt8>.allocate(capacity: capacity)
        outputBuffer.deallocate()
        outputBuffer = replacement
        outputCapacity = capacity
    }
    for (index, byte) in bytes.enumerated() { outputBuffer[index] = byte }
    outputLength = Int32(bytes.count)
}

func escaped(_ text: String) -> String {
    var result = ""
    for scalar in text.unicodeScalars {
        switch scalar.value {
        case 38: result += "&amp;"
        case 60: result += "&lt;"
        case 62: result += "&gt;"
        case 34: result += "&quot;"
        case 39: result += "&#39;"
        default: result += String(scalar)
        }
    }
    return result
}

func quoted(_ text: String) -> String {
    var result = "\""
    for scalar in text.unicodeScalars {
        switch scalar.value {
        case 34: result += "\\\""
        case 92: result += "\\\\"
        case 0...31: result += "\\u" + String(repeating: "0", count: 4 - String(scalar.value, radix: 16).utf8.count) + String(scalar.value, radix: 16)
        default: result += String(scalar)
        }
    }
    return result + "\""
}

func observations(_ cells: [String: LearningObservation]) -> String {
    return "{" + cells.map { key, cell in
        quoted(key) + ":{\"attempts\":\(cell.attempts),\"errors\":\(cell.errors),\"latencySamples\":\(cell.latencySamples),\"latencyTotalMs\":\(cell.latencyTotalMs)}"
    }.joined(separator: ",") + "}"
}

@_cdecl("typeflow_input") func browserInput() -> UnsafeMutablePointer<UInt8> { inputBuffer }
@_cdecl("typeflow_output") func browserOutput() -> UnsafeMutablePointer<UInt8> { outputBuffer }
@_cdecl("typeflow_length") func browserLength() -> Int32 { outputLength }
@_cdecl("typeflow_capacity") func browserCapacity() -> Int32 { Int32(bufferCapacity) }
@_cdecl("typeflow_load") func load(_ count: Int32, _ strict: Int32, _ duration: Double) {
    session.initialize(lines: inputText(count).split(separator: "\n").map(String.init), mode: strict == 1 ? "strict" : "flow", duration: duration)
}
@_cdecl("typeflow_key") func key(_ scalar: UInt32, _ now: Double) { session.key(scalar: scalar, now: now) }
@_cdecl("typeflow_delete") func delete(_ word: Int32, _ now: Double) { session.delete(word: word == 1, now: now) }
@_cdecl("typeflow_pause") func pause(_ now: Double) { session.pause(now: now) }
@_cdecl("typeflow_resume") func resume(_ now: Double) { session.resume(now: now) }
@_cdecl("typeflow_tick") func tick(_ now: Double) { session.tick(now: now) }

@_cdecl("typeflow_snapshot") func snapshot(_ now: Double) {
    let s = session.stats(now: now)
    let errors = s.errorsByChar.map { quoted(String(Unicode.Scalar($0.key)!)) + ":\($0.value)" }.joined(separator: ",")
    let expected = session.lastError?.expected.map { quoted(String(Unicode.Scalar($0)!)) } ?? "null"
    let typed = session.lastError.map { quoted(String(Unicode.Scalar($0.typed)!)) } ?? "null"
    let current = session.currentScalar.map { quoted(String(Unicode.Scalar($0)!)) } ?? "null"
    let consistency = s.consistency.map { String($0) } ?? "null"
    let missedWords = s.missedWords.map(quoted).joined(separator: ",")
    let state = "\"status\":\(quoted(session.status)),\"currentChar\":\(current),\"currentIndex\":\(session.currentIndex),\"expected\":\(expected),\"typed\":\(typed)"
    let scores = "\"wpmMetric\":\"words-v1\",\"wpm\":\(s.wpm),\"rawWpm\":\(s.rawWpm),\"cpm\":\(s.cpm),\"accuracy\":\(s.accuracy),\"consistency\":\(consistency)"
    let time = "\"elapsedMilliseconds\":\(s.elapsedMilliseconds),\"elapsedSeconds\":\(s.elapsedSeconds),\"timeRemaining\":\(s.timeRemaining)"
    let counts = "\"totalKeystrokes\":\(s.totalKeystrokes),\"correctKeystrokes\":\(s.correctKeystrokes),\"correctNonSpaceChars\":\(s.correctNonSpaceChars),\"errorKeystrokes\":\(s.errorKeystrokes),\"skippedChars\":\(s.skippedChars)"
    let learning = "\"learning\":{\"keys\":\(observations(s.learning.keys)),\"bigrams\":\(observations(s.learning.bigrams))}"
    output("{\(state),\(scores),\(time),\(counts),\"errorsByChar\":{\(errors)},\(learning),\"missedWords\":[\(missedWords)],\"currentLineIndex\":\(s.currentLineIndex),\"totalLines\":\(s.totalLines)}")
}

@_cdecl("typeflow_render") func render(_ region: Int32, _ now: Double) {
    if region == 0 { output(shell); return }
    let s = session.stats(now: now)
    if region == 2 {
        output("""
        <div class="result-heading"><p class="eyebrow">Your practice</p><h1>Session complete</h1><p id="coaching"></p></div>
        <div class="result-main"><div class="result-primary"><span>wpm</span><strong>\(Int(s.wpm))</strong><small>Correct words</small></div><div class="result-primary"><span>accuracy</span><strong>\(s.accuracy)%</strong><small>All attempts, including skipped targets</small></div></div>
        <div class="result-details"><div><span>raw wpm</span><strong>\(Int(s.rawWpm))</strong></div><div><span>errors</span><strong>\(s.errorKeystrokes)</strong></div><div><span>skipped</span><strong>\(s.skippedChars)</strong></div><div><span>consistency</span><strong>\(s.consistency.map { String(Int($0)) + "%" } ?? "Not enough data")</strong></div></div>
        <section id="practice-comparison" class="key-map" hidden></section><section class="key-map" aria-label="Result keyboard map"><div id="result-keyboard"></div></section>
        <p id="save-status" role="status">Saving progress…</p><div class="result-actions"><button class="primary-button" data-action="next">Next lesson</button><button class="text-button" data-action="repeat">Try again</button><button class="text-button" data-action="missed">Practice missed words</button><button class="text-button" data-action="card">Download result card</button><button class="text-button" data-action="back">Back to practice</button></div>
        """)
        return
    }
    var html = ""
    var word = ""
    for (index, cell) in session.cells.enumerated() {
        let char = cell.scalar == 32 ? "&nbsp;" : escaped(String(Unicode.Scalar(cell.scalar)!))
        word += "<span data-index=\"\(index)\" class=\"char \(cell.status)\(cell.extra ? " extra" : "")\(cell.skipped ? " skipped" : "")\">\(char)</span>"
        if cell.scalar == 32 || index == session.cells.count - 1 {
            html += "<span class=\"word\">\(word)</span>"
            word = ""
        }
    }
    html += "<span data-index=\"\(session.cells.count)\" class=\"char\">&nbsp;</span>"
    if session.currentLine + 1 < session.lines.count { html += "<div class=\"next-line\">\(escaped(session.lines[session.currentLine + 1]))</div>" }
    html += "<span class=\"caret\(session.isRunning ? " moving" : "")\"></span>"
    output(html)
}

let shell = """
<div class="app lesson-mode"><header class="header"><a class="brand" href="../"><strong>typeflow<span class="brand-period">.</span></strong><small>Swift · WebAssembly</small></a><nav class="navigation" aria-label="Practice"><button class="choice" data-action="lessons">Lessons</button><button class="choice" data-action="test">Test</button><button class="choice" data-action="quote">Quotes</button><button class="choice" data-action="custom">Custom text</button></nav><div class="header-actions"><button class="text-button" data-action="history">History</button><button class="text-button" data-action="settings">Settings</button></div></header>
<main class="main"><section id="exercise"><div class="test-toolbar"><button class="text-button" data-action="lessons">Change lesson</button><button class="text-button" data-action="test">Skip to test</button></div><div class="test-heading"><p class="eyebrow" id="exercise-kind">Guided lesson</p><h1 id="exercise-title"></h1></div><p class="lesson-instructions" id="instructions"></p><p class="lesson-goal" id="lesson-goal"></p><p class="arena-help" id="quote-source"></p><div class="live-stats" aria-hidden="true"><span><strong id="live-wpm">0</strong><small>wpm</small></span><span><strong id="live-accuracy">100%</strong><small>accuracy</small></span><span><strong id="live-time">0s</strong><small>time</small></span></div>
<div class="arena-meta"><span id="mode-label">english · guided</span><span id="position">line 1</span></div><div class="arena focused" id="arena"><p class="sr-only" id="exercise-prompt"></p><div class="text-viewport" aria-hidden="true"><div class="typing-text" id="passage"></div></div><textarea class="typing-input" aria-label="Typing input" aria-describedby="exercise-prompt typing-help typing-feedback" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></textarea><button class="focus-prompt" id="focus-prompt" hidden>Click here to start typing</button></div><p class="arena-help" id="typing-help">Take your time. Each correct key moves you forward.</p><p class="sr-only" id="typing-feedback" role="status"></p><div class="restart-row"><button class="text-button" data-action="restart">Restart</button></div>
<section class="guidance" aria-label="Typing guides"><div class="hands-container" id="hands"></div><div class="keyboard-container" id="keyboard" aria-hidden="true"></div></section><section class="learning-prompt" aria-label="Adaptive practice"><p id="recommendation"></p><button class="text-button" data-action="weak">Practice weak keys</button><button class="text-button" data-action="pairs">Practice pairs</button></section><p class="arena-help" id="keyboard-notice" hidden>A physical keyboard works best. The guides show which finger to use.</p></section><section class="results" id="results" aria-label="Typing results" hidden></section>
<p class="arena-help" id="recovery" role="status" hidden>Progress could not be saved. Keep this tab open or export a backup. <button class="text-button" data-action="retry-save">Retry save</button> <button class="text-button" data-action="backup">Export backup</button></p></main><footer class="footer"><span>Learn at your pace. Accuracy comes first.</span><div><span id="offline-status" role="status">Preparing offline lessons…</span><a href="../">React version</a></div></footer></div>
<dialog class="dialog" id="lessons-dialog" aria-labelledby="lessons-title"><div class="dialog-heading"><h2 id="lessons-title">Choose a lesson</h2><button class="text-button" data-action="close">Close</button></div><div class="setting-choices lesson-tracks"><button class="choice" data-track="amateur">Foundation</button><button class="choice" data-track="pro">Advanced</button></div><p class="lesson-path" id="lesson-path"></p><div class="lesson-list" id="lesson-list"></div></dialog>
<dialog class="dialog settings" id="settings-dialog" aria-labelledby="settings-title"><div class="dialog-heading"><h2 id="settings-title">Settings</h2><button class="text-button" data-action="close">Close</button></div><label class="setting-row">Keyboard layout<select name="keyboardLayout"></select></label><label class="setting-row">Typing mode<select name="typingMode"><option value="strict">Guided</option><option value="flow">Free flow</option></select></label><label class="setting-row">Appearance<select name="theme"><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label><label class="setting-row">Palette<select name="colorPalette"><option value="mint">Mint</option><option value="ocean">Ocean</option><option value="plum">Plum</option></select></label><label class="setting-row">Test mode<select name="testMode"><option value="time">Time</option><option value="words">Words</option></select></label><label class="setting-row">Duration<select name="testDuration"><option>15</option><option>30</option><option>60</option><option>120</option></select></label><label class="setting-row">Word count<select name="testWordCount"><option>10</option><option>25</option><option>50</option><option>100</option></select></label><label class="setting-row">Punctuation<input type="checkbox" name="punctuation"></label><label class="setting-row">Numbers<input type="checkbox" name="numbers"></label><label class="setting-row">Show keyboard<input type="checkbox" name="showKeyboard"></label><label class="setting-row">Show hands<input type="checkbox" name="showHands"></label><label class="setting-row">Mute sound<input type="checkbox" name="soundMuted"></label></dialog>
<dialog class="dialog" id="custom-dialog" aria-labelledby="custom-title"><div class="dialog-heading"><h2 id="custom-title">Practice your text</h2><button class="text-button" data-action="close">Close</button></div><label>Text to practice<textarea id="custom-text" maxlength="12000" rows="5"></textarea></label><button class="primary-button" data-action="custom-start">Start custom text</button></dialog><dialog class="dialog" id="history-dialog" aria-labelledby="history-title"><div class="dialog-heading"><h2 id="history-title">Practice history</h2><button class="text-button" data-action="close">Close</button></div><div id="history-content"></div></dialog>
"""
