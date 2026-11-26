export function validStepUp(result) {
  return result?.verified === true && result.sessionBound === true;
}
