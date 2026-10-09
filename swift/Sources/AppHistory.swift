// Browser date parts provide locale and timezone facts; Swift owns all aggregation.
enum HistoryProgress {
    static func dayNumber(_ parts: JSON) -> Int? {
        guard parts["valid"].boolean == true,
              let year = parts["year"].numeric, let month = parts["month"].numeric,
              let day = parts["day"].numeric, year.isFinite, abs(year) < 1_000_000,
              month >= 1, month <= 12, day >= 1, day <= 31 else { return nil }
        // Gregorian civil-day ordinal: local dates remain consecutive across DST.
        let m = Int(month)
        let y = Int(year) - (m <= 2 ? 1 : 0)
        let era = (y >= 0 ? y : y - 399) / 400
        let yearOfEra = y - era * 400
        let dayOfYear = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + Int(day) - 1
        return era * 146097 + yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear - 719468
    }

    static func dayKey(_ parts: JSON) -> String {
        func padded(_ value: Double, count: Int) -> String {
            let digits = Practice.number(value)
            return String(repeating: "0", count: max(0, count - digits.count)) + digits
        }
        return padded(parts["year"].numeric ?? 0, count: 4) + "-" + padded(parts["month"].numeric ?? 0, count: 2) + "-" + padded(parts["day"].numeric ?? 0, count: 2)
    }

    static func elapsed(_ entry: JSON) -> Double? {
        if !entry["elapsedMilliseconds"].isNull { return entry["elapsedMilliseconds"].numeric }
        return entry["elapsedSeconds"].numeric.map { $0 * 1000 }
    }

    static func summary(entries: [JSON], dates: [JSON], days: [JSON], now: Double) -> JSON {
        struct Totals {
            var sessions = 0
            var measured = 0
            var wpm = 0.0
            var accuracy = 0.0
        }
        var activity: [Int: Totals] = [:]
        for (index, entry) in entries.enumerated() {
            guard entry["date"].text != nil, index < dates.count,
                  let epoch = dates[index]["epoch"].numeric, epoch.isFinite, epoch <= now,
                  let day = dayNumber(dates[index]) else { continue }
            var totals = activity[day] ?? Totals()
            totals.sessions += 1
            if entry["wpmMetric"].text == "words-v1",
               let elapsed = elapsed(entry), elapsed.isFinite, elapsed > 0,
               let wpm = entry["wpm"].numeric, wpm.isFinite, wpm >= 0,
               let accuracy = entry["accuracy"].numeric, accuracy.isFinite, accuracy >= 0, accuracy <= 100 {
                totals.measured += 1
                totals.wpm += wpm
                totals.accuracy += accuracy
            }
            activity[day] = totals
        }
        var streak = 0
        var longest = 0
        var previous: Int? = nil
        for day in activity.keys.sorted() {
            streak = previous.map { day == $0 + 1 } == true ? streak + 1 : 1
            longest = max(longest, streak)
            previous = day
        }
        let today = days.last.flatMap(dayNumber)
        let current = previous != nil && today != nil && previous! >= today! - 1 ? streak : 0
        let daily: [JSON] = days.map { date in
            let totals = dayNumber(date).flatMap { activity[$0] } ?? Totals()
            return .object([
                "date": .string(dayKey(date)), "label": date["label"],
                "sessions": .number(Double(totals.sessions)),
                "measuredSessions": .number(Double(totals.measured)),
                "wpm": totals.measured > 0 ? .number(totals.wpm / Double(totals.measured)) : .null,
                "accuracy": totals.measured > 0 ? .number(totals.accuracy / Double(totals.measured)) : .null
            ])
        }
        return .object(["days": .array(daily), "currentStreak": .number(Double(current)), "longestStreak": .number(Double(longest))])
    }

    static func chart(days: [JSON], metric: String, label: String, maximum: Double, unit: String = "") -> String {
        guard !days.isEmpty else { return "" }
        let ceiling = Practice.number(maximum)
        var value = "<div class=\"chart\"><h4>\(label)</h4><div class=\"chart-grid\"><div class=\"chart-y-axis\" aria-hidden=\"true\"><span>\(ceiling)\(unit)</span><span>0\(unit)</span></div>"
        value += "<svg viewBox=\"0 0 100 100\" preserveAspectRatio=\"none\" role=\"img\" aria-label=\"\(label) daily averages. Vertical axis: 0 to \(ceiling)\(unit).\" aria-describedby=\"progress-description\" focusable=\"false\">"
        for y in [0, 100] { value += "<line x1=\"0\" x2=\"100\" y1=\"\(y)\" y2=\"\(y)\"></line>" }
        func point(_ index: Int, _ score: Double) -> String {
            let x = Double(index) / Double(max(1, days.count - 1)) * 100
            return "\(Practice.number(x)),\(Practice.number(100 - score / maximum * 100))"
        }
        for (index, day) in days.enumerated() {
            guard let score = day[metric].numeric else { continue }
            let position = point(index, score)
            if index > 0, let before = days[index - 1][metric].numeric {
                value += "<polyline points=\"\(point(index - 1, before)) \(position)\" vector-effect=\"non-scaling-stroke\"></polyline>"
            }
            let coordinates = Practice.replace(position, ",", " ")
            value += "<path d=\"M\(coordinates)l0 0\" stroke=\"var(--accent)\" stroke-width=\"5\" stroke-linecap=\"round\" vector-effect=\"non-scaling-stroke\"><title>\(Guides.escaped(day["label"].text ?? "")): \(Practice.decimal(score))\(unit)</title></path>"
        }
        value += "</svg><div class=\"chart-x-axis\" aria-hidden=\"true\"><span>\(Guides.escaped(days.first?["label"].text ?? ""))</span><span>\(Guides.escaped(days.last?["label"].text ?? ""))</span></div></div></div>"
        return value
    }

    static func render(_ progress: JSON) -> String {
        let days = progress["days"].list ?? []
        let measuredDays = days.filter { ($0["measuredSessions"].numeric ?? 0) > 0 }.count
        var value = "<section class=\"practice-progress\" aria-label=\"Practice progress\"><dl class=\"progress-streaks\">"
        for (label, key) in [("Current streak", "currentStreak"), ("Longest saved streak", "longestStreak")] {
            let count = progress[key].numeric ?? 0
            value += "<div><dt>\(label)</dt><dd>\(Practice.number(count)) <small>\(count == 1 ? "day" : "days")</small></dd></div>"
        }
        value += "</dl><p class=\"field-help\">Consecutive local days with a recorded session. Your current streak stays active if you practiced today or yesterday. Based on retained sessions; older activity may be missing.</p><h3>Last 14 days</h3><p class=\"field-help\" id=\"progress-description\">Daily session averages across all exercises and input modes. Gaps mean no measured session with current scoring; they are not zero scores.</p>"
        if measuredDays > 0 {
            let maximum = max(20, ((days.compactMap { $0["wpm"].numeric }.max() ?? 0) / 10).rounded(.up) * 10)
            value += "<div class=\"progress-charts\">" + chart(days: days, metric: "wpm", label: "WPM", maximum: maximum) + chart(days: days, metric: "accuracy", label: "Accuracy", maximum: 100, unit: "%") + "</div>"
        } else { value += "<p class=\"field-help\">Finish a session with measured typing time to see daily averages.</p>" }
        if measuredDays == 1 { value += "<p class=\"field-help\">One day of measured scores; no trend yet.</p>" }
        value += "<details><summary>View daily averages</summary><table><caption>Daily practice · local dates</caption><thead><tr><th scope=\"col\">Date</th><th scope=\"col\">Sessions</th><th scope=\"col\">WPM</th><th scope=\"col\">Accuracy</th></tr></thead><tbody>"
        for day in days {
            value += "<tr><th scope=\"row\"><time datetime=\"\(Guides.escaped(day["date"].text ?? ""))\">\(Guides.escaped(day["label"].text ?? ""))</time></th><td>\(Practice.number(day["sessions"].numeric ?? 0))</td><td>\(day["wpm"].numeric.map { Practice.decimal($0) } ?? "—")</td><td>\(day["accuracy"].numeric.map { Practice.decimal($0) + "%" } ?? "—")</td></tr>"
        }
        return value + "</tbody></table></details></section>"
    }
}

extension SwiftApp {
    func dayKey(_ parts: JSON) -> String { HistoryProgress.dayKey(parts) }

    func requestHistory() {
        historyRequest += 1
        let entries = store.data["history"].list ?? []
        // Capture the rows associated with this asynchronous date conversion.
        historyDates = .array(entries)
        cmd("dates", ["id": .number(Double(historyRequest)), "values": .array(entries.map { $0["date"] }), "offsets": .array((-13...0).map { .number(Double($0)) })])
    }

    func history(_ event: JSON) {
        guard Int(n(event, "id")) == historyRequest else { return }
        let entries = historyDates.list ?? []
        let dates = event["values"].list ?? []
        if entries.isEmpty {
            html("#history-content", "<div class=\"empty-state\"><h3>Your first session is waiting.</h3><p>Finish a lesson or test to start tracking your progress.</p>" + button("close", "Let's type", primary: true) + "</div>")
            return
        }
        let progress = HistoryProgress.summary(entries: entries, dates: dates, days: event["offsets"].list ?? [], now: epoch)
        var value = HistoryProgress.render(progress)
        value += "<p class=\"field-help\">Earlier scores keep their original values. Personal bests compare scores using the same method.</p><div class=\"history-table\"><table><caption>Last \(entries.count) sessions · \(store.saveFailed ? "saving unavailable" : "stored on this device")</caption><thead><tr><th scope=\"col\">test</th><th scope=\"col\">wpm / raw</th><th scope=\"col\">accuracy</th><th scope=\"col\">time</th><th scope=\"col\">date</th></tr></thead><tbody>"
        for (index, entry) in entries.enumerated() {
            value += "<tr><th scope=\"row\">\(e(Practice.sessionLabel(entry)))"
            if let reason = entry["recordReason"].text, !reason.isEmpty { value += "<small class=\"history-note\">\(e(reason))</small>" }
            value += "</th><td>\(num(n(entry, "wpm"))) / \(entry["rawWpm"].numeric.map(num) ?? "—")<small class=\"history-note\">\(s(entry, "wpmMetric") == "words-v1" ? "Correct-word scoring" : "Earlier scoring")</small></td><td>\(num(n(entry, "accuracy")))%</td><td>\(HistoryProgress.elapsed(entry).map(Practice.formatElapsedTime) ?? "—")</td><td>"
            if let date = entry["date"].text, !date.isEmpty {
                let label = index < dates.count ? s(dates[index], "label", date) : date
                value += "<time datetime=\"\(e(date))\">\(e(label))</time>"
            } else { value += "—" }
            value += "</td></tr>"
        }
        html("#history-content", value + "</tbody></table></div>")
    }
}
