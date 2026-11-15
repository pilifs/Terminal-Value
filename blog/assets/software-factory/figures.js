// Figures for the feature loops, the tools and the code: stacked daily columns
// as SVG strings, and a campaign's runs as lanes of HTML. Drawn the same way by
// the build (static HTML) and the browser (after a filter or a new snapshot).
// Plain functions, no DOM. Colours come from CSS classes under
// body.software-factory: a series is sf-series-<key>.

import { niceTicks } from './chart.js';
import { escapeHtml as e, formatDay, formatTick } from './format.js';

const SHAPES = {
  wide: { W: 640, H: 200, PAD: { top: 12, right: 8, bottom: 28, left: 52 }, labels: 8 },
  compact: { W: 360, H: 230, PAD: { top: 12, right: 6, bottom: 28, left: 44 }, labels: 4 },
};
const GAP = 1.5; // the surface gap between stacked segments, in viewBox units
const fixed = (n) => Number(n.toFixed(1));

/** A segment: rounded at its data end when it is the outermost one, square otherwise. */
function segment(x, y, w, h, round, down) {
  if (!round) return `M${x},${y}h${w}v${h}h${-w}Z`;
  const r = Math.min(4, w / 2, h);
  return down
    ? `M${x},${y}h${w}v${fixed(h - r)}q0,${r} ${-r},${r}h${fixed(-(w - 2 * r))}q${-r},0 ${-r},${-r}Z`
    : `M${x},${y + h}V${fixed(y + r)}q0,${-r} ${r},${-r}h${fixed(w - 2 * r)}q${r},0 ${r},${r}V${y + h}Z`;
}

/**
 * Daily columns of stacked series, with an optional second stack below the
 * baseline (the same unit, so one axis).
 *
 *   points: [{ day, up: [n, ...], down: [n, ...], tip }] in day order; a point
 *     whose `up` is null has no value (a short mark, never a zero column).
 *   series: { up: [{ key, label }], down: [{ key, label }] }
 *   unit: 'ratio' for shares (ticks as %), else a count; title names the chart.
 * Returns the wide and the compact <svg>; a table is the text equivalent, and
 * `table` says where it is when it isn't under the chart.
 */
export function columnsSvg(points, { id, title, series, unit = 'count', desc = '', slim = false, table = 'The table below lists every day.' }) {
  return ['wide', 'compact'].map((shape) => columnsShape(points, { id: shape === 'wide' ? id : `${id}-compact`, title, series, unit, desc, shape, slim, table })).join('');
}

function columnsShape(points, { id, title, series, unit, desc, shape, slim, table }) {
  const { W, labels, ...size } = SHAPES[shape];
  // A slim chart sits under a taller one on the same days. A flagged point
  // (point.flag) gets a diamond in a band above the plot.
  const flagged = points.some((p) => p.flag);
  const H = slim ? size.H - 70 : size.H + (flagged ? 12 : 0);
  const PAD = { ...size.PAD, top: size.PAD.top + (flagged ? 12 : 0) };
  const sum = (list) => (list ?? []).reduce((t, v) => t + (v ?? 0), 0);
  const measured = points.filter((p) => p.up !== null);
  const maxUp = Math.max(0, ...measured.map((p) => sum(p.up)));
  const maxDown = Math.max(0, ...measured.map((p) => sum(p.down)));
  const ticksUp = unit === 'ratio' ? shareTicks(maxUp) : niceTicks(maxUp, 'count');
  const top = ticksUp.at(-1);
  // The stack below the baseline shares the scale: its depth is its share of the height.
  const step = ticksUp[1] - ticksUp[0];
  const ticksDown = [];
  for (let v = step; maxDown > 0 && v < maxDown + step * 0.999; v += step) ticksDown.push(v);
  const bottom = ticksDown.at(-1) ?? 0;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const scale = plotH / (top + bottom || 1);
  const base = PAD.top + top * scale;
  const band = plotW / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(24, band - 2));
  const every = Math.ceil(points.length / labels);
  const tick = (v) => (unit === 'ratio' ? `${Number((v * 100).toFixed(2))}%` : formatTick(v, 'count'));

  const grid = [...ticksUp.map((t) => [t, base - t * scale]), ...ticksDown.map((t) => [t, base + t * scale])]
    .map(
      ([t, ty]) =>
        `<line class="sf-grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${fixed(ty)}" y2="${fixed(ty)}"/>` +
        `<text class="sf-tick" x="${PAD.left - 6}" y="${fixed(ty)}" dy="0.32em" text-anchor="end">${e(tick(t))}</text>`
    )
    .join('');

  const marks = points
    .map((p, i) => {
      const cx = PAD.left + band * i + band / 2;
      const x = fixed(cx - barW / 2);
      const label =
        i % every === 0
          ? `<text class="sf-tick" x="${fixed(cx)}" y="${H - PAD.bottom + 16}" text-anchor="middle">${e(formatDay(p.day, { year: false }))}</text>`
          : '';
      const hit =
        (p.flag ? `<path class="sf-flag" d="M${fixed(cx)},3l4.5,4.5l-4.5,4.5l-4.5,-4.5Z"/>` : '') +
        `<rect class="sf-hit" x="${fixed(cx - band / 2)}" y="${PAD.top}" width="${fixed(band)}" height="${plotH}"/>`;
      const tip = `<title>${e(p.tip)}</title>`;
      if (p.up === null)
        return `<g class="sf-day sf-day-none" data-tip="${e(p.tip)}">${tip}<line class="sf-none" x1="${x}" x2="${fixed(cx + barW / 2)}" y1="${fixed(base)}" y2="${fixed(base)}"/>${hit}${label}</g>`;
      const stack = (values, keys, down) => {
        let offset = 0;
        const last = values.findLastIndex((v) => v > 0);
        return values
          .map((v, k) => {
            if (!(v > 0)) return '';
            const h = v * scale;
            const y = down ? base + offset : base - offset - h;
            offset += h;
            // The gap comes off the segment's inner edge, so stacks still reach their total.
            const inner = k > 0 && h > GAP * 2 ? GAP : 0;
            const d = segment(x, fixed(down ? y + inner : y), fixed(barW), fixed(Math.max(0.5, h - inner)), k === last, down);
            return `<path class="sf-seg sf-series-${keys[k].key}" d="${d}"/>`;
          })
          .join('');
      };
      return `<g class="sf-day" data-tip="${e(p.tip)}">${tip}${stack(p.up, series.up, false)}${p.down ? stack(p.down, series.down ?? [], true) : ''}${hit}${label}</g>`;
    })
    .join('');

  return (
    `<svg class="sf-chart sf-chart-${shape}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-title ${id}-desc">` +
    `<title id="${id}-title">${e(title)}</title><desc id="${id}-desc">${e(desc)} ${e(table)}</desc>` +
    grid +
    `<line class="sf-axis" x1="${PAD.left}" x2="${W - PAD.right}" y1="${fixed(base)}" y2="${fixed(base)}"/>` +
    marks +
    `</svg>`
  );
}

/** Ticks for a share: 0 to the first clean top that holds the largest value, in steps that are clean too (0.5%, 1%, 2%, 5%, 10%, 25%). */
export function shareTicks(max) {
  const scales = [[0.01, 5], [0.02, 4], [0.04, 4], [0.05, 5], [0.08, 4], [0.1, 5], [0.2, 4], [0.25, 5], [0.4, 4], [0.5, 5], [1, 4]];
  const [top, steps] = scales.find(([t]) => t >= max) ?? scales.at(-1);
  return Array.from({ length: steps + 1 }, (_, i) => Number(((top * i) / steps).toPrecision(6)));
}

/** A legend for two or more series: a swatch and its name, in text ink. `flag` names what a diamond marks. */
export function legendHtml(series, { flag = null } = {}) {
  const diamond = flag ? `<li><span class="sf-swatch sf-swatch-flag" aria-hidden="true"></span>${e(flag)}</li>` : '';
  return `<ul class="sf-legend">${series.map((s) => `<li><span class="sf-swatch sf-series-${e(s.key)}" aria-hidden="true"></span>${e(s.label)}</li>`).join('')}${diamond}</ul>`;
}

/**
 * A campaign's runs as lanes, one per loop, on one clock from the campaign's
 * first start to its last end. A bar is a run; a notch in it is a cycle's
 * commit. lanes: [{ label, runs: [{ from, to, ticks: [ms], tip }] }], times in ms.
 */
export function lanesHtml(lanes, { from, to, startLabel, endLabel }) {
  const span = Math.max(1, to - from);
  const pct = (ms) => Number((((ms - from) / span) * 100).toFixed(2));
  const rows = lanes
    .map((lane) => {
      const bars = lane.runs
        .map((r) => {
          const left = pct(r.from);
          const width = Math.max(0.6, pct(r.to) - left);
          const length = Math.max(1, r.to - r.from);
          const notches = r.ticks
            .filter((t) => t > r.from && t < r.to)
            .map((t) => `<i style="left:${Number((((t - r.from) / length) * 100).toFixed(2))}%"></i>`)
            .join('');
          return `<span class="sf-run" style="left:${left}%;width:${Number(width.toFixed(2))}%" title="${e(r.tip)}" data-tip="${e(r.tip)}">${notches}</span>`;
        })
        .join('');
      return `<div class="sf-lane"><span class="sf-lane-label">${e(lane.label)}</span><span class="sf-lane-track">${bars}</span></div>`;
    })
    .join('');
  return `<div class="sf-lanes" aria-hidden="true">${rows}<div class="sf-lane sf-lane-axis"><span class="sf-lane-label"></span><span class="sf-lane-scale"><span>${e(startLabel)}</span><span>${e(endLabel)}</span></span></div></div>`;
}

const BREAK = 2.5; // the width of a cut in the floor's clock, in percent

/**
 * Every run on one clock, with the long pauses cut out of it: the floor.
 *
 *   panels: [{ from, to, pause }] in order, times in ms; each is drawn to the
 *     same scale, and `pause` says how long the cut before it was.
 *   rows: how many rows the plot has. A run sits in row `row`, from 0.
 *   runs: [{ id, from, to, row, ticks: [ms], tip, flag }]; a notch per tick, and a
 *     marker on a run's end when `flag` is set. With an id a run can be linked
 *     to (#run-<id>) and picked.
 *   names: [{ at, until, label, href }]: a link over the plot, with room to `until`.
 *   nights: [{ from, to }], shaded behind the runs.
 *   ticks: [{ at, label, kind }], kind 'start' (a panel's first), 'day' or 'hour'.
 * The plot is a picture of records that the linked page lists, so only the
 * names are read out.
 */
export function floorHtml({ panels, rows, runs, names, nights, ticks }) {
  const total = panels.reduce((t, p) => t + (p.to - p.from), 0) || 1;
  const scale = (100 - BREAK * (panels.length - 1)) / total;
  let left = 0;
  const placed = panels.map((p) => {
    const at = { ...p, left, width: (p.to - p.from) * scale };
    left += at.width + BREAK;
    return at;
  });
  const x = (ms) => {
    const p = placed.findLast((q) => ms >= q.from) ?? placed[0];
    return Number((p.left + (Math.min(Math.max(ms, p.from), p.to) - p.from) * scale).toFixed(2));
  };
  const box = (from, to) => `left:${x(from)}%;width:${Number(Math.max(0, x(to) - x(from)).toFixed(2))}%`;
  const shade = nights.map((n) => `<span class="sf-floor-night" style="${box(n.from, n.to)}"></span>`).join('');
  const cuts = placed
    .slice(1)
    .map((p) => `<span class="sf-floor-break" style="left:${Number((p.left - BREAK).toFixed(2))}%;width:${BREAK}%" title="${e(p.pause)}" data-tip="${e(p.pause)}"></span>`)
    .join('');
  const bars = runs
    .map((r) => {
      const width = x(r.to) - x(r.from);
      const length = Math.max(1, r.to - r.from);
      // A run too short to be more than a sliver carries no notches.
      const notches =
        width < 0.6
          ? ''
          : r.ticks
              .filter((t) => t > r.from && t < r.to)
              .map((t) => `<i style="left:${Number((((t - r.from) / length) * 100).toFixed(2))}%"></i>`)
              .join('');
      const name = r.id ? ` id="run-${e(r.id)}" data-run="${e(r.id)}"` : '';
      return `<span class="sf-run${r.flag ? ' sf-run-flag' : ''}"${name} style="${box(r.from, r.to)};--sf-row:${r.row}" title="${e(r.tip)}" data-tip="${e(r.tip)}">${notches}</span>`;
    })
    .join('');
  const labels = names
    .map((n) => `<li style="left:${x(n.at)}%;width:${Number(Math.max(0, x(n.until) - x(n.at) - 0.6).toFixed(2))}%"><a href="${e(n.href)}"><code>${e(n.label)}</code></a></li>`)
    .join('');
  // A label starts at its mark. One near a panel's start would run into the
  // start's own label, and one near the right edge ends at its mark instead.
  const marks = ticks
    .filter((t) => t.kind === 'start' || x(t.at) - (placed.findLast((q) => t.at >= q.from) ?? placed[0]).left >= 8)
    .map((t) => `<span class="sf-floor-tick sf-floor-tick-${e(t.kind)}${x(t.at) > 90 ? ' sf-floor-tick-end' : ''}" style="left:${x(t.at)}%">${e(t.label)}</span>`)
    .join('');
  return `<div class="sf-floor" style="--sf-rows:${rows}">
              <ul class="sf-floor-names">${labels}</ul>
              <div class="sf-floor-plot" aria-hidden="true">${shade}${cuts}${bars}</div>
              <div class="sf-floor-axis" aria-hidden="true">${marks}</div>
            </div>`;
}

/**
 * A catalog as a grid of squares, one for each entry, in the order given.
 *   cells: [{ id, key, tip, ring }]: a cell is sf-verdict-<key>; `ring` marks one
 *     out. With an id a cell can be linked to (#example-<id>) and picked.
 * A picture of records a table lists elsewhere, so it is hidden from a screen
 * reader. A cell's words are for the pointer's tooltip only: a title as well
 * would say every one of them twice in the page.
 */
export function catalogHtml(cells) {
  return `<div class="sf-catalog" aria-hidden="true">${cells
    .map((c) => `<span class="sf-cell sf-verdict-${e(c.key)}${c.ring ? ' sf-cell-ring' : ''}"${c.id ? ` id="example-${e(c.id)}" data-example="${e(c.id)}"` : ''}${c.tip ? ` data-tip="${e(c.tip)}"` : ''}></span>`)
    .join('')}</div>`;
}

const PLOTS = {
  wide: { W: 640, H: 340, PAD: { top: 22, right: 14, bottom: 40, left: 52 }, r: 3.4 },
  compact: { W: 360, H: 330, PAD: { top: 22, right: 10, bottom: 40, left: 44 }, r: 3 },
};
const decade = (v) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1000 ? `${v / 1000}K` : String(v));

/**
 * A scatter on two log axes: one dot per record, each a link.
 *
 *   points: [{ x, y, key, tip, href }] with x and y above zero; key picks the
 *     series colour (sf-series-<key>).
 *   guide: { slope, label } draws y = slope * x, a ratio every dot can be read against.
 * Returns the wide and the compact <svg>.
 */
export function scatterSvg(points, { id, title, desc = '', xLabel, yLabel, guide = null }) {
  return ['wide', 'compact'].map((shape) => scatterShape(points, { id: shape === 'wide' ? id : `${id}-compact`, title, desc, xLabel, yLabel, guide, shape })).join('');
}

function scatterShape(points, { id, title, desc, xLabel, yLabel, guide, shape }) {
  const { W, H, PAD, r } = PLOTS[shape];
  const log = Math.log10;
  // From the decade at or below the least value to the quarter decade above the greatest.
  const span = (values) => {
    const low = Math.floor(log(Math.min(...values)));
    return [low, Math.max(Math.ceil(log(Math.max(...values)) * 4 + 0.2) / 4, low + 1)];
  };
  const [x0, x1] = span(points.map((p) => p.x));
  const [y0, y1] = span(points.map((p) => p.y));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const px = (v) => fixed(PAD.left + ((log(v) - x0) / (x1 - x0)) * plotW);
  const py = (v) => fixed(PAD.top + plotH - ((log(v) - y0) / (y1 - y0)) * plotH);
  const steps = (from, to) => Array.from({ length: Math.floor(to) - from + 1 }, (_, i) => 10 ** (from + i));
  const grid =
    steps(y0, y1)
      .map(
        (v) =>
          `<line class="sf-grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${py(v)}" y2="${py(v)}"/><text class="sf-tick" x="${PAD.left - 6}" y="${py(v)}" dy="0.32em" text-anchor="end">${decade(v)}</text>`
      )
      .join('') +
    steps(x0, x1)
      .map(
        (v) =>
          `<line class="sf-grid" x1="${px(v)}" x2="${px(v)}" y1="${PAD.top}" y2="${PAD.top + plotH}"/><text class="sf-tick" x="${px(v)}" y="${PAD.top + plotH + 16}" text-anchor="middle">${decade(v)}</text>`
      )
      .join('');
  // The guide, clipped to the plot: the line's ends are where it meets the frame.
  let line = '';
  if (guide) {
    const fromX = Math.max(10 ** x0, 10 ** y0 / guide.slope);
    const toX = Math.min(10 ** x1, 10 ** y1 / guide.slope);
    if (toX > fromX)
      line =
        `<line class="sf-guide" x1="${px(fromX)}" y1="${py(fromX * guide.slope)}" x2="${px(toX)}" y2="${py(toX * guide.slope)}"/>` +
        `<text class="sf-tick sf-guide-label" x="${fixed(px(toX) - 30)}" y="${fixed(py(toX * guide.slope) + 11)}" text-anchor="end">${e(guide.label)}</text>`;
  }
  const dots = points
    .map((p) => {
      const dot = `<circle class="sf-dot sf-series-${e(p.key)}" cx="${px(p.x)}" cy="${py(p.y)}" r="${r}" data-tip="${e(p.tip)}"><title>${e(p.tip)}</title></circle>`;
      return p.href ? `<a href="${e(p.href)}">${dot}</a>` : dot;
    })
    .join('');
  return (
    `<svg class="sf-chart sf-plot sf-chart-${shape}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-title ${id}-desc">` +
    `<title id="${id}-title">${e(title)}</title><desc id="${id}-desc">${e(desc)}</desc>` +
    grid +
    `<text class="sf-tick" x="${PAD.left}" y="12">${e(yLabel)}</text>` +
    `<text class="sf-tick" x="${W - PAD.right}" y="${H - 6}" text-anchor="end">${e(xLabel)}</text>` +
    line +
    dots +
    `</svg>`
  );
}
