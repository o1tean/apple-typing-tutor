// Rendering and guide state live in Swift; the catalog contains static geometry only.
enum Guides {
    static func escaped(_ text: String) -> String {
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

    static func rows(_ layout: JSON) -> [[JSON]] {
        (1...5).map { layout["rows"]["row\($0)"].list ?? [] }
    }

    static func keyMeasurements(_ learning: JSON, preset: String = "mac-us") -> JSON {
        let codes = Practice.layout(preset)["charToCode"]
        var result: JSON = .object([:])
        for member in learning["keys"].members {
            guard let code = codes[member.key].text else { continue }
            var combined = result[code]
            if !combined.isObject { combined = .object([:]) }
            for field in ["attempts", "errors", "latencySamples", "latencyTotalMs"] {
                combined[field] = .number((combined[field].numeric ?? 0) + (member.value[field].numeric ?? 0))
            }
            result[code] = combined
        }
        return result
    }

    static func renderKeyboard(preset: String = "mac-us", target: String? = nil, pressed: Set<String> = [], caps: Bool = false, learning: JSON? = nil) -> String {
        let layout = Practice.layout(preset)
        let targetCode = target.flatMap { layout["charToCode"][$0].text }
        let finger = target.map { layout["fingerMap"][$0] } ?? .null
        let shiftCode = finger["shift"].boolean == true ? (finger["hand"].text == "left" ? "ShiftRight" : "ShiftLeft") : nil
        let measurements = learning.map { keyMeasurements($0, preset: preset) } ?? .null
        var html = "<div class=\"magic-keyboard\">"
        for row in rows(layout) {
            html += "<div class=\"keyboard-row\">"
            for key in row {
                let width = Practice.number(key["width"].numeric ?? 1)
                guard let code = key["code"].text else {
                    html += "<div class=\"keyboard-spacer\" style=\"flex:\(width) 0 0\"></div>"
                    continue
                }
                var classes = ["magic-key"]
                if let special = key["special"].text { classes.append("key-" + special) }
                if key["isoStem"].numeric != nil { classes.append("key-iso-enter") }
                if code == targetCode {
                    classes.append("key-target")
                    if let name = finger["finger"].text { classes.append("finger-" + name) }
                }
                if code == shiftCode { classes.append("key-shift-target") }
                if pressed.contains(code) { classes.append("key-pressed") }
                if code == "CapsLock" && caps { classes.append("caps-active") }
                let cell = measurements[code]
                var style = "flex:\(width) 0 0"
                var title = ""
                if learning != nil {
                    let attempts = cell["attempts"].numeric ?? 0
                    if attempts > 0 {
                        classes.append("key-measured")
                        let errors = cell["errors"].numeric ?? 0
                        let rate = errors / attempts
                        style += ";--key-heat:var(--\(rate > 0 ? "error" : "accent"));--key-heat-strength:\(rate > 0 ? Practice.decimal(12 + rate * 30, places: 0) : "22")%"
                        let samples = cell["latencySamples"].numeric ?? 0
                        let reach = samples > 0 ? Practice.decimal((cell["latencyTotalMs"].numeric ?? 0) / samples, places: 0) + " ms average reach" : "reach not measured"
                        let label = code == "Space" ? "Space" : key["label"].text ?? ""
                        title = "\(label): \(Practice.number(errors)) \(errors == 1 ? "error" : "errors") · \(Practice.number(attempts)) attempts · \(reach)"
                    } else { title = "Not tried in this session" }
                }
                html += "<div class=\"\(classes.joined(separator: " "))\" data-code=\"\(escaped(code))\" style=\"\(style)\"\(learning == nil ? "" : " title=\"\(escaped(title))\"")>"
                if let stem = key["isoStem"].numeric {
                    let start = Practice.number(1 - stem)
                    html += "<svg class=\"iso-enter-outline\" viewBox=\"0 0 1 1\" preserveAspectRatio=\"none\" aria-hidden=\"true\"><polygon points=\"0,0 1,0 1,1 \(start),1 \(start),0.5 0,0.5\" vector-effect=\"non-scaling-stroke\"></polygon></svg>"
                }
                if key["bump"].boolean == true { html += "<span class=\"tactile-bump\"></span>" }
                if code == "CapsLock" { html += "<span class=\"caps-led\"></span>" }
                html += "<div class=\"key-labels\">"
                if let shift = key["shiftLabel"].text, !shift.isEmpty { html += "<span class=\"key-shift-label\">\(escaped(shift))</span>" }
                html += "<span class=\"key-main-label\">\(escaped(key["label"].text ?? ""))</span>"
                if let sublabel = key["sublabel"].text { html += "<span class=\"key-sub-label\">\(escaped(sublabel))</span>" }
                html += "</div></div>"
            }
            html += "</div>"
        }
        return html + "</div>"
    }

    static func positions(_ layout: JSON) -> [String: (row: Int, x: Double)] {
        var result: [String: (row: Int, x: Double)] = [:]
        for (index, row) in rows(layout).enumerated() {
            let width = row.reduce(0.0) { $0 + ($1["width"].numeric ?? 1) }
            var offset = 0.0
            for key in row {
                let keyWidth = key["width"].numeric ?? 1
                if let code = key["code"].text { result[code] = (index, (offset + keyWidth / 2) / width) }
                offset += keyWidth
            }
        }
        return result
    }

    static func restHint(preset: String = "mac-us") -> String {
        let home = Practice.characters((Practice.layout(preset)["homeKeys"].text ?? "").uppercased())
        return "Rest your fingers on \(home.prefix(4).joined(separator: " ")) and \(home.suffix(4).joined(separator: " "))"
    }

    static func fingerHint(preset: String = "mac-us", target: String? = nil) -> String {
        guard let char = target, !char.isEmpty else { return restHint(preset: preset) }
        let layout = Practice.layout(preset)
        let finger = layout["fingerMap"][char]
        guard let name = finger["finger"].text, let code = layout["charToCode"][char].text,
              let position = positions(layout)[code] else { return "Type “\(char)”" }
        let row = name == "thumb" ? "space" : ["number", "upper", "home", "lower", "space"][position.row]
        let reach = row == "space" ? "press Space" : row == "home" ? (["KeyG", "KeyH"].contains(code) ? "reach inward" : "home row") : "reach \(row) row"
        let display = char == " " ? "Space" : "\"\(char)\""
        let shift = finger["shift"].boolean == true ? " (+ \(finger["hand"].text == "left" ? "Right" : "Left") Shift)" : ""
        return "\(name == "thumb" ? "Either thumb" : finger["label"].text ?? "") · \(display) · \(reach)\(shift)"
    }

    static func renderHands(preset: String = "mac-us", target: String? = nil) -> String {
        let layout = Practice.layout(preset)
        var html = layout["handsHTML"].text ?? ""
        let rest = restHint(preset: preset)
        html = Practice.replace(html, ">\(rest)</p>", ">\(escaped(fingerHint(preset: preset, target: target)))</p>")
        guard let char = target, let name = layout["fingerMap"][char]["finger"].text,
              let hand = layout["fingerMap"][char]["hand"].text,
              let code = layout["charToCode"][char].text else { return html }
        let positions = positions(layout)
        let home = Practice.characters((layout["homeKeys"].text ?? "").uppercased())
        func reach(_ hand: String, _ name: String, _ code: String, shift: Bool = false) {
            let fingers = ["pinky", "ring", "middle", "index", "thumb"]
            guard let index = fingers.firstIndex(of: name), let position = positions[code] else { return }
            let letters = (hand == "left" ? Array(home.prefix(4)) : Array(home.suffix(4).reversed())) + ["␣"]
            let letter = letters[index]
            let homePosition = positions[layout["charToCode"][letter.lowercased()].text ?? ""]
            let row = shift ? "shift" : name == "thumb" ? "space" : ["number", "upper", "home", "lower", "space"][position.row]
            let angle = shift ? -28.0 : name == "thumb" ? 12.0 : max(-30, min(30, (position.x - (homePosition?.x ?? position.x)) * 160 * (hand == "left" ? 1 : -1)))
            let scale = shift ? 0.76 : name == "thumb" ? 0.9 : [1.38, 1.24, 0.94, 0.8, 0.9][position.row]
            let tag = shift ? "⇧" : char == " " ? "␣" : char
            let marker = "<g id=\"finger-\(hand)-\(name)\""
            guard let range = substringRange(html, marker), let end = substringRange(html, "</g>", from: range.upperBound) else { return }
            let whole = range.lowerBound..<end.upperBound
            let original = String(html[whole])
            var active = Practice.replace(original, "class=\"finger-pill\"", "class=\"finger-pill \(shift ? "shift-active" : "active") accent-\(name)\" style=\"--reach-angle:\(Practice.number(angle))deg;--reach-scale:\(Practice.number(scale))\" data-reach-row=\"\(row)\" data-target-key=\"\(escaped(shift ? "Shift" : char))\"")
            active = Practice.replace(active, ">\(letter)</text>", ">\(escaped(tag))</text>")
            html.replaceSubrange(whole, with: active)
        }
        if layout["fingerMap"][char]["shift"].boolean == true {
            reach(hand == "left" ? "right" : "left", "pinky", hand == "left" ? "ShiftRight" : "ShiftLeft", shift: true)
        }
        for side in name == "thumb" ? ["left", "right"] : [hand] { reach(side, name, code) }
        return html
    }

    static func substringRange(_ text: String, _ search: String, from start: String.Index? = nil) -> Range<String.Index>? {
        guard !search.isEmpty else { return nil }
        var index = start ?? text.startIndex
        while index < text.endIndex {
            if text[index...].hasPrefix(search) {
                return index..<text.index(index, offsetBy: search.count)
            }
            index = text.index(after: index)
        }
        return nil
    }
}
