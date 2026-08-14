# reading-versions

[![CI](https://github.com/AlexiaSPaiva/reading-versions/actions/workflows/ci.yml/badge.svg)](https://github.com/AlexiaSPaiva/reading-versions/actions/workflows/ci.yml)

**▶ Live app: https://alexiaspaiva.github.io/reading-versions/**

Version control for your understanding of a paper. Record what you took from an article, and when you reread it months later, see exactly how your interpretation changed.

> **Stage 2 of 3 — litpipe**
> [screening](https://github.com/AlexiaSPaiva/research-triage) → **reading (you are here)** → [author mapping](https://github.com/AlexiaSPaiva/author-mapping)

---

## The problem this solves

I read a paper in January and write a note: *the sample looks representative*. I reread it in June, after learning more about cohort attrition, and now I think: *the sample is biased towards healthier volunteers*.

The June note is more useful than the January one. But **the change between them is more useful than either**, because it records what I learned in between — and with a normal note-taking tool that change is invisible: the new note simply overwrites the old one, or sits next to it in a pile of undated fragments.

This app treats each reading as a version, and makes the diff between two versions a first-class view.

## What it does

- **Multiple readings per article.** Each is dated and holds your impression, a 1–5 self-rated comprehension level, the passages you marked, and tags.
- **A timeline** per article, splitting *where you stand now* from *what you used to think* — not one undifferentiated list.
- **A diff between any two readings** — the reason this app exists. Word-level highlighting of the prose, plus the change in comprehension, tags gained and dropped, and passages added and dropped.
- **Status tracking**: to-read → read → reread → archived, updated from your actions rather than asked for twice.
- **Search** across titles, impressions and marked quotes, filterable by status and tag.
- **Imports the selection exported by [research-triage](https://github.com/AlexiaSPaiva/research-triage)**, so stage 1 hands off to stage 2 without retyping.
- **Export/import JSON** for backup and for moving between machines.

## How the diff works

Word-level **longest common subsequence** (LCS), the same idea behind `diff` and `git diff`:

1. Both impressions are split into words, keeping trailing whitespace so the original text can be reconstructed exactly.
2. A dynamic-programming table is filled where `table[i][j]` is the LCS length of the first `i` words of the older text and the first `j` of the newer.
3. Walking back from the bottom-right corner yields the segments: words on the common subsequence are unchanged, words only in the older text were removed, words only in the newer text were added.
4. Consecutive segments of the same kind are merged, so the UI renders one highlighted run per change instead of one span per word.

Cost is O(n·m) in time and memory over word counts. For two paragraphs that is instant. Above 2000 words per side the app falls back to showing the texts as a wholesale replacement rather than allocating a table large enough to stall the tab — Myers' algorithm would be the upgrade if impressions ever got that long, and it is not needed yet.

The comparison is always normalised into chronological order before diffing, using the same date-then-creation-time rule the timeline sorts by. If the two disagreed, a diff could read backwards relative to the list it was opened from.

## Architecture decisions

| Decision | Why |
| --- | --- |
| **No backend, no database, no authentication** | This is the decision most worth defending, so: the data is single-user, single-purpose, and worth kilobytes. A backend would add a server to deploy, a schema to migrate, an auth surface to secure, and a privacy question about storing notes on other people's unpublished work — in exchange for nothing this use case needs. What the user actually needs is *not to lose the notes when changing machines*, and JSON export/import solves that completely. If this ever became multi-user or needed sync, that is when a backend earns its place; adding one now would be building for a requirement that does not exist. |
| **LCS, not a diff library** | ~60 lines I can derive on a whiteboard, against a dependency whose behaviour I would be describing from its README. The size guard and the fallback are explicit rather than buried. |
| **Comprehension is 1–5, not a percentage** | A self-rating is a coarse judgement. A 0–100 scale would invite a precision that does not exist and make two entries look different when they are not. |
| **Status derived from readings** | Recording a first reading sets `read`; recording another sets `reread`. Asking the user to also update a dropdown would let the two disagree. `archived` is respected and never overwritten, because that one is a decision, not a consequence. |
| **Tags normalised to lowercase** | `Cohort`, `cohort ` and `COHORT` are one tag. Without this, tag filtering silently misses entries and the diff reports a tag as both added and removed. |
| **MUI for components, Tailwind for layout** | Both are in the stack, and using both for the same job would mean two systems fighting over one element. MUI owns components and brings keyboard and screen-reader behaviour; Tailwind owns spacing and layout. Tailwind's preflight is disabled so MUI's `CssBaseline` is the single reset. |
| **`shared/researchProfile.js` copied, not published** | Byte-identical in all three repos. An npm package for three consumers I own myself would add versioning work to save copying forty lines. |
| **JSDoc types, not TypeScript** | Type information on the domain functions and the shared contract, without a type-checking layer over an app this size. Imported JSON is validated at runtime regardless — no compiler can vouch for a file the user picked. |

## Known limitations

- **`localStorage` only.** Data lives in one browser on one machine. Clearing site data deletes it. Export to JSON before switching machines — the app tells you so on screen, and warns if a write fails.
- **No sync and no sharing.** By design; see the table above.
- **The diff is lexical.** It highlights which words changed, not what the change *means*. Rewording a sentence without changing your view still shows as a large diff, and the change percentage should be read as "how much text moved", not "how much I changed my mind".
- **Two-reading comparison only.** You pick two versions; there is no N-way view of the whole history at once.
- **Comprehension is self-rated**, so it is not comparable between people and only loosely comparable across years for one person.
- **No edit or delete for a saved reading.** A reading is a dated record; editing one would defeat the point of versioning. Removing an article removes its whole history.
- **No UI tests.** Unit tests cover the domain logic (the diff and the data model). The interface is verified by hand.

## Running locally

```bash
git clone https://github.com/AlexiaSPaiva/reading-versions.git
cd reading-versions
npm install
npm run dev      # http://localhost:5173
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build into `dist/` |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier, writing changes |

**Environment variables: none.** No external services, no API keys, no secrets.

## Project structure

The same layout in all three litpipe repos:

```
src/
  domain/      pure logic, no I/O and no React — this is what the tests cover
    diff.js          LCS word diff, reading comparison
    readings.js      data model, ordering, filtering, tag counts
  services/    I/O at the edges
    fileIo.js  storage.js
  ui/
    components/      ArticleDetail, ReadingForm, DiffView
    pages/App.jsx    state and composition
  shared/      identical across the three apps
    researchProfile.js  theme.js  SuiteNav.jsx  MethodDisclaimer.jsx
```

## Tests

54 unit tests over the diff and the data model, including the properties that matter most: the older text is exactly reconstructible from unchanged + removed segments, the newer text from unchanged + added, an insertion does not mark its neighbours as changed, and reversing the argument order does not flip the sign of the comprehension delta.

```bash
npm test
```

## Security

- Every user-typed field is trimmed and length-capped at the input boundary.
- Imported JSON is parsed inside a `try`/`catch` and every field is re-validated — a file on disk is untrusted input regardless of who wrote it.
- No `eval`, no `dangerouslySetInnerHTML`, no network requests, no secrets.

---

## Resumo em português

Este é o **estágio 2 de 3** do litpipe: **triagem → leitura → mapeamento de autores**.

O `reading-versions` funciona como controle de versão das suas impressões sobre um artigo. Cada leitura é uma entrada datada com resumo, nível de compreensão (1–5), trechos marcados e tags. A funcionalidade central é o **diff entre duas leituras**: destaca palavra por palavra o que mudou na sua interpretação, além da variação de compreensão e das tags e citações que entraram e saíram.

O diff usa **LCS (longest common subsequence)** sobre palavras — o mesmo algoritmo por trás do `git diff`.

**Não há backend, banco de dados nem autenticação, e isso é decisão de arquitetura, não omissão:** os dados são de um único usuário e ocupam kilobytes. Um servidor adicionaria deploy, migração de schema e uma superfície de autenticação sem resolver nada que o caso de uso exija. O que era preciso — não perder as notas ao trocar de máquina — é resolvido por exportar/importar JSON.

---

Built by [Alexia Paiva](https://github.com/AlexiaSPaiva) for the literature review of an undergraduate research project on dementia etiologies (UFF, IANS lab).
