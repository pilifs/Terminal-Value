#!/usr/bin/env python3
"""Render the figures in this post from session.json, and splice them into index.md.

    python3 charts.py            # rewrite every <!-- fig:NAME --> block in index.md
    python3 charts.py --svg DIR  # also write one standalone .svg per figure (for previews)

session.json is produced by extract.py from the session's redacted trace log.
Every number in the figures comes from it; nothing is typed in by hand except
the short labels for the 25 prompts.
"""
import json, math, re, sys, html
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
D = json.load(open(HERE / 'session.json'))
CALLS, TOOLS, PROMPTS = D['calls'], D['tools'], D['human_prompts']

# List prices per million tokens (Anthropic API, Oct 2026). Cache writes use the
# 1-hour TTL that Claude Code requested on every call, billed at 2x the input price.
PRICE = {
    'claude-opus-5-5':  {'in': 4,  'out': 20, 'read': 0.20, 'write': 8},
    'claude-fable-5-1': {'in': 10, 'out': 50, 'read': 0.25, 'write': 20},
}
MODEL_NAME = {'claude-opus-5-5': 'Opus 5.5', 'claude-fable-5-1': 'Fable 5.1'}

# Short labels for the prompts, in order. The full text is in session.json.
PROMPT_LABELS = [
    'login',
    'Set up this WSL machine for Java verification',
    'Read the Anthropic post; plan bytecode verification',
    'Docker is dead, continue without it',
    'sudo works, run install.sh',
    'Run the next two scripts',
    'Save and publish every LLM trace',
    'GitHub is authenticated, use in-the-loop',
    'Verify the hook; define the trace format',
    'Upload logs to the Cloudflare CDN',
    'Cloudflare login done, check the tier',
    'Create the R2 bucket, cap the charges',
    'Review everything before the first push',
    'Fix the cache purge scope',
    'Token saved, try unpublish',
    'Per-session summaries and a changes/ folder',
    'Link the trace prominently, then push',
    'Write the GitHub repo description',
    'Commit the rest and push',
    'Build Box Office, the distributed demo',
    'POC: behavioural contracts (approach B8)',
    'Schema and pages for the examples',
    'Split the repo into examples/ and llm-dlc/',
    'Rewrite commit messages, verify hooks',
    'Force push, check for stale references',
]
assert len(PROMPT_LABELS) == len(PROMPTS), (len(PROMPT_LABELS), len(PROMPTS))

W = 760  # viewBox width of every figure


def ts(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()


def hm(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00')).strftime('%b %d %H:%M')


def fmt(n, digits=1):
    n = float(n)
    if abs(n) >= 1e6:
        return f'{n/1e6:.{digits}f}M'
    if abs(n) >= 1e3:
        return f'{n/1e3:.0f}K'
    return f'{n:.0f}'


def comma(n):
    return f'{int(round(n)):,}'


def esc(s):
    return html.escape(str(s), quote=True)


def cost_of(c):
    u, p = c['usage'], PRICE[c['model']]
    return (u['input'] * p['in'] + u['output'] * p['out'] + u['cache_read'] * p['read'] + u['cache_write'] * p['write']) / 1e6


def uncached_cost_of(c):
    u, p = c['usage'], PRICE[c['model']]
    return ((u['input'] + u['cache_read'] + u['cache_write']) * p['in'] + u['output'] * p['out']) / 1e6


def nice_ticks(vmax, n=4):
    raw = vmax / n
    mag = 10 ** math.floor(math.log10(raw))
    for m in (1, 2, 2.5, 5, 10):
        step = m * mag
        if step >= raw:
            break
    return [i * step for i in range(int(vmax // step) + 1)]


class SVG:
    def __init__(self, width, height, label):
        self.w, self.h = width, height
        self.parts = []
        self.label = label

    def add(self, s):
        self.parts.append(s)

    def text(self, x, y, s, cls='lbl', anchor='start', dy=None, extra=''):
        dy = f' dy="{dy}"' if dy else ''
        self.add(f'<text class="{cls}" x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}"{dy}{extra}>{esc(s)}</text>')

    def line(self, x1, y1, x2, y2, cls='grid'):
        self.add(f'<line class="{cls}" x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>')

    def rect(self, x, y, w, h, cls='', fill=None, extra='', rx=None):
        f = f' fill="{fill}"' if fill else ''
        r = f' rx="{rx}"' if rx else ''
        self.add(f'<rect class="{cls}" x="{x:.1f}" y="{y:.1f}" width="{max(w,0):.1f}" height="{max(h,0):.1f}"{f}{r}{extra}/>')

    def render(self, min_width=600):
        body = '\n'.join(self.parts)
        return (f'<svg class="viz" viewBox="0 0 {self.w} {self.h}" role="img" aria-label="{esc(self.label)}" '
                f'style="min-width:{min_width}px">\n{body}\n</svg>')


def bar_path(x, y, w, h, r=4, direction='up'):
    """A bar with 4px rounded data-end and a square baseline end."""
    r = min(r, w / 2, h / 2) if w > 0 and h > 0 else 0
    if direction == 'up':  # rounded top
        return (f'M{x:.1f},{y+h:.1f} V{y+r:.1f} Q{x:.1f},{y:.1f} {x+r:.1f},{y:.1f} H{x+w-r:.1f} '
                f'Q{x+w:.1f},{y:.1f} {x+w:.1f},{y+r:.1f} V{y+h:.1f} Z')
    # rounded right end (horizontal bar)
    return (f'M{x:.1f},{y:.1f} H{x+w-r:.1f} Q{x+w:.1f},{y:.1f} {x+w:.1f},{y+r:.1f} V{y+h-r:.1f} '
            f'Q{x+w:.1f},{y+h:.1f} {x+w-r:.1f},{y+h:.1f} H{x:.1f} Z')


def figure(name, svg, caption, table_html, alt_summary, min_width=600, extra_html=''):
    return (f'<!-- fig:{name} -->\n'
            f'<figure class="viz-fig">\n<div class="viz-scroll">\n{svg.render(min_width)}\n</div>\n'
            f'{extra_html}'
            f'<figcaption>{caption}</figcaption>\n'
            f'<details class="viz-table"><summary>Data table</summary>\n{table_html}\n</details>\n'
            f'</figure>\n<!-- /fig:{name} -->')


def table(headers, rows):
    th = ''.join(f'<th>{esc(h)}</th>' for h in headers)
    trs = '\n'.join('<tr>' + ''.join(f'<td>{esc(c)}</td>' for c in r) + '</tr>' for r in rows)
    return f'<table>\n<thead><tr>{th}</tr></thead>\n<tbody>\n{trs}\n</tbody>\n</table>'


def legend(items, x, y):
    """items: list of (class, label). Returns SVG for an inline legend row."""
    out, cx = [], x
    for cls, label in items:
        out.append(f'<rect class="{cls}" x="{cx:.1f}" y="{y-9:.1f}" width="12" height="12" rx="2"/>')
        out.append(f'<text class="lbl" x="{cx+17:.1f}" y="{y+1:.1f}">{esc(label)}</text>')
        cx += 17 + 7.2 * len(label) + 18
    return '\n'.join(out)


# ----------------------------------------------------------------------------------
# Figure 1: context per API call, with cache writes beneath
# ----------------------------------------------------------------------------------
def fig_context():
    n = len(CALLS)
    left, right = 58, 16
    top1, h1 = 34, 230        # context panel
    gap = 44
    top2 = top1 + h1 + gap
    h2 = 120                  # cache-write panel
    H = top2 + h2 + 30
    s = SVG(W, H, 'Two stacked panels sharing one x axis of 327 API calls. The top panel shows the context '
                  'size of each call climbing in a sawtooth to 400K tokens and dropping after each of four compactions. '
                  'The bottom panel shows tokens written to the cache per call, usually a few thousand, with eight spikes.')
    xs = lambda i: left + (W - left - right) * (i / (n - 1))
    ymax = 420_000
    ys = lambda v: top1 + h1 - h1 * v / ymax

    # grid + y axis (panel 1)
    for v in (0, 100_000, 200_000, 300_000, 400_000):
        s.line(left, ys(v), W - right, ys(v))
        s.text(left - 8, ys(v) + 4, fmt(v, 0) if v else '0', 'tick', 'end')
    s.text(left, top1 - 14, 'Context tokens per API call', 'title')

    # compaction and day markers
    comps = D['compactions']
    comp_idx = []
    # label rows alternate so neighbouring markers do not collide
    for k, cp in enumerate(comps):
        t = ts(cp['ts'])
        i = next(c['seq'] for c in CALLS if ts(c['ts']) >= t)
        comp_idx.append(i)
        x = xs(i) - (xs(1) - xs(0)) / 2
        s.line(x, top1 - 4, x, top2 + h2, 'marker')
        anchor = 'end' if k == 0 else 'start'
        dx = -5 if anchor == 'end' else 5
        yy = top1 + (10 if k != 0 else 60)
        s.text(x + dx, yy, f'compaction {k+1}', 'note', anchor)
        s.text(x + dx, yy + 13, f'{fmt(cp["pre_tokens"])} → {fmt(cp["post_tokens"])}', 'note', anchor)
    # day gap: first call on Oct 30
    day2 = next(c['seq'] for c in CALLS if c['ts'].startswith('2026-10-30'))
    xg = xs(day2) - (xs(1) - xs(0)) / 2
    s.line(xg, top1 - 4, xg, top2 + h2, 'marker')
    s.text(xg + 5, top1 + 10, 'six days pass', 'note')
    s.text(xg + 5, top1 + 23, 'Oct 24 → Oct 30', 'note')

    # area + line, split into runs by model so Fable is a different colour
    def segments():
        run, prev = [], None
        for c in CALLS:
            key = c['model']
            if key != prev and run:
                yield prev, run
                run = [run[-1]]  # share a point so lines connect
            run.append(c)
            prev = key
        if run:
            yield prev, run

    for model, run in segments():
        cls = 's1' if model == 'claude-opus-5-5' else 's2'
        # break the area at compactions and the day gap so the drop is vertical, not a slope
        pts = []
        chunks = []
        for c in run:
            if c['seq'] in comp_idx or c['seq'] == day2:
                if pts:
                    chunks.append(pts)
                pts = []
            pts.append(c)
        if pts:
            chunks.append(pts)
        for ch in chunks:
            if len(ch) < 2:
                ch = ch + ch
            d = ' '.join(f'{xs(c["seq"]):.1f},{ys(c["context_tokens"]):.1f}' for c in ch)
            x0, x1 = xs(ch[0]['seq']), xs(ch[-1]['seq'])
            s.add(f'<polygon class="area {cls}" points="{x0:.1f},{ys(0):.1f} {d} {x1:.1f},{ys(0):.1f}"/>')
            s.add(f'<polyline class="line {cls}" points="{d}"/>')

    # peak label
    peak = max(CALLS, key=lambda c: c['context_tokens'])
    s.add(f'<circle class="dot s1" cx="{xs(peak["seq"]):.1f}" cy="{ys(peak["context_tokens"]):.1f}" r="4"/>')
    s.text(xs(peak['seq']) - 8, ys(peak['context_tokens']) - 8, f'peak {comma(peak["context_tokens"])}', 'note', 'end')
    s.add(legend([('s1', 'Opus 5.5'), ('s2', 'Fable 5.1')], W - right - 175, top1 - 14))

    # panel 2: cache writes
    wmax = 170_000
    ys2 = lambda v: top2 + h2 - h2 * v / wmax
    for v in (0, 50_000, 100_000, 150_000):
        s.line(left, ys2(v), W - right, ys2(v))
        s.text(left - 8, ys2(v) + 4, fmt(v, 0) if v else '0', 'tick', 'end')
    s.text(left, top2 - 14, 'Tokens written to the cache per call', 'title')
    bw = max(1.2, (xs(1) - xs(0)) - 0.6)
    for c in CALLS:
        v = c['usage']['cache_write']
        if v <= 0:
            continue
        s.rect(xs(c['seq']) - bw / 2, ys2(v), bw, ys2(0) - ys2(v), 'bar s1')
    # annotate the big writes
    notes = {
        53: ('skill loaded: +92K', 'end'),
        146: ('model switch', 'end'),
        162: ('switch back', 'start'),
        203: ('compaction', 'start'),
        244: ('cache expired: 166K', 'end'),
        287: ('compaction', 'end'),
        311: ('cold miss: 0 read', 'end'),
    }
    for seq, (label, anchor) in notes.items():
        c = CALLS[seq]
        v = c['usage']['cache_write']
        x = xs(seq) + (5 if anchor == 'start' else -5)
        s.text(x, ys2(v) - 4 if v < 140_000 else ys2(v) + 12, label, 'note', anchor)

    # x axis
    s.line(left, ys2(0), W - right, ys2(0), 'axis')
    for i in (0, 50, 100, 150, 200, 250, 300, 326):
        s.text(xs(i), H - 8, str(i + 1) if i else 'call 1', 'tick', 'middle')

    # hover layer: crosshair driven by data embedded on the svg
    data = [[c['seq'] + 1, hm(c['ts']), MODEL_NAME[c['model']], c['context_tokens'], c['usage']['cache_read'],
             c['usage']['cache_write'], c['usage']['output'], len(c['tools'])] for c in CALLS]
    s.add(f'<line class="cross" x1="0" y1="{top1}" x2="0" y2="{top2+h2}" style="display:none"/>')
    s.add(f'<rect class="hit" data-hover="context" x="{left}" y="{top1}" width="{W-left-right}" height="{top2+h2-top1}" '
          f'fill="transparent" data-left="{left}" data-right="{W-right}" data-n="{n}" data-calls=\'{esc(json.dumps(data, separators=(",", ":")))}\'/>')

    rows = [[c['seq'] + 1, hm(c['ts']), MODEL_NAME[c['model']], comma(c['context_tokens']), comma(c['usage']['cache_read']),
             comma(c['usage']['cache_write']), comma(c['usage']['output']), len(c['tools'])] for c in CALLS]
    tbl = table(['Call', 'Time (UTC)', 'Model', 'Context', 'Cache read', 'Cache write', 'Output', 'Tool calls'], rows)
    cap = ('Every API call re-reads the whole conversation. The sawtooth is the context growing until a compaction '
           'resets it. Below, the cache absorbs almost all of that re-reading: the spikes are the moments it could not.')
    return figure('context', s, cap, tbl, '', 640)


# ----------------------------------------------------------------------------------
# Figure 2: share of tokens vs share of cost
# ----------------------------------------------------------------------------------
def fig_tokens_vs_cost():
    tok = {'read': 0, 'write': 0, 'out': 0, 'in': 0}
    usd = {'read': 0, 'write': 0, 'out': 0, 'in': 0}
    for c in CALLS:
        u, p = c['usage'], PRICE[c['model']]
        tok['read'] += u['cache_read']; usd['read'] += u['cache_read'] * p['read'] / 1e6
        tok['write'] += u['cache_write']; usd['write'] += u['cache_write'] * p['write'] / 1e6
        tok['out'] += u['output']; usd['out'] += u['output'] * p['out'] / 1e6
        tok['in'] += u['input']; usd['in'] += u['input'] * p['in'] / 1e6
    cats = [('read', 'Cache reads', 's1'), ('write', 'Cache writes', 's2'), ('out', 'Output', 's3')]
    left, right = 120, 16
    H = 150
    s = SVG(W, H, 'Two horizontal 100% bars. In the tokens bar, cache reads fill 97%, cache writes 2% and output 1%. '
                  'In the cost bar the three parts are about equal thirds.')
    bw = W - left - right
    rows_def = [('Tokens', tok, 46, lambda v: fmt(v)), ('List price', usd, 102, lambda v: f'${v:,.2f}')]
    for label, data, y, f in rows_def:
        total = sum(data[k] for k, _, _ in cats) + data['in']
        s.text(left - 12, y + 16, label, 'lbl', 'end')
        s.text(left - 12, y + 32, f(total), 'tick', 'end')
        x = left
        for k, name, cls in cats:
            w = bw * data[k] / total
            s.rect(x, y, max(w - 2, 0.8), 28, f'bar {cls}', rx=0,
                   extra=f' data-tip="{esc(name)}: {esc(f(data[k]))} ({data[k]/total*100:.1f}%)"')
            pct = data[k] / total * 100
            txt = f'{pct:.0f}%' if pct >= 6 else ''
            if txt:
                s.text(x + (w - 2) / 2, y + 19, txt, 'inbar', 'middle')
            elif pct >= 1:
                s.text(x + w + 6 if k == 'out' else x + (w - 2) / 2, y + 19, f'{pct:.0f}%', 'tick', 'start' if k == 'out' else 'middle')
            x += w
    s.add(legend([(cls, name) for _, name, cls in cats], left, 20))
    rows = [[name, comma(tok[k]), f'{tok[k]/sum(tok.values())*100:.2f}%', f'${usd[k]:,.2f}', f'{usd[k]/sum(usd.values())*100:.1f}%'] for k, name, _ in cats]
    rows.append(['Uncached input', comma(tok['in']), f'{tok["in"]/sum(tok.values())*100:.4f}%', f'${usd["in"]:,.4f}', f'{usd["in"]/sum(usd.values())*100:.2f}%'])
    tbl = table(['Category', 'Tokens', 'Share', 'List price', 'Share'], rows)
    cap = ('The same session, measured two ways. Cache reads are 97% of the tokens but a third of the bill. '
           'Output is under 1% of the tokens and the largest cost.')
    return figure('tokens-vs-cost', s, cap, tbl, '', 560), tok, usd


# ----------------------------------------------------------------------------------
# Figure 3: output per prompt, thinking vs visible
# ----------------------------------------------------------------------------------
def fig_prompts():
    rowh = 22
    left, right = 300, 135
    top = 34
    gap_extra = 14  # visual gap between the two days
    H = top + rowh * len(PROMPTS) + gap_extra + 30
    s = SVG(W, H, 'Horizontal bars, one per prompt in the order typed, showing output tokens split into thinking and visible '
                  'output. The longest bars are the Box Office build at 102K and the pre-push review at 90K.')
    vmax = 110_000
    bw = W - left - right
    xs = lambda v: left + bw * v / vmax
    for v in (0, 25_000, 50_000, 75_000, 100_000):
        s.line(xs(v), top - 6, xs(v), H - 24)
        s.text(xs(v), H - 8, fmt(v, 0) if v else '0', 'tick', 'middle')
    s.add(legend([('s1', 'Visible output'), ('s1b', 'Thinking')], left, 16))
    s.text(left - 12, 16, 'Output tokens per prompt', 'title', 'end')
    y = top
    day_drawn = False
    top3 = sorted(PROMPTS, key=lambda p: -p.get('output_tokens', 0))[:3]
    for p in PROMPTS:
        if p['ts'].startswith('2026-10-30') and not day_drawn:
            s.line(16, y + 2, W - 16, y + 2, 'axis')
            s.text(left - 12, y + 12, 'Oct 30', 'note', 'end')
            y += gap_extra
            day_drawn = True
        elif p['index'] == 0:
            s.text(left - 12, y - 4, 'Oct 24', 'note', 'end')
        out, th = p.get('output_tokens', 0), p.get('thinking_tokens', 0)
        vis = out - th
        label = PROMPT_LABELS[p['index']]
        cs = [c for c in CALLS if c['prompt_index'] == p['index']]
        cost = sum(cost_of(c) for c in cs)
        tip = (f'{esc(label)}|{p["api_calls"]} API calls, {p["tool_calls"]} tool calls, {comma(out)} output tokens '
               f'({comma(th)} thinking), ${cost:.2f} at list price, {p.get("active_s",0)/60:.0f} min|{esc(p["text"][:220])}…')
        s.text(left - 12, y + 15, label, 'lbl', 'end')
        s.add(f'<path class="bar s1" d="{bar_path(left, y + 3, max(xs(vis)-left, 1.5), 16, 0)}" />')
        if th > 0:
            s.add(f'<path class="bar s1b" d="{bar_path(xs(vis) + 2, y + 3, max(xs(out)-xs(vis)-2, 1.5), 16, 4, "right")}"/>')
        s.rect(16, y, W - 32, rowh, 'hit', fill='transparent', extra=f' data-tip="{tip}"')
        if p in top3:
            s.text(xs(out) + 8, y + 15, f'{fmt(out)}  ·  ${cost:.2f}', 'tick')
        if p['models'] == ['claude-fable-5-1']:
            s.text(xs(out) + 8, y + 15, f'{fmt(out)}  ·  ${cost:.2f}  ·  Fable 5.1', 'tick')
        y += rowh
    rows = []
    for p in PROMPTS:
        cs = [c for c in CALLS if c['prompt_index'] == p['index']]
        rows.append([p['index'] + 1, hm(p['ts']), PROMPT_LABELS[p['index']], ', '.join(MODEL_NAME[m] for m in p['models']),
                     p['api_calls'], p['tool_calls'], comma(p.get('output_tokens', 0)), comma(p.get('thinking_tokens', 0)),
                     comma(p.get('cache_read', 0)), f'${sum(cost_of(c) for c in cs):.2f}', f'{p.get("active_s",0)/60:.1f}'])
    tbl = table(['#', 'Time (UTC)', 'Prompt', 'Model', 'API calls', 'Tool calls', 'Output', 'Thinking', 'Cache read', 'List price', 'Minutes'], rows)
    cap = ('What each prompt made the model write. Hover a bar for the full prompt and its cost. '
           'Two prompts account for a third of all output: building the demo system, and one review run on Fable 5.1.')
    return figure('prompts', s, cap, tbl, '', 640)


# ----------------------------------------------------------------------------------
# Figure 4: where the agent's time went + Bash durations
# ----------------------------------------------------------------------------------
def fig_time():
    active = sum(p.get('active_s', 0) for p in PROMPTS)
    tool_s = sum(t['duration_s'] for t in TOOLS)
    comp_s = sum(c['duration_ms'] for c in D['compactions']) / 1000
    model_s = active - tool_s  # the compactions happened between prompts, outside active time
    total = active + comp_s
    left, right = 16, 16
    H = 360
    s = SVG(W, H, 'A 100% bar splitting two hours of agent time into model generation (54%), waiting for tools (43%) and '
                  'compaction (3%), above a strip of 283 dots placing every Bash command on a logarithmic duration axis '
                  'from 0.1 seconds to two minutes. Most dots sit between one and ten seconds.')
    s.text(left, 16, f'Where {int(total//3600)} h {int(total%3600//60)} min of agent time went', 'title')
    bw = W - left - right
    y = 30
    parts = [('Model generating', model_s, 's1'), ('Waiting for tools', tool_s, 's2'), ('Compacting', comp_s, 's4')]
    x = left
    for name, v, cls in parts:
        w = bw * v / total
        s.rect(x, y, max(w - 2, 1), 26, f'bar {cls}', extra=f' data-tip="{esc(name)}: {v/60:.0f} min ({v/total*100:.0f}%)"')
        if w > 60:
            s.text(x + (w - 2) / 2, y + 17, f'{v/60:.0f} min', 'inbar', 'middle')
        x += w
    s.add(legend([(cls, name) for name, _, cls in parts], left, 80))

    # beeswarm of Bash durations on a log axis
    bash = [t for t in TOOLS if t['name'] == 'Bash']
    y0 = 150
    s.text(left, y0 - 34, f'The {len(bash)} Bash commands, by how long they ran', 'title')
    lo, hi = 0.08, 150
    xs = lambda v: left + bw * (math.log10(max(v, lo)) - math.log10(lo)) / (math.log10(hi) - math.log10(lo))
    band_top, band_h = y0, 160
    for v, lab in ((0.1, '0.1 s'), (1, '1 s'), (10, '10 s'), (60, '1 min'), (120, '2 min')):
        s.line(xs(v), band_top - 6, xs(v), band_top + band_h)
        s.text(xs(v), band_top + band_h + 16, lab, 'tick', 'middle')
    # greedy vertical packing
    placed = []
    r = 3.1
    for t in sorted(bash, key=lambda t: t['duration_s']):
        x = xs(t['duration_s'])
        cy = band_top + band_h / 2
        for k in range(0, 40):
            for sign in (1, -1):
                cand = cy + sign * k * (r * 2 + 0.5)
                if all((x - px) ** 2 + (cand - py) ** 2 >= (2 * r + 0.6) ** 2 for px, py in placed):
                    break
            else:
                continue
            break
        placed.append((x, cand))
        tip = f'{t["duration_s"]:.1f} s · {esc(t["description"] or t["command"][:80])}' + (' · failed' if t['is_error'] else '')
        s.add(f'<circle class="dot s1{" err" if t["is_error"] else ""}" cx="{x:.1f}" cy="{cand:.1f}" r="{r}" data-tip="{tip}"/>')
    # label the two longest and the median
    def short(desc, n=30):
        words, out = desc.split(), ''
        for wd in words:
            if len(out) + len(wd) + 1 > n:
                return out + '…'
            out += (' ' if out else '') + wd
        return out
    longest = sorted(bash, key=lambda t: -t['duration_s'])[:2]
    s.text(xs(longest[0]['duration_s']), band_top - 12, f'{longest[0]["duration_s"]:.0f} s · {short(longest[0]["description"])}', 'note', 'end')
    s.text(xs(longest[1]['duration_s']) - 4, band_top + band_h + 30, f'{longest[1]["duration_s"]:.0f} s · {short(longest[1]["description"])}', 'note', 'end')
    med = sorted(t['duration_s'] for t in bash)[len(bash) // 2]
    s.text(xs(med), band_top + band_h + 30, f'median {med:.1f} s', 'note', 'middle')
    s.add(legend([('s1', 'Succeeded'), ('err', 'Failed')], W - right - 170, band_top - 34))

    rows = [[name, f'{v/60:.1f}', f'{v/total*100:.0f}%'] for name, v, _ in parts]
    tbl1 = table(['Activity', 'Minutes', 'Share'], rows)
    rows2 = [[t['name'], len([x for x in TOOLS if x['name'] == t['name']]),
              sum(x['is_error'] for x in TOOLS if x['name'] == t['name']),
              f'{sum(x["duration_s"] for x in TOOLS if x["name"] == t["name"])/60:.1f}',
              f'{sorted(x["duration_s"] for x in TOOLS if x["name"] == t["name"])[len([x for x in TOOLS if x["name"] == t["name"]])//2]:.1f}']
             for t in sorted({x['name']: x for x in TOOLS}.values(), key=lambda t: -len([x for x in TOOLS if x['name'] == t['name']]))]
    tbl2 = table(['Tool', 'Calls', 'Failed', 'Total minutes', 'Median seconds'], rows2)
    cap = ('Agent time is the span from each prompt to the model\'s final reply. Four in ten of those minutes were spent '
           'waiting for a shell command, and the longest waits were installers and Gradle builds.')
    return figure('time', s, cap, tbl1 + '\n' + tbl2, '', 600), dict(active=active, tool_s=tool_s, comp_s=comp_s, model_s=model_s)


# ----------------------------------------------------------------------------------
# Figure 5: the trace grows with each commit
# ----------------------------------------------------------------------------------
def fig_trace_growth():
    logs = D['logs']
    commits = [c for c in D['commits'] if c.get('log_sha256') in logs and c.get('summary')]
    left, right = 58, 16
    top, h = 40, 200
    H = top + h + 90
    s = SVG(W, H, 'Twelve columns, one per commit in order, showing the gzipped size of the trace log each commit points at, '
                  'rising from 0.35 MB to 1.67 MB. The first seven columns are labelled as the commits that built the trace system itself.')
    n = len(commits)
    slot = (W - left - right) / n
    vmax = 1.8e6
    ys = lambda v: top + h - h * v / vmax
    for v in (0, 0.5e6, 1.0e6, 1.5e6):
        s.line(left, ys(v), W - right, ys(v))
        s.text(left - 8, ys(v) + 4, f'{v/1e6:.1f} MB' if v else '0', 'tick', 'end')
    s.text(left, 18, 'Size of the gzipped trace log each commit points at', 'title')
    colw = min(24, slot - 6)
    for i, c in enumerate(commits):
        lg = logs[c['log_sha256']]
        x = left + slot * i + (slot - colw) / 2
        tip = f'{esc(c["summary"])}|{lg["gzip_bytes"]/1e6:.2f} MB gzipped, {lg["bytes"]/1e6:.1f} MB raw, {comma(lg["lines"])} lines|{c["commit_id"][:12]}'
        s.add(f'<path class="bar s1" d="{bar_path(x, ys(lg["gzip_bytes"]), colw, ys(0) - ys(lg["gzip_bytes"]))}"/>')
        s.rect(left + slot * i, top, slot, h + 60, 'hit', fill='transparent', extra=f' data-tip="{tip}"')
        if i in (0, n - 1):
            s.text(x + colw / 2, ys(lg['gzip_bytes']) - 6, f'{lg["gzip_bytes"]/1e6:.2f} MB', 'tick', 'middle')
        s.text(x + colw / 2, top + h + 16, str(i + 1), 'tick', 'middle')
    s.line(left, ys(0), W - right, ys(0), 'axis')
    # bracket: first seven commits built the trace system
    bx0 = left + slot * 0 + 4
    bx1 = left + slot * 7 - 4
    by = top + h + 34
    s.add(f'<path class="marker" d="M{bx0:.1f},{by-6} V{by} H{bx1:.1f} V{by-6}" fill="none"/>')
    s.text((bx0 + bx1) / 2, by + 16, 'these seven commits built the trace system that recorded them', 'note', 'middle')
    bx0 = left + slot * 7 + 4
    bx1 = left + slot * n - 4
    s.add(f'<path class="marker" d="M{bx0:.1f},{by-6} V{by} H{bx1:.1f} V{by-6}" fill="none"/>')
    s.text((bx0 + bx1) / 2, by + 16, 'the verification work', 'note', 'middle')
    rows = [[i + 1, c['summary'], c['commit_id'][:12], f'{logs[c["log_sha256"]]["gzip_bytes"]/1e6:.2f}', f'{logs[c["log_sha256"]]["bytes"]/1e6:.1f}', comma(logs[c['log_sha256']]['lines'])] for i, c in enumerate(commits)]
    tbl = table(['#', 'Commit', 'SHA', 'Log gzipped (MB)', 'Log raw (MB)', 'Lines'], rows)
    cap = ('Each commit carries the hash of the log as it stood at that moment, so the trace is a growing, append-only '
           'record. Hover a column for the commit; the numbers match the table below.')
    return figure('trace-growth', s, cap, tbl, '', 600)


# ----------------------------------------------------------------------------------
# Stat tiles (HTML, not a chart)
# ----------------------------------------------------------------------------------
def stat_tiles(tok, usd, time):
    total_read = tok['read'] + tok['write'] + tok['in']
    ratio = total_read / tok['out']
    n_commits = len([c for c in D['commits'] if c.get('commit_id')])
    tiles = [
        ('Tokens the model read', fmt(total_read), f'{ratio:.0f} read for every token written'),
        ('Tokens it wrote', fmt(tok['out']), f'{tok["thinking"] if "thinking" in tok else sum(c["usage"]["thinking"] for c in CALLS)/tok["out"]*100:.0f}% of them thinking'),
        ('API calls', str(len(CALLS)), f'for {len(PROMPTS)} prompts I typed'),
        ('Tool calls', str(len(TOOLS)), f'{sum(t["is_error"] for t in TOOLS)} failed'),
        ('Agent time', f'{int((time["active"]+time["comp_s"])//3600)} h {int((time["active"]+time["comp_s"])%3600//60)} min', 'spread over six days'),
        ('List price', f'${sum(usd.values()):,.0f}', f'${sum(uncached_cost_of(c) for c in CALLS):,.0f} without caching'),
    ]
    out = ['<!-- fig:tiles -->', '<div class="tiles">']
    for label, value, sub in tiles:
        out.append(f'<div class="tile"><div class="tile-label">{esc(label)}</div><div class="tile-value">{esc(value)}</div><div class="tile-sub">{esc(sub)}</div></div>')
    out.append('</div>')
    out.append('<!-- /fig:tiles -->')
    return '\n'.join(out)


def main():
    figs = {}
    figs['context'] = fig_context()
    figs['tokens-vs-cost'], tok, usd = fig_tokens_vs_cost()
    figs['prompts'] = fig_prompts()
    figs['time'], time = fig_time()
    figs['trace-growth'] = fig_trace_growth()
    figs['tiles'] = stat_tiles(tok, usd, time)

    md_path = HERE / 'index.md'
    md = md_path.read_text()
    for name, block in figs.items():
        pat = re.compile(rf'<!-- fig:{name} -->.*?<!-- /fig:{name} -->', re.S)
        if not pat.search(md):
            sys.exit(f'index.md has no <!-- fig:{name} --> block')
        md = pat.sub(lambda m: block, md)
    md_path.write_text(md)
    if '--svg' in sys.argv:
        out = Path(sys.argv[sys.argv.index('--svg') + 1])
        out.mkdir(parents=True, exist_ok=True)
        for name, block in figs.items():
            m = re.search(r'<svg.*?</svg>', block, re.S)
            if m:
                (out / f'{name}.svg').write_text(m.group(0))
    # a few numbers the prose quotes, so they can be checked against the data
    print(json.dumps({
        'tokens': tok, 'usd': {k: round(v, 2) for k, v in usd.items()}, 'usd_total': round(sum(usd.values()), 2),
        'uncached_total': round(sum(uncached_cost_of(c) for c in CALLS), 2),
        'time_min': {k: round(v / 60, 1) for k, v in time.items()},
    }, indent=1))


if __name__ == '__main__':
    main()
