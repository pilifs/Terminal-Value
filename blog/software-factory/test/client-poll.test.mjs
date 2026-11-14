// Polling the pointer (blog/assets/software-factory/poll.js): only while the tab
// is visible, never two requests at once, and on through errors. A fake clock
// and visibility drive it. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPoller, POLL_INTERVAL } from '../../assets/software-factory/poll.js';

function harness({ check }) {
  let time = 0;
  let visible = true;
  let listener = () => {};
  const timers = new Map();
  let nextId = 1;
  const poller = createPoller({
    check,
    isVisible: () => visible,
    onVisibilityChange: (fn) => (listener = fn),
    setTimeout: (fn, ms) => (timers.set(nextId, { fn, at: time + ms }), nextId++),
    clearTimeout: (id) => timers.delete(id),
    now: () => time,
  });
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  return {
    poller,
    /** Move the clock on, firing due timers in order, and let checks settle. */
    async advance(ms) {
      const end = time + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        time = due[1].at;
        due[1].fn();
        await flush();
      }
      time = end;
      await flush();
    },
    setVisible(v) {
      visible = v;
      listener();
    },
    pending: () => timers.size,
  };
}

test('the interval is between 30 and 60 seconds', () => {
  assert.ok(POLL_INTERVAL >= 30_000 && POLL_INTERVAL <= 60_000);
});

test('it checks once per interval while visible, and not while hidden', async () => {
  let checks = 0;
  const h = harness({ check: async () => void checks++ });
  h.poller.start();
  await h.advance(POLL_INTERVAL - 1);
  assert.equal(checks, 0);
  await h.advance(1);
  assert.equal(checks, 1);
  await h.advance(POLL_INTERVAL * 2);
  assert.equal(checks, 3);

  h.setVisible(false);
  assert.equal(h.pending(), 0, 'no timer while hidden');
  await h.advance(POLL_INTERVAL * 10);
  assert.equal(checks, 3);

  // Back after a long time: one check at once, then the normal pace.
  h.setVisible(true);
  await h.advance(0);
  assert.equal(checks, 4);
  await h.advance(POLL_INTERVAL);
  assert.equal(checks, 5);
});

test('hiding the tab cancels a request in flight', async () => {
  const signals = [];
  const h = harness({ check: (signal) => (signals.push(signal), new Promise(() => {})) });
  h.poller.start();
  await h.advance(POLL_INTERVAL);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].aborted, false);
  h.setVisible(false);
  assert.equal(signals[0].aborted, true);
});

test('a new check cancels the obsolete one', async () => {
  const signals = [];
  const h = harness({ check: (signal) => (signals.push(signal), new Promise(() => {})) });
  h.poller.start();
  h.poller.checkNow();
  h.poller.checkNow();
  await h.advance(0);
  assert.equal(signals.length, 2);
  assert.deepEqual(signals.map((s) => s.aborted), [true, false]);
});

test('an error doesn’t stop polling', async () => {
  let checks = 0;
  const h = harness({
    check: async () => {
      checks++;
      throw new Error('503');
    },
  });
  h.poller.start();
  await h.advance(POLL_INTERVAL * 3);
  assert.equal(checks, 3);
  h.poller.stop();
  await h.advance(POLL_INTERVAL * 3);
  assert.equal(checks, 3);
});
