import assert from 'node:assert/strict';
import test from 'node:test';
import { createLegacyBleConnection } from '../../src/app-functions/measurements/legacy-ble-connection.js';

class FakeTarget {
  listeners = new Map();
  addEventListener(type, listener) {
    const values = this.listeners.get(type) || new Set();
    values.add(listener);
    this.listeners.set(type, values);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
}

function fakeDevice(name) {
  const device = new FakeTarget();
  device.name = name;
  const characteristic = new FakeTarget();
  characteristic.started = 0;
  characteristic.stopped = 0;
  characteristic.startNotifications = async () => { characteristic.started += 1; return characteristic; };
  characteristic.stopNotifications = async () => { characteristic.stopped += 1; };
  const service = { getCharacteristic: async () => characteristic };
  const server = { getPrimaryService: async () => service };
  device.gatt = {
    connected: false,
    async connect() { this.connected = true; return server; },
    disconnect() { this.connected = false; device.dispatch('gattserverdisconnected'); },
  };
  return { device, characteristic };
}

function float32(value) {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setFloat32(0, value, true);
  return new DataView(buffer);
}

test('disconnect removes the active value listener and reconnect only forwards the new device', async () => {
  const values = [], states = [];
  const connection = createLegacyBleConnection({
    serviceUuid: 'service', characteristicUuid: 'characteristic',
    onRawValue: value => values.push(value), onState: state => states.push(state),
  });
  const first = fakeDevice('first'), second = fakeDevice('second');

  const firstSelection = connection.beginSelection();
  await connection.connect(first.device, firstSelection);
  const staleListener = [...first.characteristic.listeners.get('characteristicvaluechanged')][0];
  assert.equal(first.characteristic.listenerCount('characteristicvaluechanged'), 1);
  assert.equal(first.device.listenerCount('gattserverdisconnected'), 1);
  first.characteristic.dispatch('characteristicvaluechanged', { target: { value: float32(12) } });
  assert.equal(values.length, 1);

  first.device.gatt.connected = false;
  first.device.dispatch('gattserverdisconnected');
  assert.equal(first.characteristic.listenerCount('characteristicvaluechanged'), 0);
  assert.equal(first.device.listenerCount('gattserverdisconnected'), 0);
  staleListener({ target: { value: float32(99) } });
  assert.equal(values.length, 1, 'a queued callback from the old connection is ignored');

  const secondSelection = connection.beginSelection();
  await connection.connect(second.device, secondSelection);
  first.characteristic.dispatch('characteristicvaluechanged', { target: { value: float32(77) } });
  second.characteristic.dispatch('characteristicvaluechanged', { target: { value: float32(20) } });
  assert.deepEqual(values.map(item => item.kg), [12, 20]);
  assert.deepEqual(states, [false, true, false, false, true]);
  connection.dispose();
  assert.equal(second.characteristic.listenerCount('characteristicvaluechanged'), 0);
  assert.equal(second.device.listenerCount('gattserverdisconnected'), 0);
});

test('an older asynchronous GATT connect cannot replace a newer selection', async () => {
  let resolveFirst;
  const first = fakeDevice('first');
  first.device.gatt.connect = () => new Promise(resolve => { resolveFirst = resolve; });
  const second = fakeDevice('second');
  const states = [], values = [];
  const connection = createLegacyBleConnection({
    serviceUuid: 'service', characteristicUuid: 'characteristic',
    onState: value => states.push(value), onRawValue: value => values.push(value),
  });

  const oldSelection = connection.beginSelection();
  const oldConnect = connection.connect(first.device, oldSelection);
  const newSelection = connection.beginSelection();
  await connection.connect(second.device, newSelection);
  resolveFirst({ getPrimaryService: async () => { throw new Error('stale connection continued'); } });
  await oldConnect;

  assert.equal(first.device.gatt.connected, false);
  assert.equal(first.device.listenerCount('gattserverdisconnected'), 0);
  assert.equal(second.characteristic.listenerCount('characteristicvaluechanged'), 1);
  first.characteristic.dispatch('characteristicvaluechanged', { target: { value: float32(44) } });
  second.characteristic.dispatch('characteristicvaluechanged', { target: { value: float32(33) } });
  assert.deepEqual(values.map(item => item.kg), [33]);
  assert.deepEqual(states, [false, false, true]);
  connection.dispose();
});
