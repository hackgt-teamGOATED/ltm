/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dividerLabel, needsDivider } from './format.ts';

const now = new Date(2026, 8, 26, 21, 41);

test('dividerLabel: today, yesterday, this week, older', () => {
  assert.match(dividerLabel(new Date(2026, 8, 26, 9, 5).toISOString(), now), /^Today \d/);
  assert.match(dividerLabel(new Date(2026, 8, 25, 23, 59).toISOString(), now), /^Yesterday \d/);
  assert.match(dividerLabel(new Date(2026, 8, 22, 12, 0).toISOString(), now), /^\w{3} \d/);
  assert.match(dividerLabel(new Date(2026, 7, 3, 12, 0).toISOString(), now), /^\w{3} 3, \d/);
});

test('needsDivider: first message and gaps over an hour only', () => {
  const a = new Date(2026, 8, 26, 9, 0).toISOString();
  assert.equal(needsDivider(undefined, a), true);
  assert.equal(needsDivider(a, new Date(2026, 8, 26, 9, 59).toISOString()), false);
  assert.equal(needsDivider(a, new Date(2026, 8, 26, 10, 1).toISOString()), true);
});
