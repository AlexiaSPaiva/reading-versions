/**
 * Form for recording one reading. Used both for a first reading and for a
 * reread — a reread is not a special case, it is simply another entry.
 */
import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  COMPREHENSION_LABELS,
  COMPREHENSION_LEVELS,
  LIMITS,
  createReading,
} from '../../domain/readings.js';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * @param {{
 *   onSave: (reading: import('../../domain/readings.js').Reading) => void,
 *   onCancel: () => void,
 * }} props
 */
export default function ReadingForm({ onSave, onCancel }) {
  const [date, setDate] = useState(today);
  const [impression, setImpression] = useState('');
  const [comprehension, setComprehension] = useState(3);
  const [quotesText, setQuotesText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (!impression.trim()) {
      setError('Write what you understood — that text is the thing being versioned.');
      return;
    }
    onSave(
      createReading({
        date,
        impression,
        comprehension,
        // One quote per line is the fastest thing to type while reading.
        quotes: quotesText.split('\n'),
        tags: tagsText.split(','),
      }),
    );
  };

  return (
    <Paper component="form" onSubmit={submit} className="p-4 sm:p-5">
      <Typography variant="h2" component="h3" className="mb-3">
        New reading
      </Typography>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Date of this reading"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          // A reading cannot be recorded for the future.
          inputProps={{ max: today() }}
          InputLabelProps={{ shrink: true }}
          required
          fullWidth
        />
        <TextField
          select
          label="How well did you understand it?"
          value={comprehension}
          onChange={(event) => setComprehension(Number(event.target.value))}
          fullWidth
        >
          {COMPREHENSION_LEVELS.map((level) => (
            <MenuItem key={level} value={level}>
              {level} — {COMPREHENSION_LABELS[level]}
            </MenuItem>
          ))}
        </TextField>
      </div>

      <TextField
        label="Your impression"
        value={impression}
        onChange={(event) => {
          setImpression(event.target.value);
          setError('');
        }}
        placeholder="What is the argument? Does it hold up? What does it mean for my own work?"
        multiline
        minRows={5}
        fullWidth
        required
        error={Boolean(error)}
        helperText={error || `${impression.length}/${LIMITS.impression} characters`}
        inputProps={{ maxLength: LIMITS.impression }}
        className="mt-4"
      />

      <TextField
        label="Marked passages (one per line)"
        value={quotesText}
        onChange={(event) => setQuotesText(event.target.value)}
        multiline
        minRows={3}
        fullWidth
        className="mt-4"
      />

      <TextField
        label="Tags (comma separated)"
        value={tagsText}
        onChange={(event) => setTagsText(event.target.value)}
        placeholder="elsa, selection bias, methods"
        fullWidth
        className="mt-4"
        helperText={`Up to ${LIMITS.tags} tags; case and extra spaces are normalised.`}
      />

      {tagsText.trim() && (
        <div className="mt-2 flex flex-wrap gap-1">
          {createReading({ tags: tagsText.split(',') }).tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <Button type="submit" variant="contained">
          Save reading
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Paper>
  );
}
