/** A native, local PNG of the completed session and its target-key map. */

import { KEYBOARD_LAYOUT, keyMeasurements } from './keyboard.js';
import { formatElapsedTime } from './practice.js';

export async function resultCard(result, exercise) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 780;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Result card rendering is unavailable.');
    const styles = getComputedStyle(document.documentElement);
    const palette = Object.fromEntries(['bg', 'surface', 'border', 'text', 'muted', 'accent',
        'error'].map(name => [name, styles.getPropertyValue(`--${name}`).trim()]));
    const sans = styles.getPropertyValue('--font-sans').trim();
    const mono = styles.getPropertyValue('--font-mono').trim();
    const text = (value, x, y, size, color = 'text', font = sans, width = 1080) => {
        context.font = `${size}px ${font}`;
        context.fillStyle = palette[color];
        context.fillText(String(value), x, y, width);
    };

    context.fillStyle = palette.bg;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(60, 56);
    context.scale(2, 2);
    context.strokeStyle = palette.accent;
    context.lineWidth = 2.25;
    context.lineCap = context.lineJoin = 'round';
    context.stroke(new Path2D('M4 9h10 M8 5v10.5c0 2.5 1.5 3.5 4 3.5h2 M19 5v14'));
    context.restore();
    text('Typeflow', 120, 94, 44);
    text('Learn touch typing, one key at a time.', 60, 138, 22, 'muted');
    text(exercise?.title || 'Typing practice', 60, 183, 19, 'muted', mono);
    text(result.wpm, 60, 288, 86, 'accent', mono, 300);
    text('WPM', 60, 326, 18, 'muted', mono);
    text(`${result.accuracy}%`, 450, 288, 66, 'text', mono, 330);
    text('ACCURACY', 450, 326, 18, 'muted', mono);
    text(formatElapsedTime(result.elapsedMilliseconds), 875, 288, 38, 'text', mono, 260);
    text('TIME', 875, 326, 18, 'muted', mono);
    text('Your session key map', 60, 385, 23);
    text('● Clean', 60, 415, 17, 'accent');
    text('● Errors · stronger color means a higher rate', 185, 415, 17, 'error');
    text('○ Not tried', 605, 415, 17, 'muted');

    context.beginPath();
    context.roundRect(60, 430, 1080, 270, 18);
    context.fillStyle = palette.surface;
    context.fill();
    const cells = keyMeasurements(result.learning);
    Object.values(KEYBOARD_LAYOUT).forEach((row, rowIndex) => {
        const unit = (1048 - 8 * (row.length - 1)) / row.reduce((sum, key) => sum + key
            .width, 0);
        let x = 76;
        const y = 446 + rowIndex * 50;
        row.forEach(key => {
            const width = unit * key.width;
            const cell = cells.get(key.code);
            const measured = cell?.attempts > 0;
            const rate = measured ? cell.errors / cell.attempts : 0;
            const heat = rate ? palette.error : palette.accent;
            context.beginPath();
            context.roundRect(x, y, width, 42, 7);
            context.fillStyle = palette.bg;
            context.fill();
            if (measured) {
                context.fillStyle = heat;
                context.globalAlpha = rate ? 0.12 + rate * 0.30 : 0.22;
                context.fill();
                context.globalAlpha = 1;
            }
            context.strokeStyle = measured ? heat : palette.border;
            context.lineWidth = measured ? 2 : 1;
            context.stroke();
            context.textAlign = 'center';
            text(key.code === 'Space' ? 'space' : key.label, x + width / 2, y +
                27,
                key.special ? 13 : 18, 'text', mono, width - 10);
            x += width + 8;
        });
    });
    context.textAlign = 'left';
    text('https://o1tean.github.io/apple-typing-tutor/', 60, 746, 20, 'muted', mono);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob)
        : reject(new Error('Could not encode the result card.')), 'image/png'));
}
