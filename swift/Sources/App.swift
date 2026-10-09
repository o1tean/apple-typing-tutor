// Application state, rendering and browser policy are owned by Swift.
final class SwiftApp {
    let key = "apple_typing_tutor_data_v1"
    var store = SwiftStore()
    var settings: JSON = .object([:])
    var exercise: JSON = .null
    var result: JSON = .null
    var commands: [JSON] = []
    var samples: [JSON] = []
    var pressed: Set<String> = []
    var now = 0.0
    var epoch = 0.0
    var iso = ""
    var dark = true
    var coarse = false
    var reduced = false
    var hidden = false
    var focused = false
    var caps = false
    var composing = false
    var compositionCommitted = false
    var ready = false
    var dialog = ""
    var lessonTrack = "amateur"
    var run = 0
    var savingRun: [Int: Int] = [:]
    var activeWrite: Int? = nil
    var retrying = false
    var changingSetting = false
    var phone = false
    var demoIndex = 0
    var demoPlaying = true
    var demoAt = 0.0
    var demoMounted = false
    var customText = ""
    var backingDown = false
    var backupText = ""
    var historyDates: JSON = .null
    var historyRequest = 0

    var preset: String { settings["keyboardLayout"].text ?? "mac-us" }
    var capturedPreset: String { exercise["keyboardLayout"].text ?? preset }
    var track: String { exercise["track"].text ?? "" }
    var profile: JSON { migrateLearning(store.data["learning"]) }
    func s(_ value: JSON, _ name: String, _ fallback: String = "") -> String { value[name].text ?? fallback }
    func n(_ value: JSON, _ name: String, _ fallback: Double = 0) -> Double { value[name].numeric ?? fallback }
    func num(_ value: Double) -> String { Practice.number(value) }
    func e(_ value: String) -> String { escaped(value) }
    func cmd(_ op: String, _ fields: [String: JSON] = [:]) {
        var command = JSON.object(fields)
        command["op"] = .string(op)
        commands.append(command)
    }
    func html(_ selector: String, _ value: String) { cmd("html", ["selector": .string(selector), "value": .string(value)]) }
    func text(_ selector: String, _ value: String) { cmd("text", ["selector": .string(selector), "value": .string(value)]) }
    func prop(_ selector: String, _ name: String, _ value: JSON) { cmd("prop", ["selector": .string(selector), "name": .string(name), "value": value]) }
    func hide(_ selector: String, _ value: Bool) { prop(selector, "hidden", .bool(value)) }
    func attr(_ selector: String, _ name: String, _ value: String?) { cmd("attr", ["selector": .string(selector), "name": .string(name), "value": value.map(JSON.string) ?? .null]) }
    func focus(_ selector: String) { cmd("focus", ["selector": .string(selector)]) }
    func stats() -> JSON {
        snapshot(now)
        return JSON.parse(String(decoding: UnsafeBufferPointer(start: outputBuffer, count: Int(outputLength)), as: UTF8.self)) ?? .object([:])
    }
    func button(_ action: String, _ label: String, primary: Bool = false, extra: String = "") -> String {
        "<button class=\"\(primary ? "primary-button" : "text-button")\" data-action=\"\(action)\" \(extra)>\(e(label))</button>"
    }
    func read(_ purpose: String, id: Int = 0, lock: Bool = false) {
        cmd("read", ["key": .string(key), "purpose": .string(purpose), "id": .number(Double(id)), "lock": .bool(lock)])
    }
    func requestWrite() {
        guard activeWrite == nil, let id = store.nextWriteID else { return }
        activeWrite = id
        read("write", id: id, lock: true)
        saveStatus()
    }
    func saveStatus() {
        let pending = store.pendingCount > 0 || activeWrite != nil
        hide("#recovery", !store.saveFailed && !pending)
        text("#storage-status", store.saveConflict ? "another tab changed saved data · this session is in memory" : store.saveFailed ? "storage unavailable · session only" : pending ? "saving progress · session in memory" : "saved on this device")
        text("#save-status", pending ? "Saving progress… You can start another test." : store.saveFailed ? "Progress is in memory. Export a backup or retry saving." : "Progress saved on this device.")
        if dialog == "recovery" { prop("#retry-button", "disabled", .bool(pending || retrying)) }
    }
    func applyAppearance() {
        attr("html", "data-theme", s(settings, "theme") == "system" ? (dark ? "dark" : "light") : s(settings, "theme", "dark"))
        attr("html", "data-palette", s(settings, "colorPalette", "mint"))
        text("#sound-toggle", "sound \(settings["soundMuted"].boolean == true ? "off" : "on")")
    }
    func settingsControls() {
        for field in defaultTypeflowSettings.members {
            let member = JSONMember(key: field.key, value: settings[field.key])
            let selector = "#settings-dialog [name=\"\(member.key)\"]"
            if member.value.boolean != nil { prop(selector, "checked", member.value) }
            else { prop(selector, "value", member.key == "volume" ? .string(num((member.value.numeric ?? 0.6) * 100)) : .string(member.value.text ?? member.value.encoded())) }
        }
        text("#volume-label", "Volume \(num(n(settings, "volume", 0.6) * 100))%")
        text("#layout-help", "Match your operating system’s input source. \(preset == "uk-iso" ? "UK ISO uses Windows UK characters and PC modifier labels." : "ANSI guides use Mac modifier labels and keep Caps Lock unchanged.") Changing layout restarts unfinished practice. Stars and weak-key measurements are shared across layouts.")
    }
    func load(_ next: JSON) {
        let keepDialog = changingSetting && dialog == "settings"
        if !keepDialog { closeDialog(refocus: false) }
        run += 1
        exercise = next
        exercise["keyboardLayout"] = .string(preset)
        exercise["typingMode"] = settings["typingMode"]
        result = .null
        samples = []
        pressed = []
        composing = false
        compositionCommitted = false
        phone = false
        session.initialize(lines: Practice.strings(exercise["lines"]), mode: s(settings, "typingMode", "strict"), duration: n(exercise, "duration"))
        hide("#exercise", false)
        hide("#results", true)
        html("#results", "")
        renderExercise()
        update(passage: true)
        cmd("scroll")
        if !coarse && !keepDialog { focus("#typing-input") }
    }
    func lesson(_ which: String, _ index: Int) {
        let lessons = Practice.lessonsForLayout(which, preset: preset)
        guard lessons.indices.contains(index) else { return }
        lessonTrack = which
        var next = lessons[index]
        next["lines"] = Practice.stringList(Practice.generateLessonDrill(which, index: index, preset: preset))
        next["track"] = .string("lesson")
        next["lessonTrack"] = .string(which)
        next["lessonIndex"] = .number(Double(index))
        load(next)
    }
    func testExercise() {
        let timed = s(settings, "testMode") == "time"
        let count = n(settings, timed ? "testDuration" : "testWordCount", timed ? 30 : 25)
        var id = "\(timed ? "time" : "words")-\(num(count))"
        if settings["punctuation"].boolean == true { id += "-punctuation" }
        if settings["numbers"].boolean == true { id += "-numbers" }
        load(.object(["track": .string("test"), "id": .string(id), "title": .string("\(num(count)) \(timed ? "second" : "word") test"), "lines": Practice.stringList([Practice.generateWords(timed ? 400 : Int(count), options: settings)]), "duration": .number(timed ? count : 0), "options": settings]))
    }
    func quote() {
        let quotes = Practice.curriculum["quotes"].list ?? []
        guard !quotes.isEmpty else { return }
        let index = track == "quote" ? (Int(n(exercise, "quoteIndex")) + 1) % quotes.count : Int.random(in: quotes.indices)
        let value = quotes[index]
        load(.object(["track": .string("quote"), "id": .string("quote-" + s(value, "id")), "title": .string("quote · " + s(value, "author")), "lines": Practice.stringList([s(value, "text")]), "quoteIndex": .number(Double(index)), "author": value["author"], "source": value["source"]]))
    }
    func weak(_ group: String = "keys", using: JSON? = nil) {
        var drill = Practice.generateWeakDrill(using ?? profile, preset: preset, group: group)
        guard !(drill["focusKeys"].list ?? []).isEmpty else { return }
        drill["track"] = .string("weak")
        drill["focusGroup"] = .string(group)
        drill["id"] = .string(group == "keys" ? "weak-keys" : "weak-pairs")
        drill["title"] = .string(group == "keys" ? "Weak-key practice" : "Pair practice")
        drill["options"] = .object(["recordEligible": .bool(false)])
        load(drill)
    }
    func restart(repeatText: Bool = false) {
        if repeatText {
            var next = exercise
            next["options"]["recordEligible"] = .bool(false)
            if track == "weak", !result.isNull { next["learningBefore"] = mergeLearning(exercise["learningBefore"], result["learning"]) }
            load(next)
        } else if track == "test" { testExercise() }
        else if track == "quote" { quote() }
        else if track == "lesson" { lesson(s(exercise, "lessonTrack"), Int(n(exercise, "lessonIndex"))) }
        else if track == "weak" { weak(s(exercise, "focusGroup", "keys"), using: exercise["learningBefore"]) }
        else { load(exercise) }
    }
    func setting(_ name: String, _ value: JSON) {
        guard validSetting(name, value) else { return }
        changingSetting = true
        defer { changingSetting = false }
        settings[name] = value
        _ = store.enqueueSetting(key: name, value: value)
        applyAppearance()
        settingsControls()
        if ["testMode", "testDuration", "testWordCount", "punctuation", "numbers"].contains(name) { testExercise() }
        else if name == "typingMode" {
            if track == "lesson" && capturedPreset != preset { restart() }
            else if track == "weak" && !result.isNull { restart(repeatText: true) }
            else { load(exercise) }
        }
        else if name == "keyboardLayout", result.isNull, !phone { restart() }
        else { renderGuides(); if phone { renderDemo() } }
        requestWrite()
    }
    func recommendation() -> String {
        let learning = profile
        var value = "<aside class=\"learning-prompt lesson-instructions\" aria-label=\"Return to learning\">"
        let latest = Practice.latestLesson(store.data["history"].list ?? [], progress: store.data["progress"])
        if let which = latest["track"].text {
            let index = Int(n(latest, "index"))
            let lessons = Practice.lessonsForLayout(which, preset: preset)
            if lessons.indices.contains(index) { value += "<div class=\"learning-return\"><div><strong>\(e(s(lessons[index], "title")))</strong><p>Start a fresh drill from your latest recorded lesson.</p></div>" + button("lesson", "Continue lesson", primary: true, extra: "data-track=\"\(which)\" data-index=\"\(index)\"") + "</div>" }
        }
        for group in ["keys", "bigrams"] {
            let targets = Practice.focusKeys(learning, limit: group == "keys" ? 3 : 1, group: group)
            let label = group == "keys" ? "key" : "pair"
            value += "<div><details><summary>Suggested \(label) practice</summary><section aria-label=\"\(group == "keys" ? "Learning recommendation" : "Pair recommendation")\">"
            value += targets.isEmpty ? "<p>\(n(learning, "version") > 1 ? "Recommendations are unavailable for this newer saved profile. Your progress is preserved." : "No \(label) recommendation yet. Complete a lesson or test to gather more observations.")</p>" : "<p>Selected from recent errors and relative reach times across layouts.</p><p>" + targets.map { e(Practice.focusLabel($0) + ": " + Practice.practiceObservation(learning[group][$0], recent: true)) }.joined(separator: " · ") + "</p>"
            value += "</section></details>" + button(group == "keys" ? "weak" : "pairs", group == "keys" ? "Practice weak keys" : "Practice this pair: " + (targets.first.map(Practice.focusLabel) ?? ""), extra: targets.isEmpty ? "disabled" : "") + "</div>"
        }
        return value + "</aside>"
    }
    func renderExercise() {
        attr(".app", "class", "app \(["lesson", "weak"].contains(track) ? "lesson-mode" : "")")
        text("#exercise-title", s(exercise, "title"))
        text("#exercise-kind", track == "lesson" ? "Learn touch typing." : track == "weak" ? "Make the tricky keys familiar." : "Just you and the keys.")
        text("#instructions", s(exercise, "description"))
        html("#lesson-goal", track == "lesson" ? "<details><summary>Lesson targets</summary>3 stars: \(num(n(exercise, "targetWpm"))) WPM · \(num(n(exercise, "targetAccuracy")))% accuracy · no skipped characters</details><p><strong>Practice keys:</strong> \(e(Practice.strings(exercise["keysIntroduced"]).map { $0 == " " ? "Space" : $0 }.joined(separator: " · ")))</p>" : track == "weak" ? "<ul class=\"focus-chips\" aria-label=\"\(s(exercise, "focusGroup") == "bigrams" ? "Focus pair" : "Focus keys")\">" + Practice.strings(exercise["focusKeys"]).map { "<li><kbd>\(e(Practice.focusLabel($0)))</kbd></li>" }.joined() + "</ul>" : "")
        html("#quote-source", exercise["source"].text.map { "\(e(s(exercise, "author"))) · <a href=\"\(e($0))\" target=\"_blank\" rel=\"noreferrer\">Read the public-domain source</a>" } ?? "")
        text("#typing-help", session.mode == "strict" ? "Take your time. Each correct key moves you forward." : "Find your rhythm. Space moves to the next word; backspace corrects mistakes.")
        text("#exercise-prompt", Practice.strings(exercise["lines"]).joined(separator: " "))
        text("#typing-feedback", "")
        hide("#keyboard-notice", !coarse)
        html("#learning", recommendation())
        hide("#learning", phone || track != "test")
        hide("#phone-demo", !phone)
        hide(".live-stats", phone)
        hide("#arena-wrap", phone)
        renderToolbar()
        renderGuides()
    }
    func renderToolbar() {
        var value = ""
        if track == "test" {
            for name in ["punctuation", "numbers"] { value += button("toggle", name, extra: "data-name=\"\(name)\" aria-pressed=\"\(settings[name].boolean == true)\"") }
            for name in ["time", "words"] { value += button("set", name, extra: "data-name=\"testMode\" data-value=\"\(name)\" aria-pressed=\"\(s(settings, "testMode") == name)\"") }
            let timed = s(settings, "testMode") == "time"
            value += "<div class=\"toolbar-group counts\" role=\"group\" aria-label=\"\(timed ? "Test duration" : "Word count")\">"
            for count in timed ? [15,30,60,120] : [10,25,50,100] { value += button("set", String(count), extra: "data-name=\"\(timed ? "testDuration" : "testWordCount")\" data-value=\"\(count)\" aria-label=\"\(count) \(timed ? "seconds" : "words")\" aria-pressed=\"\(n(settings, timed ? "testDuration" : "testWordCount") == Double(count))\"") }
            value += "</div>"
        } else if track == "lesson" { value = button("lessons", "Change lesson") + button("test", "Skip to test") }
        else if track == "custom" { value = button("custom", "Edit text") }
        if track != "test" && !Practice.focusKeys(profile).isEmpty { value += button("weak", "Practice weak keys") }
        html("#toolbar", value)
    }
    func renderGuides() {
        let target = session.isComplete ? nil : session.currentScalar.map { String(Unicode.Scalar($0)!) } ?? (session.mode == "flow" ? " " : nil)
        html("#keyboard", Guides.renderKeyboard(preset: capturedPreset, target: target, pressed: pressed, caps: caps))
        html("#hands", Guides.renderHands(preset: capturedPreset, target: target))
        hide("#keyboard", settings["showKeyboard"].boolean != true)
        hide("#hands", settings["showHands"].boolean != true)
        hide("#guidance", phone || !result.isNull)
        text("#caps-status", caps ? "caps lock is on" : "")
    }
    func anchor() {
        cmd("anchor", ["selector": .string("#passage .caret"), "target": .string("#passage [data-index=\"\(session.currentIndex)\"]"), "parent": .string("#passage"), "viewport": .string(".text-viewport"), "height": .number(0.65)])
        hide("#passage .caret", !focused)
    }
    func update(passage: Bool = false) {
        guard ready, result.isNull else { return }
        let value = stats()
        Practice.recordSpeedSample(&samples, stats: value)
        text("#live-wpm", num(n(value, "wpm")))
        text("#live-accuracy", num(n(value, "accuracy", 100)) + "%")
        text("#live-time", num(n(value, n(exercise, "duration") > 0 ? "timeRemaining" : "elapsedSeconds")) + "s")
        text("#position", "\(session.status) · line \(min(session.currentLine + 1, session.lines.count)) of \(session.lines.count)")
        text("#mode-label", session.mode == "strict" ? "english · guided" : "english · free flow")
        if passage {
            render(1, now)
            html("#passage", String(decoding: UnsafeBufferPointer(start: outputBuffer, count: Int(outputLength)), as: UTF8.self))
            renderGuides()
            anchor()
        }
        if session.isComplete { complete(value) }
    }
    func type(_ value: String) {
        guard result.isNull, !phone, dialog.isEmpty, !session.isPaused else { return }
        let normalized = String(decoding: Array(value._nfcCodeUnits), as: UTF8.self)
        for scalar in normalized.unicodeScalars {
            if session.isComplete { break }
            let previous = session.totalKeystrokes
            session.key(scalar: Practice.whitespace(scalar) ? 32 : scalar.value, now: now)
            if session.totalKeystrokes > previous {
                if let error = session.lastError {
                    text("#typing-feedback", Practice.typingErrorMessage(error.expected.map { String(Unicode.Scalar($0)!) }, typed: String(Unicode.Scalar(error.typed)!), mode: session.mode))
                    sound("error")
                } else { text("#typing-feedback", ""); sound("key") }
            }
        }
        update(passage: true)
    }
    func complete(_ final: JSON) {
        guard result.isNull else { return }
        result = final
        result["keyboardLayout"] = .string(capturedPreset)
        result["saving"] = .bool(true)
        Practice.recordSpeedSample(&samples, stats: final, final: true)
        var options = exercise["options"]
        options["typingMode"] = exercise["typingMode"]
        options["recordEligible"] = .bool(!["custom", "retry"].contains(track) && options["recordEligible"].boolean != false)
        if let id = store.enqueueLesson(lessonId: s(exercise, "id"), stats: final, targetWpm: n(exercise, "targetWpm", 45), targetAccuracy: n(exercise, "targetAccuracy", 95), options: options, timestamp: epoch, date: iso) { savingRun[id] = run }
        else { result["saving"] = .bool(false); result["saved"] = .bool(false) }
        hide("#exercise", true)
        hide("#results", false)
        renderResults()
        renderGuides()
        sound("success")
        focus(track == "weak" ? "#practice-comparison [data-action=\"weak-next\"]" : "#results button")
        requestWrite()
    }
    func speedChart() -> String {
        let duration = n(result, "elapsedMilliseconds")
        guard duration > 0, !samples.isEmpty else { return "<p class=\"chart-empty\">\(duration <= 0 ? "No measured typing time." : "No speed samples were recorded.")</p>" }
        let maximum = max(20, ((samples.map { n($0, "wpm") }.max() ?? 0) / 20).rounded(.up) * 20)
        let points = samples.map { "\(num(n($0, "elapsedMilliseconds") / duration * 100)),\(num(100 - n($0, "wpm") / maximum * 100))" }.joined(separator: " ")
        var value = "<div class=\"chart\"><p id=\"chart-description\" class=\"chart-caption\">Overall WPM at each recorded time.\(samples.count == 1 ? " One sample; no trend available." : "")</p><div class=\"chart-grid\"><div class=\"chart-y-axis\" aria-hidden=\"true\"><span>\(num(maximum))</span><span>\(num(maximum / 2))</span><span>0</span></div><svg viewBox=\"0 0 100 100\" preserveAspectRatio=\"none\" role=\"img\" aria-label=\"\(samples.count) speed samples over \(Practice.formatElapsedTime(duration)). Vertical axis: 0 to \(num(maximum)) WPM.\" aria-describedby=\"chart-description\">"
        for y in [0,50,100] { value += "<line x1=\"0\" x2=\"100\" y1=\"\(y)\" y2=\"\(y)\" vector-effect=\"non-scaling-stroke\"/>" }
        value += "<polyline points=\"\(points)\" vector-effect=\"non-scaling-stroke\"/>"
        for sample in samples { value += "<path d=\"M\(num(n(sample, "elapsedMilliseconds") / duration * 100)) \(num(100 - n(sample, "wpm") / maximum * 100))l0 0\" stroke=\"var(--accent)\" stroke-width=\"5\" stroke-linecap=\"round\" vector-effect=\"non-scaling-stroke\"><title>\(Practice.formatElapsedTime(n(sample, "elapsedMilliseconds"))): \(num(n(sample, "wpm"))) wpm</title></path>" }
        return value + "</svg><div class=\"chart-x-axis\" aria-hidden=\"true\"><span>0s</span><span>\(Practice.formatElapsedTime(duration))</span></div></div><details><summary>View speed samples</summary><p>" + samples.map { "\(Practice.formatElapsedTime(n($0, "elapsedMilliseconds"))): \(num(n($0, "wpm"))) wpm" }.joined(separator: " · ") + "</p></details></div>"
    }
    func measurementTables(_ learning: JSON) -> String {
        var value = "<details><summary>View key and pair details</summary>"
        for group in ["keys", "bigrams"] {
            let cells = learning[group].members.filter { n($0.value, "attempts") > 0 }.sorted {
                let left = n($0.value, "errors") / n($0.value, "attempts")
                let right = n($1.value, "errors") / n($1.value, "attempts")
                if left != right { return left > right }
                return n($0.value, "latencyTotalMs") / max(1, n($0.value, "latencySamples")) > n($1.value, "latencyTotalMs") / max(1, n($1.value, "latencySamples"))
            }.prefix(group == "keys" ? 95 : 12)
            if cells.isEmpty { continue }
            value += "<table><caption>\(group == "keys" ? "Target keys" : "Most difficult pairs") · ␣ means Space</caption><thead><tr><th scope=\"col\">Target</th><th scope=\"col\">Attempts</th><th scope=\"col\">Errors</th><th scope=\"col\">Average reach</th></tr></thead><tbody>"
            for cell in cells { value += "<tr><th scope=\"row\">\(e(Practice.focusLabel(cell.key)))</th><td>\(num(n(cell.value, "attempts")))</td><td>\(num(n(cell.value, "errors")))</td><td>\(n(cell.value, "latencySamples") > 0 ? num((n(cell.value, "latencyTotalMs") / n(cell.value, "latencySamples")).rounded()) + " ms" : "Not measured")</td></tr>" }
            value += "</tbody></table>"
        }
        return value + "</details>"
    }
    func comparison() -> String {
        guard track == "weak" else { return "" }
        let group = s(exercise, "focusGroup", "keys")
        let projected = mergeLearning(exercise["learningBefore"], result["learning"])
        let targets = Practice.focusKeys(projected, limit: group == "keys" ? 3 : 1, group: group)
        let current = Practice.strings(exercise["focusKeys"])
        var value = "<section id=\"practice-comparison\" class=\"key-map\" aria-label=\"Practice focus results\"><h2>Your practice focus</h2><p>Earlier: weighted recent observations across layouts. This drill: this attempt only.</p><table><thead><tr><th scope=\"col\">Target</th><th scope=\"col\">Earlier recent</th><th scope=\"col\">This drill</th></tr></thead><tbody>"
        for target in current { value += "<tr><th scope=\"row\">\(e(Practice.focusLabel(target)))</th><td>\(e(Practice.practiceObservation(exercise["learningBefore"][group][target], recent: true)))</td><td>\(e(Practice.practiceObservation(result["learning"][group][target])))</td></tr>" }
        value += "</tbody></table><p>Next focus: \(e(targets.map(Practice.focusLabel).joined(separator: ", "))). \(targets == current ? "Recent errors and relative reach times still suggest this focus." : "Recent errors and relative reach times now suggest a different focus.") Based on earlier observations plus this drill. Reach excludes pauses and backspace gaps. A short drill is not proof of mastery.</p>"
        return value + button("weak-next", "Start next drill", primary: true) + button("lessons", "Choose a lesson") + "</section>"
    }
    func renderResults() {
        let hasNext = track == "lesson" && Int(n(exercise, "lessonIndex")) + 1 < Practice.lessonsForLayout(s(exercise, "lessonTrack"), preset: preset).count
        let feedback = Practice.resultFeedback(result, exercise: exercise, nextLabel: hasNext ? "Next lesson" : "Choose a lesson")
        let repeatLabel = ["test", "quote"].contains(track) ? "Repeat this text" : "Try again"
        let freshLabel = track == "test" ? "New test" : track == "quote" ? "Next quote" : "Try again"
        var value = "<section aria-label=\"Test results\"><div class=\"result-heading\"><p class=\"eyebrow\">Your practice</p><h1>\(e(s(feedback, "heading")))</h1><p id=\"coaching\">\(e(s(feedback, "advice")))</p></div><div class=\"result-primary-actions\">"
        if track == "lesson" { value += button(feedback["advance"].boolean == true ? (hasNext ? "next" : "lessons") : "restart", feedback["advance"].boolean == true ? (hasNext ? "Next lesson" : "Choose a lesson") : "Try again", primary: true) }
        value += "<span class=\"record\" id=\"personal-best\" \(result["isNewBestWpm"].boolean == true ? "" : "hidden")>personal best ↗</span></div>" + comparison()
        value += "<div class=\"result-main\"><div class=\"result-primary\"><span>wpm</span><strong>\(num(n(result, "wpm")))</strong><span>accuracy</span><strong>\(num(n(result, "accuracy")))<small>%</small></strong></div>" + speedChart() + "</div><div class=\"result-details\"><div><span>test</span><strong>\(e(s(exercise, "title")))</strong></div>"
        if track == "lesson" { value += "<div><span>stars this attempt</span><strong id=\"attempt-stars\">\(result["saving"].boolean == true ? "Saving…" : num(n(result, "stars")) + " / 3")</strong></div><div><span>3-star target</span><strong>\(num(n(exercise, "targetWpm"))) WPM · \(num(n(exercise, "targetAccuracy")))%</strong></div>" }
        let details = [("raw wpm", num(n(result, "rawWpm"))), ("consistency", result["consistency"].numeric.map { num($0) + "%" } ?? "Not enough data"), ("time", Practice.formatElapsedTime(n(result, "elapsedMilliseconds"))), ("errors / skipped", "\(num(n(result, "errorKeystrokes"))) / \(num(n(result, "skippedChars")))")]
        for (label, content) in details { value += "<div><span>\(label)</span><strong>\(content)</strong></div>" }
        value += "</div><p class=\"field-help\">WPM credits correct words and a clean unfinished word. Five characters count as one word. Raw WPM includes mistakes.</p>"
        let errors = result["errorsByChar"].members.sorted { n(.object(["v": $0.value]), "v") > n(.object(["v": $1.value]), "v") }.prefix(5)
        value += "<p class=\"focus-keys\">" + (errors.isEmpty ? "Every key in its place. No mistakes." : "Focus keys: " + errors.map { e(Practice.focusLabel($0.key)) + " (" + num($0.value.numeric ?? 0) + ")" }.joined(separator: " · ")) + "</p><section class=\"key-map\" aria-label=\"Target-key heatmap\"><h2>Your session key map</h2><p class=\"field-help\">Clean · Errors · Not tried. Stronger color means a higher error rate.</p><div id=\"result-keyboard\">" + Guides.renderKeyboard(preset: capturedPreset, learning: result["learning"]) + "</div>" + measurementTables(result["learning"]) + "</section><p class=\"focus-keys\" id=\"record-reason\">\(e(s(result, "recordReason")))</p><p id=\"save-status\" role=\"status\">Saving progress…</p><div class=\"result-actions\">"
        if track != "lesson" || feedback["advance"].boolean == true { value += button(track == "weak" ? "repeat" : "restart", freshLabel, primary: track == "test" || track == "quote") }
        if ["test", "quote"].contains(track) { value += button("repeat", repeatLabel) }
        if !(result["missedWords"].list ?? []).isEmpty { value += button("missed", "Practice missed words") }
        if !Practice.focusKeys(profile).isEmpty { value += button("weak", "Practice weak keys") }
        if hasNext && feedback["advance"].boolean != true { value += button("next", "Next lesson") }
        value += button("card", "Download result card") + button("back", "Back to practice") + "</div><p class=\"field-help\" id=\"download-status\" aria-live=\"polite\"></p></section>"
        html("#results", value)
        saveStatus()
    }
    func resultsSaved(_ saved: JSON, id: Int) {
        if savingRun.removeValue(forKey: id) == run, !result.isNull {
            for member in saved.members { result[member.key] = member.value }
            result["saving"] = .bool(false)
            text("#attempt-stars", num(n(result, "stars")) + " / 3")
            hide("#personal-best", result["isNewBestWpm"].boolean != true)
            text("#record-reason", s(result, "recordReason"))
        }
        saveStatus()
        html("#learning", recommendation())
        if dialog == "history" { requestHistory() }
        if dialog == "lessons" { lessonList() }
    }
    func lessonList() {
        let path = Practice.lessonPath(Practice.lessonsForLayout(lessonTrack, preset: preset), progress: store.data["progress"])
        html("#lesson-path", "<section aria-label=\"Saved track progress\"><p><strong>\(num(n(path, "completed"))) of \(num(n(path, "total"))) completed · \(num(n(path, "threeStar"))) of \(num(n(path, "total"))) with 3 stars</strong></p><p>Saved progress shared across layouts.</p></section><aside aria-label=\"Suggested lesson\"><p>Suggested lesson</p><strong>\(e(s(path["next"], "title")))</strong><p>\(e(s(path, "reason")))</p>" + button("lesson", "Start suggested lesson", primary: true, extra: "data-track=\"\(lessonTrack)\" data-index=\"\(Int(n(path["next"], "index")))\"") + "</aside>")
        html("#lesson-list", (path["steps"].list ?? []).map { item in
            let index = Int(n(item, "index")); let stars = max(0, min(3, Int(n(item, "stars"))))
            return "<button class=\"lesson-item\" data-action=\"lesson\" data-track=\"\(lessonTrack)\" data-index=\"\(index)\"><span class=\"lesson-number\">\(s(item, "id") == "amat-intro" ? "—" : String(index + (lessonTrack == "amateur" ? 0 : 1)))</span><span><strong>\(e(s(item, "title")))</strong><small>\(e(s(item, "id") == "amat-intro" ? "Optional introduction" : s(item, "subtitle")))</small></span><span class=\"lesson-stars\" role=\"img\" aria-label=\"Earned stars: \(stars) of 3\">\(String(repeating: "★", count: stars))\(String(repeating: "☆", count: 3 - stars))</span></button>"
        }.joined())
    }
    func openDialog(_ name: String) {
        closeDialog(refocus: false)
        session.pause(now: now)
        pressed = []
        dialog = name
        if name == "lessons" { lessonList() }
        if name == "settings" { settingsControls() }
        if name == "history" { requestHistory() }
        if name == "recovery" { read("backup-view") }
        cmd("dialog", ["selector": .string("#\(name)-dialog"), "value": .bool(true)])
        if name == "custom" {
            prop("[data-action=\"custom-start\"]", "disabled", .bool(Practice.normalizeCustomText(customText).isEmpty))
            focus("#custom-text")
        }
        if phone { renderDemo() }
    }
    func closeDialog(refocus: Bool = true) {
        if !dialog.isEmpty { cmd("dialog", ["selector": .string("#\(dialog)-dialog"), "value": .bool(false)]) }
        dialog = ""
        backingDown = false
        if refocus { focus(result.isNull ? "#typing-input" : "#results button") }
    }
    func renderDemo() {
        let mapping = Practice.layout(preset)["fromQwerty"]
        let steps = Practice.characters("f r f j u j F J ").map { mapping[$0].text ?? $0 }
        let target = steps[demoIndex % steps.count]
        if !demoMounted {
            html("#phone-demo", "<section class=\"phone-demo\" aria-label=\"Finger demo\"><h2>Finger demo</h2><p>Reach, then return home.</p><p id=\"demo-letters\" class=\"demo-letters\" aria-hidden=\"true\"></p><p class=\"demo-target\">Key: <output id=\"demo-target\" aria-label=\"Demo target\" aria-live=\"off\"></output></p><div class=\"demo-actions\">" + button("demo-play", "Pause demo") + button("demo-next", "Next key") + button("demo-lesson", "Try this lesson", primary: true) + "</div><div id=\"demo-hands\" class=\"hands-container\"></div><div id=\"demo-keyboard\" class=\"keyboard-container\" aria-hidden=\"true\"></div><p id=\"demo-help\" class=\"field-help\"></p></section>")
            demoMounted = true
        }
        var value = ""
        for (index, key) in steps.enumerated() { value += "<span class=\"\(index == demoIndex ? "current" : index < demoIndex ? "complete" : "")\">\(e(key == " " ? "␣" : key))</span>" }
        html("#demo-letters", value)
        text("#demo-target", target == " " ? "Space" : target)
        text("[data-action=\"demo-play\"]", demoPlaying ? "Pause demo" : "Play demo")
        hide("[data-action=\"demo-play\"]", reduced)
        html("#demo-hands", Guides.renderHands(preset: preset, target: target))
        html("#demo-keyboard", Guides.renderKeyboard(preset: preset, target: target))
        text("#demo-help", "\(reduced ? "Reduced motion: use Next key to explore. " : "")This demo does not save progress.")
        hide("#phone-demo", !phone)
        hide(".live-stats", phone)
        hide("#arena-wrap", phone)
        hide("#guidance", phone)
        hide("#learning", phone || track != "test")
    }
    func sound(_ kind: String) {
        guard settings["soundMuted"].boolean != true, n(settings, "volume", 0.6) > 0 else { return }
        let volume = n(settings, "volume", 0.6)
        var notes: [JSON] = []
        func note(_ wave: String, _ frequency: Double, _ to: Double, _ duration: Double, _ gain: Double, delay: Double = 0, frequencyDuration: Double? = nil, stop: Double? = nil, attack: Double = 0, filter: JSON? = nil) {
            notes.append(.object(["wave": .string(wave), "frequency": .number(frequency), "to": .number(to), "duration": .number(duration), "frequencyDuration": .number(frequencyDuration ?? duration), "stop": .number(stop ?? duration + 0.005), "attack": .number(attack), "volume": .number(gain * volume), "end": .number(0.001 * volume), "delay": .number(delay), "filter": filter ?? .null]))
        }
        let jitter = 1 + Double.random(in: -0.06...0.06)
        if kind == "success" {
            for (index, frequency) in [523.25,659.25,783.99,1046.5].enumerated() { note("sine", frequency, frequency, 0.8, 0.25, delay: Double(index) * 0.08, stop: 0.85, attack: 0.02) }
        } else if kind == "error" { note("sawtooth", 160, 90, 0.12, 0.35, frequencyDuration: 0.1, stop: 0.13) }
        else {
            switch s(settings, "soundProfile", "magic") {
            case "thock": note("triangle", 260 * (1 + Double.random(in: -0.05...0.05)), 60, 0.06, 0.7, frequencyDuration: 0.05, stop: 0.065, filter: .object(["type": .string("lowpass"), "frequency": .number(1400)]))
            case "bubble": note("sine", 450, 900, 0.05, 0.5, frequencyDuration: 0.03, stop: 0.055)
            case "clicky": note("sawtooth", 4800, 1200, 0.02, 0.35, frequencyDuration: 0.015, stop: 0.022)
            default:
                note("triangle", 3200 * jitter, 800, 0.022, 0.45, frequencyDuration: 0.018, stop: 0.025, filter: .object(["type": .string("bandpass"), "frequency": .number(3500), "q": .number(3)]))
                note("sine", 380 * jitter, 90, 0.04, 0.35, frequencyDuration: 0.035, stop: 0.042)
            }
        }
        cmd("audio", ["notes": .array(notes)])
    }
    func card() {
        guard !result.isNull else { return }
        let light = s(settings, "theme") == "light" || (s(settings, "theme") == "system" && !dark)
        let bg = light ? "#f6f8f7" : "#141918", surface = light ? "#ffffff" : "#1d2422", ink = light ? "#23332c" : "#e1e8e4", muted = light ? "#60756a" : "#8c9e94"
        let accent = s(settings, "colorPalette") == "ocean" ? (light ? "#24729b" : "#78c7ef") : s(settings, "colorPalette") == "plum" ? (light ? "#865895" : "#d5a4e8") : (light ? "#278562" : "#91cdb0")
        let error = light ? "#bf4757" : "#e98792"
        var svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1200\" height=\"780\" viewBox=\"0 0 1200 780\"><rect width=\"1200\" height=\"780\" fill=\"\(bg)\"/>"
        func label(_ value: String, _ x: Double, _ y: Double, _ size: Int, _ color: String, center: Bool = false) {
            svg += "<text x=\"\(num(x))\" y=\"\(num(y))\" font-size=\"\(size)\" font-family=\"monospace\" fill=\"\(color)\"\(center ? " text-anchor=\"middle\"" : "")>\(e(value))</text>"
        }
        label("Typeflow", 60, 94, 44, ink)
        label("Learn touch typing, one key at a time.", 60, 138, 22, muted)
        label(s(exercise, "title"), 60, 183, 19, muted)
        label(num(n(result, "wpm")), 60, 288, 86, accent); label("WPM", 60, 326, 18, muted)
        label(num(n(result, "accuracy")) + "%", 450, 288, 66, ink); label("ACCURACY", 450, 326, 18, muted)
        label(Practice.formatElapsedTime(n(result, "elapsedMilliseconds")), 875, 288, 38, ink); label("TIME", 875, 326, 18, muted)
        label("Your session key map · " + s(Practice.layout(capturedPreset), "label"), 60, 385, 23, ink)
        label("Clean · Errors · Not tried", 60, 415, 17, muted)
        svg += "<rect x=\"60\" y=\"430\" width=\"1080\" height=\"270\" rx=\"18\" fill=\"\(surface)\"/>"
        let cells = Guides.keyMeasurements(result["learning"], preset: capturedPreset)
        for (index, row) in Guides.rows(Practice.layout(capturedPreset)).enumerated() {
            let unit = (1048 - 8 * Double(row.count - 1)) / row.reduce(0.0) { $0 + n($1, "width", 1) }
            var x = 76.0
            let y = 446 + Double(index) * 50
            for key in row {
                let width = unit * n(key, "width", 1)
                if let code = key["code"].text {
                    let cell = cells[code], attempts = n(cell, "attempts")
                    let rate = attempts > 0 ? n(cell, "errors") / attempts : 0
                    let heat = rate > 0 ? error : accent
                    let fill = attempts > 0 ? heat : bg
                    if let stem = key["isoStem"].numeric {
                        let start = x + (1 - stem) * width
                        svg += "<path d=\"M\(num(x)) \(num(y))H\(num(x + width))V\(num(y + 92))H\(num(start))V\(num(y + 46))H\(num(x))Z\" fill=\"\(fill)\" fill-opacity=\"\(attempts > 0 ? num(rate > 0 ? 0.12 + rate * 0.3 : 0.22) : "1")\" stroke=\"\(attempts > 0 ? heat : muted)\"/>"
                    } else { svg += "<rect x=\"\(num(x))\" y=\"\(num(y))\" width=\"\(num(width))\" height=\"42\" rx=\"7\" fill=\"\(fill)\" fill-opacity=\"\(attempts > 0 ? num(rate > 0 ? 0.12 + rate * 0.3 : 0.22) : "1")\" stroke=\"\(attempts > 0 ? heat : muted)\"/>" }
                    label(code == "Space" ? "space" : s(key, "label"), x + width / 2, y + 27, key["special"].text != nil ? 13 : 18, ink, center: true)
                }
                x += width + 8
            }
        }
        label("https://o1tean.github.io/apple-typing-tutor/", 60, 746, 20, muted)
        svg += "</svg>"
        prop("#results [data-action=\"card\"]", "disabled", .bool(true))
        text("#download-status", "Preparing result card…")
        cmd("raster", ["id": .string("card-\(run)"), "value": .string(svg), "width": .number(1200), "height": .number(780), "name": .string("typeflow-result.png")])
    }
    func handle(_ event: JSON) -> Bool {
        commands = []
        now = n(event, "now"); epoch = n(event, "epoch"); iso = s(event, "iso")
        let kind = s(event, "kind"), id = s(event, "id"), name = s(event, "name"), key = s(event, "key")
        if kind == "boot" {
            dark = event["dark"].boolean == true; coarse = event["coarse"].boolean == true
            reduced = event["reduced"].boolean == true; hidden = event["hidden"].boolean == true
            demoPlaying = !reduced
            html("#root", appShell)
            html("[name=\"keyboardLayout\"]", Practice.layouts.members.map { "<option value=\"\(e($0.key))\">\(e(s($0.value, "label")))</option>" }.joined())
            read("initial")
            cmd("worker", ["url": .string("../sw.js")])
            return false
        }
        if kind == "storage-read" {
            let purpose = s(event, "purpose"), writeID = Int(n(event, "id"))
            let readFailed = event["readFailed"].boolean == true || (!event["raw"].isNull && event["raw"].text == nil)
            if purpose == "initial" {
                store.load(raw: event["raw"].text, readFailed: readFailed)
                settings = store.data["settings"]
                ready = true
                applyAppearance(); settingsControls()
                if event["raw"].isNull && !store.loadFailed { lesson("amateur", 1); if coarse { phone = true; demoAt = now; renderDemo() } }
                else { testExercise() }
                saveStatus()
            } else if purpose == "write" || purpose == "retry" {
                let candidate = purpose == "retry" ? store.prepareRetry(latestRaw: event["raw"].text, readFailed: readFailed, lockFailed: event["lockFailed"].boolean == true) : store.prepareNext(latestRaw: event["raw"].text, readFailed: readFailed, lockFailed: event["lockFailed"].boolean == true)
                if let candidate { cmd("write", ["key": .string(self.key), "raw": .string(candidate), "id": .number(Double(writeID))]) }
                else {
                    let saved = store.finishWrite(succeeded: false)
                    activeWrite = nil; retrying = false
                    resultsSaved(saved, id: writeID); requestWrite()
                }
            } else if purpose.hasPrefix("backup") {
                backupText = store.exportBackup(rawToken: event["raw"], readFailed: event["readFailed"].boolean == true, exportedAt: iso)
                prop("#backup-text", "value", .string(backupText))
                if purpose == "backup-download" { cmd("download", ["id": .string("backup"), "name": .string("typeflow-backup-\(String(iso.prefix(10))).json"), "value": .string(backupText), "type": .string("application/json")]) }
            }
            return false
        }
        if kind == "storage-write" {
            let writeID = Int(n(event, "id"))
            let saved = store.finishWrite(succeeded: event["succeeded"].boolean == true)
            activeWrite = nil; retrying = false
            resultsSaved(saved, id: writeID); requestWrite()
            if dialog == "recovery" { text("#recovery-status", store.saveFailed ? "Saving is still unavailable. Download a backup before closing this page." : "Your progress is saved on this device.") }
            return false
        }
        if kind == "storage", s(event, "key") == self.key {
            store.refresh(raw: event["raw"].text, readFailed: !event["raw"].isNull && event["raw"].text == nil)
            html("#learning", recommendation())
            if dialog == "history" { requestHistory() }
            if dialog == "lessons" { lessonList() }
            saveStatus()
            return false
        }
        if kind == "dates" { history(event); return false }
        if kind == "download-result" {
            if id.hasPrefix("card-") {
                guard id == "card-\(run)", !result.isNull else { return false }
                prop("#results [data-action=\"card\"]", "disabled", .bool(false))
                text("#download-status", event["succeeded"].boolean == true ? "Result card downloaded." : "Could not create the result card. Try again.")
            }
            else { text("#recovery-status", event["succeeded"].boolean == true ? "Backup download started. Keep this file to preserve your progress." : "Could not create the backup. Copy the Backup JSON below to preserve your progress.") }
            return false
        }
        if kind == "worker" {
            let status = event["unavailable"].boolean == true ? "Offline setup unavailable" : event["waiting"].boolean == true ? "Update ready" : s(event, "active") == "activated" ? "Available offline" : s(event, "installing") == "redundant" ? "Offline setup unavailable" : "Preparing offline lessons…"
            text("#offline-status", status)
            text("#offline-help", status == "Update ready" ? "Finish and save your session, then close all Typeflow tabs and reopen to use the update." : status == "Available offline" ? "Lessons work without a connection. You can install Typeflow from your browser menu where supported. Keep this device’s site data to retain lessons and progress." : status == "Preparing offline lessons…" ? "Preparing lessons for this device. Keep Typeflow online until setup finishes." : "Open Typeflow online in a browser that supports offline apps. Setup retries on your next visit.")
            return false
        }
        guard ready else { return false }
        if kind == "tick" {
            if !phone { session.tick(now: now); update() }
            else if demoPlaying && !reduced && !hidden && dialog.isEmpty && now - demoAt >= 1100 { demoAt = now; demoIndex = (demoIndex + 1) % 15; renderDemo() }
        } else if kind == "resize" { anchor() }
        else if kind == "media" {
            switch name {
            case "dark": dark = event["matches"].boolean == true; applyAppearance()
            case "coarse": coarse = event["matches"].boolean == true
            case "reduced": reduced = event["matches"].boolean == true; if reduced { demoPlaying = false }; if phone { renderDemo() }
            default: break
            }
        } else if kind == "visibility" {
            hidden = event["hidden"].boolean == true
            if hidden { session.pause(now: now); pressed = []; renderGuides() }
            else if s(event, "active") == "typing-input" && dialog.isEmpty && !phone { session.resume(now: now) }
        } else if kind == "focusin" && id == "typing-input" {
            focused = true; attr("#arena", "class", "arena focused"); hide("#focus-prompt", true)
            if dialog.isEmpty && !hidden { session.resume(now: now) }
            anchor()
        } else if kind == "focusout" && id == "typing-input" { focused = false; attr("#arena", "class", "arena unfocused"); session.pause(now: now); pressed = []; hide("#focus-prompt", false); renderGuides(); anchor() }
        else if kind == "compositionstart" && id == "typing-input" { composing = true; compositionCommitted = false }
        else if (kind == "input" || kind == "compositionend") && id == "typing-input" {
            if event["composing"].boolean == true { return false }
            if compositionCommitted && Guides.substringRange(s(event, "inputType"), "Composition") != nil { compositionCommitted = false; prop("#typing-input", "value", .string("")); return false }
            composing = false; compositionCommitted = kind == "compositionend"
            type(s(event, "value")); prop("#typing-input", "value", .string(""))
        } else if kind == "input" && id == "custom-text" {
            customText = s(event, "value")
            prop("[data-action=\"custom-start\"]", "disabled", .bool(Practice.normalizeCustomText(customText).isEmpty))
        } else if kind == "beforeinput" && id == "typing-input" {
            if event["composing"].boolean == true { return false }
            let inputType = s(event, "inputType")
            if ["insertLineBreak", "insertParagraph", "insertFromPaste"].contains(inputType) { return true }
            if ["deleteContentBackward", "deleteWordBackward"].contains(inputType) {
                if session.mode == "flow" { text("#typing-feedback", "") }
                session.delete(word: inputType == "deleteWordBackward", now: now)
                update(passage: true)
                return true
            }
        } else if kind == "paste" && id == "typing-input" { return true }
        else if kind == "keydown" {
            if composing || event["composing"].boolean == true || n(event, "keyCode") == 229 || key == "Process" { return false }
            if key == "Escape" { if dialog.isEmpty { openDialog("settings") } else { closeDialog() }; return true }
            if key == "Enter" && event["shift"].boolean == true && dialog.isEmpty { restart(); return true }
            if id != "typing-input" { return false }
            if key == "Tab" && event["shift"].boolean != true { focus("[data-action=\"restart\"]"); return true }
            if event["meta"].boolean == true || ((event["ctrl"].boolean == true || event["alt"].boolean == true) && key != "Backspace" && event["altGraph"].boolean != true) { return false }
            pressed.insert(s(event, "code")); caps = event["caps"].boolean == true
            if key == "Backspace" { session.delete(word: event["ctrl"].boolean == true || event["alt"].boolean == true, now: now); if session.mode == "flow" { text("#typing-feedback", "") }; update(passage: true); return true }
            if key.unicodeScalars.count == 1 { type(key); return true }
            renderGuides()
        } else if kind == "keyup" { pressed.remove(s(event, "code")); if result.isNull && !phone { renderGuides() } }
        else if kind == "cancel" { closeDialog(); return true }
        else if kind == "pointerdown" { backingDown = event["backdrop"].boolean == true }
        else if kind == "click" {
            if backingDown && event["backdrop"].boolean == true { closeDialog(); return true }
            backingDown = false
            return action(event["action"])
        } else if kind == "submit" { return true }
        else if kind == "change" || (kind == "input" && name == "volume") {
            if name.isEmpty { return false }
            let value: JSON = settings[name].boolean != nil ? .bool(event["checked"].boolean == true) : settings[name].numeric != nil ? .number((Double(s(event, "value")) ?? 0) / (name == "volume" ? 100 : 1)) : .string(s(event, "value"))
            setting(name, value)
            if name == "soundProfile" { sound("key") }
        }
        return false
    }
    func action(_ data: JSON) -> Bool {
        switch s(data, "action") {
        case "lessons", "settings", "history", "custom", "recovery": openDialog(s(data, "action"))
        case "close": closeDialog()
        case "lesson": lesson(s(data, "track", lessonTrack), Int(Double(s(data, "index")) ?? 0))
        case "track": lessonTrack = s(data, "track", "amateur"); lessonList()
        case "test": testExercise()
        case "quote": quote()
        case "restart": restart()
        case "repeat": restart(repeatText: true)
        case "next": lesson(s(exercise, "lessonTrack"), Int(n(exercise, "lessonIndex")) + 1)
        case "back": testExercise()
        case "weak": weak()
        case "pairs": weak("bigrams")
        case "weak-next": weak(s(exercise, "focusGroup", "keys"), using: mergeLearning(exercise["learningBefore"], result["learning"]))
        case "missed": let words = Practice.strings(result["missedWords"]); if !words.isEmpty { load(.object(["track": .string("retry"), "id": .string("missed-words"), "title": .string("missed words · \(words.count)"), "lines": Practice.stringList([words.joined(separator: " ")])])) }
        case "focus": focus("#typing-input")
        case "custom-start": cmd("value", ["selector": .string("#custom-text"), "id": .string("custom")])
        case "custom-example":
            let quotes = Practice.curriculum["quotes"].list ?? []
            if quotes.count > 3 {
                customText = s(quotes[3], "text")
                prop("#custom-text", "value", .string(customText))
                prop("[data-action=\"custom-start\"]", "disabled", .bool(false))
                focus("#custom-text")
            }
        case "toggle": let name = s(data, "name"); setting(name, .bool(settings[name].boolean != true))
        case "set": let name = s(data, "name"), raw = s(data, "value"); setting(name, settings[name].numeric != nil ? .number(Double(raw) ?? 0) : .string(raw))
        case "appearance": setting("theme", .string((s(settings, "theme") == "light" || (s(settings, "theme") == "system" && !dark)) ? "dark" : "light"))
        case "sound-toggle": setting("soundMuted", .bool(settings["soundMuted"].boolean != true))
        case "sample": sound("key")
        case "card": card()
        case "backup": read("backup-download")
        case "retry-save": if activeWrite == nil && store.pendingCount == 0 { activeWrite = -1; retrying = true; read("retry", id: -1, lock: true); saveStatus() }
        case "demo": phone = true; session.pause(now: now); demoAt = now; renderDemo()
        case "demo-play": demoPlaying.toggle(); demoAt = now; renderDemo()
        case "demo-next": demoPlaying = false; demoIndex = (demoIndex + 1) % 15; renderDemo()
        case "demo-lesson": lesson("amateur", 1); focus("#typing-input")
        default: return false
        }
        return true
    }
}
let app = SwiftApp()
@_cdecl("typeflow_event") func appEvent(_ count: Int32) -> Int32 {
    let event = JSON.parse(inputText(count)) ?? .null
    if event["kind"].text == "value", event["id"].text == "custom" {
        app.commands = []
        let text = Practice.normalizeCustomText(event["value"].text ?? "")
        if !text.isEmpty { app.load(.object(["track": .string("custom"), "id": .string("custom"), "title": .string("custom text"), "lines": Practice.stringList([text])])) }
        output(JSON.array(app.commands).encoded())
        return 0
    }
    let prevented = app.handle(event)
    output(JSON.array(app.commands).encoded())
    return prevented ? 1 : 0
}
let appShell = """
<div class="app lesson-mode"><header class="header"><button class="brand" data-action="test" aria-label="Typeflow home"><strong>typeflow<span class="brand-period">.</span></strong><small>Swift · WebAssembly</small></button><nav class="navigation" aria-label="Practice"><button class="choice" data-action="lessons">Lessons</button><button class="choice" data-action="test">Test</button><button class="choice" data-action="quote">Quotes</button><button class="choice" data-action="custom">Custom text</button></nav><div class="header-actions"><button class="text-button" data-action="history">History</button><button class="text-button" data-action="settings">Settings</button></div></header>
<main class="main"><section id="exercise"><div class="test-toolbar" id="toolbar"></div><div class="test-heading"><p class="eyebrow" id="exercise-kind">Learn touch typing.</p><h1 id="exercise-title"></h1></div><aside class="lesson-instructions" aria-label="Lesson instructions"><p id="instructions"></p><div id="lesson-goal"></div></aside><p class="arena-help" id="quote-source"></p><div class="live-stats" aria-label="Live statistics"><span><strong id="live-wpm">0</strong><small>wpm</small></span><span><strong id="live-accuracy">100%</strong><small>accuracy</small></span><span><strong id="live-time">0s</strong><small>time</small></span></div>
<p class="keyboard-notice" id="keyboard-notice" hidden>Best with a physical keyboard. Connect one to follow the finger guide. Onscreen keyboards do not teach finger placement. <button class="text-button" data-action="demo">Watch a demo</button></p><div id="phone-demo" hidden></div><div id="arena-wrap"><div class="arena-meta"><span id="mode-label">english · guided</span><span id="caps-status" role="status"></span><span id="position">line 1</span></div><div class="arena focused" id="arena"><p class="sr-only" id="exercise-prompt"></p><div class="text-viewport" aria-hidden="true"><div class="typing-text" id="passage"></div></div><textarea id="typing-input" class="typing-input" aria-label="Typing input" aria-describedby="exercise-prompt typing-help typing-feedback" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></textarea><button class="focus-prompt" id="focus-prompt" data-action="focus" hidden>Click here to start typing</button></div><p class="arena-help" id="typing-help"></p><p class="sr-only" id="typing-feedback" role="status"></p><div class="restart-row"><button class="text-button" data-action="restart">Restart</button></div><p class="shortcuts"><span><kbd>tab</kbd> + <kbd>enter</kbd> restart test</span><span><kbd>esc</kbd> settings</span></p></div>
<section class="guidance" id="guidance" aria-label="Typing guides"><div class="hands-container" id="hands"></div><div class="keyboard-container" id="keyboard" aria-hidden="true"></div></section><div id="learning"></div></section><section class="results" id="results" aria-label="Typing results" hidden></section>
<p class="arena-help" id="recovery" role="status" hidden>Progress is in memory. Keep this tab open or export a backup. <button class="text-button" data-action="retry-save">Retry save</button> <button class="text-button" data-action="backup">Export backup</button> <button class="text-button" data-action="recovery">Keep my progress</button></p></main><footer class="footer"><span>Learn at your pace. Accuracy comes first.</span><div><button id="sound-toggle" data-action="sound-toggle">sound on</button><button data-action="appearance">appearance</button><span id="storage-status" role="status"></span><details class="offline-status"><summary><span id="offline-status" role="status">Preparing offline lessons…</span></summary><p id="offline-help">Preparing lessons for this device. Keep Typeflow online until setup finishes.</p></details><a href="../">React version</a><a href="../brainfuck.html">Brainfuck version</a></div></footer></div>
<dialog class="dialog" id="lessons-dialog" aria-label="Choose a lesson"><div class="dialog-heading"><h2 id="lessons-title">Build your muscle memory</h2><button class="text-button" data-action="close" aria-label="Close">Close</button></div><div class="setting-choices lesson-tracks"><button class="choice" data-action="track" data-track="amateur">Foundations</button><button class="choice" data-action="track" data-track="pro">Advanced</button></div><div class="lesson-path" id="lesson-path"></div><div class="lesson-list" id="lesson-list"></div></dialog>
<dialog class="dialog settings" id="settings-dialog" aria-label="Settings"><div class="dialog-heading"><h2>Make it your own</h2><button class="text-button" data-action="close" aria-label="Close">Close</button></div><fieldset><legend>Keyboard layout</legend><label class="setting-row">Keyboard layout<select name="keyboardLayout"></select></label><p id="layout-help" class="field-help"></p></fieldset><fieldset><legend>Typing behavior</legend><label class="setting-row">Typing mode<select name="typingMode"><option value="strict">Guided</option><option value="flow">Free flow</option></select></label><p>Free flow accepts mistakes. Guided waits for the correct key. Changing behavior restarts the test.</p></fieldset><fieldset><legend>Appearance</legend><label class="setting-row">Appearance<select name="theme"><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label><label class="setting-row">Palette<select name="colorPalette"><option value="mint">Mint</option><option value="ocean">Ocean</option><option value="plum">Plum</option></select></label></fieldset><fieldset><legend>Keyboard sound</legend><label class="setting-row">Sound profile<select name="soundProfile"><option value="magic">magic</option><option value="thock">thock</option><option value="bubble">bubble</option><option value="clicky">clicky</option></select></label><label class="setting-row">Mute sound<input type="checkbox" name="soundMuted"></label><label id="volume-label" for="volume">Volume</label><input type="range" id="volume" name="volume" min="0" max="100"><button class="text-button" data-action="sample">Play sample</button></fieldset><fieldset><legend>Test preferences</legend><label class="setting-row">Test mode<select name="testMode"><option value="time">Time</option><option value="words">Words</option></select></label><label class="setting-row">Duration<select name="testDuration"><option>15</option><option>30</option><option>60</option><option>120</option></select></label><label class="setting-row">Word count<select name="testWordCount"><option>10</option><option>25</option><option>50</option><option>100</option></select></label><label class="setting-row">Punctuation<input type="checkbox" name="punctuation"></label><label class="setting-row">Numbers<input type="checkbox" name="numbers"></label></fieldset><fieldset><legend>Practice guides</legend><label class="setting-row">Show keyboard<input type="checkbox" name="showKeyboard"></label><label class="setting-row">Show hands<input type="checkbox" name="showHands"></label></fieldset><fieldset><legend>Saved progress</legend><p>Keep a backup of your device-local progress, or recover sessions when saving is unavailable.</p><button class="text-button" data-action="recovery">Manage saved progress</button></fieldset><button class="primary-button" data-action="close">Back to typing</button></dialog>
<dialog class="dialog" id="custom-dialog" aria-label="Practice your text"><div class="dialog-heading"><h2>Your words, your practice</h2><button class="text-button" data-action="close" aria-label="Close">Close</button></div><label for="custom-text">Text to practice</label><textarea id="custom-text" maxlength="12000" rows="7" placeholder="Paste a passage, a paragraph, or something you want to remember."></textarea><p class="field-help">Up to 12,000 characters. Line breaks become spaces. Invisible break markers are removed.</p><div class="dialog-actions"><button class="text-button" data-action="custom-example">Try a quote</button><button class="primary-button" data-action="custom-start" disabled>Start custom text</button></div></dialog>
<dialog class="dialog" id="history-dialog" aria-label="Practice history"><div class="dialog-heading"><h2>Your recent sessions</h2><button class="text-button" data-action="close" aria-label="Close">Close</button></div><div id="history-content"></div></dialog>
<dialog class="dialog" id="recovery-dialog" aria-label="Keep your progress"><div class="dialog-heading"><h2>Keep your progress</h2><button class="text-button" data-action="close" aria-label="Close">Close</button></div><p class="field-help">Your latest sessions may be in memory or waiting to save. Closing or reloading this page can lose them. Download a backup to keep a copy, including current progress, sessions waiting to save, and readable saved data.</p><div class="dialog-actions"><button class="primary-button" data-action="backup">Download backup</button><button class="text-button" id="retry-button" data-action="retry-save">Try saving again</button></div><p id="recovery-status" class="field-help" role="status"></p><details class="field-help"><summary>View backup text</summary><p>If downloading is unavailable, copy this text into a file to keep your backup.</p><textarea id="backup-text" aria-label="Backup JSON" rows="8" readonly></textarea></details></dialog>
"""
