import { test } from "node:test";
import assert from "node:assert/strict";
import {
  startDemoSession,
  addDemoSample,
  endDemoSession,
} from "../src/domain/demo-session.ts";

test("Demo-Ablauf erhält Quelle und Zeitbezug ohne Eingaben zu verändern", () => {
  const initial = startDemoSession(100);
  const withSample = addDemoSample(initial, 18, 200);
  const ended = endDemoSession(withSample, 300);
  assert.equal(initial.samples.length, 0);
  assert.deepEqual(ended, {
    source: "demo",
    startedAt: 100,
    endedAt: 300,
    samples: [{ kg: 18, receivedAt: 200 }],
  });
  assert.throws(() => addDemoSample(ended, 20, 400), /beendet/);
  assert.throws(() => endDemoSession(ended, 400), /Sitzungsende/);
});

test("Ungültige Werte und rückwärts laufende Zeit werden abgewiesen", () => {
  for (const value of [NaN, Infinity, -1])
    assert.throws(() => startDemoSession(value));
  const session = addDemoSample(startDemoSession(100), 0, 200);
  for (const kg of [NaN, Infinity, -1])
    assert.throws(() => addDemoSample(session, kg, 300));
  for (const time of [NaN, Infinity, 199]) {
    assert.throws(() => addDemoSample(session, 20, time));
    assert.throws(() => endDemoSession(session, time));
  }
});
