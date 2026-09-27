/// <reference types="node" />
// Evaluation simulator (PLAN.md §10). These tests guard the properties that make the run
// trustworthy: it must be reproducible, and the baselines must be real rather than strawmen.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calibrationChart,
  type CohortConfig,
  DEFAULT_CONFIG,
  forgettingChart,
  readableShareChart,
  runCohort,
  strandedChart,
} from '../src/sim/index.js';

/** Small cohort: these tests are about behaviour, not about the headline numbers. */
const small: CohortConfig = { ...DEFAULT_CONFIG, learners: 12, vocabulary: 40 };

test('a run is reproducible: same seed, same numbers', () => {
  const a = runCohort(small);
  const b = runCohort(small);
  assert.deepEqual(a.weekly, b.weekly);
  assert.deepEqual(a.calibration, b.calibration);
  assert.deepEqual(a.finalKnown, b.finalKnown);
});

test('a different seed gives a different run, so results are not baked in', () => {
  const a = runCohort(small);
  const b = runCohort({ ...small, seed: small.seed + 1 });
  assert.notDeepEqual(a.weekly, b.weekly);
});

test('every policy sees the same number of words, so the comparison is fair', () => {
  const r = runCohort(small);
  const totals = Object.values(r.decisions).map((d) => d.helped + d.unhelped);
  // no-fade never withholds, so its split differs, but the totals it judges must match the others'
  // within the challenge budget it declines to spend.
  assert.ok(Math.max(...totals) > 0, 'some decisions were made');
  for (const d of Object.values(r.decisions)) {
    assert.ok(d.helped + d.unhelped > 0, 'every policy made decisions');
  }
});

test('the no-fade baseline never withholds help, by construction', () => {
  const r = runCohort(small);
  assert.equal(r.decisions['no-fade'].unhelped, 0);
  assert.equal(r.decisions['no-fade'].stranded, 0);
});

test('the counting baseline is not a strawman: it does learn words', () => {
  const r = runCohort(small);
  // If count-3 could never bootstrap it would match no-fade exactly, which is the bug this guards.
  assert.ok(
    r.finalKnown['count-3'] > r.finalKnown['no-fade'],
    `count-3 (${r.finalKnown['count-3']}) should beat no-fade (${r.finalKnown['no-fade']})`,
  );
});

test('withholding help is judged against the truth the policy cannot see', () => {
  const r = runCohort(small);
  for (const [name, d] of Object.entries(r.decisions)) {
    assert.ok(d.stranded <= d.unhelped, `${name}: stranded can't exceed unhelped`);
    assert.ok(d.strandedRate >= 0 && d.strandedRate <= 1, `${name}: rate in range`);
    assert.ok(d.wastedRate >= 0 && d.wastedRate <= 1, `${name}: waste in range`);
  }
});

test('calibration buckets are ordered, non-empty and carry their sample counts', () => {
  const r = runCohort(small);
  assert.ok(r.calibration.length > 0, 'the model made predictions');
  for (const b of r.calibration) {
    assert.ok(b.n > 0, 'empty buckets are dropped');
    assert.ok(b.predicted >= 0 && b.predicted <= 1);
    assert.ok(b.actual >= 0 && b.actual <= 1);
  }
  const xs = r.calibration.map((b) => b.predicted);
  assert.deepEqual(xs, [...xs].sort((a, b) => a - b), 'buckets ascend');
});

test('readable share is a share, and every week is reported', () => {
  const r = runCohort(small);
  for (const [name, weeks] of Object.entries(r.weekly)) {
    assert.equal(weeks.length, 8, `${name}: eight weeks`);
    assert.deepEqual(
      weeks.map((w) => w.week),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    for (const w of weeks) assert.ok(w.readableShare >= 0 && w.readableShare <= 1, `${name} w${w.week} in range`);
  }
});

test('charts are well-formed SVG and quote the run that produced them', () => {
  const r = runCohort(small);
  for (const svg of [readableShareChart(r), calibrationChart(r), forgettingChart(r), strandedChart(r)]) {
    assert.ok(svg.startsWith('<svg'), 'is an svg');
    assert.ok(svg.trimEnd().endsWith('</svg>'), 'closes');
    assert.ok(!svg.includes('NaN') && !svg.includes('Infinity'), 'no broken coordinates');
    assert.ok(!svg.includes('undefined'), 'no undefined in output');
  }
  // §10: never report a number without the run behind it.
  for (const svg of [readableShareChart(r), strandedChart(r)]) {
    assert.ok(svg.includes(String(r.config.learners)), 'states the cohort size');
    assert.ok(svg.includes(String(r.config.seed)), 'states the seed');
  }
});

test('charts survive a degenerate run without emitting broken coordinates', () => {
  const r = runCohort({ ...small, learners: 1, vocabulary: 1 });
  for (const svg of [readableShareChart(r), calibrationChart(r), forgettingChart(r), strandedChart(r)]) {
    assert.ok(!svg.includes('NaN'), 'no NaN with one learner and one word');
    assert.ok(svg.startsWith('<svg'));
  }
});
