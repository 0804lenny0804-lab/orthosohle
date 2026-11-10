const SERVICE_UUID = "e6a70001-7b3c-4f21-9d10-2a5c6e8f0001";
const VALUE_UUID = "e6a70002-7b3c-4f21-9d10-2a5c6e8f0001";

const statusElement = document.querySelector("#status");
const readingElement = document.querySelector("#reading");
const logElement = document.querySelector("#log");
const connectButton = document.querySelector("#connect");
const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");

let device;
let characteristic;
let running = false;
let timer;

function setStatus(message) {
  statusElement.textContent = message;
}

function appendLog(message) {
  const previous = logElement.textContent === "Noch keine Werte gesendet."
    ? ""
    : `${logElement.textContent}\n`;
  logElement.textContent = `${previous}${message}`.trim().split("\n").slice(-12).join("\n");
}

function onDisconnected() {
  stopSimulation();
  characteristic = undefined;
  startButton.disabled = true;
  setStatus("ESP32 getrennt");
}

async function connectToBoard() {
  if (!navigator.bluetooth) {
    throw new Error("Web Bluetooth fehlt. Bitte Chrome oder Edge verwenden.");
  }

  device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [SERVICE_UUID] }],
    optionalServices: [SERVICE_UUID],
  });
  device.addEventListener("gattserverdisconnected", onDisconnected);

  setStatus(`Verbinde mit ${device.name || "ESP32"} …`);
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  characteristic = await service.getCharacteristic(VALUE_UUID);

  startButton.disabled = false;
  setStatus(`Verbunden mit ${device.name || "ESP32"}`);
}

function generatePhysiologicalStep() {
  const peak = 18 + Math.random() * 12;
  const samples = 26 + Math.floor(Math.random() * 8);
  const waveform = [];

  const heelStrikeEnd = 0.15;
  const loadEnd = 0.40;
  const midstanceEnd = 0.55;
  const toeOffEnd = 0.80;

  for (let index = 0; index < samples; index++) {
    const phase = index / (samples - 1);
    let value;

    if (phase < heelStrikeEnd) {
      value = (phase / heelStrikeEnd) * peak * 0.3;
    } else if (phase < loadEnd) {
      const progress = (phase - heelStrikeEnd) / (loadEnd - heelStrikeEnd);
      value = peak * 0.3 + progress * peak * 0.4;
    } else if (phase < midstanceEnd) {
      const progress = (phase - loadEnd) / (midstanceEnd - loadEnd);
      value = Math.min(peak, peak * (0.8 + Math.sin(progress * Math.PI) * 0.6));
    } else if (phase < toeOffEnd) {
      const progress = (phase - midstanceEnd) / (toeOffEnd - midstanceEnd);
      value = peak * (0.6 - 0.6 * progress);
    } else {
      value = 0;
    }

    value += (Math.random() - 0.5) * 3;
    waveform.push(Math.max(0, Math.round(value)));
  }

  return waveform;
}

async function sendValueToBoard(value) {
  if (!characteristic || !device?.gatt?.connected) {
    throw new Error("ESP32 ist nicht verbunden.");
  }

  const payload = new TextEncoder().encode(value.toFixed(1));
  if (characteristic.properties.writeWithoutResponse) {
    await characteristic.writeValueWithoutResponse(payload);
  } else {
    await characteristic.writeValueWithResponse(payload);
  }

  readingElement.textContent = `${value.toFixed(1)} kg`;
  appendLog(`${new Date().toLocaleTimeString()} — ${value.toFixed(1)} kg`);
}

async function sendWaveform(waveform, index = 0) {
  if (!running) return;

  if (index >= waveform.length) {
    timer = window.setTimeout(() => {
      if (running) sendWaveform(generatePhysiologicalStep());
    }, 8000);
    return;
  }

  try {
    await sendValueToBoard(waveform[index]);
    timer = window.setTimeout(() => sendWaveform(waveform, index + 1), 200);
  } catch (error) {
    stopSimulation();
    setStatus(`Übertragung fehlgeschlagen: ${error.message}`);
  }
}

function startSimulation() {
  if (running || !characteristic) return;
  running = true;
  startButton.disabled = true;
  stopButton.disabled = false;
  setStatus("Simulation läuft; Werte sind synthetisch");
  sendWaveform(generatePhysiologicalStep());
}

function stopSimulation() {
  running = false;
  window.clearTimeout(timer);
  startButton.disabled = !characteristic;
  stopButton.disabled = true;
  if (characteristic) setStatus("Verbunden; Simulation gestoppt");
}

connectButton.addEventListener("click", async () => {
  connectButton.disabled = true;
  try {
    await connectToBoard();
  } catch (error) {
    setStatus(`Verbindung fehlgeschlagen: ${error.message}`);
  } finally {
    connectButton.disabled = false;
  }
});

startButton.addEventListener("click", startSimulation);
stopButton.addEventListener("click", stopSimulation);
