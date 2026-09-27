// Hand-rolled SVG for the evaluation charts (PLAN.md §10). No chart library: §3 doesn't allow one,
// and these are static exports. Pure string builders so they can be unit-tested.
import type { CalibrationBucket, CohortResult, DecisionQuality, WordTrace } from './cohort.js';
import type { PolicyName } from './policies.js';

/** The app's palette (PLAN.md §7.3), so the charts look like the product. */
export const C = {
  heirloom: '#C9922E',
  tint: '#FBF3E4',
  mastered: '#2E9E6B',
  fading: '#D9822B',
  ink: '#0B0B0C',
  muted: '#65676B',
  hairline: '#E4E6EB',
  bg: '#FFFFFF',
  blue: '#0A7CFF',
} as const;

const W = 640;
const H = 360;
const PAD = { left: 62, right: 176, top: 44, bottom: 52 };
const IN_W = W - PAD.left - PAD.right;
const IN_H = H - PAD.top - PAD.bottom;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v: number) => (Math.round(v * 100) / 100).toString();

const px = (t: number) => PAD.left + IN_W * t;
const py = (v: number) => PAD.top + IN_H * (1 - Math.min(1, Math.max(0, v)));

function frame(title: string, subtitle: string, body: string, yLabel: string, xLabel: string): string {
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map(
      (t) =>
        `<line x1="${px(0)}" y1="${py(t)}" x2="${px(1)}" y2="${py(t)}" stroke="${C.hairline}" stroke-width="1"/>` +
        `<text x="${px(0) - 8}" y="${py(t) + 4}" font-size="11" fill="${C.muted}" text-anchor="end">${Math.round(t * 100)}%</text>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, system-ui, sans-serif">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<text x="${PAD.left - 46}" y="24" font-size="15" font-weight="600" fill="${C.ink}">${esc(title)}</text>
<text x="${PAD.left - 46}" y="40" font-size="11" fill="${C.muted}">${esc(subtitle)}</text>
${grid}
<text x="${PAD.left - 46}" y="${H - 8}" font-size="11" fill="${C.muted}">${esc(yLabel)}</text>
<text x="${px(0.5)}" y="${H - 8}" font-size="11" fill="${C.muted}" text-anchor="middle">${esc(xLabel)}</text>
${body}
</svg>`;
}

const legend = (items: { label: string; color: string }[]) =>
  items
    .map(
      (it, i) =>
        `<rect x="${W - PAD.right + 10}" y="${PAD.top + 4 + i * 20}" width="10" height="10" rx="2" fill="${it.color}"/>` +
        `<text x="${W - PAD.right + 26}" y="${PAD.top + 13 + i * 20}" font-size="11" fill="${C.ink}">${esc(it.label)}</text>`,
    )
    .join('');

const POLICY_COLOR: Record<PolicyName, string> = {
  heirloom: C.heirloom,
  'no-fade': C.muted,
  'count-3': C.blue,
};
const POLICY_LABEL: Record<PolicyName, string> = {
  heirloom: 'Heirloom',
  'no-fade': 'No fading',
  'count-3': 'Counting rule',
};

/** Chart 1: readable share per week, our model against both baselines. */
export function readableShareChart(r: CohortResult): string {
  const weeks = r.weekly.heirloom.length;
  const xOf = (i: number) => px(weeks <= 1 ? 0.5 : i / (weeks - 1));
  // Drawn back to front: the two testing policies nearly coincide, so ours goes on top,
  // dashed, to make the overlap visible rather than hiding one line under the other.
  const names: PolicyName[] = ['no-fade', 'count-3', 'heirloom'];

  const lines = names
    .map((name) => {
      const d = r.weekly[name].map((p, i) => `${i === 0 ? 'M' : 'L'}${n(xOf(i))},${n(py(p.readableShare))}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${POLICY_COLOR[name]}" stroke-width="${name === 'heirloom' ? 2.5 : 2}" stroke-linejoin="round" ${name === 'no-fade' ? 'stroke-dasharray="5 4"' : name === 'heirloom' ? 'stroke-dasharray="7 3"' : ''}/>`;
    })
    .join('');

  const dots = names
    .flatMap((name) => r.weekly[name].map((p, i) => `<circle cx="${n(xOf(i))}" cy="${n(py(p.readableShare))}" r="3" fill="${POLICY_COLOR[name]}"/>`))
    .join('');

  const xLabels = r.weekly.heirloom
    .map((p, i) => `<text x="${n(xOf(i))}" y="${PAD.top + IN_H + 18}" font-size="11" fill="${C.muted}" text-anchor="middle">${p.week}</text>`)
    .join('');

  // 95% is the share of words you need to know to read comfortably without help. Showing it
  // honestly means showing how far short eight weeks of conversation falls.
  const comprehension =
    `<line x1="${px(0)}" y1="${py(0.95)}" x2="${px(1)}" y2="${py(0.95)}" stroke="${C.mastered}" stroke-width="1" stroke-dasharray="4 3"/>` +
    `<text x="${px(0) + 6}" y="${py(0.95) - 6}" font-size="10" fill="${C.mastered}">95% — comfortable reading without help</text>`;

  return frame(
    'Words the learner can actually read, week by week',
    `${r.config.learners} simulated learners · seed ${r.config.seed} · share of words recalled unaided (true memory)`,
    comprehension +
      lines +
      dots +
      xLabels +
      legend(
        (['heirloom', 'count-3', 'no-fade'] as PolicyName[]).map((name) => ({ label: POLICY_LABEL[name], color: POLICY_COLOR[name] })),
      ),
    'read unaided',
    'week',
  );
}

/** Chart 2: predicted recall against what actually happened. The diagonal is perfect calibration. */
export function calibrationChart(r: CohortResult): string {
  const pts = r.calibration;
  const diagonal = `<line x1="${px(0)}" y1="${py(0)}" x2="${px(1)}" y2="${py(1)}" stroke="${C.muted}" stroke-width="1" stroke-dasharray="4 4"/>`;
  const maxN = Math.max(1, ...pts.map((b: CalibrationBucket) => b.n));
  const dots = pts
    .map(
      (b: CalibrationBucket) =>
        `<circle cx="${n(px(b.predicted))}" cy="${n(py(b.actual))}" r="${n(3 + 7 * Math.sqrt(b.n / maxN))}" fill="${C.heirloom}" fill-opacity="0.75"/>`,
    )
    .join('');
  const path = pts.map((b: CalibrationBucket, i: number) => `${i === 0 ? 'M' : 'L'}${n(px(b.predicted))},${n(py(b.actual))}`).join(' ');
  const xLabels = [0, 0.25, 0.5, 0.75, 1]
    .map((t) => `<text x="${n(px(t))}" y="${PAD.top + IN_H + 18}" font-size="11" fill="${C.muted}" text-anchor="middle">${Math.round(t * 100)}%</text>`)
    .join('');
  const total = pts.reduce((s: number, b: CalibrationBucket) => s + b.n, 0);

  return frame(
    'Is the model right about what the learner remembers?',
    `${total.toLocaleString('en-US')} predictions · dot size = how many · dashed line = perfect calibration`,
    diagonal +
      `<path d="${path}" fill="none" stroke="${C.heirloom}" stroke-width="2"/>` +
      dots +
      xLabels +
      legend([
        { label: 'Observed', color: C.heirloom },
        { label: 'Perfect', color: C.muted },
      ]),
    'actually recalled',
    'model said',
  );
}

/** Chart 3: three words' true memory over 8 weeks, with each contact marked. */
export function forgettingChart(r: CohortResult): string {
  const start = r.config.start;
  const end = start + r.weekly.heirloom.length * 7 * 86_400_000;
  const span = Math.max(1, end - start);
  const tx = (at: number) => px((at - start) / span);
  const colors = [C.heirloom, C.mastered, C.fading];

  const body = r.traces
    .map((t: WordTrace, i: number) => {
      const color = colors[i % colors.length] as string;
      const d = t.curve.map((p, j) => `${j === 0 ? 'M' : 'L'}${n(tx(p.at))},${n(py(p.recall))}`).join(' ');
      const marks = t.events
        .map(
          (e) =>
            `<circle cx="${n(tx(e.at))}" cy="${n(py(1))}" r="2.5" fill="${color}" fill-opacity="${e.kind === 'retrieval' ? 1 : 0.35}"/>`,
        )
        .join('');
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>${marks}`;
    })
    .join('');

  const weekLabels = Array.from({ length: r.weekly.heirloom.length + 1 }, (_, i) => i)
    .map((i) => `<text x="${n(px(i / r.weekly.heirloom.length))}" y="${PAD.top + IN_H + 18}" font-size="11" fill="${C.muted}" text-anchor="middle">${i}</text>`)
    .join('');

  return frame(
    'Three words, remembered and forgotten',
    'True memory of one simulated learner. Solid dots are recalls, faded dots are glosses read.',
    body +
      weekLabels +
      legend(
        r.traces.map((t: WordTrace, i: number) => ({ label: t.lemma, color: colors[i % colors.length] as string })),
      ),
    'chance of recall',
    'week',
  );
}


/**
 * Chart 4: the cost of a wrong "they know this" call. Both testing policies teach about as much;
 * what separates them is how often they withhold the gloss for a word the learner cannot recall.
 */
const BAR_LABEL: Record<PolicyName, string> = {
  heirloom: 'Heirloom (this model)',
  'no-fade': 'No fading (always translate)',
  'count-3': 'Counting rule (known after 3 reads)',
};

export function strandedChart(r: CohortResult): string {
  const order: PolicyName[] = ['heirloom', 'count-3', 'no-fade'];
  const rows = order.map((name) => ({ name, d: r.decisions[name] as DecisionQuality }));
  const max = Math.max(0.06, ...rows.map((x) => x.d.strandedRate));
  const barH = 34;
  const gap = 26;

  const body = rows
    .map((x, i) => {
      const y = PAD.top + 24 + i * (barH + gap);
      const w = x.d.unhelped ? Math.max(2, (x.d.strandedRate / max) * IN_W) : 0;
      const label = x.d.unhelped
        ? `${(x.d.strandedRate * 100).toFixed(1)}%  (${x.d.stranded.toLocaleString('en-US')} of ${x.d.unhelped.toLocaleString('en-US')})`
        : 'never withholds help';
      return (
        `<rect x="${px(0)}" y="${y}" width="${n(w)}" height="${barH}" rx="4" fill="${POLICY_COLOR[x.name]}" fill-opacity="${x.name === 'heirloom' ? 1 : 0.8}"/>` +
        `<text x="${px(0)}" y="${y - 6}" font-size="12" font-weight="600" fill="${C.ink}">${esc(BAR_LABEL[x.name])}</text>` +
        `<text x="${n(px(0) + w + 12)}" y="${y + barH / 2 + 4}" font-size="12" fill="${C.muted}">${esc(label)}</text>`
      );
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, system-ui, sans-serif">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<text x="16" y="26" font-size="15" font-weight="600" fill="${C.ink}">Left stranded: the gloss was hidden, the word was gone</text>
<text x="16" y="44" font-size="11" fill="${C.muted}">${r.config.learners} simulated learners · seed ${r.config.seed} · lower is better</text>
${body}
<text x="16" y="${H - 16}" font-size="11" fill="${C.muted}">Both testing policies teach about as much. This is what separates them.</text>
</svg>`;
}
