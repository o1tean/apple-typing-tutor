// Browser I/O and Web Locks stay outside this module. All save decisions live here.
let typeflowStorageKey = "apple_typing_tutor_data_v1"
let maximumSavedNumber: Double = 9_007_199_254_740_991

func validSavedNumber(_ value: JSON, maximum: Double = maximumSavedNumber) -> Bool {
    guard let number = value.numeric else { return false }
    return number.isFinite && number >= 0 && number <= maximum
}

func savedNumber(_ value: JSON, maximum: Double = maximumSavedNumber) -> Double {
    validSavedNumber(value, maximum: maximum) ? value.numeric! : 0
}

func validSavedCount(_ value: JSON, maximum: Double = maximumSavedNumber) -> Bool {
    validSavedNumber(value, maximum: maximum) && value.numeric!.rounded(.towardZero) == value.numeric!
}

func savedCount(_ value: JSON, maximum: Double = maximumSavedNumber) -> Double {
    validSavedCount(value, maximum: maximum) ? value.numeric! : 0
}

func readSessionLearning(_ raw: JSON, preserveUnknown: Bool = false) -> JSON? {
    guard raw.isObject, preserveUnknown || (raw["keys"].isObject && raw["bigrams"].isObject) else { return nil }
    if preserveUnknown && validSavedCount(raw["version"]) && savedNumber(raw["version"]) > 1 { return raw }
    var snapshot = preserveUnknown ? raw : .object([:])
    for (name, length) in [("keys", 1), ("bigrams", 2)] {
        var cells = JSON.object([:])
        for member in raw[name].members {
            let cell = member.value
            let bytes = Array(member.key.utf8)
            guard member.rawKey == nil, bytes.count == length,
                bytes.allSatisfy({ $0 >= 32 && $0 <= 126 && !($0 >= 65 && $0 <= 90) }),
                cell.isObject, validSavedCount(cell["attempts"]), validSavedCount(cell["errors"]),
                validSavedCount(cell["latencySamples"]),
                savedCount(cell["errors"]) <= savedCount(cell["attempts"]),
                savedCount(cell["latencySamples"]) <= savedCount(cell["attempts"]),
                validSavedNumber(cell["latencyTotalMs"]),
                savedCount(cell["latencySamples"]) != 0 || savedNumber(cell["latencyTotalMs"]) == 0 else { continue }
            var next = preserveUnknown ? cell : .object([:])
            for field in ["attempts", "errors", "latencySamples", "latencyTotalMs"] { next[field] = cell[field] }
            cells[member.key] = next
        }
        snapshot[name] = cells
    }
    return snapshot
}

func migrateLearning(_ saved: JSON = .null) -> JSON {
    if saved.isObject && validSavedCount(saved["version"]) && savedNumber(saved["version"]) > 1 { return saved }
    var profile = readSessionLearning(saved, preserveUnknown: true) ?? .object([:])
    profile["version"] = .number(1)
    for name in ["keys", "bigrams"] {
        var cells = JSON.object([:])
        for member in profile[name].members {
            var cell = member.value
            let attempts = savedNumber(cell["attempts"])
            let timed = savedNumber(cell["latencySamples"])
            cell["recentErrorRate"] = .number(validSavedNumber(cell["recentErrorRate"], maximum: 1)
                ? savedNumber(cell["recentErrorRate"]) : attempts > 0 ? savedNumber(cell["errors"]) / attempts : 0)
            cell["recentLatencyMs"] = .number(validSavedNumber(cell["recentLatencyMs"])
                ? savedNumber(cell["recentLatencyMs"]) : timed > 0 ? savedNumber(cell["latencyTotalMs"]) / timed : 0)
            cells[member.key] = cell
        }
        profile[name] = cells
    }
    return profile
}

func mergeLearning(_ saved: JSON, _ rawSession: JSON) -> JSON {
    var profile = migrateLearning(saved)
    guard savedNumber(profile["version"]) <= 1, let session = readSessionLearning(rawSession) else { return profile }
    for name in ["keys", "bigrams"] {
        for member in session[name].members {
            let cell = member.value
            let attempts = savedNumber(cell["attempts"])
            let timed = savedNumber(cell["latencySamples"])
            let rate = attempts > 0 ? savedNumber(cell["errors"]) / attempts : 0
            let latency = timed > 0 ? savedNumber(cell["latencyTotalMs"]) / timed : 0
            var old = profile[name][member.key]
            if !old.isObject {
                old = .object(["attempts": .number(0), "errors": .number(0), "latencySamples": .number(0),
                    "latencyTotalMs": .number(0), "recentErrorRate": .number(rate), "recentLatencyMs": .number(latency)])
            }
            var merged = old
            for field in ["attempts", "errors", "latencySamples", "latencyTotalMs"] {
                merged[field] = .number(min(maximumSavedNumber, savedNumber(old[field]) + savedNumber(cell[field])))
            }
            let errorWeight = min(1, attempts / 20)
            let latencyWeight = min(1, timed / 20)
            merged["recentErrorRate"] = .number(attempts > 0 ? min(1,
                savedNumber(old["recentErrorRate"]) * (1 - errorWeight) + rate * errorWeight) : savedNumber(old["recentErrorRate"]))
            merged["recentLatencyMs"] = .number(timed > 0 ? min(maximumSavedNumber,
                savedNumber(old["recentLatencyMs"]) * (1 - latencyWeight) + latency * latencyWeight) : savedNumber(old["recentLatencyMs"]))
            profile[name][member.key] = merged
        }
    }
    return profile
}

let defaultTypeflowSettings = JSON.object([
    "theme": .string("dark"), "colorPalette": .string("mint"), "keyboardLayout": .string("mac-us"),
    "soundProfile": .string("magic"), "volume": .number(0.6), "soundMuted": .bool(false),
    "typingMode": .string("flow"), "showHands": .bool(false), "showKeyboard": .bool(false),
    "testMode": .string("time"), "testDuration": .number(30), "testWordCount": .number(25),
    "punctuation": .bool(false), "numbers": .bool(false)
])
private let defaultSavedStats = JSON.object([
    "totalSessions": .number(0), "totalKeystrokes": .number(0), "totalTimeSeconds": .number(0),
    "highestWpm": .number(0), "wordHighestWpm": .number(0)
])
private let testSettingNames = ["testMode", "testDuration", "testWordCount", "typingMode", "punctuation", "numbers"]

func validSetting(_ key: String, _ value: JSON) -> Bool {
    guard defaultTypeflowSettings.has(key) else { return false }
    let choices: [String: [String]] = [
        "theme": ["dark", "light", "system"], "colorPalette": ["mint", "ocean", "plum"],
        "keyboardLayout": ["mac-us", "colemak", "dvorak", "uk-iso"],
        "soundProfile": ["magic", "thock", "bubble", "clicky"], "typingMode": ["strict", "flow"],
        "testMode": ["time", "words"]
    ]
    if let options = choices[key] { return value.text.map { options.contains($0) } ?? false }
    if key == "testDuration" { return value.numeric.map { [15, 30, 60, 120].contains($0) } ?? false }
    if key == "testWordCount" { return value.numeric.map { [10, 25, 50, 100].contains($0) } ?? false }
    if key == "volume" { return validSavedNumber(value, maximum: 1) }
    return value.boolean != nil
}

private func validMetric(_ object: JSON) -> Bool {
    !object.has("wpmMetric") || object["wpmMetric"].text == "words-v1"
}

func progressKey(_ lessonId: String, options: JSON, settings: JSON) -> String {
    let prefix = options["wpmMetric"].text == "words-v1" ? "words-v1:" : ""
    guard validSetting("testMode", options["testMode"]) else { return prefix + lessonId }
    let lengthKey = options["testMode"].text == "time" ? "testDuration" : "testWordCount"
    let keys = ["testMode", lengthKey, "typingMode", "punctuation", "numbers"]
    let values = keys.map { validSetting($0, options[$0]) ? options[$0] : settings[$0] }
    return prefix + "test:" + JSON.array(values).encoded()
}

// Persisted dates written by Typeflow use ISO 8601. Accept date-only legacy values too.
private func validSavedDate(_ value: JSON) -> Bool {
    guard let text = value.text, !text.isEmpty, text.utf16.count <= 64 else { return false }
    let bytes = Array(text.utf8)
    func digits(_ start: Int, _ count: Int) -> Int? {
        guard start >= 0, start + count <= bytes.count,
            bytes[start..<(start + count)].allSatisfy({ $0 >= 48 && $0 <= 57 }) else { return nil }
        return Int(String(decoding: bytes[start..<(start + count)], as: UTF8.self))
    }
    guard digits(0, 4) != nil else { return false }
    if bytes.count == 4 { return true }
    guard bytes.count >= 7, bytes[4] == 45, let month = digits(5, 2), month >= 1, month <= 12 else { return false }
    if bytes.count == 7 { return true }
    guard bytes.count >= 10, bytes[7] == 45, let day = digits(8, 2), day >= 1, day <= 31 else { return false }
    if bytes.count == 10 { return true }
    guard bytes.count >= 16, [84, 116, 32].contains(bytes[10]), bytes[13] == 58,
        let hour = digits(11, 2), hour <= 24, let minute = digits(14, 2), minute < 60 else { return false }
    var index = 16
    var second = 0
    if index < bytes.count && bytes[index] == 58 {
        guard let value = digits(index + 1, 2), value < 60 else { return false }
        second = value
        index += 3
    }
    var fractional = false
    if index < bytes.count && bytes[index] == 46 {
        index += 1
        let start = index
        while index < bytes.count && bytes[index] >= 48 && bytes[index] <= 57 {
            fractional = fractional || bytes[index] != 48
            index += 1
        }
        if index == start { return false }
    }
    if hour == 24 && (minute != 0 || second != 0 || fractional) { return false }
    if index == bytes.count { return true }
    if [90, 122].contains(bytes[index]) { return index + 1 == bytes.count }
    guard [43, 45].contains(bytes[index]), let offsetHour = digits(index + 1, 2), offsetHour < 24 else { return false }
    index += 3
    if index < bytes.count && bytes[index] == 58 { index += 1 }
    guard let offsetMinute = digits(index, 2), offsetMinute < 60 else { return false }
    return index + 2 == bytes.count
}

func historyEntry(_ value: JSON, preserveUnknown: Bool = false) -> JSON? {
    guard value.isObject, let id = value["lessonId"].stringUnits, !id.isEmpty, id.count <= 200,
        validMetric(value) else { return nil }
    var entry = preserveUnknown ? value : .object([:])
    entry["lessonId"] = value["lessonId"]
    entry["wpm"] = .number(savedNumber(value["wpm"]))
    entry["accuracy"] = .number(savedNumber(value["accuracy"], maximum: 100))
    entry["stars"] = .number(savedCount(value["stars"], maximum: 3))
    // Legacy Date.parse formats are browser-dependent. Keep bounded loaded strings
    // without claiming validity; history rendering checks the browser's date parts.
    let retainedDate = preserveUnknown && (value["date"].stringUnits?.count ?? 65) <= 64
    entry["date"] = retainedDate || validSavedDate(value["date"]) ? value["date"] : .null
    for key in ["rawWpm", "consistency", "elapsedSeconds", "elapsedMilliseconds"] {
        entry.remove(key)
        if validSavedNumber(value[key], maximum: key == "consistency" ? 100 : maximumSavedNumber) { entry[key] = value[key] }
    }
    for key in testSettingNames {
        entry.remove(key)
        if validSetting(key, value[key]) { entry[key] = value[key] }
    }
    entry.remove("wpmMetric")
    if value["wpmMetric"].text == "words-v1" { entry["wpmMetric"] = value["wpmMetric"] }
    for key in ["totalKeystrokes", "correctKeystrokes", "correctNonSpaceChars", "errorKeystrokes", "skippedChars"] {
        entry.remove(key)
        if validSavedCount(value[key]) { entry[key] = value[key] }
    }
    entry.remove("recordEligible")
    entry.remove("recordReason")
    if value["recordEligible"].boolean != nil { entry["recordEligible"] = value["recordEligible"] }
    if value["recordReason"].stringUnits != nil { entry["recordReason"] = value["recordReason"].prefixString(200) }
    entry.remove("learning")
    if let learning = readSessionLearning(value["learning"], preserveUnknown: preserveUnknown) { entry["learning"] = learning }
    return entry
}

private func parsedSave(_ raw: String?) -> JSON? {
    guard let raw else { return .null }
    return JSON.parse(raw)
}

private func normalizedSave(_ parsed: JSON, fresh: Bool) -> JSON {
    var data = parsed.isObject ? parsed : .object([:])
    var settings = parsed["settings"].isObject ? parsed["settings"] : .object([:])
    for field in defaultTypeflowSettings.members {
        settings[field.key] = validSetting(field.key, parsed["settings"][field.key]) ? parsed["settings"][field.key] : field.value
    }
    if fresh {
        settings["typingMode"] = .string("strict")
        settings["showHands"] = .bool(true)
        settings["showKeyboard"] = .bool(true)
    }
    data["settings"] = settings
    var progress: [JSONMember] = []
    for member in parsed["progress"].members {
        guard !member.key.isEmpty, member.value.isObject else { continue }
        var value = member.value
        value["completed"] = .bool(value["completed"].boolean == true)
        value["bestWpm"] = .number(savedNumber(value["bestWpm"]))
        value["bestAccuracy"] = .number(savedNumber(value["bestAccuracy"], maximum: 100))
        value["stars"] = .number(savedCount(value["stars"], maximum: 3))
        for key in ["lastPlayed", "timestamp"] {
            if !validSavedNumber(value[key]) { value.remove(key) }
        }
        progress.append(JSONMember(key: member.key, value: value, rawKey: member.rawKey))
    }
    data["progress"] = .object(progress)
    data["history"] = .array(Array((parsed["history"].list ?? []).compactMap { historyEntry($0, preserveUnknown: true) }.prefix(50)))
    data["learning"] = migrateLearning(parsed["learning"])
    var stats = parsed["stats"].isObject ? parsed["stats"] : .object([:])
    for field in defaultSavedStats.members {
        stats[field.key] = .number(["totalSessions", "totalKeystrokes"].contains(field.key)
            ? savedCount(parsed["stats"][field.key]) : savedNumber(parsed["stats"][field.key]))
    }
    data["stats"] = stats
    return data
}

private struct QueuedSave {
    let id: Int
    let setting: String?
    let value: JSON
    let progressKey: String
    let completed: Bool
    let elapsedSeconds: Double
    let timestamp: Double
    let result: JSON
}

final class SwiftStore {
    private(set) var data: JSON
    private(set) var loadFailed = false
    private(set) var saveFailed = false
    private(set) var saveConflict = false
    private(set) var lockFailed = false
    private(set) var lastResult = JSON.object([:])
    private var lastSavedRaw: String? = nil
    private var baselineKnown = false
    private var queue: [QueuedSave] = []
    private var nextID = 1
    private var writing = false
    private var candidate: String? = nil

    var pendingLessons: [JSON] { queue.filter { $0.setting == nil }.map { $0.value } }
    var pendingCount: Int { queue.count + (writing ? 1 : 0) }
    var nextWriteID: Int? { queue.first?.id }

    init(raw: String? = nil, readFailed: Bool = false) {
        let parsed = parsedSave(raw)
        let failed = readFailed || parsed == nil
        data = normalizedSave(parsed ?? .null, fresh: raw == nil && !failed)
        loadFailed = failed
        saveFailed = failed
        lastSavedRaw = raw
        baselineKnown = !readFailed
    }

    func load(raw: String?, readFailed: Bool = false) {
        let parsed = parsedSave(raw)
        let failed = readFailed || parsed == nil
        data = normalizedSave(parsed ?? .null, fresh: raw == nil && !failed)
        loadFailed = failed
        saveFailed = failed
        saveConflict = false
        lockFailed = false
        lastSavedRaw = raw
        baselineKnown = !readFailed
        queue = []
        writing = false
        candidate = nil
        lastResult = .object([:])
    }

    func refresh(raw: String?, readFailed: Bool = false) {
        guard !saveFailed, !loadFailed, !writing else { return }
        guard !readFailed, let parsed = parsedSave(raw) else { loadFailed = true; saveFailed = true; return }
        data = normalizedSave(parsed, fresh: raw == nil)
        lastSavedRaw = raw
        baselineKnown = true
    }

    @discardableResult
    func enqueueSetting(key: String, value: JSON) -> Int? {
        guard validSetting(key, value) else { return nil }
        let id = nextID
        nextID += 1
        queue.append(QueuedSave(id: id, setting: key, value: value, progressKey: "", completed: false,
            elapsedSeconds: 0, timestamp: 0, result: .object([:])))
        return id
    }

    @discardableResult
    func enqueueLesson(lessonId: String, stats: JSON, targetWpm: Double = 30, targetAccuracy: Double = 95,
        options: JSON = .object([:]), timestamp: Double, date: String) -> Int? {
        guard !lessonId.isEmpty, lessonId.utf16.count <= 200, stats.isObject, validMetric(stats) else {
            lastResult = .object(["stars": .number(0), "isNewBestWpm": .bool(false), "recordEligible": .bool(false),
                "recordReason": .string("No typing result was recorded.")])
            return nil
        }
        let wpm = savedNumber(stats["wpm"])
        let accuracy = savedNumber(stats["accuracy"], maximum: 100)
        let targetWpm = validSavedNumber(.number(targetWpm)) ? targetWpm : 30
        let targetAccuracy = validSavedNumber(.number(targetAccuracy), maximum: 100) ? targetAccuracy : 95
        let seconds = validSavedNumber(stats["elapsedMilliseconds"]) ? savedNumber(stats["elapsedMilliseconds"]) / 1000 : savedNumber(stats["elapsedSeconds"])
        let correct = savedCount(stats["correctKeystrokes"]) > 0 && savedCount(stats["correctKeystrokes"]) <= savedCount(stats["totalKeystrokes"])
            && (!stats.has("correctNonSpaceChars") || savedCount(stats["correctNonSpaceChars"]) > 0)
        let skipped = savedCount(stats["skippedChars"]) > 0
        let practice = options["recordEligible"].boolean == false
        let completed = correct && seconds > 0 && !skipped && !practice
        let reason: String? = seconds <= 0 ? "The test has no measured typing time."
            : !correct ? "No correct characters were typed."
            : skipped ? "Skipped characters do not qualify for records."
            : practice ? "Practice sessions do not qualify for records."
            : accuracy < targetAccuracy ? "Records need at least \(JSON.number(targetAccuracy).encoded())% accuracy." : nil
        let eligible = reason == nil
        let stars = completed ? accuracy >= targetAccuracy ? wpm >= targetWpm ? 3 : 2 : 1 : 0
        var value = options.isObject ? options : .object([:])
        value["lessonId"] = .string(lessonId)
        value["wpm"] = .number(wpm)
        value["accuracy"] = .number(accuracy)
        value["stars"] = .number(Double(stars))
        for key in ["wpmMetric", "rawWpm", "consistency", "elapsedSeconds", "elapsedMilliseconds", "totalKeystrokes",
            "correctKeystrokes", "correctNonSpaceChars", "errorKeystrokes", "skippedChars", "learning"] {
            if stats.has(key) { value[key] = stats[key] } else { value.remove(key) }
        }
        value["recordEligible"] = .bool(eligible)
        value["recordReason"] = reason.map(JSON.string) ?? .null
        value["date"] = .string(date)
        let entry = historyEntry(value)!
        let key = progressKey(lessonId, options: entry, settings: data["settings"])
        let result = JSON.object(["stars": .number(Double(stars)), "isNewBestWpm": .bool(false),
            "recordEligible": .bool(eligible), "recordReason": reason.map(JSON.string) ?? .null])
        let id = nextID
        nextID += 1
        queue.append(QueuedSave(id: id, setting: nil, value: entry, progressKey: key, completed: completed,
            elapsedSeconds: seconds, timestamp: timestamp, result: result))
        lastResult = result
        return id
    }

    // Call under the browser's storage lock, with raw read inside that same lock.
    func prepareNext(latestRaw: String?, readFailed: Bool = false, lockFailed: Bool = false) -> String? {
        guard !writing, !queue.isEmpty else { return nil }
        prepareBase(latestRaw: latestRaw, readFailed: readFailed, lockFailed: lockFailed)
        let change = queue.removeFirst()
        lastResult = change.result
        if let setting = change.setting {
            data["settings"][setting] = change.value
        } else {
            let entry = change.value
            data["learning"] = mergeLearning(data["learning"], entry["learning"])
            var existing = data["progress"][change.progressKey]
            if !existing.isObject { existing = .object(["bestWpm": .number(0), "bestAccuracy": .number(0), "stars": .number(0)]) }
            let wpm = savedNumber(entry["wpm"])
            let eligible = entry["recordEligible"].boolean == true
            lastResult["isNewBestWpm"] = .bool(eligible && wpm > savedNumber(existing["bestWpm"]))
            if change.completed {
                existing["completed"] = .bool(true)
                existing["bestWpm"] = .number(eligible ? max(savedNumber(existing["bestWpm"]), wpm) : savedNumber(existing["bestWpm"]))
                existing["bestAccuracy"] = .number(max(savedNumber(existing["bestAccuracy"]), savedNumber(entry["accuracy"])))
                existing["stars"] = .number(max(savedCount(existing["stars"]), savedCount(entry["stars"])))
                existing["lastPlayed"] = .number(change.timestamp)
                data["progress"][change.progressKey] = existing
            }
            for (key, increment) in [("totalSessions", 1.0), ("totalKeystrokes", savedCount(entry["totalKeystrokes"])), ("totalTimeSeconds", change.elapsedSeconds)] {
                data["stats"][key] = .number(min(maximumSavedNumber, savedNumber(data["stats"][key]) + increment))
            }
            if eligible {
                let key = entry["wpmMetric"].text == "words-v1" ? "wordHighestWpm" : "highestWpm"
                data["stats"][key] = .number(max(savedNumber(data["stats"][key]), wpm))
            }
            var history = data["history"].list ?? []
            history.insert(entry, at: 0)
            data["history"] = .array(Array(history.prefix(50)))
        }
        return prepareCandidate(latestRaw: latestRaw)
    }

    func prepareRetry(latestRaw: String?, readFailed: Bool = false, lockFailed: Bool = false) -> String? {
        guard !writing, queue.isEmpty else { lastResult["saved"] = .bool(false); return nil }
        if !saveFailed { lastResult["saved"] = .bool(true); return nil }
        self.lockFailed = lockFailed
        if readFailed || parsedSave(latestRaw) == nil { loadFailed = true; saveFailed = true }
        return prepareCandidate(latestRaw: latestRaw)
    }

    @discardableResult
    func finishWrite(succeeded: Bool) -> JSON {
        guard writing else { return lastResult }
        let saved = succeeded && candidate != nil
        if saved {
            lastSavedRaw = candidate
            baselineKnown = true
            saveFailed = false
            saveConflict = false
        } else { saveFailed = true }
        writing = false
        candidate = nil
        lastResult["saved"] = .bool(saved)
        return lastResult
    }

    private func prepareBase(latestRaw: String?, readFailed: Bool, lockFailed: Bool) {
        self.lockFailed = lockFailed
        if lockFailed { saveFailed = true }
        let parsed = parsedSave(latestRaw)
        if readFailed || parsed == nil { loadFailed = true; saveFailed = true }
        if !saveFailed && !loadFailed {
            data = normalizedSave(parsed ?? .null, fresh: latestRaw == nil)
            lastSavedRaw = latestRaw
            baselineKnown = true
        }
    }

    private func prepareCandidate(latestRaw: String?) -> String? {
        writing = true
        candidate = nil
        if loadFailed || lockFailed { saveFailed = true; return nil }
        if saveFailed && !sameRaw(latestRaw, lastSavedRaw) {
            saveConflict = true
            return nil
        }
        candidate = data.encoded()
        return candidate
    }

    private func sameRaw(_ first: String?, _ second: String?) -> Bool {
        switch (first, second) {
        case (nil, nil): return true
        case (.some(let first), .some(let second)): return first.utf8.elementsEqual(second.utf8)
        default: return false
        }
    }

    func exportBackup(savedRaw: String?, readFailed: Bool = false, exportedAt: String) -> String {
        backupEnvelope(savedRaw: savedRaw, readFailed: readFailed, exportedAt: exportedAt).encoded()
    }

    func exportBackup(rawToken: JSON, readFailed: Bool, exportedAt: String) -> String {
        var backup = backupEnvelope(savedRaw: rawToken.text, readFailed: readFailed, exportedAt: exportedAt)
        // Browser strings can contain lone UTF-16 surrogates that Swift String cannot represent.
        if !readFailed, case .opaque(let token) = rawToken, token.utf8.first == 34 {
            backup["savedRaw"] = rawToken
        }
        return backup.encoded()
    }

    private func backupEnvelope(savedRaw: String?, readFailed: Bool, exportedAt: String) -> JSON {
        var backup = JSON.object(["format": .string("typeflow"), "version": .number(1), "exportedAt": .string(exportedAt),
            "session": data, "savedReadFailed": .bool(readFailed)])
        if !pendingLessons.isEmpty { backup["pendingLessons"] = .array(pendingLessons) }
        if !readFailed { backup["savedRaw"] = savedRaw.map(JSON.string) ?? .null }
        if baselineKnown && (readFailed || !sameRaw(lastSavedRaw, savedRaw)) {
            backup["baselineRaw"] = lastSavedRaw.map(JSON.string) ?? .null
        }
        return backup
    }
}
