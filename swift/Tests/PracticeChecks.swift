// Compile with JSON, learning/storage, TypingSession, generated Catalog, Practice and Guides.
@main
struct PracticeChecks {
    static var checks = 0
    static func expect(_ condition: Bool, _ message: String) {
        checks += 1
        precondition(condition, message)
    }
    static func json(_ text: String) -> JSON { JSON.parse(text)! }
    static func cell(_ rate: Double = 0.9, latency: Double = 900) -> JSON {
        .object(["attempts": .number(40), "errors": .number(36), "latencySamples": .number(40), "latencyTotalMs": .number(36000), "recentErrorRate": .number(rate), "recentLatencyMs": .number(latency)])
    }
    static func profile(_ key: String, group: String = "keys") -> JSON {
        var value = json("{\"version\":1,\"keys\":{},\"bigrams\":{},\"future\":{\"keep\":true}}")
        value[group][key] = cell()
        return value
    }
    static func main() {
        expect((Practice.curriculum["speedWords"].list ?? []).count == 1189, "Use the existing licensed word corpus")
        expect((Practice.curriculum["quotes"].list ?? []).count == 100, "Preserve the existing quote identities")
        for count in [10, 25, 50, 100, 400] {
            let words = Practice.generateWords(count, random: { 0 }).split(separator: " ")
            expect(words.count == count, "Requested word count")
            expect(zip(words, words.dropFirst()).allSatisfy { $0 != $1 }, "No adjacent repeated words, including a constant random source")
        }
        let modified = Practice.generateWords(25, options: json("{\"numbers\":true,\"punctuation\":true}"), random: { 0.5 })
        expect(modified.containsText("500") && modified.containsText(",") && modified.hasSuffix("."), "Numbers and punctuation remain generated options")
        expect(Practice.decimal(1.65) == "1.6" && Practice.decimal(2.55) == "2.5", "Decimal rounding matches the represented value without double rounding")
        let observation = json("{\"attempts\":40,\"errors\":36,\"latencySamples\":40,\"latencyTotalMs\":40000,\"recentErrorRate\":0.8,\"recentLatencyMs\":900}")
        expect(Practice.practiceObservation(observation, recent: true) == "80.0% recent errors, 900 ms recent reach", "Earlier observations use recent values")
        expect(Practice.practiceObservation(observation) == "90.0% errors, 1000 ms reach · 36/40 errors · 40 timed", "This drill uses observed totals")
        expect(Practice.practiceObservation(.null) == "No observations yet.", "Absent observation is honest")
        expect(Practice.practiceObservation(json("{\"attempts\":2,\"errors\":0,\"latencySamples\":0,\"latencyTotalMs\":0}")) == "0.0% errors, no reach timing yet · 0/2 errors · 0 timed · few observations", "Sparse and missing timing stay visible")
        for group in ["keys", "bigrams"] {
            let key = group == "keys" ? "q" : "qz"
            let other = group == "keys" ? "w" : "wv"
            var saved = profile(key, group: group)
            saved[group][other] = cell(0.3, latency: 500)
            let before = saved.encoded()
            let drill = Practice.generateWeakDrill(saved, group: group, random: { 0 })
            expect(Practice.strings(drill["focusKeys"]) == [key], "Select strong recent evidence")
            expect(saved.encoded() == before, "Generation is read-only")
            var current = json("{\"keys\":{},\"bigrams\":{}}")
            current[group][key] = json("{\"attempts\":25,\"errors\":0,\"latencySamples\":25,\"latencyTotalMs\":1250}")
            let merged = mergeLearning(drill["learningBefore"], current)
            expect(Practice.focusKeys(merged, limit: group == "bigrams" ? 1 : 3, group: group) == [other], "Faster clean practice rotates the next focus")
            expect(merged[group][key]["errors"].numeric == 36, "Rotation preserves lifetime mistakes")
            saved[group][key]["recentErrorRate"] = .number(0)
            saved["future"]["keep"] = .bool(false)
            expect(drill["learningBefore"][group][key]["recentErrorRate"].numeric == 0.9 && drill["learningBefore"]["future"]["keep"].boolean == true, "Baseline owns an immutable value snapshot")
        }
        for pair in ["th", "ht", "ll", " q", "q ", ";?", "#@"] {
            for preset in ["mac-us", "colemak", "dvorak", "uk-iso"] {
                let saved = profile(pair, group: "bigrams")
                let first = Practice.strings(Practice.generateWeakDrill(saved, preset: preset, group: "bigrams", random: { 0 })["lines"])
                let retry = Practice.strings(Practice.generateWeakDrill(saved, preset: preset, group: "bigrams", random: { 0.999 })["lines"])
                expect(first.count == 2 && first != retry, "Pair practice is short and retries vary")
                for lines in [first, retry] {
                    expect(lines.allSatisfy { Practice.collapseWhitespace($0) == $0 }, "Space pairs remain typeable")
                    let engine = TypingSession()
                    engine.initialize(lines: lines, mode: "strict", duration: 0)
                    for (index, scalar) in lines.joined(separator: " ").unicodeScalars.enumerated() { engine.key(scalar: scalar.value, now: Double(index) * 10) }
                    expect(engine.isComplete && (engine.learning.bigrams[pair]?.attempts ?? 0) >= 20, "Actual typed pair drill measures its target at least twenty times")
                }
            }
        }
        for saved in [.null, json("{\"version\":2,\"future\":true}"), profile("  ", group: "bigrams"), json("{\"version\":1,\"keys\":{},\"bigrams\":{\"th\":{\"attempts\":2,\"errors\":0,\"latencySamples\":0,\"latencyTotalMs\":0}}}")] {
            expect(Practice.focusKeys(saved, limit: 1, group: "bigrams").isEmpty, "Absent/future/all-space/zero-evidence data cannot invent pair targets")
        }
        var spaces = profile("  ", group: "bigrams")
        spaces["bigrams"]["qz"] = cell(0.1, latency: 100)
        expect(Practice.focusKeys(spaces, limit: 1, group: "bigrams") == ["qz"], "All-space data cannot suppress a valid pair")
        expect(Practice.focusLabel(" q") == "Space → q", "Pair labels retain order")
        for preset in ["mac-us", "colemak", "dvorak", "uk-iso"] {
            for track in ["amateur", "pro"] {
                let lessons = Practice.lessonsForLayout(track, preset: preset)
                let originals = Practice.curriculum[track].list ?? []
                var introduced: Set<String> = [" "]
                for (index, lesson) in lessons.enumerated() {
                    expect(lesson["id"].text == originals[index]["id"].text && lesson["targetWpm"].numeric == originals[index]["targetWpm"].numeric, "Layout preserves curriculum identity and targets")
                    let current = Practice.strings(lesson["keysIntroduced"])
                    introduced.formUnion(current)
                    let ownHand = track == "amateur" ? index <= 2 : index <= 1
                    let allowed = ownHand ? Set([" "] + current) : introduced
                    let first = Practice.generateLessonDrill(track, index: index, preset: preset, random: { 0 })
                    let retry = Practice.generateLessonDrill(track, index: index, preset: preset, random: { 0.999 })
                    expect(first.count == 4 && retry.count == 4 && first != retry, "Every lesson generates a fresh four-line drill")
                    for lines in [first, retry] { expect(Practice.characters(lines.joined()).allSatisfy { allowed.contains($0) }, "Drills stay inside introduced keys") }
                }
                let numbered = lessons.filter { $0["id"].text != "amat-intro" }
                let first = numbered[0]["id"].text!
                let second = numbered[1]["id"].text!
                let third = numbered[2]["id"].text!
                let fresh = Practice.lessonPath(lessons, progress: .object([:]))
                expect(fresh["total"].numeric == (track == "amateur" ? 11 : 10) && fresh["completed"].numeric == 0 && fresh["next"]["id"].text == first, "Fresh path skips optional introduction")
                var progress: JSON = .object(["amat-intro": json("{\"stars\":3}"), first: json("{\"stars\":1,\"completed\":true,\"future\":true}"), "words-v1:" + first: json("{\"stars\":3}"), third: json("{\"completed\":true}"), "unknown": json("{\"stars\":3}")])
                let before = progress.encoded()
                let partial = Practice.lessonPath(lessons, progress: progress)
                expect(partial["completed"].numeric == 2 && partial["threeStar"].numeric == 1 && partial["next"]["id"].text == second, "Legacy and current metrics merge once, including completion-only saves")
                expect(progress.encoded() == before, "Chooser never writes saved progress")
                for lesson in numbered { progress[lesson["id"].text!] = json("{\"stars\":3}") }
                progress[second]["stars"] = .number(2)
                let review = Practice.lessonPath(lessons, progress: progress)
                expect(review["next"]["id"].text == second && review["reason"].text == "All lessons completed. Work toward 3 stars here.", "Completed path suggests remaining star target")
                progress[second]["stars"] = .number(3)
                let all = Practice.lessonPath(lessons, progress: progress)
                expect(all["next"]["id"].text == numbered.last!["id"].text && all["threeStar"].numeric == Double(numbered.count), "All-three-star path revisits final lesson")
            }
            let board = Guides.renderKeyboard(preset: preset, target: "A", pressed: ["CapsLock"], caps: true)
            expect(board.containsText("key-target") && board.containsText("key-shift-target") && board.containsText("caps-active") && board.containsText("key-pressed"), "Keyboard renders target, opposite Shift, press and Caps Lock")
            let hands = Guides.renderHands(preset: preset, target: "A")
            expect(hands.containsText("data-target-key=\"A\"") && hands.containsText("data-target-key=\"Shift\"") && hands.containsText("shift-active"), "Hands apply actual target and opposite Shift poses")
            let thumbs = Guides.renderHands(preset: preset, target: " ")
            expect(thumbs.componentsCount("data-reach-row=\"space\"") == 2 && Guides.fingerHint(preset: preset, target: " ").containsText("Either thumb"), "Space reaches both thumbs")
            expect(!Guides.renderHands(preset: preset).containsText("data-target-key="), "Clearing target restores home pose")
        }
        expect(Guides.renderKeyboard(preset: "uk-iso").containsText("points=\"0,0 1,0 1,1 0.25,1 0.25,0.5 0,0.5\""), "ISO Enter retains connected geometry")
        expect(Guides.fingerHint(preset: "uk-iso", target: "|").containsText("Right Shift") && Guides.fingerHint(preset: "uk-iso", target: "#").containsText("home row"), "UK punctuation keeps physical guidance")
        expect(Guides.fingerHint(target: "g").containsText("reach inward"), "Inner index key guidance")
        expect(Guides.renderHands(target: "q").containsText("data-reach-row=\"upper\""), "Upper row pose")
        expect(Guides.renderHands(target: "1").containsText("--reach-scale:1.38"), "Number row pose")
        expect(Guides.renderHands(target: "z").containsText("data-reach-row=\"lower\""), "Lower row pose")
        let heat = Guides.renderKeyboard(learning: json("{\"keys\":{\"a\":{\"attempts\":2,\"errors\":1,\"latencySamples\":1,\"latencyTotalMs\":100},\"A\":{\"attempts\":3,\"errors\":0,\"latencySamples\":2,\"latencyTotalMs\":200}}}"))
        expect(heat.containsText("A: 1 error · 5 attempts · 100 ms average reach") && heat.containsText("--key-heat-strength:18%"), "Heatmap combines shifted and base physical key observations")
        expect(Guides.renderKeyboard(target: "\"<script>").containsText("<script>") == false, "Unsupported target cannot inject markup")
        let saved = json("{\"amat-1\":{\"completed\":true,\"lastPlayed\":100},\"words-v1:pro-2\":{\"completed\":true,\"lastPlayed\":200},\"unknown\":{\"completed\":true,\"lastPlayed\":300}}")
        let latest = Practice.latestLesson([json("{\"lessonId\":\"words-10\"}")], progress: saved)
        expect(latest["track"].text == "pro" && latest["index"].numeric == 1, "Dated progress survives history eviction")
        expect(Practice.latestLesson([json("{\"lessonId\":\"amat-intro\"}")], progress: saved)["index"].numeric == 0, "Retained history wins")
        expect(Practice.sessionLabel(json("{\"lessonId\":\"quote-99\"}")) == "Quote · legacy selection", "Legacy numeric quotes do not receive unrelated authors")
        expect(Practice.sessionLabel(json("{\"lessonId\":\"amat-4\"}")) == "Inner Reach", "Lesson labels omit numeric and key suffixes")
        expect(Practice.sessionLabel(json("{\"lessonId\":\"time-30-punctuation\",\"typingMode\":\"strict\"}")) == "30 seconds · guided · punctuation", "History preserves option labels")
        let result = json("{\"correctNonSpaceChars\":5,\"elapsedMilliseconds\":1000,\"skippedChars\":0,\"accuracy\":100,\"wpm\":60,\"missedWords\":[]}")
        let exercise = json("{\"track\":\"lesson\",\"targetAccuracy\":98,\"targetWpm\":60}")
        expect(Practice.resultFeedback(result, exercise: exercise, nextLabel: "Choose a lesson")["advance"].boolean == true, "Completed lesson has next action")
        var worse = result
        worse["accuracy"] = .number(97)
        expect(Practice.resultFeedback(worse, exercise: exercise)["heading"].text == "Accuracy comes first.", "Below-target accuracy cannot advance")
        worse = result
        worse["skippedChars"] = .number(1)
        expect(Practice.resultFeedback(worse, exercise: exercise)["heading"].text == "Finish each word.", "Skipping wins over high speed")
        expect(Practice.resultFeedback(result, exercise: json("{\"track\":\"weak\"}"))["advice"].text == "Review your focus below.", "Practice result coaching stays neutral")
        expect(Practice.normalizeCustomText(" \u{AD}\t café\u{200B} \nworld \u{200B}") == "café world", "Swift removes copied layout markers and whitespace from NFC input")
        for copied in ["  cafe\u{301}\t\n hello\r\nworld ", "  cafe\u{AD}\u{301} hello world", "cafe\u{200B}\u{301} hello world"] {
            let cleaned = Practice.normalizeCustomText(copied)
            expect(Array(cleaned.utf8) == Array("café hello world".utf8), "NFC composition occurs after copied marker removal")
        }
        for (milliseconds, expected) in [(0.0, "0s"), (4.0, "0.004s"), (0.4, "0.0004s"), (0.004, "0.000004s"), (125.0, "0.125s"), (1234.0, "1.23s"), (15400.0, "15.4s")] { expect(Practice.formatElapsedTime(milliseconds) == expected, "Elapsed time preserves meaningful subsecond values") }
        var samples: [JSON] = []
        for milliseconds in [1100.0, 1150.0, 3400.0] { Practice.recordSpeedSample(&samples, stats: .object(["elapsedMilliseconds": .number(milliseconds), "wpm": .number(50)])) }
        expect(samples.count == 2, "One speed observation per observed second")
        Practice.recordSpeedSample(&samples, stats: json("{\"elapsedMilliseconds\":3400,\"wpm\":61}"), final: true)
        expect(samples.count == 2 && samples.last?["wpm"].numeric == 61, "Exact endpoint replaces matching tick")
        expect(Practice.typingErrorMessage("f", typed: " ", mode: "flow") == "Skipped characters before Space; expected “f”.", "Error teaching matches editing mode")
        print("Swift practice and guide checks passed (\(checks) assertions).")
    }
}

extension String {
    func containsText(_ needle: String) -> Bool {
        Guides.substringRange(self, needle) != nil
    }

    func componentsCount(_ needle: String) -> Int {
        var remaining = self
        var count = 0
        while let range = Guides.substringRange(remaining, needle) {
            count += 1
            remaining = String(remaining[range.upperBound...])
        }
        return count
    }
}
