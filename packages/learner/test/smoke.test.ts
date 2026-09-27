import assert from 'node:assert/strict';
import { test } from 'node:test';
import { constants, recall } from '../src/index.js';

test('recall is 0.5 after one half-life', () => {
  assert.equal(recall(7, 7), 0.5);
});

test('constants match the reference thresholds', () => {
  assert.equal(constants.MASTERED_R, 0.9);
  assert.equal(constants.MASTERY_MIN_S, 7);
});
