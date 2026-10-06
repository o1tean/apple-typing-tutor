import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURRICULUM } from '../js/lessons.js';

const words = CURRICULUM.speedWords;
const quotes = CURRICULUM.quotes;
assert.ok(words.length >= 1000, 'the active test corpus has at least 1,000 common words');
assert.equal(new Set(words).size, words.length, 'duplicate words cannot inflate the corpus count');
assert.ok(words.every(word => /^[a-z]+$/.test(word)), 'words are lowercase keyboard-ready tokens');
assert.ok(quotes.length >= 100, 'the active quote corpus has at least 100 public-domain passages');
assert.equal(new Set(quotes.map(quote => quote.id)).size, quotes.length, 'quote IDs are unique');
assert.equal(new Set(quotes.map(quote => quote.text)).size, quotes.length, 'passages are unique');
for (const quote of quotes) {
    assert.match(quote.id, /^bartlett-[a-z0-9_-]+$/,
        'quotes use source identities, not selection indices');
    assert.ok(quote.id.length <= 194, 'prefixed quote IDs fit the existing storage limit');
    assert.match(quote.text, /^[\x20-\x7e]+$/,
        'guided passages can be typed on the displayed keyboard');
    assert.equal(quote.text, quote.text.trim());
    assert.ok(!/\s{2}/.test(quote.text), 'passages use single spaces without layout breaks');
    assert.ok(quote.author && quote.author === quote.author.trim(), 'every quote names its author');
    assert.ok(!/Steve Jobs|Jony Ive/i.test(quote.author), 'Apple-persona quotations are removed');
    const source = new URL(quote.source);
    assert.equal(source.origin, 'https://www.gutenberg.org');
    assert.match(source.pathname, /27889/, 'attribution points to the verified Bartlett edition');
    assert.match(source.hash, /^#Pg_\d+$/, 'each quote cites its source page');
}

const sources = readFileSync(new URL('../docs/content-sources.md', import.meta.url), 'utf8');
for (const source of [
    'https://www.gutenberg.org/files/3201/files/freq.txt',
    'https://www.gutenberg.org/files/3201/files/oftenmis.txt',
    'https://www.gutenberg.org/ebooks/27889'
]) assert.ok(sources.includes(source), `the source record includes ${source}`);
assert.match(sources, /public[- ]domain/i, 'the content record states its public-domain status');
assert.ok(CURRICULUM.pro.some(lesson => lesson.keysIntroduced.some(key => /^[qwertyuiopzxcvbnm]$/i
    .test(key))), 'the Advanced track introduces keys beyond the home row');

console.log(
    'Content checks passed: corpus size, unique keyboard-ready text, stable quote IDs and public-domain sources.'
);
