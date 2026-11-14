// The trend chart as an SVG string: one series of daily columns, drawn the same
// way by the build (static HTML) and the browser (after a filter changes). Plain
// functions, no DOM. Colours come from CSS classes under body.software-factory.

import { escapeHtml, formatDay, formatTick, formatValue } from './format.js';

const W = 640;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 52 };

/** Clean ticks from 0 to at least max, stepping 1, 2 or 5 times a power of ten. */
export function niceTicks(max, unit, count = 4) {
  if (unit === 'ratio') return [0, 0.25, 0.5, 0.75, 1];
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  const ticks = [];
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

/** A column with a 4px rounded data end and a square foot on the baseline. */
function column(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

const fixed = (n) => Number(n.toFixed(1));

/**
 * points: [{ day, value }], value null when the day wasn't measured or has no
 * value. label and unit name the measure. Returns the <svg>; the data table
 * beside it is the text equivalent.
 */
export function chartSvg(points, { label, unit, id = 'sf-trend' }) {
  const values = points.map((p) => p.value).filter((v) => v !== null && Number.isFinite(v));
  const ticks = niceTicks(Math.max(0, ...values), unit);
  const top = ticks[ticks.length - 1];
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v) => PAD.top + plotH - (v / top) * plotH;
  const band = plotW / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(24, band - 2));
  const every = Math.ceil(points.length / 8);

  const grid = ticks
    .map((t) => {
      const ty = fixed(y(t));
      return (
        `<line class="sf-grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${ty}" y2="${ty}"/>` +
        `<text class="sf-tick" x="${PAD.left - 6}" y="${ty}" dy="0.32em" text-anchor="end">${escapeHtml(formatTick(t, unit))}</text>`
      );
    })
    .join('');

  const marks = points
    .map((p, i) => {
      const cx = PAD.left + band * i + band / 2;
      const tip = `${formatDay(p.day)}: ${formatValue(p.value, unit)}`;
      const xLabel =
        i % every === 0
          ? `<text class="sf-tick" x="${fixed(cx)}" y="${H - PAD.bottom + 16}" text-anchor="middle">${escapeHtml(formatDay(p.day, { year: false }))}</text>`
          : '';
      if (p.value === null || !Number.isFinite(p.value)) {
        // No value (not measured, or a zero denominator): a short muted mark on the baseline, never a zero column.
        return `<g class="sf-day sf-day-none"><title>${escapeHtml(tip)}</title><line class="sf-none" x1="${fixed(cx - barW / 2)}" x2="${fixed(cx + barW / 2)}" y1="${PAD.top + plotH}" y2="${PAD.top + plotH}"/><rect class="sf-hit" x="${fixed(cx - band / 2)}" y="${PAD.top}" width="${fixed(band)}" height="${plotH}"/>${xLabel}</g>`;
      }
      const h = Math.max(0, (p.value / top) * plotH);
      const bar = h > 0 ? `<path class="sf-bar" d="${column(fixed(cx - barW / 2), fixed(PAD.top + plotH - h), fixed(barW), fixed(h))}"/>` : '';
      return `<g class="sf-day"><title>${escapeHtml(tip)}</title>${bar}<rect class="sf-hit" x="${fixed(cx - band / 2)}" y="${PAD.top}" width="${fixed(band)}" height="${plotH}"/>${xLabel}</g>`;
    })
    .join('');

  const measured = points.filter((p) => p.value !== null).length;
  const desc = `${measured} of ${points.length} days with a value${values.length ? `; highest ${formatValue(Math.max(...values), unit)}` : ''}. The table below lists every day.`;
  return (
    `<svg class="sf-chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-title ${id}-desc">` +
    `<title id="${id}-title">${escapeHtml(label)} per day</title><desc id="${id}-desc">${escapeHtml(desc)}</desc>` +
    `<line class="sf-axis" x1="${PAD.left}" x2="${W - PAD.right}" y1="${PAD.top + plotH}" y2="${PAD.top + plotH}"/>` +
    grid +
    marks +
    `</svg>`
  );
}

/** The chart's text equivalent: every day with its value or 'No data'. */
export function chartTable(points, { label, unit }) {
  const rows = points
    .map(
      (p) =>
        `<tr><th scope="row"><time datetime="${escapeHtml(p.day)}">${escapeHtml(formatDay(p.day))}</time></th><td>${
          p.value === null ? '<span class="sf-muted">No data</span>' : escapeHtml(formatValue(p.value, unit))
        }</td></tr>`
    )
    .join('');
  return `<table class="sf-table"><thead><tr><th scope="col">Day (Toronto)</th><th scope="col">${escapeHtml(label)}</th></tr></thead><tbody>${rows}</tbody></table>`;
}
