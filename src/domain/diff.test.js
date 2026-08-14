import { describe, it, expect } from 'vitest';
import { compareReadings, diffStats, diffWords, lcsTable, splitWords } from './diff.js';
import { createReading } from './readings.js';

/** Joins the segments of one type back into text, for readable assertions. */
const textOf = (segments, type) =>
  segments
    .filter((s) => s.type === type)
    .map((s) => s.text)
    .join('')
    .trim();

describe('splitWords', () => {
  it('keeps trailing whitespace so the text can be rebuilt exactly', () => {
    expect(splitWords('a b').join('')).toBe('a b');
    expect(splitWords('one\n\ntwo').join('')).toBe('one\n\ntwo');
  });

  it('returns an empty array for blank input', () => {
    expect(splitWords('')).toEqual([]);
    expect(splitWords('   ')).toEqual([]);
    expect(splitWords(null)).toEqual([]);
  });
});

describe('lcsTable', () => {
  it('measures the longest common subsequence', () => {
    const a = ['the ', 'cat ', 'sat'];
    const b = ['the ', 'dog ', 'sat'];
    expect(lcsTable(a, b)[a.length][b.length]).toBe(2); // "the" and "sat"
  });

  it('ignores whitespace differences when matching words', () => {
    expect(lcsTable(['word  '], ['word'])[1][1]).toBe(1);
  });
});

describe('diffWords', () => {
  it('marks everything unchanged for identical text', () => {
    const segments = diffWords('same text here', 'same text here');
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe('unchanged');
  });

  it('reports the whole text as added when the older side is empty', () => {
    expect(diffWords('', 'new thoughts')).toEqual([{ type: 'added', text: 'new thoughts' }]);
  });

  it('reports the whole text as removed when the newer side is empty', () => {
    expect(diffWords('old thoughts', '')).toEqual([{ type: 'removed', text: 'old thoughts' }]);
  });

  it('returns nothing when both sides are empty', () => {
    expect(diffWords('', '')).toEqual([]);
  });

  it('isolates a replaced word and leaves the rest unchanged', () => {
    const segments = diffWords('the sample seems representative', 'the sample seems biased');
    expect(textOf(segments, 'removed')).toBe('representative');
    expect(textOf(segments, 'added')).toBe('biased');
    expect(textOf(segments, 'unchanged')).toBe('the sample seems');
  });

  it('detects an insertion without marking surrounding words as changed', () => {
    const segments = diffWords('vascular dementia', 'probable vascular dementia');
    expect(textOf(segments, 'added')).toBe('probable');
    expect(textOf(segments, 'removed')).toBe('');
    expect(textOf(segments, 'unchanged')).toBe('vascular dementia');
  });

  it('detects a deletion', () => {
    const segments = diffWords('a clearly strong result', 'a strong result');
    expect(textOf(segments, 'removed')).toBe('clearly');
    expect(textOf(segments, 'added')).toBe('');
  });

  it('rebuilds the newer text from unchanged plus added segments', () => {
    const before = 'the cohort is small and the follow-up is short';
    const after = 'the cohort is large but the follow-up is still short';
    const rebuilt = diffWords(before, after)
      .filter((s) => s.type !== 'removed')
      .map((s) => s.text)
      .join('');
    expect(rebuilt.replace(/\s+/g, ' ').trim()).toBe(after);
  });

  it('rebuilds the older text from unchanged plus removed segments', () => {
    const before = 'memory decline predicts conversion';
    const after = 'executive decline predicts nothing';
    const rebuilt = diffWords(before, after)
      .filter((s) => s.type !== 'added')
      .map((s) => s.text)
      .join('');
    expect(rebuilt.replace(/\s+/g, ' ').trim()).toBe(before);
  });

  it('merges consecutive segments of the same type', () => {
    const segments = diffWords('one two three', 'one alpha beta three');
    // "alpha beta" must be a single added run, not two.
    expect(segments.filter((s) => s.type === 'added')).toHaveLength(1);
  });

  it('falls back to whole-text replacement above the size guard', () => {
    const huge = 'word '.repeat(2100);
    const segments = diffWords(huge, `${huge}extra`);
    expect(segments.map((s) => s.type)).toEqual(['removed', 'added']);
  });
});

describe('diffStats', () => {
  it('counts words per category', () => {
    const stats = diffStats(diffWords('a b c', 'a b d'));
    expect(stats.unchanged).toBe(2);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(1);
  });

  it('reports a change ratio of 0 for identical text', () => {
    expect(diffStats(diffWords('same', 'same')).changeRatio).toBe(0);
  });

  it('reports a change ratio of 1 when nothing survives', () => {
    expect(diffStats(diffWords('old', 'new')).changeRatio).toBe(1);
  });

  it('reports 0 rather than dividing by zero on an empty diff', () => {
    expect(diffStats([]).changeRatio).toBe(0);
  });
});

describe('compareReadings', () => {
  const first = createReading({
    date: '2026-01-10',
    impression: 'The sample seems representative of the population.',
    comprehension: 2,
    tags: ['Cohort', 'ELSA'],
    quotes: ['n = 12,000 participants'],
  });

  const second = createReading({
    date: '2026-06-20',
    impression: 'The sample seems biased towards healthier volunteers.',
    comprehension: 4,
    tags: ['elsa', 'selection bias'],
    quotes: ['attrition was not adjusted for'],
  });

  it('orders the pair chronologically regardless of argument order', () => {
    expect(compareReadings(first, second).older.date).toBe('2026-01-10');
    expect(compareReadings(second, first).older.date).toBe('2026-01-10');
    expect(compareReadings(second, first).newer.date).toBe('2026-06-20');
  });

  it('reports the shift in self-rated comprehension', () => {
    expect(compareReadings(first, second).comprehensionDelta).toBe(2);
    // Reversed arguments must not flip the sign: order is normalised by date.
    expect(compareReadings(second, first).comprehensionDelta).toBe(2);
  });

  it('lists tags gained and dropped, case-insensitively', () => {
    const result = compareReadings(first, second);
    expect(result.tagsAdded).toEqual(['selection bias']);
    expect(result.tagsRemoved).toEqual(['cohort']);
    // "ELSA" and "elsa" are the same tag, so it appears in neither list.
    expect(result.tagsAdded).not.toContain('elsa');
    expect(result.tagsRemoved).not.toContain('elsa');
  });

  it('lists quotes gained and dropped', () => {
    const result = compareReadings(first, second);
    expect(result.quotesAdded).toEqual(['attrition was not adjusted for']);
    expect(result.quotesRemoved).toEqual(['n = 12,000 participants']);
  });

  it('diffs the impression text', () => {
    const result = compareReadings(first, second);
    expect(textOf(result.impression, 'added')).toContain('biased');
    expect(textOf(result.impression, 'removed')).toContain('representative');
  });

  it('breaks a same-date tie without throwing', () => {
    const a = createReading({
      date: '2026-03-01',
      impression: 'first',
      createdAt: '2026-03-01T09:00:00Z',
    });
    const b = createReading({
      date: '2026-03-01',
      impression: 'second',
      createdAt: '2026-03-01T18:00:00Z',
    });
    expect(() => compareReadings(a, b)).not.toThrow();
    expect(compareReadings(a, b).stats.changeRatio).toBe(1);
  });
});
