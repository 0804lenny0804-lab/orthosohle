export function physicianRequestIsCurrent({
  mounted,
  requestGeneration,
  currentGeneration,
  requestIdentity,
  currentIdentity,
  requestPatientId = '',
  currentPatientId = '',
}) {
  return mounted && requestGeneration === currentGeneration
    && requestIdentity === currentIdentity
    && (!requestPatientId || requestPatientId === currentPatientId);
}

export function physicianDetailRequestIsCurrent({
  detailRequestGeneration,
  currentDetailRequestGeneration,
  sessionId,
  selectedSessionId,
  ...requestContext
}) {
  return detailRequestGeneration === currentDetailRequestGeneration
    && sessionId === selectedSessionId
    && physicianRequestIsCurrent(requestContext);
}

export function physicianAccessErrorMessage(status, { accountStatus = '', sessionChecked = false } = {}) {
  if (status === 401) {
    if (!sessionChecked || accountStatus === 'unavailable') {
      return 'Der Anmeldestatus konnte nicht bestätigt werden. Der Arztzugriff bleibt geschlossen; bitte später erneut versuchen.';
    }
    if (accountStatus === 'anonymous') return 'Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.';
    if (accountStatus === 'authenticated') {
      return 'Deine Anmeldung ist weiterhin gültig. Der Arztzugriff wurde geschlossen; bitte TOTP erneut bestätigen.';
    }
    return 'Der Anmeldestatus konnte nicht bestätigt werden. Der Arztzugriff bleibt geschlossen.';
  }
  if (status === 403) {
    return 'Der Server hat den Arztzugriff abgelehnt. Die Arztansichten wurden geschlossen. Bitte Freigabestatus prüfen und TOTP erneut bestätigen.';
  }
  if (status === 404) {
    return 'Die angeforderte Sitzung oder aktive Patientenzuordnung ist nicht verfügbar. Die Arztansichten wurden geschlossen.';
  }
  return 'Der Arztzugriff konnte nicht bestätigt werden. Die Arztansichten bleiben geschlossen.';
}

export function shouldClosePhysicianAccessOnResume({ active, eventType, visibilityState = '' }) {
  return active && (eventType === 'focus' || (eventType === 'visibilitychange' && visibilityState === 'visible'));
}

export function shouldReportCareAccessError(role, status) {
  return role === 'physician' && [401, 403].includes(status);
}
