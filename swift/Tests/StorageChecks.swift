// Compile JSON.swift, Storage.swift and this file together; no browser or Foundation required.
@main
struct StorageChecks {
    static let date = "2026-10-09T12:34:56.000Z"
    static func expect(_ condition: Bool, _ message: String) { precondition(condition, message) }
    static func json(_ text: String) -> JSON { JSON.parse(text)! }
    static func result(wpm: Double = 70, accuracy: Double = 99, milliseconds: Double = 1000) -> JSON {
        .object(["wpmMetric": .string("words-v1"), "wpm": .number(wpm), "accuracy": .number(accuracy),
            "elapsedMilliseconds": .number(milliseconds), "elapsedSeconds": .number((milliseconds / 1000).rounded()),
            "totalKeystrokes": .number(10), "correctKeystrokes": .number(9), "correctNonSpaceChars": .number(8),
            "errorKeystrokes": .number(1), "skippedChars": .number(0), "learning": json("""
            {"keys":{"a":{"attempts":2,"errors":1,"latencySamples":1,"latencyTotalMs":100}},"bigrams":{}}
            """)])
    }
    static func enqueue(_ store: SwiftStore, id: String = "amat-1", stats: JSON? = nil,
        options: JSON = .object([:])) {
        expect(store.enqueueLesson(lessonId: id, stats: stats ?? result(), options: options,
            timestamp: 1_791_549_296_000, date: date) != nil, "A valid attempt queues")
    }
    @discardableResult
    static func commit(_ store: SwiftStore, raw: inout String?, succeed: Bool = true) -> JSON {
        let candidate = store.prepareNext(latestRaw: raw)
        if succeed, let candidate { raw = candidate }
        return store.finishWrite(succeeded: succeed && candidate != nil)
    }

    static func main() {
        for invalid in ["", "[1,]", "{\"a\":1,}", "01", "+1", ".1", "1.", "1e", "NaN", "true false", "\"a\nb\"", "\"\\q\""] {
            expect(JSON.parse(invalid) == nil, "Reject malformed JSON: " + invalid)
        }
        let bounded = String(repeating: "[", count: 128) + "0" + String(repeating: "]", count: 128)
        expect(JSON.parse(bounded)?.encoded() == bounded, "Supported nesting round-trips at the parser boundary")
        expect(JSON.parse("[" + bounded + "]") == nil, "Excess array nesting rejects before exhausting the stack")
        let deep = String(repeating: "{\"future\":", count: 2000) + "0" + String(repeating: "}", count: 2000)
        expect(JSON.parse(deep) == nil, "Excess object nesting rejects without walking the entire structure recursively")
        let scalars = json(#"{"Å":1,"Å":2,"a":3,"\u0061":4,"s":"\uD83D\uDE00","odd":"\ud800","\udc00":{"keep":true},"large":1e999,"controls":"\b\f\n\r\t\/\\\""}"#)
        expect(scalars["Å"].numeric == 1 && scalars["Å"].numeric == 2 && scalars["a"].numeric == 4,
            "Object lookup uses exact scalar keys and last duplicate wins")
        expect(scalars["s"].text == "😀", "Surrogate pairs decode to one scalar")
        expect(scalars["odd"].encoded() == #""\ud800""# && scalars["large"].encoded() == "1e999",
            "Unpaired strings and large unknown numeric tokens remain lossless")
        expect(JSON.parse(scalars.encoded())!.members.contains { $0.rawKey == #""\udc00""# },
            "Unpaired UTF-16 object keys survive encoding")
        expect(scalars["controls"].text == "\u{8}\u{C}\n\r\t/\\\"", "JSON escapes decode safely")
        let cut = JSON.string(String(repeating: "x", count: 199) + "😀").prefixString(200)
        expect(cut.stringUnits?.last == 0xD83D && cut.stringUnits?.count == 200,
            "UTF-16 truncation preserves a split surrogate instead of replacing it")

        let fresh = SwiftStore()
        expect(fresh.data["settings"]["typingMode"].text == "strict" &&
            fresh.data["settings"]["showHands"].boolean == true && fresh.pendingCount == 0,
            "Fresh startup selects teaching defaults without enqueueing writes")
        expect(fresh.prepareRetry(latestRaw: #"{"newer":true}"#) == nil &&
            fresh.finishWrite(succeeded: false)["saved"].boolean == true,
            "Retry on a clean store is a no-op even if another tab has newer data")

        let original = #"{"futureRoot":{"odd":"\ud800","Å":1,"Å":2},"__proto__":{"keep":true},"settings":{"volume":"bad","theme":"light","futureSetting":{"keep":true}},"progress":{"__proto__":{"completed":true,"bestWpm":80,"bestAccuracy":99,"stars":3,"timestamp":"bad","futureProgress":[1,2]},"words-v1:amat-1":{"completed":true,"bestWpm":100,"bestAccuracy":100,"stars":3}},"history":[{"lessonId":"old","wpm":40,"accuracy":95,"stars":2,"date":"2026-10-06T00:00:00.000Z","futureHistory":true}],"stats":{"totalSessions":1,"highestWpm":80,"futureStats":true},"learning":{"version":1,"futureLearning":true,"keys":{},"bigrams":{}}}"#
        for unreadableRaw in ["{\"progress\":", deep] {
            let unreadable = SwiftStore(raw: unreadableRaw)
            expect(unreadable.loadFailed && unreadable.saveFailed && unreadable.pendingCount == 0,
                "Unparseable startup preserves a protected session without writing defaults")
            enqueue(unreadable, id: "protected-attempt")
            expect(unreadable.prepareNext(latestRaw: unreadableRaw) == nil,
                "Malformed or deeply nested saved bytes cannot be overwritten by a new attempt")
            _ = unreadable.finishWrite(succeeded: false)
            expect(unreadable.prepareRetry(latestRaw: original) == nil,
                "Unreadable startup remains protected even if a later read is parseable")
            _ = unreadable.finishWrite(succeeded: false)
            let preserved = json(unreadable.exportBackup(savedRaw: unreadableRaw, exportedAt: date))
            expect(preserved["savedRaw"].text == unreadableRaw &&
                preserved["session"]["history"].list?.first?["lessonId"].text == "protected-attempt",
                "A usable backup keeps the exact unreadable bytes and the new in-memory attempt")
            let unavailableBackup = json(unreadable.exportBackup(savedRaw: nil, readFailed: true, exportedAt: date))
            expect(unavailableBackup["baselineRaw"].text == unreadableRaw,
                "Unreadable but originally readable raw survives a later storage IO failure")

            let reloaded = SwiftStore(raw: original)
            reloaded.load(raw: unreadableRaw)
            expect(reloaded.loadFailed && reloaded.saveFailed,
                "Explicit load uses the same unreadable-data protection as initialization")
            let refreshed = SwiftStore(raw: original)
            let beforeRefresh = refreshed.data.encoded()
            refreshed.refresh(raw: unreadableRaw)
            expect(refreshed.loadFailed && refreshed.saveFailed && refreshed.data.encoded() == beforeRefresh,
                "An unreadable cross-tab refresh preserves the last usable in-memory state")

            let lockedRead = SwiftStore(raw: original)
            enqueue(lockedRead, id: "pending-before-unreadable")
            expect(lockedRead.prepareNext(latestRaw: unreadableRaw) == nil && lockedRead.loadFailed,
                "The fresh locked read rejects unreadable data rather than replacing it with defaults")
            _ = lockedRead.finishWrite(succeeded: false)
            let lockedBackup = json(lockedRead.exportBackup(savedRaw: unreadableRaw, exportedAt: date))
            expect(lockedBackup["baselineRaw"].text == original && lockedBackup["savedRaw"].text == unreadableRaw &&
                lockedBackup["session"]["history"].list?.count == 2,
                "Failed locked reads retain the previous baseline, external bytes and queued attempt")
        }
        let store = SwiftStore(raw: original)
        expect(store.data["settings"]["volume"].numeric == 0.6 && store.data["settings"]["theme"].text == "light",
            "Known invalid settings sanitize while valid values survive")
        expect(!store.data["progress"]["__proto__"].has("timestamp"), "Invalid known timestamps are removed")
        for key in ["__proto__", "constructor", "futureSetting"] {
            expect(store.enqueueSetting(key: key, value: .bool(false)) == nil, "Unknown setting cannot be mutated")
        }
        expect(store.enqueueSetting(key: "volume", value: .number(.infinity)) == nil, "Nonfinite settings reject")
        var raw: String? = original
        store.enqueueSetting(key: "colorPalette", value: .string("plum"))
        expect(commit(store, raw: &raw)["saved"].boolean == true, "Valid settings save")
        var saved = json(raw!)
        expect(saved["futureRoot"].encoded() == json(original)["futureRoot"].encoded() &&
            saved["__proto__"]["keep"].boolean == true && saved["settings"]["futureSetting"]["keep"].boolean == true &&
            saved["progress"]["__proto__"]["futureProgress"].list?.count == 2 &&
            saved["history"].list?.first?["futureHistory"].boolean == true && saved["stats"]["futureStats"].boolean == true,
            "Settings writes preserve unknown fields, exact Unicode keys and opaque strings at every level")
        enqueue(store, stats: result(wpm: 20, accuracy: 80))
        let weaker = commit(store, raw: &raw)
        expect(weaker["stars"].numeric == 1 && weaker["recordEligible"].boolean == false &&
            store.data["progress"]["words-v1:amat-1"]["stars"].numeric == 3 &&
            store.data["progress"]["words-v1:amat-1"]["bestWpm"].numeric == 100,
            "Current attempt stars do not erase earned stars or replace accuracy-qualified records")
        for id in ["__proto__", "constructor", "toString"] {
            enqueue(store, id: id)
            commit(store, raw: &raw)
            expect(store.data["progress"]["words-v1:" + id]["completed"].boolean == true,
                "Prototype-sensitive IDs remain ordinary saved IDs")
        }
        let options = json(#"{"testMode":"time","testDuration":30,"typingMode":"flow","punctuation":true,"numbers":false}"#)
        enqueue(store, id: "time-30", options: options)
        commit(store, raw: &raw)
        expect(store.data["progress"].has(#"words-v1:test:["time",30,"flow",true,false]"#),
            "Test record buckets match JavaScript JSON.stringify exactly")
        expect(store.data["stats"]["highestWpm"].numeric == 80, "Words-v1 scores do not relabel legacy records")
        enqueue(store, id: "repeat", options: .object(["recordEligible": .bool(false)]))
        let practice = commit(store, raw: &raw)
        expect(practice["stars"].numeric == 0 && !store.data["progress"].has("words-v1:repeat"),
            "Practice-only attempts keep history and learning without records")
        var skipped = result()
        skipped["skippedChars"] = .number(1)
        enqueue(store, id: "skipped", stats: skipped)
        expect(commit(store, raw: &raw)["recordEligible"].boolean == false, "Skipped targets prohibit records")
        enqueue(store, id: "quick", stats: result(wpm: 0, accuracy: 100, milliseconds: 125))
        expect(commit(store, raw: &raw)["stars"].numeric == 2 && store.data["progress"]["words-v1:quick"]["completed"].boolean == true,
            "Rounded-zero seconds and WPM retain positive measured successful completion")
        enqueue(store, id: "zero", stats: result(milliseconds: 0))
        expect(commit(store, raw: &raw)["stars"].numeric == 0, "Zero measured time earns no stars")
        var futureMetric = result()
        futureMetric["wpmMetric"] = .string("future")
        expect(store.enqueueLesson(lessonId: "bad", stats: futureMetric, timestamp: 0, date: date) == nil,
            "Unknown metric markers do not enter legacy record buckets")

        let future = json(#"{"version":2,"keys":{"future":{"attempts":"other-format"}},"bigrams":null,"odd":"\ud800"}"#)
        expect(mergeLearning(future, result()["learning"]).encoded() == future.encoded(), "Future learning versions stay opaque")
        var profile = json(#"{"version":1,"futureProfile":true,"keys":{"q":{"attempts":40,"errors":36,"latencySamples":40,"latencyTotalMs":36000,"recentErrorRate":0.8,"recentLatencyMs":900,"futureCell":true}},"bigrams":{}}"#)
        profile = mergeLearning(profile, json(#"{"keys":{"q":{"attempts":25,"errors":0,"latencySamples":25,"latencyTotalMs":1250}},"bigrams":{}}"#))
        expect(profile["keys"]["q"]["attempts"].numeric == 65 && profile["keys"]["q"]["errors"].numeric == 36 &&
            profile["keys"]["q"]["recentErrorRate"].numeric == 0 && profile["keys"]["q"]["recentLatencyMs"].numeric == 50 &&
            profile["keys"]["q"]["futureCell"].boolean == true && profile["futureProfile"].boolean == true,
            "Recent learning rotates while lifetime observations and unknown fields survive")
        let invalidLearning = json(#"{"keys":{"A":{"attempts":1,"errors":0,"latencySamples":0,"latencyTotalMs":0},"x":{"attempts":1,"errors":2,"latencySamples":0,"latencyTotalMs":0}},"bigrams":{}}"#)
        expect(readSessionLearning(invalidLearning)!["keys"].members.isEmpty, "Invalid keys and cell counts are rejected")

        var shared: String? = original
        let first = SwiftStore(raw: shared)
        let second = SwiftStore(raw: shared)
        enqueue(first, id: "first")
        enqueue(second, id: "second")
        expect(second.pendingLessons.count == 1 && !second.saveFailed, "Waiting for a lock is pending rather than failed")
        commit(first, raw: &shared)
        commit(second, raw: &shared)
        saved = json(shared!)
        expect(saved["history"].list?.count == 3 && saved["stats"]["totalSessions"].numeric == 3 &&
            saved["learning"]["keys"]["a"]["attempts"].numeric == 4,
            "Each locked save merges the latest base, preserving the other tab's attempt and learning")

        var disk: String? = original
        let failure = SwiftStore(raw: disk)
        enqueue(failure, id: "unsaved")
        expect(commit(failure, raw: &disk, succeed: false)["saved"].boolean == false && disk == original,
            "Quota failure leaves durable bytes unchanged")
        expect(failure.data["history"].list?.first?["lessonId"].text == "unsaved", "Failed result remains in memory")
        let backup = json(failure.exportBackup(savedRaw: disk, exportedAt: date))
        expect(backup["format"].text == "typeflow" && backup["version"].numeric == 1 &&
            backup["session"]["history"].list?.first?["lessonId"].text == "unsaved" && backup["savedRaw"].text == original,
            "Recovery envelope contains unsaved session and untouched saved bytes")
        let retried = failure.prepareRetry(latestRaw: disk)
        expect(retried != nil, "Retry is permitted when durable baseline has not changed")
        disk = retried
        expect(failure.finishWrite(succeeded: true)["saved"].boolean == true &&
            json(disk!)["history"].list?.count == 2, "Retry writes the failed result exactly once")
        expect(failure.prepareRetry(latestRaw: disk) == nil, "Successful retry cannot repeat the transaction")

        let conflict = SwiftStore(raw: original)
        enqueue(conflict, id: "local-unsaved")
        var before: String? = original
        commit(conflict, raw: &before, succeed: false)
        let external = shared
        expect(conflict.prepareRetry(latestRaw: external) == nil && conflict.saveConflict,
            "Recovery never overwrites another tab's newer durable data")
        _ = conflict.finishWrite(succeeded: false)
        let conflictBackup = json(conflict.exportBackup(savedRaw: external, exportedAt: date))
        expect(conflictBackup["baselineRaw"].text == original && conflictBackup["savedRaw"].text == external,
            "Conflict backup preserves both baseline and external save")

        let unread = SwiftStore(raw: nil, readFailed: true)
        enqueue(unread, id: "unread")
        expect(unread.prepareNext(latestRaw: original) == nil && unread.loadFailed,
            "Unread startup cannot overwrite unknown prior scores")
        _ = unread.finishWrite(succeeded: false)
        expect(unread.prepareRetry(latestRaw: original) == nil, "Read failure remains protected during retries")
        _ = unread.finishWrite(succeeded: false)
        let opaqueRaw = json(#""{\"future\":\"\ud800\"}""#)
        enqueue(unread, id: "still-pending")
        let opaqueBackup = json(unread.exportBackup(rawToken: opaqueRaw, readFailed: false, exportedAt: date))
        expect(opaqueRaw.text == nil && opaqueBackup["savedRaw"].encoded() == opaqueRaw.encoded() &&
            opaqueBackup["savedReadFailed"].boolean == false,
            "Backups retain exact browser raw-string tokens containing lone UTF-16 surrogates")
        expect(opaqueBackup["session"]["history"].list?.first?["lessonId"].text == "unread" &&
            opaqueBackup["pendingLessons"].list?.first?["lessonId"].text == "still-pending" &&
            unread.loadFailed && unread.saveFailed,
            "Opaque raw backup preserves memory and queued attempts without lifting write protection")
        expect(!json(unread.exportBackup(rawToken: opaqueRaw, readFailed: true, exportedAt: date)).has("savedRaw"),
            "An actual browser read failure does not claim a readable saved value")
        let locked = SwiftStore(raw: original)
        enqueue(locked)
        expect(locked.prepareNext(latestRaw: original, lockFailed: true) == nil, "Rejected Web Lock blocks writes")
        _ = locked.finishWrite(succeeded: false)
        expect(locked.prepareRetry(latestRaw: original) != nil, "A later acquired lock can recover without losing the attempt")
        _ = locked.finishWrite(succeeded: true)

        let queued = SwiftStore(raw: original)
        enqueue(queued, id: "queued-one")
        enqueue(queued, id: "queued-two")
        let pending = json(queued.exportBackup(savedRaw: original, exportedAt: date))
        expect(pending["pendingLessons"].list?.count == 2 && pending["session"]["history"].list?.count == 1,
            "Backup captures immutable queued attempts before lock acquisition")
        expect(queued.prepareRetry(latestRaw: original) == nil && queued.pendingCount == 2,
            "Retry cannot bypass pending ordered transactions")

        let futureHistory = json(#"{"lessonId":"future","wpm":5,"accuracy":90,"stars":1,"date":"2026-10-09","learning":{"version":3,"newMap":{"odd":"\ud800"}},"futureField":true}"#)
        expect(historyEntry(futureHistory, preserveUnknown: true)!["learning"].encoded() == futureHistory["learning"].encoded(),
            "History retains unsupported future learning versions")
        let oddID = json(#"{"lessonId":"\ud800","date":"2026-10-09"}"#)
        expect(historyEntry(oddID, preserveUnknown: true)!["lessonId"].encoded() == #""\ud800""#,
            "Unpaired UTF-16 historical identifiers are retained")
        expect(historyEntry(json(#"{"lessonId":"old","date":"invalid"}"#))!["date"].isNull,
            "Invalid saved dates do not appear valid")
        for legacyDate in ["Fri, 09 Oct 2026 12:34:56 GMT", "10/09/2026", "+010000-01-01T00:00:00.000Z"] {
            let legacy = JSON.object(["lessonId": .string("old"), "date": .string(legacyDate)])
            expect(historyEntry(legacy, preserveUnknown: true)!["date"].text == legacyDate,
                "Loaded legacy date text is preserved for platform date interpretation")
        }
        print("Swift storage checks passed: exact JSON, validation, unknown fields, records, learning, concurrent saves and recovery.")
    }
}
