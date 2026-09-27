// Pure coordinate maths for the hand-rolled charts (PLAN.md §3 allows no chart library).
// Kept out of the .tsx so it can be unit-tested: Node's test runner only loads .ts.

export const CHART_W = 300;
export const CHART_PAD = { left: 30, right: 10, top: 10, bottom: 20 };

/**
 * Maps a point index to an x, and a 0–1 value to a y.
 * The y axis is always the full 0–100%, never fitted to the data, so a weak week can't be
 * flattered by rescaling (PROJECT.md principle 7). Values outside 0–1 are clamped.
 */
export function chartScales(count: number, height: number) {
  const innerW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const innerH = height - CHART_PAD.top - CHART_PAD.bottom;
  return {
    // A single point sits in the middle rather than dividing by zero.
    x: (i: number) => CHART_PAD.left + (count <= 1 ? innerW / 2 : (innerW * i) / (count - 1)),
    y: (v: number) => CHART_PAD.top + innerH * (1 - Math.min(1, Math.max(0, v))),
  };
}
