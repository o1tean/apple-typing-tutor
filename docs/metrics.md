# Typeflow metric definitions

Typeflow calculates typing metrics as follows.

- WPM credits characters in correct words, including their separators, and a
  clean unfinished word, divided by five and measured elapsed minutes. Incorrect
  or skipped words earn no WPM credit. A corrected word regains its credit.
- Subsecond attempts use measured duration; speed is zero without elapsed time.
- Raw WPM includes retained incorrect and extra characters. Deleted input and
  skipped placeholders do not inflate it.
- Accuracy includes incorrect attempts and skipped target characters. Backspace
  does not erase historical mistakes. Skipped characters are reported separately.
- Consistency uses variation in the latest 30 keystroke intervals. It is unavailable
  until at least six intervals with positive measured time exist; pauses are excluded.
- The graph reports overall WPM at recorded timestamps. One sample is not a trend;
  zero-time attempts have no plot. Result/history durations preserve short attempts.

Records require correct input, no skipped characters, measured time, and the
exercise accuracy target. Rounded-zero metrics do not erase retained correct input.
Lesson stars recognize completion, then accuracy, then speed; zero-time attempts
receive none. Result stars describe the current attempt, while earned stars persist.
Test records distinguish duration/count, punctuation, numbers and input behavior.
Custom and repeated passages stay in history as practice without personal bests.

Earlier scores retain their original values and history labels. Personal bests
compare the same scoring method; earned lesson stars carry forward. Current
word-qualified scoring uses `words-v1`. Regression evidence lives in
[engine tests](../tests/regression.mjs), [practice tests](../tests/practice.mjs) and
[storage tests](../tests/storage.mjs).
