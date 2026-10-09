import { createHash } from 'node:crypto';
import { copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.argv[2] || join(root, 'dist'));
const template = await readFile(join(root, 'js/service-worker.js'), 'utf8');

await copyFile(join(root, 'docs/media/social-preview.png'), join(output, 'og-image.png'));

async function filesIn(directory, prefix = '') {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        // CI artifacts omit hidden build metadata; it is not a browser asset.
        if (entry.name.startsWith('.')) continue;
        const name = prefix + entry.name;
        if (entry.isDirectory()) {
            files.push(...await filesIn(join(directory, entry.name), name + '/'));
        } else if (entry.isFile() && name !== 'sw.js' && name !== 'og-image.png') {
            files.push(name);
        }
    }
    return files;
}

const precache = await Promise.all((await filesIn(output)).sort().map(async name => ({
    url: name.split('/').map(encodeURIComponent).join('/'),
    integrity: 'sha256-' + createHash('sha256')
        .update(await readFile(join(output, name))).digest('base64')
})));
const entries = JSON.stringify(precache, null, 4);
const version = createHash('sha256').update(entries).update(template).digest('hex');
await writeFile(join(output, 'sw.js'),
    `const VERSION = '${version}';\nconst PRECACHE = ${entries};\n\n${template}`);
