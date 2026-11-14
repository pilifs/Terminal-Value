// Polling the snapshot pointer while the tab is visible. The clock and the
// page's visibility are passed in, so a Node test can drive them.
//
//   createPoller({ check, interval, isVisible, onVisibilityChange, setTimeout, clearTimeout })
//     -> { start(), stop(), checkNow() }
//   check(signal) is one conditional request. A new check aborts one still in
//   flight, and hiding the tab aborts it and pauses polling; showing the tab
//   again checks at once if a check is due. Errors are the check's to handle:
//   the poller only keeps going.

export const POLL_INTERVAL = 45_000;

export function createPoller({
  check,
  interval = POLL_INTERVAL,
  isVisible = () => true,
  onVisibilityChange = () => {},
  setTimeout: later = globalThis.setTimeout,
  clearTimeout: cancel = globalThis.clearTimeout,
  now = () => Date.now(),
}) {
  let timer = null;
  let inFlight = null;
  let lastCheck = now();
  let running = false;

  const schedule = (ms) => {
    cancel(timer);
    timer = running && isVisible() ? later(run, Math.max(0, ms)) : null;
  };

  async function run() {
    timer = null;
    if (!running || !isVisible()) return;
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    lastCheck = now();
    try {
      await check(controller.signal);
    } catch {
      // The check keeps the last valid view; polling goes on.
    } finally {
      if (inFlight === controller) inFlight = null;
    }
    if (inFlight === null) schedule(interval);
  }

  onVisibilityChange(() => {
    if (!running) return;
    if (isVisible()) schedule(lastCheck + interval - now());
    else {
      cancel(timer);
      timer = null;
      inFlight?.abort();
      inFlight = null;
    }
  });

  return {
    start() {
      running = true;
      lastCheck = now();
      schedule(interval);
    },
    stop() {
      running = false;
      cancel(timer);
      timer = null;
      inFlight?.abort();
      inFlight = null;
    },
    checkNow: () => run(),
  };
}
