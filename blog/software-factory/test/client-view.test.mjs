// The pieces the build and the browser both draw (view.js), the usage
// breakdowns recomputed for a view, and the deeper exploration's tables
// (details.js). Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { detailCount, detailTable } from '../../assets/software-factory/details.js';
import { computeMeasures, usageBreakdown } from '../../assets/software-factory/measures-local.js';
import { DEFAULT_STATE, queryOptions } from '../../assets/software-factory/state.js';
import { breakdownRows, breakdownTag, chartCaption, METRIC_LABELS, metricScope } from '../../assets/software-factory/view.js';
import { loadSnapshot } from '../index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, 'fixtures', 'snapshot-example');
const { snapshot } = loadSnapshot(DIR);
const { overview, manifest, pointer } = snapshot;
const config = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'config', 'metrics.json'), 'utf8'));
const details = (name) => JSON.parse(fs.readFileSync(path.join(DIR, path.dirname(pointer.manifest), 'details', `${name}.json`), 'utf8'));

test('the labels agree with config/metrics.json', () => {
  assert.deepEqual(METRIC_LABELS, Object.fromEntries(config.metrics.map((m) => [m.id, m.label])));
});

test('unfiltered, the usage breakdowns equal the snapshot’s', () => {
  for (const b of overview.breakdowns.filter((x) => ['model', 'effort'].includes(x.dimension))) {
    const mine = usageBreakdown(overview, b);
    assert.deepEqual(mine.rows.map((r) => [r.key, r.label]), b.rows.map((r) => [r.key, r.label]), b.id);
    mine.rows.forEach((r, i) => {
      assert.ok(Math.abs(r.value - b.rows[i].value) < 1e-9, `${b.id} ${r.key} value`);
      assert.ok(Math.abs(r.share - b.rows[i].share) < 1e-12, `${b.id} ${r.key} share`);
    });
    assert.equal(mine.coverage.included, b.coverage.included);
    assert.equal(mine.coverage.total, b.coverage.total);
  }
});

test('a filtered breakdown follows only the filters its metric takes', () => {
  const byModel = overview.breakdowns.find((b) => b.id === 'usage-by-model');
  const byEffort = overview.breakdowns.find((b) => b.id === 'usage-by-effort');
  const opusHigh = queryOptions({ ...DEFAULT_STATE, model: 'claude-opus-5-5', effort: 'high' }, overview);
  // Usage share by model ignores the model filter: every model with high-effort usage is listed.
  const models = usageBreakdown(overview, byModel, opusHigh);
  assert.ok(models.rows.every((r) => r.value > 0));
  assert.ok(Math.abs(models.rows.reduce((s, r) => s + r.share, 0) - 1) < 1e-9);
  // Usage by effort takes both: only Opus at high effort, if any.
  const efforts = usageBreakdown(overview, byEffort, opusHigh);
  assert.ok(efforts.rows.every((r) => r.key === 'high'));
  const usd = computeMeasures(overview, opusHigh).find((m) => m.id === 'usage_usd').value;
  assert.ok(Math.abs(efforts.rows.reduce((s, r) => s + r.value, 0) - usd) < 1e-9, 'the rows sum to the filtered usage');
  assert.match(breakdownRows([], 'usd'), /No data for this view/);
  assert.equal(breakdownTag(byModel, { ...DEFAULT_STATE, period: '7d', model: 'claude-opus-5-5', effort: 'high' }, overview), 'Last 7 days · high effort');
  assert.equal(breakdownTag(overview.breakdowns.find((b) => b.scope === 'snapshot')), 'Snapshot total');
});

test('each metric and the chart say which filters apply', () => {
  const state = { ...DEFAULT_STATE, period: '30d', model: 'claude-opus-5-5' };
  const m = (id) => ({ id, unit: config.metrics.find((x) => x.id === id).unit, scope: 'all-time' });
  assert.equal(metricScope(m('usage_usd')), 'All time · US dollars');
  assert.equal(metricScope(m('usage_usd'), state, overview), 'Last 30 days · Opus 5.5 · US dollars');
  assert.equal(metricScope(m('verification_completed'), state, overview), 'Last 30 days · jobs · the model filter doesn’t apply');
  assert.equal(metricScope({ ...m('changes_recorded'), scope: 'snapshot' }, state, overview), 'Snapshot total · changes');
  assert.equal(
    chartCaption('verification_completed', { ...state, effort: 'high' }, overview),
    'Completed verification jobs per day, last 30 days (Oct 10 – Nov 8, 2026), in jobs. Days are calendar days in Toronto; a day the data doesn\'t cover shows no column. The model and effort filters don’t apply to this measure.'
  );
  assert.match(chartCaption('model_calls', state, overview), /^Model calls per day, last 30 days \(Oct 10 – Nov 8, 2026\), Opus 5\.5 only, in calls\./);
});

test('the deeper exploration’s tables show raw ids, escape, and shorten a long list', () => {
  const changes = details('changes').records;
  const html = detailTable('changes', changes);
  assert.equal((html.match(/<tr>/g) ?? []).length, 21, 'a header and the first 20');
  assert.match(html, /<code>pqkrtxsktnwt<\/code>/);
  assert.equal(detailCount(changes, 20), 'Showing 20 of 64.');
  assert.equal((detailTable('changes', changes, { limit: changes.length }).match(/<tr>/g) ?? []).length, 65);

  for (const name of ['sessions', 'verification', 'examples']) {
    const records = details(name).records;
    const table = detailTable(name, records);
    assert.equal((table.match(/<tr>/g) ?? []).length, Math.min(records.length, 20) + 1, name);
  }
  const hostile = detailTable('examples', [
    { id: '<b>', title: '<script>alert(1)</script>', origin: 'constructed', system: null, verdict: null, verdictLabel: null, vacuous: true, freshness: null, tags: {} },
  ]);
  assert.doesNotMatch(hostile, /<script>|<b>/);
  assert.match(hostile, /&lt;script&gt;/);
  const sessions = detailTable('sessions', [{ ...details('sessions').records[0], summaryUrl: 'javascript:alert(1)' }]);
  assert.doesNotMatch(sessions, /javascript:/);
  assert.match(detailTable('verification', []), /No records in this snapshot/);
});
