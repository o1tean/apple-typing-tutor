const STATUS = { pending: 0, correct: 1, incorrect: 2 };

export function createBrainfuckEngine(TypingEngine) {
    return class BrainfuckEngine extends TypingEngine {
        constructor(options = {}, module) {
            super(options);
            this.kernelInput = [];
            this.kernelOutput = [];
            this.kernelIndex = 0;
            this.kernel = new WebAssembly.Instance(module, {
                env: {
                    read: () => this.kernelInput[this.kernelIndex++] ?? 0,
                    write: value => this.kernelOutput.push(value >>> 0)
                }
            }).exports;
        }

        runKernel(op, input = '', item = null, extra = 0, includeSeparator = false,
            records = []) {
            this.kernelInput = [op, this.currentCharIndex, this.totalKeystrokes,
                this.correctKeystrokes, this.netCorrectChars, this.correctNonSpaceChars,
                this.netTypedChars, this.errorKeystrokes, this.skippedChars,
                Number(this.mode === 'flow'), item?.char.codePointAt(0) ?? -1,
                input.codePointAt(0) ?? 0, STATUS[item?.status] ?? 0,
                Number(Boolean(item?.typed)), extra,
                Number(this.timedDuration > 0 || this.currentLineIndex < this.lines.length - 1),
                Number(includeSeparator), records.length
            ];
            for (const record of records) {
                this.kernelInput.push(record.char.codePointAt(0), STATUS[record.status],
                    Number(Boolean(record.extra)), Number(Boolean(record.skipped)));
            }
            this.kernelOutput = [];
            this.kernelIndex = 0;
            new Uint32Array(this.kernel.memory.buffer, 0, 64).fill(0);
            this.kernel.run();
            return this.kernelOutput;
        }

        applyCounters(output) {
            [, this.totalKeystrokes, this.correctKeystrokes, this.netCorrectChars,
                this.correctNonSpaceChars, this.netTypedChars, this.errorKeystrokes,
                this.skippedChars
            ] = output;
        }

        typeCharacter(typedChar, latency) {
            const targetChar = this.getCurrentChar();
            const item = this.typedChars[this.currentCharIndex];
            const output = this.runKernel(1, typedChar, item, Number(Boolean(item?.extra)));
            const action = output[8];
            this.applyCounters(output);

            if (action === 4) {
                this.submitWord(latency);
                this.updateTick();
                return;
            }
            const correct = action === 1;
            this.measureLearning(targetChar, !correct, latency,
                action !== 3 && (this.mode === 'flow' || correct));
            if (action === 3) {
                this.typedChars.splice(this.currentCharIndex, 0, {
                    char: typedChar,
                    status: 'incorrect',
                    typed: typedChar,
                    extra: true
                });
                this.currentCharIndex = output[0];
                this.errorsByChar[typedChar] = (this.errorsByChar[typedChar] || 0) + 1;
                this.onError(targetChar, typedChar);
                this.onCharTyped(typedChar, false, this.getCurrentChar());
                this.updateTick();
                return;
            }

            item.status = correct ? 'correct' : 'incorrect';
            if (!correct) {
                this.errorsByChar[targetChar] = (this.errorsByChar[targetChar] || 0) + 1;
                if (this.mode === 'strict') item.typed = typedChar;
                this.onError(targetChar, typedChar);
            }
            item.typed = typedChar;
            this.currentCharIndex = output[0];
            if (this.mode === 'strict') {
                if (correct && this.currentCharIndex >= this.typedChars.length)
                    this.advanceLine();
                else this.onCharTyped(typedChar, correct, this.getCurrentChar());
            } else if (this.currentCharIndex >= this.typedChars.length &&
                this.timedDuration === 0 && this.currentLineIndex === this.lines.length - 1
                &&
                this.typedChars.slice(this.typedChars.findLastIndex(record => record.char
                    ===
                    ' ') + 1).every(record => record.status === 'correct')) {
                this.advanceLine();
            } else this.onCharTyped(typedChar, correct, this.getCurrentChar());
            this.updateTick();
        }

        deleteBackward() {
            if (this.currentCharIndex === 0) return false;
            const item = this.typedChars[this.currentCharIndex - 1];
            if (item.char === ' ' && !item.extra && this.runKernel(3, '', null, 0, false,
                    this.typedChars.slice(0, this.currentCharIndex))[10]) return false;
            const output = this.runKernel(2, '', item, Number(Boolean(item.extra)));
            this.applyCounters(output);
            this.currentCharIndex = output[0];
            if (item.extra) this.typedChars.splice(this.currentCharIndex, 1);
            else {
                item.status = 'pending';
                item.typed = '';
                delete item.skipped;
            }
            // Reopening a short word places the caret after its actual input.
            while (this.currentCharIndex > 0 && this.typedChars[this.currentCharIndex - 1]
                .skipped) {
                const skipped = this.typedChars[--this.currentCharIndex];
                skipped.status = 'pending';
                delete skipped.skipped;
            }
            const preceding = this.typedChars.slice(0, this.currentCharIndex).findLast(
                record =>
                !record.extra)?.char;
            this.learningPrevious = preceding === undefined ? this.learningLinePrevious
                : /^[\x20-\x7e]$/.test(preceding) ? preceding.toLowerCase() : null;
            this.learningTimingBreak = true;
            return true;
        }

        submitWord(latency = null) {
            const firstSkipped = this.getCurrentChar();
            let skipped = false;
            while (true) {
                const item = this.typedChars[this.currentCharIndex];
                const output = this.runKernel(4, '', item);
                if (!output[8]) break;
                this.applyCounters(output);
                this.currentCharIndex = output[0];
                this.measureLearning(item.char, true, skipped ? null : latency);
                item.status = 'incorrect';
                item.skipped = true;
                this.errorsByChar[item.char] = (this.errorsByChar[item.char] || 0) + 1;
                skipped = true;
            }
            if (skipped) this.onError(firstSkipped, ' ');

            const hasSeparator = this.currentCharIndex < this.typedChars.length;
            const hasFollowingLine = this.timedDuration > 0 || this.currentLineIndex < this
                .lines
                .length - 1;
            const separator = this.typedChars[this.currentCharIndex];
            const output = this.runKernel(5, '', separator, Number(hasSeparator));
            this.applyCounters(output);
            if (output[8] === 1) this.measureLearning(' ', false, skipped ? null : latency);
            else {
                this.errorsByChar[' '] = (this.errorsByChar[' '] || 0) + 1;
                if (!skipped) this.onError(null, ' ');
            }
            if (hasSeparator) {
                separator.status = 'correct';
                separator.typed = ' ';
            }
            this.currentCharIndex = output[0];
            if (this.currentCharIndex >= this.typedChars.length)
                this.advanceLine(!hasSeparator && hasFollowingLine);
            else this.onCharTyped(' ', !skipped, this.getCurrentChar());
        }

        getWordCredit(includeSeparator = false) {
            return this.runKernel(3, '', null, 0, includeSeparator,
                this.typedChars.slice(0, this.currentCharIndex))[9];
        }
    };
}
