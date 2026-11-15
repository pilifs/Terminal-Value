// The refresh workflow, .github/workflows/software-factory-refresh.yml, read as
// data: its triggers, the schedule's gate, the concurrency group, the secrets
// and where they go, and the actions it uses. Its publish script runs here in
// bash against a stand-in npm, for every trigger, a bad commit input and a
// failing destination. No credentials, no network, no GitHub.
//
// The file is parsed by a small reader of the YAML subset the workflow uses
// (block mappings and sequences, plain and quoted scalars, literal blocks). It
// throws on anything else, so the file can't drift into YAML this test
// misreads. Where PyYAML is installed, a test checks the two readings agree.
// Coordinator-owned. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CREDENTIALS, DESTINATIONS } from '../publish.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'software-factory-refresh.yml');
const TEXT = fs.readFileSync(WORKFLOW, 'utf8');
const SOURCE = JSON.parse(fs.readFileSync(path.join(ROOT, 'blog', 'software-factory', 'config', 'source.json'), 'utf8'));
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/** A reader for the YAML subset above. */
function parseYaml(text) {
  if (text.includes('\t')) throw new Error('tab in YAML');
  const lines = text.split('\n').map((raw, n) => ({ n: n + 1, raw, indent: raw.length - raw.trimStart().length, text: raw.trim() }));
  let i = 0;
  const skip = () => {
    while (i < lines.length && (lines[i].text === '' || lines[i].text.startsWith('#'))) i++;
  };
  const fail = (line, why) => {
    throw new Error(`line ${line.n}: ${why}: ${line.raw}`);
  };
  const uncomment = (s) => {
    let quote = null;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (quote) {
        if (c === quote) quote = null;
      } else if ((c === "'" || c === '"') && (k === 0 || s[k - 1] === ' ')) quote = c;
      else if (c === '#' && (k === 0 || s[k - 1] === ' ')) return s.slice(0, k).trimEnd();
    }
    return s;
  };
  const scalar = (s, line) => {
    s = uncomment(s);
    if (s.startsWith("'")) {
      if (!/^'(?:[^']|'')*'$/.test(s)) fail(line, 'unclosed quote');
      return s.slice(1, -1).replaceAll("''", "'");
    }
    if (s.startsWith('"')) {
      if (!/^"(?:[^"\\]|\\["\\nt])*"$/.test(s)) fail(line, 'unsupported double-quoted scalar');
      return JSON.parse(s);
    }
    if (/^[[\]{}&*!|>%@`]/.test(s) || s.includes(': ') || s.endsWith(':')) fail(line, 'outside the supported YAML subset');
    if (s === 'true' || s === 'false') return s === 'true';
    if (s === '' || s === '~' || s === 'null') return null;
    if (/^-?\d+$/.test(s)) return Number(s);
    return s;
  };
  const literal = (indent) => {
    const body = [];
    let at = null;
    while (i < lines.length && (lines[i].text === '' || lines[i].indent > indent)) {
      if (lines[i].text !== '') at ??= lines[i].indent;
      body.push(lines[i].text === '' ? '' : lines[i].raw.slice(at));
      i++;
    }
    while (body.length && body.at(-1) === '') body.pop();
    return body.join('\n') + '\n';
  };
  const KEY = /^([A-Za-z0-9_.-]+):(?: (.*))?$/;
  const value = (rest, indent, line) => {
    if (rest === undefined || uncomment(rest) === '') {
      skip();
      if (i < lines.length && lines[i].indent > indent) return block(lines[i].indent);
      if (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('- ')) return sequence(indent);
      return null;
    }
    if (rest === '|') return literal(indent);
    return scalar(rest, line);
  };
  const mapping = (indent) => {
    const out = {};
    for (skip(); i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith('- '); skip()) {
      const line = lines[i];
      const m = line.text.match(KEY);
      if (!m) fail(line, 'expected a key');
      if (Object.hasOwn(out, m[1])) fail(line, 'duplicate key');
      i++;
      out[m[1]] = value(m[2], indent, line);
    }
    if (i < lines.length && lines[i].indent > indent) fail(lines[i], 'unexpected indent');
    return out;
  };
  const sequence = (indent) => {
    const out = [];
    for (skip(); i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('- '); skip()) {
      const line = lines[i];
      const rest = line.text.slice(2);
      if (KEY.test(rest)) {
        // "- key: value" opens a mapping indented to the item's text.
        lines[i] = { ...line, indent: indent + 2, text: rest };
        out.push(mapping(indent + 2));
      } else {
        i++;
        out.push(scalar(rest, line));
      }
    }
    if (i < lines.length && lines[i].indent > indent) fail(lines[i], 'unexpected indent');
    return out;
  };
  const block = (indent) => (lines[i].text.startsWith('- ') ? sequence(indent) : mapping(indent));
  skip();
  const doc = block(0);
  skip();
  if (i < lines.length) fail(lines[i], 'unexpected text');
  return doc;
}

const WF = parseYaml(TEXT);
const JOB = WF.jobs.publish;
const STEP = JOB.steps.find((s) => s.name === 'Publish');
const CHECKOUT = 'actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09';
const SETUP_NODE = 'actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444';

test('the YAML reader handles the subset and refuses what it does not read', () => {
  assert.deepEqual(parseYaml("a:\n  b: 'x # y'\n  c: 3 # note\n  d:\n    - e: f\n      g: true\n    - h\n  s: |\n    one\n\n    two\n"), {
    a: { b: 'x # y', c: 3, d: [{ e: 'f', g: true }, 'h'], s: 'one\n\ntwo\n' },
  });
  assert.deepEqual(parseYaml('k:\n- a\n- b\n'), { k: ['a', 'b'] });
  for (const bad of ['a: [x, y]\n', 'a: {b: c}\n', 'a: &x 1\n', 'a: b: c\n', 'a: 1\na: 2\n', 'a:\n\tb: 1\n', 'a: 1\n   b: 2\n', 'a: >\n  x\n']) {
    assert.throws(() => parseYaml(bad), undefined, JSON.stringify(bad));
  }
});

test('PyYAML reads the workflow the same way', (t) => {
  const py = spawnSync(
    'python3',
    ['-I', '-c', 'import json, sys, yaml\nd = yaml.safe_load(sys.stdin)\nd["on"] = d.pop(True)\njson.dump(d, sys.stdout)'],
    { input: TEXT, encoding: 'utf8' },
  );
  if (py.status !== 0 && /No module named .?yaml/.test(py.stderr ?? '')) return t.skip('PyYAML is not installed');
  assert.equal(py.status, 0, py.stderr);
  // PyYAML is YAML 1.1, where a bare `on` is a boolean; GitHub reads it as the key "on", as this reader does.
  assert.deepEqual(JSON.parse(py.stdout), WF);
});

test('manual runs choose a destination and a commit; the schedule is every 15 minutes', () => {
  assert.equal(WF.name, 'Software Factory refresh');
  assert.deepEqual(Object.keys(WF.on).sort(), ['schedule', 'workflow_dispatch']);
  assert.deepEqual(WF.on.schedule, [{ cron: '*/15 * * * *' }]);
  const { destination, sha, ...rest } = WF.on.workflow_dispatch.inputs;
  assert.deepEqual(rest, {});
  assert.equal(destination.type, 'choice');
  assert.deepEqual(destination.options, Object.keys(DESTINATIONS));
  assert.equal(destination.default, 'preview');
  assert.deepEqual({ type: sha.type, required: sha.required, default: sha.default }, { type: 'string', required: false, default: '' });
});

test('a scheduled run does nothing unless SOFTWARE_FACTORY_SCHEDULE is on', () => {
  assert.deepEqual(Object.keys(WF.jobs), ['publish']);
  assert.equal(JOB.if, "github.event_name == 'workflow_dispatch' || vars.SOFTWARE_FACTORY_SCHEDULE == 'on'");
});

test('one concurrency group serializes every run and never cancels one under way', () => {
  assert.deepEqual(WF.concurrency, { group: 'software-factory-refresh', 'cancel-in-progress': false });
  assert.equal(JOB.concurrency, undefined);
  assert.ok(JOB['timeout-minutes'] > 0 && JOB['timeout-minutes'] <= 15, 'a stuck run holds the group only so long');
});

test('only the publish step gets the R2 secrets, by name, through its environment', () => {
  assert.deepEqual(WF.permissions, { contents: 'read' });
  assert.equal(JOB.permissions, undefined);
  assert.deepEqual(STEP.env, {
    EVENT: '${{ github.event_name }}',
    DESTINATION: '${{ inputs.destination }}',
    SHA: '${{ inputs.sha }}',
    SOURCE_CHECKOUT: 'software-factory-source',
    ...Object.fromEntries(CREDENTIALS.map((name) => [name, `\${{ secrets.${name} }}`])),
  });
  // Every secret the file names is one of the three, and only in that step's env.
  const named = [...TEXT.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(named)].sort(), [...CREDENTIALS].sort());
  for (const step of JOB.steps) {
    const elsewhere = JSON.stringify({ ...step, env: step === STEP ? undefined : step.env });
    assert.doesNotMatch(elsewhere, /secrets\./, step.name);
  }
  // The runbook names each secret and the variable, and never shows a value.
  const docs = fs.readFileSync(path.join(ROOT, 'docs', 'software-factory.md'), 'utf8');
  for (const name of [...CREDENTIALS, 'SOFTWARE_FACTORY_SCHEDULE', 'software-factory-refresh.yml']) assert.ok(docs.includes(name), name);
});

test('no expression is expanded inside a script: inputs reach it as environment', () => {
  for (const step of JOB.steps) if (step.run) assert.doesNotMatch(step.run, /\$\{\{/, step.name);
  assert.equal(JOB.steps.filter((s) => s.run).length, 1);
});

test('the steps: both checkouts without stored credentials, the pinned Node, no install', () => {
  assert.deepEqual(
    JOB.steps.map((s) => s.uses ?? 'run'),
    [CHECKOUT, CHECKOUT, SETUP_NODE, 'run'],
  );
  // Pinned to commits, as a tag can be moved; the release tag stays readable beside each.
  for (const step of JOB.steps.filter((s) => s.uses)) assert.match(step.uses, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  assert.equal(TEXT.match(/uses: \S+ # v\d+\.\d+\.\d+\n/g)?.length, 3, 'each pin names its release');
  const [site, source, node] = JOB.steps;
  assert.deepEqual(site.with, { 'persist-credentials': false });
  assert.deepEqual(source.with, {
    repository: SOURCE.repository,
    path: STEP.env.SOURCE_CHECKOUT,
    'fetch-depth': 0, // whole history: the publisher's order check is git merge-base
    'persist-credentials': false,
  });
  assert.equal(node.with['node-version'], PACKAGE.engines.node);
  assert.equal(STEP.shell, 'bash');
  assert.match(PACKAGE.scripts['software-factory:publish'], /^node blog\/software-factory\/cli\.mjs publish$/);
  assert.doesNotMatch(TEXT, /npm (ci|install|i)\b/);
});

// The publish script, run as GitHub runs a bash step, with npm replaced by a
// stand-in that records its arguments and fails for one chosen destination.
function runScript(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-workflow-'));
  try {
    fs.mkdirSync(path.join(dir, 'bin'));
    fs.writeFileSync(
      path.join(dir, 'bin', 'npm'),
      '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$NPM_LOG"\ncase " $* " in *" --destination $FAIL "*) exit 1 ;; esac\n',
      { mode: 0o755 },
    );
    fs.writeFileSync(path.join(dir, 'step.sh'), STEP.run);
    const log = path.join(dir, 'npm.log');
    const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', path.join(dir, 'step.sh')], {
      env: { PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`, NPM_LOG: log, FAIL: '', DESTINATION: '', SHA: '', SOURCE_CHECKOUT: STEP.env.SOURCE_CHECKOUT, ...env },
      encoding: 'utf8',
    });
    const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
    return { status: r.status, out: r.stdout + r.stderr, calls };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const call = (destination, ...source) =>
  ['run', '--silent', 'software-factory:publish', '--', '--destination', destination, '--checkout', 'software-factory-source', ...source].join(' ');
const HEAD = ['--ref', `origin/${SOURCE.defaultRef}`];
const PIN = '7384f8c23eef441817ddb714c6ef5571cdc138bd';

test('a manual run publishes to its one destination, at the head of main or at its commit', () => {
  assert.deepEqual(runScript({ EVENT: 'workflow_dispatch', DESTINATION: 'production' }), { status: 0, out: '', calls: [call('production', ...HEAD)] });
  assert.deepEqual(runScript({ EVENT: 'workflow_dispatch', DESTINATION: 'preview', SHA: PIN }), { status: 0, out: '', calls: [call('preview', '--sha', PIN)] });
});

test('a scheduled run publishes to preview, then production, at the head of main', () => {
  assert.deepEqual(runScript({ EVENT: 'schedule' }).calls, [call('preview', ...HEAD), call('production', ...HEAD)]);
});

test('a failed destination fails the run, and the other is still published', () => {
  const r = runScript({ EVENT: 'schedule', FAIL: 'preview' });
  assert.equal(r.status, 1);
  assert.deepEqual(r.calls, [call('preview', ...HEAD), call('production', ...HEAD)]);
  assert.equal(runScript({ EVENT: 'workflow_dispatch', DESTINATION: 'production', FAIL: 'production' }).status, 1);
});

test('a commit input that is not 40 hex digits, or another event, publishes nothing', () => {
  for (const SHA of ['main', PIN.toUpperCase(), PIN.slice(1), `${PIN}; echo hi`, `$(echo ${PIN})`]) {
    const r = runScript({ EVENT: 'workflow_dispatch', DESTINATION: 'preview', SHA });
    assert.equal(r.status, 1, SHA);
    assert.deepEqual(r.calls, [], SHA);
    assert.match(r.out, /::error::sha must be 40 lowercase hex digits/);
  }
  const r = runScript({ EVENT: 'push' });
  assert.equal(r.status, 1);
  assert.deepEqual(r.calls, []);
});
