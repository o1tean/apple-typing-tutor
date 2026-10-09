// Ordered members retain exact Unicode keys; opaque tokens retain unpaired UTF-16.
struct JSONMember {
    var key: String
    var value: JSON
    var rawKey: String? = nil
}

indirect enum JSON {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSON])
    case object([JSONMember])
    case opaque(String)

    static func object(_ values: [String: JSON]) -> JSON {
        .object(values.map { JSONMember(key: $0.key, value: $0.value) })
    }

    var text: String? { if case .string(let value) = self { return value }; return nil }
    var numeric: Double? { if case .number(let value) = self { return value }; return nil }
    var boolean: Bool? { if case .bool(let value) = self { return value }; return nil }
    var list: [JSON]? { if case .array(let value) = self { return value }; return nil }
    var members: [JSONMember] { if case .object(let value) = self { return value }; return [] }
    var isObject: Bool { if case .object = self { return true }; return false }
    var isNull: Bool { if case .null = self { return true }; return false }
    var stringUnits: [UInt16]? {
        if let text { return Array(text.utf16) }
        guard case .opaque(let token) = self, token.utf8.first == 34 else { return nil }
        let bytes = Array(token.utf8)
        var units: [UInt16] = []
        var index = 1
        while index < bytes.count - 1 {
            if bytes[index] == 92 {
                index += 1
                let escape = bytes[index]
                index += 1
                if escape == 117 {
                    let digits = String(decoding: bytes[index..<(index + 4)], as: UTF8.self)
                    units.append(UInt16(digits, radix: 16)!)
                    index += 4
                } else {
                    let controls: [UInt8: UInt16] = [98: 8, 102: 12, 110: 10, 114: 13, 116: 9]
                    units.append(controls[escape] ?? UInt16(escape))
                }
            } else {
                let start = index
                while index < bytes.count - 1 && bytes[index] != 92 { index += 1 }
                units.append(contentsOf: String(decoding: bytes[start..<index], as: UTF8.self).utf16)
            }
        }
        return units
    }

    func prefixString(_ count: Int) -> JSON {
        guard let units = stringUnits else { return .null }
        if units.count <= count { return self }
        let token = "\"" + units.prefix(max(0, count)).map { unit -> String in
            let hex = String(unit, radix: 16)
            return "\\u" + String(repeating: "0", count: 4 - hex.utf8.count) + hex
        }.joined() + "\""
        return JSON.parse(token)!
    }

    func has(_ key: String) -> Bool {
        members.contains { $0.rawKey == nil && $0.key.utf8.elementsEqual(key.utf8) }
    }

    subscript(_ key: String) -> JSON {
        get {
            members.last { $0.rawKey == nil && $0.key.utf8.elementsEqual(key.utf8) }?.value ?? .null
        }
        set {
            var fields = members
            if let index = fields.firstIndex(where: { $0.rawKey == nil && $0.key.utf8.elementsEqual(key.utf8) }) {
                fields[index].value = newValue
            } else {
                fields.append(JSONMember(key: key, value: newValue))
            }
            self = .object(fields)
        }
    }

    mutating func remove(_ key: String) {
        guard isObject else { return }
        self = .object(members.filter { $0.rawKey != nil || !$0.key.utf8.elementsEqual(key.utf8) })
    }

    func encoded() -> String {
        switch self {
        case .null: return "null"
        case .bool(let value): return value ? "true" : "false"
        case .number(let value):
            guard value.isFinite else { return "null" }
            if value == 0 { return "0" }
            if value.rounded(.towardZero) == value && value >= -9_007_199_254_740_991 && value <= 9_007_199_254_740_991 {
                return String(Int64(value))
            }
            return String(value)
        case .string(let value): return JSON.quote(value)
        case .array(let values): return "[" + values.map { $0.encoded() }.joined(separator: ",") + "]"
        case .object(let values):
            return "{" + values.map { ($0.rawKey ?? JSON.quote($0.key)) + ":" + $0.value.encoded() }.joined(separator: ",") + "}"
        case .opaque(let token): return token
        }
    }

    static func quote(_ value: String) -> String {
        var result = "\""
        for scalar in value.unicodeScalars {
            switch scalar.value {
            case 34: result += "\\\""
            case 92: result += "\\\\"
            case 0...31:
                let hex = String(scalar.value, radix: 16)
                result += "\\u" + String(repeating: "0", count: 4 - hex.utf8.count) + hex
            default: result.unicodeScalars.append(scalar)
            }
        }
        return result + "\""
    }

    static func parse(_ text: String) -> JSON? {
        var parser = JSONParser(bytes: Array(text.utf8))
        guard let value = parser.value() else { return nil }
        parser.whitespace()
        return parser.index == parser.bytes.count ? value : nil
    }
}

private struct JSONParser {
    let bytes: [UInt8]
    var index = 0

    mutating func whitespace() {
        while index < bytes.count && [9, 10, 13, 32].contains(bytes[index]) { index += 1 }
    }

    mutating func take(_ byte: UInt8) -> Bool {
        guard index < bytes.count, bytes[index] == byte else { return false }
        index += 1
        return true
    }

    mutating func value(depth: Int = 0) -> JSON? {
        whitespace()
        guard index < bytes.count else { return nil }
        switch bytes[index] {
        case 34: return string()
        case 91:
            // Keep hostile or newer saved structures below the Wasm stack limit.
            guard depth < 128 else { return nil }
            index += 1
            whitespace()
            var values: [JSON] = []
            if take(93) { return .array(values) }
            while let next = value(depth: depth + 1) {
                values.append(next)
                whitespace()
                if take(93) { return .array(values) }
                guard take(44) else { return nil }
            }
            return nil
        case 123:
            guard depth < 128 else { return nil }
            index += 1
            whitespace()
            var object = JSON.object([JSONMember]())
            if take(125) { return object }
            while true {
                whitespace()
                guard index < bytes.count, bytes[index] == 34, let key = string() else { return nil }
                whitespace()
                guard take(58), let next = value(depth: depth + 1) else { return nil }
                if let text = key.text {
                    object[text] = next
                } else if case .opaque(let token) = key {
                    var fields = object.members
                    fields.append(JSONMember(key: token, value: next, rawKey: token))
                    object = .object(fields)
                }
                whitespace()
                if take(125) { return object }
                guard take(44) else { return nil }
            }
        case 110: return literal("null", value: .null)
        case 116: return literal("true", value: .bool(true))
        case 102: return literal("false", value: .bool(false))
        default: return number()
        }
    }

    mutating func literal(_ word: String, value: JSON) -> JSON? {
        let expected = Array(word.utf8)
        guard index + expected.count <= bytes.count,
            bytes[index..<(index + expected.count)].elementsEqual(expected) else { return nil }
        index += expected.count
        return value
    }

    func hex(_ offset: Int) -> UInt32? {
        guard offset + 4 <= bytes.count else { return nil }
        var value: UInt32 = 0
        for byte in bytes[offset..<(offset + 4)] {
            let digit: UInt32
            switch byte {
            case 48...57: digit = UInt32(byte - 48)
            case 65...70: digit = UInt32(byte - 55)
            case 97...102: digit = UInt32(byte - 87)
            default: return nil
            }
            value = value * 16 + digit
        }
        return value
    }

    mutating func string() -> JSON? {
        let start = index
        guard take(34) else { return nil }
        var decoded: [UInt8] = []
        var opaque = false
        while index < bytes.count {
            let byte = bytes[index]
            index += 1
            if byte == 34 {
                if opaque { return .opaque(String(decoding: bytes[start..<index], as: UTF8.self)) }
                return .string(String(decoding: decoded, as: UTF8.self))
            }
            guard byte >= 32 else { return nil }
            if byte != 92 { decoded.append(byte); continue }
            guard index < bytes.count else { return nil }
            let escape = bytes[index]
            index += 1
            switch escape {
            case 34, 47, 92: decoded.append(escape)
            case 98: decoded.append(8)
            case 102: decoded.append(12)
            case 110: decoded.append(10)
            case 114: decoded.append(13)
            case 116: decoded.append(9)
            case 117:
                guard let unit = hex(index) else { return nil }
                index += 4
                var scalar = unit
                if unit >= 0xD800 && unit <= 0xDBFF {
                    if index + 6 <= bytes.count && bytes[index] == 92 && bytes[index + 1] == 117,
                        let low = hex(index + 2), low >= 0xDC00 && low <= 0xDFFF {
                        scalar = 0x10000 + (unit - 0xD800) * 1024 + low - 0xDC00
                        index += 6
                    } else { opaque = true; continue }
                } else if unit >= 0xDC00 && unit <= 0xDFFF {
                    opaque = true
                    continue
                }
                decoded.append(contentsOf: String(Unicode.Scalar(scalar)!).utf8)
            default: return nil
            }
        }
        return nil
    }

    mutating func number() -> JSON? {
        let start = index
        _ = take(45)
        guard index < bytes.count else { return nil }
        if take(48) {
            if index < bytes.count && bytes[index] >= 48 && bytes[index] <= 57 { return nil }
        } else {
            guard bytes[index] >= 49 && bytes[index] <= 57 else { return nil }
            while index < bytes.count && bytes[index] >= 48 && bytes[index] <= 57 { index += 1 }
        }
        if take(46) {
            let digits = index
            while index < bytes.count && bytes[index] >= 48 && bytes[index] <= 57 { index += 1 }
            if index == digits { return nil }
        }
        if take(101) || take(69) {
            if !take(43) { _ = take(45) }
            let digits = index
            while index < bytes.count && bytes[index] >= 48 && bytes[index] <= 57 { index += 1 }
            if index == digits { return nil }
        }
        let token = String(decoding: bytes[start..<index], as: UTF8.self)
        guard let value = Double(token) else { return nil }
        return value.isFinite ? .number(value) : .opaque(token)
    }
}
