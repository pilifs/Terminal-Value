// Aggregating normalized records into a snapshot. Owned by stream A (data):
// llm-dlc/loops/software-factory-data.md.
//
// Interface, frozen in Phase 0 (docs/software-factory.md):
//
//   GENERATOR = { name: 'blog/software-factory/metrics.mjs', version: '1' }
//     Bump version whenever the same input would give different output.
//
//   aggregate(normalized, { config, configSha256, metricDefinitions })
//     -> { manifest, overview, details: { sessions, changes, verification, examples } }
//     Every value schema-valid (validate.mjs), with its snapshot id made as
//     identity.mjs describes. Implements config/metrics.json: weighted ratios,
//     unavailable (null) for a zero denominator, days rebucketed in the
//     timezone from UTC timestamps, changes deduplicated by change id, process
//     outcome kept apart from semantic signals, stocks kept apart from period
//     activity, and coverage carried with every value. For the fixture in
//     test/fixtures/upstream it reproduces the usage and verification tables,
//     measures and stocks of test/fixtures/snapshot-example.

export const GENERATOR = { name: 'blog/software-factory/metrics.mjs', version: '1' };

export function aggregate() {
  throw new Error('metrics.mjs aggregate: not implemented yet (stream A)');
}
