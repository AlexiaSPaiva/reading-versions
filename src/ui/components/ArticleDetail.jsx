/**
 * One article: its current impression, its timeline of superseded impressions,
 * and the two-reading picker that feeds the diff.
 */
import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { compareReadings } from '../../domain/diff.js';
import {
  COMPREHENSION_LABELS,
  STATUSES,
  sortReadingsNewestFirst,
  splitLatest,
} from '../../domain/readings.js';
import DiffView from './DiffView.jsx';
import ReadingForm from './ReadingForm.jsx';

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** One entry in the timeline. */
function ReadingCard({ reading, isLatest }) {
  return (
    <Paper
      component="article"
      className={`p-4 ${isLatest ? 'border-l-4 border-l-sky-500' : 'opacity-90'}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Typography variant="subtitle2">{formatDate(reading.date)}</Typography>
        {isLatest && <Chip label="most recent" size="small" color="primary" />}
        <Chip
          label={`${reading.comprehension}/5 — ${COMPREHENSION_LABELS[reading.comprehension]}`}
          size="small"
          variant="outlined"
        />
      </div>

      <Typography variant="body2" className="whitespace-pre-wrap">
        {reading.impression}
      </Typography>

      {reading.quotes.length > 0 && (
        <ul className="mt-3 list-none p-0">
          {reading.quotes.map((quote) => (
            <li key={quote} className="mb-1 border-l-4 border-slate-300 pl-3">
              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                {quote}
              </Typography>
            </li>
          ))}
        </ul>
      )}

      {reading.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {reading.tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
        </div>
      )}
    </Paper>
  );
}

/**
 * @param {{
 *   article: import('../../domain/readings.js').Article,
 *   onAddReading: (reading: import('../../domain/readings.js').Reading) => void,
 *   onStatusChange: (status: string) => void,
 * }} props
 */
export default function ArticleDetail({ article, onAddReading, onStatusChange }) {
  const { latest, previous } = splitLatest(article);
  const [showForm, setShowForm] = useState(false);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  // Default the picker to the two most recent readings — the comparison the
  // user wants nine times out of ten. Re-runs when a reread is added, so the
  // new entry becomes the "later" side automatically.
  useEffect(() => {
    const sorted = sortReadingsNewestFirst(article.readings ?? []);
    setRightId(sorted[0]?.id ?? '');
    setLeftId(sorted[1]?.id ?? '');
  }, [article.readings]);

  const left = article.readings.find((r) => r.id === leftId);
  const right = article.readings.find((r) => r.id === rightId);
  const canDiff = left && right && left.id !== right.id;

  return (
    <div className="flex flex-col gap-4">
      <Paper className="p-4 sm:p-5">
        <Typography variant="h2" component="h2">
          {article.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" className="mt-1">
          {article.authors?.slice(0, 5).join(', ')}
          {article.authors?.length > 5 ? ' et al.' : ''}
          {article.year ? ` · ${article.year}` : ''}
          {article.doi ? ` · doi:${article.doi}` : ''}
        </Typography>

        {typeof article.similarity === 'number' && (
          <Typography variant="caption" color="text.secondary" className="mt-2 block">
            Screening similarity from research-triage: {(article.similarity * 100).toFixed(1)}% —
            shared vocabulary with your profile, not a quality score.
          </Typography>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <TextField
            select
            label="Status"
            value={article.status}
            onChange={(event) => onStatusChange(event.target.value)}
            size="small"
            className="min-w-[10rem]"
          >
            {STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={() => setShowForm((open) => !open)}>
            {article.readings.length === 0 ? 'Record first reading' : 'Record a reread'}
          </Button>
        </div>
      </Paper>

      {showForm && (
        <ReadingForm
          onSave={(reading) => {
            onAddReading(reading);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {article.readings.length >= 2 && (
        <Paper className="p-4 sm:p-5">
          <Typography variant="h2" component="h3" className="mb-3">
            Compare two readings
          </Typography>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              select
              label="Earlier reading"
              value={leftId}
              onChange={(event) => setLeftId(event.target.value)}
              fullWidth
            >
              {article.readings.map((reading) => (
                <MenuItem key={reading.id} value={reading.id}>
                  {formatDate(reading.date)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Later reading"
              value={rightId}
              onChange={(event) => setRightId(event.target.value)}
              fullWidth
            >
              {article.readings.map((reading) => (
                <MenuItem key={reading.id} value={reading.id}>
                  {formatDate(reading.date)}
                </MenuItem>
              ))}
            </TextField>
          </div>
          {!canDiff && (
            <Typography variant="caption" color="text.secondary" className="mt-2 block">
              Pick two different readings to see the diff.
            </Typography>
          )}
        </Paper>
      )}

      {canDiff && <DiffView comparison={compareReadings(left, right)} />}

      {latest && (
        <section aria-labelledby="latest-heading">
          <Typography id="latest-heading" variant="h2" component="h3" className="mb-2">
            Where you stand now
          </Typography>
          <ReadingCard reading={latest} isLatest />
        </section>
      )}

      {previous.length > 0 && (
        <section aria-labelledby="previous-heading">
          <Divider className="mb-4" />
          <Typography id="previous-heading" variant="h2" component="h3" className="mb-1">
            What you used to think
          </Typography>
          <Typography variant="body2" color="text.secondary" className="mb-3">
            {previous.length} superseded reading{previous.length === 1 ? '' : 's'}, newest first.
          </Typography>
          <div className="flex flex-col gap-3">
            {previous.map((reading) => (
              <ReadingCard key={reading.id} reading={reading} isLatest={false} />
            ))}
          </div>
        </section>
      )}

      {article.readings.length === 0 && (
        <Paper className="p-6 text-center">
          <Typography color="text.secondary">
            No readings recorded yet. The first one becomes version 1.
          </Typography>
        </Paper>
      )}
    </div>
  );
}
