#!/usr/bin/env node
// Fails if any workspace package.json lists a dependency that isn't in scripts/allowed-deps.json.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowed = JSON.parse(readFileSync(join(root, 'scripts', 'allowed-deps.json'), 'utf8'));
const matchesPattern = (name) =>
  allowed.patterns.some((p) => (p.endsWith('*') ? name.startsWith(p.slice(0, -1)) : name === p));

const problems = [];
for (const ws of Object.keys(allowed).filter((k) => !['patterns', '_comment'].includes(k))) {
  const file = join(root, ws, 'package.json');
  if (!existsSync(file)) continue; // e.g. client/ before Phase 0 creates it
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  for (const name of deps) {
    if (!allowed[ws].includes(name) && !matchesPattern(name)) problems.push(`${ws}: ${name}`);
  }
}
if (problems.length) {
  console.error(
    `Unapproved dependencies:\n  ${problems.join('\n  ')}\n` +
      'Ask the human before adding packages (AGENTS.md, Dependencies). If approved, add them to scripts/allowed-deps.json.',
  );
  process.exit(1);
}
