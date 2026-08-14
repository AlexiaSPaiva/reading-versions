/**
 * Word-level diff between two readings of the same article. This is the feature
 * that gives reading-versions its reason to exist: when I reread a paper months
 * later my understanding of it has changed, and that change is information I
 * currently lose. The diff makes it visible.
 *
 * Algorithm: longest common subsequence (LCS) over words, computed with the
 * classic dynamic-programming table, then walked back to produce a list of
 * unchanged / removed / added segments.
 *
 * Why LCS and not something cleverer: it is the algorithm behind `diff` and
 * `git diff`, it is O(n·m) in time and space over word counts that are in the
 * hundreds here, and it can be derived on a whiteboard. Myers' algorithm is
 * faster on large files and would be the upgrade if impressions were ever
 * megabytes long; for two paragraphs the table is a few hundred kilobytes and
 * finishes instantly.
 */

import { readingIsOlder } from './readings.js';

/** Guard on the DP table: 2000² cells is ~4M, still fast; beyond that, refuse. */
export const MAX_WORDS_PER_SIDE = 2000;

/**
 * @typedef {object} DiffSegment
 * @property {'unchanged' | 'removed' | 'added'} type
 * @property {string} text
 */

/**
 * Splits text into words plus their trailing whitespace, so joining the pieces
 * back together reproduces the original exactly. Diffing on bare words would
 * lose paragraph breaks the user typed.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function splitWords(text) {
  if (typeof text !== 'string' || text.trim() === '') return [];
  return text.match(/\S+\s*/g) ?? [];
}

/**
 * Builds the LCS length table for two word arrays.
 *
 * `table[i][j]` is the length of the longest common subsequence of the first
 * `i` words of `a` and the first `j` words of `b`.
 *
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number[][]}
 */
export function lcsTable(a, b) {
  const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      table[i][j] =
        a[i - 1].trim() === b[j - 1].trim()
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }
  return table;
}

/**
 * Diffs two texts into ordered segments.
 *
 * Consecutive segments of the same type are merged, so the UI renders one
 * highlighted run per change instead of one span per word.
 *
 * @param {string} before Text of the older reading.
 * @param {string} after  Text of the newer reading.
 * @returns {DiffSegment[]}
 */
export function diffWords(before, after) {
  const a = splitWords(before);
  const b = splitWords(after);

  if (a.length === 0 && b.length === 0) return [];
  if (a.length === 0) return [{ type: 'added', text: b.join('') }];
  if (b.length === 0) return [{ type: 'removed', text: a.join('') }];

  // Beyond the guard, fall back to whole-text replacement rather than allocating
  // a table that would stall the tab. Rare, and honest: the UI says so.
  if (a.length > MAX_WORDS_PER_SIDE || b.length > MAX_WORDS_PER_SIDE) {
    return [
      { type: 'removed', text: a.join('') },
      { type: 'added', text: b.join('') },
    ];
  }

  const table = lcsTable(a, b);

  // Walk back from the bottom-right corner, emitting segments in reverse.
  const reversed = [];
  let i = a.length;
  let j = b.length;

  const emit = (type, text) => {
    const last = reversed[reversed.length - 1];
    if (last && last.type === type) last.text = text + last.text;
    else reversed.push({ type, text });
  };

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1].trim() === b[j - 1].trim()) {
      // Keep the newer side's spacing: the newer reading is the current text.
      emit('unchanged', b[j - 1]);
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      emit('added', b[j - 1]);
      j -= 1;
    } else {
      emit('removed', a[i - 1]);
      i -= 1;
    }
  }

  return reversed.reverse();
}

/**
 * Counts what changed, for the one-line summary above the diff.
 *
 * @param {DiffSegment[]} segments
 * @returns {{ added: number, removed: number, unchanged: number, changeRatio: number }}
 */
export function diffStats(segments) {
  const count = (type) =>
    segments
      .filter((segment) => segment.type === type)
      .reduce((total, segment) => total + splitWords(segment.text).length, 0);

  const added = count('added');
  const removed = count('removed');
  const unchanged = count('unchanged');
  const total = added + removed + unchanged;

  return {
    added,
    removed,
    unchanged,
    changeRatio: total === 0 ? 0 : (added + removed) / total,
  };
}

/**
 * The full comparison between two readings: prose diff plus the structured
 * fields that changed around it.
 *
 * Order is normalised by date, so the caller cannot accidentally present a diff
 * backwards — "what changed" only means something in chronological order.
 *
 * @param {import('./readings.js').Reading} first
 * @param {import('./readings.js').Reading} second
 * @returns {{
 *   older: import('./readings.js').Reading,
 *   newer: import('./readings.js').Reading,
 *   impression: DiffSegment[],
 *   stats: ReturnType<typeof diffStats>,
 *   comprehensionDelta: number,
 *   tagsAdded: string[],
 *   tagsRemoved: string[],
 *   quotesAdded: string[],
 *   quotesRemoved: string[],
 * }}
 */
export function compareReadings(first, second) {
  // Same ordering rule as the timeline (readings.js): date first, then
  // createdAt. If the two disagreed, a diff could read backwards relative to
  // the list it was opened from.
  const [older, newer] = readingIsOlder(first, second) ? [first, second] : [second, first];

  const impression = diffWords(older.impression, newer.impression);
  const olderTags = new Set(older.tags ?? []);
  const newerTags = new Set(newer.tags ?? []);
  const olderQuotes = new Set(older.quotes ?? []);
  const newerQuotes = new Set(newer.quotes ?? []);

  return {
    older,
    newer,
    impression,
    stats: diffStats(impression),
    comprehensionDelta: (newer.comprehension ?? 0) - (older.comprehension ?? 0),
    tagsAdded: [...newerTags].filter((tag) => !olderTags.has(tag)),
    tagsRemoved: [...olderTags].filter((tag) => !newerTags.has(tag)),
    quotesAdded: [...newerQuotes].filter((quote) => !olderQuotes.has(quote)),
    quotesRemoved: [...olderQuotes].filter((quote) => !newerQuotes.has(quote)),
  };
}
