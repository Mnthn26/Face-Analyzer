// @ts-check
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  LIMITS,
  defaultSettings,
  normalize,
  makePersistence,
} from './persistence.js';

// Minimal in-memory Storage mock for tests.
function createMockStorage() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    _map: store,
  };
}

describe('persistence', () => {
  it('defaultSettings returns the expected shape', () => {
    const s = defaultSettings();
    assert.equal(s.threshold, 0.22);
    assert.equal(s.delay, 2.0);
    assert.equal(s.volume, 55);
    assert.equal(s.sound, true);
    assert.equal(s.wake, false);
    assert.equal(s.breakInterval, 25);
    assert.equal(s.rate, 8);
    // All keys are present
    assert.equal(Object.keys(s).length, 7);
  });

  it('rejects data with wrong schema version', () => {
    assert.equal(normalize(null), null);
    assert.equal(normalize(undefined), null);
    assert.equal(normalize('string'), null);
    assert.equal(normalize({}), null); // missing schemaVersion
    assert.equal(normalize({ schemaVersion: 999 }), null);
    assert.equal(normalize({ schemaVersion: 0 }), null);
  });

  it('tolerates malformed input — filters bad events and samples instead of throwing', () => {
    const raw = {
      schemaVersion: SCHEMA_VERSION,
      settings: { threshold: 0.25 },
      events: [
        { at: '2025-01-01T00:00:00Z', text: 'Good event' },
        { at: '2025-01-01T00:00:00Z' }, // missing text
        { text: 'no timestamp' },        // missing at
        'not an object',                 // wrong type
        null,                            // null entry
        42,                              // number
        { at: '2025-01-01T00:00:00Z', text: 'Another good one' },
      ],
      earSamples: [
        { at: 1000, ear: 0.31 },
        { at: 2000, ear: null },
        { at: 'bad', ear: 0.2 },        // at not a number
        { at: 3000, ear: 'NaN' },       // ear not number or null
        null,                            // null entry
        { at: 4000, ear: 0.28 },
      ],
    };
    const result = normalize(raw);
    assert.notEqual(result, null);
    // Only the two valid events survive
    assert.equal(result.events.length, 2);
    assert.equal(result.events[0].text, 'Good event');
    assert.equal(result.events[1].text, 'Another good one');
    // Only the three valid samples survive
    assert.equal(result.earSamples.length, 3);
    assert.equal(result.earSamples[0].ear, 0.31);
    assert.equal(result.earSamples[1].ear, null);
    assert.equal(result.earSamples[2].ear, 0.28);
    // Settings fall back to defaults for missing keys
    assert.equal(result.settings.threshold, 0.25);
    assert.equal(result.settings.volume, 55); // default
  });

  it('read/write/bytes roundtrip through mock storage', () => {
    const storage = createMockStorage();
    const p = makePersistence(storage);
    assert.equal(p.available, true);

    const data = {
      schemaVersion: SCHEMA_VERSION,
      settings: { ...defaultSettings(), threshold: 0.28 },
      events: [{ at: '2025-06-15T10:00:00Z', text: 'Test event' }],
      earSamples: [{ at: Date.now(), ear: 0.33 }],
    };

    p.write(data);
    assert.ok(p.bytes() > 0);

    const read = p.read();
    assert.notEqual(read, null);
    assert.equal(read.settings.threshold, 0.28);
    assert.equal(read.events.length, 1);
    assert.equal(read.events[0].text, 'Test event');
    assert.equal(read.earSamples.length, 1);
    assert.equal(read.earSamples[0].ear, 0.33);
  });

  it('broken storage gracefully degrades — marks unavailable, does not throw', () => {
    // Storage that always throws on write
    const broken = {
      getItem() { throw new Error('broken'); },
      setItem() { throw new Error('broken'); },
      removeItem() { throw new Error('broken'); },
    };
    const p = makePersistence(broken);
    assert.equal(p.available, false);
    // Operations return safely
    assert.equal(p.read(), null);
    p.write({ test: true }); // no throw
    p.clear();               // no throw
    assert.equal(p.bytes(), 0);
  });

  it('clear() removes only the deskwise key from storage', () => {
    const storage = createMockStorage();
    const p = makePersistence(storage);

    // Pre-populate
    storage.setItem('other-key', 'keep me');
    storage.setItem(STORAGE_KEY, JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      settings: defaultSettings(),
      events: [],
      earSamples: [],
    }));

    assert.notEqual(storage.getItem(STORAGE_KEY), null);
    p.clear();
    assert.equal(storage.getItem(STORAGE_KEY), null);
    // Other keys are untouched
    assert.equal(storage.getItem('other-key'), 'keep me');
  });

  it('enforces hard caps on events and earSamples', () => {
    const storage = createMockStorage();
    const p = makePersistence(storage);

    const manyEvents = Array.from({ length: 100 }, (_, i) => ({
      at: `2025-01-01T00:${String(i).padStart(2, '0')}:00Z`,
      text: `Event ${i}`,
    }));
    const manySamples = Array.from({ length: 200 }, (_, i) => ({
      at: 1000 + i,
      ear: 0.25 + (i % 10) * 0.01,
    }));

    const data = {
      schemaVersion: SCHEMA_VERSION,
      settings: defaultSettings(),
      events: manyEvents,
      earSamples: manySamples,
    };

    p.write(data);
    const read = p.read();
    assert.ok(read.events.length <= LIMITS.events, `events capped to ${LIMITS.events}`);
    assert.ok(read.earSamples.length <= LIMITS.earSamples, `earSamples capped to ${LIMITS.earSamples}`);
  });
});
