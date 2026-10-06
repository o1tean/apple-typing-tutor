import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const url = process.env.TYPEFLOW_AUDIT_URL || 'https://o1tean.github.io/apple-typing-tutor/';
const output = new URL('../../.local/lighthouse/', import.meta.url);
await mkdir(output, { recursive: true });
const runs = [];
for (let index = 1; index <= 3; index++) {
    const profile = await mkdtemp(join(tmpdir(), 'typeflow-lighthouse-'));
    const reportPath = new URL(`run-${index}.json`, output);
    try {
        const result = spawnSync('npm', ['exec', '--yes', '--package=lighthouse@13.5.0', '--',
            'lighthouse', url, '--quiet', '--only-categories=performance,accessibility,best-practices',
            '--output=json', `--output-path=${fileURLToPath(reportPath)}`, '--port=0',
            `--chrome-flags=--headless --no-sandbox --user-data-dir=${profile}`], {
            env: { ...process.env, CHROME_PATH: chromium.executablePath() },
            encoding: 'utf8',
            maxBuffer: 1024 * 1024,
            timeout: 180000
        });
        if (result.error || result.status !== 0) throw result.error || new Error(result.stderr);
        const report = JSON.parse(await readFile(reportPath, 'utf8'));
        const scores = Object.fromEntries(['performance', 'accessibility', 'best-practices']
            .map(name => {
                const score = report.categories?.[name]?.score;
                if (!Number.isFinite(score)) throw new Error(`Incomplete ${name} audit.`);
                return [name, Math.round(score * 100)];
            }));
        if (report.runtimeError || Object.values(scores).some(score => !Number.isFinite(score)))
            throw new Error('Lighthouse did not produce a complete audit.');
        const opportunities = Object.values(report.audits).filter(audit =>
            audit.score !== null && audit.score < 1 && !['manual', 'notApplicable',
                'informative']
            .includes(audit.scoreDisplayMode)).map(audit => ({
            id: audit.id,
            title: audit.title,
            score: audit.score,
            value: audit.displayValue || null
        }));
        runs.push({
            timestamp: report.fetchTime,
            lighthouseVersion: report.lighthouseVersion,
            url: report.finalDisplayedUrl,
            scores,
            opportunities
        });
        console.log(`Run ${index}: ${JSON.stringify(scores)}`);
    } finally {
        await rm(profile, { recursive: true, force: true });
    }
}
const median = Object.fromEntries(Object.keys(runs[0].scores).map(name => [name, runs.map(run => run
    .scores[name]).sort((a, b) => a - b)[1]]));
const summary = {
    sourceCommit: process.env.TYPEFLOW_AUDIT_COMMIT || null,
    toolSource: 'https://github.com/GoogleChrome/lighthouse',
    profile: 'Fresh temporary Chromium profile for every run; default mobile throttling.',
    thresholds: { performance: 90, accessibility: 95, 'best-practices': 95 },
    median,
    runs
};
await writeFile(new URL('../quality-report.json', import.meta.url), JSON.stringify(summary, null, 2)
    + '\n');
console.log(`Median of three: ${JSON.stringify(median)}`);
