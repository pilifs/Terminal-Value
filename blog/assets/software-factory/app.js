// The Software Factory overview in the browser. The static page already has
// the all-time numbers; this adds the date range, model and effort filters and
// the chart's measure (kept in the URL), checks for newer data while the tab is
// visible, and loads the deeper exploration's records when a reader opens one.
// The logic is in the pure modules beside it (state, snapshot, poll, view,
// details, measures-local); this file only reads and writes the page.
//
// Data: the remote /software-factory/data/latest.json first, and on any failure
// the bundled /software-factory/static-data/ snapshot, whole. New data is
// announced with a count and shown only when the reader asks, so nothing moves
// under them.

import { chartSvg, chartTable } from './chart.js';
import { detailCount, detailTable, FIRST_ROWS } from './details.js';
import { escapeHtml as e, formatCoverage, formatValue } from './format.js';
import { computeMeasures, METRICS, trend, usageBreakdown } from './measures-local.js';
import { createPoller } from './poll.js';
import { collectionUrl, firstSnapshot, loadCollection, loadSnapshot, newRecords } from './snapshot.js';
import { describeState, fitState, parseState, PERIOD_LABELS, PERIODS, queryOptions, sameState, serializeState } from './state.js';
import {
  announcement,
  breakdownRows,
  breakdownTag,
  breakdownUnit,
  chartCaption,
  dataAsOf,
  exploreSourceHtml,
  freshnessHtml,
  insightItems,
  METRIC_LABELS,
  metricScope,
  shortSha,
  stockTexts,
} from './view.js';

const get = (...args) => fetch(...args);
const unfiltered = (s) => s.period === 'all' && !s.model && !s.effort;

async function start(shell) {
  const $ = (sel, root = shell) => root.querySelector(sel);
  const $$ = (sel, root = shell) => [...root.querySelectorAll(sel)];
  const remote = shell.dataset.remoteData;
  const bundled = shell.dataset.staticData;
  const status = $('[data-sf-static]');

  let first;
  try {
    first = await firstSnapshot({ remote, bundled, fetch: get });
  } catch {
    if (status) status.textContent += ' The filters are unavailable: the data file could not be loaded.';
    return;
  }

  let current = first.snapshot; // the snapshot on screen
  let pending = null; // a newer one, waiting for the reader
  let state = fitState(parseState(location.search), current.overview);
  // Poll the remote pointer unless the route is missing; then the bundled one,
  // which changes when the site is redeployed.
  const pollBase = first.source === 'remote' || !first.remoteError?.missing ? remote : bundled;
  let etag = pollBase === (first.source === 'remote' ? remote : bundled) ? first.etag : null;
  const detailLoads = new Map();

  // Controls ---------------------------------------------------------------
  const form = $('[data-sf-filters]');
  const measure = $('[data-sf-measure]');
  form.innerHTML =
    `<label>Date range <select name="period">${PERIODS.map((p) => `<option value="${p}">${PERIOD_LABELS[p]}</option>`).join('')}</select></label>` +
    `<label>Model <select name="model"></select></label>` +
    `<label>Effort <select name="effort"></select></label>` +
    `<a class="sf-view-link" href="" data-sf-link>Link to this view</a>`;
  const select = (name) => form.querySelector(`select[name="${name}"]`);
  const link = form.querySelector('[data-sf-link]');
  status.setAttribute('aria-live', 'polite');

  function fillOptions() {
    const ov = current.overview;
    select('model').innerHTML =
      `<option value="">All models</option>` + ov.models.map((m) => `<option value="${e(m.id)}">${e(m.label)}</option>`).join('');
    select('effort').innerHTML =
      `<option value="">All efforts</option>` + ov.efforts.map((x) => `<option value="${e(x)}">${e(x)}</option>`).join('');
  }

  function syncControls() {
    select('period').value = state.period;
    select('model').value = state.model ?? '';
    select('effort').value = state.effort ?? '';
    for (const r of measure.querySelectorAll('input[name="measure"]')) r.checked = r.value === state.measure;
  }

  const viewUrl = (s) => `${location.pathname}${serializeState(s)}${location.hash}`;

  function update(next) {
    if (sameState(next, state)) return;
    state = next;
    history.pushState(null, '', viewUrl(state));
    renderView();
  }

  form.addEventListener('submit', (ev) => ev.preventDefault());
  form.addEventListener('change', () =>
    update({ ...state, period: select('period').value, model: select('model').value || null, effort: select('effort').value || null })
  );
  measure.addEventListener('change', (ev) => {
    if (ev.target.name === 'measure') update({ ...state, measure: ev.target.value });
  });
  window.addEventListener('popstate', () => {
    const next = fitState(parseState(location.search), current.overview);
    if (sameState(next, state)) return;
    state = next;
    syncControls();
    renderView();
  });

  // Drawing ----------------------------------------------------------------
  function renderView() {
    const ov = current.overview;
    const opts = queryOptions(state, ov);
    status.textContent = describeState(state, ov);
    link.href = viewUrl(state);

    // The default view shows the snapshot's own all-time values, as the static page does.
    const measures = unfiltered(state) ? ov.measures : computeMeasures(ov, opts);
    for (const card of $$('[data-metric]')) {
      const m = measures.find((x) => x.id === card.dataset.metric);
      if (!m) continue;
      const shown = { ...m, scope: ov.measures.find((x) => x.id === m.id)?.scope ?? 'all-time' };
      $('[data-value]', card).textContent = formatValue(m.value, m.unit);
      $('[data-scope]', card).textContent = metricScope(shown, state, ov);
      $('[data-coverage]', card).textContent = `Coverage: ${formatCoverage(m.coverage)}`;
    }

    const id = state.measure;
    const points = trend(ov, current.manifest, id, opts);
    const chart = { label: METRIC_LABELS[id], unit: METRICS[id].unit };
    $('[data-sf-caption]').textContent = chartCaption(id, state, ov);
    $('[data-sf-chart]').innerHTML = chartSvg(points, chart);
    $('[data-sf-table]').innerHTML = chartTable(points, chart);

    for (const section of $$('[data-breakdown]')) {
      const b = ov.breakdowns.find((x) => x.id === section.dataset.breakdown);
      const rows = $('[data-rows]', section);
      if (!b) {
        rows.innerHTML = breakdownRows([], 'usd');
        continue;
      }
      // Usage breakdowns follow the view; others are the snapshot's as published.
      const live = b.scope !== 'snapshot' && ['model', 'effort'].includes(b.dimension) && b.metricId in METRICS;
      const data = live && !unfiltered(state) ? usageBreakdown(ov, b, opts) : b;
      rows.innerHTML = breakdownRows(data.rows, breakdownUnit(b));
      $('[data-tag]', section).textContent = live
        ? breakdownTag(b, state, ov)
        : `${breakdownTag(b)}${b.scope !== 'snapshot' && !unfiltered(state) ? ' · filters not applied' : ''}`;
      $('[data-coverage]', section).textContent = `Coverage: ${formatCoverage(data.coverage)}`;
    }
  }

  /** Put a whole snapshot's numbers on the page (first load of a newer one, or the reader's refresh). */
  function showSnapshot(snap) {
    const ov = snap.overview;
    current = snap;
    shell.dataset.snapshot = snap.manifest.snapshotId;
    $('[data-sf-freshness]').innerHTML = freshnessHtml(snap);
    $('[data-sf-insights]').innerHTML = insightItems(ov.insights);
    const texts = stockTexts(ov.stocks);
    for (const tile of $$('[data-stock]')) {
      const t = texts[tile.dataset.stock];
      if (!t) continue;
      $('[data-value]', tile).textContent = t.value;
      $('[data-coverage]', tile).textContent = t.note;
      for (const code of tile.querySelectorAll('.sf-metric-scope code')) code.textContent = shortSha(snap.manifest.source.sha);
    }
    $('[data-sf-source]').innerHTML = exploreSourceHtml(snap.manifest);
    for (const d of $$('[data-sf-detail]')) {
      const c = snap.manifest.collections.find((x) => x.name === d.dataset.sfDetail);
      $('[data-count]', d).textContent = (c?.records ?? 0).toLocaleString('en-US');
      const json = $('[data-json]', d);
      if (c && json) json.href = collectionUrl(snap, c.path);
      resetDetail(d);
    }
    fillOptions();
    const fitted = fitState(state, ov);
    if (!sameState(fitted, state)) {
      state = fitted;
      history.replaceState(null, '', viewUrl(state));
    }
    syncControls();
  }

  // Deeper exploration, loaded when opened -----------------------------------
  function renderDetail(d, records, limit) {
    const body = $('[data-sf-detail-body]', d);
    const more = records.length > limit ? ' <button type="button" data-more>Show all</button>' : '';
    body.innerHTML = `${detailTable(d.dataset.sfDetail, records, { limit })}<p class="sf-caption" tabindex="-1" data-shown>${e(detailCount(records, limit))}${more}</p>`;
    $('[data-more]', body)?.addEventListener('click', () => {
      renderDetail(d, records, records.length);
      $('[data-shown]', body).focus();
    });
  }

  async function loadDetail(d) {
    const name = d.dataset.sfDetail;
    const body = $('[data-sf-detail-body]', d);
    const snap = current;
    detailLoads.get(name)?.abort();
    const controller = new AbortController();
    detailLoads.set(name, controller);
    d.dataset.loaded = 'loading';
    body.setAttribute('aria-busy', 'true');
    body.innerHTML = '<p class="sf-muted">Loading…</p>';
    try {
      const file = await loadCollection(snap, name, { fetch: get, signal: controller.signal });
      if (controller.signal.aborted || snap !== current) return;
      renderDetail(d, file.records, FIRST_ROWS);
      d.dataset.loaded = 'yes';
    } catch {
      if (controller.signal.aborted) return;
      delete d.dataset.loaded;
      body.innerHTML = `<p>These records could not be loaded. <button type="button" data-retry>Try again</button></p>`;
      $('[data-retry]', body).addEventListener('click', () => loadDetail(d));
    } finally {
      if (detailLoads.get(name) === controller) {
        detailLoads.delete(name);
        body.removeAttribute('aria-busy');
      }
    }
  }

  function resetDetail(d) {
    detailLoads.get(d.dataset.sfDetail)?.abort();
    detailLoads.delete(d.dataset.sfDetail);
    delete d.dataset.loaded;
    $('[data-sf-detail-body]', d).innerHTML = '';
    if (d.open) loadDetail(d);
  }

  for (const d of $$('[data-sf-detail]'))
    d.addEventListener('toggle', () => {
      if (d.open && !d.dataset.loaded) loadDetail(d);
    });

  // New data ----------------------------------------------------------------
  const notice = document.createElement('div');
  notice.className = 'sf-update';
  notice.setAttribute('role', 'status');
  notice.innerHTML = `<p><span data-text tabindex="-1"></span> <button type="button" data-sf-refresh hidden>Show the new data</button></p>`;
  $('.sf-controls').append(notice);
  const noticeText = $('[data-text]', notice);
  const refresh = $('[data-sf-refresh]', notice);

  function announce() {
    noticeText.textContent = announcement(newRecords(current.manifest, pending.manifest), dataAsOf(pending));
    refresh.hidden = false;
  }

  refresh.addEventListener('click', () => {
    if (!pending) return;
    showSnapshot(pending);
    pending = null;
    renderView();
    refresh.hidden = true;
    const asOf = dataAsOf(current);
    noticeText.textContent = `Showing the new data${asOf ? `, as of ${$('[data-sf-freshness] time')?.textContent ?? asOf}` : ''}.`;
    noticeText.focus();
  });

  async function check(signal) {
    const r = await loadSnapshot(pollBase, { fetch: get, signal, etag, current: pending ?? current });
    if (r.etag) etag = r.etag;
    if (r.status === 'unchanged') return;
    if (r.status === 'same') {
      if (!pending) {
        // Same data, a newer source check: only the quiet freshness line changes.
        current.pointer = r.pointer;
        $('[data-sf-freshness]').innerHTML = freshnessHtml(current);
      }
      return;
    }
    if (r.snapshot.manifest.snapshotId === current.manifest.snapshotId) {
      pending = null;
      refresh.hidden = true;
      noticeText.textContent = '';
      return;
    }
    pending = r.snapshot;
    announce();
  }

  // Start -------------------------------------------------------------------
  fillOptions();
  syncControls();
  form.hidden = false;
  measure.hidden = false;
  if (current.manifest.snapshotId !== shell.dataset.snapshot) showSnapshot(current);
  renderView();
  const canonical = viewUrl(state);
  if (`${location.pathname}${location.search}${location.hash}` !== canonical) history.replaceState(null, '', canonical);

  createPoller({
    check,
    isVisible: () => document.visibilityState === 'visible',
    onVisibilityChange: (fn) => document.addEventListener('visibilitychange', fn),
  }).start();
}

const shell = document.querySelector('[data-sf-page="overview"][data-snapshot]');
if (shell) start(shell);
