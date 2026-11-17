import { decodeLegacyBleFloat32 } from './legacy-ble-decoder.js';

/** Owns one legacy Web Bluetooth connection and rejects events from old GATT generations. */
export function createLegacyBleConnection({
  serviceUuid,
  characteristicUuid,
  onRawValue = () => {},
  onState = () => {},
  onBusy = () => {},
  onInfo = () => {},
  onError = () => {},
}) {
  let generation = 0;
  let disposed = false;
  let device = null;
  let characteristic = null;
  let disconnectListener = null;
  let valueListener = null;

  function isCurrent(expectedGeneration, expectedDevice) {
    return !disposed && generation === expectedGeneration && device === expectedDevice;
  }

  function release(targetDevice, targetCharacteristic, targetDisconnectListener, targetValueListener) {
    if (targetCharacteristic && targetValueListener) {
      targetCharacteristic.removeEventListener('characteristicvaluechanged', targetValueListener);
      void Promise.resolve(targetCharacteristic.stopNotifications?.()).catch(() => {});
    }
    if (targetDevice && targetDisconnectListener) {
      targetDevice.removeEventListener('gattserverdisconnected', targetDisconnectListener);
    }
    if (targetDevice?.gatt?.connected) targetDevice.gatt.disconnect();
  }

  function detachCurrent() {
    const previous = { device, characteristic, disconnectListener, valueListener };
    device = null;
    characteristic = null;
    disconnectListener = null;
    valueListener = null;
    release(previous.device, previous.characteristic, previous.disconnectListener, previous.valueListener);
  }

  function beginSelection() {
    if (disposed) return null;
    generation += 1;
    detachCurrent();
    onState(false);
    onBusy(true);
    return generation;
  }

  function reportError(message, expectedGeneration = generation) {
    if (disposed || generation !== expectedGeneration) return;
    onError(message);
    onBusy(false);
  }

  async function connect(selectedDevice, expectedGeneration = generation) {
    if (!selectedDevice || !isCurrent(expectedGeneration, null)) return;
    device = selectedDevice;
    const ownDevice = selectedDevice;
    const ownGeneration = expectedGeneration;
    onInfo(`Gerät gewählt: ${ownDevice.name || 'Unbenannt'}`);

    const handleDisconnect = () => {
      if (!isCurrent(ownGeneration, ownDevice)) return;
      generation += 1;
      detachCurrent();
      onInfo('Bluetooth getrennt.');
      onState(false);
      onBusy(false);
    };
    disconnectListener = handleDisconnect;
    ownDevice.addEventListener('gattserverdisconnected', handleDisconnect);

    let connectingCharacteristic = null;
    try {
      onError('');
      onInfo('Verbinde...');
      const server = await ownDevice.gatt.connect();
      if (!isCurrent(ownGeneration, ownDevice)) {
        ownDevice.gatt?.disconnect();
        return;
      }
      const service = await server.getPrimaryService(serviceUuid);
      if (!isCurrent(ownGeneration, ownDevice)) {
        ownDevice.gatt?.disconnect();
        return;
      }
      connectingCharacteristic = await service.getCharacteristic(characteristicUuid);
      if (!isCurrent(ownGeneration, ownDevice)) {
        await Promise.resolve(connectingCharacteristic.stopNotifications?.()).catch(() => {});
        ownDevice.gatt?.disconnect();
        return;
      }
      await connectingCharacteristic.startNotifications();
      if (!isCurrent(ownGeneration, ownDevice)) {
        await Promise.resolve(connectingCharacteristic.stopNotifications?.()).catch(() => {});
        ownDevice.gatt?.disconnect();
        return;
      }

      const ownCharacteristic = connectingCharacteristic;
      const handleValue = event => {
        if (!isCurrent(ownGeneration, ownDevice) || characteristic !== ownCharacteristic
          || !ownDevice.gatt?.connected) return;
        const kg = decodeLegacyBleFloat32(event.target?.value);
        if (kg === null) return;
        onRawValue({ kg, timestamp: new Date().toISOString(), source: 'ble' });
      };
      characteristic = ownCharacteristic;
      valueListener = handleValue;
      ownCharacteristic.addEventListener('characteristicvaluechanged', handleValue);
      onInfo(`Verbunden mit: ${ownDevice.name || 'Unbenannt'}`);
      onState(true);
    } catch (error) {
      if (!isCurrent(ownGeneration, ownDevice)) return;
      if (connectingCharacteristic) {
        connectingCharacteristic.removeEventListener('characteristicvaluechanged', valueListener);
        await Promise.resolve(connectingCharacteristic.stopNotifications?.()).catch(() => {});
      }
      detachCurrent();
      onState(false);
      onError(`Fehler beim Verbinden: ${error?.message || String(error)}`);
      onBusy(false);
    } finally {
      if (isCurrent(ownGeneration, ownDevice)) onBusy(false);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    generation += 1;
    detachCurrent();
    onState(false);
    onBusy(false);
  }

  return { beginSelection, connect, reportError, dispose };
}
