<template>
  <div class="device-connection" style="max-width: 700px;">
    <div class="text-start">
      <h3 class="fw-bold text-ortho mb-3">Sohle</h3>

      <button
        class="btn btn-lg btn-sohle shadow-sm mb-3"
        @click="discoverBluetoothDevices"
        :disabled="btBusy || !bluetoothAvailable || simulationRunning"
      >
        {{ btBusy ? "Suche..." : "Sohle verbinden" }}
      </button>

      <p v-if="!bluetoothAvailable" class="error" role="status">Web Bluetooth wird von diesem Gerät oder Browser nicht unterstützt.</p>
      <p v-if="simulationRunning" class="info" role="status">Bluetooth kann nicht parallel zur Simulation verbunden werden.</p>
      <p v-if="btInfo" class="info">{{ btInfo }}</p>
      <p v-if="btError" class="error">⚠️ {{ btError }}</p>
    </div>
  </div>
</template>

<script setup>
import { onUnmounted, ref } from "vue";
import { createLegacyBleConnection } from "./legacy-ble-connection.js";

const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const CHARACTERISTIC_UUID = "12345678-1234-1234-1234-1234567890cd";

const emit = defineEmits(["raw-value", "connection-state", "connection-busy"]);
const props = defineProps({ simulationRunning: { type: Boolean, default: false } });

const bluetoothAvailable = typeof navigator !== "undefined" && !!navigator.bluetooth?.requestDevice;
const btBusy = ref(false);
const btInfo = ref("");
const btError = ref("");

const connection = createLegacyBleConnection({
  serviceUuid: SERVICE_UUID,
  characteristicUuid: CHARACTERISTIC_UUID,
  onRawValue: value => emit("raw-value", value),
  onState: value => emit("connection-state", value),
  onBusy: value => {
    btBusy.value = value;
    emit("connection-busy", value);
  },
  onInfo: value => { btInfo.value = value; },
  onError: value => { btError.value = value; },
});

async function discoverBluetoothDevices() {
  if (props.simulationRunning) return;
  btError.value = "";
  btInfo.value = "";
  emit("connection-state", false);

  if (!bluetoothAvailable) {
    btError.value = "Web Bluetooth wird von diesem Gerät oder Browser nicht unterstützt.";
    return;
  }

  const selection = connection.beginSelection();
  try {
    const selectedDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID],
    });
    await connection.connect(selectedDevice, selection);
  } catch (error) {
    connection.reportError(`Fehler: ${error?.message || String(error)}`, selection);
  }
}

onUnmounted(() => connection.dispose());
</script>

<style scoped>
.info { margin-top: 10px; color: green; }
.error { margin-top: 10px; color: red; }
</style>
