import { useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  LIMITS,
  STATUSES,
  articleFromTriage,
  clean,
  filterArticles,
  splitLatest,
  tagCounts,
} from '../../domain/readings.js';
import { createProfile, validateProfile } from '../../shared/researchProfile.js';
import SuiteNav from '../../shared/SuiteNav.jsx';
import { downloadJson, readTextFile } from '../../services/fileIo.js';
import { loadJson, saveJson } from '../../services/storage.js';
import ArticleDetail from '../components/ArticleDetail.jsx';

const STORAGE_KEY = 'litpipe.reading-versions.v1';

/** Reads persisted state, degrading to an empty library rather than throwing. */
function loadSession() {
  const stored = loadJson(STORAGE_KEY, null);
  const validated = validateProfile(stored?.profile);
  return {
    profile: validated.ok ? validated.profile : createProfile(),
    articles: Array.isArray(stored?.articles) ? stored.articles : [],
  };
}

export default function App() {
  const [session] = useState(loadSession);
  const [profile, setProfile] = useState(session.profile);
  const [articles, setArticles] = useState(session.articles);
  const [selectedId, setSelectedId] = useState(session.articles[0]?.id ?? null);
  const [filters, setFilters] = useState({ status: 'all', tag: '', query: '' });
  const [notice, setNotice] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const fileInput = useRef(null);

  useEffect(() => {
    const saved = saveJson(STORAGE_KEY, { profile, articles });
    if (!saved) {
      setNotice({
        severity: 'warning',
        text: 'Could not save to this browser (storage full or disabled). Export your data.',
      });
    }
  }, [profile, articles]);

  const visible = useMemo(() => filterArticles(articles, filters), [articles, filters]);
  const tags = useMemo(() => tagCounts(articles), [articles]);
  const selected = articles.find((article) => article.id === selectedId) ?? null;

  const updateArticle = (id, change) =>
    setArticles((current) =>
      current.map((article) => (article.id === id ? { ...article, ...change(article) } : article)),
    );

  const addReading = (id, reading) =>
    updateArticle(id, (article) => ({
      readings: [...article.readings, reading],
      // First reading marks it read; any further reading marks it reread. The
      // status follows from the data instead of asking the user twice.
      status:
        article.readings.length === 0
          ? 'read'
          : article.status === 'archived'
            ? 'archived'
            : 'reread',
    }));

  const addManualArticle = (event) => {
    event.preventDefault();
    const article = articleFromTriage({ title: clean(newTitle, LIMITS.title) });
    if (!article) {
      setNotice({ severity: 'error', text: 'A title is required.' });
      return;
    }
    if (articles.some((existing) => existing.id === article.id)) {
      setNotice({ severity: 'warning', text: 'That article is already in your library.' });
      return;
    }
    setArticles((current) => [...current, article]);
    setSelectedId(article.id);
    setNewTitle('');
    setNotice(null);
  };

  /** Accepts the JSON that research-triage exports, or a previous backup of this app. */
  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = JSON.parse(await readTextFile(file));
      const incomingProfile = validateProfile(parsed?.profile);
      if (incomingProfile.ok) setProfile(incomingProfile.profile);

      const entries = Array.isArray(parsed?.articles) ? parsed.articles : [];
      // A backup of this app already has readings; a triage export does not.
      const incoming = entries
        .map((entry) => {
          const base = articleFromTriage(entry);
          if (!base) return null;
          return Array.isArray(entry.readings) && entry.readings.length > 0
            ? { ...base, readings: entry.readings, status: entry.status ?? base.status }
            : base;
        })
        .filter(Boolean);

      if (incoming.length === 0) {
        setNotice({
          severity: 'warning',
          text: 'No articles with a title were found in that file.',
        });
        return;
      }

      let added = 0;
      setArticles((current) => {
        const seen = new Set(current.map((article) => article.id));
        const fresh = incoming.filter((article) => !seen.has(article.id));
        added = fresh.length;
        return [...current, ...fresh];
      });
      setNotice({
        severity: 'success',
        text: `Imported ${added} new article(s)${added < incoming.length ? `, skipped ${incoming.length - added} already present` : ''}.`,
      });
    } catch {
      setNotice({ severity: 'error', text: 'That file is not valid JSON.' });
    }
  };

  return (
    <>
      <SuiteNav
        current="reading"
        subtitle="Version-control what you understood, and diff it against your past self"
      />

      <Container maxWidth="lg" component="main" className="py-6">
        <Paper className="mb-5 p-4 sm:p-5">
          <Typography variant="h2" component="h2" className="mb-1">
            Your library
          </Typography>
          <Typography variant="body2" color="text.secondary" className="mb-4">
            {articles.length} article{articles.length === 1 ? '' : 's'}. Everything is stored in
            this browser only — export before switching machines.
          </Typography>

          <form onSubmit={addManualArticle} className="flex flex-wrap items-start gap-2">
            <TextField
              label="Add an article by title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              size="small"
              className="min-w-[16rem] flex-1"
              inputProps={{ maxLength: LIMITS.title }}
            />
            <Button type="submit" variant="contained">
              Add
            </Button>
            <Button
              variant="outlined"
              onClick={() => fileInput.current?.click()}
              title="Accepts the selection exported by stage 1, Research Triage, or a backup of this app"
            >
              Import
            </Button>
            <Button
              variant="outlined"
              onClick={() =>
                downloadJson('reading-versions-backup.json', {
                  schemaVersion: 1,
                  exportedBy: 'reading-versions',
                  profile,
                  articles,
                })
              }
              disabled={articles.length === 0}
            >
              Export all
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
          </form>

          {notice && (
            <Alert severity={notice.severity} onClose={() => setNotice(null)} className="mt-3">
              {notice.text}
            </Alert>
          )}
        </Paper>

        <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
          <div className="flex flex-col gap-3">
            <Paper className="p-4">
              <TextField
                label="Search titles, impressions and quotes"
                value={filters.query}
                onChange={(event) => setFilters((f) => ({ ...f, query: event.target.value }))}
                size="small"
                fullWidth
              />
              <TextField
                select
                label="Status"
                value={filters.status}
                onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value }))}
                size="small"
                fullWidth
                className="mt-3"
              >
                <MenuItem value="all">all</MenuItem>
                {STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </TextField>

              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {tags.map(({ tag, count }) => (
                    <Chip
                      key={tag}
                      label={`${tag} ${count}`}
                      size="small"
                      variant={filters.tag === tag ? 'filled' : 'outlined'}
                      color={filters.tag === tag ? 'primary' : 'default'}
                      onClick={() => setFilters((f) => ({ ...f, tag: f.tag === tag ? '' : tag }))}
                    />
                  ))}
                </div>
              )}
            </Paper>

            <nav aria-label="Articles">
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {visible.map((article) => {
                  const { latest } = splitLatest(article);
                  const isSelected = article.id === selectedId;
                  return (
                    <li key={article.id}>
                      <Paper
                        component="button"
                        type="button"
                        onClick={() => setSelectedId(article.id)}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`w-full cursor-pointer p-3 text-left ${isSelected ? 'border-l-4 border-l-sky-500' : ''}`}
                      >
                        <Typography
                          variant="subtitle2"
                          component="span"
                          className="block break-words"
                        >
                          {article.title}
                        </Typography>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Chip label={article.status} size="small" variant="outlined" />
                          <Chip
                            label={`${article.readings.length} reading${article.readings.length === 1 ? '' : 's'}`}
                            size="small"
                            variant="outlined"
                          />
                          {latest && (
                            <Chip
                              label={`${latest.comprehension}/5`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </div>
                      </Paper>
                    </li>
                  );
                })}
              </ul>

              {visible.length === 0 && (
                <Paper className="p-5 text-center">
                  <Typography variant="body2" color="text.secondary">
                    {articles.length === 0
                      ? 'Add an article, or import a selection from stage 1.'
                      : 'No article matches these filters.'}
                  </Typography>
                </Paper>
              )}
            </nav>
          </div>

          <div>
            {selected ? (
              <ArticleDetail
                article={selected}
                onAddReading={(reading) => addReading(selected.id, reading)}
                onStatusChange={(status) => updateArticle(selected.id, () => ({ status }))}
              />
            ) : (
              <Paper className="p-8 text-center">
                <Typography color="text.secondary">
                  Pick an article on the left to see its reading history.
                </Typography>
              </Paper>
            )}
          </div>
        </div>

        <Typography
          variant="caption"
          color="text.secondary"
          component="footer"
          className="mt-8 block"
        >
          Stage 2 of 3 of litpipe · no server, no account — your notes stay in this browser ·{' '}
          <a href="https://github.com/AlexiaSPaiva/reading-versions">source</a>
        </Typography>
      </Container>
    </>
  );
}
