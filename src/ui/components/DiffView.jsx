/**
 * Side-by-side comparison of two readings — the feature this app exists for.
 *
 * The prose diff is rendered inline rather than in two columns: what changed in
 * an interpretation is usually a few words inside a sentence, and two columns
 * make the reader hunt for the difference that inline highlighting shows at a
 * glance. The structured fields (comprehension, tags, quotes) are shown as
 * before/after pairs, where two columns do help.
 */
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { COMPREHENSION_LABELS } from '../../domain/readings.js';

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/**
 * @param {{ comparison: ReturnType<typeof import('../../domain/diff.js').compareReadings> }} props
 */
export default function DiffView({ comparison }) {
  const {
    older,
    newer,
    impression,
    stats,
    comprehensionDelta,
    tagsAdded,
    tagsRemoved,
    quotesAdded,
    quotesRemoved,
  } = comparison;

  const monthsApart = Math.round(
    (new Date(newer.date).getTime() - new Date(older.date).getTime()) /
      (1000 * 60 * 60 * 24 * 30.4),
  );

  return (
    <Paper component="section" aria-labelledby="diff-heading" className="p-4 sm:p-5">
      <Typography id="diff-heading" variant="h2" component="h3" className="mb-1">
        What changed in your reading
      </Typography>
      <Typography variant="body2" color="text.secondary" className="mb-4">
        {formatDate(older.date)} → {formatDate(newer.date)}
        {monthsApart >= 1 && ` · ${monthsApart} month${monthsApart === 1 ? '' : 's'} apart`} ·{' '}
        {Math.round(stats.changeRatio * 100)}% of the words changed ({stats.added} added,{' '}
        {stats.removed} removed)
      </Typography>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Typography variant="overline" color="text.secondary">
            Understanding then
          </Typography>
          <Typography variant="body2">
            {older.comprehension} — {COMPREHENSION_LABELS[older.comprehension]}
          </Typography>
        </div>
        <div>
          <Typography variant="overline" color="text.secondary">
            Understanding now
          </Typography>
          <Typography variant="body2">
            {newer.comprehension} — {COMPREHENSION_LABELS[newer.comprehension]}
            {comprehensionDelta !== 0 && (
              <Chip
                label={`${comprehensionDelta > 0 ? '+' : ''}${comprehensionDelta}`}
                size="small"
                color={comprehensionDelta > 0 ? 'success' : 'warning'}
                className="ml-2"
              />
            )}
          </Typography>
        </div>
      </div>

      <Divider className="my-4" />

      <Typography variant="overline" color="text.secondary">
        Impression
      </Typography>
      <p className="mt-1 whitespace-pre-wrap leading-relaxed">
        {impression.map((segment, index) => {
          if (segment.type === 'unchanged') return <span key={index}>{segment.text}</span>;
          if (segment.type === 'removed') {
            return (
              <del key={index} className="bg-rose-100 text-rose-900 decoration-rose-400">
                {segment.text}
              </del>
            );
          }
          return (
            <ins key={index} className="bg-emerald-100 text-emerald-900 no-underline">
              {segment.text}
            </ins>
          );
        })}
      </p>
      <Typography variant="caption" color="text.secondary" className="mt-2 block">
        <del className="bg-rose-100 px-1">struck through</del> = what you no longer say ·{' '}
        <ins className="bg-emerald-100 px-1 no-underline">highlighted</ins> = what you say now
      </Typography>

      {(tagsAdded.length > 0 || tagsRemoved.length > 0) && (
        <>
          <Divider className="my-4" />
          <Typography variant="overline" color="text.secondary">
            Tags
          </Typography>
          <div className="mt-1 flex flex-wrap gap-1">
            {tagsAdded.map((tag) => (
              <Chip
                key={`add-${tag}`}
                label={`+ ${tag}`}
                size="small"
                color="success"
                variant="outlined"
              />
            ))}
            {tagsRemoved.map((tag) => (
              <Chip
                key={`del-${tag}`}
                label={`− ${tag}`}
                size="small"
                color="warning"
                variant="outlined"
              />
            ))}
          </div>
        </>
      )}

      {(quotesAdded.length > 0 || quotesRemoved.length > 0) && (
        <>
          <Divider className="my-4" />
          <Typography variant="overline" color="text.secondary">
            Marked passages
          </Typography>
          <ul className="mt-1 list-none p-0">
            {quotesAdded.map((quote) => (
              <li key={`add-${quote}`} className="mb-1 border-l-4 border-emerald-400 pl-3">
                <Typography variant="body2">{quote}</Typography>
              </li>
            ))}
            {quotesRemoved.map((quote) => (
              <li key={`del-${quote}`} className="mb-1 border-l-4 border-rose-300 pl-3">
                <Typography variant="body2" color="text.secondary">
                  <del>{quote}</del>
                </Typography>
              </li>
            ))}
          </ul>
        </>
      )}
    </Paper>
  );
}
