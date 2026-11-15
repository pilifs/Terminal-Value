// The Software Factory pages that show a snapshot's numbers, in the browser:
// the overview and the feature loops, model performance, code and usage pages.
// The static page already has the all-time numbers. This checks for newer data
// while the tab is visible and loads a page's records when a reader opens them;
// on the usage page it adds the date range, model and effort filters and the
// chart's measure (kept in the URL). Each part runs where its elements are.
// The logic is in the pure modules beside it (state, snapshot, poll, view,
// details, measures-local, and stream A's measures); this file only reads and
// writes the page.
//
// Data: the remote /software-factory/data/latest.json first, and on any failure
// the bundled /software-factory/static-data/ snapshot, whole. New data is
// announced with a count and shown only when the reader asks, so nothing moves
// under them.

import { chartSvg, chartTable } from './chart.js';
import { detailCount, detailTable, FIRST_ROWS } from './details.js';
import {
  campaignRunsHtml,
  changePlotHtml,
  codeHtml,
  exampleRecordHtml,
  examplesHtml,
  findingsHtml,
  heroHtml,
  loopsHtml,
  matchWords,
  runRecordHtml,
  toolChartHtml,
  toolsHtml,
  usageHtml,
  enduranceHtml,
} from './factory.js';
import { escapeHtml as e, formatCoverage, formatValue } from './format.js';
import { METRICS, trend, usageBreakdown } from './measures-local.js';
import { computeMeasures, series } from './measures.js';
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

  // A remote snapshot made by an older version of the generator that made the
  // page's own bundled one lacks what this page draws (the publisher hasn't
  // caught up with the site yet): the bundled snapshot is shown instead,
  // whole, until it does.
  const generator = { name: shell.dataset.generator, version: Number(shell.dataset.generatorVersion) || 0 };
  const behind = (snap) => snap.manifest.generator?.name === generator.name && Number(snap.manifest.generator.version) < generator.version;

  let first;
  try {
    first = await firstSnapshot({ remote, bundled, fetch: get });
    if (first.source === 'remote' && behind(first.snapshot)) first = { ...(await firstSnapshot({ remote: null, bundled, fetch: get })), remoteError: null };
  } catch {
    if (status) status.textContent += ' The filters are unavailable: the data file could not be loaded.';
    return;
  }

  let current = first.snapshot; // the snapshot on screen
  let pending = null; // a newer one, waiting for the reader
  let state = fitState(parseState(location.search), current.overview);
  // Poll the remote pointer unless the route is missing (an empty bucket is not:
  // its first publish is announced); then the bundled one, which changes when
  // the site is redeployed.
  const pollBase = first.source === 'remote' || !first.remoteError?.missing ? remote : bundled;
  let etag = pollBase === (first.source === 'remote' ? remote : bundled) ? first.etag : null;
  const detailLoads = new Map();

  // Controls: the usage page's filters and its chart's measure ----------------
  const form = $('[data-sf-filters]');
  const measure = $('[data-sf-measure]');
  const filtered = Boolean(form && measure && status);
  if (filtered)
    form.innerHTML =
      `<label>Date range <select name="period">${PERIODS.map((p) => `<option value="${p}">${PERIOD_LABELS[p]}</option>`).join('')}</select></label>` +
      `<label>Model <select name="model"></select></label>` +
      `<label>Effort <select name="effort"></select></label>` +
      `<a class="sf-view-link" href="" data-sf-link>Link to this view</a>`;
  const select = (name) => form.querySelector(`select[name="${name}"]`);
  const link = form?.querySelector('[data-sf-link]');
  status?.setAttribute('aria-live', 'polite');

  function fillOptions() {
    if (!filtered) return;
    const ov = current.overview;
    select('model').innerHTML =
      `<option value="">All models</option>` + ov.models.map((m) => `<option value="${e(m.id)}">${e(m.label)}</option>`).join('');
    select('effort').innerHTML =
      `<option value="">All efforts</option>` + ov.efforts.map((x) => `<option value="${e(x)}">${e(x)}</option>`).join('');
  }

  function syncControls() {
    if (!filtered) return;
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

  if (filtered) {
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
  }

  // Drawing ----------------------------------------------------------------
  function renderView() {
    if (!filtered) return;
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
    const points = trend(series(ov, id, opts), current.manifest, id);
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
    const insights = $('[data-sf-insights]');
    if (insights) insights.innerHTML = insightItems(ov.insights);
    drawFactory(snap);
    const texts = stockTexts(ov.stocks);
    for (const tile of $$('[data-stock]')) {
      const t = texts[tile.dataset.stock];
      if (!t) continue;
      $('[data-value]', tile).textContent = t.value;
      $('[data-coverage]', tile).textContent = t.note;
      for (const code of tile.querySelectorAll('.sf-metric-scope code')) code.textContent = shortSha(snap.manifest.source.sha);
    }
    const source = $('[data-sf-source]');
    if (source) source.innerHTML = exploreSourceHtml(snap.manifest);
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
      if (filtered) history.replaceState(null, '', viewUrl(state));
    }
    syncControls();
  }

  // The leading sections -------------------------------------------------------
  // Drawn whole from a snapshot, as the build drew them: the overview's headline
  // and findings, and the loops, tools and code pages. A snapshot from before
  // they were measured says so in each section.
  let runs = null; // the loops collection of the snapshot on screen, once asked for
  let examples = null; // and its examples collection
  const section = (name) => $(`[data-sf-section="${name}"]`);

  /** After a section is drawn: show its controls, and leave one tooltip, ours. */
  function readyFactory(root = shell) {
    const control = $('[data-sf-tool-model]');
    if (control) control.hidden = false;
    for (const title of $$('[data-tip] > title', root)) title.parentNode.removeChild(title);
    for (const mark of $$('[data-tip][title]', root)) mark.removeAttribute('title');
    if (root === shell) {
      readyFacets();
      readyInspector();
    }
  }

  function drawFactory(snap) {
    const hero = section('hero');
    const sections = {
      hero: () => heroHtml(snap, { title: hero.dataset.title, lede: hero.dataset.lede }),
      findings: () => findingsHtml(snap, { examples: catalog }),
      loops: () => loopsHtml(snap),
      examples: () => examplesHtml(snap, catalog),
      tools: () => toolsHtml(snap),
      code: () => codeHtml(snap),
      usage: () => usageHtml(snap),
      sessions: () => enduranceHtml(snap),
    };
    catalog = null;
    for (const [name, html] of Object.entries(sections)) {
      const el = section(name);
      if (el) el.innerHTML = html();
    }
    runs = null;
    examples = null;
    readyFactory();
    nameCatalog(snap);
  }

  // The overview and the catalog's page name the catalog's squares from the
  // examples collection. The build did that for the snapshot it had; for
  // another, the squares are drawn by verdict first and named once that
  // snapshot's records are here.
  let catalog = null;
  async function nameCatalog(snap) {
    const findings = section('findings');
    const page = section('examples');
    if (!(findings || page) || !snap.manifest.collections.some((c) => c.name === 'examples')) return;
    try {
      examples ??= loadCollection(snap, 'examples', { fetch: get });
      const file = await examples;
      if (snap !== current) return;
      catalog = file.records;
      if (findings) findings.innerHTML = findingsHtml(snap, { examples: catalog });
      if (page) page.innerHTML = examplesHtml(snap, catalog);
      readyFactory();
    } catch {
      // Unnamed squares are still right; the next snapshot tries again.
      examples = null;
    }
  }

  shell.addEventListener('change', (ev) => {
    if (ev.target.name !== 'tool-model') return;
    const chart = $('[data-sf-tool-chart]');
    chart.innerHTML = toolChartHtml(current.overview, ev.target.value === '' ? null : Number(ev.target.value));
    readyFactory(chart);
  });

  // The catalog's page narrows its grid: a square carries a token for each of
  // its values (data-f), a list above the grid picks one token, and a square
  // stays lit when it has every token picked. No record is needed for it.
  const facetCells = () => $$('.sf-catalog .sf-cell[data-f]');
  function narrow() {
    const form = $('[data-sf-facets]');
    if (!form) return;
    const want = $$('[data-sf-facet]', form)
      .map((s) => s.value)
      .filter(Boolean);
    const lit = [];
    for (const cell of facetCells()) {
      const has = cell.dataset.f.split(' ');
      const on = want.every((t) => has.includes(t));
      cell.classList.toggle('sf-cell-off', !on);
      if (on) lit.push(has);
      else cell.classList.remove(PICKS.example.on);
    }
    for (const li of $$('[data-sf-titles] li[data-for]')) li.hidden = Boolean(document.getElementById(`example-${li.dataset.for}`)?.classList.contains('sf-cell-off'));
    $('[data-sf-facet-status]').textContent = matchWords(lit, facetCells().length);
    $('[data-sf-titles-count]').textContent = `${lit.length.toLocaleString('en-US')} ${lit.length === 1 ? 'example' : 'examples'}`;
    $('[data-sf-facet-reset]', form).hidden = !want.length;
    // The pick stays if it is still lit, and its place among them is counted again.
    if (PICKS.example.picked !== null) pick('example', PICKS.example.picked);
  }
  /** Narrow to a set of tokens: each goes to the list that has it, and the other lists are cleared. */
  function show(tokens) {
    const form = $('[data-sf-facets]');
    if (!form) return;
    for (const select of $$('[data-sf-facet]', form)) select.value = tokens.find((t) => [...select.options].some((o) => o.value === t)) ?? '';
    narrow();
  }
  function readyFacets() {
    const form = $('[data-sf-facets]');
    if (!form) return;
    form.hidden = false;
    for (const el of $$('[data-sf-facet-status], [data-sf-starts]')) el.hidden = false;
  }
  shell.addEventListener('change', (ev) => {
    if (ev.target.matches?.('[data-sf-facet]')) narrow();
  });
  shell.addEventListener('reset', (ev) => {
    // The lists have their first value again only after the event.
    if (ev.target.matches?.('[data-sf-facets]')) setTimeout(narrow);
  });
  shell.addEventListener('click', (ev) => {
    const link = ev.target.closest?.('[data-sf-show]');
    if (!link || !$('[data-sf-facets]')) return;
    ev.preventDefault();
    show(link.dataset.sfShow.split(' '));
    const top = $('#every-example');
    const y = top.getBoundingClientRect().top;
    if (y < 0 || y > window.innerHeight / 2) top.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  // A campaign's runs and cycles, from the loops collection, loaded once per snapshot.
  async function openCampaign(d) {
    const body = $('[data-sf-campaign-body]', d);
    const snap = current;
    if (d.dataset.loaded === snap.manifest.snapshotId) return;
    body.innerHTML = '<p class="sf-muted">Loading…</p>';
    try {
      runs ??= loadCollection(snap, 'loops', { fetch: get });
      const file = await runs;
      if (snap !== current) return;
      body.innerHTML = campaignRunsHtml(file.records, d.dataset.sfCampaign);
      d.dataset.loaded = snap.manifest.snapshotId;
    } catch {
      runs = null;
      body.innerHTML = '<p>These runs could not be loaded. Close this and open it again to retry.</p>';
    }
  }
  // A mark picked on a figure, and its record under it: a run on the floor (from
  // the loops collection) or an example in the catalog (from the examples
  // collection). The address keeps the pick (#run-<id>, #example-<id>), so one
  // can be linked to. The step buttons reach every mark without a pointer.
  const PICKS = {
    run: {
      marks: '.sf-floor .sf-run[data-run]',
      idOf: (el) => el.dataset.run,
      on: 'sf-run-on',
      records: (snap) => (runs ??= loadCollection(snap, 'loops', { fetch: get })),
      forget: () => (runs = null),
      html: (record, snap) => runRecordHtml(record, { models: snap.overview.models }),
      picked: null,
    },
    example: {
      marks: '.sf-catalog .sf-cell[data-example]:not(.sf-cell-off)',
      idOf: (el) => el.dataset.example,
      on: 'sf-cell-on',
      records: (snap) => (examples ??= loadCollection(snap, 'examples', { fetch: get })),
      forget: () => (examples = null),
      html: (record, snap) => exampleRecordHtml(record, { sha: snap.manifest.source.sha }),
      picked: null,
    },
  };
  /** The mark the address names, as [noun, id], or null. */
  function pickInAddress() {
    try {
      const hash = decodeURIComponent(location.hash.slice(1));
      const noun = Object.keys(PICKS).find((k) => hash.startsWith(`${k}-`));
      return noun ? [noun, hash.slice(noun.length + 1)] : null;
    } catch {
      return null;
    }
  }

  async function pick(noun, id, { address = true } = {}) {
    const kind = PICKS[noun];
    const box = $(`[data-sf-inspect="${noun}"]`);
    if (!box) return;
    const marks = $$(kind.marks);
    const order = marks.map(kind.idOf);
    if (!order.includes(id)) id = null;
    kind.picked = id;
    for (const el of marks) el.classList.toggle(kind.on, id !== null && kind.idOf(el) === id);
    const [earlier, later, close] = [-1, 1, 0].map((n) => $(`[data-sf-step="${n}"]`, box));
    const at = $('[data-sf-inspect-at]', box);
    const body = $('[data-sf-inspect-body]', box);
    at.dataset.hint ??= at.textContent;
    later.dataset.first ??= later.textContent;
    const i = order.indexOf(id);
    const held = document.activeElement;
    earlier.hidden = close.hidden = id === null;
    earlier.disabled = i <= 0;
    later.disabled = id !== null && i === order.length - 1;
    later.textContent = id === null ? later.dataset.first : `Later ${noun}`;
    // A button that just went away or dead hands the focus to the one that still steps.
    if (box.contains(held) && (held.hidden || held.disabled)) (later.disabled ? earlier : later).focus();
    if (address && !filtered) history.replaceState(null, '', id === null ? `${location.pathname}${location.search}` : `#${noun}-${encodeURIComponent(id)}`);
    if (id === null) {
      at.textContent = at.dataset.hint;
      body.innerHTML = '';
      return;
    }
    at.textContent = `${noun[0].toUpperCase()}${noun.slice(1)} ${i + 1} of ${order.length}`;
    const snap = current;
    if (!body.firstChild) body.innerHTML = '<p class="sf-muted">Loading…</p>';
    try {
      const file = await kind.records(snap);
      if (snap !== current || kind.picked !== id) return;
      const record = file.records.find((r) => r.id === id);
      body.innerHTML = record ? kind.html(record, snap) : `<p>This ${noun} has no record in the snapshot.</p>`;
    } catch {
      kind.forget();
      if (kind.picked === id) body.innerHTML = `<p>This ${noun} could not be loaded. Pick it again to retry.</p>`;
    }
  }

  /** After a figure is drawn: show where a picked record goes, and keep the pick. */
  function readyInspector() {
    for (const [noun, kind] of Object.entries(PICKS)) {
      const box = $(`[data-sf-inspect="${noun}"]`);
      if (!box) continue;
      box.hidden = false;
      $(kind.marks)?.parentElement.setAttribute('data-pick', '');
      if (kind.picked !== null) pick(noun, kind.picked, { address: false });
    }
  }

  shell.addEventListener('click', (ev) => {
    for (const [noun, kind] of Object.entries(PICKS)) {
      const mark = ev.target.closest?.(kind.marks);
      if (!mark) continue;
      pick(noun, kind.idOf(mark));
      // The record goes under the figure: bring both into view when it would land out of sight.
      const box = $(`[data-sf-inspect="${noun}"]`);
      if (box && box.getBoundingClientRect().top > window.innerHeight - 160)
        mark.parentElement.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    const step = ev.target.closest?.('[data-sf-step]');
    const noun = step?.closest('[data-sf-inspect]')?.dataset.sfInspect;
    if (!PICKS[noun]) return;
    const kind = PICKS[noun];
    const order = $$(kind.marks).map(kind.idOf);
    const by = Number(step.dataset.sfStep);
    pick(noun, by === 0 ? null : kind.picked === null ? order[0] : (order[order.indexOf(kind.picked) + by] ?? kind.picked));
  });
  window.addEventListener('hashchange', () => {
    const named = pickInAddress();
    if (named && named[1] !== PICKS[named[0]].picked) pick(named[0], named[1], { address: false });
  });

  // Every change as a dot, from the changes collection: drawn when opened.
  async function openChangePlot(d) {
    const body = $('[data-sf-change-plot-body]', d);
    const snap = current;
    if (d.dataset.loaded === snap.manifest.snapshotId) return;
    body.innerHTML = '<p class="sf-muted">Loading…</p>';
    try {
      const file = await loadCollection(snap, 'changes', { fetch: get });
      if (snap !== current) return;
      body.innerHTML = changePlotHtml(file.records, { median: Number(d.dataset.median) || null });
      d.dataset.loaded = snap.manifest.snapshotId;
      readyFactory(body);
    } catch {
      body.innerHTML = '<p>These changes could not be loaded. Close this and open it again to retry.</p>';
    }
  }
  // toggle doesn't bubble, so it is caught on the way down.
  shell.addEventListener(
    'toggle',
    (ev) => {
      const d = ev.target;
      if (d.matches?.('[data-sf-campaign]') && d.open) openCampaign(d);
      if (d.matches?.('[data-sf-change-plot]') && d.open) openChangePlot(d);
    },
    true
  );

  // One tooltip for every mark that carries data-tip. It follows the pointer;
  // the keyboard doesn't need it, since each chart has its table.
  const tip = document.createElement('div');
  tip.className = 'sf-tip';
  tip.hidden = true;
  tip.setAttribute('aria-hidden', 'true');
  shell.append(tip);
  shell.addEventListener('pointermove', (ev) => {
    const mark = ev.target.closest?.('[data-tip]');
    if (!mark || ev.pointerType === 'touch') {
      tip.hidden = true;
      return;
    }
    tip.textContent = mark.dataset.tip;
    tip.hidden = false;
    const box = shell.getBoundingClientRect();
    const x = Math.min(Math.max(ev.clientX - box.left + 12, 0), box.width - tip.offsetWidth);
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(ev.clientY - box.top + 16)}px)`;
  });
  shell.addEventListener('pointerleave', () => {
    tip.hidden = true;
  });

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

  // A link to a closed <details>, or to something inside one, opens it: other
  // pages point at the records here (usage/#explore-changes).
  function openTarget() {
    let target = null;
    try {
      target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    } catch {
      return;
    }
    if (!target || !shell.contains(target)) return;
    let opened = false;
    for (let el = target; el && el !== shell; el = el.parentElement)
      if (el.tagName === 'DETAILS' && !el.open) {
        el.open = true;
        opened = true;
      }
    if (opened) target.scrollIntoView();
  }
  window.addEventListener('hashchange', openTarget);

  // New data ----------------------------------------------------------------
  const notice = document.createElement('div');
  notice.className = 'sf-update';
  notice.setAttribute('role', 'status');
  notice.innerHTML = `<p><span data-text tabindex="-1"></span> <button type="button" data-sf-refresh hidden>Show the new data</button></p>`;
  $('[data-sf-notice]').append(notice);
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
    if (behind(r.snapshot)) return;
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
  if (filtered) {
    form.hidden = false;
    measure.hidden = false;
  }
  if (current.manifest.snapshotId !== shell.dataset.snapshot) showSnapshot(current);
  else readyFactory();
  renderView();
  if (filtered) {
    const canonical = viewUrl(state);
    if (`${location.pathname}${location.search}${location.hash}` !== canonical) history.replaceState(null, '', canonical);
  }
  openTarget();
  if (pickInAddress()) pick(...pickInAddress(), { address: false });

  createPoller({
    check,
    isVisible: () => document.visibilityState === 'visible',
    onVisibilityChange: (fn) => document.addEventListener('visibilitychange', fn),
  }).start();
}

const shell = document.querySelector('[data-sf-page][data-snapshot]');
if (shell) start(shell);
