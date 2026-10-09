// Adaptive teaching and passage generation. Static content is emitted at build time.
enum Practice {
    static var curriculum: JSON { SwiftCatalog.data["curriculum"] }
    static var layouts: JSON { SwiftCatalog.data["layouts"] }

    static func strings(_ value: JSON) -> [String] {
        (value.list ?? []).compactMap { $0.text }
    }

    static func stringList(_ values: [String]) -> JSON {
        .array(values.map { .string($0) })
    }

    static func layout(_ preset: String = "mac-us") -> JSON {
        layouts.has(preset) ? layouts[preset] : layouts["mac-us"]
    }

    static func replace(_ text: String, _ search: String, _ replacement: String) -> String {
        guard !search.isEmpty else { return text }
        let source = Array(text.unicodeScalars)
        let needle = Array(search.unicodeScalars)
        var result = ""
        var index = 0
        while index < source.count {
            if index + needle.count <= source.count &&
                source[index..<(index + needle.count)].elementsEqual(needle) {
                result += replacement
                index += needle.count
            } else {
                result += String(source[index])
                index += 1
            }
        }
        return result
    }

    static func characters(_ text: String) -> [String] {
        text.unicodeScalars.map { String($0) }
    }

    static func whitespace(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.value {
        case 9...13, 32, 160, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
            return true
        default: return false
        }
    }

    static func collapseWhitespace(_ text: String) -> String {
        var result = ""
        var pending = false
        for scalar in text.unicodeScalars {
            if whitespace(scalar) { pending = !result.isEmpty; continue }
            if pending { result += " "; pending = false }
            result += String(scalar)
        }
        return result
    }

    static func lessonsForLayout(_ track: String, preset: String = "mac-us") -> [JSON] {
        guard track == "amateur" || track == "pro" else { return [] }
        let lessons = curriculum[track].list ?? []
        if preset == "uk-iso" {
            return lessons.map { saved in
                guard saved["id"].text == "pro-9" else { return saved }
                var lesson = saved
                lesson["description"] = .string("UK ISO: use your right pinky on the home row for #. Type ~ or @ with your right pinky and Left Shift. Reach down with your left pinky for \\; add Right Shift for |.")
                lesson["keysIntroduced"] = stringList(strings(saved["keysIntroduced"]) + ["#", "@", "|", "~"])
                return lesson
            }
        }
        guard preset == "colemak" || preset == "dvorak" else { return lessons }
        let keyboard = layout(preset)
        let home = characters((keyboard["homeKeys"].text ?? "").uppercased())
        let rest = "Rest your fingers on \(home.prefix(4).joined(separator: " ")) and \(home.suffix(4).joined(separator: " ")); feel the bumps on \(home[3]) and \(home[4])."
        return lessons.enumerated().map { index, saved in
            guard index <= (track == "amateur" ? 9 : 4) else { return saved }
            var lesson = saved
            let introduced = strings(saved["keysIntroduced"]).compactMap { keyboard["fromQwerty"][$0].text }
            let keys = introduced.filter { $0 != " " }
            let names = keys.map { $0.uppercased() }.joined(separator: ", ")
            var title = saved["title"].text ?? ""
            if let first = title.firstIndex(of: "("), let last = title[first...].firstIndex(of: ")") {
                title.replaceSubrange(first...last, with: "(\(names))")
            }
            let instructions = keys.map { "\($0.uppercased()) with \(keyboard["fingerMap"][$0]["label"].text ?? "")" }.joined(separator: ", ")
            lesson["title"] = .string(title)
            lesson["subtitle"] = .string("Keys: " + keys.map { $0.uppercased() }.joined(separator: " "))
            lesson["description"] = .string((saved["id"].text == "amat-intro" ? "" : "Use \(instructions). ") + rest + (introduced.contains(" ") ? " Press Space with either thumb." : ""))
            lesson["keysIntroduced"] = stringList(introduced)
            return lesson
        }
    }

    static func lessonPath(_ lessons: [JSON], progress: JSON) -> JSON {
        let steps = lessons.enumerated().map { index, source -> JSON in
            var lesson = source
            let id = source["id"].text ?? ""
            let legacy = progress[id]
            let current = progress["words-v1:" + id]
            let stars = max(legacy["stars"].numeric ?? 0, current["stars"].numeric ?? 0)
            lesson["index"] = .number(Double(index))
            lesson["stars"] = .number(stars)
            lesson["completed"] = .bool(stars > 0 || legacy["completed"].boolean == true || current["completed"].boolean == true)
            return lesson
        }
        let numbered = steps.filter { $0["id"].text != "amat-intro" }
        let unfinished = numbered.first { $0["completed"].boolean != true }
        let target = numbered.first { ($0["stars"].numeric ?? 0) < 3 }
        return .object([
            "steps": .array(steps), "total": .number(Double(numbered.count)),
            "completed": .number(Double(numbered.filter { $0["completed"].boolean == true }.count)),
            "threeStar": .number(Double(numbered.filter { $0["stars"].numeric == 3 }.count)),
            "next": unfinished ?? target ?? numbered.last ?? .null,
            "reason": .string(unfinished != nil ? "First lesson without a saved completion." : target != nil ? "All lessons completed. Work toward 3 stars here." : "All 3-star targets earned. Revisit the final lesson.")
        ])
    }

    static func latestLesson(_ history: [JSON], progress: JSON = .object([:])) -> JSON {
        let previous = progress.members.filter {
            $0.value["completed"].boolean == true && ($0.value["lastPlayed"].numeric ?? 0) > 0 && ($0.value["lastPlayed"].numeric ?? 0).isFinite
        }.sorted { ($0.value["lastPlayed"].numeric ?? 0) > ($1.value["lastPlayed"].numeric ?? 0) }.map { member -> JSON in
            let id = member.key.hasPrefix("words-v1:") ? String(member.key.dropFirst(9)) : member.key
            return .object(["lessonId": .string(id)])
        }
        for entry in history + previous {
            for track in ["amateur", "pro"] {
                if let index = (curriculum[track].list ?? []).firstIndex(where: { $0["id"].text == entry["lessonId"].text }) {
                    return .object(["track": .string(track), "index": .number(Double(index))])
                }
            }
        }
        return .null
    }

    static func focusKeys(_ profile: JSON, limit: Int = 3, group: String = "keys") -> [String] {
        guard profile["version"].numeric == 1, limit > 0 else { return [] }
        let cells = migrateLearning(profile)[group].members.filter {
            ($0.value["attempts"].numeric ?? 0) > 0 && (group == "keys" || !collapseWhitespace($0.key).isEmpty)
        }
        let slowest = max(1, cells.filter { ($0.value["latencySamples"].numeric ?? 0) > 0 }.map { $0.value["recentLatencyMs"].numeric ?? 0 }.max() ?? 0)
        let ranked = cells.map { cell -> (String, Double) in
            let timing = (cell.value["latencySamples"].numeric ?? 0) > 0 ? (cell.value["recentLatencyMs"].numeric ?? 0) / slowest : 0
            return (cell.key, 2 * (cell.value["recentErrorRate"].numeric ?? 0) + timing)
        }.filter { $0.1 > 0 }.sorted {
            $0.1 == $1.1 ? collationLess($0.0, $1.0) : $0.1 > $1.1
        }
        let threshold = (ranked.first?.1 ?? 0) * 0.6
        return Array(ranked.filter { $0.1 >= threshold }.prefix(limit)).map { $0.0 }
    }

    static func collationLess(_ left: String, _ right: String) -> Bool {
        let order = SwiftCatalog.data["collation"].text ?? ""
        let weights = Dictionary(uniqueKeysWithValues: characters(order).enumerated().map { ($0.element, $0.offset) })
        let a = characters(left)
        let b = characters(right)
        for index in 0..<min(a.count, b.count) where a[index] != b[index] {
            return (weights[a[index]] ?? 999) < (weights[b[index]] ?? 999)
        }
        return a.count < b.count
    }

    static func focusLabel(_ key: String) -> String {
        characters(key).map { $0 == " " ? "Space" : $0 }.joined(separator: " → ")
    }

    // Round the represented binary value, avoiding a second rounding from value * 10.
    static func decimal(_ value: Double, places: Int = 1) -> String {
        guard value.isFinite, places >= 0, places <= 3 else { return "0" }
        var factor: UInt64 = 1
        for _ in 0..<places { factor *= 10 }
        let bits = abs(value).bitPattern
        let exponent = Int((bits >> 52) & 0x7FF)
        let significand = (bits & 0x000F_FFFF_FFFF_FFFF) | (exponent == 0 ? 0 : 1 << 52)
        let scaled = significand * factor
        let shift = (exponent == 0 ? -1022 : exponent - 1023) - 52
        let integer: UInt64
        if shift >= 0 {
            guard shift < 64, scaled <= UInt64.max >> shift else { return String(value) }
            integer = scaled << shift
        } else if shift <= -64 {
            integer = 0
        } else {
            let count = -shift
            let remainder = scaled & ((UInt64(1) << count) - 1)
            integer = (scaled >> count) + (remainder >= UInt64(1) << (count - 1) ? 1 : 0)
        }
        let sign = value < 0 ? "-" : ""
        if places == 0 { return sign + String(integer) }
        let digits = String(integer % factor)
        return sign + String(integer / factor) + "." + String(repeating: "0", count: max(0, places - digits.count)) + digits
    }

    static func number(_ value: Double) -> String {
        if value.isFinite && abs(value) < Double(Int64.max) && value.rounded() == value { return String(Int64(value)) }
        let raw = String(value)
        guard let e = raw.firstIndex(of: "e"), let exponent = Int(raw[raw.index(after: e)...]) else { return raw }
        var mantissa = String(raw[..<e])
        if mantissa.hasSuffix(".0") { mantissa = String(mantissa.dropLast(2)) }
        guard abs(value) >= 0.000001, abs(value) < 1e21 else { return mantissa + "e" + (exponent >= 0 ? "+" : "") + String(exponent) }
        let negative = mantissa.hasPrefix("-")
        if negative { mantissa.removeFirst() }
        let parts = mantissa.split(separator: ".").map(String.init)
        let digits = parts.joined()
        let point = parts[0].count + exponent
        let expanded: String
        if point <= 0 { expanded = "0." + String(repeating: "0", count: -point) + digits }
        else if point >= digits.count { expanded = digits + String(repeating: "0", count: point - digits.count) }
        else { expanded = String(digits.prefix(point)) + "." + digits.dropFirst(point) }
        return (negative ? "-" : "") + expanded
    }

    static func practiceObservation(_ cell: JSON, recent: Bool = false) -> String {
        let attempts = cell["attempts"].numeric ?? 0
        guard attempts > 0 else { return "No observations yet." }
        let errors = cell["errors"].numeric ?? 0
        let timed = cell["latencySamples"].numeric ?? 0
        let rate = recent ? cell["recentErrorRate"].numeric ?? 0 : errors / attempts
        let reach = recent ? cell["recentLatencyMs"].numeric ?? 0 : (cell["latencyTotalMs"].numeric ?? 0) / max(1, timed)
        let label = recent ? "recent " : ""
        let timing = timed > 0 ? "\(decimal(reach, places: 0)) ms \(label)reach" : "no reach timing yet"
        let current = recent ? "" : " · \(number(errors))/\(number(attempts)) errors · \(number(timed)) timed"
        let sparse = attempts < 5 || (timed > 0 && timed < 5) ? " · few observations" : ""
        return "\(decimal(rate * 100))% \(label)errors, \(timing)\(current)\(sparse)"
    }

    static func choose(_ values: [String], random: () -> Double) -> String {
        guard !values.isEmpty else { return "" }
        return values[min(values.count - 1, max(0, Int(random() * Double(values.count))))]
    }

    static func drillLines(_ focus: [String], allowed input: [String], random: () -> Double, layout: JSON) -> [String] {
        guard !focus.isEmpty else { return [] }
        let columns = max(8, (focus.count + 3) / 4)
        var allowed = Set<String>()
        let context = input.filter { allowed.insert($0).inserted }.filter { $0 != " " }
        guard !context.isEmpty else { return [] }
        if focus.contains(" ") {
            let letters = focus.filter { $0 != " " }
            return (0..<4).map { _ in (0..<columns).map { _ in choose(letters.isEmpty ? context : letters, random: random) }.joined(separator: " ") }
        }
        let home = characters(layout["homeKeys"].text ?? "")
        let words = strings(curriculum["speedWords"])
        let pools = focus.map { key in
            words.map { key != key.lowercased() ? $0.uppercased() : $0 }.filter { word in
                let chars = characters(word)
                return chars.count <= 8 && chars.allSatisfy { allowed.contains($0) } && Double(chars.filter { $0 == key }.count) >= max(2, Double(chars.count + 1) / 3)
            }
        }
        let offset = min(focus.count - 1, max(0, Int(random() * Double(focus.count))))
        return (0..<4).map { line in
            (0..<columns).map { column in
                let index = (offset + line * columns + column) % focus.count
                let key = focus[index]
                if !pools[index].isEmpty && random() < 0.5 { return choose(pools[index], random: random) }
                let finger = layout["fingerMap"][key]
                let rest = home.first {
                    allowed.contains($0) && $0 != key && layout["fingerMap"][$0]["hand"].text == finger["hand"].text && layout["fingerMap"][$0]["finger"].text == finger["finger"].text
                }
                let nearby = home.filter { allowed.contains($0) && $0 != key && layout["fingerMap"][$0]["hand"].text == finger["hand"].text }
                let other = rest ?? choose(nearby.isEmpty ? context : nearby, random: random)
                return choose([key + other + key + other, key + other + other + key, other + key + other + key], random: random)
            }.joined(separator: " ")
        }
    }

    static func generateWeakDrill(_ profile: JSON, preset: String = "mac-us", group: String = "keys", random: () -> Double = { Double.random(in: 0..<1) }) -> JSON {
        let keys = focusKeys(profile, limit: group == "bigrams" ? 1 : 3, group: group)
        let lines: [String]
        if group == "bigrams", let pair = keys.first {
            lines = (0..<2).map { _ in collapseWhitespace((0..<8).map { _ in String(repeating: pair, count: 2 + min(1, max(0, Int(random() * 2)))) }.joined(separator: " ")) }
        } else {
            lines = drillLines(keys, allowed: characters("abcdefghijklmnopqrstuvwxyz") + keys, random: random, layout: layout(preset))
        }
        return .object(["lines": stringList(lines), "focusKeys": stringList(keys), "learningBefore": migrateLearning(profile)])
    }

    static func generateLessonDrill(_ track: String, index: Int, preset: String = "mac-us", random: () -> Double = { Double.random(in: 0..<1) }) -> [String] {
        let lessons = lessonsForLayout(track, preset: preset)
        guard index >= 0, index < lessons.count else { return [] }
        let lesson = lessons[index]
        let ownHand = track == "amateur" ? index <= 2 : index <= 1
        let taught = ownHand ? [lesson] : Array(lessons[(track == "amateur" ? 1 : 0)...index])
        let allowed = [" "] + taught.flatMap { strings($0["keysIntroduced"]) }
        let current = strings(lesson["keysIntroduced"]).filter { $0 != " " }
        return drillLines(current.isEmpty ? [" "] : current, allowed: allowed, random: random, layout: layout(preset))
    }

    static func generateWords(_ count: Int, options: JSON = .object([:]), random: () -> Double = { Double.random(in: 0..<1) }) -> String {
        let pool = strings(curriculum["speedWords"])
        guard count > 0, pool.count > 1 else { return "" }
        var previous = -1
        return (0..<count).map { index in
            let available = pool.count - (previous >= 0 ? 1 : 0)
            var choice = min(available - 1, max(0, Int(random() * Double(available))))
            if previous >= 0 && choice >= previous { choice += 1 }
            previous = choice
            var word = options["numbers"].boolean == true && index % 9 == 7 ? String(Int(random() * 1000)) : pool[choice]
            if options["punctuation"].boolean == true {
                if index % 8 == 0 { word = String(word.prefix(1)).uppercased() + word.dropFirst() }
                if index % 8 == 7 || index == count - 1 { word += "." }
                else if index % 8 == 3 { word += "," }
            }
            return word
        }.joined(separator: " ")
    }

    static func normalizeCustomText(_ text: String) -> String {
        let clean = String(String.UnicodeScalarView(text.unicodeScalars.filter {
            $0.value != 0x00AD && $0.value != 0x200B
        }))
        // The pinned Swift stdlib exposes NFC code units without Foundation.
        return collapseWhitespace(String(decoding: Array(clean._nfcCodeUnits), as: UTF8.self))
    }

    static func recordSpeedSample(_ samples: inout [JSON], stats: JSON, final: Bool = false) {
        let milliseconds = stats["elapsedMilliseconds"].numeric ?? 0
        guard milliseconds.isFinite, milliseconds > 0 else { return }
        let previous = samples.last ?? .null
        let second = (milliseconds / 1000).rounded(.down)
        if !final && (second == 0 || second == ((previous["elapsedMilliseconds"].numeric ?? 0) / 1000).rounded(.down)) { return }
        let sample: JSON = .object(["elapsedMilliseconds": .number(milliseconds), "wpm": stats["wpm"]])
        if final && previous["elapsedMilliseconds"].numeric == milliseconds { samples[samples.count - 1] = sample }
        else { samples.append(sample) }
    }

    static func formatElapsedTime(_ milliseconds: Double) -> String {
        guard milliseconds.isFinite, milliseconds > 0 else { return "0s" }
        let seconds = milliseconds / 1000
        let rounded = Double(decimal(seconds, places: seconds < 1 ? 3 : 2)) ?? 0
        if rounded > 0 { return number(rounded) + "s" }
        var factor = 1.0
        while seconds * factor < 100 { factor *= 10 }
        return number((seconds * factor).rounded() / factor) + "s"
    }

    static func currentWord(_ cells: [TypingCell], index: Int) -> String {
        guard !cells.isEmpty else { return "" }
        var start = min(index, cells.count - 1)
        if start >= 0 && cells[start].scalar == 32 { start -= 1 }
        while start > 0 && cells[start - 1].scalar != 32 { start -= 1 }
        var end = max(0, start)
        while end < cells.count && cells[end].scalar != 32 { end += 1 }
        return cells[max(0, start)..<end].filter { !$0.extra }.map { String(Unicode.Scalar($0.scalar)!) }.joined()
    }

    static func typingErrorMessage(_ expected: String?, typed: String, mode: String) -> String {
        func key(_ value: String) -> String { value == " " ? "Space" : "“\(value)”" }
        guard let expected = expected else { return typed == " " ? "Word submitted with mistakes." : "Extra character \(key(typed)). Backspace to remove it." }
        if mode == "flow" && typed == " " { return "Skipped characters before Space; expected \(key(expected))." }
        return "Expected \(key(expected)); typed \(key(typed)). \(mode == "strict" ? "Try again." : "Backspace to correct it.")"
    }

    static func resultFeedback(_ result: JSON, exercise: JSON, nextLabel: String = "Next lesson") -> JSON {
        let track = exercise["track"].text ?? ""
        let repeatLabel = ["test", "quote"].contains(track) ? "Repeat this text" : "Try again"
        let retry = (result["missedWords"].list ?? []).isEmpty ? "Choose \(repeatLabel)." : "Choose Practice missed words or \(repeatLabel)."
        let accuracyTarget = exercise["targetAccuracy"].numeric ?? 95
        let target = accuracyTarget == 0 ? 95 : accuracyTarget
        func feedback(_ heading: String, _ advice: String, advance: Bool = false) -> JSON {
            var value: JSON = .object(["heading": .string(heading), "advice": .string(advice)])
            if advance { value["advance"] = .bool(true) }
            return value
        }
        if (result["correctNonSpaceChars"].numeric ?? 0) <= 0 {
            return feedback("Let’s try that again.", (result["skippedChars"].numeric ?? 0) > 0 ? "Type each word before pressing Space." : "Follow the displayed text. \(retry)")
        }
        if (result["elapsedMilliseconds"].numeric ?? 0) <= 0 { return feedback("Too short to measure.", "Use a longer passage and try again.") }
        if (result["skippedChars"].numeric ?? 0) > 0 { return feedback("Finish each word.", "Type every character before Space. \(retry)") }
        if (result["accuracy"].numeric ?? 0) < target { return feedback("Accuracy comes first.", "Aim for \(number(target))% accuracy. \(retry)") }
        if track == "weak" { return feedback("Practice complete.", "Review your focus below.") }
        if ["custom", "retry"].contains(track) || exercise["options"]["recordEligible"].boolean == false { return feedback("Practice complete.", retry) }
        if track == "lesson" {
            let targetWpm = exercise["targetWpm"].numeric ?? 0
            if (result["wpm"].numeric ?? 0) < targetWpm { return feedback("Accuracy target met.", "Aim for \(number(targetWpm)) WPM for 3 stars. Choose Try again.") }
            return feedback("Lesson target reached.", "Select “\(nextLabel)” to keep learning.", advance: true)
        }
        return feedback("Test complete.", "\(retry) You can also start a fresh passage.")
    }

    static func sessionLabel(_ entry: JSON) -> String {
        let id = entry["lessonId"].text ?? ""
        if id == "custom" { return "Custom text" }
        if id == "missed-words" { return "Missed words" }
        if let quote = (curriculum["quotes"].list ?? []).first(where: { "quote-" + ($0["id"].text ?? "") == id }) { return "Quote · " + (quote["author"].text ?? "") }
        if id.hasPrefix("quote-") {
            let suffix = id.dropFirst(6)
            return !suffix.isEmpty && suffix.allSatisfy { $0 >= "0" && $0 <= "9" } ? "Quote · legacy selection" : "Quote · practice"
        }
        if let lesson = ((curriculum["amateur"].list ?? []) + (curriculum["pro"].list ?? [])).first(where: { $0["id"].text == id }) {
            var title = lesson["title"].text ?? ""
            if title.hasPrefix("Lesson "), let colon = title.firstIndex(of: ":") { title = String(title[title.index(after: colon)...].dropFirst()) }
            if title.last == ")", let opening = title.lastIndex(of: "("), opening > title.startIndex { title = String(title[..<title.index(before: opening)]) }
            return title
        }
        let parts = id.split(separator: "-").map(String.init)
        let legacyCount = parts.count > 1 ? String(parts[1].prefix { $0 >= "0" && $0 <= "9" }) : ""
        let legacyMode = parts.count >= 2 && ["time", "words", "speed"].contains(parts[0]) && !legacyCount.isEmpty ? parts[0] : ""
        let mode = entry["testMode"].text ?? (legacyMode == "speed" ? "time" : legacyMode)
        if mode.isEmpty { return replace(id, "-", " ") }
        let count = entry[mode == "time" ? "testDuration" : "testWordCount"].numeric ?? 0
        var labels = ["\(count != 0 ? number(count) : legacyCount.isEmpty ? "undefined" : legacyCount) \(mode == "time" ? "seconds" : "words")"]
        if entry["typingMode"].text == "strict" { labels.append("guided") }
        if entry["punctuation"].boolean == true || Guides.substringRange(id, "-punctuation") != nil { labels.append("punctuation") }
        if entry["numbers"].boolean == true || Guides.substringRange(id, "-numbers") != nil { labels.append("numbers") }
        return labels.joined(separator: " · ")
    }
}
