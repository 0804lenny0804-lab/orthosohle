<template>
  <div class="card shadow-sm mx-auto mt-5" style="max-width: 700px;">
    <div class="card-body text-center">
      <h3 class="fw-bold text-ortho mb-3">Bluetooth – Arduino Verbindung</h3>

      <button
        class="btn btn-lg btn-sohle shadow-sm mb-3"
        @click="discoverBluetoothDevices"
        :disabled="btBusy"
      >
        {{ btBusy ? "Suche..." : "Bluetooth-Geraet auswaehlen" }}
      </button>

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
import { ref } from "vue";

const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const CHARACTERISTIC_UUID = "12345678-1234-1234-1234-1234567890cd";

const emit = defineEmits(["raw-value"]);

const btBusy = ref(false);
const btInfo = ref("");
const btError = ref("");
const measurements = ref([]);
const connectedKg = ref(null);

let bleDevice = null;
let bleCharacteristic = null;

function onDisconnected() {
  btInfo.value = "Bluetooth getrennt.";
  connectedKg.value = null;
}

function onCharacteristicChanged(event) {
  var dv = event.target.value;

  // Arduino: BLEFloatCharacteristic => Float32 little-endian
  var kg = dv.getFloat32(0, true);

  var timestamp = new Date().toISOString();
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

  if (!("bluetooth" in navigator)) {
    btError.value = "Web Bluetooth wird von diesem Geraet/Browser nicht unterstuetzt.";
    return;
  }

  btBusy.value = true;

  try {
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID],
    });

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
    var server = await bleDevice.gatt.connect();
    var service = await server.getPrimaryService(SERVICE_UUID);
    bleCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

    await bleCharacteristic.startNotifications();

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
</script>

<style scoped>
.info { margin-top: 10px; color: green; }
.error { margin-top: 10px; color: red; }
</style>
