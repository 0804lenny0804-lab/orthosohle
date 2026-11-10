import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { decodeLegacyBleFloat32 } from '../src/components/legacy-ble-float32.js';

function payload(value) {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setFloat32(0, value, true);
  return new DataView(buffer);
}

test('legacy BLE decoder rejects short payloads, NaN, infinities, and negative weights', () => {
  assert.equal(decodeLegacyBleFloat32(new DataView(new ArrayBuffer(3))), null);
  for (const value of [NaN, Infinity, -Infinity, -0.01]) {
    assert.equal(decodeLegacyBleFloat32(payload(value)), null);
  }
});

test('legacy BLE decoder reads valid little-endian Float32 weights', () => {
  assert.equal(decodeLegacyBleFloat32(payload(12.5)), 12.5);
  assert.equal(decodeLegacyBleFloat32(payload(0)), 0);
});

test('BLE and simulation events carry kg with one receive timestamp for App consumers', async () => {
  const [bluetooth, simulation, app] = await Promise.all([
    readFile(new URL('../src/components/Bluetooth.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/SimulationControl.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
  ]);
  assert.match(bluetooth, /emit\("raw-value", \{ kg, timestamp \}\)/);
  assert.match(simulation, /\{ kg: value, timestamp: new Date\(\)\.toISOString\(\) \}/);
  assert.match(app, /onRawValue\(\{ kg, timestamp: receivedAt \}\)/);
  assert.match(app, /new Date\(receivedAt\)/);
  assert.match(app, /this\.stepDetector\.onSample\(numericValue, timestamp\)/);
});
