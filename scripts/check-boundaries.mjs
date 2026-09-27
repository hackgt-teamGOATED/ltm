#!/usr/bin/env node
// Enforces two rules:
//   packages/learner/          pure learner model: no imports outside the package, no npm packages
//   client/app, client/src     mobile-ready: browser globals only inside *.web.ts(x) files
// Usage: node scripts/check-boundaries.mjs [files...]   (no args = scan everything)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RULES = [
  {
    dir: 'packages/learner',
    skip: ['packages/learner/dist', 'packages/learner/node_modules'],
    allowRelative: ['packages/learner'],
    allowPackage: (spec) => spec === 'node:test' || spec === 'node:assert' || spec.startsWith('node:assert/'),
    why: 'packages/learner must stay pure: no network, storage, timers or app code. Callers pass data and `now`.',
  },
];

// Mobile-ready rule for the Expo client: browser globals only in *.web.ts(x) files.
const CLIENT_DIRS = ['client/app', 'client/src'];
const DOM_RE = /\b(window|document|navigator|localStorage|sessionStorage|MediaRecorder)\s*[.(]/;
const DOM_WHY = 'Browser APIs break the native build. Put them in a *.web.ts(x) file with a matching *.ts(x) native version.';

const walk = (d, skip) =>
  !existsSync(d) || skip.some((s) => d === join(root, s))
    ? []
    : readdirSync(d).flatMap((f) => {
        const p = join(d, f);
        return statSync(p).isDirectory() ? walk(p, skip) : /\.(ts|tsx|mjs|js)$/.test(p) ? [p] : [];
      });

const args = process.argv.slice(2).map((f) => resolve(f));
const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;
const problems = [];

for (const rule of RULES) {
  const base = join(root, rule.dir);
  const files = args.length ? args.filter((f) => f.startsWith(base + sep)) : walk(base, rule.skip);
  let hit = false;
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
      const spec = m[1] || m[2] || m[3];
      if (spec.startsWith('.')) {
        const target = relative(root, resolve(dirname(file), spec));
        if (!rule.allowRelative.some((a) => target === a || target.startsWith(`${a}/`))) {
          problems.push(`${relative(root, file)}: imports '${spec}'`);
          hit = true;
        }
      } else if (!rule.allowPackage(spec)) {
        problems.push(`${relative(root, file)}: imports package '${spec}'`);
        hit = true;
      }
    }
  }
  if (hit) problems.push(`  why: ${rule.why}`);
}

for (const d of CLIENT_DIRS) {
  const base = join(root, d);
  const files = args.length ? args.filter((f) => f.startsWith(base + sep)) : walk(base, []);
  let hit = false;
  for (const file of files.filter((f) => !/\.web\.(ts|tsx)$/.test(f))) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (DOM_RE.test(line) && !/^\s*(\/\/|\/\*|\*)/.test(line)) {
          problems.push(`${relative(root, file)}:${i + 1}: uses a browser global`);
          hit = true;
        }
      });
  }
  if (hit) problems.push(`  why: ${DOM_WHY}`);
}

if (problems.length) {
  console.error(`Boundary check failed:\n${problems.join('\n')}`);
  process.exit(1);
}
