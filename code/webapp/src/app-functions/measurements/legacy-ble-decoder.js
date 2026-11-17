// Legacy Arduino BLEFloatCharacteristic sends one Float32 in little-endian order.
export function decodeLegacyBleFloat32(dataView) {
  if (!dataView || dataView.byteLength < 4) return null;

  const kg = dataView.getFloat32(0, true);
  return Number.isFinite(kg) && kg >= 0 ? kg : null;
}
