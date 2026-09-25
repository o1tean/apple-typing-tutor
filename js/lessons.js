/**
 * Apple-grade Typing Tutor - Curriculum & Lessons
 * Inspired by TypingMe touch typing methodology, optimized for UX and flow.
 */

export const CURRICULUM = {
  amateur: [
    {
      id: "amat-intro",
      title: "Basic Position",
      subtitle: "Home Row Foundations",
      badge: "Intro",
      description: "Learn the resting position for your 8 fingers. Rest your left fingers on A S D F and right fingers on J K L ;. Feel the tactile bumps on F and J.",
      keysIntroduced: ["a", "s", "d", "f", "j", "k", "l", ";", " "],
      targetWpm: 15,
      targetAccuracy: 95,
      lines: [
        "asdf jkl; asdf jkl; asdf jkl; asdf jkl;",
        "fdsa ;lkj fdsa ;lkj fdsa ;lkj fdsa ;lkj",
        "aa ss dd ff jj kk ll ;; asdf jkl; space",
        "as df jk l; fa sd ;l kj asdf jkl; asdf"
      ]
    },
    {
      id: "amat-1",
      title: "Lesson 1: Left Hand Home",
      subtitle: "Keys: A S D F",
      badge: "Lesson 1",
      description: "Focus on your left hand resting position: Pinky (A), Ring (S), Middle (D), Index (F), and Thumb on Space.",
      keysIntroduced: ["a", "s", "d", "f", " "],
      targetWpm: 20,
      targetAccuracy: 96,
      lines: [
        "ddaf ads fsas saas fss dfsa sf sff fad sads fsdss",
        "sf dafd faa ss add fdsfs dsa dsf fssa fafa asafd",
        "asa da sad dddf ada saa ddff sdfs sad dsf ad aaasa",
        "adss fssad faafd dd sdf asss aff sdf sfdd sdfss"
      ]
    },
    {
      id: "amat-2",
      title: "Lesson 2: Right Hand Home",
      subtitle: "Keys: J K L ;",
      badge: "Lesson 2",
      description: "Train your right hand resting position: Index (J), Middle (K), Ring (L), Pinky (;), and Thumb on Space.",
      keysIntroduced: ["j", "k", "l", ";", " "],
      targetWpm: 20,
      targetAccuracy: 96,
      lines: [
        "jkl; ;lkj jkl; ;lkj jj kk ll ;; jk l; kj ;l",
        "jlk; k;jl ljk; ;klj jkl; kl;j ljk; ;lkj jk;l",
        "jjj kkk lll ;;; jk ;l kj l; jlk; ;lkj k;lj",
        "jkl; lk;j j;kl kj;l lkj; jkl; ;lkj jkl; ;lkj"
      ]
    },
    {
      id: "amat-3",
      title: "Lesson 3: Home Row Words",
      subtitle: "Combining Left & Right Home Rows",
      badge: "Lesson 3",
      description: "Combine both hands on the home row to form real words without moving your hands away from basic position.",
      keysIntroduced: ["a", "s", "d", "f", "j", "k", "l", ";"],
      targetWpm: 25,
      targetAccuracy: 97,
      lines: [
        "ask dad fall flask salad lads glad fall sad asks",
        "all dads salad flask lads ask fall glad alfalfa all",
        "flask asks salad fall lads glad all dads salad ask",
        "glad fall flask dad ask salad all lads dads salad"
      ]
    },
    {
      id: "amat-4",
      title: "Lesson 4: Inner Reach (G & H)",
      subtitle: "Stretching Index Fingers",
      badge: "Lesson 4",
      description: "Extend your left index finger rightward to G, and right index finger leftward to H. Always return to F and J.",
      keysIntroduced: ["g", "h"],
      targetWpm: 25,
      targetAccuracy: 96,
      lines: [
        "fgf jhj fgf jhj fg hj gf jh fghj jhhg fgf jhj",
        "gas had half flag dash flash glad hall slag fall",
        "shah sash glad flash half flags dash gas hall slag",
        "flash flags half had dash glass gas hall glad flask"
      ]
    },
    {
      id: "amat-5",
      title: "Lesson 5: Top Row Centers (E & I)",
      subtitle: "Middle Finger Upward Reach",
      badge: "Lesson 5",
      description: "Reach left middle finger up to E and right middle finger up to I. These are two of the most common vowels in English.",
      keysIntroduced: ["e", "i"],
      targetWpm: 28,
      targetAccuracy: 96,
      lines: [
        "ded kik ded kik de ki ed ik died like feed silk",
        "life file side sail field safe hide deal slid idle",
        "like feed lake silk hide leaf file side safe died",
        "idea seal leak hill leaf disk self heal slide life"
      ]
    },
    {
      id: "amat-6",
      title: "Lesson 6: Top Row Left (Q, W, R, T)",
      subtitle: "Left Hand Upper Reach",
      badge: "Lesson 6",
      description: "Master all left-hand top keys: Pinky (Q), Ring (W), Index (R, T). Feel the natural angle of the Apple keyboard.",
      keysIntroduced: ["q", "w", "r", "t"],
      targetWpm: 30,
      targetAccuracy: 96,
      lines: [
        "frf ftf sws aqa red wet tree west sweet star ware",
        "water street fast start great water track quiet raw",
        "were raw wait write draw rest wear rate treat water",
        "star quest write aware sweet treat start track west"
      ]
    },
    {
      id: "amat-7",
      title: "Lesson 7: Top Row Right (Y, U, O, P)",
      subtitle: "Right Hand Upper Reach",
      badge: "Lesson 7",
      description: "Master right-hand top keys: Index (Y, U), Ring (O), Pinky (P). Your hands now control the entire top two rows.",
      keysIntroduced: ["y", "u", "o", "p"],
      targetWpm: 32,
      targetAccuracy: 96,
      lines: [
        "juj jyj lol ;p; you out pour play loop drop port",
        "party young people pure supply point youth proud top",
        "hope yellow paper power quiet your type output post",
        "you play poetry power update layout proper youth report"
      ]
    },
    {
      id: "amat-8",
      title: "Lesson 8: Bottom Row Left (Z, X, C, V, B)",
      subtitle: "Left Hand Downward Reach",
      badge: "Lesson 8",
      description: "Extend downwards: Pinky (Z), Ring (X), Middle (C), Index (V, B). Keep wrists relaxed and elevated slightly.",
      keysIntroduced: ["z", "x", "c", "v", "b"],
      targetWpm: 32,
      targetAccuracy: 96,
      lines: [
        "aza sxs dcd fvf fbf back cave base zero view verb",
        "box civic brave exact zebra cover circle black buzz",
        "vivid basic voice curve brick excel check brave zero",
        "brave circle vector block zinc cave browse vibe fabric"
      ]
    },
    {
      id: "amat-9",
      title: "Lesson 9: Bottom Row Right (N, M, Comma, Dot)",
      subtitle: "Right Hand Downward Reach",
      badge: "Lesson 9",
      description: "Reach downwards: Index (N, M), Middle (,), Ring (.), Pinky (/). You now command the full standard typewriter grid.",
      keysIntroduced: ["n", "m", ",", "."],
      targetWpm: 35,
      targetAccuracy: 96,
      lines: [
        "jnj jmj k,k l.l man name main mind plan moon norm",
        "mind, moon, plan, norm, simple, dream, lemon, main.",
        "fine mind, open land, clean room, common form.",
        "learn to touch type, build speed, and enjoy the flow."
      ]
    },
    {
      id: "amat-10",
      title: "Lesson 10: All Letters Fluency",
      subtitle: "Complete Lowercase Mastery",
      badge: "Lesson 10",
      description: "Seamless transitions across all three letter rows. Strive for consistent cadence rather than bursts of speed.",
      keysIntroduced: ["all letters"],
      targetWpm: 38,
      targetAccuracy: 97,
      lines: [
        "the quick brown fox jumps over the lazy dog near the river.",
        "pack my box with five dozen liquor jugs and bright gems.",
        "bright vixens jump quickly and do waltz with playful zeal.",
        "touch typing brings precision, effortless rhythm, and high speed."
      ]
    },
    {
      id: "amat-11",
      title: "Lesson 11: Amateur Graduation",
      subtitle: "Speed & Flow Evaluation",
      badge: "Amateur Final",
      description: "The capstone exam for the Amateur course. Finish all four lines under 60 seconds with 97%+ accuracy.",
      keysIntroduced: ["review"],
      targetWpm: 40,
      targetAccuracy: 98,
      lines: [
        "focus on smooth motion and relaxed fingers on the home row.",
        "speed is a byproduct of accuracy, repetition, and calm focus.",
        "every great writer and programmer learned touch typing first.",
        "you have mastered the fundamentals of the modern keyboard."
      ]
    }
  ],

  pro: [
    {
      id: "pro-1",
      title: "Lesson 1: Left Hand Home",
      subtitle: "Keys: A S D F",
      badge: "Lesson 1",
      description: "Foundational left hand dexterity test with strict zero-error goal.",
      keysIntroduced: ["a", "s", "d", "f", " "],
      targetWpm: 25,
      targetAccuracy: 98,
      lines: [
        "ddaf ads fsas saas fss dfsa sf sff fad sads fsdss",
        "sf dafd faa ss add fdsfs dsa dsf fssa fafa asafd",
        "asa da sad dddf ada saa ddff sdfs sad dsf ad aaasa",
        "adss fssad faafd dd sdf asss aff sdf sfdd sdfss"
      ]
    },
    {
      id: "pro-2",
      title: "Lesson 2: Right Hand Home",
      subtitle: "Keys: J K L ;",
      badge: "Lesson 2",
      description: "Rigorous right hand balance and pinky precision.",
      keysIntroduced: ["j", "k", "l", ";", " "],
      targetWpm: 25,
      targetAccuracy: 98,
      lines: [
        "jkl; ;lkj jkl; ;lkj jj kk ll ;; jk l; kj ;l",
        "jlk; k;jl ljk; ;klj jkl; kl;j ljk; ;lkj jk;l",
        "jjj kkk lll ;;; jk ;l kj l; jlk; ;lkj k;lj",
        "jkl; lk;j j;kl kj;l lkj; jkl; ;lkj jkl; ;lkj"
      ]
    },
    {
      id: "pro-3",
      title: "Lesson 3: Home Row Synthesis",
      subtitle: "Cross-Hand Coordination",
      badge: "Lesson 3",
      description: "Fast alternating strokes between left and right hands on the home row.",
      keysIntroduced: ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
      targetWpm: 30,
      targetAccuracy: 98,
      lines: [
        "flash glad half dash salad flask alfalfa flags hall",
        "all dads salad flask lads ask fall glad alfalfa all",
        "dash flags half had dash glass gas hall glad flask",
        "flask asks salad fall lads glad all dads salad ask"
      ]
    },
    {
      id: "pro-4",
      title: "Lesson 4: Top Row Speed",
      subtitle: "All 10 Upper Letter Keys",
      badge: "Lesson 4",
      description: "Speed drills covering Q W E R T Y U I O P combined with home row.",
      keysIntroduced: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
      targetWpm: 35,
      targetAccuracy: 98,
      lines: [
        "type writer quiet youth output proper report paper power",
        "every pretty poetry request require quickly update quality",
        "write great poetry without worry or doubt or tired hands",
        "pure quality software requires steady rhythm and clear focus"
      ]
    },
    {
      id: "pro-5",
      title: "Lesson 5: Bottom Row Speed",
      subtitle: "All Lower Letter Keys & Punctuation",
      badge: "Lesson 5",
      description: "Z X C V B N M with commas and periods.",
      keysIntroduced: ["z", "x", "c", "v", "b", "n", "m", ",", "."],
      targetWpm: 38,
      targetAccuracy: 98,
      lines: [
        "zebra, civil, vector, combat, bronze, dynamic, minimal.",
        "make every keystroke count, move with calm, precise hands.",
        "brave new ideas come from disciplined, daily practice.",
        "the beauty of typing is thinking directly onto the glass."
      ]
    },
    {
      id: "pro-6",
      title: "Lesson 6: Capitalization & Shift Keys",
      subtitle: "Opposite Hand Shift Mechanics",
      badge: "Lesson 6",
      description: "Rule of Apple Touch Typing: When typing a capital with the right hand, hold Left Shift with left pinky. When typing a capital with the left hand, hold Right Shift with right pinky.",
      keysIntroduced: ["Shift", "Capitals"],
      targetWpm: 35,
      targetAccuracy: 97,
      lines: [
        "Apple Cupertino California Mac iPad iPhone Watch Vision",
        "San Francisco London Tokyo Paris Berlin Sydney Toronto",
        "Steve Jobs and Steve Wozniak founded Apple in April 1976.",
        "Think Different: The crazy ones, the misfits, the rebels."
      ]
    },
    {
      id: "pro-7",
      title: "Lesson 7: Top Number Row",
      subtitle: "Keys: 1 2 3 4 5 6 7 8 9 0",
      badge: "Lesson 7",
      description: "Reach straight up from home row to numbers. Return index and pinky fingers immediately back to home row.",
      keysIntroduced: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      targetWpm: 30,
      targetAccuracy: 96,
      lines: [
        "10 20 30 40 50 60 70 80 90 100 2024 1984 1997 2007",
        "room 101, flight 404, gate 72, seat 38, order 9582",
        "in 1984 Macintosh arrived, in 2001 iPod, in 2007 iPhone.",
        "we have 365 days, 24 hours, 60 minutes, and 3600 seconds."
      ]
    },
    {
      id: "pro-8",
      title: "Lesson 8: Professional Punctuation",
      subtitle: "Quotes, Apostrophes, Hyphens & Parentheses",
      badge: "Lesson 8",
      description: "Master essential punctuation for articles, essays, and executive communications.",
      keysIntroduced: ["'", "\"", "-", ":", ";", "(", ")", "!", "?"],
      targetWpm: 35,
      targetAccuracy: 96,
      lines: [
        "\"Design is not just what it looks like; it's how it works.\"",
        "Can't, won't, it's, they're, who's (and Apple's vision).",
        "Keynotes: simplicity, clarity, elegance - that's what counts!",
        "\"Stay hungry, stay foolish!\" - Whole Earth Epilog, 1974."
      ]
    },
    {
      id: "pro-9",
      title: "Lesson 9: Coding & Developer Symbols",
      subtitle: "Braces, Brackets, Operators & Paths",
      badge: "Lesson 9",
      description: "Essential syntax for software engineers, web developers, and command-line power users.",
      keysIntroduced: ["{", "}", "[", "]", "<", ">", "/", "\\", "=", "+", "*", "&", "%", "$"],
      targetWpm: 30,
      targetAccuracy: 95,
      lines: [
        "const sum = (a, b) => { return a + b; };",
        "if (index >= 0 && status === 'active') { array.push(item); }",
        "<div className=\"container\" style={{ display: 'flex' }} />",
        "git commit -m \"feat: optimized typing tutor engine 100%\""
      ]
    },
    {
      id: "pro-10",
      title: "Lesson 10: Master Touch Typist",
      subtitle: "Full Spectrum Apple Prose",
      badge: "Pro Final",
      description: "The ultimate touch typing certification. Real prose combining capitals, numbers, symbols, and high speed.",
      keysIntroduced: ["Full Keyboard Mastery"],
      targetWpm: 50,
      targetAccuracy: 98,
      lines: [
        "Your work is going to fill a large part of your life, and the only way to be truly satisfied is to do what you believe is great work.",
        "Simple can be harder than complex: You have to work hard to get your thinking clean to make it simple. But it's worth it in the end.",
        "Here's to the crazy ones. The round pegs in the square holes. They change things. They push the human race forward.",
        "Touch typing is now second nature to you. Your thoughts flow effortlessly through your fingertips onto the display."
      ]
    }
  ],

  // Speed test word pools for 15s, 30s, 60s timed sprints
  speedWords: [
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
    "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
    "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
    "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
    "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
    "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
    "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
    "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
    "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
    "apple", "design", "create", "simple", "clean", "focus", "flow", "rhythm", "light", "space"
  ],

  // Famous Quotes for Zen & Quote mode
  quotes: [
    {
      author: "Steve Jobs",
      text: "Design is a funny word. Some people think design means how it looks. But of course, if you dig deeper, it's really how it works."
    },
    {
      author: "Jony Ive",
      text: "Simplicity isn't just the visual style. It's not just minimalism or the absence of clutter. It involves digging through the depth of the complexity."
    },
    {
      author: "Steve Jobs",
      text: "Remembering that you are going to die is the best way I know to avoid the trap of thinking you have something to lose. You are already naked."
    },
    {
      author: "Antoine de Saint-Exupéry",
      text: "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away."
    }
  ]
};

// Map each character to the correct finger and hand
export const FINGER_MAP = {
  // Left Hand
  '`': { hand: 'left', finger: 'pinky', label: 'Left Pinky' },
  '~': { hand: 'left', finger: 'pinky', label: 'Left Pinky', shift: true },
  '1': { hand: 'left', finger: 'pinky', label: 'Left Pinky' },
  '!': { hand: 'left', finger: 'pinky', label: 'Left Pinky', shift: true },
  'q': { hand: 'left', finger: 'pinky', label: 'Left Pinky' },
  'Q': { hand: 'left', finger: 'pinky', label: 'Left Pinky', shift: true },
  'a': { hand: 'left', finger: 'pinky', label: 'Left Pinky' },
  'A': { hand: 'left', finger: 'pinky', label: 'Left Pinky', shift: true },
  'z': { hand: 'left', finger: 'pinky', label: 'Left Pinky' },
  'Z': { hand: 'left', finger: 'pinky', label: 'Left Pinky', shift: true },

  '2': { hand: 'left', finger: 'ring', label: 'Left Ring' },
  '@': { hand: 'left', finger: 'ring', label: 'Left Ring', shift: true },
  'w': { hand: 'left', finger: 'ring', label: 'Left Ring' },
  'W': { hand: 'left', finger: 'ring', label: 'Left Ring', shift: true },
  's': { hand: 'left', finger: 'ring', label: 'Left Ring' },
  'S': { hand: 'left', finger: 'ring', label: 'Left Ring', shift: true },
  'x': { hand: 'left', finger: 'ring', label: 'Left Ring' },
  'X': { hand: 'left', finger: 'ring', label: 'Left Ring', shift: true },

  '3': { hand: 'left', finger: 'middle', label: 'Left Middle' },
  '#': { hand: 'left', finger: 'middle', label: 'Left Middle', shift: true },
  'e': { hand: 'left', finger: 'middle', label: 'Left Middle' },
  'E': { hand: 'left', finger: 'middle', label: 'Left Middle', shift: true },
  'd': { hand: 'left', finger: 'middle', label: 'Left Middle' },
  'D': { hand: 'left', finger: 'middle', label: 'Left Middle', shift: true },
  'c': { hand: 'left', finger: 'middle', label: 'Left Middle' },
  'C': { hand: 'left', finger: 'middle', label: 'Left Middle', shift: true },

  '4': { hand: 'left', finger: 'index', label: 'Left Index' },
  '$': { hand: 'left', finger: 'index', label: 'Left Index', shift: true },
  '5': { hand: 'left', finger: 'index', label: 'Left Index' },
  '%': { hand: 'left', finger: 'index', label: 'Left Index', shift: true },
  'r': { hand: 'left', finger: 'index', label: 'Left Index' },
  'R': { hand: 'left', finger: 'index', label: 'Left Index', shift: true },
  't': { hand: 'left', finger: 'index', label: 'Left Index' },
  'T': { hand: 'left', finger: 'index', label: 'Left Index', shift: true },
  'f': { hand: 'left', finger: 'index', label: 'Left Index' },
  'F': { hand: 'left', finger: 'index', label: 'Left Index', shift: true },
  'g': { hand: 'left', finger: 'index', label: 'Left Index' },
  'G': { hand: 'left', finger: 'index', label: 'Left Index', shift: true },
  'v': { hand: 'left', finger: 'index', label: 'Left Index' },
  'V': { hand: 'left', finger: 'index', label: 'Left Index', shift: true },
  'b': { hand: 'left', finger: 'index', label: 'Left Index' },
  'B': { hand: 'left', finger: 'index', label: 'Left Index', shift: true },

  // Thumbs
  ' ': { hand: 'either', finger: 'thumb', label: 'Thumb' },

  // Right Hand
  '6': { hand: 'right', finger: 'index', label: 'Right Index' },
  '^': { hand: 'right', finger: 'index', label: 'Right Index', shift: true },
  '7': { hand: 'right', finger: 'index', label: 'Right Index' },
  '&': { hand: 'right', finger: 'index', label: 'Right Index', shift: true },
  'y': { hand: 'right', finger: 'index', label: 'Right Index' },
  'Y': { hand: 'right', finger: 'index', label: 'Right Index', shift: true },
  'u': { hand: 'right', finger: 'index', label: 'Right Index' },
  'U': { hand: 'right', finger: 'index', label: 'Right Index', shift: true },
  'h': { hand: 'right', finger: 'index', label: 'Right Index' },
  'H': { hand: 'right', finger: 'index', label: 'Right Index', shift: true },
  'j': { hand: 'right', finger: 'index', label: 'Right Index' },
  'J': { hand: 'right', finger: 'index', label: 'Right Index', shift: true },
  'n': { hand: 'right', finger: 'index', label: 'Right Index' },
  'N': { hand: 'right', finger: 'index', label: 'Right Index', shift: true },
  'm': { hand: 'right', finger: 'index', label: 'Right Index' },
  'M': { hand: 'right', finger: 'index', label: 'Right Index', shift: true },

  '8': { hand: 'right', finger: 'middle', label: 'Right Middle' },
  '*': { hand: 'right', finger: 'middle', label: 'Right Middle', shift: true },
  'i': { hand: 'right', finger: 'middle', label: 'Right Middle' },
  'I': { hand: 'right', finger: 'middle', label: 'Right Middle', shift: true },
  'k': { hand: 'right', finger: 'middle', label: 'Right Middle' },
  'K': { hand: 'right', finger: 'middle', label: 'Right Middle', shift: true },
  ',': { hand: 'right', finger: 'middle', label: 'Right Middle' },
  '<': { hand: 'right', finger: 'middle', label: 'Right Middle', shift: true },

  '9': { hand: 'right', finger: 'ring', label: 'Right Ring' },
  '(': { hand: 'right', finger: 'ring', label: 'Right Ring', shift: true },
  'o': { hand: 'right', finger: 'ring', label: 'Right Ring' },
  'O': { hand: 'right', finger: 'ring', label: 'Right Ring', shift: true },
  'l': { hand: 'right', finger: 'ring', label: 'Right Ring' },
  'L': { hand: 'right', finger: 'ring', label: 'Right Ring', shift: true },
  '.': { hand: 'right', finger: 'ring', label: 'Right Ring' },
  '>': { hand: 'right', finger: 'ring', label: 'Right Ring', shift: true },

  '0': { hand: 'right', finger: 'pinky', label: 'Right Pinky' },
  ')': { hand: 'right', finger: 'pinky', label: 'Right Pinky', shift: true },
  '-': { hand: 'right', finger: 'pinky', label: 'Right Pinky' },
  '_': { hand: 'right', finger: 'pinky', label: 'Right Pinky', shift: true },
  '=': { hand: 'right', finger: 'pinky', label: 'Right Pinky' },
  '+': { hand: 'right', finger: 'pinky', label: 'Right Pinky', shift: true },
  'p': { hand: 'right', finger: 'pinky', label: 'Right Pinky' },
  'P': { hand: 'right', finger: 'pinky', label: 'Right Pinky', shift: true },
  '[': { hand: 'right', finger: 'pinky', label: 'Right Pinky' },
  '{': { hand: 'right', finger: 'pinky', label: 'Right Pinky', shift: true },
  ']': { hand: 'right', finger: 'pinky', label: 'Right Pinky' },
  '}': { hand: 'right', finger: 'pinky', label: 'Right Pinky', shift: true },
  '\\': { hand: 'right', finger: 'pinky', label: 'Right Pinky' },
  '|': { hand: 'right', finger: 'pinky', label: 'Right Pinky', shift: true },
  ';': { hand: 'right', finger: 'pinky', label: 'Right Pinky' },
  ':': { hand: 'right', finger: 'pinky', label: 'Right Pinky', shift: true },
  '\'': { hand: 'right', finger: 'pinky', label: 'Right Pinky' },
  '"': { hand: 'right', finger: 'pinky', label: 'Right Pinky', shift: true },
  '/': { hand: 'right', finger: 'pinky', label: 'Right Pinky' },
  '?': { hand: 'right', finger: 'pinky', label: 'Right Pinky', shift: true }
};
