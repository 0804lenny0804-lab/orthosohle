// This is a navigation preference only; it never grants or requests a server role.
export function accountIntentDestination(intent) {
  return intent === 'physician' ? 'physician' : 'patient';
}

export function accountIntentDescription(intent) {
  return intent === 'physician'
    ? 'Arzt: Melde dich mit deinem Konto an oder erstelle eines. Arztzugriff setzt eine separate Prüfung und ausdrückliche Freigabe voraus.'
    : 'Patient: Melde dich mit deinem Konto an oder erstelle eines, um dein Patientenprofil und deine Messansichten zu nutzen.';
}
