import { describe, it, expect } from 'vitest';
import {
  articleFromTriage,
  createReading,
  filterArticles,
  normaliseTag,
  readingIsOlder,
  sortReadingsNewestFirst,
  splitLatest,
  tagCounts,
} from './readings.js';

const reading = (date, overrides = {}) => createReading({ date, ...overrides });

describe('normaliseTag', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normaliseTag('  Selection   Bias ')).toBe('selection bias');
  });

  it('returns an empty string for non-string input', () => {
    expect(normaliseTag(null)).toBe('');
  });
});

describe('createReading', () => {
  it("defaults the date to today and comprehension to the scale's midpoint", () => {
    const created = createReading();
    expect(created.date).toBe(new Date().toISOString().slice(0, 10));
    expect(created.comprehension).toBe(3);
  });

  it('rejects a comprehension value outside the scale', () => {
    expect(createReading({ comprehension: 9 }).comprehension).toBe(3);
    expect(createReading({ comprehension: 'high' }).comprehension).toBe(3);
  });

  it('deduplicates and normalises tags', () => {
    expect(createReading({ tags: ['ELSA', 'elsa ', 'Cohort'] }).tags).toEqual(['elsa', 'cohort']);
  });

  it('drops empty quotes', () => {
    expect(createReading({ quotes: ['real quote', '  ', ''] }).quotes).toEqual(['real quote']);
  });

  it('gives every reading a distinct id', () => {
    expect(createReading().id).not.toBe(createReading().id);
  });
});

describe('readingIsOlder', () => {
  it('compares by date', () => {
    expect(readingIsOlder(reading('2026-01-01'), reading('2026-02-01'))).toBe(true);
    expect(readingIsOlder(reading('2026-02-01'), reading('2026-01-01'))).toBe(false);
  });

  it('breaks a same-date tie by creation time', () => {
    const morning = reading('2026-03-01', { createdAt: '2026-03-01T09:00:00Z' });
    const evening = reading('2026-03-01', { createdAt: '2026-03-01T20:00:00Z' });
    expect(readingIsOlder(morning, evening)).toBe(true);
    expect(readingIsOlder(evening, morning)).toBe(false);
  });
});

describe('sortReadingsNewestFirst', () => {
  it('puts the most recent reading first', () => {
    const sorted = sortReadingsNewestFirst([
      reading('2026-01-01'),
      reading('2026-06-01'),
      reading('2026-03-01'),
    ]);
    expect(sorted.map((r) => r.date)).toEqual(['2026-06-01', '2026-03-01', '2026-01-01']);
  });

  it('does not mutate the input array', () => {
    const input = [reading('2026-01-01'), reading('2026-06-01')];
    const before = input.map((r) => r.date);
    sortReadingsNewestFirst(input);
    expect(input.map((r) => r.date)).toEqual(before);
  });

  it('handles an empty list', () => {
    expect(sortReadingsNewestFirst([])).toEqual([]);
  });
});

describe('splitLatest', () => {
  it('separates the current impression from the superseded ones', () => {
    const article = {
      readings: [reading('2026-01-01'), reading('2026-06-01'), reading('2026-03-01')],
    };
    const { latest, previous } = splitLatest(article);
    expect(latest.date).toBe('2026-06-01');
    expect(previous.map((r) => r.date)).toEqual(['2026-03-01', '2026-01-01']);
  });

  it('returns a null latest for an article with no readings', () => {
    expect(splitLatest({ readings: [] })).toEqual({ latest: null, previous: [] });
    expect(splitLatest({})).toEqual({ latest: null, previous: [] });
  });
});

describe('tagCounts', () => {
  it('counts tags across every reading of every article', () => {
    const articles = [
      { readings: [reading('2026-01-01', { tags: ['elsa', 'cohort'] })] },
      {
        readings: [
          reading('2026-02-01', { tags: ['elsa'] }),
          reading('2026-03-01', { tags: ['elsa'] }),
        ],
      },
    ];
    expect(tagCounts(articles)).toEqual([
      { tag: 'elsa', count: 3 },
      { tag: 'cohort', count: 1 },
    ]);
  });

  it('returns an empty list when nothing is tagged', () => {
    expect(tagCounts([{ readings: [] }])).toEqual([]);
  });
});

describe('filterArticles', () => {
  const articles = [
    {
      id: '1',
      title: 'Vascular dementia and white matter',
      status: 'read',
      readings: [
        reading('2026-01-01', {
          impression: 'Executive dysfunction dominates the profile.',
          tags: ['vascular'],
          quotes: ['stepwise decline was evident'],
        }),
      ],
    },
    {
      id: '2',
      title: 'Lewy body dementia phenotypes',
      status: 'to-read',
      readings: [],
    },
    {
      id: '3',
      title: 'Frontotemporal dementia in ELSA',
      status: 'archived',
      readings: [
        reading('2026-02-01', { impression: 'Behavioural variant only.', tags: ['elsa'] }),
      ],
    },
  ];

  it('returns everything with no filters', () => {
    expect(filterArticles(articles)).toHaveLength(3);
  });

  it('filters by status', () => {
    expect(filterArticles(articles, { status: 'read' }).map((a) => a.id)).toEqual(['1']);
  });

  it('filters by tag, case-insensitively', () => {
    expect(filterArticles(articles, { tag: 'ELSA' }).map((a) => a.id)).toEqual(['3']);
  });

  it('searches titles', () => {
    expect(filterArticles(articles, { query: 'lewy' }).map((a) => a.id)).toEqual(['2']);
  });

  it('searches inside impressions, which is the point of the search box', () => {
    expect(filterArticles(articles, { query: 'executive dysfunction' }).map((a) => a.id)).toEqual([
      '1',
    ]);
  });

  it('searches inside marked quotes', () => {
    expect(filterArticles(articles, { query: 'stepwise' }).map((a) => a.id)).toEqual(['1']);
  });

  it('combines status and text', () => {
    expect(filterArticles(articles, { status: 'archived', query: 'behavioural' })).toHaveLength(1);
    expect(filterArticles(articles, { status: 'read', query: 'behavioural' })).toHaveLength(0);
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(filterArticles(articles, { query: 'espresso' })).toEqual([]);
  });

  it('tolerates an article with no readings', () => {
    expect(() => filterArticles(articles, { query: 'lewy', tag: 'elsa' })).not.toThrow();
  });
});

describe('articleFromTriage', () => {
  it('converts a research-triage export entry', () => {
    const article = articleFromTriage({
      id: '10.1/x',
      title: 'Cognitive decline in vascular dementia',
      abstract: 'We examined executive function.',
      authors: ['Ana Silva'],
      year: 2021,
      doi: '10.1/x',
      similarity: 0.4231,
    });
    expect(article.status).toBe('to-read');
    expect(article.readings).toEqual([]);
    expect(article.similarity).toBe(0.4231);
    expect(article.title).toBe('Cognitive decline in vascular dementia');
  });

  it('rejects an entry with no title', () => {
    expect(articleFromTriage({ abstract: 'orphan' })).toBeNull();
    expect(articleFromTriage(null)).toBeNull();
  });

  it('omits similarity when the entry was not scored', () => {
    expect(articleFromTriage({ title: 'Typed by hand' }).similarity).toBeUndefined();
  });

  it('falls back to a title-derived id when none is given', () => {
    expect(articleFromTriage({ title: 'No id here' }).id).toContain('No id here');
  });
});
