/// <reference types="node" />
// Run: npm test -w client. Pure coordinate maths only — no React, no rendering.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHART_PAD, CHART_W, chartScales } from './chart.ts';

const H = 130;

test('chartScales: zero or one point is centred instead of dividing by zero', () => {
  assert.ok(Number.isFinite(chartScales(1, H).x(0)), 'one point is finite');
  assert.ok(Number.isFinite(chartScales(0, H).x(0)), 'no points is finite');
});

test('chartScales: points march left to right and stay inside the plot', () => {
  const { x } = chartScales(8, H);
  const xs = Array.from({ length: 8 }, (_, i) => x(i));
  assert.ok(
    xs.every((v, i) => i === 0 || v > xs[i - 1]),
    `strictly increasing: ${xs}`,
  );
  assert.ok(xs[0] >= CHART_PAD.left, 'first point clears the y labels');
  assert.ok(Math.max(...xs) <= CHART_W - CHART_PAD.right, 'last point stays in frame');
});

test('chartScales: the y axis is a fixed 0-100%, never fitted to the data', () => {
  const { y } = chartScales(5, H);
  assert.ok(y(0) > y(1), '0% sits below 100%');
  // The same value maps to the same pixel whatever else is in the series. This is what stops
  // a weak week being flattered by rescaling the axis to the data.
  assert.equal(chartScales(2, H).y(0.3), chartScales(40, H).y(0.3));
});

test('chartScales: out-of-range values clamp instead of drawing off-chart', () => {
  const { y } = chartScales(3, H);
  assert.equal(y(-5), y(0), 'negative clamps to the floor');
  assert.equal(y(42), y(1), 'above 1 clamps to the ceiling');
});
