let session = TypingSession()
var bufferCapacity = 1_048_576
var inputBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferCapacity)
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
@_cdecl("typeflow_reserve") func browserReserve(_ count: Int32) -> UnsafeMutablePointer<UInt8> {
    if count >= bufferCapacity {
        bufferCapacity = max(Int(count) + 1, bufferCapacity * 2)
        inputBuffer.deallocate()
        inputBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferCapacity)
    }
    return inputBuffer
}
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

let shell = appShell
