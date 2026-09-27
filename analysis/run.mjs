// Evaluation run (PLAN.md §10). Writes the charts and a run record so every number in the
// write-up can be traced back to the seed and cohort that produced it.
//
//   npm run analysis
//
// Plain .mjs over the compiled package: no extra tooling, no new dependencies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sim } from '../packages/learner/dist/src/index.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(OUT, { recursive: true });

const result = sim.runCohort(sim.DEFAULT_CONFIG);
const { config, weekly, calibration, finalKnown, decisions } = result;

const charts = {
  'readable-share.svg': sim.readableShareChart(result),
  'calibration.svg': sim.calibrationChart(result),
  'forgetting-curves.svg': sim.forgettingChart(result),
  'stranded.svg': sim.strandedChart(result),
};
for (const [name, svg] of Object.entries(charts)) writeFileSync(join(OUT, name), svg);

// Mean absolute calibration error: how far the model's predictions sit from what happened.
const totalN = calibration.reduce((s, b) => s + b.n, 0);
const mace = calibration.reduce((s, b) => s + (b.n / totalN) * Math.abs(b.predicted - b.actual), 0);

const record = {
  ranAt: new Date().toISOString(),
  config,
  finalWeekReadableShare: Object.fromEntries(
    Object.entries(weekly).map(([k, v]) => [k, v.at(-1).readableShare]),
  ),
  wordsKnownAtWeek8: finalKnown,
  calibration,
  decisions,
  meanAbsoluteCalibrationError: mace,
  predictions: totalN,
};
writeFileSync(join(OUT, 'run.json'), `${JSON.stringify(record, null, 2)}\n`);

const pct = (x) => `${(x * 100).toFixed(1)}%`;
console.log(`\nCohort: ${config.learners} learners, seed ${config.seed}, ${config.vocabulary} words, 8 weeks\n`);
console.log('Readable share at week 8 (share of words recalled unaided, true memory):');
for (const [name, v] of Object.entries(weekly)) console.log(`  ${name.padEnd(10)} ${pct(v.at(-1).readableShare)}`);
console.log('\nWords known at week 8 (mean per learner):');
for (const [name, v] of Object.entries(finalKnown)) console.log(`  ${name.padEnd(10)} ${v.toFixed(1)} / ${config.vocabulary}`);
console.log('\nWhen a policy withholds the gloss, how often could the learner NOT recall the word?');
for (const [name, d] of Object.entries(decisions)) {
  const detail = d.unhelped ? `${pct(d.strandedRate)}  (${d.stranded.toLocaleString('en-US')} of ${d.unhelped.toLocaleString('en-US')} unhelped)` : 'never withholds';
  console.log(`  ${name.padEnd(10)} ${detail}`);
}
console.log(`\nCalibration: ${totalN.toLocaleString('en-US')} predictions, mean absolute error ${pct(mace)}`);
console.log(`\nWrote ${Object.keys(charts).length} charts + run.json to analysis/out/\n`);
