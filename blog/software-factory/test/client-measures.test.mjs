// The dashboard's period measures, from stream A's measures.mjs (the browser
// loads it as /software-factory/measures.js), with the dashboard's own helpers in
// blog/assets/software-factory/measures-local.js, and the chart and formatting
// modules. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chartSvg, niceTicks } from '../../assets/software-factory/chart.js';
import { formatCoverage, formatTick, formatValue } from '../../assets/software-factory/format.js';
import { datasetDays, METRICS, periodRange, torontoDay, trend } from '../../assets/software-factory/measures-local.js';
import { computeMeasures, series } from '../measures.mjs';
import { loadSnapshot } from '../index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { snapshot } = loadSnapshot(path.join(HERE, 'fixtures', 'snapshot-example'));
const { overview, manifest } = snapshot;
const config = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'config', 'metrics.json'), 'utf8'));

test('the metric table agrees with config/metrics.json', () => {
  assert.equal(config.version, '3');
  for (const m of config.metrics) {
    assert.equal(METRICS[m.id]?.unit, m.unit, m.id);
    assert.deepEqual(METRICS[m.id].filters, m.filters, m.id);
  }
  assert.equal(Object.keys(METRICS).length, config.metrics.length);
});

test('unfiltered, the measures equal the snapshot all-time measures', () => {
  for (const m of computeMeasures(overview)) {
    const expected = overview.measures.find((x) => x.id === m.id);
    assert.equal(m.value, expected.value, m.id);
    assert.equal(m.filtered, true, 'no filter asked for, none left out');
  }
});

test('a filter a metric does not support is not applied, and says so', () => {
  const byModel = computeMeasures(overview, { models: ['claude-opus-5-5'] });
  const usd = byModel.find((m) => m.id === 'usage_usd');
  const jobs = byModel.find((m) => m.id === 'verification_completed');
  assert.ok(Math.abs(usd.value - 30.304283) < 1e-9, 'usage follows the model filter');
  assert.equal(usd.filtered, true);
  assert.equal(jobs.value, 12, 'verification ignores it');
  assert.equal(jobs.filtered, false);
});

test('a period is the last days of the snapshot, half-open, and an empty range is null', () => {
  assert.deepEqual(periodRange(overview, '7d'), { from: '2026-11-02', to: '2026-11-09' });
  assert.deepEqual(periodRange(overview, 'all'), { from: null, to: null });
  const week = computeMeasures(overview, periodRange(overview, '7d'));
  assert.ok(Math.abs(week.find((m) => m.id === 'usage_usd').value - 14.673111) < 1e-9);
  const none = computeMeasures(overview, { from: '2027-01-01', to: '2027-01-08' });
  for (const m of none) {
    const stock = METRICS[m.id].filters.length === 0;
    // A stock is a snapshot total: no period applies, and the record says so.
    assert.equal(m.value, stock ? overview.measures.find((x) => x.id === m.id).value : null, m.id);
    if (stock) assert.equal(m.filtered, false, m.id);
  }
  // A filter that leaves no calls: the ratio has no denominator, so no value.
  const cache = computeMeasures(overview, { efforts: ['no-such-effort'] }).find((m) => m.id === 'cache_reuse');
  assert.equal(cache.value, null);
});

test('series give one value per day, and trend leaves unmeasured days null', () => {
  const s = series(overview, 'model_calls');
  assert.equal(s.length, overview.days.length);
  assert.equal(s.reduce((t, p) => t + p.value, 0), 590);
  assert.deepEqual(datasetDays(manifest, 'usage'), { first: '2026-10-30', last: '2026-11-02' });
  assert.deepEqual(datasetDays(manifest, 'verification'), { first: '2026-11-07', last: '2026-11-08' });
  const t = trend(series(overview, 'verification_completed'), manifest, 'verification_completed');
  assert.deepEqual(t.filter((p) => p.value !== null), [{ day: '2026-11-07', value: 2 }, { day: '2026-11-08', value: 10 }]);
});

test('Toronto days cross the DST change on 2026-11-01', () => {
  assert.equal(torontoDay('2026-11-01T03:59:59Z'), '2026-10-31'); // EDT, UTC-4
  assert.equal(torontoDay('2026-11-01T04:00:00Z'), '2026-11-01');
  assert.equal(torontoDay('2026-11-02T04:59:59Z'), '2026-11-01'); // EST, UTC-5
  assert.equal(torontoDay('2026-11-02T05:00:00Z'), '2026-11-02');
});

test('values are formatted in their unit, and missing is never 0', () => {
  assert.equal(formatValue(101.072856, 'usd'), '$101.07');
  assert.equal(formatValue(0.004, 'usd'), '< $0.01');
  assert.equal(formatValue(0.9770595, 'ratio'), '97.7%');
  assert.equal(formatValue(19963, 'calls'), '19,963');
  assert.equal(formatValue(85.6, 'seconds'), '86 s');
  assert.equal(formatValue(null, 'usd'), 'No data');
  assert.equal(formatTick(20000, 'calls'), '20K');
  assert.deepEqual([0, 5, 10, 15].map((t) => formatTick(t, 'usd')), ['$0', '$5', '$10', '$15']);
  assert.deepEqual([2.5, 0.01].map((t) => formatTick(t, 'usd')), ['$2.50', '$0.01']);
  assert.equal(formatCoverage({ included: 4, total: 5, note: 'sessions with a metrics file' }), '4 of 5 sessions with a metrics file');
});

test('the chart has clean ticks and an accessible name', () => {
  assert.deepEqual(niceTicks(41, 'usd'), [0, 20, 40, 60]);
  assert.deepEqual(niceTicks(10, 'jobs'), [0, 5, 10]);
  assert.deepEqual(niceTicks(0, 'jobs'), [0, 1]);
  // A count never gets a tick at a fraction (it would print 0, 1, 1).
  assert.deepEqual(niceTicks(1, 'jobs'), [0, 1]);
  assert.deepEqual(niceTicks(2, 'calls'), [0, 1, 2]);
  assert.deepEqual(niceTicks(0.03, 'usd'), [0, 0.01, 0.02, 0.03]);
  const svg = chartSvg([{ day: '2026-11-01', value: 3 }, { day: '2026-11-02', value: null }], { label: 'Model calls', unit: 'calls' });
  assert.match(svg, /<title id="sf-trend-title">Model calls per day<\/title>/);
  assert.match(svg, /1 of 2 days with a value; highest 3/);
  // A compact shape for phones, with ids of its own.
  assert.match(svg, /<svg class="sf-chart sf-chart-compact" viewBox="0 0 360 240"[^>]*aria-labelledby="sf-trend-compact-title sf-trend-compact-desc"/);
  assert.equal(new Set(svg.match(/id="[^"]+"/g)).size, 4);
});
