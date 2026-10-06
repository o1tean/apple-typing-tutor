/** Teaching recency complements lifetime practice counts; it never changes scores. */

const MAXIMUM = Number.MAX_SAFE_INTEGER;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validNumber = (value, maximum = MAXIMUM) => Number.isFinite(value) && value >= 0 &&
    value <= maximum;
const validCount = value => Number.isSafeInteger(value) && validNumber(value);

function freeze(value) {
    if (isObject(value) || Array.isArray(value)) {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
}

export function readSessionLearning(raw, preserveUnknown = false) {
    if (!isObject(raw) || (!preserveUnknown && (!isObject(raw.keys) || !isObject(raw.bigrams))))
        return null;
    let snapshot;
    try {
        snapshot = preserveUnknown ? structuredClone(raw) : {};
    } catch {
        return null;
    }
    if (preserveUnknown && Number.isSafeInteger(raw.version) && raw.version > 1)
        return freeze(snapshot);
    for (const [name, length] of [['keys', 1], ['bigrams', 2]]) {
        snapshot[name] = Object.create(null);
        for (const [key, cell] of Object.entries(isObject(raw[name]) ? raw[name] : {})) {
            if (key.length !== length || !/^[\x20-\x7e]+$/.test(key) || key !== key.toLowerCase()
                || !isObject(cell) || !validCount(cell.attempts) || !validCount(cell.errors)
                || !validCount(cell.latencySamples) || cell.errors > cell.attempts
                || cell.latencySamples > cell.attempts || !validNumber(cell.latencyTotalMs)
                || (cell.latencySamples === 0 && cell.latencyTotalMs !== 0)) continue;
            snapshot[name][key] = {
                ...(preserveUnknown ? structuredClone(cell) : {}),
                attempts: cell.attempts,
                errors: cell.errors,
                latencySamples: cell.latencySamples,
                latencyTotalMs: cell.latencyTotalMs
            };
        }
    }
    return freeze(snapshot);
}

export function migrateLearning(saved) {
    if (isObject(saved) && Number.isSafeInteger(saved.version) && saved.version > 1)
        return structuredClone(saved);
    const profile = { ...(readSessionLearning(saved, true) || {}), version: 1 };
    for (const name of ['keys', 'bigrams']) {
        const cells = profile[name] || {};
        profile[name] = Object.create(null);
        for (const [key, cell] of Object.entries(cells)) {
            profile[name][key] = {
                ...cell,
                recentErrorRate: validNumber(cell.recentErrorRate, 1) ? cell.recentErrorRate
                    : cell.attempts ? cell.errors / cell.attempts : 0,
                recentLatencyMs: validNumber(cell.recentLatencyMs) ? cell.recentLatencyMs
                    : cell.latencySamples ? cell.latencyTotalMs / cell.latencySamples : 0
            };
        }
    }
    return profile;
}

export function mergeLearning(saved, rawSession) {
    const profile = migrateLearning(saved);
    if (profile.version > 1) return profile;
    const session = readSessionLearning(rawSession);
    if (!session) return profile;
    for (const name of ['keys', 'bigrams']) {
        for (const [key, cell] of Object.entries(session[name])) {
            const old = profile[name][key] || {
                attempts: 0,
                errors: 0,
                latencySamples: 0,
                latencyTotalMs: 0,
                recentErrorRate: cell.attempts ? cell.errors / cell.attempts : 0,
                recentLatencyMs: cell.latencySamples ? cell.latencyTotalMs / cell.latencySamples
                    : 0
            };
            const merged = { ...old };
            for (const field of ['attempts', 'errors', 'latencySamples', 'latencyTotalMs'])
                merged[field] = Math.min(MAXIMUM, old[field] + cell[field]);
            const errorWeight = Math.min(1, cell.attempts / 20);
            const latencyWeight = Math.min(1, cell.latencySamples / 20);
            merged.recentErrorRate = cell.attempts ? Math.min(1, old.recentErrorRate * (1 -
                    errorWeight)
                + cell.errors / cell.attempts * errorWeight) : old.recentErrorRate;
            merged.recentLatencyMs = cell.latencySamples ? Math.min(MAXIMUM, old.recentLatencyMs *
                (1 - latencyWeight) + cell.latencyTotalMs / cell.latencySamples * latencyWeight
            ) : old.recentLatencyMs;
            profile[name][key] = merged;
        }
    }
    return profile;
}
