// @ts-check
// Local-browser persistence for Deskwise.
// Schema-versioned, hard-capped, silent on failure. No server, no auth.
// Works with any Web Storage-shaped object (localStorage, mock, etc.).

export const STORAGE_KEY = 'deskwise.v1';
export const SCHEMA_VERSION = 1;
export const LIMITS = { events: 50, earSamples: 60 };

/**
 * Default settings matching the HTML form defaults.
 * @returns {Object}
 */
export function defaultSettings() {
  return {
    threshold: 0.22,
    delay: 2.0,
    volume: 55,
    sound: true,
    wake: false,
    breakInterval: 25,
    rate: 8,
  };
}

/**
 * Normalize a raw stored value into a well-formed record.
 * Rejects wrong schema versions, filters malformed events/samples,
 * and clamps arrays to their limits. Returns null for unrecoverable input.
 * @param {unknown} raw
 * @returns {{ settings: Object, events: Array, earSamples: Array } | null}
 */
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.schemaVersion !== SCHEMA_VERSION) return null;

  const defaults = defaultSettings();
  const settings = (raw.settings && typeof raw.settings === 'object')
    ? { ...defaults, ...raw.settings }
    : { ...defaults };

  // Clamp numeric settings to their valid HTML ranges.
  settings.threshold = clamp(settings.threshold, 0.12, 0.32);
  settings.delay = clamp(settings.delay, 1, 5);
  settings.volume = clamp(settings.volume, 0, 100);
  settings.breakInterval = Number.isFinite(+settings.breakInterval)
    ? +settings.breakInterval
    : defaults.breakInterval;
  settings.rate = [5, 8, 12].includes(+settings.rate) ? +settings.rate : defaults.rate;
  settings.sound = settings.sound === false ? false : true;
  settings.wake = settings.wake === true ? true : false;

  const events = Array.isArray(raw.events)
    ? raw.events
        .filter(e => e && typeof e === 'object' && typeof e.text === 'string' && typeof e.at === 'string')
        .slice(0, LIMITS.events)
    : [];

  const earSamples = Array.isArray(raw.earSamples)
    ? raw.earSamples
        .filter(s => s && typeof s === 'object' && typeof s.at === 'number' &&
          (s.ear === null || typeof s.ear === 'number'))
        .slice(-LIMITS.earSamples)
    : [];

  return { settings, events, earSamples };
}

function clamp(value, min, max) {
  const n = +value;
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Create a persistence adapter around a Web Storage-shaped object.
 * Silently marks itself unavailable if the initial probe write throws
 * (e.g. Safari private mode, sandboxed iframes, quota exceeded).
 * @param {Storage} storage
 * @returns {{ available: boolean, read(): object|null, write(data: object): void, clear(): void, bytes(): number }}
 */
export function makePersistence(storage) {
  let available = true;

  // Probe: Safari throws on write in private mode before iOS 11.
  try {
    const probeKey = '__deskwise_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
  } catch {
    available = false;
  }

  return {
    get available() { return available; },

    read() {
      if (!available) return null;
      try {
        const text = storage.getItem(STORAGE_KEY);
        if (!text) return null;
        const parsed = JSON.parse(text);
        return normalize(parsed);
      } catch {
        return null;
      }
    },

    write(data) {
      if (!available) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Quota exceeded or write error — degrade silently.
        available = false;
      }
    },

    clear() {
      if (!available) return;
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // Unlikely, but degrade silently.
      }
    },

    bytes() {
      if (!available) return 0;
      try {
        const text = storage.getItem(STORAGE_KEY);
        return text ? text.length : 0;
      } catch {
        return 0;
      }
    },
  };
}
