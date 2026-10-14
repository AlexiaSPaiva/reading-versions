import { useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
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
import { EmptyState, ExampleBanner, Section, SuiteFooter, icons } from '../../shared/layout.jsx';
import { exampleArticles } from '../../domain/example.js';
import { DOCUMENT_ACCEPT, importDocuments, isDocument } from '../../services/documentImport.js';
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
  const [busy, setBusy] = useState(false);
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

  const loadExample = () => {
    const examples = exampleArticles();
    setArticles(examples);
    setSelectedId(examples[0].id);
    setNotice(null);
  };

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

  /**
   * Accepts the papers themselves (PDF, .txt), the JSON that Research Triage
   * exports, or a previous backup of this app.
   */
  const handleImport = async (event) => {
    const picked = [...(event.target.files ?? [])];
    event.target.value = '';
    if (picked.length === 0) return;

    const documents = picked.filter(isDocument);
    if (documents.length > 0) {
      setBusy(true);
      try {
        const { articles: parsed, errors } = await importDocuments(documents);
        const incoming = parsed.map(articleFromTriage).filter(Boolean);
        let added = 0;
        setArticles((current) => {
          const seen = new Set(current.map((article) => article.id));
          const fresh = incoming.filter((article) => !seen.has(article.id));
          added = fresh.length;
          if (fresh[0]) setSelectedId(fresh[0].id);
          return [...current, ...fresh];
        });
        setNotice({
          severity: added === 0 ? 'warning' : errors.length > 0 ? 'warning' : 'success',
          text:
            (added === 0 ? 'No new document was added.' : `Imported ${added} document(s).`) +
            (errors.length > 0 ? ` ${errors.join(' ')}` : ''),
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    const file = picked[0];
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

      <Container maxWidth="lg" component="main" className="py-6 sm:py-8">
        {articles.length === 0 && (
          <ExampleBanner onLoad={loadExample}>
            Open a small sample library: one paper read twice, months apart, so you can see how the
            diff between two readings works.
          </ExampleBanner>
        )}

        <Section
          id="library-heading"
          title="Your library"
          description={`${articles.length} article${articles.length === 1 ? '' : 's'} · stored in this browser only, so export before switching machines.`}
          className="mb-5"
        >
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
              disabled={busy}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
              title="PDFs and .txt notes, the selection exported by stage 1, or a backup of this app"
            >
              {busy ? 'Reading…' : 'Import'}
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
              multiple
              accept={`${DOCUMENT_ACCEPT},.json,application/json`}
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
        </Section>

        <div className="grid items-start gap-5 lg:grid-cols-[22rem_1fr]">
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
                        className={`w-full cursor-pointer p-3 text-left shadow-none transition-colors hover:border-[#9CC3DD] ${isSelected ? 'border-[#5FA8D3] bg-[#EEF6FB] shadow-[inset_4px_0_0_#1B4965]' : ''}`}
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
                <EmptyState
                  compact
                  icon={icons.document}
                  title={articles.length === 0 ? 'No articles yet' : 'Nothing matches'}
                >
                  {articles.length === 0
                    ? 'Add one by title above, import PDFs, or import the selection exported by stage 1.'
                    : 'No article matches these filters.'}
                </EmptyState>
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
              <EmptyState icon={icons.history} title="Pick an article to see its reading history">
                Each reading is a dated snapshot of what you understood. With two or more, you can
                compare any pair word by word.
              </EmptyState>
            )}
          </div>
        </div>

        <SuiteFooter
          current="reading"
          note="Stage 2 of 3 · no server, no account · your notes stay in this browser."
        />
      </Container>
    </>
  );
}
