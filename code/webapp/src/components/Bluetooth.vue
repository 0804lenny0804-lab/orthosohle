<template>
  <div class="card shadow-sm mx-auto mt-5" style="max-width: 700px;">
    <div class="card-body text-center">
      <h3 class="fw-bold text-ortho mb-3">Bluetooth – Arduino Verbindung</h3>
      <p class="small text-muted">Gerätewerte werden nur vorübergehend in der Vorschau angezeigt, keinem Konto zugeordnet und nicht übertragen.</p>

      <button
        class="btn btn-lg btn-sohle shadow-sm mb-3"
        @click="discoverBluetoothDevices"
        :disabled="btBusy || !bluetoothAvailable"
      >
        {{ btBusy ? "Suche..." : "Bluetooth-Geraet auswaehlen" }}
      </button>

      <p v-if="!bluetoothAvailable" class="error" role="status">Web Bluetooth wird von diesem Gerät oder Browser nicht unterstützt.</p>
      <p v-if="btInfo" class="info">{{ btInfo }}</p>
      <p v-if="btError" class="error">⚠️ {{ btError }}</p>

      <div v-if="connectedKg !== null" class="mt-3">
        <h4 class="fw-bold">Aktuell:</h4>
        <div style="font-size: 2rem;">{{ connectedKg.toFixed(2) }} kg</div>
      </div>

      <div v-if="measurements.length > 0" class="mt-4 text-start">
        <h5 class="fw-bold">Letzte Werte:</h5>
        <ul class="list-group mt-2">
          <li
            v-for="(m, idx) in measurements"
            :key="idx"
            class="list-group-item d-flex justify-content-between align-items-center"
          >
            <span>{{ m.timestamp }}</span>
            <span class="fw-bold">{{ m.kg.toFixed(2) }} kg</span>
          </li>
        </ul>
      </div>

    </div>
  </div>
</template>

<script setup>
import { onUnmounted, ref } from "vue";

const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const CHARACTERISTIC_UUID = "12345678-1234-1234-1234-1234567890cd";

const emit = defineEmits(["raw-value"]);

const bluetoothAvailable = typeof navigator !== "undefined" && !!navigator.bluetooth?.requestDevice;
const btBusy = ref(false);
const btInfo = ref("");
const btError = ref("");
const measurements = ref([]);
const connectedKg = ref(null);

let bleDevice = null;
let bleCharacteristic = null;
let isDisposed = false;

function onDisconnected() {
  if (isDisposed) return;
  btInfo.value = "Bluetooth getrennt.";
  connectedKg.value = null;
}

function onCharacteristicChanged(event) {
  if (isDisposed) return;
  const dv = event.target.value;
  if (!dv || dv.byteLength < 4) return;

  // Arduino: BLEFloatCharacteristic => Float32 little-endian
  const kg = dv.getFloat32(0, true);
  if (!Number.isFinite(kg) || kg < 0) return;

  const timestamp = new Date().toISOString();
  connectedKg.value = kg;

  // exakt wie Simulation.vue
  emit("raw-value", kg);

  measurements.value.unshift({ kg: kg, timestamp: timestamp });
  if (measurements.value.length > 5) measurements.value.pop();
}

async function discoverBluetoothDevices() {
  btError.value = "";
  btInfo.value = "";
  connectedKg.value = null;

  if (!bluetoothAvailable) {
    btError.value = "Web Bluetooth wird von diesem Geraet/Browser nicht unterstuetzt.";
    return;
  }

  btBusy.value = true;

  try {
    const selectedDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID],
    });
    if (isDisposed) {
      selectedDevice.gatt?.disconnect();
      return;
    }
    bleDevice = selectedDevice;

    btInfo.value = "Geraet gewaehlt: " + (bleDevice.name || "Unbenannt");

    bleDevice.addEventListener("gattserverdisconnected", onDisconnected);

    await connectToSelectedDevice();
  } catch (error) {
    btError.value = "Fehler: " + (error && error.message ? error.message : String(error));
  } finally {
    btBusy.value = false;
  }
}

async function connectToSelectedDevice() {
  if (!bleDevice) return;

  btError.value = "";
  btInfo.value = "Verbinde...";
  btBusy.value = true;

  try {
    const server = await bleDevice.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
    if (isDisposed) {
      bleDevice.gatt.disconnect();
      return;
    }
    bleCharacteristic = characteristic;

    await characteristic.startNotifications();
    if (isDisposed) {
      characteristic.removeEventListener("characteristicvaluechanged", onCharacteristicChanged);
      await characteristic.stopNotifications().catch(() => {});
      bleDevice?.gatt?.disconnect();
      return;
    }

    // Falls erneut verbunden wird: alten Listener entfernen (verhindert Doppel-Events)
    try {
      bleCharacteristic.removeEventListener("characteristicvaluechanged", onCharacteristicChanged);
    } catch (e) {}

    bleCharacteristic.addEventListener("characteristicvaluechanged", onCharacteristicChanged);

    btInfo.value = "Verbunden mit: " + (bleDevice.name || "Unbenannt");
  } catch (error) {
    btError.value = "Fehler beim Verbinden: " + (error && error.message ? error.message : String(error));
  } finally {
    btBusy.value = false;
  }
}

onUnmounted(() => {
  isDisposed = true;
  if (bleCharacteristic) {
    bleCharacteristic.removeEventListener("characteristicvaluechanged", onCharacteristicChanged);
    void bleCharacteristic.stopNotifications().catch(() => {});
  }
  if (bleDevice) {
    bleDevice.removeEventListener("gattserverdisconnected", onDisconnected);
    if (bleDevice.gatt?.connected) bleDevice.gatt.disconnect();
  }
  bleCharacteristic = null;
  bleDevice = null;
  measurements.value = [];
  connectedKg.value = null;
});
</script>

<style scoped>
.info { margin-top: 10px; color: green; }
.error { margin-top: 10px; color: red; }
</style>
