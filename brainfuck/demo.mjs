import { textBuffer } from './text.mjs';
import { emitTemplate, emitStatic, keyboards, hands } from './view.mjs';

export const DEMO_TIMER_ID = 2;
export const DEMO_MOTION_EVENT = 94;

/** Build-time macros: the demonstration state, controls and scheduling are Brainfuck. */
export function defineDemo(b, arena, constants) {
    const state = constants.state;
    const engine = constants.engine;
    const names = constants.keys;
    let serial = 0;
    const scalar = name => b.scalar(`demo_${name}_${serial++}`);
    const cell = (value = 0) => {
        const out = scalar('temporary');
        b.set(out, value);
        return out;
    };
    const active = state.demo || scalar('active');
    const index = state.demoIndex || scalar('index');
    const playing = state.demoPlaying || scalar('playing');
    const reducedMotion = scalar('reducedMotion');
    const hidden = scalar('hidden');
    const coarse = scalar('coarse');
    const timerRunning = scalar('timerRunning');
    const mounted = scalar('mounted');
    const prepared = scalar('prepared');
    const letters = textBuffer(b, 'demo_letters', 3000);
    const target = textBuffer(b, 'demo_target', 32);
    const field = (parent, name) => {
        const out = cell();
        arena.field(out, parent, names[name]);
        return out;
    };
    const read = (node, name) => {
        const out = cell();
        arena.get(out, name, node);
        return out;
    };
    const eq = (left, right) => {
        const out = cell();
        b.eq(out, left, right);
        return out;
    };
    const lt = (left, right) => {
        const out = cell();
        b.lt(out, left, right);
        return out;
    };
    const at = (array, position) => {
        const out = read(array, 'child');
        const remaining = cell(position);
        b.while(remaining, () => {
            b.if(out, () => arena.get(out, 'next', out));
            b.sub(remaining, 1);
        });
        return out;
    };
    const layout = () => at(field(constants.contentRoot, 'layouts'), state.layout);
    const steps = () => field(layout(), 'demoSteps');
    const property = (selector, name, flag) => {
        const node = cell();
        arena.boolean(node, flag);
        b.write(25);
        b.writeString(selector);
        b.writeString(name);
        b.write(node);
    };
    const html = (selector, value) => {
        b.write(1);
        b.writeString(selector);
        b.writeString(value);
    };
    const text = (selector, value) => {
        b.write(3);
        b.writeString(selector);
        b.writeString(value);
    };
    const media = (query, out) => {
        b.write(16);
        b.writeString(query);
        b.write(0);
        b.read(out);
    };
    const timer = milliseconds => {
        b.write(17);
        b.write(DEMO_TIMER_ID);
        b.write(milliseconds);
        b.write(1);
    };
    const eligible = () => {
        const out = cell(active);
        b.if(playing, () => {}, () => b.set(out, 0));
        for (const stop of [reducedMotion, hidden, state.dialog])
            if (stop) b.if(stop, () => b.set(out, 0));
        return out;
    };
    const schedule = () => {
        const shouldRun = eligible();
        b.if(eq(shouldRun, timerRunning), () => {}, () => {
            b.copy(timerRunning, shouldRun);
            b.if(shouldRun, () => timer(1100), () => timer(0));
        });
    };
    const controls = () => {
        property('#bf-demo-toggle', 'hidden', reducedMotion);
        b.if(playing, () => text('#bf-demo-toggle', 'Pause demo'),
            () => text('#bf-demo-toggle', 'Play demo'));
        b.if(reducedMotion, () => text('#bf-demo-help',
                'Reduced motion: use Next key to explore. This demo does not save progress.'
            ),
            () => text('#bf-demo-help', 'This demo does not save progress.'));
    };
    const renderStep = () => {
        const sequence = steps();
        letters.clear();
        const position = cell();
        arena.each(sequence, entry => {
            letters.literal('<span class="');
            b.if(eq(position, index), () => letters.literal('current'),
                () => b.if(lt(position, index), () => letters.literal('complete')));
            letters.literal('">');
            target.read(read(entry, 'value'));
            const point = cell();
            b.arrayGet(target.data, 0, point);
            b.if(eq(point, 32), () => letters.literal('␣'),
                () => letters.copy(target, true));
            letters.literal('</span>');
            b.add(position, 1);
        });
        html('#bf-demo-letters', letters);
        const entry = at(sequence, index);
        target.read(read(entry, 'value'));
        const point = cell();
        b.arrayGet(target.data, 0, point);
        b.if(eq(point, 32), () => text('#bf-demo-target', 'Space'),
            () => text('#bf-demo-target', target));
        constants.guides?.();
    };
    const renderLayout = () => {
        emitStatic(b, hands, state.layout, '#bf-demo-hands');
        emitStatic(b, keyboards, state.layout, '#bf-demo-keyboard');
        renderStep();
    };
    const advance = () => {
        b.add(index, 1);
        const size = cell();
        arena.each(steps(), () => b.add(size, 1));
        b.if(eq(index, size), () => b.set(index, 0));
        renderStep();
    };
    const prepare = (documentHidden = 0) => {
        b.copy(hidden, documentHidden);
        media('(pointer: coarse)', coarse);
        media('(prefers-reduced-motion: reduce)', reducedMotion);
        b.if(prepared, () => {}, () => {
            b.write(36);
            b.writeString('(prefers-reduced-motion: reduce)');
            b.write(DEMO_MOTION_EVENT);
            b.set(prepared, 1);
        });
    };
    const show = () => {
        b.if(active, () => {}, () => {
            engine.pause(engine.now);
            b.set(active, 1);
            b.set(index, 0);
            b.not(playing, reducedMotion);
            if (state.focused) b.set(state.focused, 0);
            emitTemplate(b, 'phoneDemo', '#bf-session');
            b.set(mounted, 1);
            // Empty the main guides before creating demo guides so every finger ID is unique.
            html('#bf-hands', '');
            html('#bf-keyboard', '');
            for (const [selector, className] of [['#bf-hands', 'hands-container'],
                ['#bf-keyboard', 'keyboard-container']]) {
                b.write(34);
                b.writeString(selector);
                b.writeString(className);
                b.write(0);
            }
            for (const selector of ['#bf-instructions', '#bf-learning',
                    '#bf-live-stats',
                '#bf-watch-demo', '#bf-restart-row', '#bf-guidance', '#bf-shortcuts'])
                property(selector, 'hidden', 1);
            renderLayout();
            controls();
            schedule();
        });
    };
    const startup = (present, readFailed) => {
        b.if(coarse, () => b.if(present, () => {},
            () => b.if(readFailed, () => {}, show)));
    };
    const initialize = (present, readFailed, documentHidden = 0) => {
        prepare(documentHidden);
        startup(present, readFailed);
    };
    const exit = () => {
        b.set(active, 0);
        b.set(playing, 0);
        schedule();
        b.if(mounted, () => {
            b.set(mounted, 0);
            for (const [selector, className] of [['#bf-hands', 'hands-container'],
                ['#bf-keyboard', 'keyboard-container']]) {
                b.write(34);
                b.writeString(selector);
                b.writeString(className);
                b.write(1);
            }
            for (const selector of ['#bf-instructions', '#bf-learning',
                    '#bf-live-stats',
                '#bf-watch-demo', '#bf-restart-row', '#bf-guidance', '#bf-shortcuts'])
                property(selector, 'hidden', 0);
        });
    };
    const toggle = () => b.if(active, () => b.if(reducedMotion, () => {}, () => {
        b.not(playing, playing);
        controls();
        schedule();
    }));
    const next = () => b.if(active, () => {
        b.set(playing, 0);
        advance();
        controls();
        schedule();
    });
    const tick = (requestId = DEMO_TIMER_ID) => b.if(eq(requestId, DEMO_TIMER_ID),
        () => b.if(eligible(), advance));
    const motionChanged = matches => {
        b.copy(reducedMotion, matches);
        b.if(matches, () => b.set(playing, 0));
        b.if(active, controls);
        schedule();
    };
    const visibilityChanged = documentHidden => {
        b.copy(hidden, documentHidden);
        b.if(hidden, () => engine.pause(engine.now));
        b.if(active, () => engine.pause(engine.now));
        schedule();
    };
    const dialogChanged = () => {
        b.if(active, () => engine.pause(engine.now));
        schedule();
    };
    const layoutChanged = () => b.if(active, renderLayout);
    const resize = () => b.if(active, () => constants.guides?.());
    const practice = () => b.if(active, () => {
        exit();
        constants.loadLesson?.();
        b.write(7);
        b.writeString('#bf-input');
    });
    const mayResume = out => {
        b.not(out, active);
        for (const stop of [hidden, state.dialog])
            if (stop) b.if(stop, () => b.set(out, 0));
        if (state.focused) b.if(state.focused, () => {}, () => b.set(out, 0));
    };
    return {
        active,
        index,
        playing,
        reducedMotion,
        hidden,
        coarse,
        timerRunning,
        mounted,
        initialize,
        prepare,
        startup,
        show,
        exit,
        toggle,
        next,
        tick,
        motionChanged,
        visibilityChanged,
        dialogChanged,
        layoutChanged,
        resize,
        practice,
        mayResume,
        renderStep,
        renderLayout,
        schedule
    };
}
