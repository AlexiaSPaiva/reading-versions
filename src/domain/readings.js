/**
 * The data model: an article carries N readings, each one a dated snapshot of
 * what I understood at that moment. Nothing here does I/O, so all of it is
 * directly testable.
 */

/** Article lifecycle. Order matters: it is the order shown in the UI filter. */
export const STATUSES = ['to-read', 'read', 'reread', 'archived'];

/** Self-rated understanding, 1–5. Deliberately coarse: finer is false precision. */
export const COMPREHENSION_LEVELS = [1, 2, 3, 4, 5];

export const COMPREHENSION_LABELS = {
  1: 'Barely followed it',
  2: 'Got the gist',
  3: 'Understood the argument',
  4: 'Could summarise it accurately',
  5: 'Could defend or critique it',
};

export const LIMITS = {
  impression: 20000,
  quote: 2000,
  quotes: 50,
  tag: 40,
  tags: 20,
  title: 1000,
};

/**
 * @typedef {object} Reading
 * @property {string} id
 * @property {string} date          ISO date (YYYY-MM-DD) of the reading.
 * @property {string} impression    What I understood, in my own words.
 * @property {number} comprehension 1–5.
 * @property {string[]} quotes      Passages I marked.
 * @property {string[]} tags
 * @property {string} createdAt     ISO timestamp; used only to break date ties.
 */

/**
 * @typedef {object} Article
 * @property {string} id
 * @property {string} title
 * @property {string} [abstract]
 * @property {string[]} [authors]
 * @property {number|null} [year]
 * @property {string} [doi]
 * @property {number} [similarity]  Carried over from research-triage, if imported.
 * @property {'to-read'|'read'|'reread'|'archived'} status
 * @property {Reading[]} readings
 */

/** Trims and caps a string; every user-typed field passes through here. */
export function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * Normalises a tag so "Cohort ", "cohort" and "COHORT" are one tag. Without
 * this, tag search silently misses entries.
 *
 * @param {string} tag
 * @returns {string}
 */
export function normaliseTag(tag) {
  return clean(tag, LIMITS.tag).toLowerCase().replace(/\s+/g, ' ');
}

/**
 * @param {Partial<Reading>} input
 * @returns {Reading}
 */
export function createReading(input = {}) {
  const now = new Date();
  return {
    id: input.id ?? `reading-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    date: input.date ?? now.toISOString().slice(0, 10),
    impression: clean(input.impression, LIMITS.impression),
    comprehension: COMPREHENSION_LEVELS.includes(input.comprehension) ? input.comprehension : 3,
    quotes: (input.quotes ?? [])
      .map((q) => clean(q, LIMITS.quote))
      .filter(Boolean)
      .slice(0, LIMITS.quotes),
    tags: [...new Set((input.tags ?? []).map(normaliseTag).filter(Boolean))].slice(0, LIMITS.tags),
    createdAt: input.createdAt ?? now.toISOString(),
  };
}

/**
 * The single ordering rule for readings, used by the timeline and by the diff.
 *
 * Two readings can share a date (a morning and an evening pass), so `createdAt`
 * breaks the tie. Without that, order would depend on array insertion and could
 * flip between sessions — and the diff could disagree with the list it was
 * opened from about which reading is the older one.
 *
 * @param {Reading} a
 * @param {Reading} b
 * @returns {boolean} True when `a` is the older of the two.
 */
export function readingIsOlder(a, b) {
  const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (byDate !== 0) return byDate < 0;
  return new Date(a.createdAt).getTime() <= new Date(b.createdAt).getTime();
}

/**
 * Readings newest first.
 *
 * @param {Reading[]} readings
 * @returns {Reading[]} A new array; the input is not mutated.
 */
export function sortReadingsNewestFirst(readings) {
  return [...readings].sort((a, b) => (readingIsOlder(a, b) ? 1 : -1));
}

/**
 * The current reading and the superseded ones, separated — the UI treats
 * "what I think now" and "what I used to think" as different things.
 *
 * @param {Article} article
 * @returns {{ latest: Reading | null, previous: Reading[] }}
 */
export function splitLatest(article) {
  const sorted = sortReadingsNewestFirst(article.readings ?? []);
  return { latest: sorted[0] ?? null, previous: sorted.slice(1) };
}

/**
 * Every tag used across an article's readings, with how often it appears.
 *
 * @param {Article[]} articles
 * @returns {{ tag: string, count: number }[]} Descending by count, then A–Z.
 */
export function tagCounts(articles) {
  const counts = new Map();
  for (const article of articles) {
    for (const reading of article.readings ?? []) {
      for (const tag of reading.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * Filters articles by status, tag and free text.
 *
 * Text search covers the title and every reading's impression and quotes: when
 * I remember writing something but not where, the note is what I search for.
 *
 * @param {Article[]} articles
 * @param {{ status?: string, tag?: string, query?: string }} filters
 * @returns {Article[]}
 */
export function filterArticles(articles, filters = {}) {
  const { status = 'all', tag = '', query = '' } = filters;
  const needle = query.trim().toLowerCase();
  const wantedTag = normaliseTag(tag);

  return articles.filter((article) => {
    if (status !== 'all' && article.status !== status) return false;

    if (wantedTag) {
      const hasTag = (article.readings ?? []).some((r) => (r.tags ?? []).includes(wantedTag));
      if (!hasTag) return false;
    }

    if (!needle) return true;

    const haystack = [
      article.title,
      ...(article.readings ?? []).flatMap((r) => [r.impression, ...(r.quotes ?? [])]),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(needle);
  });
}

/**
 * Builds an article from a research-triage export entry, so stage 1 hands off
 * to stage 2 without retyping anything.
 *
 * @param {Record<string, unknown>} entry
 * @returns {Article | null} Null when the entry has no usable title.
 */
export function articleFromTriage(entry) {
  const title = clean(entry?.title, LIMITS.title);
  if (!title) return null;

  return {
    id: clean(entry.id, 200) || `article-${title.slice(0, 40)}`,
    title,
    abstract: clean(entry.abstract, 20000),
    authors: Array.isArray(entry.authors)
      ? entry.authors.map((a) => clean(a, 200)).filter(Boolean)
      : [],
    year: Number.isFinite(entry.year) ? entry.year : null,
    doi: clean(entry.doi, 200),
    similarity: typeof entry.similarity === 'number' ? entry.similarity : undefined,
    status: 'to-read',
    readings: [],
  };
}
