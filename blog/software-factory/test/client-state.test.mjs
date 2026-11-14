// The overview's URL state (blog/assets/software-factory/state.js): parsing,
// the round trip, and fitting a link's filters to the snapshot that loaded.
// Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_STATE,
  describeState,
  fitState,
  MEASURES,
  parseState,
  PERIODS,
  queryOptions,
  rangeText,
  sameState,
  serializeState,
} from '../../assets/software-factory/state.js';
import { loadSnapshot } from '../index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { overview } = loadSnapshot(path.join(HERE, 'fixtures', 'snapshot-example')).snapshot;
const config = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'config', 'metrics.json'), 'utf8'));

test('the periods and chart measures agree with config/metrics.json', () => {
  assert.deepEqual(PERIODS, config.periods.choices);
  assert.equal(DEFAULT_STATE.period, config.periods.default);
  assert.deepEqual(MEASURES, config.chart);
});

test('every state survives the URL round trip', () => {
  const states = [];
  for (const period of PERIODS)
    for (const model of [null, ...overview.models.map((m) => m.id)])
      for (const effort of [null, ...overview.efforts])
        for (const measure of MEASURES) states.push({ period, model, effort, measure });
  for (const s of states) {
    const search = serializeState(s);
    assert.ok(sameState(parseState(search), s), `${JSON.stringify(s)} -> ${search}`);
    assert.ok(sameState(fitState(parseState(search), overview), s));
  }
  assert.equal(states.length, 3 * 5 * 3 * 4);
});

test('the default view has a bare URL, and a link is stable', () => {
  assert.equal(serializeState(DEFAULT_STATE), '');
  assert.deepEqual(parseState(''), { ...DEFAULT_STATE });
  const s = { period: '7d', model: 'claude-opus-5-5', effort: 'high', measure: 'model_calls' };
  assert.equal(serializeState(s), '?period=7d&model=claude-opus-5-5&effort=high&measure=model_calls');
  // The order in a hand-written link doesn't matter; the canonical form is the same.
  assert.equal(serializeState(parseState('?measure=model_calls&effort=high&model=claude-opus-5-5&period=7d')), serializeState(s));
});

test('unknown values fall back, and the snapshot decides model and effort', () => {
  const s = parseState('?period=90d&measure=nonsense&model=gpt-x&effort=extreme&utm_source=feed');
  assert.equal(s.period, 'all');
  assert.equal(s.measure, 'usage_usd');
  assert.equal(s.model, 'gpt-x', 'kept until a snapshot is loaded');
  const fitted = fitState(s, overview);
  assert.equal(fitted.model, null);
  assert.equal(fitted.effort, null);
  assert.equal(serializeState(fitted), '');
  assert.equal(parseState('?model=%3Cscript%3E').model, '<script>');
});

test('a period ends on the snapshot’s last day, not the reader’s clock', () => {
  assert.deepEqual(queryOptions({ ...DEFAULT_STATE, period: '7d', model: 'claude-opus-5-5' }, overview), {
    from: '2026-11-02',
    to: '2026-11-09',
    models: ['claude-opus-5-5'],
    efforts: null,
  });
  assert.deepEqual(queryOptions(DEFAULT_STATE, overview), { from: null, to: null, models: null, efforts: null });
});

test('the view is described in words, with the filters’ reach', () => {
  assert.equal(describeState(DEFAULT_STATE, overview), 'Showing all time, all models and efforts.');
  assert.equal(
    describeState({ ...DEFAULT_STATE, period: '7d', model: 'claude-opus-5-5' }, overview),
    'Showing the last 7 days (Nov 2–8, 2026), Opus 5.5, all efforts. Model and effort apply to the usage panels only; each panel says what it follows.'
  );
  assert.equal(rangeText('2026-10-10', '2026-11-09'), 'Oct 10 – Nov 8, 2026');
  assert.equal(rangeText('2025-12-30', '2026-01-02'), 'Dec 30, 2025 – Jan 1, 2026');
  assert.equal(rangeText('2026-11-08', '2026-11-09'), 'Nov 8, 2026');
});
