/** Typeflow lessons progress from home-row control to the full keyboard. */

import { WORDS, QUOTES } from './content.js';

export const CURRICULUM = {
    amateur: [
        {
            id: "amat-intro",
            title: "Basic Position",
            subtitle: "Home Row Foundations",
            description: "Learn the resting position for your 8 fingers. Rest your left fingers on A S D F and right fingers on J K L ;. Feel the tactile bumps on F and J.",
            keysIntroduced: ["a", "s", "d", "f", "j", "k", "l", ";", " "],
            targetWpm: 15,
            targetAccuracy: 95
    },
        {
            id: "amat-1",
            title: "Lesson 1: Left Hand Home",
            subtitle: "Keys: A S D F",
            description: "Focus on your left hand resting position: Pinky (A), Ring (S), Middle (D), Index (F), and Thumb on Space.",
            keysIntroduced: ["a", "s", "d", "f", " "],
            targetWpm: 20,
            targetAccuracy: 96
    },
        {
            id: "amat-2",
            title: "Lesson 2: Right Hand Home",
            subtitle: "Keys: J K L ;",
            description: "Train your right hand resting position: Index (J), Middle (K), Ring (L), Pinky (;), and Thumb on Space.",
            keysIntroduced: ["j", "k", "l", ";", " "],
            targetWpm: 20,
            targetAccuracy: 96
    },
        {
            id: "amat-3",
            title: "Lesson 3: Home Row Words",
            subtitle: "Combining Left & Right Home Rows",
            description: "Combine both hands on the home row to form real words without moving your hands away from basic position.",
            keysIntroduced: ["a", "s", "d", "f", "j", "k", "l", ";"],
            targetWpm: 25,
            targetAccuracy: 97
    },
        {
            id: "amat-4",
            title: "Lesson 4: Inner Reach (G & H)",
            subtitle: "Stretching Index Fingers",
            description: "Extend your left index finger rightward to G, and right index finger leftward to H. Always return to F and J.",
            keysIntroduced: ["g", "h"],
            targetWpm: 25,
            targetAccuracy: 96
    },
        {
            id: "amat-5",
            title: "Lesson 5: Top Row Centers (E & I)",
            subtitle: "Middle Finger Upward Reach",
            description: "Reach left middle finger up to E and right middle finger up to I. These are two of the most common vowels in English.",
            keysIntroduced: ["e", "i"],
            targetWpm: 28,
            targetAccuracy: 96
    },
        {
            id: "amat-6",
            title: "Lesson 6: Top Row Left (Q, W, R, T)",
            subtitle: "Left Hand Upper Reach",
            description: "Master all left-hand top keys: Pinky (Q), Ring (W), Index (R, T). Return each finger to its home key after reaching.",
            keysIntroduced: ["q", "w", "r", "t"],
            targetWpm: 30,
            targetAccuracy: 96
    },
        {
            id: "amat-7",
            title: "Lesson 7: Top Row Right (Y, U, O, P)",
            subtitle: "Right Hand Upper Reach",
            description: "Master right-hand top keys: Index (Y, U), Ring (O), Pinky (P). Your hands now control the entire top two rows.",
            keysIntroduced: ["y", "u", "o", "p"],
            targetWpm: 32,
            targetAccuracy: 96
    },
        {
            id: "amat-8",
            title: "Lesson 8: Bottom Row Left (Z, X, C, V, B)",
            subtitle: "Left Hand Downward Reach",
            description: "Extend downwards: Pinky (Z), Ring (X), Middle (C), Index (V, B). Keep wrists relaxed and elevated slightly.",
            keysIntroduced: ["z", "x", "c", "v", "b"],
            targetWpm: 32,
            targetAccuracy: 96
    },
        {
            id: "amat-9",
            title: "Lesson 9: Bottom Row Right (N, M, Comma, Dot)",
            subtitle: "Right Hand Downward Reach",
            description: "Reach downwards: Index (N, M), Middle (,), Ring (.). You have now practiced all three rows of letter keys.",
            keysIntroduced: ["n", "m", ",", "."],
            targetWpm: 35,
            targetAccuracy: 96
    },
        {
            id: "amat-10",
            title: "Lesson 10: All Letters Fluency",
            subtitle: "Complete Lowercase Mastery",
            description: "Seamless transitions across all three letter rows. Strive for consistent cadence rather than bursts of speed.",
            keysIntroduced: Array.from("abcdefghijklmnopqrstuvwxyz"),
            targetWpm: 38,
            targetAccuracy: 97
    },
        {
            id: "amat-11",
            title: "Lesson 11: Amateur Graduation",
            subtitle: "Speed & Flow Evaluation",
            description: "Review all four lines at a target of 40 WPM and 98% accuracy. This lesson is untimed.",
            keysIntroduced: Array.from("abcdefghijklmnopqrstuvwxyz ,.;"),
            targetWpm: 40,
            targetAccuracy: 98
    }
  ],

    pro: [
        {
            id: "pro-1",
            title: "Lesson 1: Left Hand Home",
            subtitle: "Keys: A S D F",
            description: "Build left-hand accuracy with a target of 25 WPM and 98% accuracy.",
            keysIntroduced: ["a", "s", "d", "f", " "],
            targetWpm: 25,
            targetAccuracy: 98
    },
        {
            id: "pro-2",
            title: "Lesson 2: Right Hand Home",
            subtitle: "Keys: J K L ;",
            description: "Rigorous right hand balance and pinky precision.",
            keysIntroduced: ["j", "k", "l", ";", " "],
            targetWpm: 25,
            targetAccuracy: 98
    },
        {
            id: "pro-3",
            title: "Lesson 3: Home Row Synthesis",
            subtitle: "Cross-Hand Coordination",
            description: "Fast alternating strokes between left and right hands on the home row.",
            keysIntroduced: ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
            targetWpm: 30,
            targetAccuracy: 98
    },
        {
            id: "pro-4",
            title: "Lesson 4: Top Row Speed",
            subtitle: "All 10 Upper Letter Keys",
            description: "Speed drills covering Q W E R T Y U I O P combined with home row.",
            keysIntroduced: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
            targetWpm: 35,
            targetAccuracy: 98
    },
        {
            id: "pro-5",
            title: "Lesson 5: Bottom Row Speed",
            subtitle: "All Lower Letter Keys & Punctuation",
            description: "Z X C V B N M with commas and periods.",
            keysIntroduced: ["z", "x", "c", "v", "b", "n", "m", ",", "."],
            targetWpm: 38,
            targetAccuracy: 98
    },
        {
            id: "pro-6",
            title: "Lesson 6: Capitalization & Shift Keys",
            subtitle: "Opposite Hand Shift Mechanics",
            description: "Use the opposite hand for Shift: hold Left Shift with your left pinky for right-hand capitals, and Right Shift with your right pinky for left-hand capitals.",
            keysIntroduced: Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
            targetWpm: 35,
            targetAccuracy: 97
    },
        {
            id: "pro-7",
            title: "Lesson 7: Top Number Row",
            subtitle: "Keys: 1 2 3 4 5 6 7 8 9 0",
            description: "Reach from your home positions to the number row, then return each finger to its home key.",
            keysIntroduced: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
            targetWpm: 30,
            targetAccuracy: 96
    },
        {
            id: "pro-8",
            title: "Lesson 8: Professional Punctuation",
            subtitle: "Quotes, Apostrophes, Hyphens & Parentheses",
            description: "Master essential punctuation for articles, essays, and executive communications.",
            keysIntroduced: ["'", "\"", "-", ":", ";", "(", ")", "!", "?"],
            targetWpm: 35,
            targetAccuracy: 96
    },
        {
            id: "pro-9",
            title: "Lesson 9: Coding & Developer Symbols",
            subtitle: "Braces, Brackets, Operators & Paths",
            description: "Essential syntax for software engineers, web developers, and command-line power users.",
            keysIntroduced: ["{", "}", "[", "]", "<", ">", "/", "\\", "=", "+", "*", "&",
                "%", "$"],
            targetWpm: 30,
            targetAccuracy: 95
    },
        {
            id: "pro-10",
            title: "Lesson 10: Master Touch Typist",
            subtitle: "Full Keyboard Review",
            description: "The final review combines capitals, numbers, symbols, and sustained speed.",
            keysIntroduced: Array.from(
                "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,.;'\"-:()!?{}[]<>/\\=+*&%$"
            ),
            targetWpm: 50,
            targetAccuracy: 98
    }
  ],

    speedWords: WORDS,
    quotes: QUOTES
};

// Unshifted physical keys; keyboardLayout derives capitals and shifted symbols.
export const FINGER_MAP = Object.fromEntries([
    ['left', 'pinky', '`1qaz'],
    ['left', 'ring', '2wsx'],
    ['left', 'middle', '3edc'],
    ['left', 'index', '45rtfgvb'],
    ['either', 'thumb', ' '],
    ['right', 'index', '67yuhjnm'],
    ['right', 'middle', '8ik,'],
    ['right', 'ring', '9ol.'],
    ['right', 'pinky', "0-=p[]\\;'/"]
].flatMap(([hand, finger, keys]) => {
    const label = finger === 'thumb' ? 'Thumb' : [hand, finger]
        .map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
    return Array.from(keys, key => [key, { hand, finger, label }]);
}));
