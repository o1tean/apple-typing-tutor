@main
struct AppHistoryChecks {
    static var checks = 0
    static func expect(_ condition: Bool, _ message: String) {
        checks += 1
        precondition(condition, message)
    }
    static func json(_ text: String) -> JSON { JSON.parse(text)! }
    static func date(_ year: Int, _ month: Int, _ day: Int, epoch: Double) -> JSON {
        .object(["year": .number(Double(year)), "month": .number(Double(month)), "day": .number(Double(day)), "epoch": .number(epoch), "valid": .bool(true), "label": .string("\(month)/\(day)")])
    }
    static func entry(_ wpm: Double, _ accuracy: Double = 100, milliseconds: Double = 1000) -> JSON {
        .object(["date": .string("a date supplied to the generic browser converter"), "wpmMetric": .string("words-v1"), "wpm": .number(wpm), "accuracy": .number(accuracy), "elapsedMilliseconds": .number(milliseconds)])
    }
    static func contains(_ text: String, _ search: String) -> Bool { Guides.substringRange(text, search) != nil }
    static func occurrences(_ text: String, _ search: String) -> Int {
        var remaining = text
        var count = 0
        while let range = Guides.substringRange(remaining, search) {
            count += 1
            remaining = String(remaining[range.upperBound...])
        }
        return count
    }
    static func main() {
        let today = date(2026, 10, 9, epoch: 10000)
        let yesterday = date(2026, 10, 8, epoch: 8000)
        let before = date(2026, 10, 7, epoch: 6000)
        // The actual two-month window supplied by browser local date parts.
        let localDays = (26...30).map { date(2026, 9, $0, epoch: Double($0)) } +
            (1...9).map { date(2026, 10, $0, epoch: Double($0)) }
        expect(HistoryProgress.dayNumber(date(2024, 3, 1, epoch: 0))! - HistoryProgress.dayNumber(date(2024, 2, 28, epoch: 0))! == 2, "Leap day remains a calendar day")
        expect(HistoryProgress.dayNumber(date(2025, 3, 1, epoch: 0))! - HistoryProgress.dayNumber(date(2025, 2, 28, epoch: 0))! == 1, "Non-leap February stays consecutive")
        expect(HistoryProgress.dayNumber(date(2026, 3, 29, epoch: 23 * 3600000))! - HistoryProgress.dayNumber(date(2026, 3, 28, epoch: 0))! == 1, "DST uses local civil dates rather than elapsed 24-hour blocks")
        expect(HistoryProgress.dayKey(today) == "2026-10-09", "Date keys preserve local dates")
        var oldMetric = entry(900)
        oldMetric["wpmMetric"] = .string("legacy")
        var secondsOnly = entry(80, 90)
        secondsOnly.remove("elapsedMilliseconds")
        secondsOnly["elapsedSeconds"] = .number(0.4)
        var missingDate = entry(900)
        missingDate.remove("date")
        let entries = [entry(40, 100, milliseconds: 4), secondsOnly, oldMetric, entry(900, milliseconds: 0), entry(-5), entry(20, 101), entry(999), entry(999), missingDate]
        let dates = [today, today, today, today, today, today, date(2026, 10, 9, epoch: 10001), json("{\"valid\":false,\"epoch\":null}"), today]
        let original = JSON.array(entries).encoded()
        let progress = HistoryProgress.summary(entries: entries, dates: dates, days: localDays, now: 10000)
        let last = progress["days"].list!.last!
        expect(last["sessions"].numeric == 6, "Activity includes unmeasured sessions but excludes invalid, missing and future dates")
        expect(last["measuredSessions"].numeric == 2 && last["wpm"].numeric == 60 && last["accuracy"].numeric == 95, "Daily means use valid current metrics and preserve subsecond observations")
        expect(progress["currentStreak"].numeric == 1 && progress["longestStreak"].numeric == 1, "Multiple sessions in one day count once")
        expect(JSON.array(entries).encoded() == original, "Aggregation never mutates saved sessions")
        let rendered = HistoryProgress.render(progress)
        expect(contains(rendered, "One day of measured scores; no trend yet."), "One measured day is not presented as a trend")
        expect(contains(rendered, "Vertical axis: 0 to 60.") && !contains(rendered, "400"), "Daily WPM scale matches observed scores rather than a 400-WPM floor")
        expect(contains(rendered, "chart-y-axis") && contains(rendered, "chart-x-axis") && contains(rendered, "9/26") && contains(rendered, "10/9"), "Charts display numeric axes and local date endpoints")
        expect(contains(rendered, "Daily practice · local dates") && contains(rendered, "<td>60.0</td><td>95.0%</td>"), "Native table retains exact daily averages")
        let ancient = [date(2010, 1, 1, epoch: -300), date(2010, 1, 2, epoch: -200), date(2010, 1, 3, epoch: -100)]
        let oldStreak = HistoryProgress.summary(entries: Array(repeating: entry(50), count: 5), dates: ancient + [yesterday, today], days: localDays, now: 10000)
        expect(oldStreak["longestStreak"].numeric == 3 && oldStreak["currentStreak"].numeric == 2, "Longest streak uses all retained dates, including dates older than one year")
        let activeYesterday = HistoryProgress.summary(entries: [entry(40), entry(40)], dates: [before, yesterday], days: localDays, now: 10000)
        expect(activeYesterday["currentStreak"].numeric == 2, "Yesterday keeps the current streak active")
        let inactive = HistoryProgress.summary(entries: [entry(40)], dates: [before], days: localDays, now: 10000)
        expect(inactive["currentStreak"].numeric == 0 && inactive["longestStreak"].numeric == 1, "A missing yesterday breaks current streak without erasing longest")
        let gap = HistoryProgress.summary(entries: [entry(40), entry(60)], dates: [before, today], days: localDays, now: 10000)
        let gapChart = HistoryProgress.chart(days: gap["days"].list!, metric: "wpm", label: "WPM", maximum: 60)
        expect(occurrences(gapChart, "<path ") == 2 && !contains(gapChart, "<polyline"), "No line spans a missing measured day")
        let adjacentChart = HistoryProgress.chart(days: oldStreak["days"].list!, metric: "wpm", label: "WPM", maximum: 50)
        expect(occurrences(adjacentChart, "<polyline") == 1, "Adjacent measured days connect")
        let legacyOnly = HistoryProgress.summary(entries: [oldMetric], dates: [today], days: localDays, now: 10000)
        let emptyChart = HistoryProgress.render(legacyOnly)
        expect(!contains(emptyChart, "<svg") && contains(emptyChart, "Finish a session with measured typing time"), "Legacy-only activity shows the measured-time hint instead of empty charts")
        expect(legacyOnly["currentStreak"].numeric == 1, "Legacy activity still contributes to streaks")
        let zeroScore = HistoryProgress.summary(entries: [entry(0, 0)], dates: [today], days: localDays, now: 10000)
        expect(zeroScore["days"].list!.last!["wpm"].numeric == 0 && contains(HistoryProgress.render(zeroScore), "Vertical axis: 0 to 20."), "Measured zero scores remain real data")
        let application = SwiftApp()
        application.historyRequest = 1
        application.epoch = 10000
        application.historyDates = .array([json("{\"lessonId\":\"words-10\",\"wpmMetric\":\"words-v1\",\"wpm\":40,\"rawWpm\":55,\"accuracy\":90,\"elapsedMilliseconds\":1234,\"date\":\"2026-10-09T00:00:00Z\",\"recordReason\":\"Accuracy below threshold\"}")])
        application.history(.object(["id": .number(1), "values": .array([today]), "offsets": .array(localDays)]))
        let table = application.commands.last?["value"].text ?? ""
        expect(contains(table, "40 / 55") && contains(table, "1.23s") && contains(table, "Correct-word scoring") && contains(table, "Accuracy below threshold"), "History rows restore raw WPM, exact elapsed time, scoring method and record reason")
        expect(contains(table, "Last 1 sessions · stored on this device"), "Caption states retention count and save availability")
        application.historyDates = .array([])
        application.history(.object(["id": .number(1), "values": .array([]), "offsets": .array(localDays)]))
        expect(contains(application.commands.last?["value"].text ?? "", "Your first session is waiting."), "Empty history keeps its first-session action")

        let layoutApplication = SwiftApp()
        layoutApplication.settings = layoutApplication.store.data["settings"]
        layoutApplication.lesson("amateur", 1)
        let originalKeys = Practice.strings(layoutApplication.exercise["keysIntroduced"])
        layoutApplication.result = entry(60)
        layoutApplication.openDialog("settings")
        layoutApplication.setting("keyboardLayout", .string("colemak"))
        expect(layoutApplication.capturedPreset == "mac-us" && !layoutApplication.result.isNull,
            "Changing layout preserves the completed lesson result until another run starts")
        layoutApplication.setting("typingMode", .string("flow"))
        let newKeys = Practice.strings(Practice.lessonsForLayout("amateur", preset: "colemak")[1]["keysIntroduced"])
        let drillCharacters = Practice.strings(layoutApplication.exercise["lines"]).flatMap(Practice.characters)
        expect(newKeys != originalKeys && Practice.strings(layoutApplication.exercise["keysIntroduced"]) == newKeys &&
            !drillCharacters.isEmpty && drillCharacters.allSatisfy { $0 == " " || newKeys.contains($0) },
            "Changing mode after a completed lesson and layout change regenerates the new layout's taught keys and drill")
        expect(layoutApplication.capturedPreset == "colemak" && layoutApplication.result.isNull &&
            session.mode == "flow" && layoutApplication.dialog == "settings" &&
            layoutApplication.exercise["options"]["recordEligible"].boolean != false,
            "The regenerated lesson uses the selected mode, remains eligible and keeps Settings open")

        let delayed = SwiftApp()
        delayed.settings = delayed.store.data["settings"]
        delayed.run = 1
        var completed = entry(60)
        for (name, count) in [("totalKeystrokes", 10), ("correctKeystrokes", 10), ("correctNonSpaceChars", 8), ("errorKeystrokes", 0), ("skippedChars", 0)] {
            completed[name] = .number(Double(count))
        }
        delayed.result = completed
        let lessonID = Practice.lessonsForLayout("amateur", preset: "mac-us")[1]["id"].text!
        let firstSave = delayed.store.enqueueLesson(lessonId: lessonID, stats: completed,
            timestamp: 10000, date: "2026-10-09T12:00:00.000Z")!
        delayed.savingRun[firstSave] = delayed.run
        delayed.openDialog("lessons")
        expect(!delayed.commands.contains { $0["selector"].text == "#lesson-list" && contains($0["value"].text ?? "", "Earned stars: 3 of 3") },
            "A chooser opened while the save is pending starts with the earlier earned stars")
        delayed.commands = []
        let savedRaw = delayed.store.prepareNext(latestRaw: nil)!
        delayed.resultsSaved(delayed.store.finishWrite(succeeded: true), id: firstSave)
        expect(delayed.commands.contains { $0["selector"].text == "#lesson-list" && contains($0["value"].text ?? "", "Earned stars: 3 of 3") } &&
            delayed.commands.contains { $0["selector"].text == "#lesson-path" && contains($0["value"].text ?? "", "1 of") },
            "Finishing a delayed save refreshes earned stars and the suggested path in the open chooser")

        let secondSave = delayed.store.enqueueLesson(lessonId: lessonID, stats: completed,
            timestamp: 11000, date: "2026-10-09T12:01:00.000Z")!
        delayed.savingRun[secondSave] = delayed.run
        delayed.run += 1
        delayed.result = entry(75)
        let newerResult = delayed.result.encoded()
        delayed.openDialog("history")
        let earlierRequest = delayed.historyRequest
        expect(delayed.historyDates.list?.count == 1, "History opened during a pending save captures the earlier rows")
        delayed.commands = []
        expect(delayed.store.prepareNext(latestRaw: savedRaw) != nil, "The delayed second result prepares against the first saved result")
        delayed.resultsSaved(delayed.store.finishWrite(succeeded: true), id: secondSave)
        expect(delayed.historyRequest > earlierRequest && delayed.historyDates.list?.count == 2 &&
            delayed.commands.contains { $0["op"].text == "dates" && $0["values"].list?.count == 2 },
            "Finishing a delayed save requests dates for the updated rows in the open History dialog")
        expect(delayed.result.encoded() == newerResult && delayed.savingRun[secondSave] == nil,
            "An older run's save refreshes history without replacing the newer result")

        let cardApplication = SwiftApp()
        cardApplication.settings = cardApplication.store.data["settings"]
        cardApplication.exercise = .object(["title": .string("A completed test"), "keyboardLayout": .string("mac-us")])
        cardApplication.run = 1
        cardApplication.result = entry(40)
        cardApplication.card()
        let oldCard = cardApplication.commands.first { $0["op"].text == "raster" }!
        cardApplication.run += 1
        cardApplication.result = entry(70)
        cardApplication.commands = []
        cardApplication.card()
        let currentCard = cardApplication.commands.first { $0["op"].text == "raster" }!
        func cardCompletion(_ request: JSON, succeeded: Bool) -> JSON {
            .object(["kind": .string("download-result"), "id": request["id"], "run": request["run"], "succeeded": .bool(succeeded)])
        }
        _ = cardApplication.handle(cardCompletion(oldCard, succeeded: true))
        expect(cardApplication.commands.isEmpty && cardApplication.result["wpm"].numeric == 70,
            "An older card completion cannot change the newer result's status or re-enable its pending download")
        _ = cardApplication.handle(cardCompletion(currentCard, succeeded: true))
        expect(cardApplication.commands.contains { $0["selector"].text == "#download-status" && contains($0["value"].text ?? "", "downloaded") } &&
            cardApplication.commands.contains { $0["name"].text == "disabled" && $0["value"].boolean == false },
            "The current card completion still announces success and enables its download action")
        print("Swift history checks passed (\(checks) assertions).")
    }
}
