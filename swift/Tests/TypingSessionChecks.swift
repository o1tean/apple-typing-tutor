// Run with: swiftc swift/Sources/TypingSession.swift swift/Tests/TypingSessionChecks.swift -o /tmp/typeflow-swift-checks
// Then run /tmp/typeflow-swift-checks. This suite needs only the Swift standard library.

@main
struct TypingSessionChecks {
    static func expect(_ condition: Bool, _ message: String) {
        precondition(condition, message)
    }

    static func type(_ text: String, into session: TypingSession, now: Double) {
        for scalar in text.unicodeScalars { session.key(scalar: scalar.value, now: now) }
    }

    static func observation(_ value: LearningObservation?, attempts: Int, errors: Int,
        samples: Int, milliseconds: Double) {
        expect(value?.attempts == attempts && value?.errors == errors &&
            value?.latencySamples == samples && value?.latencyTotalMs == milliseconds,
            "Learning observation must preserve target counts and measured reach")
    }

    static func main() {
        let session = TypingSession()
        session.initialize(lines: ["", "a😀b", ""], mode: "strict", duration: 0)
        expect(session.cells.count == 3 && session.status == "idle", "Use Unicode scalar cells")
        session.delete(word: false, now: 0)
        expect(!session.isRunning, "Deletion cannot start a session")
        type("x", into: session, now: 0)
        expect(session.currentIndex == 0, "Guided mistakes hold their target")
        type("a😀b", into: session, now: 100)
        expect(session.isComplete && session.stats(now: 100).accuracy == 75, "Unicode completion")
        type("x", into: session, now: 1000)
        expect(session.totalKeystrokes == 4 && session.stats(now: 1000).elapsedMilliseconds == 100,
            "Completed sessions reject input and freeze time")

        session.initialize(lines: ["a\u{301}b"], mode: "strict", duration: 0)
        expect(session.cells.count == 3, "Combining marks stay separate from their base scalar")
        type("a\u{301}b", into: session, now: 0)
        expect(session.isComplete, "Combining scalar completion")
        session.initialize(lines: ["ÅÅx"], mode: "strict", duration: 0)
        type("xÅxÅ", into: session, now: 10)
        expect(session.errorsByChar[0xC5] == 1 && session.errorsByChar[0x212B] == 1,
            "Canonically equivalent scalar targets retain separate error keys")

        session.initialize(lines: ["abc"], mode: "flow", duration: 0)
        type("a", into: session, now: 0)
        session.delete(word: false, now: 0)
        type("ax", into: session, now: 0)
        session.delete(word: false, now: 0)
        type("b", into: session, now: 0)
        let corrected = session.stats(now: 300)
        expect(session.netCorrectChars == 2 && session.netTypedChars == 2 &&
            corrected.correctNonSpaceChars == 2 && corrected.correctKeystrokes == 3,
            "Deletion changes retained input, not historical correct attempts")
        expect(corrected.accuracy == 75 && corrected.wpm == 80 && corrected.rawWpm == 80,
            "Corrected input cannot inflate speed or erase errors")

        session.initialize(lines: ["ab"], mode: "strict", duration: 0)
        type("xxa", into: session, now: 0)
        expect(session.netTypedChars == 1 && session.stats(now: 100).accuracy == 33.3,
            "Strict retries replace one retained slot")
        type("x", into: session, now: 100)
        expect(session.stats(now: 60_000).cpm == 1, "Strict errors preserve the accepted prefix")

        session.initialize(lines: ["cat dog fox"], mode: "flow", duration: 0)
        type("c ", into: session, now: 0)
        expect(session.currentScalar == 100 && session.skippedChars == 2 &&
            session.errorKeystrokes == 0 && session.netTypedChars == 2 &&
            session.stats(now: 1).accuracy == 50, "Early Space counts missing targets separately")
        session.delete(word: false, now: 0)
        expect(session.currentIndex == 1, "Short words reopen at the end of actual input")
        type("at dog ", into: session, now: 100)
        let boundary = session.currentIndex
        session.delete(word: false, now: 100)
        expect(session.currentIndex == boundary && session.stats(now: 100).accuracy == 81.8 &&
            session.correctNonSpaceChars == 6 && session.skippedChars == 2,
            "Clean words lock while repaired skips remain historical errors")

        session.initialize(lines: ["cat"], mode: "flow", duration: 0)
        type("c ", into: session, now: 0)
        expect(session.isComplete && session.netTypedChars == 1 && session.netCorrectChars == 1 &&
            session.errorKeystrokes == 1 && session.skippedChars == 2,
            "Final submission Space cannot invent a separator or raw input")

        session.initialize(lines: ["cat dog"], mode: "flow", duration: 0)
        type("cat doxs", into: session, now: 0)
        expect(!session.isComplete && session.cells.last!.extra, "Incorrect final word allows overflow")
        session.delete(word: false, now: 0)
        session.delete(word: false, now: 0)
        type("g", into: session, now: 100)
        expect(session.isComplete && session.cells.count == 7 && session.errorKeystrokes == 2,
            "Deleting overflow restores targets and correcting the last word finishes")
        expect(session.missedWords == ["dog"], "Overflow and correction retain the original target word once")

        session.initialize(lines: ["cat dog"], mode: "strict", duration: 0)
        type("xxcat xdog", into: session, now: 100)
        expect(session.stats(now: 100).missedWords == ["cat", "dog"],
            "Guided missed words keep first-error order and deduplicate retries")
        session.initialize(lines: ["cat", "dog"], mode: "flow", duration: 0)
        type("c dox ", into: session, now: 100)
        expect(session.isComplete && session.missedWords == ["cat", "dog"],
            "Skipped and incorrect words are captured before line transitions")
        session.initialize(lines: ["cat dog"], mode: "flow", duration: 0)
        type("cats dog", into: session, now: 100)
        expect(session.missedWords == ["cat"], "Missed words exclude extra typed scalars")

        session.initialize(lines: ["cat dog fox"], mode: "flow", duration: 0)
        type("cxt ", into: session, now: 0)
        session.delete(word: true, now: 0)
        expect(session.currentIndex == 0 && session.netCorrectChars == 0 && session.errorKeystrokes == 1,
            "Word deletion reopens an incorrect previous word without losing its history")
        type("ca", into: session, now: 0)
        session.delete(word: true, now: 0)
        expect(session.currentIndex == 0 && session.netTypedChars == 0, "Word deletion clears current input")

        let creditCases: [([String], String, Double, Int)] = [
            (["cat dog"], "cat dog", 7, 7), (["cat dog"], "cat dox ", 4, 7),
            (["cat dog"], "cxt dog", 3, 7), (["cat dog"], "cats dog", 3, 8),
            (["cat dog"], "c dog", 3, 5), (["cat dog"], "xxx xxx ", 0, 7),
            (["cat dog"], "  ", 0, 1), (["cat dog"], "cat d", 5, 5),
            (["cat dog"], "cat x", 4, 5), (["cat dog"], "cat", 3, 3),
            (["cat  dog"], "cat  dog", 8, 8), (["  cat dog "], "  cat dog ", 10, 10),
            (["😀a b"], "😀a b", 4, 4), (["cat", "dog"], "cat dog", 7, 7),
            (["cat", "dog"], "cxt dog", 3, 7), (["cat", "dog"], " dog", 3, 4),
            (["cat ", "dog"], "cat dog", 7, 7)
        ]
        for (lines, input, credit, retained) in creditCases {
            session.initialize(lines: lines, mode: "flow", duration: 0)
            let scalars = Array(input.unicodeScalars)
            session.key(scalar: scalars[0].value, now: 0)
            for scalar in scalars.dropFirst() { session.key(scalar: scalar.value, now: 60_000) }
            let measured = session.stats(now: 60_000)
            expect(measured.wpmMetric == "words-v1" && measured.cpm == credit &&
                measured.wpm == (credit / 5).rounded() && session.netTypedChars == retained &&
                measured.rawWpm == (Double(retained) / 5).rounded(), "Clean-word credit: " + input)
        }

        session.initialize(lines: ["cat dog"], mode: "flow", duration: 0)
        type("c", into: session, now: 0)
        type("xt ", into: session, now: 60_000)
        expect(session.stats(now: 60_000).cpm == 0, "Dirty word has no credit")
        for _ in 0..<3 { session.delete(word: false, now: 60_000) }
        expect(session.stats(now: 60_000).cpm == 1, "Reopened clean prefix regains credit")
        type("at dog", into: session, now: 60_000)
        expect(session.stats(now: 60_000).cpm == 7 && session.stats(now: 60_000).accuracy == 90,
            "Corrected word regains all credit without erasing historical errors")

        session.initialize(lines: ["hi", "no"], mode: "flow", duration: 120)
        type("h", into: session, now: 0)
        type("i no ", into: session, now: 60_000)
        expect(session.currentLine == 0 && session.stats(now: 60_000).cpm == 6,
            "Timed pools loop and bank virtual separators exactly once")
        type("hx ", into: session, now: 60_000)
        expect(session.stats(now: 60_000).cpm == 6, "A dirty line separator earns no word credit")

        for mode in ["strict", "flow"] {
            session.initialize(lines: ["ab", "cd"], mode: mode, duration: 15)
            type(mode == "flow" ? "ab cd " : "abcd", into: session, now: 0)
            expect(!session.isComplete && session.currentLine == 0, "Timed pools do not finish early")
            session.pause(now: 1000)
            let count = session.totalKeystrokes
            type("a", into: session, now: 21_000)
            expect(session.stats(now: 21_000).elapsedMilliseconds == 1000 &&
                session.totalKeystrokes == count, "Pause excludes time and input")
            session.resume(now: 21_000)
            type("a", into: session, now: 35_250)
            let measured = session.stats(now: 90_000)
            expect(session.isComplete && session.totalKeystrokes == count &&
                measured.elapsedMilliseconds == 15_000 && measured.timeRemaining == 0,
                "Deadline is checked before input and elapsed time is clamped and frozen")
        }
        session.initialize(lines: ["abc"], mode: "flow", duration: 1)
        type("a", into: session, now: 0)
        session.delete(word: false, now: 1000)
        expect(session.isComplete && session.currentIndex == 1, "Deadline also precedes deletion")

        session.initialize(lines: ["ab"], mode: "strict", duration: 0)
        type("a", into: session, now: 0)
        expect(session.stats(now: 0).wpm == 0, "Zero measured time has zero speed")
        type("b", into: session, now: 125)
        let quick = session.stats(now: 60_000)
        expect(quick.elapsedSeconds == 0 && quick.elapsedMilliseconds == 125 &&
            quick.wpm == 192 && quick.rawWpm == 192 && quick.cpm == 960,
            "Subsecond attempts use precise duration despite rounded-zero display seconds")

        let rhythmCases: [([Double], Double?)] = [
            ([], nil), ([0], nil), ([0, 1, 1000, 1, 1000, 1], nil),
            ([0, 100, 100, 100, 100, 100, 100], 100),
            ([0, 1, 1000, 1, 1000, 1, 1000], 55), ([0, 0, 0, 0, 0, 0, 0], nil)
        ]
        for (delays, expected) in rhythmCases {
            session.initialize(lines: ["abcdefg"], mode: "strict", duration: 0)
            var now: Double = 0
            for (index, delay) in delays.enumerated() {
                now += delay
                session.key(scalar: 97 + UInt32(index), now: now)
            }
            expect(session.stats(now: now).consistency == expected, "Measured rhythm consistency")
        }
        session.initialize(lines: ["abcdefgh"], mode: "strict", duration: 0)
        type("a", into: session, now: 0)
        type("b", into: session, now: 1)
        type("c", into: session, now: 1001)
        session.pause(now: 1001)
        session.resume(now: 21_001)
        type("d", into: session, now: 21_101)
        expect(session.keystrokeIntervals == [1, 1000], "First resumed key adds no rhythm interval")

        session.initialize(lines: ["ab c"], mode: "strict", duration: 0)
        type("a", into: session, now: 100)
        type("x", into: session, now: 220)
        type("b", into: session, now: 300)
        type(" ", into: session, now: 340)
        session.pause(now: 400)
        type("c", into: session, now: 10_000)
        session.resume(now: 10_000)
        type("c", into: session, now: 10_040)
        let learning = session.stats(now: 10_040).learning
        observation(learning.keys["a"], attempts: 1, errors: 0, samples: 0, milliseconds: 0)
        observation(learning.keys["b"], attempts: 2, errors: 1, samples: 2, milliseconds: 200)
        observation(learning.bigrams["ab"], attempts: 2, errors: 1, samples: 2, milliseconds: 200)
        observation(learning.keys[" "], attempts: 1, errors: 0, samples: 1, milliseconds: 40)
        observation(learning.bigrams[" c"], attempts: 1, errors: 0, samples: 0, milliseconds: 0)
        expect(learning.keys["x"] == nil, "Learning uses expected targets, not incorrect physical keys")

        session.initialize(lines: ["ab"], mode: "flow", duration: 0)
        type("a", into: session, now: 20_000)
        type("x", into: session, now: 20_100)
        session.delete(word: false, now: 21_000)
        type("b", into: session, now: 21_200)
        observation(session.learning.keys["b"], attempts: 2, errors: 1, samples: 1, milliseconds: 100)
        observation(session.learning.bigrams["ab"], attempts: 2, errors: 1, samples: 1, milliseconds: 100)
        expect(session.learning.bigrams["bb"] == nil, "Correction restores the intended pair")

        session.initialize(lines: ["abc def"], mode: "flow", duration: 0)
        type("a", into: session, now: 22_000)
        type(" ", into: session, now: 22_150)
        type("d", into: session, now: 22_250)
        observation(session.learning.keys["b"], attempts: 1, errors: 1, samples: 1, milliseconds: 150)
        observation(session.learning.keys["c"], attempts: 1, errors: 1, samples: 0, milliseconds: 0)
        observation(session.learning.keys[" "], attempts: 1, errors: 0, samples: 0, milliseconds: 0)
        observation(session.learning.bigrams[" d"], attempts: 1, errors: 0, samples: 1, milliseconds: 100)
        let savedSnapshot = session.stats(now: 22_250)
        type("e", into: session, now: 22_350)
        expect(savedSnapshot.learning.keys["e"] == nil, "Returned learning snapshots are independent values")

        session.initialize(lines: ["ab", "cd"], mode: "flow", duration: 0)
        for (index, scalar) in "ab cd".unicodeScalars.enumerated() {
            session.key(scalar: scalar.value, now: 23_000 + Double(index) * 100)
        }
        observation(session.learning.bigrams["b "], attempts: 1, errors: 0, samples: 1, milliseconds: 100)
        observation(session.learning.bigrams[" c"], attempts: 1, errors: 0, samples: 1, milliseconds: 100)
        expect(session.learning.bigrams["bc"] == nil, "Flow line pairs include the actual typed separator")

        session.initialize(lines: ["A!市bc"], mode: "strict", duration: 0)
        for (index, scalar) in "A!市bc".unicodeScalars.enumerated() {
            session.key(scalar: scalar.value, now: 30_000 + Double(index) * 100)
        }
        observation(session.learning.keys["a"], attempts: 1, errors: 0, samples: 0, milliseconds: 0)
        observation(session.learning.bigrams["a!"], attempts: 1, errors: 0, samples: 1, milliseconds: 100)
        observation(session.learning.keys["b"], attempts: 1, errors: 0, samples: 0, milliseconds: 0)
        observation(session.learning.bigrams["bc"], attempts: 1, errors: 0, samples: 1, milliseconds: 100)
        expect(session.learning.bigrams["!b"] == nil, "Non-ASCII targets break pairs and reach timing")

        session.initialize(lines: [""], mode: "strict", duration: .nan)
        expect(session.isComplete && session.timedDuration == 0 && session.learning.keys.isEmpty &&
            session.stats(now: 40_000).elapsedMilliseconds == 0, "Empty exercises complete without stale state")
        session.reset()
        expect(session.status == "idle" && session.cells.isEmpty && session.totalKeystrokes == 0 &&
            session.missedWords.isEmpty,
            "Reset clears session state")
        print("Swift session checks passed: Unicode scalars, editing, clean-word scoring, deadlines, pauses, consistency and learning.")
    }
}
