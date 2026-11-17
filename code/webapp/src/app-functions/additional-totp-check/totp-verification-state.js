export function validStepUp(result) {
  return result?.verified === true && result.expiresInSeconds === 300;
}
