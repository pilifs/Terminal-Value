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
 * Returns the wide and the compact <svg>; a table beside them is the text equivalent.
 */
export function columnsSvg(points, { id, title, series, unit = 'count', desc = '' }) {
  return ['wide', 'compact'].map((shape) => columnsShape(points, { id: shape === 'wide' ? id : `${id}-compact`, title, series, unit, desc, shape })).join('');
}

function columnsShape(points, { id, title, series, unit, desc, shape }) {
  const { W, H, PAD, labels } = SHAPES[shape];
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
      const hit = `<rect class="sf-hit" x="${fixed(cx - band / 2)}" y="${PAD.top}" width="${fixed(band)}" height="${plotH}"/>`;
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
    `<title id="${id}-title">${e(title)}</title><desc id="${id}-desc">${e(desc)} The table below lists every day.</desc>` +
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

/** A legend for two or more series: a swatch and its name, in text ink. */
export function legendHtml(series) {
  return `<ul class="sf-legend">${series.map((s) => `<li><span class="sf-swatch sf-series-${e(s.key)}" aria-hidden="true"></span>${e(s.label)}</li>`).join('')}</ul>`;
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
