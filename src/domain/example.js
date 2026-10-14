/**
 * A worked example for first-time visitors: a small library of invented papers
 * (not real ones). The first has two readings months apart, so the timeline and
 * the diff between readings — the reason this app exists — show up at once.
 */
import { articleFromTriage, createReading } from './readings.js';

export function exampleArticles() {
  const cohort = articleFromTriage({
    title:
      'Cognitive decline in a volunteer ageing cohort: a ten-year follow-up (invented example)',
    abstract:
      'A ten-year follow-up of adults aged 50 and over, reassessed every two years on memory, executive function and processing speed.',
    year: 2021,
  });
  const trajectories = articleFromTriage({
    title: 'Behavioural symptoms before diagnosis in frontotemporal dementia (invented example)',
    year: 2022,
  });
  const models = articleFromTriage({
    title: 'Comparing predictive models for dementia subtypes (invented example)',
    year: 2024,
  });

  return [
    {
      ...cohort,
      status: 'reread',
      readings: [
        createReading({
          date: '2026-01-14',
          createdAt: '2026-01-14T10:00:00.000Z',
          comprehension: 2,
          impression:
            'The sample looks representative of older adults. Memory declines steadily with age and the authors control for education, so the results should generalise.',
          quotes: ['Participants were recruited through community centres and newspaper adverts.'],
          tags: ['cohort', 'memory'],
        }),
        createReading({
          date: '2026-06-02',
          createdAt: '2026-06-02T10:00:00.000Z',
          comprehension: 4,
          impression:
            'The sample is biased towards healthier volunteers: people who answer newspaper adverts and stay for ten years are not typical. Memory declines with age, but attrition probably hides the steepest declines, so the results may not generalise.',
          quotes: [
            'Participants were recruited through community centres and newspaper adverts.',
            'Of the 1,200 participants at baseline, 640 completed the final wave.',
          ],
          tags: ['cohort', 'attrition', 'selection bias'],
        }),
      ],
    },
    {
      ...trajectories,
      status: 'read',
      readings: [
        createReading({
          date: '2026-03-20',
          createdAt: '2026-03-20T10:00:00.000Z',
          comprehension: 3,
          impression:
            'Apathy and disinhibition appear years before memory problems. Useful for telling frontotemporal dementia apart from Alzheimer early on.',
          tags: ['behaviour', 'frontotemporal'],
        }),
      ],
    },
    { ...models, status: 'to-read', readings: [] },
  ];
}
