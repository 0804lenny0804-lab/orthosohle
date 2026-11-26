// This is a navigation preference only; it never grants or requests a server role.
export function accountIntentDestination(intent) {
  return intent === 'physician' ? 'physician' : 'patient';
}

export function resolveNavigation(intent, requestedNavigation) {
  if (intent === 'physician' && requestedNavigation === 'patients') return 'doctor';
  if (intent === 'physician' && requestedNavigation === 'invitations') return 'account';
  if (intent === 'physician') return ['doctor', 'account'].includes(requestedNavigation)
    ? requestedNavigation
    : 'doctor';
  return ['account', 'live', 'config', 'connect', 'history'].includes(requestedNavigation)
    ? requestedNavigation
    : 'account';
}

export function intentAfterIdentityChange(intent, previousIdentity, nextIdentity) {
  return previousIdentity && previousIdentity !== nextIdentity ? 'patient' : accountIntentDestination(intent);
}

export function accountIntentDescription(intent) {
  return intent === 'physician'
    ? 'Arzt: Melde dich mit deinem Konto an oder erstelle eines. Arztzugriff setzt eine separate Prüfung und ausdrückliche Freigabe voraus.'
    : 'Patient: Melde dich mit deinem Konto an oder erstelle eines, um dein Patientenprofil und deine Messansichten zu nutzen.';
}
