// Period measures from an overview, for a chosen range and filters: the same
// code runs in the build and, copied to /software-factory/measures.js, in the
// browser. Owned by stream A (data): llm-dlc/loops/software-factory-data.md.
// Plain ES module, no imports, no Node APIs.
//
// Interface, frozen in Phase 0 (docs/software-factory.md):
//
//   computeMeasures(overview, { from, to, models, efforts })
//     -> [{ id, value, unit, numerator, denominator, coverage, filtered }]
//     from and to are local dates (half-open [from, to)); null means
//     unbounded. models and efforts are lists of raw ids, or null for all.
//     A filter a metric doesn't support (config/metrics.json filters) is not
//     applied to it, and its record says so with filtered: false.
//
//   series(overview, metricId, { from, to, models, efforts })
//     -> [{ day, value }] for the trend chart, one per day in range.

export function computeMeasures() {
  throw new Error('measures computeMeasures: not implemented yet (stream A)');
}

export function series() {
  throw new Error('measures series: not implemented yet (stream A)');
}
